// No real gateway or Telegram calls: all traffic is intercepted.
let handler:(req:Request)=>Promise<Response>;
const serve=Deno.serve;
Object.defineProperty(Deno,"serve",{configurable:true,value:(h:typeof handler)=>{handler=h;return {};}});
for(const [k,v] of Object.entries({SUPABASE_URL:"https://database.test",SUPABASE_SERVICE_ROLE_KEY:"service-test",TELEGRAM_ADMIN_CHAT_ID:"chat-a,chat-b",LOVABLE_API_KEY:"mock-lovable",TELEGRAM_API_KEY:"mock-telegram",BKASH_BASE_URL:"https://gateway.test",BKASH_APP_KEY:"app",BKASH_APP_SECRET:"secret",BKASH_USERNAME:"user",BKASH_PASSWORD:"password"}))Deno.env.set(k,v);
await import("../supabase/functions/payment-telegram-worker/index.ts");
Object.defineProperty(Deno,"serve",{value:serve});
const assert=(ok:unknown,msg:string)=>{if(!ok)throw Error(msg);};
function setup(options:{event?:string;delivered?:string[];failChat?:string;gatewayStatus?:string;gatewayFails?:boolean;newer?:boolean}={}){
 const calls:{url:string;body:any}[]=[];
 const receipt={statusCode:"0000",paymentID:"p1",currency:"BDT",amount:"999.00",transactionStatus:options.gatewayStatus||"Completed",trxID:"trx1"};
 const event=options.event||"payment_success";
 globalThis.fetch=async(input,init)=>{
  const url=String(input instanceof Request?input.url:input);const body=typeof init?.body==="string"?JSON.parse(init.body):null;calls.push({url,body});
  const reply=(data:unknown,status=200)=>Promise.resolve(new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}}));
  if(url.includes("/rpc/claim_payment_telegram_events"))return reply([{id:1,payment_id:1,event_type:event,lease_token:"lease",delivered_chat_ids:options.delivered||[]}]);
  if(url.includes("/rpc/finish_payment_telegram_event")||url.includes("/rpc/record_payment_telegram_chat")||url.includes("/rpc/complete_custom_payment"))return reply(null);
  if(url.includes("/bkash_payments")&&url.includes("user_id=eq."))return reply(options.newer?[{id:2}]:[]);
  if(url.includes("/bkash_payments"))return reply({id:1,user_id:"buyer",status:event==="payment_success"?"completed":"initiated",payment_id:"p1",trx_id:event==="payment_success"?"trx1":null,amount:999,created_at:"2026-10-20T10:00:00Z",teacher_name:"Teacher",selected_packages:[{kind:"custom",subject_ids:[1]}],bkash_response:receipt});
  if(url.endsWith("/token/grant"))return reply({id_token:"mock-token"});
  if(url.endsWith("/payment/status"))return options.gatewayFails?reply({error:"offline"},503):reply(receipt);
  if(url.includes("/telegram/sendMessage"))return reply({ok:body.chat_id!==options.failChat});
  throw Error("Unmocked URL "+url);
 };
 return calls;
}
const request=(auth=true)=>new Request("https://worker.test",{method:"POST",headers:auth?{Authorization:"Bearer service-test"}:{},body:"{}"});
Deno.test("worker rejects unauthenticated requests without sending",async()=>{const calls=setup();assert((await handler(request(false))).status===401,"Expected 401");assert(calls.length===0,"Unauthorized traffic");});
Deno.test("worker delivers a verified success and persists per-recipient receipts",async()=>{const calls=setup();const result=await(await handler(request())).json();assert(result.sent===1,"Success not delivered");assert(calls.filter(c=>c.url.includes("/telegram/sendMessage")).length===2,"Missing destinations");assert(calls.filter(c=>c.url.includes("/record_payment_telegram_chat")).length===2,"Missing delivery receipts");});
Deno.test("retry skips a destination that already received the message",async()=>{const calls=setup({delivered:["chat-a"]});await handler(request());assert(calls.filter(c=>c.url.includes("/telegram/sendMessage")).length===1,"Resent delivered destination");});
Deno.test("Telegram ok:false is queued for retry rather than marked sent",async()=>{const calls=setup({failChat:"chat-b"});const result=await(await handler(request())).json();assert(result.retry===1,"Failed send not retried");assert(calls.some(c=>c.body?.outcome==="retry"),"No retry state");assert(!calls.some(c=>c.body?.outcome==="sent"),"False successful delivery");});
Deno.test("incomplete checkout is verified with bKash before an alert",async()=>{const calls=setup({event:"payment_incomplete",gatewayStatus:"Initiated"});const result=await(await handler(request())).json();assert(result.sent===1,"Incomplete alert not delivered");assert(calls.findIndex(c=>c.url.endsWith("/payment/status"))<calls.findIndex(c=>c.url.includes("/telegram/sendMessage")),"Unverified alert");});
Deno.test("settled money is reconciled and never called an abandoned checkout",async()=>{const calls=setup({event:"payment_incomplete",gatewayStatus:"Completed"});const result=await(await handler(request())).json();assert(result.skipped===1,"Did not suppress incomplete alert");assert(calls.some(c=>c.url.includes("/complete_custom_payment")),"No activation");assert(!calls.some(c=>c.url.includes("/telegram/sendMessage")),"False unpaid message");});
Deno.test("gateway outage or superseded checkout produces no false unpaid alert",async()=>{for(const options of [{gatewayFails:true},{newer:true}]){const calls=setup({event:"payment_incomplete",gatewayStatus:"Initiated",...options});await handler(request());assert(!calls.some(c=>c.url.includes("/telegram/sendMessage")),"False alert");}});
Deno.test("incomplete event uses the latest cancelled or failed gateway state",async()=>{
 for(const gatewayStatus of ["Cancelled","Failed","Expired"]){
  const calls=setup({event:"payment_incomplete",gatewayStatus});
  await handler(request());
  const message=calls.find(c=>c.url.includes("/telegram/sendMessage"))?.body.text||"";
  assert(message.includes(gatewayStatus==="Cancelled"?"বাতিল":"ব্যর্থ"),"Wrong outcome label");
 }
});
Deno.test("stale failure events cannot describe an initiated checkout as failed",async()=>{
 const calls=setup({event:"payment_failed",gatewayStatus:"Initiated"});
 await handler(request());
 const message=calls.find(c=>c.url.includes("/telegram/sendMessage"))?.body.text||"";
 assert(message.includes("সম্পন্ন হয়নি"),"Missing incomplete status");
 assert(!message.includes("পেমেন্ট ব্যর্থ"),"False failed payment");
});
