import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Download, Upload, FileSpreadsheet, ClipboardPaste, Sparkles, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  QType, TYPE_LABELS, ParsedQuestion,
  downloadTemplate, parseExcelFile, parsePastedText, toDbPayload,
} from "@/lib/bulkQuestions";
import AIExtract from "@/components/admin/bulk/AIExtract";

const CTX_KEY = "adminBulkContext.v1";
const readCtx = () => { try { return JSON.parse(localStorage.getItem(CTX_KEY) || "{}"); } catch { return {}; } };

const CHUNK = 50;

export default function AdminQuestionsBulk() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Context
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [type, setType] = useState<QType>("mcq");

  // Data
  const [parsed, setParsed] = useState<ParsedQuestion[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [tab, setTab] = useState("excel");
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    supabase.from("classes").select("id, name").order("id").then(({ data }) => setClasses(data || []));
  }, []);
  useEffect(() => {
    if (!classId) { setSubjects([]); setSubjectId(""); return; }
    supabase.from("subjects").select("id, name").eq("class_id", Number(classId)).order("name")
      .then(({ data }) => setSubjects(data || []));
    setSubjectId(""); setChapterId(""); setTopicId("");
  }, [classId]);
  useEffect(() => {
    if (!subjectId) { setChapters([]); setChapterId(""); return; }
    supabase.from("chapters").select("id, name").eq("subject_id", Number(subjectId)).eq("is_active", true).order("name")
      .then(({ data }) => setChapters(data || []));
    setChapterId(""); setTopicId("");
  }, [subjectId]);
  useEffect(() => {
    if (!chapterId) { setTopics([]); setTopicId(""); return; }
    supabase.from("topics").select("id, name").eq("chapter_id", Number(chapterId)).order("name")
      .then(({ data }) => setTopics(data || []));
    setTopicId("");
  }, [chapterId]);

  const contextValid = classId && subjectId && chapterId;

  const stats = useMemo(() => {
    const valid = parsed.filter((q) => q.errors.length === 0).length;
    return { total: parsed.length, valid, invalid: parsed.length - valid };
  }, [parsed]);

  const handleExcel = async (file: File) => {
    if (!contextValid) { toast.error("প্রথমে শ্রেণী/বিষয়/অধ্যায় সিলেক্ট করুন"); return; }
    try {
      const items = await parseExcelFile(file, type);
      if (items.length === 0) { toast.error("ফাইলে কোনো row পাওয়া যায়নি"); return; }
      setParsed(items);
      toast.success(`${items.length} টি প্রশ্ন লোড হয়েছে`);
    } catch (e: any) {
      toast.error("Parse error: " + e.message);
    }
  };

  const handlePaste = () => {
    if (!contextValid) { toast.error("প্রথমে শ্রেণী/বিষয়/অধ্যায় সিলেক্ট করুন"); return; }
    const items = parsePastedText(pasteText, type);
    if (items.length === 0) { toast.error("Text থেকে প্রশ্ন detect করা যায়নি"); return; }
    setParsed(items);
    toast.success(`${items.length} টি প্রশ্ন detect হয়েছে`);
  };

  const removeRow = (id: string) => setParsed((p) => p.filter((x) => x.tempId !== id));
  const removeInvalid = () => setParsed((p) => p.filter((x) => x.errors.length === 0));

  const doSave = async () => {
    const valid = parsed.filter((q) => q.errors.length === 0);
    if (valid.length === 0) { toast.error("কোনো valid প্রশ্ন নেই"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Login required"); return; }

    setSaving(true); setProgress(0);
    const stimulusGroup = type === "mcq" && valid.some((q) => q.stimulus) ? null : null;
    let inserted = 0, failed = 0;
    for (let i = 0; i < valid.length; i += CHUNK) {
      const batch = valid.slice(i, i + CHUNK).map((q) => toDbPayload(q, {
        class_id: Number(classId),
        subject_id: Number(subjectId),
        chapter_id: Number(chapterId),
        topic_id: topicId && topicId !== "__none__" ? Number(topicId) : null,
        teacher_id: user.id,
        stimulus_group_id: stimulusGroup,
      }));
      const { error } = await supabase.from("questions").insert(batch as any);
      if (error) { failed += batch.length; console.error(error); }
      else inserted += batch.length;
      setProgress(Math.round(((i + batch.length) / valid.length) * 100));
    }
    setSaving(false);
    qc.invalidateQueries({ queryKey: ["admin-questions"] });
    if (failed > 0) toast.error(`${inserted} সফল, ${failed} ব্যর্থ`);
    else toast.success(`${inserted} টি প্রশ্ন সফলভাবে যোগ হয়েছে!`);
    setParsed([]); setPasteText(""); setConfirmOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/questions")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="font-heading text-2xl font-bold">বাল্ক প্রশ্ন আপলোড</h1>
          <p className="text-sm text-muted-foreground">একবারে অনেক প্রশ্ন যোগ করুন — Excel, Paste, বা AI দিয়ে</p>
        </div>
      </div>

      {/* Step 1: Context */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h2 className="font-semibold text-emerald-700 flex items-center gap-2">
            <span className="bg-emerald-100 text-emerald-800 rounded-full w-6 h-6 flex items-center justify-center text-xs">১</span>
            Context সিলেক্ট করুন
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <Label>শ্রেণী *</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue placeholder="বাছাই" /></SelectTrigger>
                <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>বিষয় *</Label>
              <Select value={subjectId} onValueChange={setSubjectId} disabled={!classId}>
                <SelectTrigger><SelectValue placeholder="বাছাই" /></SelectTrigger>
                <SelectContent>{subjects.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>অধ্যায় *</Label>
              <Select value={chapterId} onValueChange={setChapterId} disabled={!subjectId}>
                <SelectTrigger><SelectValue placeholder="বাছাই" /></SelectTrigger>
                <SelectContent>{chapters.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>টপিক (optional)</Label>
              <Select value={topicId} onValueChange={setTopicId} disabled={!chapterId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">(কিছু না)</SelectItem>
                  {topics.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>প্রশ্নের ধরন *</Label>
              <Select value={type} onValueChange={(v) => { setType(v as QType); setParsed([]); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABELS) as QType[]).map((t) => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Input method */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h2 className="font-semibold text-emerald-700 flex items-center gap-2">
            <span className="bg-emerald-100 text-emerald-800 rounded-full w-6 h-6 flex items-center justify-center text-xs">২</span>
            Input পদ্ধতি বাছাই করুন
          </h2>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-4 w-full max-w-2xl">
              <TabsTrigger value="excel" className="gap-2"><FileSpreadsheet className="w-4 h-4" /> Excel</TabsTrigger>
              <TabsTrigger value="paste" className="gap-2"><ClipboardPaste className="w-4 h-4" /> Paste</TabsTrigger>
              <TabsTrigger value="ai" className="gap-2"><Sparkles className="w-4 h-4" /> AI</TabsTrigger>
              <TabsTrigger value="manual" className="gap-2"><Plus className="w-4 h-4" /> Manual</TabsTrigger>
            </TabsList>

            <TabsContent value="excel" className="pt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" onClick={() => downloadTemplate(type)} className="gap-2">
                  <Download className="w-4 h-4" /> {TYPE_LABELS[type]} টেমপ্লেট ডাউনলোড
                </Button>
                <label className="inline-flex">
                  <input
                    type="file" accept=".xlsx,.xls,.csv" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleExcel(f); e.target.value = ""; }}
                  />
                  <Button asChild className="gap-2 bg-emerald-600 hover:bg-emerald-700"><span><Upload className="w-4 h-4" /> ফাইল আপলোড</span></Button>
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                টেমপ্লেট ডাউনলোড করে ভরে আপলোড করুন। HTML/LaTeX/Cloudinary ছবি URL cell-এ ব্যবহার করা যাবে।
              </p>
            </TabsContent>

            <TabsContent value="paste" className="pt-4 space-y-3">
              <Textarea
                value={pasteText} onChange={(e) => setPasteText(e.target.value)}
                placeholder={type === "mcq"
                  ? "১. প্রশ্ন?\nক) অপশন\nখ) অপশন\nগ) অপশন\nঘ) অপশন\nউত্তর: খ\nব্যাখ্যা: ..."
                  : type === "cq"
                  ? "উদ্দীপক: ...\nক) ...\nখ) ...\nগ) ...\nঘ) ..."
                  : "১. প্রশ্ন?\nউত্তর: ..."}
                rows={12} className="font-mono text-sm"
              />
              <Button onClick={handlePaste} className="bg-emerald-600 hover:bg-emerald-700">Parse করুন</Button>
            </TabsContent>

            <TabsContent value="ai" className="pt-4">
              {contextValid ? (
                <AIExtract type={type} onExtracted={(qs) => setParsed((p) => [...p, ...qs])} />
              ) : (
                <p className="text-sm text-muted-foreground">প্রথমে উপরের Context সিলেক্ট করুন</p>
              )}
            </TabsContent>

            <TabsContent value="manual" className="pt-4">
              {contextValid ? (
                <ManualMultiAdd type={type} onAdd={(q) => setParsed((p) => [...p, q])} />
              ) : (
                <p className="text-sm text-muted-foreground">প্রথমে উপরের Context সিলেক্ট করুন</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Step 3: Preview */}
      {parsed.length > 0 && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold text-emerald-700 flex items-center gap-2">
                <span className="bg-emerald-100 text-emerald-800 rounded-full w-6 h-6 flex items-center justify-center text-xs">৩</span>
                Preview ও যাচাই
              </h2>
              <div className="flex items-center gap-2">
                <Badge variant="outline">মোট: {stats.total}</Badge>
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Valid: {stats.valid}</Badge>
                {stats.invalid > 0 && <Badge variant="destructive">Invalid: {stats.invalid}</Badge>}
                {stats.invalid > 0 && <Button variant="outline" size="sm" onClick={removeInvalid}>Invalid remove</Button>}
                <Button variant="ghost" size="sm" onClick={() => setParsed([])}>Clear</Button>
              </div>
            </div>

            <div className="border rounded-lg divide-y max-h-[500px] overflow-y-auto">
              {parsed.map((q, i) => (
                <div key={q.tempId} className={`p-3 flex items-start gap-3 ${q.errors.length ? "bg-red-50/50" : ""}`}>
                  <div className="text-xs text-muted-foreground w-8">#{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    {q.stimulus && <div className="text-xs text-muted-foreground line-clamp-2 mb-1"><span className="font-semibold">উদ্দীপক:</span> {q.stimulus.replace(/<[^>]+>/g, "")}</div>}
                    <div className="font-medium text-sm line-clamp-2">{q.question || q.creative_data?.stem?.slice(0, 100) || "(no question)"}</div>
                    {q.type === "mcq" && (
                      <div className="text-xs text-muted-foreground mt-1 grid grid-cols-2 gap-x-4">
                        <span>ক) {q.option_a}</span><span>খ) {q.option_b}</span>
                        <span>গ) {q.option_c}</span><span>ঘ) {q.option_d}</span>
                        <span className="col-span-2 text-emerald-700">সঠিক: {q.correct_answer}</span>
                      </div>
                    )}
                    {q.type === "cq" && q.creative_data && (
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        <div>ক) {q.creative_data.q_ka}</div><div>খ) {q.creative_data.q_kha}</div>
                        <div>গ) {q.creative_data.q_ga}</div>{q.creative_data.q_gha && <div>ঘ) {q.creative_data.q_gha}</div>}
                      </div>
                    )}
                    {q.errors.length > 0 && (
                      <div className="mt-1 flex items-start gap-1 text-xs text-red-600">
                        <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>{q.errors.join(", ")}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {q.errors.length === 0 && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    <Button variant="ghost" size="icon" onClick={() => removeRow(q.tempId)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {saving && <Progress value={progress} className="h-2" />}

            <div className="flex justify-end gap-2">
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={saving || stats.valid === 0}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {saving ? `Saving... ${progress}%` : `${stats.valid} টি প্রশ্ন সেভ করুন`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>নিশ্চিত করুন</AlertDialogTitle>
            <AlertDialogDescription>
              {stats.valid} টি প্রশ্ন ডাটাবেসে যোগ হবে। এটি undo করা যাবে না।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={doSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              হ্যাঁ, সেভ করুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
