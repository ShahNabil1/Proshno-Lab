import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Package, GraduationCap, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" as const },
  }),
};

const faqs = [
  {
    q: "১ ক্লিকে প্রশ্ন তৈরীতে কি কি কাস্টমাইজ করা যাবে?",
    a: "প্রশ্নের ধরন (MCQ, সংক্ষিপ্ত, সৃজনশীল), মান বিভাজন, সময়, প্রতিষ্ঠানের নাম ও লোগো সহ সম্পূর্ণ কাস্টমাইজ করা যাবে।",
  },
  {
    q: "কি কি উপায়ে প্রশ্ন বাছাই করা যাবে?",
    a: "অধ্যায়, টপিক, বোর্ড রেফারেন্স, বিশ্ববিদ্যালয় রেফারেন্স এবং প্রশ্নের ধরন অনুযায়ী বাছাই করা যাবে।",
  },
  {
    q: "প্যাকেজের মেয়াদ কত দিন?",
    a: "সকল প্যাকেজের মেয়াদ ক্রয়ের তারিখ থেকে ৩৬৫ দিন (১ বছর)।",
  },
  {
    q: "প্যাকেজ কেনার পর কি আপগ্রেড করা যায়?",
    a: "হ্যাঁ, যেকোনো সময় বড় প্যাকেজে আপগ্রেড করতে পারবেন। পার্থক্য মূল্য পরিশোধ করলেই হবে।",
  },
];

const bundleFeatures = [
  "সকল বিষয়ের প্রশ্ন ব্যাংক",
  "১-ক্লিকে প্রশ্নপত্র তৈরি",
  "প্রফেশনাল প্রিন্ট লেআউট",
  "ক্লাউড ব্যাকআপ",
];

interface PricingPackage {
  id: number;
  type: string;
  class_name: string;
  subject_name: string;
  price: number;
  sort_order: number;
}

function toBengaliDigits(n: number): string {
  const bengaliDigits = "০১২৩৪৫৬৭৮৯";
  return n.toLocaleString("en-IN").replace(/\d/g, (d) => bengaliDigits[parseInt(d)]);
}

