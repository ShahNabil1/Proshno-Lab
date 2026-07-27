import { normalizeAnswerKey } from "@/lib/answerKey";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { QType, ParsedQuestion } from "@/lib/bulkQuestions";

const uid = () => Math.random().toString(36).slice(2, 10);

export default function ManualMultiAdd({ type, onAdd }: { type: QType; onAdd: (q: ParsedQuestion) => void }) {
  const [stim, setStim] = useState("");
  const [question, setQuestion] = useState("");
  const [a, setA] = useState(""); const [b, setB] = useState(""); const [c, setC] = useState(""); const [d, setD] = useState("");
  const [correct, setCorrect] = useState("a");
  const [expl, setExpl] = useState("");
  // CQ
  const [qk, setQk] = useState(""); const [qkh, setQkh] = useState(""); const [qg, setQg] = useState(""); const [qgh, setQgh] = useState("");
  const [ak, setAk] = useState(""); const [akh, setAkh] = useState(""); const [ag, setAg] = useState(""); const [agh, setAgh] = useState("");

  const reset = () => {
    setStim(""); setQuestion(""); setA(""); setB(""); setC(""); setD(""); setCorrect("a"); setExpl("");
    setQk(""); setQkh(""); setQg(""); setQgh(""); setAk(""); setAkh(""); setAg(""); setAgh("");
  };

  const submit = () => {
    const errors: string[] = [];
    const q: ParsedQuestion = { tempId: uid(), type, question: "", errors, stimulus: stim || undefined };
    if (type === "mcq") {
      q.question = question; q.option_a = a; q.option_b = b; q.option_c = c; q.option_d = d;
      q.correct_answer = normalizeAnswerKey(correct, [q.option_a, q.option_b, q.option_c, q.option_d]) || ""; q.explanation = expl || undefined;
      if (!question) errors.push("প্রশ্ন খালি");
      if (!a || !b || !c || !d) errors.push("সব অপশন আবশ্যক");
    } else if (type === "cq") {
      q.stimulus = stim || undefined;
      q.question = (stim || qk).slice(0, 100);
      q.creative_data = { is_math: false, stem: stim, q_ka: qk, q_kha: qkh, q_ga: qg, q_gha: qgh || undefined, ans_ka: ak, ans_kha: akh, ans_ga: ag, ans_gha: agh || undefined };
      if (!stim) errors.push("উদ্দীপক আবশ্যক");
      if (!qk || !qkh || !qg) errors.push("ক/খ/গ প্রশ্ন আবশ্যক");
    } else if (type === "short") {
      q.question = question; q.explanation = expl || undefined;
      if (!question) errors.push("প্রশ্ন খালি");
    } else if (type === "descriptive") {
      q.question = qk.slice(0, 100);
      q.creative_data = { desc_q_ka: qk, desc_q_kha: qkh, desc_ans_ka: ak, desc_ans_kha: akh };
      if (!qk && !qkh) errors.push("অন্তত একটি প্রশ্ন আবশ্যক");
    }
    onAdd(q);
    reset();
  };

  return (
    <div className="space-y-3">
      {type !== "descriptive" && (
        <div>
          <Label>উদ্দীপক (optional{type === "cq" ? ", CQ-তে আবশ্যক" : ""})</Label>
          <Textarea value={stim} onChange={(e) => setStim(e.target.value)} rows={2} placeholder="HTML/text/Cloudinary <img> ট্যাগ" />
        </div>
      )}

      {type === "mcq" && (
        <>
          <div><Label>প্রশ্ন *</Label><Textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="অপশন ক" value={a} onChange={(e) => setA(e.target.value)} />
            <Input placeholder="অপশন খ" value={b} onChange={(e) => setB(e.target.value)} />
            <Input placeholder="অপশন গ" value={c} onChange={(e) => setC(e.target.value)} />
            <Input placeholder="অপশন ঘ" value={d} onChange={(e) => setD(e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <Label>সঠিক:</Label>
            {["a", "b", "c", "d"].map((k) => (
              <label key={k} className="flex items-center gap-1 text-sm">
                <input type="radio" checked={correct === k} onChange={() => setCorrect(k)} /> {k.toUpperCase()}
              </label>
            ))}
          </div>
          <div><Label>ব্যাখ্যা</Label><Textarea value={expl} onChange={(e) => setExpl(e.target.value)} rows={2} /></div>
        </>
      )}

      {type === "cq" && (
        <div className="grid grid-cols-2 gap-2">
          <div><Label>প্রশ্ন ক *</Label><Input value={qk} onChange={(e) => setQk(e.target.value)} /></div>
          <div><Label>উত্তর ক</Label><Input value={ak} onChange={(e) => setAk(e.target.value)} /></div>
          <div><Label>প্রশ্ন খ *</Label><Input value={qkh} onChange={(e) => setQkh(e.target.value)} /></div>
          <div><Label>উত্তর খ</Label><Input value={akh} onChange={(e) => setAkh(e.target.value)} /></div>
          <div><Label>প্রশ্ন গ *</Label><Input value={qg} onChange={(e) => setQg(e.target.value)} /></div>
          <div><Label>উত্তর গ</Label><Input value={ag} onChange={(e) => setAg(e.target.value)} /></div>
          <div><Label>প্রশ্ন ঘ</Label><Input value={qgh} onChange={(e) => setQgh(e.target.value)} /></div>
          <div><Label>উত্তর ঘ</Label><Input value={agh} onChange={(e) => setAgh(e.target.value)} /></div>
        </div>
      )}

      {type === "short" && (
        <>
          <div><Label>প্রশ্ন *</Label><Textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} /></div>
          <div><Label>উত্তর</Label><Textarea value={expl} onChange={(e) => setExpl(e.target.value)} rows={3} /></div>
        </>
      )}

      {type === "descriptive" && (
        <div className="grid grid-cols-2 gap-2">
          <div><Label>প্রশ্ন ক *</Label><Textarea value={qk} onChange={(e) => setQk(e.target.value)} rows={2} /></div>
          <div><Label>উত্তর ক</Label><Textarea value={ak} onChange={(e) => setAk(e.target.value)} rows={2} /></div>
          <div><Label>প্রশ্ন খ</Label><Textarea value={qkh} onChange={(e) => setQkh(e.target.value)} rows={2} /></div>
          <div><Label>উত্তর খ</Label><Textarea value={akh} onChange={(e) => setAkh(e.target.value)} rows={2} /></div>
        </div>
      )}

      <Button onClick={submit} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
        <Plus className="w-4 h-4" /> তালিকায় যোগ করুন
      </Button>
    </div>
  );
}
