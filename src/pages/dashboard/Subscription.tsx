import { useEffect, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Crown, ShieldCheck, Clock, Zap, BookOpen, Sparkles,
  ChevronRight, AlertCircle, Package, CheckCircle2, ShoppingCart,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import InlineCheckout, { SelectedPackageItem } from "@/components/InlineCheckout";
import { isPackagePurchased } from "@/lib/subscriptionMatcher";

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
  is_coming_soon?: boolean;
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
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
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
  const [selectedPkgs, setSelectedPkgs] = useState<Map<number, SelectedPackageItem>>(new Map());
  const checkoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("subscriptions").select("*").eq("teacher_id", user.id).order("starts_at", { ascending: true }),
      supabase.from("pricing_packages").select("*").eq("is_active", true).order("sort_order"),
    ]).then(([subRes, pkgRes]) => {
      setSubs(subRes.data || []);
      setPackages((pkgRes.data as any[]) || []);
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

  const activePlans = activeSubs.map(s => s.plan);

  const isPurchased = (pkg: PricingPkg): boolean =>
    isPackagePurchased(pkg, activePlans);


  const primarySub = activeSubs[0];
  const bundles = packages.filter(p => p.type === "bundle");
  const classPkgs = packages.filter(p => p.type === "class");

  const classGroups = new Map<string, PricingPkg[]>();
  classPkgs.forEach(p => {
    if (!classGroups.has(p.class_name)) classGroups.set(p.class_name, []);
    classGroups.get(p.class_name)!.push(p);
  });

  const togglePackage = (pkg: PricingPkg) => {
    if (pkg.is_coming_soon || isPurchased(pkg)) return;
    setSelectedPkgs((prev) => {
      const next = new Map(prev);
      if (next.has(pkg.id)) next.delete(pkg.id);
      else {
        next.set(pkg.id, { id: pkg.id, class_name: pkg.class_name, subject_name: pkg.subject_name, price: pkg.price });
        // If selecting "সকল বিষয়", remove individual subjects of same class
        if (pkg.subject_name === "সকল বিষয়") {
          const sameClassPkgs = classPkgs.filter(p => p.class_name === pkg.class_name && p.subject_name !== "সকল বিষয়");
          sameClassPkgs.forEach(p => next.delete(p.id));
        }
      }
      return next;
    });
  };

  const selectedList = Array.from(selectedPkgs.values());
  const totalPrice = selectedList.reduce((sum, p) => sum + p.price, 0);

  const scrollToCheckout = () => {
    checkoutRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const goToCheckout = (pkg: PricingPkg) => {
    // For bundles, use the old checkout page
    window.location.href = `/checkout?package=${pkg.id}&price=${pkg.price}&classes=${encodeURIComponent(pkg.class_name)}&subject=${encodeURIComponent(pkg.subject_name)}`;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Hero */}
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
              <p className="text-xs text-white/80 text-center font-heading font-bold">{toBanglaNum(getDaysLeft(primarySub.ends_at))} দিন বাকি</p>
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
                      <p className="text-center text-xs font-heading font-bold text-primary">{toBanglaNum(daysLeft)} দিন বাকি</p>
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
            <p className="text-sm text-muted-foreground mb-4">নিচের প্যাকেজ থেকে পছন্দের প্ল্যান বেছে নিন</p>
          </CardContent>
        </Card>
      )}

      {/* Expired */}
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
                        <p className="text-xs text-muted-foreground">{sub.ends_at ? formatDateBn(sub.ends_at) : "—"} পর্যন্ত</p>
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

      {/* Available Packages */}
      <section className="space-y-4">
        <h2 className="font-heading font-bold text-lg flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" /> প্যাকেজ সমূহ
        </h2>

        {/* Bundles */}
        {bundles.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bundles.map((pkg) => {
              const bought = isPurchased(pkg);
              const isComingSoon = pkg.is_coming_soon;
              return (
                <Card key={pkg.id} className={`relative overflow-hidden transition-all ${bought ? "border-primary/40 shadow-[0_0_15px_-3px_hsl(var(--primary)/0.25)]" : "border-primary/20 bg-gradient-to-br from-primary/5 to-accent/20 hover:shadow-md"}`}>
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-heading font-bold px-3 py-0.5 rounded-bl-lg">সেরা অফার</div>
                  {isComingSoon && (
                    <div className="absolute top-0 left-0 z-10">
                      <Badge className="rounded-none rounded-br-xl bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 text-white border-0 text-[10px] font-heading gap-1.5 px-3 py-1 shadow-lg shadow-amber-500/30 animate-pulse">
                        <Clock className="w-3 h-3 animate-spin" style={{ animationDuration: '3s' }} /> Coming Soon
                      </Badge>
                    </div>
                  )}
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
                          <Sparkles className="w-3 h-3 text-primary shrink-0" /><span>{f}</span>
                        </div>
                      ))}
                    </div>
                    {isComingSoon ? (
                      <Button disabled className="w-full font-heading font-semibold opacity-60">
                        <Clock className="w-4 h-4 mr-1" /> শীঘ্রই আসছে
                      </Button>
                    ) : bought ? (
                      <Button disabled className="w-full font-heading font-semibold text-xs" variant="secondary">
                        <CheckCircle2 className="w-4 h-4 mr-1" /> ইতিমধ্যেই কেনা হয়েছে
                      </Button>
                    ) : (
                      <Button className="w-full gradient-green text-primary-foreground border-0 font-heading font-semibold"
                        onClick={() => goToCheckout(pkg)}>
                        এখনই কিনুন <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Class packages with multi-select */}
        {classGroups.size > 0 && (
          <>
            <p className="text-sm text-muted-foreground">
              ✅ আপনার পছন্দের বিষয়গুলো সিলেক্ট করুন, তারপর নিচে চেকআউট করুন
            </p>
            <Accordion type="multiple" className="space-y-2">
              {Array.from(classGroups.entries()).map(([className, pkgs]) => (
                <AccordionItem key={className} value={className} className="border rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-accent/50 transition-colors">
                    <span className="flex items-center gap-2 font-heading font-bold text-sm">
                      <BookOpen className="w-4 h-4 text-primary" /> {className}
                      <Badge variant="outline" className="text-[10px] ml-1 font-normal">{toBanglaNum(pkgs.length)} টি প্যাকেজ</Badge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {pkgs.map((pkg) => {
                        const bought = isPurchased(pkg);
                        const allSubjectPkg = pkgs.find(p => p.subject_name === "সকল বিষয়");
                        const allSubjectSelected = allSubjectPkg ? selectedPkgs.has(allSubjectPkg.id) : false;
                        const allSubjectComingSoon = allSubjectPkg?.is_coming_soon;
                        const isIndividualSubject = pkg.subject_name !== "সকল বিষয়";
                        const isComingSoon = pkg.is_coming_soon || (isIndividualSubject && allSubjectComingSoon);
                        const isDisabledByAllSubject = isIndividualSubject && (allSubjectSelected || isPurchased(allSubjectPkg!));
                        const allSubjectBought = allSubjectPkg ? isPurchased(allSubjectPkg) : false;
                        const effectivelyBought = bought || (isIndividualSubject && allSubjectBought);
                        const isSelected = selectedPkgs.has(pkg.id);
                        const isDisabled = isComingSoon || isDisabledByAllSubject || effectivelyBought;
                        return (
                          <Card
                            key={pkg.id}
                            className={`transition-all cursor-pointer ${isSelected && !isDisabledByAllSubject ? "border-primary/40 bg-primary/5 shadow-sm" : effectivelyBought ? "border-primary/40 shadow-[0_0_12px_-3px_hsl(var(--primary)/0.2)]" : isDisabled ? "opacity-60 cursor-not-allowed" : "hover:shadow-sm"}`}
                            onClick={() => !isDisabled && togglePackage(pkg)}
                          >
                            <CardContent className="p-4 relative">
                              {effectivelyBought && (
                                <Badge className="absolute top-2 right-2 gradient-green text-primary-foreground border-0 text-[9px] px-1.5 py-0">সক্রিয়</Badge>
                              )}
                              {isComingSoon && !effectivelyBought && (
                                <Badge className="absolute top-2 right-2 bg-gradient-to-r from-orange-500/15 via-amber-500/15 to-yellow-400/15 text-amber-600 border-amber-400/40 text-[9px] px-2 py-0.5 gap-1 shadow-sm shadow-amber-500/10 animate-pulse font-bold">
                                  <Clock className="w-2.5 h-2.5 animate-spin" style={{ animationDuration: '3s' }} /> Coming Soon
                                </Badge>
                              )}
                              {isDisabledByAllSubject && !effectivelyBought && !isComingSoon && (
                                <Badge className="absolute top-2 right-2 bg-primary/10 text-primary border-primary/20 text-[9px] px-1.5 py-0">অন্তর্ভুক্ত</Badge>
                              )}
                              <div className="flex items-start gap-3">
                                {!isDisabled && (
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => togglePackage(pkg)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="mt-0.5"
                                  />
                                )}
                                <div className="flex-1">
                                  <p className="text-sm font-heading font-bold mb-1">{pkg.subject_name}</p>
                                  <p className="text-lg font-heading font-bold text-primary">
                                    ৳{toBanglaNum(pkg.price)}<span className="text-xs text-muted-foreground font-normal">/বছর</span>
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </>
        )}
      </section>

      {/* Inline Checkout */}
      {selectedList.length > 0 && (
        <section ref={checkoutRef}>
          <InlineCheckout
            selectedPackages={selectedList}
            onRemove={(id) => {
              setSelectedPkgs((prev) => { const next = new Map(prev); next.delete(id); return next; });
            }}
            onClearAll={() => setSelectedPkgs(new Map())}
            onSuccess={() => {
              setSelectedPkgs(new Map());
              // Refresh subs
              if (user) {
                supabase.from("subscriptions").select("*").eq("teacher_id", user.id).order("starts_at", { ascending: true })
                  .then(({ data }) => setSubs(data || []));
              }
            }}
          />
        </section>
      )}

      {/* Sticky bottom bar */}
      {selectedList.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur border-t shadow-lg">
          <div className="container max-w-5xl flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-heading font-bold">{toBanglaNum(selectedList.length)} টি প্যাকেজ নির্বাচিত</p>
              <p className="text-xs text-muted-foreground">
                সর্বমোট: <span className="font-bold text-primary">৳{toBanglaNum(totalPrice)}</span>
              </p>
            </div>
            <Button className="gradient-green text-white border-0 font-heading gap-2" onClick={scrollToCheckout}>
              <ShoppingCart className="w-4 h-4" /> চেকআউট করুন
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
