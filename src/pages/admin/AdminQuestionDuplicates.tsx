import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckSquare, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import LatexRenderer from "@/components/LatexRenderer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getExactQuestionDuplicateSignature } from "@/lib/questionDuplicates";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type QuestionRow = {
  id: number;
  type: string;
  question: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  creative_data: any;
  stimulus_text?: string | null;
  class_id: number;
  subject_id: number;
  chapter_id: number;
  created_at: string;
  correct_answer?: string | null;
  explanation?: string | null;
};

type NamedRow = { id: number; name: string; class_id?: number; subject_id?: number };
type DuplicateGroup = { signature: string; keep: QuestionRow; duplicates: QuestionRow[]; all: QuestionRow[] };

export default function AdminQuestionDuplicates({ embedded = false, onClose }: { embedded?: boolean; onClose?: () => void } = {}) {
  const navigate = useNavigate();
  const [visibleGroups, setVisibleGroups] = useState<DuplicateGroup[]>([]);
  const [chapterStats, setChapterStats] = useState<Array<{ type: string; total: number; duplicates: number }> | null>(null);
  const [groupLimit, setGroupLimit] = useState(20);
  const [totalGroups, setTotalGroups] = useState(0);
  const [classes, setClasses] = useState<NamedRow[]>([]);
  const [subjects, setSubjects] = useState<NamedRow[]>([]);
  const [chapters, setChapters] = useState<NamedRow[]>([]);
  const [classId, setClassId] = useState("all");
  const [subjectId, setSubjectId] = useState("all");
  const [chapterId, setChapterId] = useState("all");
  const [questionType, setQuestionType] = useState("all");
  const [loading, setLoading] = useState(true);
  const [scanError, setScanError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingGroups, setPendingGroups] = useState<DuplicateGroup[]>([]);

  const loadMetadata = async () => {
    try {
      const [{ data: classRows, error: classError }, { data: subjectRows, error: subjectError }, { data: chapterRows, error: chapterError }] = await Promise.all([
        supabase.from("classes").select("id,name").order("name"),
        supabase.from("subjects").select("id,name,class_id").order("name"),
        supabase.from("chapters").select("id,name,subject_id").order("name"),
      ]);
      if (classError || subjectError || chapterError) throw classError || subjectError || chapterError;
      setClasses((classRows || []) as NamedRow[]);
      setSubjects((subjectRows || []) as NamedRow[]);
      setChapters((chapterRows || []) as NamedRow[]);
    } catch (error: any) {
      toast.error(`ডাটা লোড করা যায়নি: ${error.message}`);
    }
  };

  const scanRevision = useRef(0);

  const loadGroups = async () => {
    const revision = ++scanRevision.current;
    setGroupLimit(20);
    setChapterStats(null);
    setVisibleGroups([]);
    setTotalGroups(0);
    setSelected(new Set());
    setLoading(true);
    setScanError("");
    try {
      // Compare exact full content within the selected chapter.
      if (chapterId !== "all") {
        const rows: QuestionRow[] = [];
        const pageSize = 1000;
        for (let from = 0; ; from += pageSize) {
          let query = supabase
            .from("questions")
            .select("*")
            .eq("chapter_id", Number(chapterId))
            .order("id")
            .range(from, from + pageSize - 1);
          if (classId !== "all") query = query.eq("class_id", Number(classId));
          if (subjectId !== "all") query = query.eq("subject_id", Number(subjectId));

          const { data: page, error: pageError } = await query;
          if (pageError) throw pageError;
          rows.push(...((page || []) as QuestionRow[]));
          if (!page || page.length < pageSize) break;
        }

        const bySignature = new Map<string, DuplicateGroup>();
        for (const question of rows) {
          const signature = `${question.class_id}:${question.subject_id}:${question.chapter_id}:${getExactQuestionDuplicateSignature(question)}`;
          const match = bySignature.get(signature);
          if (match) {
            match.all.push(question);
            match.duplicates.push(question);
          } else {
            bySignature.set(signature, { signature, keep: question, duplicates: [], all: [question] });
          }
        }
        const grouped = [...bySignature.values()];
        const stats = [...new Set(rows.map(q => q.type))].map(type => ({
          type,
          total: rows.filter(q => q.type === type).length,
          duplicates: grouped.filter(group => group.keep.type === type).reduce((sum, group) => sum + group.duplicates.length, 0),
        }));
        const duplicatesOnly = grouped.filter((group) => group.duplicates.length > 0 && (questionType === "all" || group.keep.type === questionType));
        if (revision !== scanRevision.current) return;
        setChapterStats(stats);
        setVisibleGroups(duplicatesOnly);
        setTotalGroups(duplicatesOnly.length);
        setSelected(new Set());
        return;
      }

      const { data, error } = await (supabase.rpc as any)("find_duplicate_question_groups", {
        _class_id: classId === "all" ? null : Number(classId),
        _subject_id: subjectId === "all" ? null : Number(subjectId),
        _chapter_id: chapterId === "all" ? null : Number(chapterId),
        _type: questionType === "all" ? null : questionType,
        _limit: 1000,
        _offset: 0,
      });
      if (error) throw error;
      if (revision !== scanRevision.current) return;
      // RPC signatures may span chapters. Never offer a cross-chapter merge.
      const groups: DuplicateGroup[] = (data || []).flatMap((row: any) => {
        const buckets = new Map<string, QuestionRow[]>();
        for (const question of (row.occurrences || []) as QuestionRow[]) {
          if (question.class_id == null || question.subject_id == null || question.chapter_id == null) continue;
          if (classId !== "all" && question.class_id !== Number(classId)) continue;
          if (subjectId !== "all" && question.subject_id !== Number(subjectId)) continue;
          if (chapterId !== "all" && question.chapter_id !== Number(chapterId)) continue;
          if (questionType !== "all" && question.type !== questionType) continue;
          const scope = `${question.class_id}:${question.subject_id}:${question.chapter_id}:${question.type}`;
          const bucket = buckets.get(scope) || [];
          bucket.push(question);
          buckets.set(scope, bucket);
        }
        return [...buckets].filter(([, rows]) => rows.length > 1).map(([scope, rows]) => {
          const all = [...rows].sort((a, b) => a.id - b.id);
          return { signature: `${scope}:${row.signature}`, keep: all[0], duplicates: all.slice(1), all };
        });
      });
      const ids = [...new Set(groups.flatMap(group => group.all.map(q => q.id)))];
      const fullRows = new Map<number, QuestionRow>();
      for (let i = 0; i < ids.length; i += 500) {
        const { data: rows, error: rowError } = await supabase.from("questions").select("*").in("id", ids.slice(i, i + 500));
        if (rowError) throw rowError;
        if (revision !== scanRevision.current) return;
        rows?.forEach(row => fullRows.set(row.id, row as QuestionRow));
      }
      const verified = new Map<string, DuplicateGroup>();
      for (const question of [...fullRows.values()].sort((a, b) => a.id - b.id)) {
        const signature = `${question.class_id}:${question.subject_id}:${question.chapter_id}:${getExactQuestionDuplicateSignature(question)}`;
        const match = verified.get(signature);
        if (match) {
          match.all.push(question);
          match.duplicates.push(question);
        } else {
          verified.set(signature, { signature, keep: question, duplicates: [], all: [question] });
        }
      }
      const verifiedGroups = [...verified.values()].filter(group => group.duplicates.length > 0);
      setVisibleGroups(verifiedGroups);
      setTotalGroups(verifiedGroups.length);
      setSelected(new Set());
    } catch (error: any) {
      if (revision !== scanRevision.current) return;
      setVisibleGroups([]);
      setTotalGroups(0);
      setScanError(error.message || "Unknown error");
      toast.error(`Duplicate scan ব্যর্থ: ${error.message}`);
    } finally {
      if (revision === scanRevision.current) setLoading(false);
    }
  };

  useEffect(() => { loadMetadata(); }, []);
  useEffect(() => { loadGroups(); }, [classId, subjectId, chapterId, questionType]);

  const visibleSubjects = subjects.filter((s) => classId === "all" || String(s.class_id) === classId);
  const visibleChapters = chapters.filter((c) => subjectId === "all" || String(c.subject_id) === subjectId);
  const nameOf = (rows: NamedRow[], id: number) => rows.find((r) => r.id === id)?.name || `#${id}`;
  const totalDuplicateRows = visibleGroups.reduce((sum, group) => sum + group.duplicates.length, 0);
  const selectedGroups = visibleGroups.filter((group) => selected.has(group.signature));
  const selectedRows = selectedGroups.reduce((sum, group) => sum + group.duplicates.length, 0);

  const toggleGroup = (signature: string, checked: boolean) => setSelected((current) => {
    const next = new Set(current);
    checked ? next.add(signature) : next.delete(signature);
    return next;
  });

  const toggleAll = (checked: boolean) => setSelected((current) => {
    const next = new Set(current);
    visibleGroups.forEach((group) => checked ? next.add(group.signature) : next.delete(group.signature));
    return next;
  });

  const askDelete = (groups: DuplicateGroup[]) => {
    setPendingGroups(groups);
    setConfirmOpen(true);
  };

  const deleteGroups = async () => {
    setDeleting(true);
    let deleted = 0;
    try {
      for (const group of pendingGroups) {
        const { data, error } = await (supabase.rpc as any)("merge_duplicate_questions", {
          _keep_id: group.keep.id,
          _delete_ids: group.duplicates.map((q) => q.id),
        });
        if (error) throw error;
        deleted += Number(data || 0);
      }
      toast.success(`${deleted}টি duplicate প্রশ্ন delete হয়েছে; main copy রাখা হয়েছে`);
      setConfirmOpen(false);
      setPendingGroups([]);
      await loadGroups();
    } catch (error: any) {
      toast.error(`Delete সম্পন্ন হয়নি: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const renderFullQuestion = (q: QuestionRow) => {
    let cd = q.creative_data || {};
    if (typeof cd === "string") { try { cd = JSON.parse(cd); } catch { cd = {}; } }
    const parts = q.type === "cq"
      ? ["ka", "kha", "ga", "gha"].map((key, index) => ({ label: ["ক", "খ", "গ", "ঘ"][index], text: cd[`q_${key}`] || cd.sub_questions?.[index]?.text || cd.questions?.[index]?.text, answer: cd[`ans_${key}`] }))
      : q.type === "descriptive" ? ["ka", "kha"].map((key, index) => ({ label: ["ক", "খ"][index], text: cd[`desc_q_${key}`], answer: cd[`desc_ans_${key}`] })) : [];
    return <div className="mt-3 space-y-3 text-base leading-7 text-slate-950 break-words">
      {q.stimulus_text && q.stimulus_text !== q.question && <LatexRenderer text={q.stimulus_text} />}
      <LatexRenderer text={q.type === "cq" ? cd.stem || q.question : q.question} />
      {q.type === "mcq" && <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {[q.option_a, q.option_b, q.option_c, q.option_d].map((option, index) => <div key={index} className="flex gap-2 rounded border border-slate-200 bg-white px-3 py-2"><strong>{["ক", "খ", "গ", "ঘ"][index]}.</strong><LatexRenderer text={option || "—"} /></div>)}
      </div>}
      {parts.filter(part => part.text).map(part => <div key={part.label}><div className="flex gap-2"><strong>({part.label})</strong><LatexRenderer text={part.text} /></div>{part.answer && <div className="mt-1 text-sm"><strong>উত্তর: </strong><LatexRenderer text={part.answer} /></div>}</div>)}
      {q.correct_answer && <div className="border-t border-slate-200 pt-2"><strong>সঠিক উত্তর: </strong><LatexRenderer text={q.type === "mcq" ? ({ a: "ক", b: "খ", c: "গ", d: "ঘ" } as Record<string, string>)[q.correct_answer.toLowerCase()] || q.correct_answer : q.correct_answer} /></div>}
      {q.explanation && <div><strong>ব্যাখ্যা: </strong><LatexRenderer text={q.explanation} /></div>}
    </div>;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => embedded ? onClose?.() : navigate("/admin/questions")}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="font-heading text-2xl font-bold">Duplicate প্রশ্ন পরিষ্কার</h1>
            <p className="text-sm text-muted-foreground">প্রতিটি group-এর সবচেয়ে পুরোনো ID main হিসেবে রাখা হবে</p>
          </div>
        </div>
        <Button variant="outline" onClick={loadGroups} disabled={loading || deleting} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <Card><CardContent className="p-4 space-y-4">
        {scanError && <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">Scan error: {scanError}</div>}
        <div className="flex flex-wrap gap-3">
          <Select value={classId} onValueChange={(v) => { setClassId(v); setSubjectId("all"); setChapterId("all"); }}>
            <SelectTrigger className="w-[190px]"><SelectValue placeholder="শ্রেণী" /></SelectTrigger>
            <SelectContent><SelectItem value="all">সকল শ্রেণী</SelectItem>{classes.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setChapterId("all"); }}>
            <SelectTrigger className="w-[210px]"><SelectValue placeholder="বিষয়" /></SelectTrigger>
            <SelectContent><SelectItem value="all">সকল বিষয়</SelectItem>{visibleSubjects.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={chapterId} onValueChange={setChapterId}>
            <SelectTrigger className="w-[230px]"><SelectValue placeholder="অধ্যায়" /></SelectTrigger>
            <SelectContent><SelectItem value="all">সকল অধ্যায়</SelectItem>{visibleChapters.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={questionType} onValueChange={setQuestionType}>
            <SelectTrigger className="w-[190px]"><SelectValue placeholder="প্রশ্নের ধরন" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সকল ধরন</SelectItem>
              <SelectItem value="mcq">MCQ</SelectItem>
              <SelectItem value="cq">CQ (সৃজনশীল)</SelectItem>
              <SelectItem value="short">SQ (সংক্ষিপ্ত)</SelectItem>
              <SelectItem value="descriptive">Descriptive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {chapterStats && <div className="space-y-3 border-t pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[{ label: "মোট প্রশ্ন (ডুপ্লিকেটসহ)", value: chapterStats.reduce((sum, row) => sum + row.total, 0) },
              { label: "অতিরিক্ত ডুপ্লিকেট কপি", value: chapterStats.reduce((sum, row) => sum + row.duplicates, 0) },
              { label: "সব ডুপ্লিকেট বাদ দিলে থাকবে", value: chapterStats.reduce((sum, row) => sum + row.total - row.duplicates, 0) }].map(item =>
              <div key={item.label} className="rounded border border-cyan-200 bg-cyan-50/50 p-3"><p className="text-sm text-slate-600">{item.label}</p><strong className="text-2xl text-slate-950">{item.value.toLocaleString("bn-BD")}</strong></div>)}
          </div>
          <p className="text-sm text-muted-foreground">অধ্যায়ের সব ধরনের প্রশ্নের হিসাব; প্রতি দলে একটি মূল কপি থাকবে।</p>
          <table className="w-full text-sm border-collapse"><thead><tr className="bg-slate-100 text-left"><th className="p-2">ধরন</th><th className="p-2">মোট প্রশ্ন</th><th className="p-2">অতিরিক্ত ডুপ্লিকেট</th><th className="p-2">বাদ দিলে থাকবে</th></tr></thead><tbody>
            {[...new Set(["mcq", "cq", "short", "descriptive", ...chapterStats.map(row => row.type)])].map(type => {
              const row = chapterStats.find(row => row.type === type) || { total: 0, duplicates: 0 };
              return <tr key={type} className="border-b"><th className="p-2 text-left">{({mcq: "MCQ", cq: "CQ", short: "SQ", descriptive: "বর্ণনামূলক"} as Record<string, string>)[type] || type}</th><td className="p-2">{row.total.toLocaleString("bn-BD")}</td><td className="p-2 text-amber-800">{row.duplicates.toLocaleString("bn-BD")}</td><td className="p-2 font-semibold">{(row.total - row.duplicates).toLocaleString("bn-BD")}</td></tr>;
            })}
          </tbody></table>
        </div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div className="flex gap-2">
            <Badge variant="outline">ডুপ্লিকেট দল: {totalGroups}</Badge>
            <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">Delete করা যাবে: {totalDuplicateRows}</Badge>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={visibleGroups.length > 0 && visibleGroups.every((g) => selected.has(g.signature))} onCheckedChange={(v) => toggleAll(v === true)} /> সব নির্বাচন
            </label>
            <Button variant="destructive" disabled={selectedGroups.length === 0 || deleting} onClick={() => askDelete(selectedGroups)} className="gap-2">
              <Trash2 className="w-4 h-4" /> নির্বাচিত {selectedRows}টি Delete
            </Button>
          </div>
        </div>
      </CardContent></Card>

      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-emerald-600" /></div>
      ) : visibleGroups.length === 0 ? (
        <Card><CardContent className="py-14 text-center text-muted-foreground"><CheckSquare className="w-10 h-10 mx-auto mb-3 text-emerald-600" />এই filter-এ duplicate প্রশ্ন পাওয়া যায়নি</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {visibleGroups.slice(0, groupLimit).map((group, index) => (
            <Card key={group.signature} className={selected.has(group.signature) ? "border-amber-400 bg-amber-50/30" : ""}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Checkbox className="mt-1" checked={selected.has(group.signature)} onCheckedChange={(v) => toggleGroup(group.signature, v === true)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="font-semibold">দল #{index + 1}</span>
                      <Badge variant="outline">{group.keep.type.toUpperCase()}</Badge>
                      <Badge className="bg-red-100 text-red-800 hover:bg-red-100">{group.duplicates.length}টি duplicate</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">ডিলিটের আগে প্রতিটি কপি মিলিয়ে দেখুন।</p>
                  </div>
                  <Button size="sm" variant="destructive" onClick={() => askDelete([group])} disabled={deleting} className="gap-1 shrink-0"><Trash2 className="w-4 h-4" /> Duplicate Delete</Button>
                </div>
                <div className="pl-7 grid gap-2">
                  {group.all.map((q) => (
                    <div key={q.id} className={`rounded border p-2.5 text-xs ${q.id === group.keep.id ? "border-emerald-300 bg-emerald-50" : "border-red-200 bg-red-50/50"}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={q.id === group.keep.id ? "bg-emerald-600" : "bg-red-600"}>{q.id === group.keep.id ? "MAIN—থাকবে" : "DELETE হবে"}</Badge>
                        <span>ID: {q.id}</span><span>•</span>
                        <span>{nameOf(classes, q.class_id)}</span><span>›</span>
                        <span>{nameOf(subjects, q.subject_id)}</span><span>›</span>
                        <span>{nameOf(chapters, q.chapter_id)}</span>
                      </div>
                      {renderFullQuestion(q)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          {groupLimit < visibleGroups.length && <Button variant="outline" onClick={() => setGroupLimit(limit => limit + 20)}>Show next 20 groups ({groupLimit}/{visibleGroups.length})</Button>}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={(open) => !deleting && setConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate প্রশ্ন delete করবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingGroups.reduce((sum, group) => sum + group.duplicates.length, 0)}টি duplicate delete হবে এবং {pendingGroups.length}টি main copy থাকবে। Saved Paper, Suggestion ও Report-এর reference main copy-তে সরানো হবে। এটি undo করা যাবে না।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={deleteGroups} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Delete হচ্ছে...</> : "হ্যাঁ, Duplicate Delete করুন"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
