import { useEffect, useState } from "react";
import { ChevronRight, Folder, FileText, Trash2, Calendar, Cloud, Search, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type SavedPaper = Pick<Tables<"saved_papers">, "id" | "institution_name" | "exam_name" | "class_name" | "subject_name" | "chapter_names" | "question_ids" | "created_at">;
type Catalog = { classes: Tables<"classes">[]; subjects: Tables<"subjects">[]; chapters: Tables<"chapters">[] };
const bn = (n: number) => n.toLocaleString("bn-BD");
// Group both language versions by level without changing saved paper records.
const classFolder = (name: string) => {
  const normalized = name.normalize("NFC").replace(/য়/g, "য়").replace(/[০-৯]/g, d => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
  const levels: [number, string, string[]][] = [
    [12, "এইচএসসি", ["একাদশ", "দ্বাদশ", "এইচএসসি", "hsc"]],
    [10, "নবম/দশম", ["নবম", "দশম"]],
    [8, "অষ্টম শ্রেণি", ["অষ্টম"]], [7, "সপ্তম শ্রেণি", ["সপ্তম"]],
    [6, "ষষ্ঠ শ্রেণি", ["ষষ্ঠ"]], [5, "পঞ্চম শ্রেণি", ["পঞ্চম"]],
    [4, "চতুর্থ শ্রেণি", ["চতুর্থ"]], [3, "তৃতীয় শ্রেণি", ["তৃতীয়"]],
  ];
  const numbers = (normalized.match(/\d+/g) || []).map(Number);
  const level = Math.max(-1, ...numbers);
  return levels.find(([n, , words]) => (n === 12 ? level === 11 || level === 12 : n === 10 ? level === 9 || level === 10 : level === n) || words.some(w => normalized.toLowerCase().includes(w)))?.[1] || name;
};
const CLASS_FOLDER_ORDER = ["এইচএসসি", "নবম/দশম", "অষ্টম শ্রেণি", "সপ্তম শ্রেণি", "ষষ্ঠ শ্রেণি", "পঞ্চম শ্রেণি", "চতুর্থ শ্রেণি", "তৃতীয় শ্রেণি"];
const className = (p: SavedPaper) => classFolder(p.class_name || "অশ্রেণীবদ্ধ");
const subjectName = (p: SavedPaper) => p.subject_name || "বিষয় উল্লেখ নেই";
const unique = (values: string[]) => [...new Set(values)];

export default function MyQuestions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const selectedClass = classFolder(params.get("class") || "");
  const selectedSubject = selectedClass ? params.get("subject") || "" : "";
  const selectedChapter = selectedSubject ? params.get("chapter") || "" : "";
  const [papers, setPapers] = useState<SavedPaper[]>([]);
  const [catalog, setCatalog] = useState<Catalog>({ classes: [], subjects: [], chapters: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPapers([]);
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setError(false);
    const load = async () => {
      try {
        const [saved, classes, subjects, chapters] = await Promise.all([
          supabase.from("saved_papers").select("id, institution_name, exam_name, class_name, subject_name, chapter_names, question_ids, created_at").eq("teacher_id", user.id).order("created_at", { ascending: false }),
          supabase.from("classes").select("*").order("id"),
          supabase.from("subjects").select("*").order("id"),
          supabase.from("chapters").select("*").eq("is_active", true).order("id"),
        ]);
        if (saved.error || classes.error || subjects.error || chapters.error) throw new Error("load failed");
        if (!cancelled) {
          setPapers(saved.data || []);
          setCatalog({ classes: classes.data || [], subjects: subjects.data || [], chapters: chapters.data || [] });
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [user?.id, retry]);

  const go = (cls = "", subject = "", chapter = "") => {
    const next = new URLSearchParams();
    if (cls) next.set("class", cls);
    if (subject) next.set("subject", subject);
    if (chapter) next.set("chapter", chapter);
    setSearch("");
    setParams(next);
  };
  const handleDelete = async (id: string) => {
    if (!user || deleting) return;
    setDeleting(id);
    try {
      const { error } = await supabase.from("saved_papers").delete().eq("id", id).eq("teacher_id", user.id);
      if (error) throw error;
      setPapers(prev => prev.filter(p => p.id !== id));
      toast.success("প্রশ্নপত্র মুছে ফেলা হয়েছে");
    } catch {
      toast.error("মুছে ফেলতে সমস্যা হয়েছে");
    } finally { setDeleting(null); }
  };
  const openPaper = (id: string) => {
    // The paper viewer prioritizes a fresh draft over a saved paper. Clear only
    // its hand-off keys when explicitly opening a saved paper from the library.
    ["viewPaperQuestions", "viewPaperMeta", "viewPaperSettings"].forEach(key => sessionStorage.removeItem(key));
    navigate(`/dashboard/view-paper?paper_id=${encodeURIComponent(id)}`);
  };

  const classPapers = papers.filter(p => className(p) === selectedClass);
  const subjectPapers = classPapers.filter(p => subjectName(p) === selectedSubject);
  const scope = !selectedClass ? papers : !selectedSubject ? classPapers : !selectedChapter ? subjectPapers : subjectPapers.filter(p => p.chapter_names?.includes(selectedChapter));
  const query = search.trim().toLocaleLowerCase();
  const filtered = scope.filter(p => [p.exam_name, p.institution_name, p.class_name, p.subject_name, ...(p.chapter_names || [])].join(" ").toLocaleLowerCase().includes(query));
  const classIds = catalog.classes.filter(c => classFolder(c.name) === selectedClass).map(c => c.id);
  const subjects = catalog.subjects.filter(s => classIds.includes(s.class_id));
  const subjectIds = subjects.filter(s => s.name === selectedSubject).map(s => s.id);
  const folders = !selectedClass
    ? unique([...catalog.classes.map(c => classFolder(c.name)), ...papers.map(className)]).sort((a, b) => {
        const rank = (name: string) => { const i = CLASS_FOLDER_ORDER.indexOf(name); return i < 0 ? 100 : i; };
        return rank(a) - rank(b) || a.localeCompare(b, "bn");
      })
    : !selectedSubject
      ? unique([...subjects.map(s => s.name), ...classPapers.map(subjectName)])
      : !selectedChapter
        ? unique([...catalog.chapters.filter(c => subjectIds.includes(c.subject_id)).map(c => c.name), ...subjectPapers.flatMap(p => p.chapter_names || [])])
        : [];

  return (
    <div className="space-y-3 text-zinc-950">
      <header className="flex items-center justify-center gap-2 bg-[#0A1E38] px-4 py-3 text-white">
        <Cloud className="h-5 w-5" /><h1 className="font-heading text-xl font-bold">ক্লাউড ব্যাকআপ</h1>
      </header>
      <p className="border border-dashed border-zinc-200 px-4 py-3 text-center text-sm text-zinc-600">আপনার সংরক্ষিত প্রশ্নপত্র শ্রেণি, বিষয় ও অধ্যায় অনুযায়ী সাজানো আছে।</p>

      {selectedClass && <nav aria-label="প্রশ্নপত্রের অবস্থান" className="flex flex-wrap items-center gap-2 text-sm">
        <button className="text-primary hover:underline" onClick={() => go()}>সকল শ্রেণি</button>
        {selectedClass && <><ChevronRight className="w-4 h-4" /><button className="text-primary hover:underline" onClick={() => go(selectedClass)}>{selectedClass}</button></>}
        {selectedSubject && <><ChevronRight className="w-4 h-4" /><button className="text-primary hover:underline" onClick={() => go(selectedClass, selectedSubject)}>{selectedSubject}</button></>}
        {selectedChapter && <><ChevronRight className="w-4 h-4" /><span aria-current="page">{selectedChapter}</span></>}
      </nav>}
      {selectedClass && <div className="flex items-center gap-3">
        {selectedClass && <Button variant="outline" size="icon" aria-label="পেছনে যান" onClick={() => selectedChapter ? go(selectedClass, selectedSubject) : selectedSubject ? go(selectedClass) : go()}><ArrowLeft className="w-4 h-4" /></Button>}
        <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" aria-label="প্রশ্নপত্র খুঁজুন" placeholder="পরীক্ষা, বিষয় বা অধ্যায় দিয়ে খুঁজুন..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      </div>}

      {loading ? <div role="status" className="py-12 text-center text-muted-foreground">লোড হচ্ছে...</div> : error ? (
        <div role="alert" className="rounded-xl border p-8 text-center"><p className="mb-4">প্রশ্নপত্র লোড করা যায়নি। আবার চেষ্টা করুন।</p><Button variant="outline" onClick={() => setRetry(n => n + 1)}>আবার চেষ্টা করুন</Button></div>
      ) : <>
        {!query && folders.length > 0 && <section aria-label={!selectedClass ? "শ্রেণি সমূহ" : !selectedSubject ? "বিষয় সমূহ" : "অধ্যায় সমূহ"}>

          <div className="divide-y divide-zinc-200 border-b border-zinc-200">
            {folders.map(name => <button key={name} onClick={() => !selectedClass ? go(name) : !selectedSubject ? go(selectedClass, name) : go(selectedClass, selectedSubject, name)} className="group flex w-full items-center gap-3 bg-white px-3 py-3.5 text-left transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
              <Folder className="h-4 w-4 shrink-0 fill-zinc-950 text-zinc-950" />
              <div className="flex-1 min-w-0"><p className="font-body text-base break-words">{name}</p></div><ChevronRight className="w-5 h-5 shrink-0 text-zinc-400" />
            </button>)}
          </div>
        </section>}
        {(selectedSubject || query || folders.length === 0) && <section aria-label="সংরক্ষিত প্রশ্নপত্র">
          <h2 className="font-heading text-lg font-bold mb-3">{query ? "অনুসন্ধানের ফলাফল" : selectedChapter || "সকল প্রশ্নপত্র"} <Badge variant="secondary">{bn(filtered.length)}</Badge></h2>
          {filtered.length === 0 ? <div className="rounded-xl border border-dashed py-12 px-4 text-center">
            <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" /><p className="text-muted-foreground mb-4">{query ? "কোনো প্রশ্নপত্র পাওয়া যায়নি" : "এখানে এখনো কোনো প্রশ্নপত্র সংরক্ষিত নেই"}</p>
            {query ? <Button variant="outline" onClick={() => setSearch("")}>অনুসন্ধান মুছুন</Button> : <Button onClick={() => navigate("/dashboard/create")}>প্রশ্ন তৈরি করুন</Button>}
          </div> : <div className="rounded-xl border divide-y overflow-hidden bg-card">{filtered.map(paper => <div key={paper.id} className="flex items-center gap-3 p-4 hover:bg-muted/40">
            <button className="flex-1 flex items-start gap-3 text-left min-w-0" onClick={() => openPaper(paper.id)}>
              <FileText className="w-5 h-5 text-primary mt-1 shrink-0" /><div className="min-w-0"><p className="font-medium break-words">{paper.exam_name || paper.subject_name || "প্রশ্নপত্র"}</p><p className="text-xs text-muted-foreground mt-1">{paper.class_name} • {paper.subject_name} • {bn(paper.question_ids?.length || 0)}টি প্রশ্ন</p><p className="text-xs text-muted-foreground break-words mt-1">{paper.chapter_names?.join(", ")}</p><p className="text-xs text-muted-foreground flex items-center gap-1 mt-2"><Calendar className="w-3 h-3" />{new Date(paper.created_at).toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric" })}</p></div>
            </button>
            <AlertDialog><AlertDialogTrigger asChild><Button aria-label={`${paper.exam_name || "প্রশ্নপত্র"} মুছে ফেলুন`} variant="ghost" size="icon" disabled={deleting !== null} className="shrink-0 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>প্রশ্নপত্র মুছে ফেলবেন?</AlertDialogTitle><AlertDialogDescription>এই প্রশ্নপত্রটি স্থায়ীভাবে মুছে ফেলা হবে। এটি পূর্বাবস্থায় ফেরানো সম্ভব হবে না।</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>বাতিল</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => void handleDelete(paper.id)}>মুছে ফেলুন</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
          </div>)}</div>}
        </section>}
      </>}
    </div>
  );
}
