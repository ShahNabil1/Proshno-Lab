import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, PlusSquare, Tv, Database, CheckCircle2, CreditCard, ArrowRight, Pencil, Printer, MessageSquare, Megaphone, BadgeCheck } from "lucide-react";
import LatexRenderer from "@/components/LatexRenderer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { readLocalGeneratedStats } from "@/lib/paperCounter";
import { isSubscriptionActive } from "@/lib/subscriptionMatcher";
import { brandMarkUrl } from "@/lib/brandAssets";

const toBanglaNum = (n: number | string): string =>
  String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);


const formatDateBangla = (iso: string): string => {
  try {
    const d = new Date(iso);
    const day = toBanglaNum(d.getDate());
    const months = [
      "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
      "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"
    ];
    const month = months[d.getMonth()];
    const year = toBanglaNum(d.getFullYear());
    return `${day} ${month}, ${year}`;
  } catch {
    return "";
  }
};

interface SavedPaper {
  meta?: { purchaseMode?: string } | null;
  id: string;
  institution_name?: string | null;
  exam_name?: string | null;
  class_name?: string | null;
  subject_name?: string | null;
  chapter_names?: string[] | null;
  question_ids?: number[] | null;
  created_at: string;
}

export default function DashboardHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalQuestions: 0, totalSets: 0 });
  const [recentPapers, setRecentPapers] = useState<SavedPaper[]>([]);
  const [recentQuestions, setRecentQuestions] = useState<any[]>([]);
  const [institute, setInstitute] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Generated paper stats — running counters on the teacher row
    type PaperCounters = { generated_sets: number | null; generated_questions: number | null };
    (supabase as any)
      .from("teachers")
      .select("generated_sets, generated_questions")
      .eq("id", user.id)
      .maybeSingle()
      .then(async ({ data, error }: { data: PaperCounters | null; error: unknown }) => {
        if (!error && data && ((data.generated_sets ?? 0) > 0 || (data.generated_questions ?? 0) > 0)) {
          setStats({
            totalQuestions: Number(data.generated_questions) || 0,
            totalSets: Number(data.generated_sets) || 0,
          });
          return;
        }
        // Fallback: device-local mirror of the same totals
        const local = await readLocalGeneratedStats();
        if (local.sets > 0 || local.questions > 0) {
          setStats({ totalQuestions: local.questions, totalSets: local.sets });
          return;
        }
        // Fallback: papers saved in database
        supabase
          .from("saved_papers")
          .select("question_ids")
          .eq("teacher_id", user.id)
          .then(({ data: papers }) => {
            const sets = (papers || []) as { question_ids: number[] | null }[];
            setStats({
              totalQuestions: sets.reduce((sum, s) => sum + (s.question_ids?.length || 0), 0),
              totalSets: sets.length,
            });
          });
      });

    // Recent saved papers
    supabase
      .from("saved_papers")
      .select("id, institution_name, exam_name, class_name, subject_name, chapter_names, question_ids, created_at, meta")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false })
      .limit(4)
      .then(async ({ data }) => {
        const { data: payments } = await supabase.from("bkash_payments").select("selected_packages").eq("user_id", user.id).eq("status", "completed");
        const orders = (payments || []).flatMap(payment => Array.isArray(payment.selected_packages) ? payment.selected_packages : []).filter((order: any) => order?.kind === "payg");
        setRecentPapers(((data as SavedPaper[]) || []).map(paper => {
          const ids = new Set(paper.question_ids || []);
          const paid = orders.some((order: any) => order.question_ids?.length === ids.size && order.question_ids.every((id: number) => ids.has(id)));
          return paid ? { ...paper, meta: { ...paper.meta, purchaseMode: "payg" } } : paper;
        }));
      });

    // Recent questions fallback
    supabase
      .from("questions")
      .select("id, question, type, class_id, classes(name), subjects(name), chapters(name)")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data }) => setRecentQuestions(data || []));

    // Institute from Supabase
    supabase
      .from("institutes")
      .select("*")
      .eq("owner_id", user.id)
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error("Institute lookup failed:", error);
          return;
        }
        setInstitute(data);
      });

    // Subscription from Supabase
    supabase
      .from("subscriptions")
      .select("*")
      .eq("teacher_id", user.id)
      .order("ends_at", { ascending: false, nullsFirst: false })
      .limit(20)
      .then(({ data }) => {
        const rows = data || [];
        setSubscription(
          rows.find((s) => isSubscriptionActive(s)) ??
          rows.find((s) => s.status === "active") ??
          rows[0] ??
          null
        );
      });

    // Announcements
    Promise.resolve(supabase
      .from("announcements")
      .select("id, text, priority, created_at")
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(3))
      .then(({ data }) => setAnnouncements(data || []))
      .finally(() => setLoading(false));
  }, [user]);


  const isSubActive =
    subscription?.status === "active" ||
    (subscription && isSubscriptionActive(subscription));

  const shortcuts = [
    { to: "/dashboard/smartboard", label: "স্মার্টবোর্ড", icon: Tv },
    { to: "/dashboard/packages", label: "প্রশ্নব্যাংক", icon: Database },
    { to: "/dashboard/omr-create", label: "OMR তৈরি", icon: Printer },
    { to: "/dashboard/omr-evaluation", label: "OMR মূল্যায়ন", icon: CheckCircle2 },
    { to: "/dashboard/my-questions", label: "আমার তৈরি প্রশ্ন", icon: FileText },
  ];
  const focusStyle = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A1E38] focus-visible:ring-offset-2";

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-6 text-zinc-950">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#0A1E38] p-5 text-white sm:p-6">
        <div className="flex min-w-0 items-center gap-3">
          <img src={institute?.logo_url || brandMarkUrl} alt="প্রতিষ্ঠানের লোগো" className="h-14 w-14 shrink-0 rounded-full border border-white/20 bg-white object-cover ring-4 ring-white/10" />
          <div className="min-w-0">

            <h1 className="flex items-center gap-2 font-heading text-xl font-bold sm:text-2xl"><span>{institute?.name || "আমার ড্যাশবোর্ড"}</span>{institute?.name && <BadgeCheck className="h-6 w-6 shrink-0 fill-[#1877F2] text-white" strokeWidth={2.5} aria-label="ভেরিফাইড" />}</h1>
            <p className="mt-1 text-xs text-white/65">{[institute?.upazila, institute?.district].filter(Boolean).join(", ")}</p>
          </div>
        </div>
        <Link to="/dashboard/institute" className={`rounded-lg border border-white/25 bg-white/5 px-4 py-2 text-sm text-white transition-colors hover:bg-white/15 ${focusStyle}`}>প্রতিষ্ঠান সেটিংস</Link>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "মোট তৈরি প্রশ্ন", value: toBanglaNum(stats.totalQuestions), icon: FileText },
          { label: "তৈরি প্রশ্নসেট", value: toBanglaNum(stats.totalSets), icon: Database },
          { label: "সাম্প্রতিক প্রশ্নপত্র", value: toBanglaNum(recentPapers.length), icon: Printer },
          { label: "সাবস্ক্রিপশন", value: subscription ? (isSubActive ? "সক্রিয়" : "মেয়াদ শেষ") : "ফ্রি", icon: CreditCard, to: "/dashboard/subscription" },
        ].map(({ label, value, icon: Icon, to }) => (
          <div key={label} className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 text-zinc-500"><span className="text-xs sm:text-sm">{label}</span><Icon className="h-4 w-4" /></div>
            <div className="mt-3 flex items-center justify-between gap-2"><span className={`font-heading font-bold ${label === "সাবস্ক্রিপশন" ? "text-xl" : "text-3xl"}`}>{loading ? "—" : value}</span>{to && <Link to={to} aria-label="সাবস্ক্রিপশন দেখুন" className={`rounded p-1 hover:bg-zinc-100 ${focusStyle}`}><ArrowRight className="h-4 w-4" /></Link>}</div>
          </div>
        ))}
      </div>

      <Link to="/dashboard/create" className={`group flex flex-col justify-between gap-5 rounded-xl border border-[#0A1E38]/20 bg-[#f3f6fa] p-5 transition-colors hover:bg-[#e8eef5] sm:flex-row sm:items-center sm:p-6 ${focusStyle}`}>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#00B4BC]/15 text-[#0A1E38]"><PlusSquare className="h-7 w-7" /></div>
          <div><h2 className="font-heading text-xl font-bold sm:text-2xl">১ ক্লিকে প্রশ্ন তৈরি</h2><p className="mt-1 text-sm text-zinc-600">শ্রেণি, বিষয় ও অধ্যায় বেছে প্রশ্নপত্র তৈরি করুন</p></div>
        </div>
        <span className="inline-flex items-center justify-center gap-3 rounded-lg bg-[#0A1E38] px-5 py-3 text-sm font-semibold text-white">শুরু করুন <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
      </Link>

      <section aria-label="দ্রুত অ্যাক্সেস" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {shortcuts.map(({ to, label, icon: Icon }) => <Link key={to} to={to} className={`group flex flex-col items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-5 transition-colors hover:border-[#0A1E38]/40 hover:bg-[#f3f6fa] ${focusStyle}`}><span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-50 group-hover:bg-[#0A1E38]/10"><Icon className="h-6 w-6" strokeWidth={1.5} /></span><span className="text-sm font-medium">{label}</span></Link>)}
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4"><h2 className="font-heading text-lg font-bold">সর্বশেষ তৈরি প্রশ্নপত্র</h2><Link to="/dashboard/my-questions" className={`inline-flex items-center gap-2 rounded text-xs text-zinc-600 hover:text-black ${focusStyle}`}>সবগুলো দেখুন <ArrowRight className="h-3.5 w-3.5" /></Link></div>
        {loading ? <p className="p-8 text-center text-sm text-zinc-500">লোড হচ্ছে...</p> : recentPapers.length ? <div className="divide-y divide-zinc-100">{recentPapers.map(paper => <div key={paper.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-zinc-50">
          <Link to={`/dashboard/view-paper?paper_id=${paper.id}`} className={`flex min-w-0 flex-1 items-center gap-3 rounded ${focusStyle}`}><span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-50 sm:flex"><FileText className="h-5 w-5 text-zinc-500" /></span><div className="min-w-0"><h3 className="truncate text-sm font-semibold">{paper.exam_name || "প্রশ্নপত্র"}</h3><p className="mt-1 truncate text-xs text-zinc-500">{paper.class_name} · {paper.subject_name} · {toBanglaNum(paper.question_ids?.length || 0)}টি প্রশ্ন</p>{paper.chapter_names?.filter(Boolean).length ? <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-zinc-500" title={paper.chapter_names.filter(Boolean).join(", ")}>{paper.chapter_names.filter(Boolean).join(", ")}</p> : null}</div></Link>
          <div className="flex items-center gap-3"><span className="hidden text-xs text-zinc-400 md:block">{formatDateBangla(paper.created_at)}</span><Link to={`/dashboard/view-paper?paper_id=${paper.id}&action=print`} aria-label={`${paper.exam_name || "প্রশ্নপত্র"} দেখুন ও প্রিন্ট করুন`} className={`rounded-lg border border-zinc-200 p-2 hover:border-[#0A1E38]/40 ${focusStyle}`}><Printer className="h-4 w-4" /></Link>{paper.meta?.purchaseMode === "payg" ? <button disabled aria-label="Edit unavailable for Pay as you go" title="Pay as you go papers cannot be edited" className="rounded-lg border border-zinc-200 p-2 text-zinc-300 cursor-not-allowed"><Pencil className="h-4 w-4" /></button> : <Link to={`/dashboard/view-paper?paper_id=${paper.id}&action=edit`} aria-label="Edit question paper" title="Edit question paper" className={`rounded-lg border border-zinc-200 p-2 hover:border-[#0A1E38]/40 ${focusStyle}`}><Pencil className="h-4 w-4" /></Link>}<Link to={`/dashboard/smartboard?paper_id=${paper.id}`} aria-label={`${paper.exam_name || "প্রশ্নপত্র"} স্মার্টবোর্ডে দেখুন`} className={`rounded-lg border border-zinc-200 p-2 hover:border-[#0A1E38]/40 ${focusStyle}`}><Tv className="h-4 w-4" /></Link></div>
        </div>)}</div> : recentQuestions.length ? <div className="divide-y divide-zinc-100">{recentQuestions.map(q => <Link key={q.id} to="/dashboard/my-questions" className={`block px-5 py-4 hover:bg-zinc-50 ${focusStyle}`}><div className="line-clamp-1 text-sm"><LatexRenderer text={q.question} /></div><p className="mt-1 text-xs text-zinc-500">{[q.classes?.name, q.subjects?.name, q.chapters?.name].filter(Boolean).join(" \u00b7 ")}</p></Link>)}</div> : <div className="p-8 text-center"><p className="text-sm text-zinc-500">এখনও কোনো প্রশ্নপত্র তৈরি হয়নি</p><Link to="/dashboard/create" className={`mt-3 inline-block rounded text-sm font-semibold underline underline-offset-4 ${focusStyle}`}>প্রথম প্রশ্নপত্র তৈরি করুন</Link></div>}
      </section>

      {announcements.length > 0 && <section className="rounded-xl border border-zinc-200 p-5"><h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Megaphone className="h-4 w-4" />সর্বশেষ আপডেট</h2><div className="space-y-2">{announcements.map(a => <p key={a.id} className="text-sm text-zinc-600">{a.text}</p>)}</div></section>}
      <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500"><span>প্রশ্ন<span className="text-zinc-950">ল্যাব</span> · শিক্ষক পোর্টাল</span><div className="flex items-center gap-5"><Link to="/dashboard/contact" className={`rounded hover:text-black ${focusStyle}`}>সহায়তা</Link><Link to="/dashboard/feedback" className={`inline-flex items-center gap-1 rounded hover:text-black ${focusStyle}`}><MessageSquare className="h-3.5 w-3.5" />মতামত</Link></div></footer>
    </div>
  );
}
