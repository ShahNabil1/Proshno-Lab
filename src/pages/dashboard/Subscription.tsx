import { useEffect, useState } from "react";
import PricingPage from "@/pages/PricingPage";
import CustomPackageBuilder from "@/components/CustomPackageBuilder";
import PackagePicker from "@/components/packages/PackagePicker";
import PackageCheckoutDialog from "@/components/packages/PackageCheckoutDialog";
import { type SelectedPackageItem } from "@/components/InlineCheckout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Crown, ShieldCheck, Clock, Package, ShoppingCart, X, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isNoPackagePreview } from "@/lib/adminExperiencePreview";
import { activePlanNames, isPackagePurchased, isSubscriptionActive } from "@/lib/subscriptionMatcher";
import { isEnglishVersionClass } from "@/lib/subjectVersion";

interface Sub { id:number; plan:string; status:string; starts_at:string|null; ends_at:string|null }
interface PricingPkg { id:number; class_name:string; subject_name:string; price:number; type:string; sort_order:number; duration_days?:number|null; is_coming_soon?:boolean }
const bn=(n:number)=>n.toLocaleString("bn-BD");
const money=(n:number)=>`৳${bn(n)}`;
const daysLeft=(end:string)=>Math.max(0,Math.ceil((new Date(end).getTime()-Date.now())/86400000));
const date=(value:string)=>new Date(value).toLocaleDateString("bn-BD",{day:"numeric",month:"short",year:"numeric"});
type View="pricing"|"custom"|"fixed"|"plans";

