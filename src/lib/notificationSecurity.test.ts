import { describe, it, expect, vi } from "vitest";
import { createNotificationHandler, authorizeNotificationScheduler } from "../../supabase/functions/_shared/notificationHandler";
function setup() {
 const deps = {
  serviceKey: "private-service",
  getUser: vi.fn(async (token: string) => token === "user-token" ? { id: "owner" } : null),
  claim: vi.fn(async () => ({ id: 1, payload: { event_type: "new_registration", title: "Saved registration", fields: [{label:"Teacher",value:"<saved>"}] } })),
  deliver: vi.fn(async () => {}),
 };
 const handler = createNotificationHandler(deps);
 const send = (body: unknown, token?: string, method = "POST") => handler(new Request("https://example.test", {
  method, headers: token ? { Authorization: "Bearer " + token } : {},
  ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
 }));
 return { deps, send };
}
describe("Telegram notification authorization", () => {
 it("protects the daily-summary route against public keys and invalid scheduler tokens", async () => {
  const verify=vi.fn(async(token:string)=>token==="private-worker");
  for(const token of ["public-anon","user-token",""]) {
   expect(await authorizeNotificationScheduler(new Request("https://example.test",{headers:{authorization:"Bearer "+token}}),"private-service",verify)).toBe(false);
  }
  for(const [token,expected] of [["fake",false],["private-worker",true]] as const) {
   expect(await authorizeNotificationScheduler(new Request("https://example.test",{headers:{"x-capi-worker-token":token}}),"private-service",verify)).toBe(expected);
  }
  expect(await authorizeNotificationScheduler(new Request("https://example.test",{headers:{authorization:"Bearer private-service"}}),"private-service",verify)).toBe(true);
 });
 it("rejects anonymous, anon-key and invalid-token requests before claiming or sending", async () => {
  const {deps,send}=setup();
  for (const token of [undefined,"public-anon-key","forged-token"]) expect((await send({event_type:"bkash_payment",title:"Paid"},token)).status).toBe(401);
  expect(deps.claim).not.toHaveBeenCalled(); expect(deps.deliver).not.toHaveBeenCalled();
 });
 it("rejects forged payment, test, spam and raw HTML even from signed-in users", async () => {
  const {deps,send}=setup();
  for (const event_type of ["bkash_payment","payment_success","spam_test","test","daily_summary"])
   expect((await send({event_type,title:"Paid"},"user-token")).status).toBe(403);
  expect((await send({event_type:"new_registration",raw_text:"Paid"},"user-token")).status).toBe(403);
  expect(deps.deliver).not.toHaveBeenCalled();
 });
 it("loads the signed-in owner's record and ignores forged titles, fields and links", async () => {
  const {deps,send}=setup();
  expect((await send({event_type:"new_registration",record_id:12,title:"Payment successful",fields:[{label:"Amount",value:500}],link:{url:"https://evil.test"}},"user-token")).status).toBe(200);
  expect(deps.claim).toHaveBeenCalledWith("owner","new_registration",12);
  const text=(deps.deliver.mock.calls as unknown as string[][])[0][0];
  expect(text).toContain("Saved registration"); expect(text).toContain("&lt;saved&gt;");
  expect(text).not.toContain("Payment successful"); expect(text).not.toContain("evil.test");
 });
 it("does not deliver missing, duplicate or rate-limited records", async () => {
  for (const [claim,status] of [[null,404],[{duplicate:true},200],[{rate_limited:true},429]] as const) {
   const {deps,send}=setup(); deps.claim.mockResolvedValueOnce(claim as any);
   expect((await send({event_type:"new_feedback"},"user-token")).status).toBe(status);
   expect(deps.deliver).not.toHaveBeenCalled();
  }
 });
 it("allows only private server credentials to deliver a summary", async () => {
  const {deps,send}=setup();
  expect((await send({event_type:"daily_summary",raw_text:"Summary"},"private-service")).status).toBe(200);
  expect(deps.deliver).toHaveBeenCalledWith("Summary",null);
  expect((await send({event_type:"payment_success",raw_text:"Paid"},"private-service")).status).toBe(403);
 });
 it("rejects invalid methods, record IDs and oversized bodies", async () => {
  const {deps,send}=setup();
  expect((await send({},"user-token","GET")).status).toBe(405);
  expect((await send({},"user-token","OPTIONS")).status).toBe(200);
  expect((await send({event_type:"new_feedback",record_id:-1},"user-token")).status).toBe(400);
  expect((await send({event_type:"new_feedback",title:"x".repeat(16001)},"user-token")).status).toBe(413);
  expect(deps.deliver).not.toHaveBeenCalled();
 });
 it("fails closed on auth and database failures", async () => {
  const {deps,send}=setup(); deps.claim.mockRejectedValueOnce(Error("DB unavailable"));
  expect((await send({event_type:"new_registration"},"user-token")).status).toBe(503);
  expect(deps.deliver).not.toHaveBeenCalled();
 });
});
