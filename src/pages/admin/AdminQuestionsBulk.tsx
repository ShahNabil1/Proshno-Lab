import { PATTERN_CHAPTER_PREFIX, patternChapterName, ensurePatternChapter } from "@/lib/languagePatternChapters";
import { allowedQuestionTypes, isLanguageType, languageSubject, patternGrade } from "@/lib/languageQuestionTypes";
import EnglishFirstUpload from '@/components/admin/bulk/EnglishFirstUpload';
import { useEffect, useMemo, useRef, useState } from "react";
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
import { ArrowLeft, Download, Upload, FileSpreadsheet, ClipboardPaste, Bot, Trash2, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import LatexRenderer from "@/components/LatexRenderer";
import {
  QType, TYPE_LABELS, ParsedQuestion,
  downloadTemplate, parseExcelFile, parsePastedText, toDbPayload, isMathSubjectName,
  markBatchDuplicates, markDbDuplicates, questionSignature,
} from "@/lib/bulkQuestions";
import AIExtract from "@/components/admin/bulk/AIExtract";
import PasteGuide from "@/components/admin/bulk/PasteGuide";
import { languagePasteVariants, withPasteReferences } from "@/lib/languagePasteGuides";
import { sortClasses, sortChapters } from "@/lib/classOrder";
import { findRepeatedStimuli, normalizeStimulusKey } from "@/lib/stimulusGroups";

const CTX_KEY = "adminBulkContext.v1";
const readCtx = () => { try { return JSON.parse(localStorage.getItem(CTX_KEY) || "{}"); } catch { return {}; } };

const CHUNK = 50;
const MAX_EXCEL_FILES = 20;
const topicKey = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase("bn-BD");

export default function AdminQuestionsBulk() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Context
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const _init = readCtx();
  const [classId, setClassId] = useState<string>(_init.classId || "");
  const [subjectId, setSubjectId] = useState<string>(_init.subjectId || "");
  const [chapterId, setChapterId] = useState<string>(_init.chapterId || "");
  const [topicId, setTopicId] = useState<string>(_init.topicId || "");
  const [type, setType] = useState<QType>((_init.type as QType) || "mcq");

  // Data
  const [parsed, setParsed] = useState<ParsedQuestion[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [tab, setTab] = useState("excel");
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Retry state: failed chunks kept with their payloads + source row numbers + last error
  type FailedChunk = { id: string; payloads: any[]; rows: number[]; error: string };
  const [failedChunks, setFailedChunks] = useState<FailedChunk[]>([]);
  const [insertedCount, setInsertedCount] = useState(0);
  // Progress detail + cancellation
  const [chunkProg, setChunkProg] = useState({ done: 0, total: 0, rowsDone: 0, rowsTotal: 0 });
  const cancelRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cancelled, setCancelled] = useState(false);

  // Persist context
  useEffect(() => {
    localStorage.setItem(CTX_KEY, JSON.stringify({ classId, subjectId, chapterId, topicId, type }));
  }, [classId, subjectId, chapterId, topicId, type]);

  useEffect(() => {
    supabase.from("classes").select("id, name").order("id").then(({ data }) => setClasses(sortClasses(data || [])));
  }, []);
  useEffect(() => {
    if (!classId) { setSubjects([]); return; }
    supabase.from("subjects").select("id, name").eq("class_id", Number(classId)).order("name")
      .then(({ data }) => setSubjects(data || []));
  }, [classId]);
  useEffect(() => {
    if (!subjectId) { setChapters([]); return; }
    supabase.from("chapters").select("id, name").eq("subject_id", Number(subjectId)).eq("is_active", true).order("name")
      .then(({ data }) => {
        const available = sortChapters(data || []);
        setChapters(available);
        setChapterId(current => available.some(c=>String(c.id)===current) ? current : '');
      });
  }, [subjectId]);
  useEffect(() => {
    if (!chapterId || chapterId.startsWith(PATTERN_CHAPTER_PREFIX)) { setTopics([]); return; }
    supabase.from("topics").select("id, name").eq("chapter_id", Number(chapterId)).order("name")
      .then(({ data }) => setTopics(data || []));
  }, [chapterId]);

  const allowedTypes = allowedQuestionTypes(classes.find(c=>String(c.id)===classId)?.name || "",subjects.find(s=>String(s.id)===subjectId)?.name || "",patternChapterName(chapterId,chapters));
  const suggestedChapters: string[] = [];
  const [bulkMarks,setBulkMarks] = useState(0);
  useEffect(()=>{ if(!allowedTypes.includes(type)) { setType(allowedTypes[0] || "mcq");setParsed([]); } },[classId,subjectId,chapterId,classes,subjects,chapters]);
  useEffect(()=>{if(chapterId.startsWith(PATTERN_CHAPTER_PREFIX)){setChapterId('');setTopicId('');}},[chapterId]);
  const contextValid = classId && subjectId && chapters.some(c=>String(c.id)===chapterId);
  const isMathSubject = isMathSubjectName(subjects.find((s) => String(s.id) === subjectId)?.name);

  const isEnglishFirst = languageSubject(subjects.find(s=>String(s.id)===subjectId)?.name || '') === 'english1';
  const pasteVariants = languagePasteVariants(type,isEnglishFirst);

  const stats = useMemo(() => {
    const invalid = parsed.filter((q) => q.errors.length > 0).length;
    const dup = parsed.filter((q) => q.errors.length === 0 && q.duplicate).length;
    const valid = parsed.filter((q) => q.errors.length === 0 && !q.duplicate).length;
    return { total: parsed.length, valid, invalid, dup };
  }, [parsed]);

  /** Marks in-batch duplicates + duplicates already saved in the selected chapter. */
  const applyDedupe = async (items: ParsedQuestion[]) => {
    const marked = markBatchDuplicates(items);
    if(chapterId.startsWith(PATTERN_CHAPTER_PREFIX)) return marked;
    try {
      const sigs = new Set<string>();
      const PAGE = 1000;
      for (let from = 0; from < 20000; from += PAGE) {
        const { data, error } = await supabase
          .from("questions")
          .select("id, type, question, option_a, option_b, option_c, option_d, creative_data")
          .eq("chapter_id", Number(chapterId))
          .eq("type", type)
          .order("id")
          .range(from, from + PAGE - 1);
        if (error || !data || data.length === 0) break;
        data.forEach((r: any) => sigs.add(questionSignature(r)));
        if (data.length < PAGE) break;
      }
      return markDbDuplicates(marked, sigs);
    } catch {
      return marked;
    }
  };

  const loadItems = async (items: ParsedQuestion[], label: string) => {
    const deduped = await applyDedupe(items);
    setParsed(deduped);
    const dups = deduped.filter((q) => q.duplicate).length;
    toast.success(`${items.length} টি প্রশ্ন ${label}${dups ? ` • ${dups} টি ডুপ্লিকেট (স্কিপ হবে)` : ""}`);
  };

  const handleExcelFiles = async (files: File[]) => {
    if (!contextValid) { toast.error("প্রথমে শ্রেণী/বিষয়/অধ্যায় সিলেক্ট করুন"); return; }
    if (files.length > MAX_EXCEL_FILES) {
      toast.error(`একসাথে সর্বোচ্চ ${MAX_EXCEL_FILES}টি Excel বা CSV ফাইল আপলোড করা যাবে`);
      return;
    }
    const results = await Promise.allSettled(files.map((file) => parseExcelFile(file, type, isMathSubject)));
    const items = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    const failedFiles = results.flatMap((result, index) => result.status === "rejected" ? [files[index].name] : []);
    if (failedFiles.length > 0) {
      toast.error(`${failedFiles.length}টি ফাইল parse করা যায়নি: ${failedFiles.join(", ")}`);
    }
    if (items.length === 0) { toast.error("ফাইলগুলোতে কোনো প্রশ্নের row পাওয়া যায়নি"); return; }
    await loadItems(items, `${files.length - failedFiles.length}টি ফাইল থেকে লোড হয়েছে`);
  };

  const handlePaste = async () => {
    if (!contextValid) { toast.error("প্রথমে শ্রেণী/বিষয়/অধ্যায় সিলেক্ট করুন"); return; }
    const items = parsePastedText(pasteText, type, isMathSubject).map(q=>isLanguageType(q.type)?{...q,creative_data:{marks:bulkMarks}}:q);
    if (items.length === 0) { toast.error("Text থেকে প্রশ্ন detect করা যায়নি — i আইকনে ফরম্যাট দেখুন"); return; }
    await loadItems(items, "detect হয়েছে");
  };

  const removeRow = (id: string) => setParsed((p) => p.filter((x) => x.tempId !== id));
  const removeInvalid = () => setParsed((p) => p.filter((x) => x.errors.length === 0));
  const removeDuplicates = () => setParsed((p) => p.filter((x) => !x.duplicate));


  const runInsertChunks = async (chunks: FailedChunk[]) => {
    const nextFailed: FailedChunk[] = [];
    let done = 0;
    let ok = 0;
    let rowsDone = 0;
    const total = chunks.reduce((s, c) => s + c.payloads.length, 0);
    setChunkProg({ done: 0, total: chunks.length, rowsDone: 0, rowsTotal: total });
    const remaining: FailedChunk[] = [];
    for (let idx = 0; idx < chunks.length; idx++) {
      const ch = chunks[idx];
      if (cancelRef.current) {
        // Preserve untried chunks so user can resume via retry
        remaining.push(...chunks.slice(idx));
        break;
      }
      const { error } = await supabase.from("questions").insert(ch.payloads as any);
      if (error) {
        console.error("Chunk failed", ch.rows, error);
        nextFailed.push({ ...ch, error: error.message });
      } else {
        ok += ch.payloads.length;
      }
      done += 1;
      rowsDone += ch.payloads.length;
      setProgress(Math.round((rowsDone / total) * 100));
      setChunkProg({ done, total: chunks.length, rowsDone, rowsTotal: total });
    }
    return { ok, nextFailed: [...nextFailed, ...remaining], cancelled: cancelRef.current };
  };

  const doSave = async () => {
    const valid = parsed.filter((q) => q.errors.length === 0 && !q.duplicate);
    if (valid.length === 0) { toast.error("কোনো valid প্রশ্ন নেই"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Login required"); return; }

    cancelRef.current = false;
    setCancelled(false);
    setSaving(true); setProgress(0); setFailedChunks([]); setInsertedCount(0);

    // Resolve every Excel topic once. Existing topics are reused; missing ones
    // are created in one batch under the currently selected chapter.
    const topicIds = new Map<string, number>();
    let resolvedChapterId = Number(chapterId);
    try {
      resolvedChapterId = await ensurePatternChapter(chapterId,Number(subjectId));
      if(chapterId.startsWith(PATTERN_CHAPTER_PREFIX)) {
        setChapters(cs=>cs.some(c=>c.id===resolvedChapterId)?cs:[...cs,{id:resolvedChapterId,name:patternChapterName(chapterId,chapters)}]);
        setChapterId(String(resolvedChapterId));
      }
      const { data: currentTopics, error: topicsError } = await supabase
        .from("topics")
        .select("id, name")
        .eq("chapter_id", resolvedChapterId);
      if (topicsError) throw topicsError;

      (currentTopics || []).forEach((item) => topicIds.set(topicKey(item.name), item.id));
      const missingByKey = new Map<string, string>();
      valid.forEach((question) => {
        if (!question.topicName) return;
        const key = topicKey(question.topicName);
        if (key && !topicIds.has(key) && !missingByKey.has(key)) {
          missingByKey.set(key, question.topicName.trim().replace(/\s+/g, " "));
        }
      });

      if (missingByKey.size > 0) {
        const { data: createdTopics, error: createError } = await supabase
          .from("topics")
          .insert([...missingByKey.values()].map((name) => ({ name, chapter_id: resolvedChapterId })))
          .select("id, name");
        if (createError) throw createError;
        (createdTopics || []).forEach((item) => topicIds.set(topicKey(item.name), item.id));
        setTopics((previous) => [...previous, ...(createdTopics || [])]);
      }

      const unresolvedTopic = valid.find((question) => question.topicName && !topicIds.has(topicKey(question.topicName)));
      if (unresolvedTopic?.topicName) {
        throw new Error(`"${unresolvedTopic.topicName}" টপিকটি তৈরি করা যায়নি`);
      }
    } catch (error: any) {
      setSaving(false);
      toast.error(`টপিক তৈরি/খোঁজা যায়নি: ${error?.message || "অজানা ত্রুটি"}`);
      return;
    }

    const repeatedStimuli = type === "mcq"
      ? findRepeatedStimuli(valid, q => q.stimulus)
      : new Set<string>();
    const stimulusGroups = new Map<string, string>();

    repeatedStimuli.forEach((stimulusKey) => {
      stimulusGroups.set(stimulusKey, crypto.randomUUID());
    });

    const chunks: FailedChunk[] = [];
    for (let i = 0; i < valid.length; i += CHUNK) {
      const slice = valid.slice(i, i + CHUNK);
      chunks.push({
        id: `c-${i}`,
        rows: slice.map((_, k) => i + k + 1),
        error: "",
        payloads: slice.map((q) => {
          const stimulusKey = normalizeStimulusKey(q.stimulus);
          return toDbPayload(isLanguageType(q.type) ? {...q,creative_data:q.creative_data || {marks:bulkMarks}} : q, {
            class_id: Number(classId),
            subject_id: Number(subjectId),
            chapter_id: resolvedChapterId,
            topic_id: q.topicName
              ? (topicIds.get(topicKey(q.topicName)) || null)
              : (topicId && topicId !== "__none__" ? Number(topicId) : null),
            teacher_id: user.id,
            stimulus_group_id: stimulusGroups.get(stimulusKey) || null,
          });
        }),
      });
    }

    const { ok, nextFailed, cancelled: wasCancelled } = await runInsertChunks(chunks);
    setSaving(false);
    setInsertedCount(ok);
    setFailedChunks(nextFailed);
    qc.invalidateQueries({ queryKey: ["admin-questions"] });
    setConfirmOpen(false);

    if (wasCancelled) {
      const pending = nextFailed.reduce((s, c) => s + c.payloads.length, 0);
      toast.warning(`বাতিল করা হয়েছে — ${ok} সফল, ${pending} বাকি (Retry দিয়ে আবার শুরু করুন)`);
    } else if (nextFailed.length === 0) {
      toast.success(`${ok} টি প্রশ্ন সফলভাবে যোগ হয়েছে!`);
      setParsed([]); setPasteText("");
    } else {
      const failedCount = nextFailed.reduce((s, c) => s + c.payloads.length, 0);
      toast.error(`${ok} সফল, ${failedCount} ব্যর্থ — নিচে "Retry" বাটন দিয়ে আবার চেষ্টা করুন`);
    }
  };

  const retryFailed = async () => {
    if (failedChunks.length === 0) return;
    cancelRef.current = false;
    setCancelled(false);
    setSaving(true); setProgress(0);
    const { ok, nextFailed, cancelled: wasCancelled } = await runInsertChunks(failedChunks);
    setSaving(false);
    setInsertedCount((n) => n + ok);
    setFailedChunks(nextFailed);
    qc.invalidateQueries({ queryKey: ["admin-questions"] });
    if (wasCancelled) {
      toast.warning(`Retry বাতিল — ${ok} সফল`);
    } else if (nextFailed.length === 0) {
      toast.success(`বাকি ${ok} টি প্রশ্নও সফলভাবে যোগ হয়েছে!`);
      setParsed([]); setPasteText("");
    } else {
      const failedCount = nextFailed.reduce((s, c) => s + c.payloads.length, 0);
      toast.error(`আবারো ${failedCount} ব্যর্থ — ${ok} সফল`);
    }
  };

  const cancelSave = () => {
    if (!saving) return;
    cancelRef.current = true;
    setCancelled(true);
    toast.info("বর্তমান chunk শেষে থামবে...");
  };

  const skipFailedChunk = (id: string) => {
    setFailedChunks((prev) => prev.filter((c) => c.id !== id));
  };

  if (isEnglishFirst && patternGrade(classes.find(c=>String(c.id)===classId)?.name || '') === 8) {
    return <div className="space-y-5">
      <h1 className="text-2xl font-bold">অষ্টম শ্রেণি · English 1st Paper আপলোড</h1>
      <div className="grid sm:grid-cols-2 gap-3 border rounded p-4 bg-white">
        <Select value={classId} onValueChange={v=>{setClassId(v);setSubjectId('');setChapterId('');}}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{classes.map(c=><SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent></Select>
        <Select value={subjectId} onValueChange={v=>{setSubjectId(v);setChapterId('');}}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{subjects.map(s=><SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent></Select>
      </div>
      <EnglishFirstUpload key={`${classId}:${subjectId}`} classId={classId} subjectId={subjectId} chapters={chapters} />
    </div>;
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label="প্রশ্ন তালিকায় ফিরে যান"
          onClick={() => navigate("/admin/questions")}
        >
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
              <Select value={classId} onValueChange={(v) => { setClassId(v); setSubjectId(""); setChapterId(""); setTopicId(""); }}>
                <SelectTrigger><SelectValue placeholder="বাছাই" /></SelectTrigger>
                <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>বিষয় *</Label>
              <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setChapterId(""); setTopicId(""); }} disabled={!classId}>
                <SelectTrigger><SelectValue placeholder="বাছাই" /></SelectTrigger>
                <SelectContent>{subjects.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>অধ্যায় *</Label>
              <Select value={chapterId} onValueChange={(v) => { setChapterId(v); setTopicId(""); }} disabled={!subjectId}>
                <SelectTrigger><SelectValue placeholder="বাছাই" /></SelectTrigger>
                <SelectContent>{chapters.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}{suggestedChapters.map(name=><SelectItem key={name} value={PATTERN_CHAPTER_PREFIX+name}>{name}</SelectItem>)}</SelectContent>
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
                  {allowedTypes.map((t) => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {subjectId && chapters.length === 0 && suggestedChapters.length === 0 && (
            <p className="text-sm text-amber-700" role="status">
              এই বিষয়ের কোনো অধ্যায় পাওয়া যায়নি। প্রশ্ন আপলোডের আগে অধ্যায় ম্যানেজমেন্ট থেকে অন্তত একটি অধ্যায় যোগ করুন।
            </p>
          )}
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
            <TabsList className="grid grid-cols-3 w-full max-w-xl">
              <TabsTrigger value="excel" className="gap-2"><FileSpreadsheet className="w-4 h-4" /> Excel</TabsTrigger>
              <TabsTrigger value="paste" className="gap-2"><ClipboardPaste className="w-4 h-4" /> Paste</TabsTrigger>
              <TabsTrigger value="ai" className="gap-2"><Bot className="w-4 h-4" /> AI</TabsTrigger>
            </TabsList>

            <TabsContent value="excel" className="pt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" onClick={() => downloadTemplate(type, isMathSubject, isEnglishFirst)} className="gap-2">
                  <Download className="w-4 h-4" /> {TYPE_LABELS[type]} টেমপ্লেট ডাউনলোড
                </Button>
                <input
                  ref={fileInputRef}
                  id="bulk-question-file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  multiple
                  className="sr-only"
                  aria-label="প্রশ্নের Excel বা CSV ফাইল বাছাই করুন"
                  onChange={(e) => { const files = Array.from(e.target.files || []); if (files.length) void handleExcelFiles(files); e.target.value = ""; }}
                />
                <Button
                  type="button"
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4" /> ফাইল আপলোড (সর্বোচ্চ ২০টি)
                </Button>
                <label htmlFor="bulk-question-file" className="sr-only">প্রশ্নের Excel বা CSV ফাইল বাছাই করুন</label>
              </div>
              <p className="text-xs text-muted-foreground">
                টেমপ্লেট ডাউনলোড করে ভরে আপলোড করুন। HTML/LaTeX/Cloudinary ছবি URL cell-এ ব্যবহার করা যাবে।
                ব্যাখ্যা, বোর্ড ও বিশ্ববিদ্যালয় রেফারেন্স (একাধিক: <span className="font-mono">ঢাকা-২০২৩, যশোর-২০২২</span>) কলামও আছে।
                {type === "cq" && isMathSubject ? " গণিত/উচ্চতর গণিতের জন্য ৩ প্রশ্নের (ক/খ/গ) CQ টেমপ্লেট ডাউনলোড হবে।" : ""}
              </p>
            </TabsContent>

            <TabsContent value="paste" className="pt-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label className="flex items-center gap-1">
                  {TYPE_LABELS[type]} পেস্ট করুন
                  <PasteGuide type={type} isMath={isMathSubject} englishFirst={isEnglishFirst} onInsert={(s) => setPasteText(s)} />
                </Label>
                <span className="text-xs text-muted-foreground">
                  {isLanguageType(type)
                    ? "সম্পূর্ণ প্রশ্ন ও উত্তর দিন। একাধিক প্রশ্নসেটের মাঝে আলাদা লাইনে --- দিন।"
                    : type === "cq" && isMathSubject
                    ? "গণিত/উচ্চতর গণিত: ৩টি প্রশ্ন — ক (২), খ (৪), গ (৪)। ঘ) লাগবে না।"
                    : "উদ্দীপক • ল্যাটেক্স • চিত্র • অপশন • উত্তর • ব্যাখ্যা • বোর্ড/বিশ্ববিদ্যালয় রেফারেন্স — সবই সাপোর্টেড"}
                </span>
              </div>
              {isLanguageType(type) && <div className="mb-3"><Label>প্রতি প্রশ্নসেটের মোট নম্বর (প্যাসেজ হলে ০)</Label><input aria-label="প্রতি প্রশ্নসেটের মোট নম্বর" className="border rounded p-2 ml-2" type="number" min="0" step="0.5" value={bulkMarks} onChange={e=>setBulkMarks(Math.max(0,Number(e.target.value)||0))} /></div>}
                <Textarea
                value={pasteText} onChange={(e) => setPasteText(e.target.value)}
                placeholder={pasteVariants?.[0] ? withPasteReferences(pasteVariants[0].sample) : (type === "mcq"
                  ? "১. প্রশ্ন?\nক) অপশন\nখ) অপশন\nগ) অপশন\nঘ) অপশন\nউত্তর: খ\nব্যাখ্যা: ...\nবোর্ড: ঢাকা-২০২৩\nবিশ্ববিদ্যালয়: ঢাবি-২০২১\nছবি: https://..."
                  : type === "cq"
                  ? (isMathSubject
                      ? "উদ্দীপক: ...\nছবি: https://...\nক) ... (২)\nখ) ... (৪)\nগ) ... (৪)\nউত্তর খ: $...$\nবোর্ড: যশোর-২০২২"
                      : "উদ্দীপক: ...\nছবি: https://...\nক) ...\nখ) ...\nগ) ...\nঘ) ...\nউত্তর ক: ...\nবোর্ড: ঢাকা-২০২৩")

                  : type === "descriptive"
                  ? "১. ক) প্রশ্ন...\nখ) প্রশ্ন...\nউত্তর ক: ...\nউত্তর খ: ...\nবোর্ড: ঢাকা-২০২৩"
                  : "১. প্রশ্ন?\nউত্তর: ...\nব্যাখ্যা: ...\nবোর্ড: ঢাকা-২০২৩")}
                rows={12} className="font-mono text-sm"
              />
              <div className="flex items-center gap-2">
                <Button onClick={handlePaste} className="bg-emerald-600 hover:bg-emerald-700">Parse করুন</Button>
                {pasteText && <Button variant="ghost" onClick={() => setPasteText("")}>মুছুন</Button>}
              </div>
            </TabsContent>

            <TabsContent value="ai" className="pt-4">
              {contextValid ? (
                <AIExtract type={type} onExtracted={(qs) => loadItems(qs, "detect হয়েছে")} />
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
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">মোট: {stats.total}</Badge>
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Valid: {stats.valid}</Badge>
                {stats.dup > 0 && <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">ডুপ্লিকেট: {stats.dup}</Badge>}
                {stats.invalid > 0 && <Badge variant="destructive">Invalid: {stats.invalid}</Badge>}
                {stats.dup > 0 && <Button variant="outline" size="sm" onClick={removeDuplicates}>ডুপ্লিকেট remove</Button>}
                {stats.invalid > 0 && <Button variant="outline" size="sm" onClick={removeInvalid}>Invalid remove</Button>}
                <Button variant="ghost" size="sm" onClick={() => setParsed([])}>Clear</Button>
              </div>
            </div>


            <div
              className="border rounded-lg divide-y max-h-[500px] overflow-y-auto overscroll-contain"
              style={parsed.length > 6 ? { height: "min(500px, 60vh)" } : undefined}
            >
              {parsed.map((q, i) => (
                <div key={q.tempId} className={`p-3 flex items-start gap-3 ${q.errors.length ? "bg-red-50/50" : q.duplicate ? "bg-amber-50/60" : ""}`}>
                  <div className="text-xs text-muted-foreground w-8">#{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    {q.topicName && (
                      <Badge variant="outline" className="mb-1 mr-1 text-[10px] border-sky-300 text-sky-800">
                        টপিক: {q.topicName}
                      </Badge>
                    )}
                    {q.duplicate && (
                      <Badge className="mb-1 bg-amber-100 text-amber-900 hover:bg-amber-100 text-[10px]">
                        ডুপ্লিকেট ({q.duplicate === "db" ? "আগে থেকেই ডাটাবেসে আছে" : "লিস্টে দুইবার"}) — স্কিপ হবে
                      </Badge>
                    )}
                    {q.stimulus && (
                      <div className="text-xs text-muted-foreground mb-2 break-words">
                        <div className="font-semibold mb-1">উদ্দীপক:</div>
                        <LatexRenderer
                          text={q.stimulus}
                          className="[&_img]:block [&_img]:mt-1 [&_img]:max-h-40 [&_img]:max-w-full [&_img]:w-auto [&_img]:object-contain"
                        />
                      </div>
                    )}
                    {!(q.type === "cq" || q.type === "descriptive") && (
                      <div className="font-medium text-sm break-words"><LatexRenderer text={q.question || "(no question)"} /></div>
                    )}
                    {isLanguageType(q.type) && q.explanation && (
                      <div className="text-sm mt-3 border-t pt-2"><div className="font-semibold text-emerald-700">উত্তর / ব্যাখ্যা:</div><LatexRenderer text={q.explanation} /></div>
                    )}
                    {!!q.boardRefs?.length && <div className="text-xs mt-2 text-muted-foreground">বোর্ড / স্কুল: {q.boardRefs.map(ref=>[ref.board,ref.year].filter(Boolean).join("—")).join(", ")}</div>}

                    {q.type === "mcq" && (
                      <div className="text-xs text-muted-foreground mt-1 grid grid-cols-2 gap-x-4">
                        <span>ক) <LatexRenderer inline text={q.option_a || ""} /></span><span>খ) <LatexRenderer inline text={q.option_b || ""} /></span>
                        <span>গ) <LatexRenderer inline text={q.option_c || ""} /></span><span>ঘ) <LatexRenderer inline text={q.option_d || ""} /></span>
                        <span className="col-span-2 text-emerald-700">সঠিক: {q.correct_answer}</span>
                      </div>
                    )}
                    {q.type === "cq" && q.creative_data && (
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        <div>ক) <LatexRenderer inline text={q.creative_data.q_ka || ""} /></div><div>খ) <LatexRenderer inline text={q.creative_data.q_kha || ""} /></div>
                        <div>গ) <LatexRenderer inline text={q.creative_data.q_ga || ""} /></div>{q.creative_data.q_gha && <div>ঘ) <LatexRenderer inline text={q.creative_data.q_gha} /></div>}
                      </div>
                    )}
                    {q.type === "descriptive" && q.creative_data && (
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        {q.creative_data.desc_q_ka && <div>ক) <LatexRenderer inline text={q.creative_data.desc_q_ka} /></div>}
                        {q.creative_data.desc_q_kha && <div>খ) <LatexRenderer inline text={q.creative_data.desc_q_kha} /></div>}
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
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`প্রশ্ন ${i + 1} মুছুন`}
                      onClick={() => removeRow(q.tempId)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {saving && (
              <div className="rounded-lg border bg-emerald-50/60 border-emerald-200 p-4 space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm">
                    <span className="font-semibold text-emerald-800">
                      {cancelled ? "বাতিল হচ্ছে..." : "সেভ চলছে..."}
                    </span>
                    <span className="ml-2 text-muted-foreground">
                      Chunk {chunkProg.done}/{chunkProg.total} • প্রশ্ন {chunkProg.rowsDone}/{chunkProg.rowsTotal}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-emerald-800 tabular-nums">{progress}%</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={cancelSave}
                      disabled={cancelled}
                      className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 gap-1"
                    >
                      <XCircle className="w-4 h-4" />
                      {cancelled ? "থামছে..." : "বাতিল"}
                    </Button>
                  </div>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {failedChunks.length > 0 && (
              <div className="border border-red-300 bg-red-50/60 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-4 h-4" />
                    <span className="font-semibold">
                      {failedChunks.reduce((s, c) => s + c.payloads.length, 0)} টি প্রশ্ন সেভ হয়নি ({failedChunks.length} chunk)
                    </span>
                    {insertedCount > 0 && (
                      <span className="text-xs text-emerald-700">• {insertedCount} সফল</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setFailedChunks([])} disabled={saving}>
                      বাদ দিন
                    </Button>
                    <Button size="sm" onClick={retryFailed} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                      {saving ? `Retrying... ${progress}%` : "ব্যর্থগুলো Retry করুন"}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {failedChunks.map((c) => (
                    <div key={c.id} className="flex items-start justify-between gap-3 bg-white border border-red-200 rounded p-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-red-700">
                          Rows #{c.rows[0]}–#{c.rows[c.rows.length - 1]} ({c.payloads.length} টি)
                        </div>
                        <div className="text-muted-foreground break-words line-clamp-2">{c.error}</div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => skipFailedChunk(c.id)} disabled={saving}>
                        Skip
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
              {stats.valid} টি প্রশ্ন ডাটাবেসে যোগ হবে (প্রতি ব্যাচে ৫০টি করে, queue আকারে)।
              {stats.dup > 0 ? ` ${stats.dup} টি ডুপ্লিকেট স্কিপ হবে।` : ""} এটি undo করা যাবে না।
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
