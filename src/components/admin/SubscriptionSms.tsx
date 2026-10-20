import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
type History={id:string;status:string;provider_code:string|null;created_at:string;phones:string[];message:string};
type Recipient={name:string;email:string;phone:string};
const labels:Record<string,string>={sending:"ফলাফল অপেক্ষমান — gateway report দেখুন",submitted:"Gateway গ্রহণ করেছে",rejected:"Gateway প্রত্যাখ্যান করেছে",unknown:"অনিশ্চিত — gateway report দেখুন"};
export default function SubscriptionSms({recipients}:{recipients:Recipient[]}) {
  const [provider,setProvider]=useState("bulksmsdhaka");
  const [sender,setSender]=useState("1234");
  const [key,setKey]=useState("");
  const [hasKey,setHasKey]=useState(false);
  const [enabled,setEnabled]=useState(false);
  const [history,setHistory]=useState<History[]>([]);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [ready,setReady]=useState(false);
  const [review,setReview]=useState<{id:string;message:string;recipients:Recipient[]}|null>(null);
  const [error,setError]=useState("");
  async function call(body:Record<string,unknown>) {
    const {data,error}=await supabase.functions.invoke("admin-subscription-sms",{body});
    let detail="";
    if(error && "context" in error && error.context instanceof Response) {
      try {const response=await error.context.json();detail=response.error || response.message || "";} catch { /* no JSON body */ }
    }
    if(error || data?.error) throw new Error(data?.error || detail || "SMS সেটিংস লোড হয়নি। শুধু ব্যবসার মালিক এটি ব্যবহার করতে পারবেন।");
    return data;
  }
  async function load() {
    try {const data=await call({action:"settings"});setProvider(data.provider);setSender(data.sender_id);setEnabled(data.enabled);setHasKey(data.has_key);setHistory(data.history || []);setReady(true);setError("");}
    catch(e){setError((e as Error).message);}
  }
  useEffect(()=>{void load();},[]);
  async function save() {
    setBusy(true);
    try {await call({action:"save",provider,sender_id:sender,api_key:key,enabled});setKey("");await load();toast.success("SMS gateway সেভ হয়েছে");}
    catch(e){toast.error((e as Error).message);} finally{setBusy(false);}
  }
  async function send() {
    if(!review)return;
    setBusy(true);
    try {
      const result=await call({action:"send",request_id:review.id,message:review.message,phones:review.recipients.map(r=>r.phone)});
      if(result.status==="submitted") toast.success("Gateway SMS গ্রহণ করেছে। Delivery gateway report-এ দেখুন।");
      else toast.info(labels[result.status] || "Gateway report দেখুন।");
      setReview(null);await load();
    } catch(e){toast.error((e as Error).message);/* Keep the request ID when a response is lost. */}
    finally {setBusy(false);}
  }
  const unique=[...new Map(recipients.map(r=>[r.phone,r])).values()];
  return <section id="subscription-sms" className="scroll-mt-6 space-y-4 rounded-xl border bg-card p-4">
    <h2 className="font-heading text-lg font-bold">SMS মার্কেটিং ও মেয়াদের রিমাইন্ডার</h2>
    <p className="text-sm text-muted-foreground">ইউজার তালিকা থেকে প্রাপক নির্বাচন করুন। একই নম্বর একবার নেওয়া হবে। একবারে সর্বোচ্চ ২০ জন।</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <details><summary className="cursor-pointer font-medium">SMS gateway সেটিংস {hasKey?"— সংযুক্ত":"— সেটআপ করুন"}</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="text-sm">Gateway<select aria-label="SMS gateway" value={provider} onChange={e=>setProvider(e.target.value)} className="mt-1 h-10 w-full rounded border bg-background px-3"><option value="bulksmsdhaka">Bulk SMS Dhaka</option><option value="bulksmsbd">BulkSMSBD</option></select></label>
      <label className="text-sm">Sender / Caller ID<Input aria-label="SMS Sender ID" value={sender} onChange={e=>setSender(e.target.value)} /></label>
      <label className="text-sm sm:col-span-2">API key<Input aria-label="SMS API key" type="password" autoComplete="new-password" value={key} placeholder={hasKey?"সেভ আছে; পরিবর্তন না করলে খালি রাখুন":"Gateway থেকে API key দিন"} onChange={e=>setKey(e.target.value)} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)} />SMS পাঠানো চালু করুন</label>
      <Button disabled={busy || !ready} onClick={save}>Gateway সেভ করুন</Button>
    </div></details>
    <label className="block text-sm">SMS বার্তা<textarea aria-label="SMS বার্তা" className="mt-1 min-h-28 w-full rounded-md border bg-background p-3" maxLength={1000} value={message} onChange={e=>setMessage(e.target.value)} placeholder="প্রিয় শিক্ষক, আপনার প্যাকেজের মেয়াদ শিগগির শেষ হচ্ছে। নবায়ন করতে proshnolab.com/pricing দেখুন।" /></label>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm">{unique.length}টি স্বতন্ত্র নম্বর · {message.length} অক্ষর · বড় বার্তায় একাধিক SMS-এর চার্জ হতে পারে</p><Button disabled={busy || !ready || !enabled || !hasKey || !message.trim() || !unique.length || unique.length>20} onClick={()=>setReview({id:crypto.randomUUID(),message:message.trim(),recipients:unique})}>প্রাপক ও বার্তা যাচাই করুন</Button></div>
    <details><summary className="cursor-pointer text-sm font-medium">সাম্প্রতিক SMS ইতিহাস</summary><Button size="sm" variant="ghost" onClick={load}>রিফ্রেশ</Button><div className="space-y-2">{!history.length?<p className="text-sm text-muted-foreground">এখনো SMS পাঠানো হয়নি।</p>:history.map(h=><div key={h.id} className="rounded border p-3 text-sm"><p>{new Date(h.created_at).toLocaleString("bn-BD",{timeZone:"Asia/Dhaka"})} · {h.phones.length} নম্বর · {labels[h.status]}</p><p className="whitespace-pre-wrap">{h.message}</p><p className="text-xs text-muted-foreground">{h.provider_code}</p></div>)}</div></details>
    <Dialog open={!!review} onOpenChange={open=>{if(!open && !busy)setReview(null);}}><DialogContent className="max-h-[85vh] overflow-auto"><DialogHeader><DialogTitle>SMS পাঠানোর আগে যাচাই</DialogTitle></DialogHeader><p className="whitespace-pre-wrap rounded bg-muted p-3">{review?.message}</p><p className="text-sm">{review?.recipients.length}টি নম্বরে gateway-এর SMS চার্জ প্রযোজ্য হবে।</p><ul className="max-h-48 overflow-auto text-sm">{review?.recipients.map(r=><li key={r.phone} className="border-b py-2">{r.name} · {r.email}<br />{r.phone}</li>)}</ul><Button disabled={busy} onClick={send}>{busy?"পাঠানো হচ্ছে…":"নিশ্চিত করে SMS পাঠান"}</Button></DialogContent></Dialog>
  </section>;
}
