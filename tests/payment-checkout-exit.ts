let handler:(req:Request)=>Promise<Response>;
const serve=Deno.serve;
Object.defineProperty(Deno,"serve",{configurable:true,value:(h:typeof handler)=>{handler=h;return {};}});
for(const [k,v] of Object.entries({SUPABASE_URL:"https://database.test",SUPABASE_ANON_KEY:"anon-test",SUPABASE_SERVICE_ROLE_KEY:"service-test",BKASH_BASE_URL:"https://gateway.test",BKASH_APP_KEY:"app",BKASH_APP_SECRET:"secret",BKASH_USERNAME:"user",BKASH_PASSWORD:"password"}))Deno.env.set(k,v);
await import("../supabase/functions/bkash-execute-payment/index.ts");
Object.defineProperty(Deno,"serve",{value:serve});
const assert=(ok:unknown,msg:string)=>{if(!ok)throw Error(msg);};
function setup(options:{status?:string;foreign?:boolean;badReceipt?:boolean;offline?:boolean;duplicate?:boolean}={}){
 const calls:{url:string;body:any}[]=[];
 globalThis.fetch=async(input,init)=>{
  const url=String(input instanceof Request?input.url:input);
  const body=typeof init?.body==="string"?JSON.parse(init.body):null;calls.push({url,body});
  const reply=(data:unknown,status=200)=>Promise.resolve(new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}}));
  if(url.endsWith("/auth/v1/user"))return reply({id:"buyer",email:"user@example.test"});
  if(url.includes("/rpc/dispatch_payment_telegram_events")||url.includes("/rpc/complete_custom_payment"))return reply(null);
  if(url.includes("/payment_telegram_events"))return reply(options.duplicate?[]:[{id:1}]);
  if(url.includes("/bkash_payments"))return reply({id:1,user_id:options.foreign?"someone-else":"buyer",status:"initiated",payment_id:"p1",amount:999,selected_packages:[{kind:"custom"}]});
  if(url.endsWith("/token/grant"))return reply({id_token:"mock-token"});
  if(url.endsWith("/payment/status"))return options.offline?reply({error:"offline"},503):reply({statusCode:"0000",paymentID:"p1",currency:"BDT",amount:options.badReceipt?"1":"999.00",transactionStatus:options.status||"Initiated",trxID:options.status==="Completed"?"trx1":undefined});
  throw Error("Unexpected request "+url);
 };
 return calls;
}
const request=()=>new Request("https://function.test",{method:"POST",headers:{Authorization:"Bearer user-token"},body:JSON.stringify({paymentID:"p1",verifyOnly:true})});
Deno.test("checkout exit verifies pending status without executing and dispatches one immediate alert",async()=>{
 const calls=setup();const result=await handler(request());assert(result.status===200,"Pending query failed");
 assert(!calls.some(c=>c.url.endsWith("/execute")),"Executed payment during cancellation");
 assert(calls.some(c=>c.url.includes("/payment_telegram_events")&&c.body?.event_type==="payment_incomplete"),"Missing incomplete alert");
 assert(calls.some(c=>c.url.includes("/dispatch_payment_telegram_events")),"Missing immediate dispatch");
});
Deno.test("verified cancellation and failure persist their real gateway outcomes",async()=>{
 for(const status of ["Cancelled","Failed","Expired"]){
  const calls=setup({status});const result=await(await handler(request())).json();
  assert(result.status===(status==="Cancelled"?"cancelled":"failed"),"Wrong saved outcome");
  assert(calls.some(c=>c.url.includes("/bkash_payments")&&c.body?.status===result.status),"Outcome not persisted");
 }
});
Deno.test("foreign payment, mismatched receipt and gateway outage cannot queue alerts",async()=>{
 for(const options of [{foreign:true},{badReceipt:true},{offline:true}]){
  const calls=setup(options);assert((await handler(request())).status>=400,"Invalid query accepted");
  assert(!calls.some(c=>c.url.includes("/payment_telegram_events")),"Invalid alert queued");
  assert(!calls.some(c=>c.body?.status),"Invalid payment mutation");
 }
});
Deno.test("settled payment is activated instead of labelled unpaid",async()=>{
 const calls=setup({status:"Completed"});const result=await(await handler(request())).json();
 assert(result.status==="completed","Settled payment lost");
 assert(calls.some(c=>c.url.includes("/complete_custom_payment")),"No activation");
 assert(!calls.some(c=>c.url.includes("/payment_telegram_events")),"False unpaid alert");
});
Deno.test("duplicate exit callbacks do not repeatedly dispatch",async()=>{
 const calls=setup({duplicate:true});await handler(request());
 assert(!calls.some(c=>c.url.includes("/dispatch_payment_telegram_events")),"Duplicate dispatch");
});
