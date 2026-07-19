import { Link, Navigate, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, PenTool, FileText, ArrowRight,
  CheckCircle2, Users, FileCheck, Star, ChevronDown, ChevronRight,
  Zap, Shield, BarChart3, GraduationCap, Clock, Play, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import ReviewModal from "@/components/ReviewModal";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] as const }
  })
};

const stats = [
  { value: "৩০,০০০+", label: "শিক্ষা প্রতিষ্ঠান যুক্ত", icon: Users },
  { value: "২,২০০+", label: "প্রশ্ন তৈরি হচ্ছে প্রতিদিন", icon: FileCheck },
  { value: "৫ লক্ষ+", label: "মোট প্রশ্ন তৈরি হয়েছে", icon: BarChart3 }
];

const categories = [
  { icon: BookOpen, label: "বোর্ড প্রশ্ন" },
  { icon: FileText, label: "নির্বাচনী পরীক্ষার প্রশ্ন" },
  { icon: GraduationCap, label: "এডমিশন" },
  { icon: Shield, label: "মেডিকেল" }
];

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [faqs, setFaqs] = useState<{id: number;question: string;answer: string;}[]>([]);
  const [reviews, setReviews] = useState<{id: number;name: string;designation: string;institution: string;image_url: string;rating: number;text: string;}[]>([]);

  const fetchReviews = () => {
    supabase.from("reviews")
      .select("id, name, designation, institution, image_url, rating, text")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data }) => { if (data) setReviews(data as any); });
  };

  useEffect(() => {
    supabase.from("faqs")
      .select("id, question, answer")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => { if (data) setFaqs(data as any); });
    fetchReviews();
  }, []);

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="overflow-hidden">
      {/* ══════════ HERO ══════════ */}
      <section className="gradient-hero relative pt-24 pb-16 md:pt-28 md:pb-24 overflow-hidden">
        {/* Decorative background — grid + soft orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(hsl(0 0% 100% / 0.4) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100% / 0.4) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              maskImage: "radial-gradient(ellipse 70% 60% at 30% 40%, black 40%, transparent 80%)",
              WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 30% 40%, black 40%, transparent 80%)",
            }}
          />
          <div className="absolute -top-10 right-[-8%] w-[520px] h-[520px] rounded-full bg-gold/10 blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] left-[-6%] w-[420px] h-[420px] rounded-full bg-indigo/20 blur-[130px]" />
        </div>

        <div className="container relative z-10">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center">
            {/* Left */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="text-white"
            >
              {/* Chip */}
              <div className="inline-flex items-center gap-2 mb-6">
                <span className="link-underline-gold font-heading text-[15px] font-semibold text-gold pb-1">
                  শিক্ষকদের জন্য তৈরি
                </span>
              </div>

              <h1 className="font-heading font-bold text-white leading-[1.18] text-3xl sm:text-4xl md:text-5xl lg:text-[3.15rem] mb-6">
                প্রশ্ন তৈরি করতে এখনও হাজার হাজার{" "}
                <br />
                টাকা ও ঘণ্টার পর ঘণ্টা সময় নষ্ট হচ্ছে?
              </h1>

              <p className="text-white/85 text-base md:text-lg leading-relaxed mb-8 max-w-xl">
                <span className="font-heading font-bold text-white">প্রশ্নল্যাব</span>
                <span className="text-white/70">-এ</span> মাত্র কয়েক ক্লিকেই তৈরি করুন ষষ্ঠ থেকে দ্বাদশ শ্রেণির প্রশ্নপত্র{" "}
                <span className="inline-flex items-center align-middle ml-1">
                  <span className="bg-gold text-navy font-heading font-extrabold text-xs px-2 py-0.5 rounded-md rotate-[-6deg] shadow-sm">
                    ফ্রী
                  </span>
                </span>
              </p>

              <div className="flex flex-wrap gap-3">
                <Link to={user ? "/dashboard/create" : "/login"}>
                  <Button
                    size="lg"
                    className="btn-gold font-heading font-bold text-[15px] h-12 px-6 rounded-lg border-0 gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    সম্পূর্ণ ফ্রিতে শুরু করুন
                  </Button>
                </Link>
                <Link to="/demo">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 px-6 rounded-lg font-heading font-semibold text-[15px] bg-white/5 border-white/25 text-white hover:bg-white hover:text-navy hover:border-white gap-2 transition-all duration-300"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    কীভাবে কাজ করে দেখুন
                  </Button>
                </Link>
              </div>
            </motion.div>

            {/* Right — decorative desk illustration built in SVG */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="relative hidden lg:block"
            >
              <div className="relative animate-float">
                <svg viewBox="0 0 420 340" className="w-full h-auto drop-shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
                  {/* desk */}
                  <rect x="40" y="270" width="340" height="8" rx="3" fill="#f4c053" opacity="0.85" />
                  <rect x="60" y="278" width="6" height="40" fill="#f4c053" opacity="0.7" />
                  <rect x="354" y="278" width="6" height="40" fill="#f4c053" opacity="0.7" />
                  {/* book stack */}
                  <rect x="70" y="240" width="120" height="14" rx="2" fill="#25397c" />
                  <rect x="80" y="226" width="105" height="14" rx="2" fill="#f4c053" opacity="0.9" />
                  <rect x="75" y="212" width="115" height="14" rx="2" fill="#ffffff" opacity="0.85" />
                  {/* plant pot 1 */}
                  <path d="M215 270 L225 245 L275 245 L285 270 Z" fill="#f4c053" opacity="0.9" />
                  <path d="M250 245 C240 210 230 205 235 180 C245 195 258 200 250 245 Z" fill="#ffffff" opacity="0.75" />
                  <path d="M250 245 C260 215 275 210 275 185 C265 200 258 210 250 245 Z" fill="#ffffff" opacity="0.6" />
                  {/* plant pot 2 */}
                  <rect x="300" y="248" width="52" height="22" rx="3" fill="#ffffff" opacity="0.85" />
                  <path d="M326 248 C316 220 310 205 320 175 C330 195 340 215 326 248 Z" fill="#f4c053" opacity="0.85" />
                  <path d="M326 248 C336 225 344 215 350 190 C346 210 342 225 326 248 Z" fill="#ffffff" opacity="0.7" />
                  {/* pencil cup */}
                  <rect x="120" y="180" width="42" height="32" rx="3" fill="#25397c" />
                  <rect x="128" y="150" width="4" height="35" fill="#f4c053" />
                  <rect x="138" y="155" width="4" height="30" fill="#ffffff" opacity="0.8" />
                  <rect x="148" y="145" width="4" height="40" fill="#f4c053" opacity="0.85" />
                  {/* floating question mark */}
                  <circle cx="360" cy="70" r="26" fill="none" stroke="#f4c053" strokeWidth="1.5" opacity="0.5" strokeDasharray="3 4" />
                  <text x="360" y="80" textAnchor="middle" fontSize="34" fill="#f4c053" fontFamily="Times New Roman" fontWeight="bold">?</text>
                  {/* floating check */}
                  <circle cx="60" cy="120" r="22" fill="#f4c053" opacity="0.2" />
                  <path d="M50 120 L58 128 L72 112" stroke="#f4c053" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Bottom curve */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-background" style={{ clipPath: "ellipse(80% 100% at 50% 100%)" }} />
      </section>


      {/* ══════ PRICING CTA ══════ */}
      <section className="py-16 md:py-20 bg-background relative -mt-10 z-10">
        <div className="container">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-10">
            <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-3">আমাদের মূল্য তালিকা</h2>
            <p className="text-muted-foreground mb-0 max-w-2xl mx-auto">
              সাশ্রয়ী মূল্যে সকল বিষয়ের প্রশ্নব্যাংক — আপনার প্রয়োজন অনুযায়ী প্যাকেজ বেছে নিন
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto">
            {/* Card 1: প্রশ্ন তৈরির প্যাকেজ */}
            <motion.div custom={1} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
              <div className="relative group rounded-2xl overflow-hidden border border-primary/20 hover-lift shadow-premium">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/3 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative rounded-2xl bg-card p-7 h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <PenTool className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="font-heading font-bold text-lg text-foreground">প্রশ্ন তৈরী করার প্যাকেজ</h3>
                  </div>
                  <p className="text-muted-foreground text-sm mb-5 leading-relaxed flex-1">১ ক্লিকে কাস্টম প্রশ্নপত্র তৈরি করুন — MCQ, সৃজনশীল, সংক্ষিপ্ত সবকিছু।</p>
                  <div className="flex flex-wrap gap-2 mb-5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> ৬ষ্ঠ - ১২শ শ্রেণী
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-muted text-muted-foreground border border-border">
                      <Zap className="w-3.5 h-3.5" /> ৩য় - ৫ম শ্রেণী (শীঘ্রই)
                    </span>
                  </div>
                  <Link to="/pricing">
                    <Button className="w-full rounded-xl font-heading font-bold btn-gold border-0 gap-2 h-11">
                      Buy Now <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>

            {/* Card 2: রেডি প্রশ্ন প্যাকেজ */}
            <motion.div custom={2} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
              <div className="relative group rounded-2xl overflow-hidden border border-border hover-lift shadow-premium">
                {/* Coming Soon animated badge */}
                <div className="absolute top-4 right-4 z-10">
                  <span className="relative inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full text-white overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(35 92% 50%), hsl(25 95% 53%), hsl(35 92% 50%))", backgroundSize: "200% 200%", animation: "comingSoonShimmer 2s ease-in-out infinite" }}>
                    <Clock className="w-3.5 h-3.5" />
                    Coming Soon
                    <span className="absolute inset-0 rounded-full" style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)", backgroundSize: "200% 100%", animation: "comingSoonGlow 2s linear infinite" }} />
                  </span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-muted/50 via-transparent to-muted/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative rounded-2xl bg-card p-7 h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="font-heading font-bold text-lg text-foreground">রেডি প্রশ্ন প্যাকেজ</h3>
                  </div>
                  <p className="text-muted-foreground text-sm mb-5 leading-relaxed flex-1">বিশেষজ্ঞ শিক্ষকদের তৈরি রেডিমেড প্রশ্নপত্র — ডাউনলোড করে সরাসরি ব্যবহার করুন।</p>
                  <div className="flex flex-wrap gap-2 mb-5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-muted text-muted-foreground border border-border">
                      <Zap className="w-3.5 h-3.5" /> ৬ষ্ঠ - ১২শ শ্রেণী (শীঘ্রই)
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-muted text-muted-foreground border border-border">
                      <Zap className="w-3.5 h-3.5" /> ৩য় - ৫ম শ্রেণী (শীঘ্রই)
                    </span>
                  </div>
                  <button disabled className="w-full rounded-xl font-heading font-semibold gap-2 h-11 cursor-not-allowed relative overflow-hidden flex items-center justify-center text-sm text-white" style={{ background: "linear-gradient(135deg, hsl(35 92% 50%), hsl(25 95% 53%), hsl(35 92% 50%))", backgroundSize: "200% 200%", animation: "comingSoonShimmer 2s ease-in-out infinite" }}>
                    <Clock className="w-4 h-4" />
                    Coming Soon
                    <span className="absolute inset-0 rounded-xl" style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)", backgroundSize: "200% 100%", animation: "comingSoonGlow 2s linear infinite" }} />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>

          {/* সম্পূর্ণ মূল্য তালিকা বাটন */}
          <motion.div custom={3} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mt-8">
            <Link to="/pricing">
              <Button variant="outline" size="lg" className="rounded-xl font-heading font-semibold btn-outline-navy gap-2 px-8 h-12">
                সম্পূর্ণ মূল্য তালিকা <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ══════ STATS ══════ */}
      <section className="py-16 md:py-20 bg-background">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {stats.map((s, i) =>
            <motion.div key={i} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                <div className="glass-card-light rounded-2xl p-7 text-center hover-lift">
                  <s.icon className="w-8 h-8 mx-auto mb-3 text-primary" />
                  <div className="font-heading font-extrabold text-3xl md:text-4xl text-foreground mb-1">{s.value}</div>
                  <div className="text-muted-foreground text-sm">{s.label}</div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* ══════ WHAT IS PROSHNO LAB ══════ */}
      <section className="py-16 md:py-20 bg-background">
        <div className="container max-w-3xl mx-auto text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-5">
              Proshno Lab কী?
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6">
              Proshno Lab বাংলাদেশের শিক্ষক, শিক্ষার্থী ও শিক্ষাপ্রতিষ্ঠানের জন্য তৈরি একটি ডিজিটাল প্রশ্নব্যাংক ও প্রশ্নপত্র তৈরির প্ল্যাটফর্ম। এখানে ৬ষ্ঠ থেকে দ্বাদশ শ্রেণির বিভিন্ন বিষয়ের MCQ, সৃজনশীল, সংক্ষিপ্ত ও ব্যাখ্যামূলক প্রশ্ন সংরক্ষণ, অনুসন্ধান, সংগঠন এবং প্রিন্ট-প্রস্তুত প্রশ্নপত্র হিসেবে তৈরি করা যায় মাত্র কয়েকটি ক্লিকে।
            </p>
            <p className="text-base text-muted-foreground leading-relaxed">
              শিক্ষকরা নিজেদের প্রয়োজন অনুযায়ী ক্লাস, বিষয়, অধ্যায় ও টপিক নির্বাচন করে কাস্টমাইজড প্রশ্নপত্র তৈরি করতে পারেন; শিক্ষার্থীরা নির্দিষ্ট অধ্যায় অনুযায়ী প্র্যাকটিস করতে পারে। Proshno Lab-এর লক্ষ্য পরীক্ষার প্রস্তুতিকে আরও সহজ, দ্রুত ও কার্যকর করা।
            </p>
          </motion.div>
        </div>
      </section>

      {/* ══════ CATEGORIES ══════ */}
      <section className="py-16 md:py-20 bg-slate-alt">
        <div className="container">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-10">
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-3">আমাদের SmartApp শিক্ষা কার্যক্রমকে সমৃদ্ধ করেছে</h2>
            <p className="text-muted-foreground text-lg max-w-lg mx-auto">দেশজুড়ে প্রতিটি পাবলিক পরীক্ষার প্রশ্ন।</p>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {categories.map((cat, i) =>
            <motion.div key={i} custom={i + 1} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                <div className="bg-card rounded-2xl p-6 text-center hover-lift cursor-pointer group shadow-premium">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <cat.icon className="w-6 h-6 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{cat.label}</span>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </section>

       <section className="py-16 md:py-24 bg-background">
        <div className="container">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-14">
            <h2 className="font-heading text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 whitespace-nowrap">সম্মানিত শিক্ষকরা যা বলছেন !</h2>
            <p className="text-muted-foreground text-lg">সরাসরি ব্যবহারকারীদের অভিজ্ঞতা</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {reviews.map((t, i) =>
            <motion.div key={t.id} custom={i + 1} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                <div className="bg-card rounded-2xl p-7 shadow-premium hover-lift h-full flex flex-col">
                  <div className="flex items-center gap-0.5 mb-4">
                    {Array.from({ length: 5 }).map((_, j) =>
                  <Star key={j} className={`w-4 h-4 ${j < t.rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/20"}`} />
                  )}
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed flex-1 mb-5">"{t.text}"</p>
                  <div className="flex items-center gap-3 pt-4 border-t border-border">
                    {t.image_url ?
                  <img src={t.image_url} alt="" className="w-10 h-10 rounded-full object-cover" /> :

                  <div className="w-10 h-10 rounded-full gradient-navy flex items-center justify-center text-white font-heading font-bold text-sm">
                        {t.name.charAt(0)}
                      </div>
                  }
                    <div>
                      <p className="font-heading font-semibold text-sm text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.designation}{t.institution ? `, ${t.institution}` : ""}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={4} className="text-center mt-10">
            <ReviewModal onSuccess={fetchReviews} />
          </motion.div>
        </div>
      </section>

      {/* ══════ FAQ ══════ */}
      <section className="py-16 md:py-24 bg-slate-alt">
        <div className="container max-w-3xl">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-14">
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-3">আপনার সব প্রশ্নের উত্তর এখানে !</h2>
          </motion.div>
          <div className="space-y-0">
            {faqs.map((faq, i) =>
            <motion.div key={i} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full text-left py-5 border-b border-border flex items-center justify-between gap-4 group">

                  <span className="text-foreground font-medium text-sm md:text-base group-hover:text-primary transition-colors">{faq.question}</span>
                  <ChevronDown className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence initial={false}>
                  {openFaq === i &&
                <motion.div
                  key="content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden">

                      <p className="text-muted-foreground text-sm pb-5 leading-relaxed">{faq.answer}</p>
                    </motion.div>
                }
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* ══════ CTA ══════ */}
      <section className="gradient-hero py-20 md:py-28">
        <div className="container text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-white mb-4">
              আজই শুরু করুন !
            </h2>
            <p className="text-white/60 text-lg mb-8 max-w-md mx-auto">
              বাংলাদেশের সবচেয়ে বড় ডিজিটাল Proshno Lab প্ল্যাটফর্মে যোগ দিন
            </p>
            <div className="flex justify-center">
              <Link to="/register">
                <Button size="lg" className="btn-gold border-0 font-heading font-bold px-10 h-14 rounded-xl text-base gap-2">
                  ফ্রি রেজিস্ট্রেশন
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>);

}