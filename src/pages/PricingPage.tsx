import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

const plans = [
  {
    name: "বেসিক",
    price: "ফ্রি",
    period: "",
    description: "ব্যক্তিগত ব্যবহারের জন্য",
    features: [
      "১০টি প্রশ্নপত্র তৈরি/মাস",
      "বেসিক eExamapp অ্যাক্সেস",
      "PDF ডাউনলোড",
      "ইমেইল সাপোর্ট",
    ],
    cta: "ফ্রি শুরু করুন",
    featured: false,
  },
  {
    name: "প্রো",
    price: "৪৯৯",
    period: "/মাস",
    description: "শিক্ষক ও প্রতিষ্ঠানের জন্য",
    features: [
      "আনলিমিটেড প্রশ্নপত্র তৈরি",
      "সম্পূর্ণ eExamapp অ্যাক্সেস",
      "সুপার সাজেশন",
      "অগ্রাধিকার সাপোর্ট",
      "কাস্টম ব্র্যান্ডিং",
      "মডেল টেস্ট জেনারেটর",
    ],
    cta: "প্রো কিনুন",
    featured: true,
  },
  {
    name: "প্রতিষ্ঠান",
    price: "১,৯৯৯",
    period: "/মাস",
    description: "বড় প্রতিষ্ঠানের জন্য",
    features: [
      "সব প্রো ফিচার",
      "১০+ শিক্ষক অ্যাকাউন্ট",
      "OMR মূল্যায়ন",
      "অনলাইন পরীক্ষা সিস্টেম",
      "ডেডিকেটেড সাপোর্ট",
      "কাস্টম API অ্যাক্সেস",
    ],
    cta: "যোগাযোগ করুন",
    featured: false,
  },
];

export default function PricingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="gradient-hero pt-28 pb-16 md:pt-36 md:pb-20">
        <div className="container text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="font-heading text-3xl md:text-5xl font-extrabold text-white mb-4">
              সহজ ও স্বচ্ছ মূল্য তালিকা
            </h1>
            <p className="text-white/60 text-lg max-w-lg mx-auto">
              আপনার প্রয়োজন অনুযায়ী প্ল্যান বেছে নিন। যেকোনো সময় আপগ্রেড করুন।
            </p>
          </motion.div>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="py-16 md:py-24 bg-background -mt-6 relative z-10">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <motion.div key={i} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                <div className={`relative rounded-2xl bg-card p-8 h-full flex flex-col hover-lift ${plan.featured ? "ring-2 ring-primary shadow-elevated md:-translate-y-3" : "shadow-premium"}`}>
                  {plan.featured && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 px-4 py-1.5 rounded-full bg-primary text-white text-xs font-bold">
                        <Star className="w-3 h-3" /> জনপ্রিয়
                      </span>
                    </div>
                  )}

                  <h3 className="font-heading font-bold text-xl text-foreground mb-1">{plan.name}</h3>
                  <p className="text-muted-foreground text-sm mb-5">{plan.description}</p>

                  <div className="flex items-baseline gap-1 mb-7">
                    <span className="font-heading font-extrabold text-4xl text-foreground">
                      {plan.price === "ফ্রি" ? plan.price : `৳${plan.price}`}
                    </span>
                    {plan.period && <span className="text-muted-foreground text-sm">{plan.period}</span>}
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f, fi) => (
                      <li key={fi} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={`w-full rounded-xl font-heading font-semibold h-11 ${plan.featured ? "gradient-green text-white border-0 shadow-[0_4px_16px_hsl(155_72%_44%/0.25)]" : ""}`}
                    variant={plan.featured ? "default" : "outline"}
                  >
                    {plan.cta}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
