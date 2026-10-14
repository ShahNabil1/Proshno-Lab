import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Banknote, CheckCircle2, ExternalLink, RefreshCw, Users, Target, ShoppingBag, Eye, MousePointerClick, AlertCircle } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MetaCapiStatus from "./MetaCapiStatus";

interface Overview {
  from: string; to: string; generated_at: string; days: number;
  revenue: number; previous_revenue: number; purchases: number; buyers: number;
  signups: number; previous_signups: number; page_views: number; pricing_views: number;
  checkouts: number; contacts: number; active_users: number; pending_payments: number; failed_payments: number;
  leads_sent: number; leads_pending: number; leads_failed: number; active_subscriptions: number;
  daily: { day: string; revenue: number; signups: number }[];
  sources: { source: string; views: number }[]; pages: { path: string; views: number }[];
}
const number = (n: number) => n.toLocaleString("bn-BD", { maximumFractionDigits: 0 });
const money = (n: number) => `৳${n.toLocaleString("bn-BD", { maximumFractionDigits: 2 })}`;
const change = (current: number, previous: number) => previous > 0
  ? `${current >= previous ? "+" : ""}${((current - previous) / previous * 100).toLocaleString("bn-BD", { maximumFractionDigits: 1 })}% আগের সমান সময়ের তুলনায়`
  : "আগের সময়ে তুলনা করার মতো তথ্য নেই";
const date = (value: string) => new Date(value).toLocaleDateString("bn-BD", { timeZone: "Asia/Dhaka", day: "numeric", month: "short" });

