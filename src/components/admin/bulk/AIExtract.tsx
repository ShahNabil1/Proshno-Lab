import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Upload } from "lucide-react";
import { QType, ParsedQuestion } from "@/lib/bulkQuestions";

const uid = () => Math.random().toString(36).slice(2, 10);

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(",")[1] || "");
    r.onerror = rej;
    r.readAsDataURL(file);
  });

export default function AIExtract({ type, onExtracted }: { type: QType; onExtracted: (qs: ParsedQuestion[]) => void }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!text.trim() && !file) { toast.error("text বা file দিন"); return; }
    setLoading(true);
    try {
      const payload: any = { type };
      if (text.trim()) payload.text = text.trim();
      if (file) {
        const b64 = await fileToBase64(file);
        if (file.type === "application/pdf") payload.pdfBase64 = b64;
        else if (file.type.startsWith("image/")) { payload.imageBase64 = b64; payload.imageMime = file.type; }
        else { toast.error("শুধু PDF/ছবি supported"); setLoading(false); return; }
      }
      const { data, error } = await supabase.functions.invoke("extract-bulk-questions", { body: payload });
      if (error) throw error;
      const items = (data?.questions || []) as any[];
      if (items.length === 0) { toast.error("কোনো প্রশ্ন extract হয়নি"); return; }
      const mapped: ParsedQuestion[] = items.map((it) => aiToParsed(it, type));
      onExtracted(mapped);
      toast.success(`${mapped.length} টি প্রশ্ন extract হয়েছে`);
      setText(""); setFile(null);
    } catch (e: any) {
      toast.error(e.message || "AI extract ব্যর্থ");
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Text (paste raw content)</Label>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="যেকোনো ফরম্যাটের raw প্রশ্ন paste করুন — AI structure করবে" />
      </div>
      <div>
        <Label>অথবা PDF/ছবি আপলোড</Label>
        <label className="mt-1 flex items-center gap-2 border border-dashed rounded-lg p-3 cursor-pointer hover:bg-muted/50">
          <Upload className="w-4 h-4" />
          <span className="text-sm">{file ? file.name : "PDF বা ছবি বাছাই করুন"}</span>
          <input type="file" accept=".pdf,image/*" className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
      </div>
      <Button onClick={submit} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {loading ? "Extract হচ্ছে..." : "AI দিয়ে Extract"}
      </Button>
      <p className="text-xs text-muted-foreground">Powered by Lovable AI (Gemini) — বড় ইনপুটে ৩০-৬০ সেকেন্ড লাগতে পারে</p>
    </div>
  );
}

function aiToParsed(it: any, type: QType): ParsedQuestion {
  const errors: string[] = [];
  const q: ParsedQuestion = { tempId: uid(), type, question: "", errors };
  if (type === "mcq") {
    q.stimulus = it.stimulus || undefined;
    q.question = it.question || "";
    q.option_a = it.option_a; q.option_b = it.option_b; q.option_c = it.option_c; q.option_d = it.option_d;
    q.correct_answer = (it.correct_answer || "").toLowerCase();
    q.explanation = it.explanation;
    if (!q.question) errors.push("প্রশ্ন খালি");
    if (!q.option_a || !q.option_b || !q.option_c || !q.option_d) errors.push("অপশন missing");
    if (!["a", "b", "c", "d"].includes(q.correct_answer!)) errors.push("সঠিক উত্তর invalid");
  } else if (type === "cq") {
    q.stimulus = it.stimulus || undefined;
    q.question = (it.stimulus || it.q_ka || "").slice(0, 100);
    q.creative_data = {
      is_math: false, stem: it.stimulus,
      q_ka: it.q_ka, q_kha: it.q_kha, q_ga: it.q_ga, q_gha: it.q_gha,
      ans_ka: it.ans_ka, ans_kha: it.ans_kha, ans_ga: it.ans_ga, ans_gha: it.ans_gha,
    };
    if (!it.stimulus) errors.push("উদ্দীপক missing");
    if (!it.q_ka || !it.q_kha || !it.q_ga) errors.push("ক/খ/গ missing");
  } else if (type === "short") {
    q.question = it.question || "";
    q.explanation = it.explanation;
    if (!q.question) errors.push("প্রশ্ন খালি");
  } else {
    q.question = (it.q_ka || "").slice(0, 100);
    q.creative_data = { desc_q_ka: it.q_ka, desc_q_kha: it.q_kha, desc_ans_ka: it.ans_ka, desc_ans_kha: it.ans_kha };
    if (!it.q_ka && !it.q_kha) errors.push("প্রশ্ন missing");
  }
  return q;
}
