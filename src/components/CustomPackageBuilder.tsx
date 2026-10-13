import { useEffect, useState } from "react";
import { useNoPackagePreview } from "@/lib/adminExperiencePreview";
import { useAuth } from "@/contexts/AuthContext";
import { builderRpc, validSubjects, type BuilderClass, type CustomQuote, type PackageVersion } from "@/lib/customPackages";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Loader2, SlidersHorizontal } from "lucide-react";
import { type SelectedPackageItem } from "@/components/InlineCheckout";
import PackagePicker from "@/components/packages/PackagePicker";
import PackageCheckoutDialog from "@/components/packages/PackageCheckoutDialog";

const money = (n: number) => `৳${n.toLocaleString("bn-BD", { maximumFractionDigits: 2 })}`;

export default function CustomPackageBuilder() {
  const { user } = useAuth();
  const noPackagePreview = useNoPackagePreview(user?.id);
  const [catalog, setCatalog] = useState<BuilderClass[]>([]);
  const [version, setVersion] = useState<PackageVersion>("bangla");
  const [classId, setClassId] = useState<number | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [ids, setIds] = useState<number[]>([]);
  const [quote, setQuote] = useState<CustomQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [checkout, setCheckout] = useState<SelectedPackageItem | null>(null);
  const [ownedIds, setOwnedIds] = useState<number[]>([]);
  const [checkingOwnership, setCheckingOwnership] = useState(false);
  const cls = catalog.find(c => c.class_id === classId && c.version === version);
  const classes = catalog.filter(c => c.version === version);
  const subjects = cls ? validSubjects(cls.subjects, group) : [];
  const ownsAll = !!cls?.subjects.length && cls.subjects.every(s => ownedIds.includes(s.subject_id));

  useEffect(() => {
    let cancelled = false;
    setOwnedIds([]);
    if (!user?.id || !classId || noPackagePreview) { setCheckingOwnership(false); return; }
    setCheckingOwnership(true);
    builderRpc("custom_package_owned_subjects", { selected_class: classId }).then(data => {
      if (!cancelled) setOwnedIds(data);
    }).catch(() => { if (!cancelled) setNotice("আপনার আগের অ্যাক্সেস যাচাই হয়নি। চেকআউটে আবার যাচাই করা হবে।"); })
      .finally(() => { if (!cancelled) setCheckingOwnership(false); });
    return () => { cancelled = true; };
  }, [user?.id, classId, noPackagePreview]);

  useEffect(() => {
    let cancelled = false;
    builderRpc("custom_package_catalog", {}).then(data => {
      if (!cancelled) { setCatalog(data); setError(""); }
    }).catch(() => { if (!cancelled) setError("কাস্টম প্যাকেজ এখনো চালু হয়নি। নিচের নিয়মিত প্যাকেজগুলো বেছে নিতে পারেন।"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setQuote(null); setCheckout(null);
    if (!cls || !ids.length || (cls.groups.length && !group)) { setBusy(false); return; }
    setBusy(true); setError("");
    const timer = window.setTimeout(() => {
      builderRpc("quote_custom_package", { selection: { version, class_id: cls.class_id, group, subject_ids: ids } })
        .then(q => { if (!cancelled) setQuote(q); })
        .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "মূল্য যাচাই করা যায়নি"); })
        .finally(() => { if (!cancelled) setBusy(false); });
    }, 120);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [version, classId, group, ids, user?.id, cls]);

  function resetSelection() { setIds([]); setQuote(null); setCheckout(null); setNotice(""); setError(""); }
  function changeGroup(next: string) {
    const valid = new Set(validSubjects(cls?.subjects || [], next).map(s => s.subject_id));
    const kept = ids.filter(id => valid.has(id));
    setNotice(kept.length !== ids.length ? "নতুন বিভাগে প্রযোজ্য নয় এমন বিষয় সরানো হয়েছে। সাধারণ বিষয়গুলো রাখা হয়েছে।" : "");
    setIds(kept); setGroup(next); setCheckout(null); setQuote(null);
  }

  if (loading) return <div className="container py-8 text-center"><Loader2 className="mx-auto animate-spin" /></div>;
  if (!catalog.length) return <section className="container max-w-6xl"><Card><CardContent className="p-6"><h2 className="font-heading text-xl font-bold">নিজের প্যাকেজ তৈরি করুন</h2><p className="mt-2 text-sm text-muted-foreground">{error || "কাস্টম প্যাকেজ শীঘ্রই চালু হবে। নিয়মিত প্যাকেজগুলো নিচে পাওয়া যাবে।"}</p></CardContent></Card></section>;

  return <section className="space-y-4" aria-label="Custom Package Builder">
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-[0_6px_28px_-16px_#0a1e3830]">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4"><SlidersHorizontal className="h-5 w-5 text-[#00858C]" /><div><h2 className="font-heading text-lg font-bold text-[#0A1E38]">নিজের প্যাকেজ তৈরি করুন</h2><p className="text-xs text-slate-500">প্রশ্ন তৈরির মতোই শ্রেণি ও বিষয় বেছে নিন।</p></div></div>
        <CardContent className="grid gap-4 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <PackagePicker title="ভার্সন নির্বাচন করুন" label="১. ভার্সন" placeholder="ভার্সন বেছে নিন" selected={[version]} options={[{id:"bangla",label:"Bangla Version"},{id:"english",label:"English Version"}]} onSelect={id => { if (id === version) return; resetSelection(); setVersion(id as PackageVersion); setClassId(null); setGroup(null); }} />
            <PackagePicker title="শ্রেণি নির্বাচন করুন" label="২. শ্রেণি" placeholder="শ্রেণি বেছে নিন" selected={classId ? [String(classId)] : []} options={classes.map(c => ({id:String(c.class_id),label:c.name}))} onSelect={id => { if (Number(id) === classId) return; resetSelection(); setClassId(Number(id)); setGroup(null); }} />
          </div>
          {!classes.length && <p className="text-sm text-muted-foreground">এই ভার্সনের কাস্টম প্যাকেজ এখন পাওয়া যাচ্ছে না।</p>}
          {cls && cls.groups.length>0 && <PackagePicker title="বিভাগ নির্বাচন করুন" label="৩. বিভাগ" placeholder="বিভাগ বেছে নিন" selected={group ? [group] : []} options={cls.groups.map(g=>({id:g,label:g}))} onSelect={changeGroup} />}
          <PackagePicker title="বিষয় নির্বাচন করুন" label="বিষয়" placeholder="বিষয় বেছে নিন" selected={ids.map(String)} multiple searchable disabled={!cls || (!!cls.groups.length && !group)} options={subjects.map(s=>({id:String(s.subject_id),label:s.name,detail:ownedIds.includes(s.subject_id) ? "অ্যাক্সেস আছে" : `${money(s.price)}/বছর`,disabled:ownedIds.includes(s.subject_id)}))} onSelect={id=>{ setQuote(null); setCheckout(null); const subjectId=Number(id); setIds(prev=>prev.includes(subjectId)?prev.filter(x=>x!==subjectId):[...prev,subjectId]); }} />
          {notice && <p role="status" className="text-xs text-amber-700">{notice}</p>}
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"><p className="text-xs text-slate-500">এক বা একাধিক বিষয় · ৩৬৫ দিনের মেয়াদ</p><Button variant="ghost" size="sm" disabled={!ids.length} className="h-8 text-xs" onClick={resetSelection}>সব সরান</Button></div>
          {cls && <Button variant="outline" className="h-11 border-[#00B4BC]/30 text-[#006A70]" disabled={ownsAll || checkingOwnership} onClick={()=>setCheckout({id:cls.all_package_id,class_name:cls.name,subject_name:"সকল বিষয়",price:cls.all_price})}>সকল বিষয় নিন — {money(cls.all_price)}</Button>}
        </CardContent>
      </Card>
      <aside><Card className="overflow-hidden rounded-2xl border-slate-200"><div className="bg-[#0A1E38] px-5 py-4"><h3 className="font-heading font-bold text-white">আপনার প্যাকেজ</h3><p className="mt-1 text-xs text-white/70">{version === "bangla" ? "Bangla Version" : "English Version"}{cls && ` · ${cls.name}`}{group && ` · ${group}`}</p></div>
        <CardContent className="space-y-3 p-5" aria-live="polite">
          {ownsAll && <p className="text-sm text-primary">এই শ্রেণির সকল বিষয়ে আপনার অ্যাক্সেস আছে।</p>}
          {ids.length>0 && <ul className="max-h-28 space-y-1 overflow-y-auto text-sm">{subjects.filter(s=>ids.includes(s.subject_id)).map(s=><li key={s.subject_id} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-[#00858C]" />{s.name}</li>)}</ul>}
          {busy ? <p className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />মূল্য যাচাই হচ্ছে…</p> : quote ? <>
            <div className="border-t pt-3"><p className="text-xs text-slate-500">আলাদাভাবে নিলে: <span className={quote.savings>0 ? "line-through" : ""}>{money(quote.regular_total)}</span></p><p className="my-1"><strong className="text-3xl text-[#0A1E38]">{money(quote.price)}</strong><span className="text-xs text-slate-500"> /বছর</span></p><p className="text-sm text-[#00858C]">আপনার সাশ্রয়: <strong>{money(quote.savings)}</strong></p><p className="mt-1 text-xs text-slate-500">৩৬৫ দিন · প্রায় {money(Math.round(quote.price/12))}/মাস</p></div>
            {quote.owned_subject_ids.length>0 && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">নির্বাচিত {quote.owned_subject_ids.length.toLocaleString("bn-BD")}টি বিষয়ে অ্যাক্সেস আছে। আবার কেনার আগে সেগুলো সরিয়ে দিন।</p>}
            <Button className="h-11 w-full bg-[#00B4BC] text-[#07162b] hover:bg-[#2ac8ce]" disabled={!!quote.owned_subject_ids.length} onClick={()=>setCheckout({id:-1,class_name:quote.class_name,subject_name:quote.subject_name,price:quote.price,custom_selection:{version,class_id:quote.class_id,group,subject_ids:[...ids]}})}>এই প্যাকেজ নিন</Button>
            {(quote.upgrade_difference<=quote.all_price*0.3 || ids.length>=5) && <div className="rounded-lg bg-[#00B4BC]/5 p-3 text-xs"><p>{quote.upgrade_difference===0 ? "একই মূল্যে সকল বিষয় নিন।" : `আর মাত্র ${money(quote.upgrade_difference)} যোগ করে সকল বিষয় নিন।`}</p><Button variant="ghost" size="sm" className="mt-1 h-8 w-full text-[#006A70]" disabled={ownsAll || checkingOwnership} onClick={()=>setCheckout({id:quote.all_package_id,class_name:quote.class_name,subject_name:"সকল বিষয়",price:quote.all_price})}>সকল বিষয় বেছে নিন — {money(quote.all_price)}</Button></div>}
          </> : <p className="py-6 text-center text-sm text-slate-500">মূল্য দেখতে শ্রেণি, বিভাগ ও বিষয় বেছে নিন।</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card></aside>
    </div>
    <PackageCheckoutDialog open={!!checkout} onOpenChange={open=>{if(!open)setCheckout(null);}} selectedPackages={checkout?[checkout]:[]} onRemove={()=>setCheckout(null)} onClearAll={()=>setCheckout(null)} />
  </section>;
}
