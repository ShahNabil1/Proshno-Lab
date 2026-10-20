import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json = (data: unknown, status=200) => new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}});
function phone(raw: unknown) {
  let n=String(raw || "").replace(/[\s()+-]/g,"");
  if (/^01[3-9]\d{8}$/.test(n)) n=`88${n}`;
  return /^8801[3-9]\d{8}$/.test(n)?n:null;
}
Deno.serve(async req => {
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return json({error:"Method not allowed"},405);
  try {
    const authorization=req.headers.get("Authorization") || "";
    const userClient=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:authorization}}});
    const {data:auth,error:authError}=await userClient.auth.getUser();
    if(authError || !auth.user) return json({error:"Unauthorized"},401);
    const {data:owner,error:ownerError}=await userClient.rpc("is_business_owner");
    if(ownerError || !owner) return json({error:"Only the business owner can manage SMS"},403);
    const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body=await req.json();
    const {data:config,error:configError}=await db.from("admin_sms_gateway").select("*").eq("id",true).maybeSingle();
    if(configError) throw new Error("Gateway settings unavailable");
    if(body.action==="settings") {
      const {data:history,error}=await db.from("admin_sms_campaigns").select("id,status,provider_code,created_at,phones,message").order("created_at",{ascending:false}).limit(10);
      if(error) throw new Error("SMS history unavailable");
      return json({provider:config?.provider || "bulksmsdhaka",sender_id:config?.sender_id || "1234",enabled:config?.enabled || false,has_key:!!config?.api_key,history});
    }
    if(body.action==="save") {
      if(!["bulksmsdhaka","bulksmsbd"].includes(body.provider)) return json({error:"Unsupported gateway"},400);
      const key=typeof body.api_key==="string" && body.api_key.trim()?body.api_key.trim():config?.api_key || "";
      const sender=String(body.sender_id || "").trim();
      if(!sender || sender.length>50 || key.length>500 || (body.enabled && !key)) return json({error:"Valid sender ID and API key required"},400);
      if(config && config.provider!==body.provider && !body.api_key?.trim()) return json({error:"New gateway needs its own API key"},400);
      const {error}=await db.from("admin_sms_gateway").upsert({id:true,provider:body.provider,sender_id:sender,api_key:key,enabled:!!body.enabled,updated_at:new Date().toISOString()});
      if(error) throw new Error("Could not save gateway");
      return json({ok:true});
    }
    if(body.action!=="send") return json({error:"Unknown action"},400);
    if(!config?.enabled || !config.api_key || !config.sender_id) return json({error:"Enable and configure SMS gateway first"},400);
    if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(body.request_id || "")) return json({error:"Request ID required"},400);
    const message=typeof body.message==="string"?body.message.trim():"";
    if(!message || message.length>1000 || !Array.isArray(body.phones) || body.phones.length>20) return json({error:"Use 1–20 recipients and 1–1000 characters"},400);
    const phones=[...new Set(body.phones.map(phone))];
    if(!phones.length || phones.includes(null)) return json({error:"Invalid recipient number"},400);
    // Reserve before any paid network request. The same request can never submit twice.
    const {error:reserveError}=await db.from("admin_sms_campaigns").insert({id:body.request_id,created_by:auth.user.id,message,phones});
    if(reserveError) {
      if(reserveError.code!=="23505") throw new Error("Could not record SMS campaign");
      const {data:existing}=await db.from("admin_sms_campaigns").select("status,provider_code").eq("id",body.request_id).single();
      return json({ok:true,duplicate:true,...existing});
    }
    const results: {status:string;code:string}[]=[];
    // Small batches bound provider concurrency and runtime. Do not retry uncertain sends.
    for(let offset=0;offset<phones.length;offset+=5) {
      results.push(...await Promise.all(phones.slice(offset,offset+5).map(async n=>{
        try {
          const dhaka=config.provider==="bulksmsdhaka";
          const form=new URLSearchParams(dhaka?{apikey:config.api_key,callerID:config.sender_id,number:String(n).slice(2),message}:{api_key:config.api_key,senderid:config.sender_id,number:String(n),message});
          const response=await fetch(dhaka?"https://bulksmsdhaka.net/api/sendtext":"https://bulksmsbd.net/api/smsapi",{method:"POST",body:form,redirect:"error",signal:AbortSignal.timeout(8000)});
          const data=await response.json();
          const code=String(data.response_code ?? data.status_code ?? data.status ?? data.code ?? "");
          const accepted=dhaka?["1000","1001","1002"].includes(code):code==="202";
          const knownError=dhaka?/^(100[35689]|101[0-8]|2001)$/.test(code):/^10\d\d$/.test(code);
          return {status:response.ok&&accepted?"submitted":knownError?"rejected":"unknown",code:/^\d{3,4}$/.test(code)?code:"unknown"};
        } catch { return {status:"unknown",code:"unknown"}; }
      })));
    }
    const submitted=results.filter(r=>r.status==="submitted").length;
    const status=results.every(r=>r.status==="submitted")?"submitted":results.every(r=>r.status==="rejected")?"rejected":"unknown";
    const provider_code=`submitted:${submitted}; rejected:${results.filter(r=>r.status==="rejected").length}; unknown:${results.filter(r=>r.status==="unknown").length}; codes:${results.map(r=>r.code).join(",")}`;
    const {error:finishError}=await db.from("admin_sms_campaigns").update({status,provider_code}).eq("id",body.request_id);
    if(finishError) return json({ok:false,status:"unknown",error:"Result could not be saved. Check provider report; do not resend."});
    return json({ok:true,status,provider_code,submitted,total:phones.length});
  } catch {return json({error:"SMS operation failed. Check settings or history."},500);}
});
