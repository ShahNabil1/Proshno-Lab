// Run with: npx deno test --allow-env tests/custom-package-payments.ts
// No network or production credentials are used: every request is intercepted.
const handlers: Array<(req: Request) => Promise<Response>> = [];
const originalServe = Deno.serve;
Object.defineProperty(Deno, "serve", { configurable: true, value: (handler: (req: Request) => Promise<Response>) => { handlers.push(handler); return {}; } });
for (const [key,value] of Object.entries({
  SUPABASE_URL:"https://database.test",SUPABASE_ANON_KEY:"test-anon",SUPABASE_SERVICE_ROLE_KEY:"test-service",
  BKASH_BASE_URL:"https://gateway.test/sandbox",BKASH_APP_KEY:"test-app",BKASH_APP_SECRET:"test-secret",BKASH_USERNAME:"test-user",BKASH_PASSWORD:"test-password",
})) Deno.env.set(key,value);
await import("../supabase/functions/bkash-create-payment/index.ts");
await import("../supabase/functions/bkash-execute-payment/index.ts");
await import("../supabase/functions/bkash-query-payment/index.ts");
Object.defineProperty(Deno,"serve",{value:originalServe});
const buyer="11111111-1111-4111-8111-111111111111";
const order={kind:"custom",version:"bangla",class_id:11,class_level:"9-10",group:"Science",subject_ids:[104,105,106],regular_total:1470,price:1099,savings:371,all_price:1499,all_package_id:15,upgrade_difference:400,duration_days:365,owned_subject_ids:[],class_name:"SSC",subject_name:"Physics, Chemistry, Biology"};
const payment={id:1,user_id:buyer,payment_id:"payment-test",amount:999,discount:100,coupon_code:"TEST",status:"initiated",selected_packages:[order]};
const receipt={paymentID:"payment-test",amount:"999.00",currency:"BDT",transactionStatus:"Completed",trxID:"transaction-test"};
type Scenario={ owned?:boolean; overlap?:boolean; amountMismatch?:boolean; activationFails?:boolean; alreadyExecuted?:boolean; completed?:boolean; couponExpired?:boolean; quotedPrice?:number; gatewayFails?:boolean };
function verify(condition:unknown,message:string) { if (!condition) throw new Error(message); }
function setup(scenario:Scenario={}) {
 const calls: Array<{url:string;body:Record<string,unknown>|null}> = [];
 globalThis.fetch = async (input:RequestInfo | URL, init?:RequestInit) => {
   const url=String(input instanceof Request ? input.url : input);
   const body=typeof init?.body==="string" ? JSON.parse(init.body) : null;
   calls.push({url,body});
   const respond=(data:unknown,status=200)=>Promise.resolve(new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}}));
   if(url.endsWith('/auth/v1/user')) return respond({id:buyer,email:'teacher@example.test',app_metadata:{},user_metadata:{}});
   if(url.includes('/rpc/quote_custom_package')) return respond({...order,price:scenario.quotedPrice ?? order.price,owned_subject_ids:scenario.owned ? [104] : []});
   if(url.includes('/rpc/reserve_custom_payment')) return scenario.overlap ? respond({message:'Unfinished payment already includes these subjects',code:'P0001'},400) : respond(1);
   if(url.includes('/rpc/complete_custom_payment')) return scenario.activationFails ? respond({message:'Activation unavailable',code:'P0001'},400) : respond(123);
   if(url.includes('/rpc/has_role')) return respond(true);
   if(url.includes('/coupons')) return respond({code:'TEST',is_active:true,expires_at:scenario.couponExpired?'2000-01-01':null,use_limit:10,used_count:0,min_purchase:0,discount_type:'fixed',discount_value:100,max_discount:null,applicable_packages:null});
   if(url.includes('/bkash_payments')) return init?.method==='PATCH' || init?.method==='POST' ? respond(null) : respond({...payment,status:scenario.completed?'completed':'initiated'});
   if(url.endsWith('/token/grant')) return respond({id_token:'gateway-token',expires_in:3500});
   if(url.endsWith('/checkout/create')) return scenario.gatewayFails ? respond({statusMessage:'Gateway unavailable'},502) : respond({paymentID:'payment-test',bkashURL:'https://gateway.test/checkout'});
   if(url.endsWith('/checkout/execute')) return scenario.alreadyExecuted ? respond({statusMessage:'Already executed'},400) : respond({...receipt,amount:scenario.amountMismatch?'1.00':receipt.amount});
   if(url.endsWith('/payment/status')) return respond(receipt);
   throw new Error('Unmocked network request: '+url);
 };
 return calls;
}
const request=(body:unknown)=>new Request('https://function.test',{method:'POST',headers:{Authorization:'Bearer test-token','Content-Type':'application/json'},body:JSON.stringify(body)});
const customRequest={custom_package:{version:'bangla',class_id:11,group:'Science',subject_ids:[104,105,106],price:1},coupon_code:'TEST',phone:'01700000000',callback_origin:'http://localhost:8080'};

