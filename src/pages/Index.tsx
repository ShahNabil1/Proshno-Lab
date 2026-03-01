import { Link, Navigate, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, PenTool, FileText, AlignLeft, ArrowRight,
  CheckCircle2, Users, FileCheck, Star, ChevronDown, ChevronRight,
  Zap, Shield, BarChart3, GraduationCap } from
"lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import ReviewModal from "@/components/ReviewModal";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const }
  })
};

const stats = [
{ value: "৩০,০০০+", label: "শিক্ষা প্রতিষ্ঠান যুক্ত", icon: Users },
{ value: "২,২০০+", label: "প্রশ্ন তৈরি হচ্ছে প্রতিদিন", icon: FileCheck },
{ value: "৫ লক্ষ+", label: "মোট প্রশ্ন তৈরি হয়েছে", icon: BarChart3 }];


const categories = [
{ icon: BookOpen, label: "বোর্ড প্রশ্ন" },
{ icon: FileText, label: "নির্বাচনী পরীক্ষার প্রশ্ন" },
{ icon: GraduationCap, label: "এডমিশন" },
{ icon: Shield, label: "মেডিকেল" }];






export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [faqs, setFaqs] = useState<{id: number;question: string;answer: string;}[]>([]);
  const [reviews, setReviews] = useState<{id: number;name: string;designation: string;institution: string;image_url: string;rating: number;text: string;}[]>([]);

  const fetchReviews = () => {
    supabase.
    from("reviews").
    select("id, name, designation, institution, image_url, rating, text").
    eq("status", "approved").
    order("created_at", { ascending: false }).
    limit(6).
    then(({ data }) => {if (data) setReviews(data as any);});
  };

  useEffect(() => {
    supabase.
    from("faqs").
    select("id, question, answer").
    eq("is_active", true).
    order("sort_order", { ascending: true }).
    then(({ data }) => {if (data) setFaqs(data as any);});
    fetchReviews();
  }, []);

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="overflow-hidden">
      {/* ══════ HERO ══════ */}
      <section className="gradient-hero relative pt-28 pb-20 md:pt-40 md:pb-32">
        {/* Abstract BG shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 right-[15%] w-72 h-72 rounded-full bg-primary/8 blur-[100px] animate-pulse-soft" />
          <div className="absolute bottom-10 left-[10%] w-96 h-96 rounded-full bg-primary/5 blur-[120px] animate-pulse-soft" style={{ animationDelay: "2s" }} />
          <svg className="absolute top-32 left-[8%] w-64 h-64 opacity-[0.03]" viewBox="0 0 200 200"><circle cx="100" cy="100" r="80" stroke="white" strokeWidth="0.5" fill="none" /><circle cx="100" cy="100" r="60" stroke="white" strokeWidth="0.3" fill="none" /></svg>
          <svg className="absolute bottom-20 right-[8%] w-48 h-48 opacity-[0.04]" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" rx="8" stroke="white" strokeWidth="0.5" fill="none" transform="rotate(15 50 50)" /></svg>
        </div>

        <div className="container relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-white/80 text-sm font-medium mb-8 border border-white/10">
              <Zap className="w-4 h-4 text-primary" />
              ১ ক্লিকে প্রশ্নপত্র তৈরি করুন
            </div>

            <h1 className="font-heading text-4xl md:text-5xl lg:text-[3.5rem] font-extrabold text-white leading-[1.15] mb-6">
              পরীক্ষার প্রশ্ন তৈরি এখন
              <br />
              <span className="text-gradient-green">আরও সহজ, আরও দ্রুত</span>
            </h1>

            <p className="text-lg md:text-xl text-white/60 mb-10 max-w-xl mx-auto leading-relaxed">
               ৬ষ্ঠ থেকে দ্বাদশ শ্রেণির প্রশ্ন তৈরি করুন মাত্র ১ ক্লিকে। শিক্ষক ও শিক্ষার্থীদের জন্য সম্পূর্ণ স্মার্ট সমাধান।
            
            </p>

            <div className="flex justify-center">
              <Link to={user ? "/dashboard/create" : "/login"}>
                <Button size="lg" className="gradient-green text-white border-0 font-heading font-semibold text-lg px-10 h-14 rounded-xl shadow-[0_4px_20px_hsl(155_72%_44%/0.3)] hover:shadow-[0_6px_28px_hsl(155_72%_44%/0.4)] transition-shadow">
                  প্রশ্ন তৈরি করুন
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════ PRICING CTA ══════ */}
      <section className="py-16 md:py-20 bg-background relative -mt-10 z-10">
        <div className="container">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center">
            <div className="max-w-2xl mx-auto relative overflow-hidden rounded-3xl gradient-hero p-10 md:p-14">
              {/* Decorative circles */}
              <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-primary/20 blur-2xl" />
              <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-primary/15 blur-2xl" />
              
              <div className="relative z-10">
                <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-primary/20 backdrop-blur-sm border border-primary/30 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-primary" />
                </div>
                <h2 className="font-heading text-2xl md:text-3xl font-bold text-white mb-3">আমাদের মূল্য তালিকা</h2>
                <p className="text-white/60 mb-8 max-w-md mx-auto">
                  সাশ্রয়ী মূল্যে সকল বিষয়ের প্রশ্নব্যাংক — আপনার প্রয়োজন অনুযায়ী প্যাকেজ বেছে নিন
                </p>
                <Link to="/pricing">
                  <Button size="lg" className="gradient-green text-primary-foreground border-0 font-heading font-semibold px-10 py-6 rounded-xl gap-2 text-base shadow-lg hover:shadow-xl transition-shadow">
                    মূল্য তালিকা দেখুন
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
              </div>
            </div>
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

                  <div className="w-10 h-10 rounded-full gradient-green flex items-center justify-center text-white font-heading font-bold text-sm">
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
                <AnimatePresence>
                  {openFaq === i &&
                <motion.div
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
              বাংলাদেশের সবচেয়ে বড় ডিজিটাল eExamapp প্ল্যাটফর্মে যোগ দিন
            </p>
            <div className="flex justify-center">
              <Link to="/register">
                <Button size="lg" className="gradient-green text-white border-0 font-heading font-semibold px-10 h-14 rounded-xl shadow-[0_4px_20px_hsl(155_72%_44%/0.3)] text-base">
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