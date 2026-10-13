import { useEffect, useState } from "react";
import { builderRpc } from "@/lib/customPackages";
import { readyPackageCatalog } from "@/lib/readyPackageCatalog";
import { getClassLevelKey } from "@/lib/subjectVersion";
import type { FixedPricingPackage } from "./FixedPackageSelector";
const price=(n:number)=>`${n.toLocaleString("bn-BD",{useGrouping:false})}/-`;
const label=(s:string)=>s.replace(/Eglish/gi,"English").replace(/\s*\(English Version\)/gi,"").replace(/ শ্রেণি/g,"").replace(/\s*-\s*/g,"-").replace("নবম-দশম","নবম/দশম").replace("একাদশ-দ্বাদশ","একাদশ/দ্বাদশ");
const titles=["১। শিক্ষক/টিউটর প্যাকেজ","২। একাডেমিক পর্যায় অনুযায়ী বান্ডেল প্যাকেজের মূল্য তালিকা","৩। কোচিং সেন্টার/বড় প্রতিষ্ঠান প্যাকেজ","৪। শ্রেণি অনুযায়ী মূল্য তালিকা","৫। বিষয়ভিত্তিক শিক্ষকের প্যাকেজ"];
export default function ReadyPackageCatalog({packages,onSelect,onSubjects,version="bangla"}:{packages:FixedPricingPackage[];selected:Set<number>;onSelect:(p:FixedPricingPackage)=>void;onCustom?:()=>void;onSubjects?:(className:string)=>void;version?:string}) {
 const [subjectPrices,setSubjectPrices]=useState<Record<string,number>>({});
 useEffect(()=>{let cancelled=false;builderRpc("custom_package_catalog",{}).then(data=>{if(!cancelled)setSubjectPrices(Object.fromEntries(data.map(c=>[c.name,c.normal_price])));}).catch(()=>{});return()=>{cancelled=true;};},[]);
 const english=version==="english";
 const classPackages=packages.filter(p=>p.type==="class"&&p.subject_name==="সকল বিষয়").sort((a,b)=>Number(getClassLevelKey(a.class_name).split("-")[0])-Number(getClassLevelKey(b.class_name).split("-")[0]));
 const bundles=packages.filter(p=>p.type==="bundle"&&p.subject_name==="সকল বিষয়");
 const subjectBundles=packages.filter(p=>p.type==="bundle"&&p.subject_name!=="সকল বিষয়");
 const groups=english?[
  {title:titles[0],rows:classPackages,teacher:true},
  ...(bundles.length?[{title:titles[1],rows:bundles,teacher:false}]:[]),
  {title:"শ্রেণি অনুযায়ী মূল্য তালিকা",rows:classPackages,teacher:false},
  ...(subjectBundles.length?[{title:"বিষয়ভিত্তিক শিক্ষকের প্যাকেজ",rows:subjectBundles,teacher:false}]:[]),
 ]:[readyPackageCatalog[0],readyPackageCatalog[1],readyPackageCatalog[2],readyPackageCatalog[0],readyPackageCatalog[3]].map((g,i)=>({...g,title:titles[i],teacher:i===0}));
 return <div className="space-y-12">{groups.map((g,i)=><section key={i}><h2 className="mb-4 text-base font-medium">{g.title}</h2><div className="overflow-x-auto sm:px-4"><table className="w-full min-w-[420px] border-collapse text-center text-sm [&_th]:border [&_th]:border-[#d1d5db] [&_th]:bg-[#e5e7eb] [&_th]:px-3 [&_th]:py-3 [&_th]:font-semibold [&_td]:border [&_td]:border-[#d1d5db] [&_td]:px-3 [&_td]:py-2"><thead><tr><th>শ্রেণি</th><th>{g.teacher?"প্রতি বিষয়":"বিষয়"}</th><th>{g.teacher?"সকল বিষয়":"মূল্য"}</th><th>মেয়াদ</th><th>{g.teacher?"ক্রয় করুন":"পদক্ষেপ"}</th></tr></thead><tbody>{g.rows.map((r,j)=>{const p=packages.find(p=>p.type===r.type&&p.class_name===r.class_name&&p.subject_name===r.subject_name);const subjectView=g.teacher&&(english||j>2);const individual=packages.find(p=>p.type==="class"&&p.class_name===r.class_name&&p.subject_name!=="সকল বিষয়");return <tr key={r.class_name+r.subject_name}><td>{label(r.class_name)}</td><td>{g.teacher?(english?(individual?price(individual.price):subjectPrices[r.class_name]?price(subjectPrices[r.class_name]):"—"):(j<3?<span className="text-lg text-red-500">×</span>:price(249))):r.subject_name==="সকল বিষয়"?"সকল":r.subject_name==="তথ্য ও যোগাযোগ প্রযুক্তি"?"আইসিটি":r.subject_name}</td><td>{price(p?.price??r.price)}</td><td className="whitespace-nowrap">{p?.duration_days?`${p.duration_days.toLocaleString("bn-BD")} দিন`:"৩৬৫ দিন"}</td><td>{subjectView?<button type="button" onClick={()=>onSubjects?.(r.class_name)} className="text-[#6488d4] underline">বিষয় দেখুন</button>:<button type="button" disabled={!p||p.is_coming_soon} onClick={()=>p&&onSelect(p)} className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-lg bg-[#00858C] px-5 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#006A70] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00858C] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-[#334155] disabled:shadow-none">ক্রয় করুন</button>}</td></tr>})}</tbody></table></div></section>)}{english&&!packages.length&&<p className="text-center text-sm">প্যাকেজ পাওয়া যায়নি।</p>}</div>;
}





