import { Link, Navigate, useNavigate } from "react-router-dom";
import BrandLogo from "@/components/BrandLogo";
import { motion } from "framer-motion";
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
import questionPaperIcon from "@/assets/question-paper-icon.png.asset.json";

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
                <span className="block">প্রশ্ন তৈরি করতে এখনও হাজার</span>
                <span className="block">হাজার টাকা ও ঘণ্টার পর ঘণ্টা</span>
                <span className="block">সময় নষ্ট হচ্ছে?</span>
              </h1>

              <p className="font-heading text-white/85 text-base md:text-lg leading-relaxed mb-8 max-w-xl">
                <BrandLogo size={30} plate={false} className="align-middle text-white [&_.text-brand-navy]:text-white" />
                <span className="text-white/70">-এ</span> মাত্র কয়েক ক্লিকেই তৈরি করুন ষষ্ঠ থেকে দ্বাদশ শ্রেণির প্রশ্নপত্র{" "}
                <span className="brand-free">ফ্রী</span>

              </p>

              <div className="flex flex-wrap gap-3">
                <Link to={user ? "/dashboard/create" : "/login"}>
                  <Button
                    size="lg"
                    className="btn-gold font-heading font-bold text-[15px] h-12 px-6 rounded-lg border-0 gap-2"
                  >
                    <img
                      src={questionPaperIcon.url}
                      alt="প্রশ্নপত্র আইকন"
                      className="w-5 h-5 object-contain"
                    />
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


      {/* ══════ WIZARD PREVIEW (3-step demo, matches /dashboard/create) ══════ */}
      <section className="py-12 md:py-16 bg-background relative -mt-6 z-10">
        <div className="container max-w-5xl">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} custom={0} className="text-center mb-10"
          >
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-3">
              মাত্র ৩ ধাপে প্রশ্নপত্র তৈরি
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              শ্রেণি, বিষয় ও অধ্যায় বেছে নিন — প্রশ্নের ধরন ও সংখ্যা ঠিক করুন — এক ক্লিকে প্রিন্ট-প্রস্তুত প্রশ্নপত্র।
            </p>
          </motion.div>

          {/* Mode toggle pills (mirrors CreateModeToggle) */}
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} custom={1}
            className="flex flex-wrap justify-center gap-3 mb-6"
          >
            {[
              { label: "অটো প্রশ্ন তৈরি", active: true },
              { label: "প্রশ্ন তৈরি", active: false },
              { label: "রেডি প্রশ্ন", active: false },
            ].map((m) => (
              <div
                key={m.label}
                className={`px-6 py-2 rounded-lg border font-heading text-sm ${
                  m.active
                    ? "bg-navy text-white border-navy shadow-md"
                    : "bg-card text-foreground border-border"
                }`}
              >
                {m.label}
              </div>
            ))}
          </motion.div>

          {/* Wizard steps */}
          {[
            {
              tabIndex: 0,
              title: "ধাপ ১: শ্রেণি, বিষয় ও অধ্যায় নির্বাচন করুন",
              desc: "প্রথমে আপনার প্রয়োজনীয় শ্রেণি, বিষয় এবং কোন কোন অধ্যায় থেকে প্রশ্ন করতে চান তা সিলেক্ট করুন।",
              body: (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { label: "শ্রেণি", value: "ষষ্ঠ শ্রেণি", select: true },
                    { label: "বিষয়", value: "-- বিষয় নির্বাচন করুন --", select: true },
                    {
                      label: "অধ্যায় (একাধিক)",
                      list: [
                        { text: "অধ্যায় ১: প্রাণীজগতের শ্রেণিবিন্যাস", checked: true },
                        { text: "অধ্যায় ২: কোষ বিভাজন", checked: false },
                        { text: "অধ্যায় ৩: উদ্ভিদের গঠন", checked: false },
                      ],
                    },
                  ].map((col: any, i) => (
                    <div key={i} className="rounded-xl border border-border bg-card p-4">
                      <div className="text-xs font-semibold text-muted-foreground mb-2">{col.label}</div>
                      {col.select && (
                        <div className="h-10 rounded-md border border-border bg-background flex items-center justify-between px-3 text-sm text-foreground">
                          <span>{col.value}</span>
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      {col.list && (
                        <div className="space-y-2">
                          {col.list.map((it: any, j: number) => (
                            <label key={j} className="flex items-center gap-2 text-sm text-foreground">
                              <span
                                className={`w-4 h-4 rounded border flex items-center justify-center ${
                                  it.checked ? "bg-primary border-primary" : "bg-background border-border"
                                }`}
                              >
                                {it.checked && <CheckCircle2 className="w-3 h-3 text-white" />}
                              </span>
                              {it.text}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ),
              back: false,
            },
            {
              tabIndex: 1,
              title: "ধাপ ২: প্রশ্নের ধরন ও সংখ্যা নির্বাচন করুন",
              desc: "সিস্টেম স্বয়ংক্রিয়ভাবে প্রশ্ন জেনারেট করার জন্য প্রতিটি ধরন থেকে কতটি প্রশ্ন চান তা নির্দিষ্ট করুন।",
              body: (
                <div className="space-y-4">
                  {[
                    { label: "MCQ প্রশ্নের সংখ্যা", value: 10, pct: 20 },
                    { label: "সৃজনশীল (CQ) প্রশ্নের সংখ্যা", value: 2, pct: 10 },
                  ].map((s, i) => (
                    <div key={i} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-foreground">{s.label}</span>
                        <span className="font-heading font-bold text-navy">{s.value}</span>
                      </div>
                      <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-navy rounded-full"
                          style={{ width: `${s.pct}%` }}
                        />
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-navy shadow"
                          style={{ left: `calc(${s.pct}% - 8px)` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ),
              back: true,
            },
            {
              tabIndex: 2,
              title: "",
              desc: "",
              body: (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full border-2 border-primary flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="font-heading font-bold text-2xl text-foreground mb-6">
                    আপনার প্রশ্নপত্র প্রস্তুত!
                  </h3>
                  <div className="max-w-md mx-auto rounded-xl border border-border bg-card p-5 text-left">
                    <div className="text-sm font-semibold text-navy border-b border-border pb-2 mb-3">
                      সারাংশ:
                    </div>
                    <ul className="text-sm text-foreground space-y-1.5">
                      <li>শ্রেণি: ষষ্ঠ শ্রেণি</li>
                      <li>বিষয়: বিজ্ঞান</li>
                      <li>অধ্যায়: অধ্যায় ১: প্রাণীজগতের শ্রেণিবিন্যাস</li>
                      <li>MCQ: ১০ টি</li>
                      <li>CQ: ২ টি</li>
                      <li>মোট মূল্য: ৳০</li>
                    </ul>
                  </div>
                </div>
              ),
              back: true,
              cta: true,
            },
          ].map((step, sIdx) => (
            <motion.div
              key={sIdx}
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              variants={fadeUp} custom={sIdx + 2}
              className="mb-8 rounded-2xl border border-border bg-card shadow-premium overflow-hidden"
            >
              {/* Tab strip */}
              <div className="grid grid-cols-3 border-b border-border">
                {["১. বিষয়", "২. কনফিগ", "৩. জেনারেট"].map((t, ti) => (
                  <div
                    key={ti}
                    className={`text-center py-3 font-heading font-semibold text-sm md:text-base ${
                      ti === step.tabIndex
                        ? "bg-navy text-white"
                        : "text-muted-foreground bg-background"
                    }`}
                  >
                    {t}
                  </div>
                ))}
              </div>

              <div className="p-6 md:p-8">
                {step.title && (
                  <h3 className="font-heading font-bold text-lg md:text-xl text-foreground mb-2">
                    {step.title}
                  </h3>
                )}
                {step.desc && (
                  <p className="text-sm text-muted-foreground mb-6">{step.desc}</p>
                )}

                {step.body}

                {/* Footer buttons */}
                <div className="flex items-center justify-between mt-6">
                  {step.back ? (
                    <button className="h-10 px-4 rounded-lg border border-border text-sm font-medium text-foreground bg-background inline-flex items-center gap-2">
                      ← আগের ধাপে যান
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    className={`h-10 px-5 rounded-lg font-heading font-semibold text-sm inline-flex items-center gap-2 ${
                      step.cta
                        ? "bg-primary text-primary-foreground"
                        : "bg-navy text-white"
                    }`}
                  >
                    {step.cta ? (
                      <>
                        <Sparkles className="w-4 h-4" />
                        প্রশ্ন তৈরি করুন
                      </>
                    ) : (
                      <>পরবর্তী ধাপ →</>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════ REVIEWS ══════ */}
      <section className="py-10 md:py-14 bg-background border-t border-border/50">
        <div className="container">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
              <Users className="w-3.5 h-3.5" />
              ব্যবহারকারীদের মতামত
            </div>
            <h2 className="font-heading text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2">সম্মানিত শিক্ষকরা যা বলছেন !</h2>
            <p className="text-muted-foreground text-base md:text-lg">সরাসরি ব্যবহারকারীদের অভিজ্ঞতা</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {reviews.map((t, i) =>
            <motion.div key={t.id} custom={i + 1} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                <div className="bg-card rounded-2xl p-6 shadow-premium hover-lift h-full flex flex-col border border-border/60">
                  <div className="flex items-center gap-0.5 mb-3">
                    {Array.from({ length: 5 }).map((_, j) =>
                  <Star key={j} className={`w-4 h-4 ${j < t.rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/20"}`} />
                  )}
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed flex-1 mb-4">"{t.text}"</p>
                  <div className="flex items-center gap-3 pt-3 border-t border-border">
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
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={4} className="text-center mt-8">
            <ReviewModal onSuccess={fetchReviews} />
          </motion.div>
        </div>
      </section>

    </div>);

}