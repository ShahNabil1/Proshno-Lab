import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { deliverPaymentTelegram, paymentTelegramPayload, verifiedPaymentReceipt } from "../_shared/paymentTelegram.ts";
import { activateFixedPayment } from "../_shared/fixedPayment.ts";
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
Deno.serve(async req=>{
  if(req.method!=="POST") return json({error:"Method not allowed"},405);
  const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,key);
  let authorized=req.headers.get("authorization")===`Bearer ${key}`;
  if(!authorized && req.headers.get("x-capi-worker-token")) {
    const {data,error}=await admin.rpc("authorize_meta_capi_worker",{token:req.headers.get("x-capi-worker-token")});
    authorized=!error && data===true;
  }
  if(!authorized) return json({error:"Unauthorized"},401);
  const chats=[...new Set((Deno.env.get("TELEGRAM_ADMIN_CHAT_ID")||"").split(",").map(x=>x.trim()).filter(Boolean))];
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")?.trim();
  if(!chats.length||!botToken) return json({error:"Telegram not configured"},503);
  const {data:events,error}=await admin.rpc("claim_payment_telegram_events");
  if(error) return json({error:"Notification queue unavailable"},503);
  let sent=0,retry=0,skipped=0,token:string|undefined;
  async function queryGateway(paymentID:string) {
    const base=Deno.env.get("BKASH_BASE_URL")!;
    if(!token){
      const response=await fetch(`${base}/tokenized/checkout/token/grant`,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json",username:Deno.env.get("BKASH_USERNAME")!,password:Deno.env.get("BKASH_PASSWORD")!},body:JSON.stringify({app_key:Deno.env.get("BKASH_APP_KEY"),app_secret:Deno.env.get("BKASH_APP_SECRET")}),signal:AbortSignal.timeout(10_000)});
      const data=await response.json();if(!response.ok||!data.id_token) throw Error("Gateway unavailable");token=data.id_token;
    }
    const response=await fetch(`${base}/tokenized/checkout/payment/status`,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json",Authorization:token!,"X-App-Key":Deno.env.get("BKASH_APP_KEY")!},body:JSON.stringify({paymentID}),signal:AbortSignal.timeout(10_000)});
    if(!response.ok) throw Error("Gateway unavailable");return response.json();
  }
  for(const event of events||[]){
    let messageEvent=event.event_type;
    const finish=async(outcome:string)=>{
      const {error}=await admin.rpc("finish_payment_telegram_event",{event_ref:event.id,lease:event.lease_token,outcome});
      if(error) throw Error("Queue update unavailable");
    };
    try{
      const {data:p,error}=await admin.from("bkash_payments").select("*").eq("id",event.payment_id).single();
      if(error||!p) throw Error("Payment missing");
      if(event.event_type!=="payment_success"){
        if(p.status==="completed"){await finish("skipped");skipped++;continue;}
        if(!p.payment_id) {await finish("skipped");skipped++;continue;}
        const receipt=await queryGateway(p.payment_id);
        if(!verifiedPaymentReceipt(p,receipt)) throw Error("Payment status unverified");
        if(receipt.transactionStatus==="Completed" && receipt.trxID){
          if(p.selected_packages?.some((x:any)=>x.kind==="custom")){
            const {error}=await admin.rpc("complete_custom_payment",{payment_ref:p.id,receipt});if(error) throw Error("Activation pending");
          }else if(p.selected_packages?.some((x:any)=>x.kind==="payg")){
            const {error}=await admin.from("bkash_payments").update({status:"completed",trx_id:receipt.trxID,bkash_response:receipt}).eq("id",p.id);if(error)throw error;
          }else{const result=await activateFixedPayment(admin,p,receipt);if(!result.ok)throw Error("Activation pending");}
          await finish("skipped");skipped++;continue;
        }
        if(!["Initiated","Cancelled","Failed","Expired"].includes(receipt.transactionStatus))throw Error("Payment status unknown");
        // The latest gateway state wins over an older queued event.
        messageEvent=receipt.transactionStatus==="Cancelled"?"payment_cancelled":
          ["Failed","Expired"].includes(receipt.transactionStatus)?"payment_failed":"payment_incomplete";
        // A newer checkout supersedes an abandoned one; don't send one alert per retry.
        if(event.event_type==="payment_incomplete"){
          const {data:newer,error}=await admin.from("bkash_payments").select("id").eq("user_id",p.user_id).gt("id",p.id).limit(1);
          if(error)throw error;if(newer?.length){await finish("skipped");skipped++;continue;}
        }
      }else if(p.status!=="completed"||!p.trx_id||!verifiedPaymentReceipt(p,p.bkash_response)||p.bkash_response?.transactionStatus!=="Completed"){
        throw Error("Success receipt unverified");
      }
      const text=paymentTelegramPayload(p,messageEvent);
      for(const chat of chats){
        if(event.delivered_chat_ids?.includes(chat))continue;
        if(!await deliverPaymentTelegram(text,chat,botToken))throw Error("Telegram delivery failed");
        const {error}=await admin.rpc("record_payment_telegram_chat",{event_ref:event.id,lease:event.lease_token,chat});
        if(error)throw Error("Delivery receipt save failed");
      }
      await finish("sent");sent++;
    }catch{
      retry++;try{await finish("retry");}catch{ /* Lease expiry recovers interrupted workers. */ }
      console.error("payment_telegram_delivery_retry",event.id);
    }
  }
  return json({checked:events?.length||0,sent,retry,skipped});
});
