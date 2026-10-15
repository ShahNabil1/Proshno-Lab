import { useAuth } from "@/contexts/AuthContext";
import { isBusinessOwner } from "@/lib/ownerAccess";
import { useEffect, useState } from "react";
import MarketingOverview from "@/components/admin/MarketingOverview";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Users, FileText, BookOpen, Layers, CreditCard, TrendingUp, CalendarDays, Activity } from "lucide-react";

interface Stats {
  teachers: number;
  questions: number;
  classes: number;
  subjects: number;
  activeSubscriptions: number;
  todayQuestions: number;
  todayTeachers: number;
  monthQuestions: number;
  monthTeachers: number;
  monthPurchases: number;
}

export default function AdminHome() {
  const { user } = useAuth();
  const isOwner = isBusinessOwner(user);
  const [stats, setStats] = useState<Stats>({
    teachers: 0, questions: 0, classes: 0, subjects: 0,
    activeSubscriptions: 0, todayQuestions: 0, todayTeachers: 0,
    monthQuestions: 0, monthTeachers: 0, monthPurchases: 0,
  });

  useEffect(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // A large unfiltered exact count can time out once the questions table grows.
    // Use PostgreSQL's fast estimate for the overview total; filtered activity
    // counts remain exact because their date range keeps those queries small.
    const countQuestions = async (createdSince?: string) => {
      let query = supabase.from("questions").select("id", { count: createdSince ? "exact" : "estimated", head: true });
      if (createdSince) query = query.gte("created_at", createdSince);
      const { count, error } = await query;
      if (error) {
        console.error("Question count failed", { code: error.code, message: error.message });
        return 0;
      }
      return count || 0;
    };

    Promise.all([
      supabase.from("teachers").select("id", { count: "exact", head: true }),
      countQuestions(),
      supabase.from("classes").select("id", { count: "exact", head: true }),
      supabase.from("subjects").select("id", { count: "exact", head: true }),
      isOwner ? supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active")
        .or(`starts_at.is.null,starts_at.lte.${now.toISOString()}`)
        .or(`ends_at.is.null,ends_at.gt.${now.toISOString()}`) : Promise.resolve({ count: 0 }),
      countQuestions(todayStart),
      supabase.from("teachers").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
      countQuestions(monthStart),
      supabase.from("teachers").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
      isOwner ? supabase.from("bkash_payments").select("id", { count: "exact", head: true }).eq("status", "completed").eq("environment", "live").or("coupon_code.is.null,coupon_code.not.ilike.PLTEST%").gte("created_at", monthStart) : Promise.resolve({ count: 0 }),
    ]).then(([t, q, c, s, as, tq, tt, mq, mt, mp]) => {
      setStats({
        teachers: t.count || 0, questions: q, classes: c.count || 0, subjects: s.count || 0,
        activeSubscriptions: as.count || 0,
        todayQuestions: tq, todayTeachers: tt.count || 0,
        monthQuestions: mq, monthTeachers: mt.count || 0, monthPurchases: mp.count || 0,
      });
    }).catch((error) => console.error("Admin dashboard statistics failed to load", error));
  }, [isOwner]);

  const overviewCards = [
    { label: "শিক্ষক", value: stats.teachers, icon: Users, color: "text-[#0A1E38]" },
    { label: "প্রশ্ন", value: stats.questions, icon: FileText, color: "text-primary" },
    { label: "শ্রেণী", value: stats.classes, icon: BookOpen, color: "text-[#0A1E38]" },
    { label: "বিষয়", value: stats.subjects, icon: Layers, color: "text-[#0A1E38]" },
  ];

  return (
    <div className="space-y-8">
      {isOwner && <MarketingOverview />}
      <h2 className="font-heading text-xl font-bold">একাডেমিক ও প্ল্যাটফর্ম ওভারভিউ</h2>

      {/* Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {overviewCards.map((c) => (
          <Card key={c.label} className="border-slate-200 shadow-none">
            <CardContent className="p-5 flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm">{c.label}</p>
                <p className={`text-3xl font-heading font-bold mt-1 ${c.color}`}>{c.value}</p>
              </div>
              <c.icon className={`w-5 h-5 text-[#00858C] mt-1`} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Subscriptions */}
      {isOwner && <Card className="border-[#0A1E38] bg-[#0A1E38] text-white">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-[#00B4BC]/15">
            <CreditCard className="w-6 h-6 text-[#00B4BC]" />
          </div>
          <div>
            <p className="text-sm text-white/70">বর্তমানে সক্রিয় সাবস্ক্রিপশন</p>
            <p className="text-4xl font-heading font-bold text-white">{stats.activeSubscriptions}</p>
          </div>
        </CardContent>
      </Card>}

      {/* Daily & Monthly Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today */}
        <Card className="border-slate-200 shadow-none">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="w-4 h-4" />
              <h3 className="font-heading font-semibold text-base">আজকের অ্যাক্টিভিটি</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">নতুন প্রশ্ন</p>
                <p className="text-2xl font-heading font-bold text-primary">{stats.todayQuestions}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">নতুন শিক্ষক</p>
                <p className="text-2xl font-heading font-bold text-[#0A1E38]">{stats.todayTeachers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* This Month */}
        <Card className="border-slate-200 shadow-none">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Activity className="w-4 h-4" />
              <h3 className="font-heading font-semibold text-base">এই মাসের অ্যাক্টিভিটি</h3>
            </div>
            <div className={`grid ${isOwner ? "grid-cols-3" : "grid-cols-2"} gap-3`}>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">প্রশ্ন</p>
                <p className="text-2xl font-heading font-bold text-primary">{stats.monthQuestions}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">শিক্ষক</p>
                <p className="text-2xl font-heading font-bold text-[#0A1E38]">{stats.monthTeachers}</p>
              </div>
              {isOwner && <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">পারচেজ</p>
                <p className="text-2xl font-heading font-bold text-[#0A1E38]">{stats.monthPurchases}</p>
              </div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
