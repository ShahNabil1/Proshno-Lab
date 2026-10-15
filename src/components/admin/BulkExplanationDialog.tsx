import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseBulkExplanations } from "@/lib/bulkExplanations";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import LatexRenderer from "@/components/LatexRenderer";
import { toast } from "sonner";
import { BANGLA_LABELS } from "@/lib/answerKey";
import { CQ_PARTS, parseCqAnswers } from "@/lib/bulkCqAnswers";
import type { Json } from "@/integrations/supabase/types";

interface Question { id: number; question: string; type: string; explanation: string | null; correct_answer?: string | null; creative_data?: Json | null; option_a?: string | null; option_b?: string | null; option_c?: string | null; option_d?: string | null; class_id: number; subject_id: number; }
const creativeFields = (q: Question | undefined): Record<string, Json | undefined> => q?.creative_data && typeof q.creative_data === "object" && !Array.isArray(q.creative_data) ? q.creative_data : {};
interface Props { isSubjectAllowed: (classId: number, subjectId: number) => boolean; onSaved: () => void; answerMode?: boolean; }
const answerKeys: Record<string, string> = { a: "a", b: "b", c: "c", d: "d", ক: "a", খ: "b", গ: "c", ঘ: "d" };

export default function BulkExplanationDialog({ isSubjectAllowed, onSaved, answerMode = false }: Props) {
  const label = answerMode ? "উত্তর" : "ব্যাখ্যা";
  const field = answerMode ? "correct_answer" : "explanation";
  const supportedTypes: Record<string, string> = answerMode ? { mcq: "MCQ", short: "SQ", cq: "CQ" } : { mcq: "MCQ" };
  const buttonLabel = answerMode ? "বাল্ক MCQ / SQ / CQ উত্তর" : "বাল্ক MCQ ব্যাখ্যা";
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<number, string>>({});
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [removed, setRemoved] = useState<number[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const resetEdits = () => { setEdits({}); setRemoved([]); setEditingId(null); };
  const parsed = useMemo(() => parseBulkExplanations(text, label), [text, label]);
  const rows = parsed.entries.filter(entry => !removed.includes(entry.id)).map(entry => {
    const explanation = edits[entry.id] ?? entry.explanation;
    const q = questions?.find(q => q.id === entry.id);
    const answerKey = answerMode && q?.type === "mcq" ? answerKeys[explanation.trim().toLowerCase()] : null;
    const cq = answerMode && q?.type === "cq" ? parseCqAnswers(explanation) : null;
    const oldText = cq ? CQ_PARTS.map(p => creativeFields(q)[p.key]).filter(v => typeof v === "string").join("").trim() : q?.[field]?.trim();
    const reason = !explanation.trim() ? `${label} খালি — সেভ হবে না` : !q ? "প্রশ্ন পাওয়া যায়নি" : !supportedTypes[q.type] ? (answerMode ? "MCQ, SQ বা CQ নয়" : "শুধু MCQ-এর ব্যাখ্যা দেওয়া যাবে") : !isSubjectAllowed(q.class_id, q.subject_id) ? "সম্পাদনার অনুমতি নেই" : cq?.errors.length ? cq.errors.join("; ") : answerMode && q.type === "mcq" && !answerKey ? "MCQ উত্তর শুধু ক/খ/গ/ঘ বা a/b/c/d হতে হবে" : oldText && !overwrite ? `আগের ${label} আছে — বাদ যাবে` : "সেভ হবে";
    return { ...entry, explanation, q, reason, cq, value: answerKey || explanation };
  });
  const ready = rows.filter(r => r.reason === "সেভ হবে" && !outcomes[r.id]);
  const preview = async () => {
    setBusy(true); setQuestions(null); setOutcomes({});
    try {
      const found: Question[] = [];
      for (let i = 0; i < parsed.entries.length; i += 100) {
        const { data, error } = await supabase.from("questions").select("id, question, type, explanation, correct_answer, creative_data, option_a, option_b, option_c, option_d, class_id, subject_id").in("id", parsed.entries.slice(i, i + 100).map(e => e.id));
        if (error) throw error;
        found.push(...(data || []));
      }
      setQuestions(found);
    } catch { toast.error("প্রশ্ন যাচাই করা যায়নি। আবার চেষ্টা করুন।"); }
    finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true);
    let saved = 0;
    const next = { ...outcomes };
    try {
      for (const row of ready) {
        // Match the previewed value so another editor's changes are never silently replaced.
        const update = row.cq ? { creative_data: { ...creativeFields(row.q), ...row.cq.answers } } : answerMode ? { correct_answer: row.value } : { explanation: row.value };
        let query = supabase.from("questions").update(update).eq("id", row.id).eq("type", row.q!.type);
        const targetField = row.cq ? "creative_data" : field;
        const oldValue = row.cq ? row.q!.creative_data ?? null : row.q![field] ?? null;
        query = oldValue === null ? query.is(targetField, null) : query.eq(targetField, row.cq ? JSON.stringify(oldValue) : oldValue);
        const { data, error } = await query.select("id");
        if (error || !data?.length) { next[row.id] = "সেভ হয়নি — অনুমতি বা নতুন পরিবর্তন যাচাই করুন"; }
        else { next[row.id] = "সেভ হয়েছে"; saved++; }
        setOutcomes({ ...next });
      }
      if (saved) toast.success(`${saved}টি প্রশ্নের ${label} সেভ হয়েছে`);
      if (Object.values(next).some(v => v.startsWith("সেভ হয়নি"))) toast.error(`কিছু ${label} সেভ হয়নি। নিচের ফলাফল দেখুন, তারপর আবার যাচাই করুন।`);
      else if (saved > 0 && saved === ready.length) {
        setOpen(false);
        setText("");
        setQuestions(null);
        setOutcomes({});
        setOverwrite(false);
        resetEdits();
      }
    } catch { toast.error("সংযোগের সমস্যা হয়েছে। ফলাফল দেখে আবার যাচাই করুন।"); }
    finally { setBusy(false); onSaved(); }
  };
  return <>
    <Button variant="outline" onClick={() => setOpen(true)}>{buttonLabel}</Button>
    <Dialog open={open} onOpenChange={v => { if (!busy) setOpen(v); }}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto" onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onPointerDownOutside={e => { if (busy) e.preventDefault(); }}>
        <DialogHeader><DialogTitle>সিরিয়াল দিয়ে {buttonLabel}</DialogTitle>
          <DialogDescription>প্রশ্নের পাশে থাকা # নম্বর ব্যবহার করুন। প্রতিটি নতুন এন্ট্রি নতুন লাইনে সিরিয়াল দিয়ে শুরু করুন। সব পেজের প্রশ্ন সিরিয়াল অনুযায়ী খোঁজা হবে।</DialogDescription>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">{answerMode ? "MCQ: ক/খ/গ/ঘ বা a/b/c/d। SQ: সম্পূর্ণ উত্তর। CQ: নতুন লাইনে [ক], [খ], [গ], [ঘ] দিয়ে চারটি উত্তর লিখুন। HTML ও LaTeX ব্যবহার করা যাবে। সিরিয়াল থেকে প্রশ্নের ধরন শনাক্ত হবে।" : "শুধু MCQ প্রশ্নের ব্যাখ্যা এখানে দিন। SQ ও CQ-এর জন্য বাল্ক উত্তর বাটন ব্যবহার করুন।"}</p>
        <pre className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{answerMode ? "405848 - উত্তর: খ\n405849 - উত্তর: <p>SQ-এর সম্পূর্ণ উত্তর।</p>\n405850 - উত্তর:\n[ক] <p>ক-এর উত্তর।</p>\n[খ] <p>খ-এর উত্তর।</p>\n[গ] <p>গ-এর উত্তর।</p>\n[ঘ] <p>ঘ-এর উত্তর।</p>" : "405848 - ব্যাখ্যা: প্রথম প্রশ্নের ব্যাখ্যা\n405849 - ব্যাখ্যা: দ্বিতীয় প্রশ্নের ব্যাখ্যা"}</pre>
        <Textarea aria-label={`বাল্ক ${label} পেস্ট করুন`} placeholder={`সিরিয়াল ও ${label} এখানে পেস্ট করুন...`} rows={9} value={text} disabled={busy} onChange={e => { setText(e.target.value); setQuestions(null); setOutcomes({}); resetEdits(); }} />
        {questions && <p className="text-xs text-muted-foreground">প্রিভিউ থেকে {label} সম্পাদনা বা বাদ দিতে পারবেন। বাদ দিলে পুরোনো {label} মুছবে না। পেস্ট বক্সে নতুন করে লিখলে প্রিভিউর সম্পাদনা ও বাদ দেওয়ার তালিকা রিসেট হবে।</p>}
        <label className="flex gap-2 items-center text-sm"><Checkbox checked={overwrite} disabled={busy} onCheckedChange={v => { setOverwrite(v === true); setQuestions(null); setOutcomes({}); }} />আগের {label} থাকলে সেটিও বদলে দিন</label>
        {parsed.errors.length > 0 && <div role="alert" className="text-sm text-destructive">{parsed.errors.map((e, i) => <p key={i}>{e}</p>)}</div>}
        <div className="flex flex-wrap gap-2 items-center">
          <Button variant="outline" disabled={busy || !parsed.entries.length || !!parsed.errors.length} onClick={preview}>{busy ? "কাজ চলছে..." : "যাচাই ও প্রিভিউ"}</Button>
          {questions && <Button disabled={busy || !ready.length} onClick={save}>{ready.length}টি {label} সেভ করুন</Button>}
        </div>
        {questions && <div className="space-y-3">{rows.map(row => <div key={row.id} className="border rounded-md p-3 space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="font-medium">#{row.id} · {outcomes[row.id] || row.reason}{row.q && supportedTypes[row.q.type] ? ` · ${supportedTypes[row.q.type]}` : ""}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={busy || !!outcomes[row.id]} aria-label={`${label} সম্পাদনা #${row.id}`} onClick={() => setEditingId(editingId === row.id ? null : row.id)}>{editingId === row.id ? "সম্পাদনা শেষ" : "সম্পাদনা"}</Button>
              <Button size="sm" variant="ghost" disabled={busy} aria-label={`তালিকা থেকে বাদ দিন #${row.id}`} onClick={() => { setRemoved(prev => [...prev, row.id]); if (editingId === row.id) setEditingId(null); }}>বাদ দিন</Button>
            </div>
          </div>
          {row.q && <LatexRenderer text={row.q.question} />}
          {answerMode && row.q?.type === "mcq" && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{[row.q.option_a, row.q.option_b, row.q.option_c, row.q.option_d].map((option, i) => <div key={i}><strong>{BANGLA_LABELS[i]}. </strong><LatexRenderer text={option || "—"} /></div>)}</div>}
          {row.q?.[field] && <details><summary>আগের {label}</summary><LatexRenderer text={row.q[field]!} /></details>}
          {row.cq && row.q && <details><summary>CQ প্রশ্ন ও আগের উত্তর</summary>{CQ_PARTS.map(p => <div key={p.key} className="my-2"><strong>{p.label})</strong><LatexRenderer text={String(creativeFields(row.q)[p.key.replace("ans_", "q_")] ?? "")} /><LatexRenderer text={String(creativeFields(row.q)[p.key] ?? "উত্তর নেই")} /></div>)}</details>}
          <p className="text-muted-foreground">নতুন {label}</p>
          {editingId === row.id && <Textarea aria-label={`${label} #${row.id}`} rows={6} value={row.explanation} disabled={busy} onChange={e => setEdits(prev => ({ ...prev, [row.id]: e.target.value }))} />}
          {row.cq ? CQ_PARTS.map(p => <div key={p.key}><strong>{p.label})</strong><LatexRenderer text={row.cq!.answers[p.key] || ""} className="whitespace-pre-wrap break-words overflow-x-auto" /></div>) : <LatexRenderer text={row.explanation} className="whitespace-pre-wrap break-words overflow-x-auto" />}
        </div>)}</div>}
      </DialogContent>
    </Dialog>
  </>;
}
