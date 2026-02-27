import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Crown, ShieldCheck, Clock, Zap, BookOpen, Sparkles,
  ChevronRight, AlertCircle, Package, CheckCircle2
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

  // Build a set of purchased plan names for duplicate detection
  const purchasedPlans = new Set(
    subs
      .filter(s => s.status === "active" && s.ends_at && new Date(s.ends_at) > new Date())
      .map(s => s.plan.trim().toLowerCase())
  );

  const isPurchased = (pkg: PricingPkg): boolean => {
    // Match by class_name or combined class+subject
    const className = pkg.class_name.trim().toLowerCase();
    const combined = `${pkg.class_name} - ${pkg.subject_name}`.trim().toLowerCase();
    return purchasedPlans.has(className) || purchasedPlans.has(combined) ||
      Array.from(purchasedPlans).some(p => p.includes(className));
  };

  // Primary active sub for header
  const primarySub = activeSubs[0];

  const bundles = packages.filter(p => p.type === "bundle");
  const classPkgs = packages.filter(p => p.type === "class");

  const classGroups = new Map<string, PricingPkg[]>();
  classPkgs.forEach(p => {
    if (!classGroups.has(p.class_name)) classGroups.set(p.class_name, []);
    classGroups.get(p.class_name)!.push(p);
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Hero Header with active plan summary */}
      <div className="gradient-hero rounded-2xl p-6 md:p-8 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
              <Crown className="w-7 h-7 text-primary-foreground" />
              <h1 className="font-heading text-xl md:text-2xl font-bold">সাবস্ক্রিপশন ড্যাশবোর্ড</h1>
            </div>
            <p className="text-white/70 text-sm">আপনার প্ল্যান পরিচালনা করুন ও নতুন প্যাকেজ এক্সপ্লোর করুন</p>
          </div>
          {primarySub && primarySub.ends_at && (
            <div className="bg-white/10 backdrop-blur rounded-xl p-4 min-w-[220px]">
              <p className="text-xs text-white/60 mb-1">বর্তমান প্ল্যান: <span className="font-bold text-white">{primarySub.plan}</span></p>
              <Progress value={getProgress(primarySub.starts_at, primarySub.ends_at)} className="h-2 mb-1.5 bg-white/20" />
              <p className="text-xs text-white/80 text-center font-heading font-bold">
                {toBanglaNum(getDaysLeft(primarySub.ends_at))} দিন বাকি
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Active Plans */}
      {hasActive && (
        <section className="space-y-3">
          <h2 className="font-heading font-bold text-lg flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" /> সক্রিয় প্ল্যান সমূহ
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeSubs.map((sub) => {
              const daysLeft = sub.ends_at ? getDaysLeft(sub.ends_at) : 0;
              const progress = getProgress(sub.starts_at, sub.ends_at);
              const isExpiring = daysLeft <= 30;

              return (
                <Card key={sub.id} className="border-primary/30 shadow-[0_0_15px_-3px_hsl(var(--primary)/0.3)] overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Crown className="w-4 h-4 text-primary" />
                          <h3 className="font-heading font-bold">{sub.plan}</h3>
                        </div>
                        <Badge className="gradient-green text-primary-foreground border-0 text-[10px]">
                          <ShieldCheck className="w-3 h-3 mr-1" /> সক্রিয়
                        </Badge>
                      </div>
                      {isExpiring && (
                        <Badge variant="destructive" className="text-[10px] animate-pulse">
                          <Clock className="w-3 h-3 mr-1" /> শেষ হচ্ছে
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1.5 mb-3">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{sub.starts_at ? formatDateBn(sub.starts_at) : "—"}</span>
                        <span>{sub.ends_at ? formatDateBn(sub.ends_at) : "—"}</span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                      <p className="text-center text-xs font-heading font-bold text-primary">
                        {toBanglaNum(daysLeft)} দিন বাকি
                      </p>
                    </div>
                    {isExpiring && (
                      <Link to="/pricing">
                        <Button size="sm" className="w-full gradient-green text-primary-foreground border-0 font-heading text-xs">
                          <Zap className="w-3 h-3 mr-1" /> রিনিউ করুন
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {!hasActive && (
        <Card className="border-dashed border-2 border-primary/30">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-heading font-bold text-lg mb-1">কোনো সক্রিয় সাবস্ক্রিপশন নেই</h3>
            <p className="text-sm text-muted-foreground mb-4">
              নিচের প্যাকেজ থেকে পছন্দের প্ল্যান বেছে নিন
            </p>
            <Link to="/pricing">
              <Button className="gradient-green text-primary-foreground border-0 font-heading">
                <Zap className="w-4 h-4 mr-1" /> প্যাকেজ দেখুন
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Expired plans */}
      {expiredSubs.length > 0 && (
        <Accordion type="single" collapsible>
          <AccordionItem value="expired" className="border-none">
            <AccordionTrigger className="font-heading font-semibold text-sm text-muted-foreground py-2 hover:no-underline">
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> পূর্ববর্তী প্ল্যান ({toBanglaNum(expiredSubs.length)})</span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {expiredSubs.map((sub) => (
                  <Card key={sub.id} className="opacity-60">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{sub.plan}</p>
                        <p className="text-xs text-muted-foreground">
                          {sub.ends_at ? formatDateBn(sub.ends_at) : "—"} পর্যন্ত
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">মেয়াদোত্তীর্ণ</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* ========== Available Packages (Tabbed by class) ========== */}
      <section className="space-y-4">
        <h2 className="font-heading font-bold text-lg flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" /> প্যাকেজ সমূহ
        </h2>

        {/* Bundle packages */}
        {bundles.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bundles.map((pkg) => {
              const bought = isPurchased(pkg);
              return (
                <Card key={pkg.id} className={`relative overflow-hidden transition-all ${bought ? "border-primary/40 shadow-[0_0_15px_-3px_hsl(var(--primary)/0.25)]" : "border-primary/20 bg-gradient-to-br from-primary/5 to-accent/20 hover:shadow-md"}`}>
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-heading font-bold px-3 py-0.5 rounded-bl-lg">
                    সেরা অফার
                  </div>
                  {bought && (
                    <div className="absolute top-0 left-0 bg-primary text-primary-foreground text-[10px] font-heading font-bold px-2.5 py-0.5 rounded-br-lg flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> সক্রিয়
                    </div>
                  )}
                  <CardContent className="p-5 pt-7">
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
                    {bought ? (
                      <Button disabled className="w-full font-heading font-semibold text-xs" variant="secondary">
                        <CheckCircle2 className="w-4 h-4 mr-1" /> ইতিমধ্যেই কেনা হয়েছে
                      </Button>
                    ) : (
                      <Link to={`/checkout?package=${pkg.id}`}>
                        <Button className="w-full gradient-green text-primary-foreground border-0 font-heading font-semibold">
                          এখনই কিনুন <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Class-specific packages in accordion */}
        {classGroups.size > 0 && (
          <Accordion type="multiple" className="space-y-2">
            {Array.from(classGroups.entries()).map(([className, pkgs]) => (
              <AccordionItem key={className} value={className} className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-accent/50 transition-colors">
                  <span className="flex items-center gap-2 font-heading font-bold text-sm">
                    <BookOpen className="w-4 h-4 text-primary" /> {className}
                    <Badge variant="outline" className="text-[10px] ml-1 font-normal">
                      {toBanglaNum(pkgs.length)} টি প্যাকেজ
                    </Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {pkgs.map((pkg) => {
                      const bought = isPurchased(pkg);
                      return (
                        <Card key={pkg.id} className={`transition-all ${bought ? "border-primary/40 shadow-[0_0_12px_-3px_hsl(var(--primary)/0.2)]" : "hover:shadow-sm"}`}>
                          <CardContent className="p-4 relative">
                            {bought && (
                              <Badge className="absolute top-2 right-2 gradient-green text-primary-foreground border-0 text-[9px] px-1.5 py-0">
                                সক্রিয়
                              </Badge>
                            )}
                            <p className="text-sm font-heading font-bold mb-1">{pkg.subject_name}</p>
                            <p className="text-lg font-heading font-bold text-primary mb-3">
                              ৳{toBanglaNum(pkg.price)}<span className="text-xs text-muted-foreground font-normal">/বছর</span>
                            </p>
                            {bought ? (
                              <Button disabled size="sm" variant="secondary" className="w-full text-xs font-heading">
                                <CheckCircle2 className="w-3 h-3 mr-1" /> কেনা হয়েছে
                              </Button>
                            ) : (
                              <Link to={`/checkout?package=${pkg.id}`}>
                                <Button size="sm" className="w-full gradient-green text-primary-foreground border-0 text-xs font-heading">
                                  এখনই কিনুন <ChevronRight className="w-3 h-3 ml-1" />
                                </Button>
                              </Link>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </section>
    </div>
  );
}
