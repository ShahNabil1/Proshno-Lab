import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Crown, ShieldCheck, Clock, Zap, BookOpen, Sparkles,
  ChevronRight, AlertCircle, Package
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

interface Sub {
  id: number;
  plan: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
}

interface PricingPkg {
  id: number;
  class_name: string;
  subject_name: string;
  price: number;
  type: string;
  sort_order: number;
}

const toBanglaNum = (n: number): string => {
  const digits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(n).split("").map(d => digits[parseInt(d)] ?? d).join("");
};

const formatDateBn = (iso: string) => {
  const d = new Date(iso);
  const months = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
  return `${toBanglaNum(d.getDate())} ${months[d.getMonth()]}, ${toBanglaNum(d.getFullYear())}`;
};

const getDaysLeft = (endsAt: string): number => {
  const diff = new Date(endsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

const getProgress = (startsAt: string | null, endsAt: string | null): number => {
  if (!startsAt || !endsAt) return 0;
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  const now = Date.now();
  const total = end - start;
  const elapsed = now - start;
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
};

const features = [
  "সকল বিষয়ের প্রশ্ন ব্যাংক",
  "১-ক্লিকে প্রশ্নপত্র তৈরি",
  "প্রফেশনাল প্রিন্ট লেআউট",
  "ক্লাউড ব্যাকআপ",
];

export default function Subscription() {
  const { user } = useAuth();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [packages, setPackages] = useState<PricingPkg[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    Promise.all([
      supabase.from("subscriptions").select("*").eq("teacher_id", user.id).order("starts_at", { ascending: true }),
      supabase.from("pricing_packages").select("*").eq("is_active", true).order("sort_order"),
    ]).then(([subRes, pkgRes]) => {
      setSubs(subRes.data || []);
      setPackages(pkgRes.data || []);
      setLoading(false);
    });
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const activeSubs = subs.filter(s => s.status === "active" && s.ends_at && new Date(s.ends_at) > new Date());
  const expiredSubs = subs.filter(s => s.status !== "active" || (s.ends_at && new Date(s.ends_at) <= new Date()));
  const hasActive = activeSubs.length > 0;

  // Group packages: bundles first, then by class
  const bundles = packages.filter(p => p.type === "bundle");
  const classPkgs = packages.filter(p => p.type === "class");

  // Group class packages by class_name
  const classGroups = new Map<string, PricingPkg[]>();
  classPkgs.forEach(p => {
    if (!classGroups.has(p.class_name)) classGroups.set(p.class_name, []);
    classGroups.get(p.class_name)!.push(p);
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="gradient-hero rounded-2xl p-6 md:p-8 text-center text-white">
        <Crown className="w-8 h-8 mx-auto mb-2 text-primary-foreground" />
        <h1 className="font-heading text-xl md:text-2xl font-bold">সাবস্ক্রিপশন ড্যাশবোর্ড</h1>
        <p className="text-white/70 text-sm mt-1">আপনার প্ল্যান পরিচালনা করুন ও নতুন প্যাকেজ এক্সপ্লোর করুন</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ========== LEFT: Active Plans (3 cols) ========== */}
        <div className="lg:col-span-3 space-y-4">
          <h2 className="font-heading font-bold text-lg flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" /> আপনার সক্রিয় প্ল্যান
          </h2>

          {!hasActive ? (
            <Card className="border-dashed border-2 border-primary/30">
              <CardContent className="p-8 text-center">
                <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-heading font-bold text-lg mb-1">কোনো সক্রিয় সাবস্ক্রিপশন নেই</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  নিচের প্যাকেজ থেকে পছন্দের প্ল্যান বেছে নিন এবং প্রিমিয়াম সুবিধা উপভোগ করুন
                </p>
                <Link to="/pricing">
                  <Button className="gradient-green text-primary-foreground border-0 font-heading">
                    <Zap className="w-4 h-4 mr-1" /> প্যাকেজ দেখুন
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            activeSubs.map((sub) => {
              const daysLeft = sub.ends_at ? getDaysLeft(sub.ends_at) : 0;
              const progress = getProgress(sub.starts_at, sub.ends_at);
              const isExpiring = daysLeft <= 30;

              return (
                <Card key={sub.id} className="border-primary/20 bg-gradient-to-br from-card to-accent/20 overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Crown className="w-5 h-5 text-accent-foreground" />
                          <h3 className="font-heading font-bold text-lg">{sub.plan}</h3>
                        </div>
                        <Badge className="gradient-green text-primary-foreground border-0 text-xs">
                          <ShieldCheck className="w-3 h-3 mr-1" /> সক্রিয়
                        </Badge>
                      </div>
                      {isExpiring && (
                        <Badge variant="destructive" className="text-xs animate-pulse">
                          <Clock className="w-3 h-3 mr-1" /> মেয়াদ শেষ হচ্ছে
                        </Badge>
                      )}
                    </div>

                    {/* Timeline */}
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>শুরু: {sub.starts_at ? formatDateBn(sub.starts_at) : "—"}</span>
                        <span>শেষ: {sub.ends_at ? formatDateBn(sub.ends_at) : "—"}</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                      <p className="text-center text-sm font-heading font-bold text-primary">
                        {toBanglaNum(daysLeft)} দিন বাকি
                      </p>
                    </div>

                    {/* Features */}
                    <div className="grid grid-cols-2 gap-2">
                      {features.map((f, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Sparkles className="w-3 h-3 text-primary shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>

                    {isExpiring && (
                      <Link to="/pricing" className="block mt-4">
                        <Button className="w-full gradient-green text-primary-foreground border-0 font-heading font-semibold">
                          <Zap className="w-4 h-4 mr-1" /> রিনিউ করুন
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}

          {/* Expired plans */}
          {expiredSubs.length > 0 && (
            <div>
              <h3 className="font-heading font-semibold text-sm text-muted-foreground mb-2 flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> পূর্ববর্তী প্ল্যান
              </h3>
              <div className="space-y-2">
                {expiredSubs.map((sub) => (
                  <Card key={sub.id} className="opacity-60">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{sub.plan}</p>
                        <p className="text-xs text-muted-foreground">
                          {sub.ends_at ? formatDateBn(sub.ends_at) : "—"} পর্যন্ত
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">মেয়াদোত্তীর্ণ</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ========== RIGHT: Available Packages (2 cols) ========== */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="font-heading font-bold text-lg flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" /> প্যাকেজ সমূহ
          </h2>

          {/* Bundle packages - highlighted */}
          {bundles.map((pkg) => (
            <Card key={pkg.id} className="border-primary/30 bg-gradient-to-br from-primary/5 to-accent/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-heading font-bold px-3 py-0.5 rounded-bl-lg">
                বেস্ট ভ্যালু
              </div>
              <CardContent className="p-5">
                <h3 className="font-heading font-bold text-base mb-1">{pkg.class_name}</h3>
                <p className="text-xs text-muted-foreground mb-3">{pkg.subject_name}</p>
                <div className="flex items-end gap-1 mb-3">
                  <span className="font-heading text-2xl font-bold text-primary">৳{toBanglaNum(pkg.price)}</span>
                  <span className="text-xs text-muted-foreground mb-1">/ বছর</span>
                </div>
                <div className="space-y-1.5 mb-4">
                  {features.map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      <Sparkles className="w-3 h-3 text-primary shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                <Link to={`/checkout?package=${pkg.id}`}>
                  <Button className="w-full gradient-green text-primary-foreground border-0 font-heading font-semibold">
                    এখনই কিনুন <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}

          {/* Class-specific packages */}
          <div className="space-y-3">
            {Array.from(classGroups.entries()).map(([className, pkgs]) => (
              <Card key={className}>
                <CardContent className="p-4">
                  <h4 className="font-heading font-bold text-sm mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" /> {className}
                  </h4>
                  <div className="space-y-2">
                    {pkgs.map((pkg) => (
                      <div key={pkg.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                        <div>
                          <p className="text-sm font-medium">{pkg.subject_name}</p>
                          <p className="text-xs text-muted-foreground">৳{toBanglaNum(pkg.price)}/বছর</p>
                        </div>
                        <Link to={`/checkout?package=${pkg.id}`}>
                          <Button size="sm" variant="outline" className="text-xs font-heading h-7 px-3 hover:bg-primary hover:text-primary-foreground transition-colors">
                            কিনুন
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
