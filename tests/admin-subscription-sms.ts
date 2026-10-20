// All database, auth and gateway calls are intercepted. No SMS is sent.
let handler:(req:Request)=>Promise<Response>;
const serve=Deno.serve;
Object.defineProperty(Deno,"serve",{configurable:true,value:(h:typeof handler)=>{handler=h;return {};}});
for(const [k,v] of Object.entries({SUPABASE_URL:"https://db.test",SUPABASE_ANON_KEY:"anon-test",SUPABASE_SERVICE_ROLE_KEY:"service-test"}))Deno.env.set(k,v);
await import("../supabase/functions/admin-subscription-sms/index.ts");
Object.defineProperty(Deno,"serve",{value:serve});
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m);};
function setup(options:{owner?:boolean;duplicate?:boolean;code?:number;http?:number;timeout?:boolean;provider?:string}={}) {
 const calls:{url:string;body:any;method:string}[]=[];
 globalThis.fetch=async(input,init)=>{
  const req=input instanceof Request?input:null;
  const url=String(req?req.url:input);
  const method=init?.method || req?.method || "GET";
  const raw=init?.body?.toString() || (req?await req.clone().text():"");
  let body:any;try{body=JSON.parse(raw);}catch{body=Object.fromEntries(new URLSearchParams(raw));}
  calls.push({url,body,method});
  const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});
  if(url.includes("/auth/v1/user"))return reply({id:"owner",email:"owner@test.com"});
  if(url.includes("/rpc/is_business_owner"))return reply(options.owner!==false);
  if(url.includes("/admin_sms_gateway"))return reply({id:true,provider:options.provider || "bulksmsdhaka",api_key:"mock-secret",sender_id:"1234",enabled:true});
  if(url.includes("/admin_sms_campaigns")) {
   if(method==="POST" && options.duplicate)return reply({code:"23505",message:"duplicate"},409);
   if(method==="GET")return reply({status:"submitted",provider_code:"1000"});
   return reply(null);
  }
  if(url.includes("/api/sendtext") || url.includes("/api/smsapi")) {
   if(options.timeout)throw new Error("timeout");
   return reply({status:options.code ?? 1000},options.http || 200);
  }
  throw Error("Unexpected URL "+url);
 };
 return calls;
}
const request=(body:Record<string,unknown>)=>new Request("https://function.test",{method:"POST",headers:{Authorization:"Bearer valid-user","Content-Type":"application/json"},body:JSON.stringify(body)});
const send={action:"send",request_id:"c8b43ae8-c9f3-44a9-8e7d-4c62a1f9af8c",message:"মেয়াদ নবায়ন করুন",phones:["01712345678"]};
Deno.test("non-owner cannot read credentials or send",async()=>{const calls=setup({owner:false});assert((await handler(request(send))).status===403,"Must deny non-owner");assert(!calls.some(c=>c.url.includes("admin_sms_gateway")||c.url.includes("/api/sendtext")),"Unauthorized access");});
Deno.test("settings expose only a configured flag, never the API key",async()=>{setup();const body=await(await handler(request({action:"settings"}))).text();assert(!body.includes("mock-secret"),"Secret leaked");assert(body.includes('"has_key":true'),"Missing configured flag");});
Deno.test("duplicate local and international numbers submit once with POST",async()=>{const calls=setup();const result=await(await handler(request({...send,phones:["01712345678","+8801712345678"]}))).json();const sends=calls.filter(c=>c.url.includes("/api/sendtext"));assert(sends.length===1,"Duplicate recipient");assert(result.status==="submitted","Not submitted");assert(sends[0].method==="POST" && sends[0].body.apikey==="mock-secret" && !sends[0].url.includes("mock-secret"),"Unsafe gateway request");});
Deno.test("repeating the campaign ID never sends twice",async()=>{const calls=setup({duplicate:true});const result=await(await handler(request(send))).json();assert(result.duplicate,"Missing duplicate flag");assert(!calls.some(c=>c.url.includes("/api/sendtext")),"Resubmitted SMS");});
Deno.test("gateway rejection and timeout never claim successful delivery",async()=>{for(const opts of [{code:2001},{timeout:true},{code:1000,http:503}]){setup(opts);const result=await(await handler(request(send))).json();assert(result.status!=="submitted","False success");}});
Deno.test("invalid phones and oversized campaigns never reach gateway",async()=>{for(const phones of [["invoice"],Array(21).fill("01712345678")]){const calls=setup();assert((await handler(request({...send,phones}))).status===400,"Bad recipients accepted");assert(!calls.some(c=>c.url.includes("/api/sendtext")),"Invalid paid request");}});
