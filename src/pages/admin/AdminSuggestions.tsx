import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown, Edit, Eye, FileText, Search } from "lucide-react";
import LatexRenderer from "@/components/LatexRenderer";
import { sortClasses, sortChapters } from "@/lib/classOrder";

const toBanglaNum = (n: number) => String(n).replace(/\d/g, d => "০১২৩৪৫৬৭৮৯"[+d]);

type Suggestion = {
  id: number;
  title: string;
  description: string;
  class_id: number;
  subject_id: number;
  question_ids: number[];
  is_active: boolean;
  created_at: string;
};

type Question = {
  id: number;
  question: string;
  type: string;
  option_a?: string | null;
  option_b?: string | null;
  option_c?: string | null;
  option_d?: string | null;
  correct_answer?: string | null;
  creative_data?: any;
};

export default function AdminSuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: number; name: string; class_id: number }[]>([]);
  const [packages, setPackages] = useState<{ id: number; class_name: string; subject_name: string; type: string }[]>([]);
  const [assignments, setAssignments] = useState<Record<number, number[]>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<number[]>([]);
  const [selectedPackageIds, setSelectedPackageIds] = useState<number[]>([]);

  // Question selector state
  const [qSelectorOpen, setQSelectorOpen] = useState(false);
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);
  const [chapters, setChapters] = useState<{ id: number; name: string; subject_id: number }[]>([]);
  const [qChapterId, setQChapterId] = useState("");
  const [qTypeFilter, setQTypeFilter] = useState("all");
  const [qSearch, setQSearch] = useState("");
  const [qLoading, setQLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [cRes, sRes, sugRes, pkgRes, asgRes] = await Promise.all([
      supabase.from("classes").select("id, name").order("id"),
      supabase.from("subjects").select("id, name, class_id").order("id"),
      supabase.from("suggestions").select("*").order("created_at", { ascending: false }),
      supabase.from("pricing_packages").select("id, class_name, subject_name, type").eq("is_active", true).order("sort_order"),
      supabase.from("suggestion_assignments").select("suggestion_id, package_id"),
    ]);
    setClasses(sortClasses(cRes.data || []));
    setSubjects(sRes.data || []);
    setSuggestions((sugRes.data as any[]) || []);
    setPackages(pkgRes.data || []);

    // Build assignments map
    const map: Record<number, number[]> = {};
    (asgRes.data || []).forEach((a: any) => {
      if (!map[a.suggestion_id]) map[a.suggestion_id] = [];
      map[a.suggestion_id].push(a.package_id);
    });
    setAssignments(map);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filteredSubjects = useMemo(() =>
    classId ? subjects.filter(s => s.class_id === +classId) : [],
    [classId, subjects]
  );

  const filteredChapters = useMemo(() =>
    subjectId ? chapters.filter(c => c.subject_id === +subjectId) : [],
    [subjectId, chapters]
  );

  // Fetch chapters when subject changes
  useEffect(() => {
    if (!subjectId) { setChapters([]); return; }
    supabase.from("chapters").select("id, name, subject_id").eq("subject_id", +subjectId).eq("is_active", true).order("id")
      .then(({ data }) => setChapters(sortChapters(data || [])));
  }, [subjectId]);

  const openCreate = () => {
    setEditing(null);
    setTitle(""); setDescription(""); setClassId(""); setSubjectId("");
    setSelectedQuestionIds([]); setSelectedPackageIds([]);
    setDialogOpen(true);
  };

  const openEdit = (s: Suggestion) => {
    setEditing(s);
    setTitle(s.title);
    setDescription(s.description);
    setClassId(String(s.class_id));
    setSubjectId(String(s.subject_id));
    setSelectedQuestionIds([...s.question_ids]);
    setSelectedPackageIds(assignments[s.id] || []);
    setDialogOpen(true);
  };

  const fetchQuestions = async () => {
    if (!subjectId) return;
    setQLoading(true);
    let query = supabase.from("questions").select("id, question, type, option_a, option_b, option_c, option_d, correct_answer, creative_data, chapter_id")
      .eq("subject_id", +subjectId);
    if (qChapterId) query = query.eq("chapter_id", +qChapterId);
    if (qTypeFilter !== "all") query = query.eq("type", qTypeFilter);
    const { data } = await query.order("id").limit(200);
    setAvailableQuestions((data as any[]) || []);
    setQLoading(false);
  };

  useEffect(() => {
    if (qSelectorOpen && subjectId) fetchQuestions();
  }, [qSelectorOpen, qChapterId, qTypeFilter, subjectId]);

  const toggleQuestion = (id: number) => {
    setSelectedQuestionIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const moveQuestion = (idx: number, dir: -1 | 1) => {
    const arr = [...selectedQuestionIds];
    const swap = idx + dir;
    if (swap < 0 || swap >= arr.length) return;
    [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
    setSelectedQuestionIds(arr);
  };

  const removeQuestion = (id: number) => {
    setSelectedQuestionIds(prev => prev.filter(x => x !== id));
  };

  const togglePackage = (pkgId: number) => {
    setSelectedPackageIds(prev => prev.includes(pkgId) ? prev.filter(x => x !== pkgId) : [...prev, pkgId]);
  };

  const handleSave = async () => {
    if (!title.trim() || !classId || !subjectId) {
      toast.error("শিরোনাম, শ্রেণী ও বিষয় আবশ্যক");
      return;
    }
    if (selectedQuestionIds.length === 0) {
      toast.error("অন্তত একটি প্রশ্ন যোগ করুন");
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      class_id: +classId,
      subject_id: +subjectId,
      question_ids: selectedQuestionIds,
    };

    let suggestionId: number;

    if (editing) {
      const { error } = await supabase.from("suggestions").update(payload).eq("id", editing.id);
      if (error) { toast.error("আপডেট ব্যর্থ", { description: error.message }); return; }
      suggestionId = editing.id;
    } else {
      const { data, error } = await supabase.from("suggestions").insert(payload).select("id").single();
      if (error) { toast.error("তৈরি ব্যর্থ", { description: error.message }); return; }
      suggestionId = data.id;
    }

    // Sync assignments
    await supabase.from("suggestion_assignments").delete().eq("suggestion_id", suggestionId);
    if (selectedPackageIds.length > 0) {
      await supabase.from("suggestion_assignments").insert(
        selectedPackageIds.map(pid => ({ suggestion_id: suggestionId, package_id: pid }))
      );
    }

    toast.success(editing ? "সাজেশন আপডেট হয়েছে" : "সাজেশন তৈরি হয়েছে");
    setDialogOpen(false);
    fetchAll();
  };

  const handleDelete = async (id: number) => {
    await supabase.from("suggestions").delete().eq("id", id);
    toast.success("সাজেশন মুছে ফেলা হয়েছে");
    fetchAll();
  };

  const toggleActive = async (s: Suggestion) => {
    await supabase.from("suggestions").update({ is_active: !s.is_active }).eq("id", s.id);
    fetchAll();
  };

  const getClassName = (id: number) => classes.find(c => c.id === id)?.name || "";
  const getSubjectName = (id: number) => subjects.find(s => s.id === id)?.name || "";

  const typeLabel: Record<string, string> = { mcq: "MCQ", short: "সংক্ষিপ্ত", creative: "সৃজনশীল", descriptive: "বর্ণনামূলক" };

  if (loading) return <div className="text-center py-10 text-muted-foreground">লোড হচ্ছে...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">সাজেশন/রেডি প্রশ্ন ম্যানেজমেন্ট</h1>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> নতুন সাজেশন</Button>
      </div>

      {/* List */}
      <div className="grid gap-4">
        {suggestions.length === 0 && <p className="text-center text-muted-foreground py-8">কোনো সাজেশন নেই।</p>}
        {suggestions.map(s => (
          <Card key={s.id}>
            <CardContent className="p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-heading font-semibold text-base">{s.title}</h3>
                  {!s.is_active && <Badge variant="secondary">নিষ্ক্রিয়</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{getClassName(s.class_id)} • {getSubjectName(s.subject_id)}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{toBanglaNum(s.question_ids.length)} টি প্রশ্ন</Badge>
                  {(assignments[s.id] || []).map(pid => {
                    const pkg = packages.find(p => p.id === pid);
                    return pkg ? <Badge key={pid} className="bg-primary/10 text-primary border-0 text-xs">{pkg.class_name} - {pkg.subject_name}</Badge> : null;
                  })}
                </div>
                {s.description && <p className="text-xs text-muted-foreground line-clamp-1">{s.description}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s)} />
                <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Edit className="w-4 h-4" /></Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>"{s.title}" মুছে ফেলবেন?</AlertDialogTitle>
                      <AlertDialogDescription>এই সাজেশন এবং এর সকল অ্যাসাইনমেন্ট মুছে যাবে।</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>বাতিল</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(s.id)} className="bg-destructive text-destructive-foreground">মুছুন</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Builder Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">{editing ? "সাজেশন সম্পাদনা" : "নতুন সাজেশন তৈরি"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>শিরোনাম *</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="যেমন: ২০২৬ সালের চূড়ান্ত সাজেশন" />
              </div>
              <div>
                <Label>শ্রেণী *</Label>
                <Select value={classId} onValueChange={v => { setClassId(v); setSubjectId(""); }}>
                  <SelectTrigger><SelectValue placeholder="শ্রেণী নির্বাচন" /></SelectTrigger>
                  <SelectContent>{classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>বিষয় *</Label>
                <Select value={subjectId} onValueChange={setSubjectId} disabled={!classId}>
                  <SelectTrigger><SelectValue placeholder="বিষয় নির্বাচন" /></SelectTrigger>
                  <SelectContent>{filteredSubjects.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>বিবরণ</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="ঐচ্ছিক বিবরণ..." rows={2} />
              </div>
            </div>

            {/* Selected Questions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-heading">নির্বাচিত প্রশ্নসমূহ ({toBanglaNum(selectedQuestionIds.length)})</Label>
                <Button variant="outline" size="sm" onClick={() => setQSelectorOpen(true)} disabled={!subjectId} className="gap-1">
                  <Plus className="w-3.5 h-3.5" /> প্রশ্ন যোগ করুন
                </Button>
              </div>
              {selectedQuestionIds.length === 0 ? (
                <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-4 text-center">কোনো প্রশ্ন নির্বাচন করা হয়নি</p>
              ) : (
                <div className="space-y-1 max-h-60 overflow-y-auto border rounded-lg p-2">
                  {selectedQuestionIds.map((qid, idx) => (
                    <div key={qid} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/50 text-sm">
                      <span className="text-muted-foreground font-mono text-xs w-6">{toBanglaNum(idx + 1)}.</span>
                      <span className="flex-1 truncate">Q#{qid}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveQuestion(idx, -1)} disabled={idx === 0}><ArrowUp className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveQuestion(idx, 1)} disabled={idx === selectedQuestionIds.length - 1}><ArrowDown className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeQuestion(qid)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Package Assignment */}
            <div>
              <Label className="text-base font-heading mb-2 block">সাবস্ক্রিপশন প্যাকেজ এ্যাসাইন করুন</Label>
              {packages.length === 0 ? (
                <p className="text-sm text-muted-foreground">কোনো সক্রিয় প্যাকেজ নেই।</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border rounded-lg p-3">
                  {packages.map(pkg => (
                    <label key={pkg.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer">
                      <Checkbox checked={selectedPackageIds.includes(pkg.id)} onCheckedChange={() => togglePackage(pkg.id)} />
                      <span className="text-sm">{pkg.class_name} — {pkg.subject_name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <Button onClick={handleSave} className="w-full">{editing ? "আপডেট করুন" : "সাজেশন সংরক্ষণ করুন"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Question Selector Dialog */}
      <Dialog open={qSelectorOpen} onOpenChange={setQSelectorOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">প্রশ্ন নির্বাচন করুন</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Select value={qChapterId} onValueChange={setQChapterId}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="অধ্যায়" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_chapters">সকল অধ্যায়</SelectItem>
                  {filteredChapters.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={qTypeFilter} onValueChange={setQTypeFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সকল প্রকার</SelectItem>
                  <SelectItem value="mcq">MCQ</SelectItem>
                  <SelectItem value="short">সংক্ষিপ্ত</SelectItem>
                  <SelectItem value="creative">সৃজনশীল</SelectItem>
                  <SelectItem value="descriptive">বর্ণনামূলক</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={fetchQuestions} className="gap-1"><Search className="w-3.5 h-3.5" /> খুঁজুন</Button>
            </div>

            {qLoading ? (
              <p className="text-center text-muted-foreground py-4">লোড হচ্ছে...</p>
            ) : availableQuestions.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">কোনো প্রশ্ন পাওয়া যায়নি।</p>
            ) : (
              <div className="space-y-1 max-h-[50vh] overflow-y-auto">
                {availableQuestions.map(q => {
                  const selected = selectedQuestionIds.includes(q.id);
                  return (
                    <label key={q.id} className={`flex items-start gap-2 px-3 py-2 rounded-lg cursor-pointer border transition-colors ${selected ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/50"}`}>
                      <Checkbox checked={selected} onCheckedChange={() => toggleQuestion(q.id)} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{typeLabel[q.type] || q.type}</Badge>
                          <span className="text-[10px] text-muted-foreground">#{q.id}</span>
                        </div>
                        <div className="text-sm line-clamp-2"><LatexRenderer text={q.question} /></div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            <Button onClick={() => setQSelectorOpen(false)} className="w-full">
              {toBanglaNum(selectedQuestionIds.length)} টি প্রশ্ন নির্বাচিত — সম্পন্ন
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
