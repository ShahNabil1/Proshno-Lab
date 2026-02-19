import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, PlusCircle, Package, BookOpen, MessageSquare, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { mongoQuery } from "@/hooks/useMongo";
import { supabase } from "@/integrations/supabase/client";

export default function DashboardHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalQuestions: 0 });
  const [recentQuestions, setRecentQuestions] = useState<any[]>([]);
  const [institute, setInstitute] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    if (!user) return;

    // Fetch question count from Mongo
    mongoQuery({
      action: "aggregate",
      collection: "mcq",
      pipeline: [
        { $match: { teacher_id: user.id } },
        { $count: "total" },
      ],
    }).then((r) => {
      setStats({ totalQuestions: r?.documents?.[0]?.total || 0 });
    }).catch(() => {});

    // Recent questions from Mongo
    mongoQuery({
      action: "find",
      collection: "mcq",
      filter: { teacher_id: user.id },
      sort: { _id: -1 },
      limit: 3,
    }).then((r) => {
      setRecentQuestions(r?.documents || []);
    }).catch(() => {});

    // Institute from Supabase
    supabase.from("institutes").select("*").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setInstitute(data));

    // Subscription from Supabase
    supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setSubscription(data));
  }, [user]);

  const fullName = user?.user_metadata?.full_name || "শিক্ষক";

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
        {/* Quick Actions */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Badge variant="outline" className="text-xs">জে-১২শ</Badge>
            </div>
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

        {/* Updates */}
        <Card className="bg-accent/30 border-accent">
          <CardContent className="p-6">
            <h3 className="font-heading font-bold text-center mb-3">📢 ইপ্রশ্নব্যাংক আপডেটস</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              সফট ওয়্যারের নতুন ফিচার, জরুরি আপডেট এবং নির্দেশনা — সবই আগে পাবেন আমাদের মেসেঞ্জার ব্রডকাস্ট চ্যানেলে।
            </p>
            <Button className="w-full mt-4 gradient-green text-primary-foreground border-0" size="sm">
              🔔 চ্যানেলে এখনই যুক্ত হোন
            </Button>
          </CardContent>
        </Card>

        {/* Feedback CTA */}
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
                {recentQuestions.map((q: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                    <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{q.question || "প্রশ্ন"}</p>
                      <p className="text-xs text-muted-foreground">{q.class} • {q.subject}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">MCQ</Badge>
                  </div>
                ))}
                <Link to="/dashboard/my-questions" className="text-sm text-primary font-medium flex items-center gap-1 mt-2">
                  সকল প্রশ্ন দেখুন →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live Chat CTA */}
        <Card>
          <CardContent className="p-6 text-center">
            <h3 className="font-heading font-bold mb-2">লাইভ চ্যাট</h3>
            <p className="text-sm text-muted-foreground mb-4">
              আপনার কথা আমাদের কাছে সবচেয়ে মূল্যবান! যেকোনো প্রশ্ন, পরামর্শ বা সমস্যার দ্রুত সমাধানে আমরা সবসময় আছি আপনার পাশে।
            </p>
            <div className="space-y-2">
              <Button variant="outline" className="w-full gap-2" size="sm">
                <Phone className="w-4 h-4" /> +880 1711-476706
              </Button>
              <Button className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white border-0" size="sm">
                Open WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
