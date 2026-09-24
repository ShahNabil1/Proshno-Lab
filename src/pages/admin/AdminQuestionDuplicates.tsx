import { useEffect, useState } from "react";
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
import { areQuestionsDuplicates } from "@/lib/questionDuplicates";
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
};

type NamedRow = { id: number; name: string; class_id?: number; subject_id?: number };
type DuplicateGroup = { signature: string; keep: QuestionRow; duplicates: QuestionRow[]; all: QuestionRow[] };

export default function AdminQuestionDuplicates({ embedded = false, onClose }: { embedded?: boolean; onClose?: () => void } = {}) {
  const navigate = useNavigate();
  const [visibleGroups, setVisibleGroups] = useState<DuplicateGroup[]>([]);
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

  const loadGroups = async () => {
    setLoading(true);
    setScanError("");
    try {
      // A selected chapter is small enough to use the exact same 94% similarity
      // rule as View Paper. This catches visually identical questions whose
      // wording/LaTeX differs slightly (for example, "কর" vs "করো").
      if (chapterId !== "all") {
        const rows: QuestionRow[] = [];
        const pageSize = 1000;
        for (let from = 0; ; from += pageSize) {
          let query = supabase
            .from("questions")
            .select("id,type,question,option_a,option_b,option_c,option_d,creative_data,stimulus_text,class_id,subject_id,chapter_id,created_at")
            .eq("chapter_id", Number(chapterId))
            .order("id")
            .range(from, from + pageSize - 1);
          if (classId !== "all") query = query.eq("class_id", Number(classId));
          if (subjectId !== "all") query = query.eq("subject_id", Number(subjectId));
          if (questionType !== "all") query = query.eq("type", questionType);
          const { data: page, error: pageError } = await query;
          if (pageError) throw pageError;
          rows.push(...((page || []) as QuestionRow[]));
          if (!page || page.length < pageSize) break;
        }

        const grouped: DuplicateGroup[] = [];
        for (const question of rows) {
          const match = grouped.find((group) => areQuestionsDuplicates(group.keep, question));
          if (match) {
            match.all.push(question);
            match.duplicates.push(question);
          } else {
            grouped.push({ signature: `similar-${question.id}`, keep: question, duplicates: [], all: [question] });
          }
        }
        const duplicatesOnly = grouped.filter((group) => group.duplicates.length > 0);
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
      const groups = (data || []).map((row: any) => {
        const all = (row.occurrences || []) as QuestionRow[];
        const keep = all.find((q) => q.id === Number(row.keep_id)) || all[0];
        return { signature: row.signature, keep, duplicates: all.filter((q) => q.id !== keep.id), all };
      }).filter((group: DuplicateGroup) => group.keep && group.duplicates.length > 0);
      setVisibleGroups(groups);
      setTotalGroups(Number(data?.[0]?.total_groups || groups.length));
      setSelected(new Set());
    } catch (error: any) {
      setVisibleGroups([]);
      setTotalGroups(0);
      setScanError(error.message || "Unknown error");
      toast.error(`Duplicate scan ব্যর্থ: ${error.message}`);
    } finally {
      setLoading(false);
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

  const questionText = (q: QuestionRow) => {
    if (q.type === "cq") return q.creative_data?.stem || q.question;
    if (q.type === "descriptive") return q.creative_data?.desc_q_ka || q.question;
    return q.question;
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div className="flex gap-2">
            <Badge variant="outline">Group: {totalGroups}</Badge>
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
          {visibleGroups.map((group, index) => (
            <Card key={group.signature} className={selected.has(group.signature) ? "border-amber-400 bg-amber-50/30" : ""}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Checkbox className="mt-1" checked={selected.has(group.signature)} onCheckedChange={(v) => toggleGroup(group.signature, v === true)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="font-semibold">Group #{index + 1}</span>
                      <Badge variant="outline">{group.keep.type.toUpperCase()}</Badge>
                      <Badge className="bg-red-100 text-red-800 hover:bg-red-100">{group.duplicates.length}টি duplicate</Badge>
                    </div>
                    <LatexRenderer text={questionText(group.keep)} className="text-sm font-medium" />
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
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
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
