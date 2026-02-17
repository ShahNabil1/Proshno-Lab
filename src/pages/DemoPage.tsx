import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

const sampleQuestions = [
  { id: 1, q: "বাংলাদেশের রাজধানী কোনটি?", opts: ["চট্টগ্রাম", "ঢাকা", "খুলনা", "রাজশাহী"] },
  { id: 2, q: "সূর্য কেন আলো দেয়?", opts: ["তাপ বিকিরণ", "পরমাণু বিস্ফোরণ", "নিউক্লিয়ার ফিউশন", "বৈদ্যুতিক তরঙ্গ"] },
  { id: 3, q: "নোবেল পুরস্কার কবে থেকে প্রদান করা শুরু হয়?", opts: ["১৮৯৫", "১৯০১", "১৯১০", "১৯২৫"] },
  { id: 4, q: "বাংলা ভাষার প্রথম গ্রন্থ কোনটি?", opts: ["মেঘনাদ বধ কাব্য", "চর্যাপদ", "গীতাঞ্জলি", "সোনার তরী"] },
  { id: 5, q: "বাংলাদেশের জাতীয় পতাকার রং কী কী?", opts: ["সবুজ ও লাল", "সবুজ ও সাদা", "লাল ও সাদা", "নীল ও সবুজ"] },
];

export default function DemoPage() {
  const [selected, setSelected] = useState<Set<number>>(new Set([1]));
  const [page, setPage] = useState(0);

  const toggle = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedQuestions = sampleQuestions.filter(q => selected.has(q.id));
  const perPage = 3;
  const totalPages = Math.ceil(sampleQuestions.length / perPage);
  const pageQuestions = sampleQuestions.slice(page * perPage, (page + 1) * perPage);

  return (
    <div>
      {/* Hero */}
      <section className="gradient-hero pt-28 pb-16 md:pt-36 md:pb-20">
        <div className="container text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="font-heading text-3xl md:text-5xl font-extrabold text-white mb-4">
              ১ ক্লিকে প্রশ্ন তৈরী !
            </h1>
            <p className="text-white/60 text-lg max-w-lg mx-auto">
              শুধু প্রশ্ন সিলেক্ট করুন, প্রশ্নপত্র তৈরী হবে অটোমেটিক !
            </p>
          </motion.div>
        </div>
      </section>

      {/* Builder */}
      <section className="py-12 md:py-20 bg-background -mt-6 relative z-10">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 max-w-6xl mx-auto">
            {/* Question selector */}
            <div className="lg:col-span-3">
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
                <div className="bg-card rounded-2xl shadow-premium p-6 md:p-8">
                  <h2 className="font-heading font-bold text-lg text-foreground mb-1">প্রশ্ন সিলেক্ট করুন</h2>
                  <p className="text-muted-foreground text-sm mb-6">প্রশ্নগুলো সিলেক্ট করে সাবমিট করলেই প্রশ্ন তৈরী হয়ে যাবে ।</p>

                  <div className="space-y-3">
                    {pageQuestions.map((q) => (
                      <button
                        key={q.id}
                        onClick={() => toggle(q.id)}
                        className={`w-full text-left rounded-xl border-2 p-5 transition-all ${selected.has(q.id) ? "border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(155_72%_44%/0.15)]" : "border-border bg-card hover:border-primary/30"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium text-foreground">{q.id}. {q.q}</p>
                          {selected.has(q.id) && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          {q.opts.map((o, oi) => (
                            <span key={oi} className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-md">
                              {String.fromCharCode(0x0995 + oi)}. {o}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-center gap-4 mt-6">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="rounded-lg">← পূর্ববর্তী</Button>
                    <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="rounded-lg">পরবর্তী →</Button>
                  </div>

                  <Button className="w-full mt-6 gradient-green text-white border-0 rounded-xl font-heading font-semibold h-11" disabled={selected.size === 0}>
                    সাবমিট করুন
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </motion.div>
            </div>

            {/* PDF Preview */}
            <div className="lg:col-span-2">
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}>
                <div className="bg-card rounded-2xl shadow-elevated p-1 border border-border sticky top-24">
                  <div className="rounded-xl bg-background p-6">
                    <div className="flex items-center gap-2 mb-5 pb-4 border-b border-border">
                      <FileText className="w-5 h-5 text-primary" />
                      <span className="font-heading font-semibold text-sm text-foreground">প্রশ্নপত্র প্রিভিউ</span>
                    </div>

                    <div className="text-center mb-4">
                      <p className="font-heading font-bold text-foreground text-sm">স্বপ্নছোয়া একাডেমি</p>
                      <p className="text-xs text-muted-foreground">শ্রেণিঃ ষষ্ঠ | বিষয়ঃ সাধারণ জ্ঞান</p>
                      <div className="flex justify-between text-xs text-muted-foreground mt-2">
                        <span>সময়ঃ {selectedQuestions.length} মিনিট</span>
                        <span>পূর্ণমানঃ {selectedQuestions.length}</span>
                      </div>
                    </div>

                    {selectedQuestions.length === 0 ? (
                      <p className="text-center text-muted-foreground text-sm py-8">প্রশ্ন সিলেক্ট করুন</p>
                    ) : (
                      <div className="space-y-4">
                        {selectedQuestions.map((q, i) => (
                          <div key={q.id}>
                            <p className="text-xs text-foreground font-medium mb-1">{i + 1}. {q.q}</p>
                            <div className="grid grid-cols-2 gap-1">
                              {q.opts.map((o, oi) => (
                                <span key={oi} className="text-[11px] text-muted-foreground">
                                  {String.fromCharCode(0x0995 + oi)}. {o}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
