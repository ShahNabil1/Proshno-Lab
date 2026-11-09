import {describe,it,expect,vi} from "vitest";
import {deliverPaymentTelegram,paymentTelegramPayload,verifiedPaymentReceipt} from "../../supabase/functions/_shared/paymentTelegram";
const payment={id:1,payment_id:"p1",amount:999,teacher_name:"<script>name</script>",created_at:"2026-10-20T10:00:00Z",selected_packages:[{class_name:"Class 7",subject_name:"Math"}],trx_id:"trx"};
describe("payment Telegram delivery",()=>{
 it("formats escaped notifications for every payment outcome",()=>{
  for(const event of ["payment_success","payment_failed","payment_cancelled","payment_incomplete"]){
   const text=paymentTelegramPayload(payment,event);expect(text).toContain("&lt;script&gt;");expect(text).not.toContain("<script>");expect(text).toContain("৳999");
  }
 });
 it("does not call a failure or an unknown receipt a verified payment",()=>{
  const receipt={statusCode:"0000",paymentID:"p1",currency:"BDT",amount:"999.00"};
  expect(verifiedPaymentReceipt(payment,receipt)).toBe(true);
  expect(verifiedPaymentReceipt(payment,{...receipt,amount:1})).toBe(false);
  expect(verifiedPaymentReceipt(payment,{...receipt,statusCode:"error"})).toBe(false);
 });
 it("requires Telegram and HTTP success before acknowledging delivery",async()=>{
  vi.stubGlobal("AbortSignal",{timeout:()=>new AbortController().signal});
  try {
  const botToken="123:test-token";
  for(const [status,body,expected] of [[200,{ok:true},true],[200,{ok:false},false],[200,{},false],[502,{ok:true},false]] as const){
   const fetcher=vi.fn(async()=>new Response(JSON.stringify(body),{status}));
   expect(await deliverPaymentTelegram("test","chat",botToken,fetcher as typeof fetch)).toBe(expected);
   expect(fetcher).toHaveBeenCalledWith("https://api.telegram.org/bot123:test-token/sendMessage",expect.objectContaining({method:"POST"}));
  }
  } finally { vi.unstubAllGlobals(); }
 });
});
