import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  PlusCircle,
  Package,
  Phone,
  Megaphone,
  Tv,
  Database,
  CheckCircle2,
  Building2,
  CreditCard,
  ArrowRight,
  Printer,
  Eye,
  BookOpen,
  Layers,
  ShieldCheck,
  Clock,
  ChevronRight,
  HelpCircle,
  MessageSquare,
  School,
  GraduationCap,
  PlusSquare
} from "lucide-react";
import WhatsAppIcon from "@/components/icons/WhatsAppIcon";
import LatexRenderer from "@/components/LatexRenderer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { readLocalGeneratedStats } from "@/lib/paperCounter";
import { isSubscriptionActive } from "@/lib/subscriptionMatcher";
import { brandMarkUrl } from "@/lib/brandAssets";

const toBanglaNum = (n: number | string): string =>
  String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);

const getBanglaGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "শুভ সকাল";
  if (hour >= 12 && hour < 16) return "শুভ দুপুর";
  if (hour >= 16 && hour < 18) return "শুভ বিকাল";
  return "শুভ সন্ধ্যা";
};

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
      .select("id, institution_name, exam_name, class_name, subject_name, chapter_names, question_ids, created_at")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false })
      .limit(4)
      .then(({ data }) => {
        setRecentPapers((data as SavedPaper[]) || []);
      });

    // Recent questions fallback
    supabase
      .from("questions")
      .select("id, question, type, class_id, classes(name), subjects(name)")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data }) => setRecentQuestions(data || []));

    // Institute from Supabase
    supabase
      .from("institutes")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle()
      .then(({ data }) => setInstitute(data));

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
    supabase
      .from("announcements")
      .select("id, text, priority, created_at")
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data }) => setAnnouncements(data || []))
      .finally(() => setLoading(false));
  }, [user]);

  const teacherName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    "সম্মানিত শিক্ষক";

  const isSubActive =
    subscription?.status === "active" ||
    (subscription && isSubscriptionActive(subscription));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* ========================================================
          1. HERO BANNER: Executive Teacher Welcome & Quick Launcher
          Brand Colors: Deep Navy #0A1E38 + Luxurious Gold #F4C053
         ======================================================== */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#07162b] via-[#0A1E38] to-[#122b4d] border border-[#F4C053]/35 shadow-xl text-white p-6 sm:p-8 md:p-10">
        {/* Ambient background glows */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-96 h-96 bg-[#F4C053]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-80 h-80 bg-[#153e77]/30 rounded-full blur-3xl pointer-events-none" />
        
        {/* Subtle geometric grid texture */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(244,192,83,0.08)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-60" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3.5 max-w-3xl">
            {/* Top Eyebrow Tag */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F4C053]/15 border border-[#F4C053]/30 text-amber-300 text-xs font-semibold tracking-wide backdrop-blur-md">
              <GraduationCap className="w-3.5 h-3.5 text-[#F4C053]" />
              <span>শিক্ষক ড্যাশবোর্ড কন্ট্রোল সেন্টার</span>
              <span className="text-[#F4C053]/40">•</span>
              <span className="text-white/80">প্রশ্নল্যাব v২.০</span>
            </div>

            {/* Main Greeting & Teacher Name */}
            <div>
              <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white leading-tight">
                {getBanglaGreeting()}, <span className="text-[#F4C053]">{teacherName}</span>!
              </h1>

              {/* Institute Name or Setup Prompt */}
              {institute?.name ? (
                <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-slate-200">
                  <div className="flex items-center gap-1.5 font-medium text-white/90">
                    <School className="w-4 h-4 text-[#F4C053]" />
                    <span>{institute.name}</span>
                  </div>
                  {(institute.upazila || institute.district) && (
                    <span className="text-slate-300/80 text-xs">
                      ({[institute.upazila, institute.district].filter(Boolean).join(", ")})
                    </span>
                  )}
                  <Link
                    to="/dashboard/institute"
                    className="inline-flex items-center text-xs text-amber-300 hover:text-amber-200 underline underline-offset-2 ml-1"
                  >
                    সেটিংস
                  </Link>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-slate-300">
                  <span className="text-amber-200/90">আপনার প্রতিষ্ঠানের তথ্য ও লোগো যুক্ত করুন</span>
                  <Link
                    to="/dashboard/institute"
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-400/20 text-amber-300 hover:bg-amber-400/30 text-xs font-medium border border-amber-400/30 transition-colors"
                  >
                    প্রতিষ্ঠান সেট করুন <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>

            {/* Quick Action Launcher Buttons inside the Hero */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link to="/dashboard/create">
                <Button
                  size="default"
                  className="bg-gradient-to-r from-[#F4C053] to-[#e6a827] hover:from-[#f7cb6d] hover:to-[#df9f1b] text-[#0A1E38] font-bold shadow-lg shadow-amber-500/20 border-0 gap-2 h-10 px-5 text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.99]"
                >
                  <PlusSquare className="w-4 h-4 text-[#0A1E38]" />
                  প্রশ্ন তৈরি করুন
                </Button>
              </Link>

              <Link to="/dashboard/smartboard">
                <Button
                  variant="outline"
                  size="default"
                  className="bg-white/10 hover:bg-white/20 text-white border-white/25 backdrop-blur-sm gap-2 h-10 px-4 text-sm font-medium hover:text-white"
                >
                  <Tv className="w-4 h-4 text-amber-300" />
                  স্মার্ট ডিজিটাল বোর্ড
                </Button>
              </Link>
            </div>
          </div>

          {/* Right side: Circular Brand Logo Lockup & Stats Badge */}
          <div className="hidden lg:flex flex-col items-center justify-center shrink-0 pl-6 border-l border-white/15">
            <div className="relative group">
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#F4C053] to-amber-200 blur-md opacity-40 group-hover:opacity-70 transition-opacity" />
              <img
                src={brandMarkUrl}
                alt="ProshnoLab"
                className="relative w-24 h-24 rounded-full object-cover ring-4 ring-[#F4C053]/60 shadow-2xl p-0.5 bg-[#07162b] transform transition-transform group-hover:scale-105"
              />
            </div>
            <div className="mt-3 text-center">
              <span className="inline-block px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs text-amber-200 font-medium shadow-sm">
                তৈরি: <strong className="text-white font-bold">{toBanglaNum(stats.totalQuestions)}</strong> টি প্রশ্ন
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          2. KEY METRICS: 4 Luxury Stat Cards
          Navy, Gold & Emerald balanced cards
         ======================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Stat 1: Total Generated Questions */}
        <Card className="border border-slate-200 shadow-sm hover:shadow-md hover:border-[#F4C053]/60 transition-all group bg-card">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">মোট তৈরি প্রশ্ন</span>
              <div className="w-9 h-9 rounded-lg bg-[#0A1E38]/8 group-hover:bg-[#0A1E38] text-[#0A1E38] group-hover:text-[#F4C053] flex items-center justify-center transition-colors">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2.5">
              <span className="text-2xl sm:text-3xl font-heading font-bold text-[#0A1E38]">
                {toBanglaNum(stats.totalQuestions)}
              </span>
              <span className="text-xs text-muted-foreground ml-1">টি</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 truncate">
              <span className="font-semibold text-foreground/80">{toBanglaNum(stats.totalSets)}</span> টি সংরক্ষিত প্রশ্নসেট
            </p>
          </CardContent>
        </Card>

        {/* Stat 2: Subscription Status */}
        <Card className="border border-slate-200 shadow-sm hover:shadow-md hover:border-[#F4C053]/60 transition-all group bg-card">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">সাবস্ক্রিপশন</span>
              <div className="w-9 h-9 rounded-lg bg-[#F4C053]/15 text-[#b38217] flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              {isSubActive ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 text-xs px-2.5 py-0.5">
                  সক্রিয় (Active)
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 border-amber-300">
                  ফ্রি ট্রায়াল
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between mt-1 text-xs">
              <span className="text-muted-foreground capitalize truncate">
                প্ল্যান: <strong className="text-foreground font-semibold">{subscription?.plan || "Free"}</strong>
              </span>
              <Link to="/dashboard/subscription" className="text-primary hover:text-[#0A1E38] font-medium inline-flex items-center">
                রিনিউ <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Stat 3: Institution Status */}
        <Card className="border border-slate-200 shadow-sm hover:shadow-md hover:border-[#F4C053]/60 transition-all group bg-card">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">প্রতিষ্ঠান ব্র্যান্ডিং</span>
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2.5">
              <p className="text-base sm:text-lg font-heading font-bold text-foreground truncate" title={institute?.name || "সংযুক্ত নেই"}>
                {institute?.name || "সংযুক্ত করা হয়নি"}
              </p>
            </div>
            <div className="flex items-center justify-between mt-1 text-xs">
              <span className="text-muted-foreground truncate">
                {institute?.name ? "হেডারে লোগো সক্রিয়" : "লোগো সেট করুন"}
              </span>
              <Link to="/dashboard/institute" className="text-primary hover:text-[#0A1E38] font-medium inline-flex items-center">
                সেটিংস <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Stat 4: Ready Question Bank */}
        <Card className="border border-slate-200 shadow-sm hover:shadow-md hover:border-[#F4C053]/60 transition-all group bg-card">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">স্মার্ট প্রশ্নভান্ডার</span>
              <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2.5">
              <span className="text-2xl sm:text-3xl font-heading font-bold text-[#0A1E38]">১০,০০০+</span>
              <span className="text-xs text-muted-foreground ml-1">প্রশ্ন</span>
            </div>
            <div className="flex items-center justify-between mt-1 text-xs">
              <span className="text-muted-foreground">৩য়–১২শ শ্রেণি</span>
              <Link to="/dashboard/packages" className="text-primary hover:text-[#0A1E38] font-medium inline-flex items-center">
                ব্রাউজ <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ========================================================
          3. PRIMARY WORKSPACES: 4 Dedicated Teacher Feature Hubs
          Interactive cards with logo accents
         ======================================================== */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <h2 className="font-heading text-lg sm:text-xl font-bold text-[#0A1E38] flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[#F4C053]" />
              শিক্ষক কর্মক্ষেত্র (Core Workspaces)
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              প্রশ্নপত্র তৈরি, ক্লাসরুম প্রেজেন্টেশন ও পরীক্ষার সার্বিক ব্যবস্থাপনা
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Hub 1: 1-Click Auto Generator */}
          <Link
            to="/dashboard/create"
            className="group relative flex flex-col justify-between p-5 rounded-xl border border-slate-200 bg-white hover:border-[#F4C053] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#F4C053] to-amber-500" />
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-[#F4C053]/15 text-[#0A1E38] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <PlusCircle className="w-6 h-6 text-[#0A1E38]" />
                </div>
                <Badge className="bg-[#F4C053]/20 text-[#0A1E38] border-[#F4C053]/40 text-[11px] font-semibold">
                  সর্বাধিক ব্যবহৃত
                </Badge>
              </div>
              <h3 className="font-heading font-bold text-base text-[#0A1E38] group-hover:text-primary transition-colors">
                ১ ক্লিকে প্রশ্ন তৈরি
              </h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                শ্রেণি, বিষয় ও অধ্যায় নির্বাচন করে চোখের পলকে নির্ভুল বোর্ড স্ট্যান্ডার্ড প্রশ্নপত্র ও উত্তরমালা বানান।
              </p>
              <div className="flex flex-wrap gap-1 mt-3">
                <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">MCQ</span>
                <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">সৃজনশীল (CQ)</span>
                <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">সংক্ষিপ্ত</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[#0A1E38] group-hover:text-primary">
              <span>প্রশ্ন জেনারেটর খুলুন</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Hub 2: Interactive SmartBoard */}
          <Link
            to="/dashboard/smartboard"
            className="group relative flex flex-col justify-between p-5 rounded-xl border border-slate-200 bg-white hover:border-[#0A1E38] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#0A1E38] to-[#253977]" />
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-[#0A1E38]/10 text-[#0A1E38] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Tv className="w-6 h-6 text-[#0A1E38]" />
                </div>
                <Badge className="bg-[#0A1E38]/10 text-[#0A1E38] border-[#0A1E38]/20 text-[11px] font-semibold">
                  ডিজিটাল ক্লাসরুম
                </Badge>
              </div>
              <h3 className="font-heading font-bold text-base text-[#0A1E38] group-hover:text-primary transition-colors">
                স্মার্ট ডিজিটাল বোর্ড
              </h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                প্রজেক্টর বা টাচ স্ক্রিনে প্রশ্ন প্রদর্শন, পেন টুল দিয়ে সরাসরি ক্লাসে ড্রয়িং ও বিস্তারিত উত্তর সমাধান।
              </p>
              <div className="flex flex-wrap gap-1 mt-3">
                <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">পেন ও মার্কার</span>
                <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">ফুল স্ক্রিন</span>
                <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">ব্যাখ্যা প্রদর্শন</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[#0A1E38] group-hover:text-primary">
              <span>স্মার্টবোর্ড শুরু করুন</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Hub 3: Ready Question Bank */}
          <Link
            to="/dashboard/packages"
            className="group relative flex flex-col justify-between p-5 rounded-xl border border-slate-200 bg-white hover:border-amber-400 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-[#F4C053]" />
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Database className="w-6 h-6" />
                </div>
                <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[11px] font-semibold">
                  রেডি প্রশ্নসেট
                </Badge>
              </div>
              <h3 className="font-heading font-bold text-base text-[#0A1E38] group-hover:text-primary transition-colors">
                রেডি প্রশ্নব্যাংক ও প্যাকেজ
              </h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                সেরা স্কুলের টেস্ট পেপার ও বোর্ডের আলোকে তৈরি রেডি প্রশ্নপত্র ও মডেল টেস্ট এক ক্লিকে ডাউনলোড ও প্রিন্ট নিন।
              </p>
              <div className="flex flex-wrap gap-1 mt-3">
                <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">অধ্যায়ভিত্তিক</span>
                <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">মডেল টেস্ট</span>
                <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">পরীক্ষার প্রশ্ন</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[#0A1E38] group-hover:text-primary">
              <span>প্রশ্নব্যাংক দেখুন</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Hub 4: OMR Suite */}
          <Link
            to="/dashboard/omr-create"
            className="group relative flex flex-col justify-between p-5 rounded-xl border border-slate-200 bg-white hover:border-emerald-500 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[11px] font-semibold">
                  অটো রেজাল্ট
                </Badge>
              </div>
              <h3 className="font-heading font-bold text-base text-[#0A1E38] group-hover:text-primary transition-colors">
                OMR তৈরি ও মূল্যায়ন
              </h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                পরীক্ষার জন্য ওএমআর শিট প্রিন্ট করুন এবং মোবাইল বা ক্যামেরায় স্ক্যান করে এক নিমিষেই রেজাল্ট ও র‍্যাংক শিট তৈরি করুন।
              </p>
              <div className="flex flex-wrap gap-1 mt-3">
                <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">OMR প্রিন্ট</span>
                <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">মোবাইল স্ক্যান</span>
                <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">মেধা তালিকা</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[#0A1E38] group-hover:text-primary">
              <span>ওএমআর শুরু করুন</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </div>

      {/* ========================================================
          4. RECENT QUESTION PAPERS / ARCHIVE
          Quick access to view, print, or edit saved papers
         ======================================================== */}
      <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/70 border-b border-slate-100 px-5 py-4 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#0A1E38] text-[#F4C053] flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="font-heading text-base sm:text-lg font-bold text-[#0A1E38]">
                সর্বশেষ তৈরি প্রশ্নপত্র ও আর্কাইভ
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                আপনার সংরক্ষিত প্রশ্নপত্রসমূহ সরাসরি দেখুন, প্রিন্ট করুন বা স্মার্টবোর্ডে চালান
              </p>
            </div>
          </div>
          <Link to="/dashboard/my-questions">
            <Button variant="outline" size="sm" className="text-xs gap-1 border-slate-200 hover:bg-slate-100">
              সবগুলো দেখুন ({toBanglaNum(recentPapers.length > 0 ? recentPapers.length : recentQuestions.length)})
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          {recentPapers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {recentPapers.map((paper) => (
                <div
                  key={paper.id}
                  className="flex flex-col justify-between p-4 rounded-xl border border-slate-200/90 hover:border-[#F4C053] hover:shadow-md transition-all bg-slate-50/40"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-heading font-bold text-sm text-[#0A1E38] truncate" title={paper.exam_name || "পরীক্ষার প্রশ্নপত্র"}>
                          {paper.exam_name || "পরীক্ষার প্রশ্নপত্র"}
                        </h4>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                          {paper.class_name && (
                            <Badge variant="secondary" className="text-[10px] px-2 py-0 bg-slate-200/70 text-slate-800">
                              {paper.class_name}
                            </Badge>
                          )}
                          {paper.subject_name && (
                            <span className="font-medium text-foreground/80">• {paper.subject_name}</span>
                          )}
                          {paper.question_ids && (
                            <span className="text-amber-700 font-medium">
                              ({toBanglaNum(paper.question_ids.length)}টি প্রশ্ন)
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {formatDateBangla(paper.created_at)}
                      </span>
                    </div>

                    {paper.chapter_names && paper.chapter_names.length > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-2 line-clamp-1">
                        অধ্যায়: {paper.chapter_names.join(", ")}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200/60">
                    <Link to={`/dashboard/view-paper?id=${paper.id}`} className="flex-1">
                      <Button
                        size="sm"
                        variant="default"
                        className="w-full bg-[#0A1E38] hover:bg-[#122e54] text-white gap-1.5 text-xs h-8"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#F4C053]" />
                        প্রশ্নপত্র ভিউ ও প্রিন্ট
                      </Button>
                    </Link>
                    <Link to={`/dashboard/smartboard?paper_id=${paper.id}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs h-8 border-slate-300 hover:bg-slate-100 text-slate-700"
                        title="স্মার্টবোর্ডে ওপেন করুন"
                      >
                        <Tv className="w-3.5 h-3.5 text-[#0A1E38]" />
                        বোর্ড
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : recentQuestions.length > 0 ? (
            <div className="space-y-2.5">
              {recentQuestions.map((q: any) => (
                <div
                  key={q.id}
                  className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-amber-300 transition-colors bg-slate-50/40"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#0A1E38]/5 text-[#0A1E38] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate text-foreground">
                        <LatexRenderer text={q.question || "প্রশ্ন"} inline />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {q.classes?.name} • {q.subjects?.name}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0 uppercase bg-slate-200">
                    {q.type}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 px-4">
              <div className="w-16 h-16 rounded-2xl bg-[#0A1E38]/5 text-[#0A1E38] flex items-center justify-center mx-auto mb-3">
                <FileText className="w-8 h-8 text-[#F4C053]" />
              </div>
              <h4 className="font-heading font-bold text-base text-foreground">
                এখনো কোনো প্রশ্নপত্র তৈরি বা সংরক্ষণ করা হয়নি
              </h4>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto mt-1">
                আপনার ক্লাসের জন্য মাত্র ১ ক্লিকে প্রথম বোর্ড-স্ট্যান্ডার্ড প্রশ্নপত্র তৈরি করুন!
              </p>
              <div className="mt-4">
                <Link to="/dashboard/create">
                  <Button className="bg-[#0A1E38] hover:bg-[#15345e] text-white gap-2 text-xs font-semibold">
                    <PlusCircle className="w-4 h-4 text-[#F4C053]" />
                    প্রথম প্রশ্নপত্র তৈরি করুন
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========================================================
          5. NOTICES, VIDEO GUIDE & 24/7 HELPLINE
          Two column balanced lower grid
         ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Notices & Announcements (Left 2 cols on desktop) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Announcements Card */}
          <Card className="border border-amber-200/80 bg-gradient-to-br from-amber-50/40 via-white to-amber-50/20 shadow-sm">
            <CardHeader className="pb-3 pt-4 px-5 border-b border-amber-100 flex flex-row items-center justify-between">
              <CardTitle className="font-heading text-base font-bold text-[#0A1E38] flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-[#F4C053] text-[#0A1E38] flex items-center justify-center shadow-sm">
                  <Megaphone className="w-4 h-4" />
                </div>
                অফিসিয়াল ঘোষণা ও আপডেট (Notices)
              </CardTitle>
              <Badge variant="outline" className="text-[11px] border-amber-300 text-amber-900 bg-amber-100/50">
                জরুরী নোটিশ
              </Badge>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              {announcements.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span>এই মুহূর্তে কোনো নতুন নোটিশ নেই। নিয়মিত আপডেটের জন্য চোখ রাখুন।</span>
                </div>
              ) : (
                <ul className="space-y-3">
                  {announcements.map((a) => (
                    <li
                      key={a.id}
                      className="p-3 rounded-lg bg-white border border-amber-200/60 shadow-xs flex items-start gap-3"
                    >
                      <span className="w-2 h-2 rounded-full bg-[#F4C053] mt-1.5 shrink-0" />
                      <div className="flex-1 text-sm text-foreground/90 leading-relaxed font-normal">
                        {a.text}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 24/7 Teacher Support & Helpline (Right 1 col on desktop) */}
        <Card className="border border-[#0A1E38]/20 bg-gradient-to-b from-[#0A1E38] to-[#07162b] text-white shadow-md flex flex-col justify-between">
          <CardHeader className="pb-3 pt-5 px-5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#F4C053] text-[#0A1E38] flex items-center justify-center font-bold shadow-sm">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="font-heading text-base font-bold text-white">
                  শিক্ষক সহায়তা কেন্দ্র
                </CardTitle>
                <p className="text-[11px] text-amber-300 font-medium">২৪/৭ সরাসরি সাপোর্ট</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              সম্মানিত শিক্ষক, প্রশ্নপত্র তৈরি, প্রিন্টিং বা সাবস্ক্রিপশন সংক্রান্ত যেকোনো সহায়তায় আমাদের টিম সরাসরি আপনার পাশে আছে।
            </p>

            <div className="space-y-2.5">
              {/* WhatsApp Button */}
              <Button
                className="w-full gap-2 bg-[#25D366] hover:bg-[#1eb957] text-white font-bold text-xs h-10 shadow-md border-0"
                asChild
              >
                <a
                  href="https://wa.me/8801758018668"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center"
                >
                  <WhatsAppIcon className="w-4 h-4" /> হোয়াটসঅ্যাপে তাৎক্ষণিক চ্যাট
                </a>
              </Button>

              {/* Direct Phone Call Button */}
              <Button
                variant="outline"
                className="w-full gap-2 bg-white/10 hover:bg-white/20 text-white hover:text-white border-white/20 font-medium text-xs h-10 backdrop-blur-sm"
                asChild
              >
                <a href="tel:+8801758018668" className="flex items-center justify-center">
                  <Phone className="w-3.5 h-3.5 text-amber-300" /> +880 1758-018668
                </a>
              </Button>
            </div>

            <div className="pt-3 border-t border-white/10 text-center">
              <p className="text-[11px] text-slate-300">
                আপনার কি কোনো মতামত বা পরামর্শ আছে?
              </p>
              <Link
                to="/dashboard/feedback"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#F4C053] hover:text-amber-200 mt-1 hover:underline underline-offset-2"
              >
                <MessageSquare className="w-3 h-3" /> মূল্যবান মতামত জানান
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
