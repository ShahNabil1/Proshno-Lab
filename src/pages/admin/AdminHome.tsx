import { useEffect, useState } from "react";
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
  const [stats, setStats] = useState<Stats>({
    teachers: 0, questions: 0, classes: 0, subjects: 0,
    activeSubscriptions: 0, todayQuestions: 0, todayTeachers: 0,
    monthQuestions: 0, monthTeachers: 0, monthPurchases: 0,
  });

  useEffect(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    Promise.all([
      supabase.from("teachers").select("id", { count: "exact", head: true }),
      supabase.from("questions").select("id", { count: "exact", head: true }),
      supabase.from("classes").select("id", { count: "exact", head: true }),
      supabase.from("subjects").select("id", { count: "exact", head: true }),
      supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("questions").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
      supabase.from("teachers").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
      supabase.from("questions").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
      supabase.from("teachers").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
      supabase.from("purchase_requests").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
    ]).then(([t, q, c, s, as, tq, tt, mq, mt, mp]) => {
      setStats({
        teachers: t.count || 0, questions: q.count || 0, classes: c.count || 0, subjects: s.count || 0,
        activeSubscriptions: as.count || 0,
        todayQuestions: tq.count || 0, todayTeachers: tt.count || 0,
        monthQuestions: mq.count || 0, monthTeachers: mt.count || 0, monthPurchases: mp.count || 0,
      });
    });
  }, []);

  const overviewCards = [
    { label: "শিক্ষক", value: stats.teachers, icon: Users, color: "text-blue-600" },
    { label: "প্রশ্ন", value: stats.questions, icon: FileText, color: "text-primary" },
    { label: "শ্রেণী", value: stats.classes, icon: BookOpen, color: "text-amber-600" },
    { label: "বিষয়", value: stats.subjects, icon: Layers, color: "text-violet-600" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="font-heading text-2xl font-bold">Admin Dashboard</h1>

      {/* Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {overviewCards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-5 flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm">{c.label}</p>
                <p className={`text-3xl font-heading font-bold mt-1 ${c.color}`}>{c.value}</p>
              </div>
              <c.icon className={`w-5 h-5 ${c.color} opacity-60 mt-1`} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Subscriptions */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="p-3 rounded-full bg-primary/10">
            <CreditCard className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">রিয়েল-টাইম একটিভ সাবস্ক্রিপশন</p>
            <p className="text-4xl font-heading font-bold text-primary">{stats.activeSubscriptions}</p>
          </div>
        </CardContent>
      </Card>

      {/* Daily & Monthly Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today */}
        <Card>
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
                <p className="text-2xl font-heading font-bold text-blue-600">{stats.todayTeachers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* This Month */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Activity className="w-4 h-4" />
              <h3 className="font-heading font-semibold text-base">এই মাসের অ্যাক্টিভিটি</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">প্রশ্ন</p>
                <p className="text-2xl font-heading font-bold text-primary">{stats.monthQuestions}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">শিক্ষক</p>
                <p className="text-2xl font-heading font-bold text-blue-600">{stats.monthTeachers}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">পারচেজ</p>
                <p className="text-2xl font-heading font-bold text-amber-600">{stats.monthPurchases}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
