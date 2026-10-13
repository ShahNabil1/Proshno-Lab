import { useEffect, useState } from "react";
import InlineCheckout, { type SelectedPackageItem } from "@/components/InlineCheckout";
import { builderRpc, validSubjects, type BuilderClass, type CustomQuote, type PackageVersion } from "@/lib/customPackages";
const bn=(n:number)=>n.toLocaleString("bn-BD",{useGrouping:false,maximumFractionDigits:2});
const normalize=(s:string)=>s.replace(/ শ্রেণি/g,"").replace(/\s/g,"");
export default function SubjectPackageCheckout({className,version}:{className:string;version:PackageVersion}) {
 const [cls,setCls]=useState<BuilderClass|null>(null);
 const [ids,setIds]=useState<number[]>([]);
 const [group,setGroup]=useState<string|null>(null);
 const [all,setAll]=useState(false);
 const [quote,setQuote]=useState<CustomQuote|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 useEffect(()=>{let cancelled=false;builderRpc("custom_package_catalog",{}).then(data=>{if(!cancelled){setCls(data.find(c=>c.version===version&&normalize(c.name)===normalize(className))||null);setLoading(false);}}).catch(()=>{if(!cancelled){setError("বিষয়ের তালিকা লোড হয়নি।");setLoading(false);}});return()=>{cancelled=true;};},[className,version]);
 useEffect(()=>{let cancelled=false;setQuote(null);if(!cls||all||!ids.length){setBusy(false);return;}setBusy(true);setError("");builderRpc("quote_custom_package",{selection:{version,class_id:cls.class_id,group,subject_ids:ids}}).then(q=>{if(!cancelled)setQuote(q);}).catch(()=>{if(!cancelled)setError("মূল্য যাচাই করা যায়নি।");}).finally(()=>{if(!cancelled)setBusy(false);});return()=>{cancelled=true;};},[cls,ids,group,version,all]);
 if(loading)return <p role="status" className="py-10 text-center">লোড হচ্ছে…</p>;
 if(!cls)return <p role="alert" className="py-10 text-center">{error||"এই শ্রেণির প্যাকেজ পাওয়া যায়নি।"}</p>;
 const subjects=validSubjects(cls.subjects,group);
 const item:SelectedPackageItem|null=all?{id:cls.all_package_id,class_name:cls.name,subject_name:"সকল বিষয়",price:cls.all_price}:quote?{id:-1,class_name:quote.class_name,subject_name:quote.subject_name,price:quote.price,custom_selection:{version,class_id:cls.class_id,group,subject_ids:[...ids]}}:null;
 return <div className="mt-6 space-y-4">
  <h2 className="text-center font-heading text-xl font-bold">{cls.name.replace(" শ্রেণি","")} শ্রেণির প্যাকেজ</h2>
  <div className="bg-[#f8f9fa] p-4"><p className="mb-3 text-center">বিষয় সংখ্যা অনুযায়ী মূল্য তালিকা</p><table className="mx-auto w-full max-w-[320px] rounded border bg-white text-sm"><thead><tr><th className="p-2 text-left">বিষয় সংখ্যা</th><th className="p-2 text-right">মোট মূল্য</th></tr></thead><tbody><tr><td className="px-3 py-1">১ টি বিষয়</td><td className="px-3 py-1 text-right">{bn(cls.normal_price)}/-</td></tr>{Object.entries(cls.caps).map(([count,cost])=><tr key={count}><td className="px-3 py-1">{bn(Number(count))} টি বিষয়</td><td className="px-3 py-1 text-right">{bn(cost)}/-</td></tr>)}</tbody></table></div>
  <section className="rounded-lg border bg-[#f8f9fa] p-2"><h3 className="mb-3 text-center font-heading text-lg font-bold">বিষয় নির্বাচন করুন ({ids.length?bn(ids.length):""})</h3>
   {!!cls.groups.length&&<div className="mb-3 flex flex-wrap justify-center gap-2">{cls.groups.map(g=><button type="button" key={g} aria-pressed={group===g} onClick={()=>{setGroup(g);setIds([]);setAll(false);}} className={`rounded border px-3 py-1 text-sm ${group===g?"bg-[#00B4BC] text-[#07162b]":"bg-white"}`}>{g}</button>)}</div>}
   <div className="grid gap-2 sm:grid-cols-2">{subjects.map(s=><label key={s.subject_id} className={`flex cursor-pointer items-center gap-2 rounded border bg-white p-3 text-sm ${ids.includes(s.subject_id)?"border-[#00B4BC]":"border-[#e5e7eb]"}`}><input type="checkbox" className="h-4 w-4 accent-[#00B4BC]" checked={!all&&ids.includes(s.subject_id)} onChange={()=>{setAll(false);setIds(prev=>prev.includes(s.subject_id)?prev.filter(id=>id!==s.subject_id):[...prev,s.subject_id]);}}/>{s.name}</label>)}</div>
  </section>
  <label className="mx-auto flex max-w-[340px] cursor-pointer flex-col items-center gap-2 rounded-2xl border border-[#00B4BC] p-4 text-sm"><strong className="text-[#00858C]">সকল বিষয়</strong><span>মাত্র {bn(cls.all_price)} টাকা</span><span className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[#00B4BC]" checked={all} onChange={()=>{setAll(!all);setIds([]);}}/>নির্বাচন করুন</span></label>
  <section className="rounded border bg-[#f8f9fa] p-4"><h3 className="mb-4 text-center font-heading text-xl font-bold">চেক আউট তথ্য</h3><dl className="grid grid-cols-[1fr_2fr] gap-2 text-sm"><dt>সেবার ধরন -</dt><dd>প্রশ্ন তৈরির সফটওয়্যার</dd><dt>প্যাকেজ -</dt><dd>{cls.name}</dd><dt>ভার্সন -</dt><dd>{version==="bangla"?"বাংলা":"English"}</dd><dt>মেয়াদ -</dt><dd>১ বছর</dd><dt>সর্বমোট মূল্য -</dt><dd aria-live="polite">{busy?"মূল্য যাচাই হচ্ছে…":`${bn(item?.price||0)} টাকা`}</dd></dl></section>
  {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
  {item&&!busy&&<InlineCheckout selectedPackages={[item]} onRemove={()=>{setAll(false);setIds([]);setQuote(null);}} onClearAll={()=>{setAll(false);setIds([]);setQuote(null);}}/>}
 </div>;
}