export default function Subscription() {
  const {user}=useAuth();
  const [subs,setSubs]=useState<Sub[]>([]);
  const [packages,setPackages]=useState<PricingPkg[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [view,setView]=useState<View>("pricing");
  const [version,setVersion]=useState("bangla");
  const [kind,setKind]=useState("class");
  const [className,setClassName]=useState("");
  const [selectedPkgs,setSelectedPkgs]=useState<Map<number,SelectedPackageItem>>(new Map());
  const [checkoutOpen,setCheckoutOpen]=useState(false);
  useEffect(()=>{
    if(!user)return;
    let cancelled=false;
    Promise.all([
      supabase.from("subscriptions").select("*").eq("teacher_id",user.id).order("starts_at",{ascending:true}),
      supabase.from("pricing_packages").select("*").eq("is_active",true).order("sort_order"),
    ]).then(([s,p])=>{
      if(cancelled)return;
      if(s.error||p.error)setError("প্যাকেজের তথ্য লোড হয়নি। আবার চেষ্টা করুন।");
      setSubs(isNoPackagePreview(user.id)?[]:s.data||[]);setPackages(p.data||[]);setLoading(false);
    }).catch(()=>{if(!cancelled){setError("প্যাকেজের তথ্য লোড হয়নি। আবার চেষ্টা করুন।");setLoading(false);}});
    return()=>{cancelled=true;};
  },[user]);
  const activeSubs=subs.filter(s=>isSubscriptionActive(s));
  const activePlans=activePlanNames(subs);
  const selectedList=Array.from(selectedPkgs.values());
  const total=selectedList.reduce((sum,p)=>sum+p.price,0);
  const scoped=packages.filter(p=>p.type===kind && isEnglishVersionClass(p.class_name)===(version==="english"));
  const classNames=[...new Set(scoped.map(p=>p.class_name))];
  const visible=kind==="bundle"?scoped:scoped.filter(p=>p.class_name===className);
  const isPurchased=(p:PricingPkg)=>isPackagePurchased(p,activePlans);
  const togglePackage=(pkg:PricingPkg)=>{
    if(pkg.is_coming_soon||isPurchased(pkg))return;
    setSelectedPkgs(prev=>{
      const next=new Map(prev);
      if(next.has(pkg.id))next.delete(pkg.id);
      else {
        const plan=`${pkg.class_name} - ${pkg.subject_name}`;
        packages.filter(p=>next.has(p.id)&&isPackagePurchased(p,[plan])).forEach(p=>next.delete(p.id));
        next.set(pkg.id,{id:pkg.id,class_name:pkg.class_name,subject_name:pkg.subject_name,price:pkg.price});
      }
      return next;
    });
  };
  if(loading)return <div className="flex justify-center py-16"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  return <div className="subscription-workspace mx-auto max-w-5xl space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-l-4 border-[#00B4BC] bg-[#0A1E38] px-5 py-4 text-white">
      <div><h1 className="flex items-center gap-2 font-heading text-xl font-bold"><Crown className="h-5 w-5 text-[#00B4BC]" />আমার সাবস্ক্রিপশন</h1><p className="mt-1 text-xs text-white/70">শ্রেণি ও বিষয় বেছে আপনার প্রয়োজনের প্যাকেজ নিন</p></div>
      <button className="rounded-lg border border-white/20 px-3 py-2 text-xs hover:bg-white/10" onClick={()=>setView("plans")}>{activeSubs.length?`${bn(activeSubs.length)}টি সক্রিয় প্ল্যান` : "কোনো সক্রিয় প্ল্যান নেই"}</button>
    </div>
    <div role="tablist" aria-label="প্যাকেজের ধরন" className="grid grid-cols-2 gap-1 sm:grid-cols-4 rounded-xl bg-slate-100 p-1">
      {([{id:"pricing",label:"প্যাকেজ ও মূল্য"},{id:"custom",label:"নিজের প্যাকেজ"},{id:"fixed",label:"রেডিমেড প্যাকেজ"},{id:"plans",label:"আমার প্ল্যান"}] as const).map(t=><button key={t.id} id={`subscription-tab-${t.id}`} role="tab" aria-selected={view===t.id} aria-controls={`subscription-panel-${t.id}`} tabIndex={view===t.id?0:-1} onClick={()=>setView(t.id)} onKeyDown={e=>{if(e.key==="ArrowRight"||e.key==="ArrowLeft"){e.preventDefault();const tabs:View[]=["pricing","custom","fixed","plans"];const next=tabs[(tabs.indexOf(view)+(e.key==="ArrowRight"?1:3))%4];setView(next);document.getElementById(`subscription-tab-${next}`)?.focus();}}} className={`min-h-11 rounded-lg px-2 text-sm font-semibold transition-colors ${view===t.id?"bg-white text-[#0A1E38] shadow-sm":"text-slate-500 hover:text-slate-800"}`}>{t.label}</button>)}
    </div>
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    {view==="pricing" && <div role="tabpanel" id="subscription-panel-pricing" aria-labelledby="subscription-tab-pricing"><PricingPage embedded /></div>}
    <div role="tabpanel" id="subscription-panel-custom" aria-labelledby="subscription-tab-custom" hidden={view!=="custom"}><CustomPackageBuilder /></div>
    <div role="tabpanel" id="subscription-panel-fixed" aria-labelledby="subscription-tab-fixed" hidden={view!=="fixed"}>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-[0_6px_28px_-16px_#0a1e3830]">
          <div className="flex items-center gap-3 border-b px-5 py-4"><Package className="h-5 w-5 text-[#00858C]" /><div><h2 className="font-heading text-lg font-bold text-[#0A1E38]">রেডিমেড প্যাকেজ বেছে নিন</h2><p className="text-xs text-slate-500">আগের সকল বিষয়, বিষয়ভিত্তিক ও বান্ডেল প্যাকেজ</p></div></div>
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2"><PackagePicker title="প্যাকেজের ভার্সন" label="ভার্সন" placeholder="প্যাকেজের ভার্সন বেছে নিন" selected={[version]} options={[{id:"bangla",label:"Bangla Version"},{id:"english",label:"English Version"}]} onSelect={v=>{setVersion(v);setClassName("");}} /><PackagePicker title="প্যাকেজের ধরন" label="ধরন" placeholder="প্যাকেজের ধরন বেছে নিন" selected={[kind]} options={[{id:"class",label:"শ্রেণি ও বিষয়ভিত্তিক"},{id:"bundle",label:"বান্ডেল প্যাকেজ"}]} onSelect={k=>{setKind(k);setClassName("");}} /></div>
            {kind==="class"&&<PackagePicker title="প্যাকেজের শ্রেণি" label="শ্রেণি" placeholder="প্যাকেজের শ্রেণি বেছে নিন" selected={className?[className]:[]} options={classNames.map(c=>({id:c,label:c}))} onSelect={setClassName} />}
            <div className="max-h-[320px] space-y-2 overflow-y-auto overscroll-contain">
              {visible.map(pkg=>{
                const all=packages.find(p=>p.type==="class"&&p.class_name===pkg.class_name&&p.subject_name==="সকল বিষয়");
                const individual=pkg.type==="class"&&pkg.subject_name!=="সকল বিষয়";
                const bought=isPurchased(pkg)||(individual&&!!all&&isPurchased(all));
                const included=selectedList.some(p=>p.id!==pkg.id&&isPackagePurchased(pkg,[`${p.class_name} - ${p.subject_name}`]));
                const coming=!!pkg.is_coming_soon||(individual&&!!all?.is_coming_soon);
                return <label key={pkg.id} className={`flex min-h-16 items-center gap-3 rounded-lg border p-3 ${bought||included||coming?"cursor-not-allowed bg-slate-50":"cursor-pointer hover:border-[#00B4BC]/50"} ${selectedPkgs.has(pkg.id)?"border-[#00B4BC] bg-[#00B4BC]/5":"border-slate-200"}`}>
                  <input type="checkbox" aria-label={`${pkg.class_name} — ${pkg.subject_name}`} checked={selectedPkgs.has(pkg.id)} disabled={bought||included||coming} onChange={()=>togglePackage(pkg)} className="h-4 w-4 shrink-0 accent-[#0A1E38]" />
                  <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{kind==="bundle"?pkg.class_name:pkg.subject_name}</p><p className="text-xs text-slate-500">{pkg.duration_days?`${bn(pkg.duration_days)} দিন`:"১ বছর"}{bought?" · ইতিমধ্যেই কেনা হয়েছে":included?" · সকল বিষয়ে অন্তর্ভুক্ত":coming?" · শীঘ্রই আসছে":""}</p></div><strong className="shrink-0 text-sm text-[#0A1E38]">{money(pkg.price)}</strong>
                </label>;
              })}
              {!visible.length&&<p className="py-8 text-center text-sm text-slate-500">{kind==="class"&&!className?"প্যাকেজ দেখতে শ্রেণি বেছে নিন।":"এই ভার্সনের প্যাকেজ পাওয়া যায়নি।"}</p>}
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden rounded-2xl border-slate-200"><div className="bg-[#0A1E38] px-5 py-4"><h3 className="font-heading font-bold text-white">নির্বাচিত প্যাকেজ</h3><p className="mt-1 text-xs text-white/70">{bn(selectedList.length)}টি প্যাকেজ</p></div><CardContent className="space-y-4 p-5">
          <div className="max-h-44 space-y-2 overflow-y-auto">{selectedList.map(p=><div key={p.id} className="flex items-start gap-2 rounded-lg bg-slate-50 p-2"><div className="min-w-0 flex-1 text-xs"><p className="font-semibold">{p.class_name}</p><p className="text-slate-500">{p.subject_name} · {money(p.price)}</p></div><Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={`${p.class_name} — ${p.subject_name} সরান`} onClick={()=>setSelectedPkgs(prev=>{const next=new Map(prev);next.delete(p.id);return next;})}><X className="h-3 w-3" /></Button></div>)}</div>
          {!selectedList.length&&<p className="py-4 text-center text-sm text-slate-500">আপনার প্রয়োজনের প্যাকেজ বেছে নিন।</p>}
          <div className="flex items-center justify-between border-t pt-3"><span className="text-sm text-slate-500">সর্বমোট</span><strong className="text-2xl text-[#0A1E38]">{money(total)}</strong></div>
          <Button disabled={!selectedList.length} className="h-11 w-full bg-[#00B4BC] text-[#07162b] hover:bg-[#2ac8ce]" onClick={()=>setCheckoutOpen(true)}><ShoppingCart className="mr-2 h-4 w-4" />চেকআউট করুন</Button>
        </CardContent></Card>
      </div>
    </div>
    <div role="tabpanel" id="subscription-panel-plans" aria-labelledby="subscription-tab-plans" hidden={view!=="plans"}>
      <Card className="rounded-2xl border-slate-200"><CardContent className="p-5"><h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-bold text-[#0A1E38]"><ShieldCheck className="h-5 w-5 text-[#00858C]" />আমার প্ল্যান ও মেয়াদ</h2>
        {!subs.length?<div className="py-8 text-center"><p className="mb-3 text-sm text-slate-500">কোনো সক্রিয় সাবস্ক্রিপশন নেই। আপনার প্রয়োজনের প্যাকেজ বেছে নিন।</p><Button onClick={()=>setView("custom")}>প্যাকেজ বেছে নিন</Button></div>:<div className="max-h-[440px] space-y-3 overflow-y-auto">{[...activeSubs,...subs.filter(s=>!isSubscriptionActive(s))].map(s=>{
          const active=isSubscriptionActive(s);const progress=s.starts_at&&s.ends_at?Math.min(100,Math.max(0,(Date.now()-new Date(s.starts_at).getTime())/(new Date(s.ends_at).getTime()-new Date(s.starts_at).getTime())*100)):0;
          return <div key={s.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold">{s.plan}</p><Badge variant="outline" className="shrink-0 text-xs">{active?<><CheckCircle2 className="mr-1 h-3 w-3" />সক্রিয়</>:<><Clock className="mr-1 h-3 w-3" />মেয়াদোত্তীর্ণ</>}</Badge></div><p className="my-2 text-xs text-slate-500">{s.starts_at?date(s.starts_at):"—"} থেকে {s.ends_at?date(s.ends_at):"নির্ধারিত মেয়াদ নেই"}</p>{active&&s.ends_at&&<><Progress value={progress} className="h-1.5" /><p className="mt-2 text-xs text-[#00858C]">{bn(daysLeft(s.ends_at))} দিন বাকি</p></>}</div>;
        })}</div>}
      </CardContent></Card>
    </div>
    <PackageCheckoutDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} selectedPackages={selectedList} onRemove={id=>setSelectedPkgs(prev=>{const next=new Map(prev);next.delete(id);return next;})} onClearAll={()=>{setSelectedPkgs(new Map());setCheckoutOpen(false);}} />
  </div>;
}