Deno.test('custom checkout ignores client price, applies coupon and reserves before gateway',async()=>{
 const calls=setup();const response=await handlers[0](request(customRequest));verify(response.status===200,'Checkout failed');
 const create=calls.find(c=>c.url.endsWith('/checkout/create'));
 verify(create?.body?.amount==='999.00','Incorrect payable amount');
 const reservation=calls.findIndex(c=>c.url.includes('/rpc/reserve_custom_payment'));
 verify(reservation>=0 && reservation<calls.indexOf(create!), 'Order was not reserved before gateway creation');
});
Deno.test('current backend quote overrides a stale frontend quote',async()=>{
 const calls=setup({quotedPrice:1200});const response=await handlers[0](request(customRequest));verify(response.status===200,'Checkout failed');
 verify(calls.find(c=>c.url.endsWith('/checkout/create'))?.body?.amount==='1100.00','Stale price was used');
});
Deno.test('owned subjects, overlapping tabs and expired coupons cannot reach gateway',async()=>{
 for(const scenario of [{owned:true},{overlap:true},{couponExpired:true}]) {
  const calls=setup(scenario);const response=await handlers[0](request(customRequest));verify(response.status>=400,'Invalid order was accepted');
  verify(!calls.some(c=>c.url.endsWith('/checkout/create')),'Gateway called for invalid order');
 }
});
Deno.test('gateway creation failure preserves a failed reservation for recovery',async()=>{
 const calls=setup({gatewayFails:true});const response=await handlers[0](request(customRequest));verify(response.status===502,'Expected gateway failure');
 verify(calls.some(c=>c.url.includes('/bkash_payments')&&c.body?.status==='failed'),'Reservation was not marked failed');
});
Deno.test('completed custom payment uses transactional activation',async()=>{
 const calls=setup();const response=await handlers[1](request({paymentID:'payment-test'}));verify(response.status===200,'Activation failed');
 verify(calls.some(c=>c.url.includes('/rpc/complete_custom_payment')),'Transactional activation was skipped');
 verify(!calls.some(c=>c.url.includes('/subscriptions')||c.url.includes('/user_permissions')),'Nontransactional access writes occurred');
});
Deno.test('amount mismatch cannot activate access',async()=>{
 const calls=setup({amountMismatch:true});const response=await handlers[1](request({paymentID:'payment-test'}));verify(response.status===400,'Mismatch accepted');
 verify(!calls.some(c=>c.url.includes('/rpc/complete_custom_payment')),'Mismatched payment activated');
});
Deno.test('settled payment with failed activation stays recoverable without a second charge',async()=>{
 const calls=setup({activationFails:true});const response=await handlers[1](request({paymentID:'payment-test'}));verify(response.status===503,'Expected pending activation');
 verify(calls.some(c=>c.url.includes('/bkash_payments')&&c.body?.trx_id===receipt.trxID&&c.body?.status===undefined),'Verified receipt was not preserved');
});
Deno.test('refresh after execute queries bKash and activates the original payment',async()=>{
 const calls=setup({alreadyExecuted:true});const response=await handlers[1](request({paymentID:'payment-test'}));verify(response.status===200,'Refresh recovery failed');
 verify(calls.some(c=>c.url.endsWith('/payment/status')),'Status reconciliation was skipped');
});
Deno.test('duplicate completed callback does not activate twice',async()=>{
 const calls=setup({completed:true});const response=await handlers[1](request({paymentID:'payment-test'}));verify(response.status===200,'Completed retry failed');
 verify(!calls.some(c=>c.url.includes('/rpc/complete_custom_payment')||c.url.endsWith('/checkout/execute')),'Duplicate processing occurred');
});
Deno.test('admin query reconciles custom access before reporting completion',async()=>{
 const calls=setup();const response=await handlers[2](request({paymentID:'payment-test'}));verify(response.status===200,'Admin recovery failed');
 verify(calls.some(c=>c.url.includes('/rpc/complete_custom_payment')),'Query marked completed without granting access');
});
