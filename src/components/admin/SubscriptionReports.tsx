import { useState } from "react";
import { reportingStart, expiresWithin, remainingDays, type ReportSubscription } from "@/lib/subscriptionReports";
import { Button } from "@/components/ui/button";
interface Teacher { id: string; full_name: string; email: string }
export default function SubscriptionReports({ subscriptions, payments, teachers, onFind }: {
  subscriptions: ReportSubscription[];
  payments: { id:number; status:string; amount:number; created_at:string; environment:string }[];
  teachers: Teacher[]; onFind:(email:string)=>void;
}) {
  const [days,setDays]=useState(7);
  const [period,setPeriod]=useState(1);
  const now=Date.now();
  const start=reportingStart(period,now);
  const recent=subscriptions.filter(s=>Date.parse(s.created_at)>=start && Date.parse(s.created_at)<=now);
  const paid=payments.filter(p=>p.environment==="live" && p.status==="completed" && Date.parse(p.created_at)>=start && Date.parse(p.created_at)<=now);
  const ending=subscriptions.filter(s=>expiresWithin(s,days,now)).sort((a,b)=>Date.parse(a.ends_at!)-Date.parse(b.ends_at!));
  return <section className="space-y-4 rounded-xl border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-heading text-lg font-bold">সাবস্ক্রিপশন রিপোর্ট</h2><div className="flex gap-2">{[{n:1,label:"আজ"},{n:7,label:"গত ৭ দিন"},{n:30,label:"গত ৩০ দিন"}].map(p=><Button key={p.n} size="sm" variant={period===p.n?"default":"outline"} onClick={()=>setPeriod(p.n)}>{p.label}</Button>)}</div></div>
    <p className="text-xs text-muted-foreground">বাংলাদেশ সময় · নতুন সাবস্ক্রিপশন তৈরির তারিখ ও সফল পেমেন্টের অর্ডার তারিখ অনুযায়ী। ম্যানুয়াল আদায় নিচে আলাদা দেখানো আছে।</p>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[
      ["নতুন সাবস্ক্রিপশন",recent.length],["সাবস্ক্রিপশন নেওয়া ইউজার",new Set(recent.map(s=>s.teacher_id)).size],
      ["সফল পেমেন্ট",paid.length],["বিকাশ আদায়",`৳${paid.reduce((sum,p)=>sum+Number(p.amount),0).toLocaleString("bn-BD")}`],
    ].map(([label,value])=><div key={label} className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><strong className="text-xl">{value}</strong></div>)}</div>
    <div className="flex flex-wrap items-center gap-3"><h3 className="font-semibold">শিগগির মেয়াদ শেষ — {ending.length}টি প্যাকেজ</h3><label className="text-sm">আগামী <select className="rounded border bg-background p-2" value={days} onChange={e=>setDays(Number(e.target.value))}>{[7,15,30].map(n=><option key={n} value={n}>{n} দিন</option>)}</select></label><Button size="sm" variant="outline" onClick={()=>onFind("")}>সব ইউজার দেখুন</Button></div>
    <div className="max-h-80 space-y-2 overflow-y-auto">{!ending.length?<p className="text-sm text-muted-foreground">এই সময়ের মধ্যে কোনো সক্রিয় প্যাকেজের মেয়াদ শেষ হচ্ছে না।</p>:ending.map((s,i)=>{
      const t=teachers.find(t=>t.id===s.teacher_id);
      return <div key={`${s.teacher_id}-${i}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 p-3 text-sm"><div><p className="font-medium">{t?.full_name || s.teacher_id}</p><button className="text-primary underline" onClick={()=>onFind(t?.email || "")}>{t?.email}</button><p>{s.plan}</p></div><div className="text-right"><strong className="text-amber-700">{remainingDays(s.ends_at,now)} দিন বাকি</strong><p>{new Date(s.ends_at!).toLocaleDateString("bn-BD",{timeZone:"Asia/Dhaka"})}</p></div></div>;
    })}</div>
  </section>;
}
