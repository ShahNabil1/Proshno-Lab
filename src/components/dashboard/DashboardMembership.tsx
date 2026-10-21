import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowUpRight, Crown, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnlimitedAccess } from "@/hooks/useUnlimitedAccess";
import { isSubscriptionActive } from "@/lib/subscriptionMatcher";

export type Membership = { premium: boolean; detail: string } | null;
export function useDashboardMembership(userId?: string): Membership {
  const { unlimited, loading, noPackagePreview } = useUnlimitedAccess();
  const query = useQuery({
    queryKey: ["dashboard-membership", userId],
    enabled: !!userId && !noPackagePreview,
    queryFn: async () => {
      const {data,error}=await supabase.from("subscriptions").select("plan,status,starts_at,ends_at").eq("teacher_id",userId!).eq("status","active");
      if(error) throw error;
      return data || [];
    },
    refetchOnMount: "always",
    refetchInterval: 60000,
  });
  if(!userId || loading) return null;
  if(noPackagePreview) return {premium:false,detail:"ফ্রি প্ল্যান"};
  if(unlimited) return {premium:true,detail:"প্রশাসনিক পূর্ণ অ্যাক্সেস"};
  // Never show an upgrade prompt while ownership is unknown or a request failed.
  if(query.isPending || query.isError) return null;
  const active=(query.data || []).filter(s=>isSubscriptionActive(s));
  return active.length ? {premium:true,detail:`${active.length.toLocaleString("bn-BD")}টি সক্রিয় প্যাকেজ · ${active.map(s=>`${s.plan}${s.ends_at?` — মেয়াদ ${new Date(s.ends_at).toLocaleDateString("bn-BD",{timeZone:"Asia/Dhaka"})}`:""}`).join(", ")}`} : {premium:false,detail:"ফ্রি প্ল্যান"};
}

export function MembershipBadge({membership}:{membership:Membership}) {
  if(!membership) return null;
  return <Link to="/dashboard/subscription" title={membership.detail} aria-label={`${membership.premium?"Premium":"Free"} — ${membership.detail}`}
    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${membership.premium?"border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-900 hover:border-amber-300":"border-slate-200 bg-slate-50 text-slate-600 hover:bg-teal-50"}`}>
    {membership.premium?<Crown className="h-3.5 w-3.5 text-amber-600" />:<span className="h-1.5 w-1.5 rounded-full bg-slate-400" />}
    {membership.premium?"Premium":"Free"}
  </Link>;
}

export function FreeUpgradeCard({membership,userId,pathname}:{membership:Membership;userId:string;pathname:string}) {
  const key=`dashboard-upgrade-dismissed:${userId}`;
  const [dismissed,setDismissed]=useState(()=>sessionStorage.getItem(key)==="1");
  if(!membership || membership.premium || dismissed || ["/dashboard/subscription","/dashboard/view-paper","/dashboard/smartboard"].some(p=>pathname.startsWith(p)))return null;
  return <div className="mt-5 sm:mt-0 sm:h-24 print:hidden">
    <aside aria-label="ফ্রি প্ল্যান আপগ্রেড" className="relative mx-auto flex w-full max-w-sm items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-[#0A1E38] p-4 pr-8 text-white shadow-[0_12px_36px_-10px_#0a1e3866] animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none sm:fixed sm:bottom-5 sm:right-5 sm:z-40 sm:mx-0">
      <div aria-hidden="true" className="pointer-events-none absolute -left-8 -top-12 h-32 w-32 rounded-full bg-[#00B4BC]/15 blur-2xl" />
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#00B4BC]/20 bg-[#00B4BC]/10"><Sparkles className="h-5 w-5 text-[#35d8df]" /></span>
      <div className="relative min-w-0 flex-1"><p className="mb-1 text-[10px] font-semibold tracking-wide text-[#6edfe4]">ফ্রি প্ল্যান</p><h2 className="text-sm font-semibold leading-snug">প্রশ্নল্যাব Premium নিন</h2><p className="mt-1 text-xs leading-relaxed text-slate-300">পছন্দের বিষয় আনলক করুন।</p></div>
      <Link to="/dashboard/subscription" aria-label="প্যাকেজ দেখুন" className="relative inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#0A1E38] transition-colors hover:bg-[#dffbfc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B4BC]">আপগ্রেড<ArrowUpRight className="h-3.5 w-3.5" /></Link>
      <button type="button" aria-label="আপগ্রেড কার্ড লুকান" onClick={()=>{sessionStorage.setItem(key,"1");setDismissed(true);}} className="absolute right-1.5 top-1.5 rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B4BC]"><X className="h-3 w-3" /></button>
    </aside>
  </div>;
}
