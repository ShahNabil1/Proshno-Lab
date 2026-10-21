import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SubjectPackageCheckout from "@/components/packages/SubjectPackageCheckout";
import CustomPackageBuilder from "@/components/CustomPackageBuilder";
import ReadyPackageCatalog from "@/components/packages/ReadyPackageCatalog";
import PackageCheckoutDialog from "@/components/packages/PackageCheckoutDialog";
import type { FixedPricingPackage } from "@/components/packages/FixedPackageSelector";
import type { SelectedPackageItem } from "@/components/InlineCheckout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, ArrowRight } from "lucide-react";
import { isEnglishVersionClass } from "@/lib/subjectVersion";

export default function PricingPage({ embedded = false }: { embedded?: boolean }) {
 const [search,setSearch]=useSearchParams();
 const subjectClass=search.get("class");
 const [custom,setCustom]=useState(false);
 const [version,setVersion]=useState(search.get("version")==="english"?"english":"bangla");
 const [packages,setPackages]=useState<FixedPricingPackage[]>([]);
 const [selected,setSelected]=useState<SelectedPackageItem[]>([]);
 const [checkout,setCheckout]=useState(false);
 const [error,setError]=useState(false);
 useEffect(()=>{let cancelled=false;supabase.from("pricing_packages").select("*").eq("is_active",true).order("sort_order").then(({data,error})=>{if(!cancelled){setPackages(data||[]);setError(!!error);}});return()=>{cancelled=true;};},[]);
 const buy=(p:FixedPricingPackage)=>{setSelected([{id:p.id,class_name:p.class_name,subject_name:p.subject_name,price:p.price}]);setCheckout(true);};
 return <div className={embedded ? "text-[#292929]" : "min-h-screen bg-[#f3f4f6] px-3 pb-12 pt-24 text-[#292929]"}>
  <div className="mx-auto max-w-[760px] border border-[#e5e7eb] bg-white px-3 py-5 sm:px-5 sm:py-8">
   <h1 className="text-center font-heading text-xl font-bold sm:text-3xl">প্রশ্ন তৈরির — স্মার্ট প্যাকেজ !!!</h1>
   <p className="mt-1 text-center text-lg">{subjectClass?"বিষয় - চেক আউট":"মূল্য তালিকা"}</p>
   <div className="mt-5 flex items-center justify-end gap-3 border-b pb-3 text-sm"><Button size="sm" variant="outline" className={`min-h-11 h-auto w-full sm:w-auto gap-2 whitespace-normal rounded-lg px-3 py-2 text-sm font-semibold ${custom||subjectClass ? "" : "border-[#00858C] bg-[#00B4BC] text-[#07162b] shadow-md shadow-[#00B4BC]/20 hover:border-[#006A70] hover:bg-[#2ac8ce] hover:text-[#07162b]"}`} onClick={()=>{if(subjectClass)setSearch({});else setCustom(!custom);}}>{!custom&&!subjectClass&&<SlidersHorizontal className="h-4 w-4"/>}{custom||subjectClass?"মূল্য তালিকা":"নিজের ইচ্ছে মতো প্যাকেজ বানান"}{!custom&&!subjectClass&&<ArrowRight className="h-4 w-4"/>}</Button></div>
   {subjectClass?<SubjectPackageCheckout key={subjectClass+version} className={subjectClass} version={version as "bangla"|"english"}/>:custom?<div className="mt-6"><CustomPackageBuilder /></div>:<>
    <div className="my-7 flex justify-center"><div className="inline-flex gap-1 rounded-xl bg-[#f3f4f6] p-1 shadow-sm">{[{id:"bangla",label:"বাংলা ভার্সন"},{id:"english",label:"English Version"}].map(v=><button key={v.id} type="button" aria-pressed={version===v.id} onClick={()=>setVersion(v.id)} className={`rounded-lg px-3 sm:px-5 py-3 text-sm ${version===v.id?"bg-[#00B4BC] text-[#07162b]":"bg-white"}`}>{v.label}</button>)}</div></div>
    {error&&<p role="alert" className="mb-4 text-center text-sm text-red-600">প্যাকেজ লোড হয়নি।</p>}
    <ReadyPackageCatalog packages={packages.filter(p=>isEnglishVersionClass(p.class_name)===(version==="english"))} selected={new Set(selected.map(p=>p.id))} onSelect={buy} onCustom={()=>setCustom(true)} onSubjects={className=>{setSearch({class:className,version});}} version={version}/>
   </>}
  </div>
  <PackageCheckoutDialog open={checkout} onOpenChange={setCheckout} selectedPackages={selected} onRemove={id=>setSelected(s=>s.filter(p=>p.id!==id))} onClearAll={()=>{setSelected([]);setCheckout(false);}}/>
 </div>;
}
