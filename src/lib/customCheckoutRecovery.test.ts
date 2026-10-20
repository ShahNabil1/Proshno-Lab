import { describe, expect, it, vi } from "vitest";
import { recoverCustomCheckout } from "../../supabase/functions/_shared/customCheckoutRecovery";

const now = Date.parse("2026-10-20T15:00:00Z");
const order = {kind:"custom",subject_ids:[131,132]};
const old = {id:55,payment_id:"old-payment",selected_packages:[order],amount:274,coupon_code:"PLAB50",created_at:new Date(now-86400000).toISOString(),bkash_response:{bkashURL:"https://gateway.test/resume"},trx_id:null};
const unpaid = {statusCode:"0000",paymentID:"old-payment",currency:"BDT",amount:"274.00",transactionStatus:"Initiated"};
function setup(rows = [old], activationError: unknown = null) {
  const updates: unknown[] = [];
  const chain: any = { select:()=>chain,eq:()=>chain,order:()=>chain,limit:async()=>({data:rows,error:null}),update:(patch:unknown)=>{updates.push(patch);return chain;},then:(resolve:any)=>resolve({error:null}) };
  return {admin:{from:()=>chain,rpc:vi.fn(async()=>({error:activationError}))},updates};
}
const run = (admin:any,query:any,amount=274,coupon:string|null="PLAB50") => recoverCustomCheckout(admin,"buyer",order,amount,coupon,"live",query,now);
describe("abandoned custom checkout recovery",()=>{
  it("allows a new payment only after a fresh unpaid status, retaining old evidence",async()=>{
    const {admin,updates}=setup(); const query=vi.fn(async()=>unpaid);
    expect((await run(admin,query)).verifiedUnpaidIds).toEqual([55]);
    expect(query).toHaveBeenCalledWith("old-payment");expect(updates).toEqual([]);
  });
  it("resumes a recent identical checkout rather than creating a second link",async()=>{
    const {admin}=setup([{...old,created_at:new Date(now-10000).toISOString()}]);
    expect((await run(admin,async()=>unpaid)).resume?.paymentID).toBe("old-payment");
    await expect(run(admin,async()=>unpaid,999,null)).rejects.toThrow("PAYMENT_CREATION_IN_PROGRESS");
  });
  it("permits a changed cart/coupon after checking an abandoned attempt",async()=>{
    const {admin}=setup();expect((await run(admin,async()=>unpaid,999,null)).verifiedUnpaidIds).toEqual([55]);
  });
  it("reconciles completed money and never asks the buyer to pay again",async()=>{
    const {admin}=setup();await expect(run(admin,async()=>({...unpaid,transactionStatus:"Completed",trxID:"paid-trx"}))).rejects.toThrow("PAYMENT_ALREADY_COMPLETED");
    expect(admin.rpc).toHaveBeenCalledWith("complete_custom_payment",expect.objectContaining({payment_ref:55}));
  });
  it("preserves a completed receipt when activation needs recovery",async()=>{
    const {admin,updates}=setup([old],{message:"unavailable"});
    await expect(run(admin,async()=>({...unpaid,transactionStatus:"Completed",trxID:"paid-trx"}))).rejects.toThrow("PAYMENT_ACTIVATION_PENDING");
    expect(updates[0]).toMatchObject({trx_id:"paid-trx"});
  });
  it("fails closed on gateway outages, mismatches, unknown statuses or saved money",async()=>{
    for(const reply of [{...unpaid,amount:"1"},{...unpaid,paymentID:"another"},{...unpaid,statusCode:"error"},{...unpaid,transactionStatus:"Unknown"}]) {
      await expect(run(setup().admin,async()=>reply)).rejects.toThrow("PAYMENT_STATUS_UNAVAILABLE");
    }
    await expect(run(setup().admin,async()=>{throw Error("offline");})).rejects.toThrow("PAYMENT_STATUS_UNAVAILABLE");
    await expect(run(setup([{...old,trx_id:"paid"}]).admin,async()=>unpaid)).rejects.toThrow("PAYMENT_STATUS_UNAVAILABLE");
  });
  it("releases a crashed reservation only after five minutes",async()=>{
    const {admin}=setup([{...old,payment_id:null} as any]);expect((await run(admin,vi.fn())).verifiedUnpaidIds).toEqual([55]);
    const recent=setup([{...old,payment_id:null,created_at:new Date(now-1000).toISOString()} as any]);
    expect((await run(recent.admin,vi.fn())).verifiedUnpaidIds).toEqual([]);
  });
  it("ignores unrelated subjects",async()=>{
    const query=vi.fn();const {admin}=setup([{...old,selected_packages:[{...order,subject_ids:[159]}]}]);
    expect((await run(admin,query)).verifiedUnpaidIds).toEqual([]);expect(query).not.toHaveBeenCalled();
  });
});
