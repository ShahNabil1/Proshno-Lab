import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, FileText, Loader2, Sparkles, Printer, Shuffle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import LatexRenderer from "@/components/LatexRenderer";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

const toBanglaNum = (n: number): string => {
  const digits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(n).split("").map(d => digits[parseInt(d)] ?? d).join("");
};

const padBangla = (n: number): string => {
  const s = toBanglaNum(n);
  return s.length < 2 ? "০" + s : s;
};

interface FreeChapter {
  id: number;
  name: string;
  subject_id: number;
  subject_name: string;
  class_id: number;
  class_name: string;
}

interface QuestionRow {
  id: number;
  question: string;
  option_a?: string | null;
  option_b?: string | null;
  option_c?: string | null;
  option_d?: string | null;
  correct_answer?: string | null;
  type: string;
  stimulus_text?: string | null;
  stimulus_group_id?: string | null;
  creative_data?: any;
  board_references?: any;
}

export default function DemoPage() {
  const [freeChapters, setFreeChapters] = useState<FreeChapter[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedChapterId, setSelectedChapterId] = useState<string>("");
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [institution, setInstitution] = useState<string>("আপনার প্রতিষ্ঠানের নাম");
  const [examTime, setExamTime] = useState<string>("৫৫");
  const [showAnswers, setShowAnswers] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(0);



  // Fetch free chapters with class/subject info
  useEffect(() => {
    const fetchFree = async () => {
      const { data } = await supabase
        .from("chapters")
        .select("id, name, subject_id, subjects!inner(name, class_id, classes!inner(name))")
        .eq("is_free", true)
        .eq("is_active", true) as any;

      if (data) {
        const mapped: FreeChapter[] = data.map((ch: any) => ({
          id: ch.id,
          name: ch.name,
          subject_id: ch.subject_id,
          subject_name: ch.subjects?.name || "",
          class_id: ch.subjects?.class_id || 0,
          class_name: ch.subjects?.classes?.name || "",
        }));
        setFreeChapters(mapped);
        // Auto-select if only one class
        const uniqueClasses = [...new Set(mapped.map(c => c.class_id))];
        if (uniqueClasses.length === 1) {
          setSelectedClassId(String(uniqueClasses[0]));
          const uniqueSubjects = [...new Set(mapped.filter(c => c.class_id === uniqueClasses[0]).map(c => c.subject_id))];
          if (uniqueSubjects.length === 1) {
            setSelectedSubjectId(String(uniqueSubjects[0]));
            const chaps = mapped.filter(c => c.subject_id === uniqueSubjects[0]);
            if (chaps.length === 1) {
              setSelectedChapterId(String(chaps[0].id));
            }
          }
        }
      }
    };
    fetchFree();
  }, []);

  // Derive unique classes, subjects, chapters
  const uniqueClasses = useMemo(() => {
    const map = new Map<number, string>();
    freeChapters.forEach(c => map.set(c.class_id, c.class_name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [freeChapters]);

  const filteredSubjects = useMemo(() => {
    if (!selectedClassId) return [];
    const map = new Map<number, string>();
    freeChapters.filter(c => c.class_id === Number(selectedClassId)).forEach(c => map.set(c.subject_id, c.subject_name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [freeChapters, selectedClassId]);

  const filteredChapters = useMemo(() => {
    if (!selectedSubjectId) return [];
    return freeChapters.filter(c => c.subject_id === Number(selectedSubjectId));
  }, [freeChapters, selectedSubjectId]);

  // Fetch questions
  const handleFetchQuestions = async () => {
    if (!selectedChapterId) return;
    setLoading(true);
    setFetched(false);
    const { data } = await supabase
      .from("questions")
      .select("id, question, option_a, option_b, option_c, option_d, correct_answer, type, stimulus_text, stimulus_group_id, creative_data, board_references")
      .eq("chapter_id", Number(selectedChapterId))
      .limit(50);

    if (data) {
      setQuestions(data as QuestionRow[]);
      setSelectedIds(new Set(data.map((q: any) => q.id)));
    }
    setFetched(true);
    setLoading(false);
  };

  const toggleQuestion = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const q = questions.find(q => q.id === id);
      if (q?.stimulus_group_id) {
        const group = questions.filter(gq => gq.stimulus_group_id === q.stimulus_group_id);
        const isAdding = !next.has(id);
        group.forEach(gq => isAdding ? next.add(gq.id) : next.delete(gq.id));
      } else {
        next.has(id) ? next.delete(id) : next.add(id);
      }
      return next;
    });
  };

  // Sort: MCQ → Short → CQ → Descriptive
  const typePriority: Record<string, number> = { mcq: 1, short: 2, cq: 3, descriptive: 4 };
  const sortedQuestions = [...questions].sort((a, b) => (typePriority[a.type] ?? 5) - (typePriority[b.type] ?? 5));

  const selectedQuestions = sortedQuestions.filter(q => selectedIds.has(q.id));
  const mcqQuestions = selectedQuestions.filter(q => q.type === "mcq");
  const shortQuestions = selectedQuestions.filter(q => q.type === "short");
  const cqQuestions = selectedQuestions.filter(q => q.type === "cq");
  const descriptiveQuestions = selectedQuestions.filter(q => q.type === "descriptive");

  // Detect math subject
  const selectedChapter = freeChapters.find(c => String(c.id) === selectedChapterId);
  const isMathSubject = selectedChapter ? /গণিত|math|higher\s*math|উচ্চতর\s*গণিত/i.test(selectedChapter.subject_name) : false;

  const totalMarks = mcqQuestions.length + shortQuestions.length * 2 + cqQuestions.length * 10 + descriptiveQuestions.length * 10;

  return (
    <div>
      {/* Hero */}
      <section className="gradient-hero pt-28 pb-16 md:pt-36 md:pb-20">
        <div className="container text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-white/80 text-sm font-medium mb-6 border border-white/10">
              <Sparkles className="w-4 h-4 text-primary" />
              ফ্রি ডেমো — লগইন ছাড়াই ব্যবহার করুন
            </div>
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
                  {/* Filter selectors */}
                  <h2 className="font-heading font-bold text-lg text-foreground mb-4">শ্রেণী, বিষয় ও অধ্যায় নির্বাচন করুন</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                    <Select value={selectedClassId} onValueChange={(v) => { setSelectedClassId(v); setSelectedSubjectId(""); setSelectedChapterId(""); setQuestions([]); setFetched(false); }}>
                      <SelectTrigger className="rounded-lg">
                        <SelectValue placeholder="শ্রেণী" />
                      </SelectTrigger>
                      <SelectContent>
                        {uniqueClasses.map(c => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={selectedSubjectId} onValueChange={(v) => { setSelectedSubjectId(v); setSelectedChapterId(""); setQuestions([]); setFetched(false); }} disabled={!selectedClassId}>
                      <SelectTrigger className="rounded-lg">
                        <SelectValue placeholder="বিষয়" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredSubjects.map(s => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={selectedChapterId} onValueChange={(v) => { setSelectedChapterId(v); setQuestions([]); setFetched(false); }} disabled={!selectedSubjectId}>
                      <SelectTrigger className="rounded-lg">
                        <SelectValue placeholder="অধ্যায়" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredChapters.map(ch => (
                          <SelectItem key={ch.id} value={String(ch.id)}>{ch.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    className="w-full gradient-green text-white border-0 rounded-xl font-heading font-semibold h-11 mb-6"
                    disabled={!selectedChapterId || loading}
                    onClick={handleFetchQuestions}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    প্রশ্ন তৈরি করুন
                  </Button>

                  {/* Question list */}
                  {fetched && questions.length === 0 && (
                    <p className="text-center text-muted-foreground text-sm py-8">এই অধ্যায়ে কোনো ফ্রি প্রশ্ন পাওয়া যায়নি</p>
                  )}

                  {sortedQuestions.length > 0 && (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-heading font-bold text-sm text-foreground">
                          প্রশ্ন সিলেক্ট করুন ({toBanglaNum(selectedIds.size)}/{toBanglaNum(questions.length)})
                        </h3>
                        <button
                          onClick={() => {
                            if (selectedIds.size === questions.length) setSelectedIds(new Set());
                            else setSelectedIds(new Set(questions.map(q => q.id)));
                          }}
                          className="text-xs text-primary hover:underline font-medium"
                        >
                          {selectedIds.size === questions.length ? "সব বাদ দিন" : "সব সিলেক্ট"}
                        </button>
                      </div>
                      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                        {sortedQuestions.map((q) => (
                          <button
                            key={q.id}
                            onClick={() => toggleQuestion(q.id)}
                            className={`w-full text-left rounded-xl border-2 p-4 transition-all ${selectedIds.has(q.id) ? "border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(155_72%_44%/0.15)]" : "border-border bg-card hover:border-primary/30"}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${q.type === "mcq" ? "bg-primary/10 text-primary" : q.type === "short" ? "bg-blue-100 text-blue-700" : q.type === "cq" ? "bg-amber-100 text-amber-700" : "bg-purple-100 text-purple-700"}`}>
                                    {q.type === "mcq" ? "MCQ" : q.type === "short" ? "সংক্ষিপ্ত" : q.type === "cq" ? "সৃজনশীল" : "বর্ণনামূলক"}
                                  </span>
                                </div>
                                <p className="text-sm text-foreground">
                                  <LatexRenderer text={q.question} />
                                </p>
                                {q.type === "mcq" && (
                                  <div className="grid grid-cols-2 gap-1.5 mt-2">
                                    {(["option_a", "option_b", "option_c", "option_d"] as const).map((key, oi) => {
                                      const val = q[key]; if (!val) return null;
                                      return (
                                        <span key={key} className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-md">
                                          {["ক", "খ", "গ", "ঘ"][oi]}. <LatexRenderer text={val} />
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                              {selectedIds.has(q.id) && <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-1" />}
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            </div>

            {/* PDF Preview */}
            <div className="lg:col-span-2">
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}>
                <div className="bg-card rounded-2xl shadow-elevated p-1 border border-border sticky top-24">
                  <div className="rounded-xl bg-white p-5" style={{ fontFamily: "'SolaimanLipi', sans-serif", color: "#000" }}>
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                      <FileText className="w-5 h-5 text-primary" />
                      <span className="font-heading font-semibold text-sm text-foreground">প্রশ্নপত্র প্রিভিউ</span>
                    </div>

                    {/* Paper header */}
                    <div className="text-center mb-3">
                      <p className="font-bold text-sm" style={{ fontFamily: "'SolaimanLipi', sans-serif" }}>আপনার প্রতিষ্ঠানের নাম</p>
                      {selectedChapter && (
                        <p className="text-xs text-muted-foreground">
                          {selectedChapter.class_name} — {selectedChapter.subject_name}
                        </p>
                      )}
                      {selectedChapter && (
                        <p className="text-[10px] text-muted-foreground">({selectedChapter.name})</p>
                      )}
                      {selectedIds.size > 0 && (
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-2 border-t border-b border-black/20 py-1 font-semibold">
                          <span>সময়— ৫৫ মিনিট</span>
                          <span>পূর্ণমান— {toBanglaNum(totalMarks)}</span>
                        </div>
                      )}
                    </div>

                    {selectedIds.size === 0 ? (
                      <p className="text-center text-muted-foreground text-sm py-8">প্রশ্ন সিলেক্ট করুন</p>
                    ) : (
                      <div className="space-y-2 text-xs" style={{ lineHeight: 1.4 }}>
                        {/* MCQ Section */}
                        {mcqQuestions.length > 0 && (
                          <div>
                            <div className="flex justify-between items-center font-bold text-[11px] border-b border-black/30 pb-1 mb-1.5">
                              <span>বহুনির্বাচনি অংশ:</span>
                              <span>{toBanglaNum(mcqQuestions.length)} x {toBanglaNum(1)} = {toBanglaNum(mcqQuestions.length)}</span>
                            </div>
                            {mcqQuestions.map((q, idx) => (
                              <div key={q.id} className="mb-1.5">
                                <div style={{ display: "flex", alignItems: "baseline", gap: 0 }}>
                                  <span style={{ width: "1.6rem", flexShrink: 0, fontWeight: 600 }}>{padBangla(idx + 1)}।</span>
                                  <div style={{ flex: 1 }}>
                                    <LatexRenderer text={q.question} className="text-[11px]" />
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 8px", fontSize: "10px", lineHeight: 1.3 }}>
                                      {(["option_a", "option_b", "option_c", "option_d"] as const).map((key, oi) => {
                                        const val = q[key]; if (!val) return null;
                                        return (
                                          <span key={key}>
                                            ({["ক", "খ", "গ", "ঘ"][oi]}) <LatexRenderer text={val} />
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Short Section */}
                        {shortQuestions.length > 0 && (
                          <div>
                            {mcqQuestions.length > 0 && <div className="border-t border-black/20 my-2" />}
                            <div className="flex justify-between items-center font-bold text-[11px] border-b border-black/30 pb-1 mb-1.5">
                              <span>সংক্ষিপ্ত উত্তর প্রশ্ন (প্রতি প্রশ্নের মান ২)</span>
                              <span>{toBanglaNum(shortQuestions.length)} x {toBanglaNum(2)} = {toBanglaNum(shortQuestions.length * 2)}</span>
                            </div>
                            {shortQuestions.map((q, idx) => (
                              <div key={q.id} className="mb-1">
                                <span className="font-semibold">{padBangla(idx + 1)}।</span>{" "}
                                <LatexRenderer text={q.question} className="text-[11px]" />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* CQ Section */}
                        {cqQuestions.length > 0 && (
                          <div>
                            {(mcqQuestions.length > 0 || shortQuestions.length > 0) && <div className="border-t border-black/20 my-2" />}
                            <div className="text-center font-bold text-[11px] underline mb-1">
                              সৃজনশীল প্রশ্ন (প্রতিটি প্রশ্নের মান ১০)
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-semibold mb-1.5">
                              <span>সবগুলো প্রশ্নের উত্তর দাও :</span>
                              <span>{toBanglaNum(10)} x {toBanglaNum(cqQuestions.length)} = {toBanglaNum(cqQuestions.length * 10)}</span>
                            </div>
                            {cqQuestions.map((q, idx) => {
                              const cData = q.creative_data;
                              const subLabels = isMathSubject ? ["ক", "খ", "গ"] : ["ক", "খ", "গ", "ঘ"];
                              const subMarks = isMathSubject ? [2, 4, 4] : [1, 2, 3, 4];
                              const subQuestions = cData?.sub_questions || [];
                              return (
                                <div key={q.id} className="mb-2">
                                  <div className="font-semibold mb-0.5">
                                    {q.stimulus_text ? (
                                      <span>{padBangla(idx + 1)}। <span dangerouslySetInnerHTML={{ __html: q.stimulus_text }} /></span>
                                    ) : (
                                      <span>{padBangla(idx + 1)}। <LatexRenderer text={q.question} /></span>
                                    )}
                                  </div>
                                  {subQuestions.length > 0 && (
                                    <div className="ml-3">
                                      {subQuestions.map((sq: any, si: number) => {
                                        const label = subLabels[si];
                                        if (!label) return null;
                                        return (
                                          <div key={si} className="flex justify-between items-baseline">
                                            <span>({label}) <LatexRenderer text={sq.question || sq.text || ""} /></span>
                                            <span className="ml-2 font-medium flex-shrink-0">{toBanglaNum(subMarks[si])}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                  {(!subQuestions || subQuestions.length === 0) && cData && (
                                    <div className="ml-3">
                                      {(isMathSubject ? ["q_ka", "q_kha", "q_ga"] : ["q_ka", "q_kha", "q_ga", "q_gha"]).map((key, si) => {
                                        const text = cData[key];
                                        if (!text) return null;
                                        return (
                                          <div key={si} className="flex justify-between items-baseline">
                                            <span>({subLabels[si]}) <span dangerouslySetInnerHTML={{ __html: text }} /></span>
                                            <span className="ml-2 font-medium flex-shrink-0">{toBanglaNum(subMarks[si])}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Descriptive Section */}
                        {descriptiveQuestions.length > 0 && (
                          <div>
                            <div className="border-t border-black/20 my-2" />
                            <div className="flex justify-between items-center font-bold text-[11px] border-b border-black/30 pb-1 mb-1.5">
                              <span>বর্ণনামূলক প্রশ্ন (প্রতি প্রশ্নের মান ১০)</span>
                              <span>{toBanglaNum(10)} x {toBanglaNum(descriptiveQuestions.length)} = {toBanglaNum(descriptiveQuestions.length * 10)}</span>
                            </div>
                            {descriptiveQuestions.map((q, idx) => {
                              const dData = q.creative_data;
                              return (
                                <div key={q.id} className="mb-2">
                                  <span className="font-semibold">{padBangla(idx + 1)}।</span>
                                  {dData ? (
                                    <div className="ml-3">
                                      {dData.desc_q_ka && (
                                        <div className="flex justify-between items-baseline">
                                          <span>(ক) <span dangerouslySetInnerHTML={{ __html: dData.desc_q_ka }} /></span>
                                          <span className="ml-2 font-medium flex-shrink-0">৩</span>
                                        </div>
                                      )}
                                      {dData.desc_q_kha && (
                                        <div className="flex justify-between items-baseline">
                                          <span>(খ) <span dangerouslySetInnerHTML={{ __html: dData.desc_q_kha }} /></span>
                                          <span className="ml-2 font-medium flex-shrink-0">৭</span>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span> <LatexRenderer text={q.question} /></span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  <div className="p-4">
                    <Link to="/register">
                      <Button className="w-full gradient-green text-white border-0 rounded-xl font-heading font-semibold h-11">
                        সম্পূর্ণ ফিচার ব্যবহার করুন
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                    <p className="text-center text-[10px] text-muted-foreground mt-2">
                      ফ্রি একাউন্ট তৈরি করুন — ডাউনলোড, কাস্টমাইজ ও আরও অনেক কিছু
                    </p>
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
