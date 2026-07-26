import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ChevronLeft, ChevronRight, FilePlus2, BookOpen, ListChecks, Wand2, Lock, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { planCoversSelection } from "@/lib/subscriptionMatcher";

type QType = "mcq" | "cq" | "short" | "descriptive";
const TYPE_LABELS: Record<QType, string> = {
  mcq: "MCQ",
  cq: "সৃজনশীল (CQ)",
  short: "সংক্ষিপ্ত",
  descriptive: "বর্ণনামূলক",
};
const TYPE_MARKS: Record<QType, number> = { mcq: 1, short: 2, cq: 10, descriptive: 10 };
const toBanglaNum = (n: number) => String(n).replace(/\d/g, d => "০১২৩৪৫৬৭৮৯"[+d]);

interface ClassRow { id: number; name: string }
interface SubjectRow { id: number; name: string; subject_code?: string | null }
interface ChapterRow { id: number; name: string }

const STEPS = [
  { id: 1, label: "বিষয়", icon: BookOpen },
  { id: 2, label: "কনফিগ", icon: ListChecks },
  { id: 3, label: "জেনারেট", icon: Wand2 },
];

export default function AutoQuestionCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [chapters, setChapters] = useState<ChapterRow[]>([]);

  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [chapterIds, setChapterIds] = useState<string[]>([]);

  const [enabledTypes, setEnabledTypes] = useState<Record<QType, boolean>>({
    mcq: true, cq: false, short: false, descriptive: false,
  });
  const [counts, setCounts] = useState<Record<QType, number>>({ mcq: 10, cq: 2, short: 5, descriptive: 2 });
  const [available, setAvailable] = useState<Record<QType, number>>({ mcq: 0, cq: 0, short: 0, descriptive: 0 });
  const [countsLoading, setCountsLoading] = useState(false);

  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [generating, setGenerating] = useState(false);
  const [institute, setInstitute] = useState<any>(null);

  // Load classes & institute
  useEffect(() => {
    supabase.from("classes").select("id, name").order("name").then(({ data }) => setClasses(data || []));
    if (user?.id) {
      supabase.from("institutes").select("*").eq("owner_id", user.id).maybeSingle().then(({ data }) => setInstitute(data));
    }
  }, [user?.id]);

  // Load subjects
  useEffect(() => {
    if (!classId) { setSubjects([]); setSubjectId(""); return; }
    supabase.from("subjects").select("id, name, subject_code").eq("class_id", Number(classId)).order("name")
      .then(({ data }) => setSubjects((data as any) || []));
  }, [classId]);

  // Load chapters
  useEffect(() => {
    if (!subjectId) { setChapters([]); setChapterIds([]); return; }
    supabase.from("chapters").select("id, name").eq("subject_id", Number(subjectId)).eq("is_active", true).order("name")
      .then(({ data }) => setChapters((data as any) || []));
    setChapterIds([]);
  }, [subjectId]);

  // Access check
  useEffect(() => {
    if (!user?.id || !classId || !subjectId) { setHasAccess(null); return; }
    let cancel = false;
    (async () => {
      const [{ data: perm }, { data: subs }] = await Promise.all([
        supabase.from("user_permissions").select("id").eq("user_id", user.id).eq("class_id", Number(classId)).eq("subject_id", Number(subjectId)).limit(1),
        supabase.from("subscriptions").select("plan").eq("teacher_id", user.id).eq("status", "active"),
      ]);
      if (cancel) return;
      if (perm && perm.length > 0) { setHasAccess(true); return; }
      const cls = classes.find(c => String(c.id) === classId);
      const sub = subjects.find(s => String(s.id) === subjectId);
      if (!cls || !sub || !subs) { setHasAccess(false); return; }
      setHasAccess(subs.some(s => planCoversSelection(s.plan || "", cls.name, sub.name)));
    })();
    return () => { cancel = true; };
  }, [user?.id, classId, subjectId, classes, subjects]);

  // Live counts per type based on selected chapters
  useEffect(() => {
    if (chapterIds.length === 0) { setAvailable({ mcq: 0, cq: 0, short: 0, descriptive: 0 }); return; }
    setCountsLoading(true);
    const ids = chapterIds.map(Number);
    (async () => {
      const types: QType[] = ["mcq", "cq", "short", "descriptive"];
      const results = await Promise.all(types.map(async (t) => {
        const { count } = await supabase
          .from("questions")
          .select("id", { count: "exact", head: true })
          .in("chapter_id", ids)
          .eq("type", t);
        return [t, count || 0] as const;
      }));
      const next = { mcq: 0, cq: 0, short: 0, descriptive: 0 } as Record<QType, number>;
      results.forEach(([t, c]) => { next[t] = c; });
      setAvailable(next);
      setCountsLoading(false);
      // Clamp existing counts
      setCounts(prev => {
        const clamped = { ...prev };
        types.forEach(t => { if (clamped[t] > next[t]) clamped[t] = next[t]; });
        return clamped;
      });
    })();
  }, [chapterIds]);

  // Fisher-Yates shuffle (unbiased)
  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Fetch all question ids for a type across selected chapters (paginated, no 1000-row cap)
  const fetchAllIds = async (ids: number[], type: QType) => {
    const all: number[] = [];
    const PAGE = 1000;
    for (let from = 0; from < 50000; from += PAGE) {
      const { data, error } = await supabase
        .from("questions")
        .select("id")
        .in("chapter_id", ids)
        .eq("type", type)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = (data || []) as { id: number }[];
      all.push(...rows.map(r => r.id));
      if (rows.length < PAGE) break;
    }
    return all;
  };


  const className = classes.find(c => String(c.id) === classId)?.name || "";
  const subjectName = subjects.find(s => String(s.id) === subjectId)?.name || "";
  const subjectCode = subjects.find(s => String(s.id) === subjectId)?.subject_code || "";
  const selectedChapters = chapters.filter(c => chapterIds.includes(String(c.id)));

  const step1Valid = classId && subjectId && chapterIds.length > 0 && hasAccess !== false;
  const activeTypes = (Object.keys(enabledTypes) as QType[]).filter(t => enabledTypes[t] && counts[t] > 0);
  const step2Valid = activeTypes.length > 0;
  const totalMarks = useMemo(() => activeTypes.reduce((s, t) => s + counts[t] * TYPE_MARKS[t], 0), [activeTypes, counts]);
  const totalQuestions = useMemo(() => activeTypes.reduce((s, t) => s + counts[t], 0), [activeTypes, counts]);

  const goNext = () => {
    if (step === 1) {
      if (!step1Valid) { toast.error(hasAccess === false ? "এই বিষয়ের জন্য সাবস্ক্রিপশন নেই" : "সব ফিল্ড পূরণ করুন"); return; }
      setStep(2);
    } else if (step === 2) {
      if (!step2Valid) { toast.error("অন্তত একটি টাইপ ও সংখ্যা সিলেক্ট করুন"); return; }
      setStep(3);
    }
  };

  const generate = async () => {
    setGenerating(true);
    try {
      // Re-verify chapters are still active at generation time (admin may have disabled one)
      const { data: liveChapters } = await supabase
        .from("chapters")
        .select("id")
        .eq("subject_id", Number(subjectId))
        .eq("is_active", true)
        .in("id", chapterIds.map(Number));
      const ids = ((liveChapters as any[]) || []).map(c => Number(c.id));
      if (ids.length === 0) {
        toast.error("নির্বাচিত অধ্যায়গুলো আর সক্রিয় নেই");
        setGenerating(false);
        return;
      }
      if (ids.length < chapterIds.length) {
        setChapterIds(ids.map(String));
        toast.warning("কিছু অধ্যায় নিষ্ক্রিয় করা হয়েছে, সেগুলো বাদ দেওয়া হলো");
      }

      const picked: any[] = [];
      for (const t of activeTypes) {
        const allIds = await fetchAllIds(ids, t);
        const pickIds = shuffle(allIds).slice(0, counts[t]);
        if (pickIds.length === 0) continue;
        const { data } = await supabase
          .from("questions")
          .select("id, question, option_a, option_b, option_c, option_d, correct_answer, type, explanation, board_references, university_references, topic_id, chapter_id, stimulus_group_id, stimulus_text, creative_data")
          .in("id", pickIds);
        const rows = (data || []) as any[];
        const order = new Map(pickIds.map((id, i) => [id, i]));
        rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
        picked.push(...rows);
      }

      if (picked.length === 0) {
        toast.error("কোনো প্রশ্ন পাওয়া যায়নি");
        setGenerating(false);
        return;
      }

      const selectedChapterNames = selectedChapters.map(c => c.name);
      sessionStorage.setItem("viewPaperQuestions", JSON.stringify(picked));
      sessionStorage.setItem("viewPaperMeta", JSON.stringify({
        instituteName: institute?.name || "আপনার প্রতিষ্ঠানের নাম",
        instituteUpazila: institute?.upazila || "",
        instituteDistrict: institute?.district || "",
        instituteDivision: institute?.division || "",
        institutePhone: institute?.phone || "",
        instituteSpecificAddress: institute?.specific_address || "",
        className,
        subjectName,
        subjectCode,
        chapterNames: selectedChapterNames,
        programName: "",
        teacherName: user?.user_metadata?.full_name || user?.email || "",
        topicNames: [],
      }));
      toast.success(`${toBanglaNum(picked.length)}টি প্রশ্ন জেনারেট হয়েছে!`);
      navigate("/dashboard/view-paper");
    } catch (e: any) {
      toast.error("জেনারেট ব্যর্থ: " + (e?.message || ""));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Stepper */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
        {STEPS.map(s => {
          const active = step === s.id;
          const done = step > s.id;
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => { if (done) setStep(s.id); }}
              className={cn(
                "flex items-center justify-center gap-2 py-3 px-2 rounded-lg border text-sm font-semibold transition-all",
                active && "bg-primary text-primary-foreground border-primary shadow",
                done && !active && "bg-primary/10 text-primary border-primary/30 hover:bg-primary/15",
                !active && !done && "bg-muted/40 text-muted-foreground border-border cursor-not-allowed"
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{toBanglaNum(s.id)}.</span> {s.label}
            </button>
          );
        })}
      </div>

      <Card className="border-2">
        <CardContent className="p-6 md:p-8">
          {step === 1 && (
            <div>
              <h2 className="font-heading text-xl font-bold mb-1">ধাপ ১: শ্রেণি, বিষয় ও অধ্যায় নির্বাচন করুন</h2>
              <p className="text-sm text-muted-foreground mb-6">প্রথমে আপনার প্রয়োজনীয় শ্রেণি, বিষয় এবং কোন কোন অধ্যায় থেকে প্রশ্ন করতে চান তা সিলেক্ট করুন।</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
                <div className="border rounded-lg p-4 flex flex-col min-h-[180px]">
                  <Label className="mb-2 block font-semibold">শ্রেণি</Label>
                  <Select value={classId} onValueChange={(v) => { setClassId(v); setSubjectId(""); setChapterIds([]); }}>
                    <SelectTrigger><SelectValue placeholder="-- শ্রেণি সিলেক্ট --" /></SelectTrigger>
                    <SelectContent>
                      {classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border rounded-lg p-4 flex flex-col min-h-[180px]">
                  <Label className="mb-2 block font-semibold">বিষয়</Label>
                  <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setChapterIds([]); }} disabled={!classId}>
                    <SelectTrigger><SelectValue placeholder="-- বিষয় সিলেক্ট --" /></SelectTrigger>
                    <SelectContent>
                      {subjects.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border rounded-lg p-4 flex flex-col min-h-[180px]">
                  <Label className="mb-2 flex items-center justify-between font-semibold min-h-[24px]">
                    <span>অধ্যায় (একাধিক)</span>
                    {chapters.length > 0 && (
                      <button className="text-xs text-primary hover:underline"
                        onClick={() => setChapterIds(chapterIds.length === chapters.length ? [] : chapters.map(c => String(c.id)))}>
                        {chapterIds.length === chapters.length ? "আনসিলেক্ট" : "সব সিলেক্ট"}
                      </button>
                    )}
                  </Label>
                  {!subjectId && <p className="text-xs text-muted-foreground">আগে বিষয় সিলেক্ট করুন</p>}
                  {subjectId && chapters.length === 0 && <p className="text-xs text-muted-foreground">কোনো সক্রিয় অধ্যায় নেই</p>}
                  <div className="space-y-2 flex-1 max-h-40 overflow-y-auto">

                    {chapters.map(c => (
                      <label key={c.id} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-muted/50 p-1.5 rounded">
                        <Checkbox
                          checked={chapterIds.includes(String(c.id))}
                          onCheckedChange={(chk) => {
                            setChapterIds(prev => chk ? [...prev, String(c.id)] : prev.filter(x => x !== String(c.id)));
                          }}
                        />
                        <span>{c.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {classId && subjectId && hasAccess === false && (
                <div className="mt-4 flex items-start gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-sm">
                  <Lock className="w-4 h-4 text-destructive mt-0.5" />
                  <span>এই শ্রেণি/বিষয়ের জন্য কোনো সক্রিয় সাবস্ক্রিপশন নেই। <a href="/dashboard/subscription" className="text-primary underline">সাবস্ক্রাইব করুন</a></span>
                </div>
              )}

              <div className="flex justify-end mt-6">
                <Button onClick={goNext} disabled={!step1Valid} className="gap-2">পরবর্তী ধাপ <ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-heading text-xl font-bold mb-1">ধাপ ২: প্রশ্নের ধরন ও সংখ্যা নির্বাচন করুন</h2>
              <p className="text-sm text-muted-foreground mb-6">সিস্টেম স্বয়ংক্রিয়ভাবে প্রশ্ন জেনারেট করার জন্য প্রতিটি ধরন থেকে কতটি প্রশ্ন চান তা নির্দিষ্ট করুন।</p>

              <div className="space-y-3">
                {(Object.keys(TYPE_LABELS) as QType[]).map(t => {
                  const on = enabledTypes[t];
                  const max = available[t];
                  return (
                    <div key={t} className={cn("border rounded-lg p-4 transition-colors", on && "border-primary/40 bg-primary/5")}>
                      <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-2 cursor-pointer font-semibold">
                          <Checkbox
                            checked={on}
                            disabled={max === 0}
                            onCheckedChange={(chk) => setEnabledTypes(p => ({ ...p, [t]: !!chk }))}
                          />
                          <span>{TYPE_LABELS[t]} প্রশ্নের সংখ্যা</span>
                        </label>
                        <Badge variant="outline" className="text-xs">
                          {countsLoading ? "..." : `উপলব্ধ ${toBanglaNum(max)}`}
                        </Badge>
                      </div>
                      {on && max > 0 && (
                        <div className="pl-6 pt-1">
                          <div className="flex items-center gap-3">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 shrink-0 rounded-full"
                              onClick={() => setCounts(p => ({ ...p, [t]: Math.max(1, Math.min(p[t], max) - 1) }))}
                              disabled={Math.min(counts[t], max) <= 1}
                              aria-label="কমান"
                            >
                              <Minus className="w-4 h-4" />
                            </Button>

                            <Slider
                              value={[Math.min(counts[t], max)]}
                              min={1}
                              max={max}
                              step={1}
                              onValueChange={([v]) => setCounts(p => ({ ...p, [t]: v }))}
                              className="flex-1"
                            />

                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 shrink-0 rounded-full"
                              onClick={() => setCounts(p => ({ ...p, [t]: Math.min(max, Math.min(p[t], max) + 1) }))}
                              disabled={Math.min(counts[t], max) >= max}
                              aria-label="বাড়ান"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>

                            <span className="min-w-[3.25rem] rounded-full bg-primary px-3 py-1 text-center text-base font-bold text-primary-foreground shadow-sm transition-all">
                              {toBanglaNum(Math.min(counts[t], max))}
                            </span>
                          </div>
                          <div className="mt-1.5 flex justify-between pr-[4.5rem] text-[11px] text-muted-foreground">
                            <span>{toBanglaNum(1)}</span>
                            <span>{toBanglaNum(max)}</span>
                          </div>
                        </div>
                      )}

                      {on && max === 0 && <p className="text-xs text-muted-foreground pl-6">এই ধরনের কোনো প্রশ্ন নেই</p>}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setStep(1)} className="gap-2"><ChevronLeft className="w-4 h-4" /> আগের ধাপে যান</Button>
                <Button onClick={goNext} disabled={!step2Valid} className="gap-2">পরবর্তী ধাপ <ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center">
              <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-4" strokeWidth={2} />
              <h2 className="font-heading text-2xl font-bold mb-6">আপনার প্রশ্নপত্র প্রস্তুত!</h2>

              <div className="max-w-md mx-auto bg-muted/40 rounded-lg p-5 text-left border">
                <h3 className="font-bold mb-3 border-b pb-2">সারাংশ:</h3>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex gap-2"><dt className="font-semibold w-24">শ্রেণি:</dt><dd>{className}</dd></div>
                  <div className="flex gap-2"><dt className="font-semibold w-24">বিষয়:</dt><dd>{subjectName || "-"}</dd></div>
                  <div className="flex gap-2"><dt className="font-semibold w-24">অধ্যায়:</dt><dd className="flex-1">{selectedChapters.map(c => c.name).join(", ") || "-"}</dd></div>
                  {activeTypes.map(t => (
                    <div key={t} className="flex gap-2">
                      <dt className="font-semibold w-24">{TYPE_LABELS[t]}:</dt>
                      <dd>{toBanglaNum(counts[t])} টি</dd>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-2 border-t"><dt className="font-semibold w-24">মোট প্রশ্ন:</dt><dd>{toBanglaNum(totalQuestions)} টি</dd></div>
                  <div className="flex gap-2"><dt className="font-semibold w-24">মোট মূল্য:</dt><dd>{toBanglaNum(totalMarks)}</dd></div>
                </dl>
              </div>

              <div className="flex justify-center gap-3 mt-6">
                <Button variant="outline" onClick={() => setStep(2)} className="gap-2"><ChevronLeft className="w-4 h-4" /> আগের ধাপে যান</Button>
                <Button onClick={generate} disabled={generating} className="gap-2">
                  <FilePlus2 className="w-4 h-4" /> {generating ? "জেনারেট হচ্ছে..." : "প্রশ্ন তৈরি করুন"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