export default function PricingPage() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("pricing_packages")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => {
        setPackages((data as any[]) || []);
        setLoading(false);
      });
  }, []);

  const bundlePackages = packages.filter((p) => p.type === "bundle");
  const classPackages = packages.filter((p) => p.type === "class");

  // Group class packages by class_name
  const classGroups: { className: string; packages: PricingPackage[] }[] = [];
  const classMap = new Map<string, PricingPackage[]>();
  classPackages.forEach((p) => {
    if (!classMap.has(p.class_name)) classMap.set(p.class_name, []);
    classMap.get(p.class_name)!.push(p);
  });
  classMap.forEach((pkgs, className) => {
    classGroups.push({ className, packages: pkgs });
  });

  const goToCheckout = (classes: string, subject: string, price: number) => {
    navigate(`/checkout?classes=${encodeURIComponent(classes)}&subject=${encodeURIComponent(subject)}&price=${price}`);
  };

  return (
    <div>
      {/* Hero */}
      <section className="gradient-hero pt-28 pb-16 md:pt-36 md:pb-20">
        <div className="container text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="font-heading text-3xl md:text-5xl font-extrabold text-white mb-4">
              ৬–১২ শ্রেণির প্যাকেজ তালিকা
            </h1>
            <p className="text-white/70 text-lg max-w-xl mx-auto">
              ঝামেলাহীনভাবে ৩৬৫ দিন Unlimited প্রশ্ন তৈরি করুন
            </p>
            <p className="text-white/50 text-sm mt-2">
              ✨ এক ক্লিকে প্যাকেজ কিনুন, সারা বছর নিশ্চিন্ত থাকুন
            </p>
          </motion.div>
        </div>
      </section>

      <div className="bg-background -mt-6 relative z-10 py-12 md:py-20 space-y-16 md:space-y-24">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Bundle Packages as Cards */}
            {bundlePackages.length > 0 && (
              <section className="container max-w-4xl">
                <motion.div custom={0} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                  <div className="flex items-center gap-2 mb-6">
                    <Package className="w-5 h-5 text-primary" />
                    <h2 className="font-heading text-xl md:text-2xl font-bold text-foreground">প্যাকেজ সমূহ</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {bundlePackages.map((pkg, i) => (
                      <motion.div key={pkg.id} custom={i + 1} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                        <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-accent/20 hover:shadow-lg transition-all hover-lift">
                          <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-heading font-bold px-3 py-0.5 rounded-bl-lg">
                            সেরা অফার
                          </div>
                          <CardContent className="p-5 pt-7">
                            <h3 className="font-heading font-bold text-base mb-1">{pkg.class_name}</h3>
                            <p className="text-xs text-muted-foreground mb-3">{pkg.subject_name}</p>
                            <div className="flex items-end gap-1 mb-4">
                              <span className="font-heading text-2xl font-bold text-primary">৳{toBengaliDigits(pkg.price)}</span>
                              <span className="text-xs text-muted-foreground mb-1">/ বছর</span>
                            </div>
                            <div className="space-y-1.5 mb-5">
                              {bundleFeatures.map((f, fi) => (
                                <div key={fi} className="flex items-center gap-1.5 text-xs">
                                  <Sparkles className="w-3 h-3 text-primary shrink-0" />
                                  <span>{f}</span>
                                </div>
                              ))}
                            </div>
                            <Button
                              className="w-full gradient-green text-primary-foreground border-0 font-heading font-semibold rounded-lg"
                              onClick={() => goToCheckout(pkg.class_name, pkg.subject_name, pkg.price)}
                            >
                              এখনই কিনুন <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </section>
            )}

            {/* Class-wise Packages */}
            {classGroups.length > 0 && (
              <section className="container max-w-3xl">
                <motion.div custom={1} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                  <div className="flex items-center gap-2 mb-6">
                    <GraduationCap className="w-5 h-5 text-primary" />
                    <h2 className="font-heading text-xl md:text-2xl font-bold text-foreground">শ্রেণি অনুযায়ী প্যাকেজ</h2>
                  </div>

                  <div className="space-y-6">
                    {classGroups.map((cls, ci) => (
                      <motion.div key={cls.className} custom={ci + 2} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                        <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
                          <div className="bg-muted/50 px-4 py-3 border-b">
                            <h3 className="font-heading font-bold text-foreground flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-primary" />
                              {cls.className}
                            </h3>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="font-heading font-semibold text-foreground">বিষয়</TableHead>
                                <TableHead className="font-heading font-semibold text-foreground">মূল্য</TableHead>
                                <TableHead className="font-heading font-semibold text-foreground text-center">পদক্ষেপ</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {cls.packages.map((pkg) => (
                                <TableRow key={pkg.id}>
                                  <TableCell className={pkg.subject_name === "সকল বিষয়" ? "font-semibold" : ""}>{pkg.subject_name}</TableCell>
                                  <TableCell className="font-semibold">৳{toBengaliDigits(pkg.price)}/-</TableCell>
                                  <TableCell className="text-center">
                                    <Button size="sm" className="gradient-green text-white border-0 rounded-lg font-heading text-xs h-8 px-4"
                                      onClick={() => goToCheckout(cls.className, pkg.subject_name, pkg.price)}>
                                      ক্রয় করুন
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </section>
            )}
          </>
        )}

        {/* FAQ */}
        <section className="container max-w-3xl">
          <motion.div custom={8} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <h2 className="font-heading text-xl md:text-2xl font-bold text-foreground text-center mb-8">
              আপনার সব প্রশ্নের উত্তর এখানে !
            </h2>
            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border rounded-xl px-4 bg-card">
                  <AccordionTrigger className="font-heading font-medium text-sm md:text-base hover:no-underline">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
