import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Package, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" as const },
  }),
};

const bundlePackages = [
  { classes: "ষষ্ঠ - দশম", subjects: "সকল বিষয়", price: "৯০০" },
  { classes: "ষষ্ঠ - দ্বাদশ", subjects: "সকল বিষয়", price: "১,২০০" },
];

const classPackages = [
  {
    className: "ষষ্ঠ শ্রেণি",
    packages: [
      { subject: "সকল বিষয়", price: "৩৯৯" },
      { subject: "গণিত", price: "১৯৯" },
      { subject: "বিজ্ঞান", price: "১৯৯" },
      { subject: "তথ্য ও যোগাযোগ প্রযুক্তি", price: "১৯৯" },
    ],
  },
  {
    className: "সপ্তম শ্রেণি",
    packages: [
      { subject: "সকল বিষয়", price: "৩৯৯" },
      { subject: "গণিত", price: "১৯৯" },
      { subject: "বিজ্ঞান", price: "১৯৯" },
      { subject: "তথ্য ও যোগাযোগ প্রযুক্তি", price: "১৯৯" },
    ],
  },
  {
    className: "অষ্টম শ্রেণি",
    packages: [
      { subject: "সকল বিষয়", price: "৩৯৯" },
      { subject: "গণিত", price: "১৯৯" },
      { subject: "বিজ্ঞান", price: "১৯৯" },
      { subject: "তথ্য ও যোগাযোগ প্রযুক্তি", price: "১৯৯" },
    ],
  },
  {
    className: "নবম-দশম শ্রেণি",
    packages: [
      { subject: "সকল বিষয়", price: "৩৯৯" },
      { subject: "গণিত", price: "১৯৯" },
      { subject: "বিজ্ঞান", price: "১৯৯" },
      { subject: "তথ্য ও যোগাযোগ প্রযুক্তি", price: "১৯৯" },
    ],
  },
  {
    className: "একাদশ শ্রেণি",
    packages: [
      { subject: "সকল বিষয়", price: "৩৯৯" },
      { subject: "গণিত", price: "১৯৯" },
      { subject: "বিজ্ঞান", price: "১৯৯" },
      { subject: "তথ্য ও যোগাযোগ প্রযুক্তি", price: "১৯৯" },
    ],
  },
  {
    className: "দ্বাদশ শ্রেণি",
    packages: [
      { subject: "সকল বিষয়", price: "৩৯৯" },
      { subject: "গণিত", price: "১৯৯" },
      { subject: "বিজ্ঞান", price: "১৯৯" },
      { subject: "তথ্য ও যোগাযোগ প্রযুক্তি", price: "১৯৯" },
    ],
  },
];

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

const MESSENGER_URL = "https://m.me/eexamapp";

export default function PricingPage() {
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
        {/* Bundle Packages */}
        <section className="container max-w-3xl">
          <motion.div custom={0} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <div className="flex items-center gap-2 mb-6">
              <Package className="w-5 h-5 text-primary" />
              <h2 className="font-heading text-xl md:text-2xl font-bold text-foreground">Bundle Package</h2>
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">সেরা মূল্য</Badge>
            </div>

            <div className="rounded-xl border bg-card overflow-hidden shadow-premium">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-heading font-semibold text-foreground">শ্রেণি</TableHead>
                    <TableHead className="font-heading font-semibold text-foreground">বিষয়</TableHead>
                    <TableHead className="font-heading font-semibold text-foreground">মূল্য</TableHead>
                    <TableHead className="font-heading font-semibold text-foreground text-center">পদক্ষেপ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bundlePackages.map((pkg, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{pkg.classes}</TableCell>
                      <TableCell>{pkg.subjects}</TableCell>
                      <TableCell className="font-semibold">৳{pkg.price}/-</TableCell>
                      <TableCell className="text-center">
                        <Button size="sm" className="gradient-green text-white border-0 rounded-lg font-heading text-xs h-8 px-4" asChild>
                          <a href={MESSENGER_URL} target="_blank" rel="noopener noreferrer">
                            ক্রয় করুন
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </motion.div>
        </section>

        {/* Class-wise Packages */}
        <section className="container max-w-3xl">
          <motion.div custom={1} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <div className="flex items-center gap-2 mb-6">
              <GraduationCap className="w-5 h-5 text-primary" />
              <h2 className="font-heading text-xl md:text-2xl font-bold text-foreground">শ্রেণি অনুযায়ী প্যাকেজ</h2>
            </div>

            <div className="space-y-6">
              {classPackages.map((cls, ci) => (
                <motion.div key={ci} custom={ci + 2} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
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
                        {cls.packages.map((pkg, pi) => (
                          <TableRow key={pi}>
                            <TableCell className={pi === 0 ? "font-semibold" : ""}>{pkg.subject}</TableCell>
                            <TableCell className="font-semibold">৳{pkg.price}/-</TableCell>
                            <TableCell className="text-center">
                              <Button size="sm" className="gradient-green text-white border-0 rounded-lg font-heading text-xs h-8 px-4" asChild>
                                <a href={MESSENGER_URL} target="_blank" rel="noopener noreferrer">
                                  ক্রয় করুন
                                </a>
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
