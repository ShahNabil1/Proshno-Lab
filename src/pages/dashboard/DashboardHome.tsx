import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, PlusCircle, Package, Phone } from "lucide-react";
import WhatsAppIcon from "@/components/icons/WhatsAppIcon";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function DashboardHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalQuestions: 0 });
  const [recentQuestions, setRecentQuestions] = useState<any[]>([]);
  const [institute, setInstitute] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    if (!user) return;

    // Question count from Supabase
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("teacher_id", user.id)
      .then(({ count }) => setStats({ totalQuestions: count || 0 }));

    // Recent questions from Supabase
    supabase.from("questions").select("id, question, type, class_id, classes(name), subjects(name)")
      .eq("teacher_id", user.id).order("created_at", { ascending: false }).limit(3)
      .then(({ data }) => setRecentQuestions(data || []));

    // Institute from Supabase
    supabase.from("institutes").select("*").eq("owner_id", user.id).maybeSingle()
      .then(({ data }) => setInstitute(data));

    // Subscription from Supabase
    supabase.from("subscriptions").select("*").eq("teacher_id", user.id).maybeSingle()
      .then(({ data }) => setSubscription(data));
  }, [user]);

  return (
    <div className="space-y-6">
      {/* Institute Banner */}
      <div className="gradient-hero rounded-2xl p-8 text-center text-white">
        <h1 className="font-heading text-2xl font-bold">
          {institute?.name || "আপনার প্রতিষ্ঠান সেট করুন"}
        </h1>
        {institute?.upazila && (
          <p className="text-white/60 text-sm mt-1">{institute.upazila}, {institute.district}</p>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-muted-foreground text-sm">মোট প্রশ্ন তৈরী</p>
            <p className="text-3xl font-heading font-bold text-primary mt-1">{stats.totalQuestions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-muted-foreground text-sm">সাবস্ক্রিপশন</p>
            <p className="text-lg font-heading font-bold mt-1">
              {subscription?.status === "active" ? (
                <Badge className="gradient-green text-primary-foreground border-0">সক্রিয়</Badge>
              ) : (
                <Badge variant="secondary">নিষ্ক্রিয়</Badge>
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-muted-foreground text-sm">প্ল্যান</p>
            <p className="text-lg font-heading font-bold text-foreground mt-1 capitalize">
              {subscription?.plan || "Free"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-muted-foreground text-sm">প্রতিষ্ঠান</p>
            <p className="text-lg font-heading font-bold text-foreground mt-1 truncate">
              {institute?.name || "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions + Updates + Feedback */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-3">
              <Link to="/dashboard/create" className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:bg-muted transition-colors">
                <PlusCircle className="w-6 h-6 text-foreground" />
                <span className="text-xs font-medium text-center">১ ক্লিকে প্রশ্ন তৈরি</span>
              </Link>
              <Link to="/dashboard/packages" className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:bg-muted transition-colors">
                <Package className="w-6 h-6 text-foreground" />
                <span className="text-xs font-medium text-center">রেডি প্রশ্ন</span>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-accent/30 border-accent">
          <CardContent className="p-6">
            <h3 className="font-heading font-bold text-center mb-3">📱 Smart App</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              গুরুত্বপূর্ণ নির্দেশনা সবার আগে পেতে আমাদের মেসেঞ্জার ব্রডকাস্ট চ্যানেলে যুক্ত থাকুন।
            </p>
            <Button className="w-full mt-4 gradient-green text-primary-foreground border-0" size="sm">
              🔔 চ্যানেলে এখনই যুক্ত হোন
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6 text-center">
            <h3 className="font-heading font-bold mb-2">💬 মতামত জানান !</h3>
            <p className="text-sm text-muted-foreground mb-4">
              আপনার চাওয়া, আমাদের দায়িত্ব! যেকোনো ব্যাপারে আপনার মতামত আমাদের সবচেয়ে গুরুত্বপূর্ণ!
            </p>
            <Link to="/dashboard/feedback">
              <Button variant="outline" size="sm">মতামত দিন</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Questions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6">
            <h3 className="font-heading font-bold mb-3">আপনার তৈরী সর্বশেষ প্রশ্ন</h3>
            {recentQuestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">এখনো কোনো প্রশ্ন তৈরি হয়নি।</p>
            ) : (
              <div className="space-y-2">
                {recentQuestions.map((q: any) => (
                  <div key={q.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                    <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{q.question || "প্রশ্ন"}</p>
                      <p className="text-xs text-muted-foreground">{(q as any).classes?.name} • {(q as any).subjects?.name}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0 uppercase">{q.type}</Badge>
                  </div>
                ))}
                <Link to="/dashboard/my-questions" className="text-sm text-primary font-medium flex items-center gap-1 mt-2">
                  সকল প্রশ্ন দেখুন →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <h3 className="font-heading font-bold mb-2">লাইভ চ্যাট</h3>
            <p className="text-sm text-muted-foreground mb-4">
              আপনার কথা আমাদের কাছে সবচেয়ে মূল্যবান! যেকোনো প্রশ্ন, পরামর্শ বা সমস্যার দ্রুত সমাধানে আমরা সবসময় আছি আপনার পাশে।
            </p>
            <div className="space-y-2">
              <Button variant="outline" className="w-full gap-2" size="sm" asChild>
                <a href="tel:+8801340345787">
                  <Phone className="w-4 h-4" /> +880 1340-345787
                </a>
              </Button>
              <Button className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white border-0" size="sm" asChild>
                <a href="https://wa.me/8801340345787" target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon className="w-4 h-4" /> Open WhatsApp
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