export default function MarketingOverview() {
  const [days, setDays] = useState(7);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setData(null); setError(false);
    const rpc = supabase.rpc.bind(supabase) as unknown as (name: string, args: { period_days: number }) => PromiseLike<{ data: unknown; error: unknown }>;
    void Promise.resolve(rpc("admin_marketing_overview", { period_days: days })).then(result => {
      if (cancelled) return;
      if (result.error || !result.data) setError(true);
      else setData(result.data as Overview);
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [days, revision]);
  const cards = data ? [
    { label: "সফল বিক্রি", value: money(data.revenue), detail: change(data.revenue, data.previous_revenue), icon: Banknote },
    { label: "নতুন confirmed signup", value: number(data.signups), detail: change(data.signups, data.previous_signups), icon: Users },
    { label: "সফল purchase", value: number(data.purchases), detail: `${number(data.buyers)} জন ক্রেতা · গড় অর্ডার ${money(data.purchases ? data.revenue / data.purchases : 0)}`, icon: ShoppingBag },
    { label: "Meta-তে Lead পৌঁছেছে", value: number(data.leads_sent), detail: `${number(data.leads_pending)} অপেক্ষমাণ · ${number(data.leads_failed)} যাচাই প্রয়োজন`, icon: Target },
  ] : [];
  return <section className="space-y-5" aria-label="Marketing overview">
    <div className="overflow-hidden rounded-2xl bg-[#0A1E38] px-5 py-6 text-white sm:px-7">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div><p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-[#64E1E4]">Proshno Lab · Growth overview</p>
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">আজকের তথ্য, পরের সিদ্ধান্ত</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">Signup, checkout ও বিক্রি—আপনার ব্যবসার অগ্রগতি এক জায়গায়।</p>
        </div>
        <Button asChild className="bg-[#00B4BC] text-[#0A1E38] hover:bg-[#64E1E4]"><Link to="/admin/analytics">বিস্তারিত এনালিটিক্স <ArrowUpRight className="ml-2 h-4 w-4" /></Link></Button>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-4">
        <div className="flex gap-1 rounded-xl bg-white/10 p-1" aria-label="রিপোর্টের সময়সীমা">
          {[{ days: 1, label: "আজ" }, { days: 7, label: "৭ দিন" }, { days: 30, label: "৩০ দিন" }].map(item => <button type="button" key={item.days} aria-pressed={days === item.days} onClick={() => setDays(item.days)} className={`rounded-lg px-4 py-2 text-sm transition-colors ${days === item.days ? "bg-white font-semibold text-[#0A1E38]" : "text-slate-200 hover:bg-white/10"}`}>{item.label}</button>)}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-300"><span>{data ? `${date(data.from)} – ${date(new Date(new Date(data.to).getTime() - 1).toISOString())} · ঢাকা সময়` : "ঢাকা সময় অনুযায়ী"}</span>
          <Button aria-label="Marketing report রিফ্রেশ" size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/15 hover:text-white" onClick={() => setRevision(v => v + 1)}><RefreshCw className={`h-4 w-4 ${!data && !error ? "animate-spin" : ""}`} /></Button>
        </div>
      </div>
    </div>
    {error ? <Card><CardContent className="flex flex-wrap items-center gap-3 p-5"><AlertCircle className="h-5 w-5 text-amber-600" /><p role="alert" className="flex-1 text-sm">Marketing report লোড হয়নি। আবার চেষ্টা করুন।</p><Button variant="outline" onClick={() => setRevision(v => v + 1)}>আবার চেষ্টা করুন</Button></CardContent></Card> : !data ? <div role="status" aria-label="Marketing report লোড হচ্ছে" className="grid grid-cols-2 gap-4 xl:grid-cols-4">{[1,2,3,4].map(n => <div key={n} className="h-36 animate-pulse rounded-xl border bg-muted/40" />)}</div> : <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(card => <Card key={card.label} className="border-slate-200 shadow-none"><CardContent className="p-5"><div className="mb-4 flex items-center justify-between"><p className="text-sm text-muted-foreground">{card.label}</p><div className="rounded-lg bg-[#00B4BC]/10 p-2"><card.icon className="h-4 w-4 text-[#00858C]" /></div></div><p className="text-3xl font-bold tracking-tight text-[#0A1E38]">{card.value}</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{card.detail}</p></CardContent></Card>)}</div>
      <p className="text-xs leading-relaxed text-muted-foreground">বিক্রি পেমেন্ট শুরুর তারিখ অনুযায়ী; PLTEST test payment বাদ। Meta delivery সংখ্যা বিজ্ঞাপনের attributed lead নয়।</p>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card className="shadow-none"><CardHeader><CardTitle className="text-base">দিনভিত্তিক বিক্রি</CardTitle><p className="text-xs text-muted-foreground">সফল live payment · BDT</p></CardHeader><CardContent><div className="relative h-60" role="img" aria-label={`নির্বাচিত সময়ে মোট বিক্রি ${money(data.revenue)}`}><ResponsiveContainer width="100%" height="100%"><BarChart data={data.daily} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="day" tickFormatter={v => date(`${v}T00:00:00+06:00`)} fontSize={11} tickLine={false} axisLine={false} minTickGap={20} /><YAxis fontSize={11} tickLine={false} axisLine={false} width={55} /><Tooltip labelFormatter={v => date(`${v}T00:00:00+06:00`)} formatter={(value: number) => [money(value), "বিক্রি"]} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} /><Bar dataKey="revenue" fill="#00858C" radius={[5,5,0,0]} maxBarSize={40} /></BarChart></ResponsiveContainer>{data.revenue === 0 && <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><p className="rounded-lg border bg-white/95 px-4 py-2 text-sm text-muted-foreground">এই সময়ে সফল বিক্রি নেই</p></div>}</div></CardContent></Card>
        <Card className="shadow-none"><CardHeader><CardTitle className="text-base">কেনাকাটার পথে কার্যক্রম</CardTitle><p className="text-xs text-muted-foreground">একজনের একাধিক activity থাকতে পারে।</p></CardHeader><CardContent className="space-y-3">{[
          { label: "সাইটে page view", value: data.page_views, icon: Eye },
          { label: "মূল্য তালিকা দেখা", value: data.pricing_views, icon: MousePointerClick },
          { label: "Checkout শুরু", value: data.checkouts, icon: ShoppingBag },
          { label: "সফল purchase", value: data.purchases, icon: CheckCircle2 },
        ].map(item => <div key={item.label} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#00858C]"><item.icon className="h-4 w-4" /></span><span className="flex-1 text-sm">{item.label}</span><strong className="text-xl text-[#0A1E38]">{number(item.value)}</strong></div>)}<div className="flex flex-wrap justify-between gap-2 pt-2 text-xs text-muted-foreground"><span>সক্রিয় logged-in user: {number(data.active_users)}</span><span>Contact activity: {number(data.contacts)}</span></div></CardContent></Card>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="shadow-none"><CardHeader><CardTitle className="text-base">Traffic কোথা থেকে</CardTitle><p className="text-xs text-muted-foreground">Page view-এর referrer; campaign attribution নয়।</p></CardHeader><CardContent className="space-y-3">{data.sources.length ? data.sources.map(source => <div key={source.source} className="flex items-center justify-between gap-3 text-sm"><span className="truncate">{source.source}</span><strong>{number(source.views)}</strong></div>) : <p className="text-sm text-muted-foreground">এই সময়ে traffic data নেই।</p>}</CardContent></Card>
        <Card className="shadow-none"><CardHeader><CardTitle className="text-base">বেশি দেখা পেজ</CardTitle></CardHeader><CardContent className="space-y-3">{data.pages.length ? data.pages.map(page => <div key={page.path} className="flex items-center justify-between gap-3 text-sm"><span className="truncate" title={page.path}>{page.path || "/"}</span><strong>{number(page.views)}</strong></div>) : <p className="text-sm text-muted-foreground">এই সময়ে page view নেই।</p>}</CardContent></Card>
        <Card className="border-[#00858C]/25 bg-[#00858C]/5 shadow-none"><CardHeader><CardTitle className="text-base">পরের করণীয়</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
          <Link to="/admin/subscriptions" className="flex items-center justify-between rounded-lg bg-white p-3"><span>অপেক্ষমাণ payment <strong className="ml-1">{number(data.pending_payments)}</strong></span><ArrowUpRight className="h-4 w-4" /></Link>
          <p className="text-xs text-muted-foreground">ব্যর্থ / বাতিল payment: {number(data.failed_payments)} · সক্রিয় subscription: {number(data.active_subscriptions)}</p>
          <div className="flex flex-wrap gap-2"><Button asChild variant="outline" size="sm"><Link to="/admin/coupons">কুপন</Link></Button><Button asChild variant="outline" size="sm"><Link to="/admin/teachers">শিক্ষক</Link></Button><Button asChild variant="outline" size="sm"><Link to="/admin/packages">প্যাকেজ</Link></Button></div>
          <a className="inline-flex items-center gap-1 text-xs font-medium text-[#006970] underline underline-offset-4" href="https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1096546493321726" target="_blank" rel="noreferrer">Ads Manager-এ ad result দেখুন <ExternalLink className="h-3 w-3" /></a>
        </CardContent></Card>
      </div>
      <MetaCapiStatus />
      <p className="text-right text-xs text-muted-foreground">সর্বশেষ snapshot: {new Date(data.generated_at).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })}</p>
    </>}
  </section>;
}
