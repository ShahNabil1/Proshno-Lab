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
import { CheckCircle2, ChevronLeft, ChevronRight, FilePlus2, BookOpen, ListChecks, FileText, Lock, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { planCoversSelection } from "@/lib/subscriptionMatcher";
import { useUnlimitedAccess } from "@/hooks/useUnlimitedAccess";
import { sortClasses, sortChapters } from "@/lib/classOrder";
import SubjectPicker from "@/components/dashboard/SubjectPicker";
import ClassPicker from "@/components/dashboard/ClassPicker";
import {
  filterSubjectsByVersion,
  getRelatedVersionClassIds,
  isEnglishVersionClass,
  type SubjectVersion,
} from "@/lib/subjectVersion";

type QType = "mcq" | "cq" | "short" | "descriptive";
const TYPE_LABELS: Record<QType, string> = {
  mcq: "বহুনির্বাচনী",
  cq: "সৃজনশীল",
  short: "সংক্ষিপ্ত",
  descriptive: "বর্ণনামূলক",
};
const TYPE_MARKS: Record<QType, number> = { mcq: 1, short: 2, cq: 10, descriptive: 10 };
const toBanglaNum = (n: number) => String(n).replace(/\d/g, d => "০১২৩৪৫৬৭৮৯"[+d]);

interface ClassRow { id: number; name: string }
interface SubjectRow { id: number; class_id: number; name: string; subject_code?: string | null }
interface ChapterRow { id: number; name: string; subject_id?: number }

const STEPS = [
  { id: 1, label: "বিষয়", icon: BookOpen },
  { id: 2, label: "কনফিগ", icon: ListChecks },
  { id: 3, label: "প্রশ্ন তৈরি", icon: FileText },
];

export default function AutoQuestionCreate() {
  const { user } = useAuth();
  const { unlimited: unlimitedAccess } = useUnlimitedAccess();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [chapters, setChapters] = useState<ChapterRow[]>([]);

  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [chapterIds, setChapterIds] = useState<string[]>([]);
  const [subjectVersion, setSubjectVersion] = useState<SubjectVersion>("bangla");

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
    supabase.from("classes").select("id, name").order("name").then(({ data }) => setClasses(sortClasses(data || [])));
    if (user?.id) {
      supabase.from("institutes").select("*").eq("owner_id", user.id).order("id", { ascending: true }).limit(1).maybeSingle().then(({ data }) => setInstitute(data));
    }
  }, [user?.id]);

  // Load subjects
  useEffect(() => {
    if (!classId) { setSubjects([]); setSubjectId(""); setSubjectIds([]); return; }
    const relatedClassIds = getRelatedVersionClassIds(classId, classes);
    supabase.from("subjects").select("id, class_id, name, subject_code").in("class_id", relatedClassIds).order("name")
      .then(({ data }) => setSubjects((data as any) || []));
  }, [classId, classes]);

  // Load chapters for all selected subjects
  useEffect(() => {
    if (subjectIds.length === 0) { setChapters([]); setChapterIds([]); return; }
    supabase.from("chapters").select("id, name, subject_id").in("subject_id", subjectIds.map(Number)).eq("is_active", true).order("name")
      .then(({ data }) => setChapters(sortChapters((data as any) || [])));
    setChapterIds([]);
  }, [subjectIds.join(",")]);

  // Access check
  const selectedSubjects = useMemo(() => {
    return subjects.filter((s) => subjectIds.includes(String(s.id)));
  }, [subjectIds, subjects]);

  const effectiveClassId = selectedSubjects[0]?.class_id || Number(classId || 0);
  const filteredSubjects = filterSubjectsByVersion(subjects, classes, subjectVersion);

  useEffect(() => {
    if (unlimitedAccess) { setHasAccess(true); return; }
    if (!user?.id || !effectiveClassId || subjectIds.length === 0) { setHasAccess(null); return; }
    let cancel = false;
    (async () => {
      const [{ data: perm }, { data: subs }] = await Promise.all([
        supabase.from("user_permissions").select("id, subject_id").eq("user_id", user.id).eq("class_id", effectiveClassId).in("subject_id", subjectIds.map(Number)),
        supabase.from("subscriptions").select("plan").eq("teacher_id", user.id).eq("status", "active"),
      ]);
      if (cancel) return;
      const permSubIds = new Set((perm || []).map((p: any) => String(p.subject_id)));
      const cls = classes.find(c => c.id === effectiveClassId);
      if (!cls || !subs) { setHasAccess(false); return; }

      const allAccess = subjectIds.every(subId => {
        if (permSubIds.has(subId)) return true;
        const sub = subjects.find(s => String(s.id) === subId);
        if (!sub) return false;
        return subs.some(s => planCoversSelection(s.plan || "", cls.name, sub.name));
      });

      setHasAccess(allAccess);
    })();
    return () => { cancel = true; };
  }, [user?.id, effectiveClassId, subjectIds.join(","), classes, subjects, unlimitedAccess]);

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

  const className = classes.find(c => c.id === effectiveClassId)?.name || "";
  const subjectName = selectedSubjects.map(s => s.name).join(", ");
  const subjectCode = selectedSubjects.map(s => s.subject_code).filter(Boolean).join(", ");
  const selectedChapters = chapters.filter(c => chapterIds.includes(String(c.id)));

  const step1Valid = classId && subjectIds.length > 0 && chapterIds.length > 0 && hasAccess !== false;
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
      if (totalQuestions > 200) {
        toast.warning(`একবারে সর্বোচ্চ ২০০টি প্রশ্ন তৈরি করা যাবে (বর্তমানে ${toBanglaNum(totalQuestions)}টি সিলেক্ট করা হয়েছে)`);
        return;
      }
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
        .in("subject_id", subjectIds.map(Number))
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
          .select("id, class_id, subject_id, question, option_a, option_b, option_c, option_d, correct_answer, type, explanation, board_references, university_references, topic_id, chapter_id, stimulus_group_id, stimulus_text, creative_data")
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
      sessionStorage.setItem("viewPaperContext", JSON.stringify({ classId: String(effectiveClassId), subjectId: subjectIds.join(","), chapterIds: ids.map(String) }));
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
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Stepper */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
        {STEPS.map(s => {
          const active = step === s.id;
          const done = step > s.id;
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => { if (done) setStep(s.id); }}
              className={cn(
                "flex items-center justify-center gap-2 py-3 px-3 rounded-[1px] border text-base font-semibold transition-all select-none",
                active && "bg-[#0A1E38] text-white border-[#0A1E38] shadow-xs",
                done && !active && "bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200/70 cursor-pointer",
                !active && !done && "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{toBanglaNum(s.id)}.</span> {s.label}
            </button>
          );
        })}
      </div>

      <Card className="border border-slate-300 rounded-[1px] bg-white shadow-xs">
        <CardContent className="p-6 md:p-8">
          {step === 1 && (
            <div>
              <h2 className="font-heading text-xl md:text-2xl font-bold text-slate-800 mb-1">ধাপ ১: শ্রেণি, বিষয় ও অধ্যায় নির্বাচন করুন</h2>
              <p className="text-base text-slate-600 mb-6 font-normal">প্রথমে আপনার প্রয়োজনীয় শ্রেণি, বিষয় এবং কোন কোন অধ্যায় থেকে প্রশ্ন করতে চান তা সিলেক্ট করুন।</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
                <div className="border border-slate-300 rounded-[1px] p-4 flex flex-col min-h-[200px] bg-white">
                  <Label className="mb-2.5 block font-bold text-base text-slate-800">শ্রেণি</Label>
                  <ClassPicker
                    value={classId}
                    classes={classes}
                    placeholder="-- শ্রেণি সিলেক্ট --"
                    triggerClassName="h-12 rounded-[1px] border-slate-300 text-base text-slate-800 bg-white focus:border-[#0A1E38]"
                    onChange={(v) => {
                      setClassId(v);
                      setSubjectVersion(isEnglishVersionClass(classes.find(c => String(c.id) === v)?.name || "") ? "english" : "bangla");
                      setSubjectId("");
                      setSubjectIds([]);
                      setChapterIds([]);
                    }}
                  />
                </div>

                <div className="border border-slate-300 rounded-[1px] p-4 flex flex-col min-h-[200px] bg-white">
                  <Label className="mb-2.5 block font-bold text-base text-slate-800">বিষয় (একাধিক)</Label>
                  <SubjectPicker
                    value={subjectId}
                    values={subjectIds}
                    subjects={filteredSubjects}
                    classes={classes}
                    version={subjectVersion}
                    disabled={!classId}
                    placeholder="-- বিষয় সিলেক্ট --"
                    triggerIcon="scan"
                    triggerClassName="h-12 rounded-[1px] border-slate-300 text-base text-slate-800 bg-white focus:border-[#0A1E38]"
                    onVersionChange={(version) => {
                      setSubjectVersion(version);
                      setSubjectId("");
                      setSubjectIds([]);
                      setChapterIds([]);
                    }}
                    onChange={(nextSubjectId, nextSubjectIds) => {
                      setSubjectId(nextSubjectIds.join(", "));
                      setSubjectIds(nextSubjectIds);
                      setChapterIds([]);
                    }}
                  />
                </div>

                <div className="border border-slate-300 rounded-[1px] p-4 flex flex-col min-h-[200px] bg-white">
                  <div className="mb-2 flex items-center justify-between min-h-[28px]">
                    <Label className="font-bold text-base text-slate-800">অধ্যায় (একাধিক)</Label>
                    {chapters.length > 0 && (
                      <button
                        type="button"
                        className="text-sm font-semibold text-[#0A1E38] hover:underline cursor-pointer"
                        onClick={() => setChapterIds(chapterIds.length === chapters.length ? [] : chapters.map(c => String(c.id)))}
                      >
                        {chapterIds.length === chapters.length ? "আনসিলেক্ট" : "সব সিলেক্ট"}
                      </button>
                    )}
                  </div>
                  {subjectIds.length === 0 && <p className="text-sm text-slate-500 py-3">আগে বিষয় সিলেক্ট করুন</p>}
                  {subjectIds.length > 0 && chapters.length === 0 && <p className="text-sm text-slate-500 py-3">কোনো সক্রিয় অধ্যায় নেই</p>}
                  <div className="space-y-1 flex-1 max-h-48 overflow-y-auto pr-1">
                    {chapters.map(c => {
                      const isChecked = chapterIds.includes(String(c.id));
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-2.5 cursor-pointer text-base p-2 rounded-[1px] transition-colors select-none ${
                            isChecked ? "bg-slate-100 text-slate-900 font-medium" : "hover:bg-slate-50 text-slate-800"
                          }`}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(chk) => {
                              setChapterIds(prev => chk ? [...prev, String(c.id)] : prev.filter(x => x !== String(c.id)));
                            }}
                            className="h-4 w-4 rounded-[1px] border-slate-400 data-[state=checked]:bg-[#0A1E38] data-[state=checked]:border-[#0A1E38]"
                          />
                          <span className="truncate">{c.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {classId && subjectIds.length > 0 && hasAccess === false && (
                <div className="mt-4 flex items-start gap-2.5 p-3.5 rounded-[1px] border border-amber-300 bg-amber-50 text-amber-900 text-base">
                  <Lock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <span>এই শ্রেণি/বিষয়ের জন্য কোনো সক্রিয় সাবস্ক্রিপশন নেই। <a href="/dashboard/subscription" className="text-[#0A1E38] font-bold underline">সাবস্ক্রাইব করুন</a></span>
                </div>
              )}

              <div className="flex justify-end mt-8">
                <Button
                  onClick={goNext}
                  disabled={!step1Valid}
                  className="h-12 px-7 rounded-[1px] bg-[#0A1E38] hover:bg-[#122B4D] text-white font-bold text-base shadow-xs gap-2 border border-[#0A1E38] cursor-pointer disabled:opacity-50"
                >
                  <span>পরবর্তী ধাপ</span>
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-heading text-xl md:text-2xl font-bold text-slate-800 mb-1">ধাপ ২: প্রশ্নের ধরন ও সংখ্যা নির্বাচন করুন</h2>
              <p className="text-base text-slate-600 mb-6 font-normal">সিস্টেম স্বয়ংক্রিয়ভাবে প্রশ্ন জেনারেট করার জন্য প্রতিটি ধরন থেকে কতটি প্রশ্ন চান তা নির্দিষ্ট করুন।</p>

              <div className="space-y-3">
                {(Object.keys(TYPE_LABELS) as QType[]).map(t => {
                  const on = enabledTypes[t];
                  const max = available[t];
                  const sliderMax = Math.min(200, max);
                  return (
                    <div
                      key={t}
                      className={cn(
                        "border border-slate-300 rounded-[1px] p-4 sm:p-5 transition-colors bg-white",
                        on && "border-[#0A1E38] bg-slate-50"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-2.5 cursor-pointer font-bold text-base text-slate-800 select-none">
                          <Checkbox
                            checked={on}
                            disabled={max === 0}
                            onCheckedChange={(chk) => setEnabledTypes(p => ({ ...p, [t]: !!chk }))}
                            className="h-4 w-4 rounded-[1px] border-slate-400 data-[state=checked]:bg-[#0A1E38] data-[state=checked]:border-[#0A1E38]"
                          />
                          <span>{TYPE_LABELS[t]} প্রশ্নের সংখ্যা</span>
                        </label>
                        <Badge variant="outline" className="text-sm font-medium border-slate-300 bg-slate-100 text-slate-700 rounded-[1px] px-2.5 py-0.5">
                          {countsLoading ? "..." : `উপলব্ধ ${toBanglaNum(max)}`}
                        </Badge>
                      </div>
                      {on && max > 0 && (
                        <div className="pl-7 pt-2">
                          <div className="flex items-center gap-3">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 shrink-0 rounded-[1px] border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
                              onClick={() => setCounts(p => ({ ...p, [t]: Math.max(1, Math.min(p[t], sliderMax) - 1) }))}
                              disabled={Math.min(counts[t], sliderMax) <= 1}
                              aria-label="কমান"
                            >
                              <Minus className="w-4 h-4" />
                            </Button>

                            <Slider
                              value={[Math.min(counts[t], sliderMax)]}
                              min={1}
                              max={sliderMax}
                              step={1}
                              onValueChange={([v]) => setCounts(p => ({ ...p, [t]: Math.min(sliderMax, v) }))}
                              className="flex-1"
                            />

                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 shrink-0 rounded-[1px] border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
                              onClick={() => setCounts(p => ({ ...p, [t]: Math.min(sliderMax, Math.min(p[t], sliderMax) + 1) }))}
                              disabled={Math.min(counts[t], sliderMax) >= sliderMax}
                              aria-label="বাড়ান"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>

                            <span className="min-w-[3.5rem] rounded-[1px] bg-slate-800 px-3.5 py-1.5 text-center text-base font-bold text-white shadow-xs transition-all">
                              {toBanglaNum(Math.min(counts[t], sliderMax))}
                            </span>
                          </div>
                          <div className="mt-1.5 flex justify-between pr-[4.5rem] text-xs text-slate-500 font-medium">
                            <span>{toBanglaNum(1)}</span>
                            <span>{toBanglaNum(sliderMax)}</span>
                          </div>
                        </div>
                      )}

                      {on && max === 0 && <p className="text-sm text-slate-500 pl-7 pt-1">এই ধরনের কোনো প্রশ্ন নেই</p>}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between mt-8">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="h-12 px-6 rounded-[1px] border-slate-300 text-slate-700 text-base font-semibold hover:bg-slate-100 gap-2 cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" /> আগের ধাপে যান
                </Button>
                <Button
                  onClick={goNext}
                  disabled={!step2Valid}
                  className="h-12 px-7 rounded-[1px] bg-[#0A1E38] hover:bg-[#122B4D] text-white font-bold text-base shadow-xs gap-2 border border-[#0A1E38] cursor-pointer disabled:opacity-50"
                >
                  <span>পরবর্তী ধাপ</span>
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-4">
              <CheckCircle2 className="w-16 h-16 text-[#0A1E38] mx-auto mb-4" strokeWidth={2} />
              <h2 className="font-heading text-2xl font-bold text-slate-800 mb-6">আপনার প্রশ্নপত্র প্রস্তুত!</h2>

              <div className="max-w-lg mx-auto bg-slate-50 border border-slate-300 rounded-[1px] p-6 text-left shadow-xs">
                <h3 className="font-bold text-base text-slate-800 mb-4 border-b border-slate-200 pb-2.5">সারাংশ:</h3>
                <dl className="space-y-2 text-base">
                  <div className="flex gap-3"><dt className="font-bold text-slate-700 w-28 shrink-0">শ্রেণি:</dt><dd className="text-slate-900 font-medium">{className}</dd></div>
                  <div className="flex gap-3"><dt className="font-bold text-slate-700 w-28 shrink-0">বিষয়:</dt><dd className="text-slate-900 font-medium">{subjectName || "-"}</dd></div>
                  <div className="flex gap-3"><dt className="font-bold text-slate-700 w-28 shrink-0">অধ্যায়:</dt><dd className="flex-1 text-slate-900 font-medium">{selectedChapters.map(c => c.name).join(", ") || "-"}</dd></div>
                  {activeTypes.map(t => (
                    <div key={t} className="flex gap-3">
                      <dt className="font-bold text-slate-700 w-28 shrink-0">{TYPE_LABELS[t]}:</dt>
                      <dd className="text-slate-900 font-semibold">{toBanglaNum(counts[t])} টি</dd>
                    </div>
                  ))}
                  <div className="flex gap-3 pt-3 border-t border-slate-200">
                    <dt className="font-bold text-slate-800 w-28 shrink-0">মোট প্রশ্ন:</dt>
                    <dd className="font-bold text-[#0A1E38] text-lg">{toBanglaNum(totalQuestions)} টি</dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="font-bold text-slate-800 w-28 shrink-0">মোট মূল্য:</dt>
                    <dd className="font-bold text-[#0A1E38] text-lg">{toBanglaNum(totalMarks)}</dd>
                  </div>
                </dl>
              </div>

              <div className="flex justify-center gap-3 mt-8">
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                  className="h-12 px-6 rounded-[1px] border-slate-300 text-slate-700 text-base font-semibold hover:bg-slate-100 gap-2 cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" /> আগের ধাপে যান
                </Button>
                <Button
                  onClick={generate}
                  disabled={generating}
                  className="h-12 px-8 rounded-[1px] bg-[#0A1E38] hover:bg-[#122B4D] text-white font-bold text-base shadow-sm gap-2 border border-[#0A1E38] cursor-pointer disabled:opacity-50"
                >
                  <FilePlus2 className="w-5 h-5" /> {generating ? "জেনারেট হচ্ছে..." : "প্রশ্ন তৈরি করুন"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
