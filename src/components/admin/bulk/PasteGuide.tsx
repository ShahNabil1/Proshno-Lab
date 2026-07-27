import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Info, Copy, ClipboardPaste, Check } from "lucide-react";
import { toast } from "sonner";
import { QType, TYPE_LABELS } from "@/lib/bulkQuestions";

export type Variant = { id: string; label: string; desc: string; sample: string };

const COMMON_TAIL = `ব্যাখ্যা: সঠিক উত্তরের কারণ এখানে লিখুন।
বোর্ড: ঢাকা-২০২৩, যশোর-২০২২
বিশ্ববিদ্যালয়: ঢাবি-২০২১`;

const MCQ: Variant[] = [
  {
    id: "normal", label: "সাধারণ MCQ", desc: "প্রশ্ন + ৪টি অপশন + উত্তর",
    sample: `১. বাংলাদেশের রাজধানী কোথায়?
ক) চট্টগ্রাম
খ) ঢাকা
গ) রাজশাহী
ঘ) সিলেট
উত্তর: খ
${COMMON_TAIL}

২. বাংলাদেশের জাতীয় ফুল কোনটি?
ক) গোলাপ
খ) জবা
গ) শাপলা
ঘ) বেলি
উত্তর: গ`,
  },
  {
    id: "latex", label: "ল্যাটেক্স / গণিত", desc: "$...$ দিয়ে ইনলাইন, $$...$$ দিয়ে ডিসপ্লে ম্যাথ",
    sample: `১. $x^2 - 5x + 6 = 0$ সমীকরণের মূলদ্বয় কত?
ক) $x = 1, 6$
খ) $x = 2, 3$
গ) $x = -2, -3$
ঘ) $x = 0, 5$
উত্তর: খ
ব্যাখ্যা: $x^2-5x+6=(x-2)(x-3)$ তাই $x=2,3$।
বোর্ড: রাজশাহী-২০২২`,
  },
  {
    id: "image", label: "চিত্রযুক্ত", desc: "ছবি: <Cloudinary URL> লাইন দিন (অথবা মার্কডাউন ![](url))",
    sample: `১. চিত্রে প্রদর্শিত অঙ্গটির নাম কী?
ছবি: https://res.cloudinary.com/demo/image/upload/sample.jpg
ক) হৃৎপিণ্ড
খ) ফুসফুস
গ) যকৃত
ঘ) বৃক্ক
উত্তর: ক
ব্যাখ্যা: চিত্রটি হৃৎপিণ্ডের প্রস্থচ্ছেদ।`,
  },
  {
    id: "multi", label: "বহুপদী সমাপ্তিসূচক", desc: "i/ii/iii লাইনগুলো প্রশ্নের অংশ, অপশনে সংমিশ্রণ",
    sample: `১. উদ্ভিদের সালোকসংশ্লেষণে প্রয়োজন—
i. সূর্যালোক
ii. ক্লোরোফিল
iii. অক্সিজেন
নিচের কোনটি সঠিক?
ক) i ও ii
খ) i ও iii
গ) ii ও iii
ঘ) i, ii ও iii
উত্তর: ক
ব্যাখ্যা: সালোকসংশ্লেষণে অক্সিজেন উৎপন্ন হয়, প্রয়োজন হয় না।`,
  },
  {
    id: "stem", label: "উদ্দীপকভিত্তিক MCQ", desc: "উদ্দীপক: লাইন দিয়ে শুরু করুন",
    sample: `১. উদ্দীপক: একটি বস্তু ১০ মি/সে বেগে চলছে এবং এর ভর ৫ কেজি।
প্রশ্ন: বস্তুটির গতিশক্তি কত?
ক) ২৫০ J
খ) ৫০ J
গ) ৫০০ J
ঘ) ১০০ J
উত্তর: ক
ব্যাখ্যা: $E_k = \\frac{1}{2}mv^2 = 250$ J`,
  },
];

const CQ: Variant[] = [
  {
    id: "normal", label: "সাধারণ CQ (ক/খ/গ/ঘ)", desc: "উদ্দীপক + ৪টি প্রশ্ন + (ঐচ্ছিক) উত্তর",
    sample: `উদ্দীপক: রহিম একজন কৃষক। তিনি জমিতে রাসায়নিক সারের পরিবর্তে জৈব সার ব্যবহার করেন।
ক) জৈব সার কাকে বলে?
খ) জৈব সার মাটির উর্বরতা বাড়ায় কেন? ব্যাখ্যা করো।
গ) উদ্দীপকের আলোকে রহিমের পদক্ষেপের গুরুত্ব ব্যাখ্যা করো।
ঘ) "জৈব সার টেকসই কৃষির চাবিকাঠি"—উক্তিটি মূল্যায়ন করো।
উত্তর ক: জৈব সার হলো...
উত্তর খ: কারণ...
বোর্ড: ঢাকা-২০২৩, কুমিল্লা-২০২১

উদ্দীপক: দ্বিতীয় উদ্দীপক এখানে...
ক) ...
খ) ...
গ) ...
ঘ) ...`,
  },
  {
    id: "math", label: "গাণিতিক CQ (ক/খ/গ)", desc: "গণিত/উচ্চতর গণিত সিলেক্ট থাকলে ৩টি প্রশ্ন — ক (২), খ (৪), গ (৪)। ঘ) লাগবে না।",
    sample: `উদ্দীপক: একটি সমকোণী ত্রিভুজের ভূমি $3$ সেমি এবং উচ্চতা $4$ সেমি।
ক) অতিভুজ কাকে বলে?
খ) ত্রিভুজটির অতিভুজ নির্ণয় করো।
গ) ত্রিভুজটির ক্ষেত্রফল ও পরিসীমা নির্ণয় করো।
উত্তর ক: সমকোণের বিপরীত বাহুকে অতিভুজ বলে।
উত্তর খ: $\\sqrt{3^2+4^2}=5$ সেমি
উত্তর গ: ক্ষেত্রফল $=\\frac{1}{2}\\times 3\\times 4=6$ বর্গসেমি
বোর্ড: যশোর-২০২২

উদ্দীপক: $f(x)=x^2-5x+6$
ক) $f(0)$ এর মান কত?
খ) $f(x)=0$ সমীকরণের মূল নির্ণয় করো।
গ) $f(x)$ এর লেখচিত্রের শীর্ষবিন্দু নির্ণয় করো।`,
  },
  {
    id: "math-image", label: "গাণিতিক + চিত্র", desc: "চিত্রসহ গাণিতিক উদ্দীপক (৩ প্রশ্ন)",
    sample: `উদ্দীপক: চিত্রে একটি বৃত্তের কেন্দ্র $O$ এবং ব্যাসার্ধ $r=7$ সেমি।
ছবি: https://res.cloudinary.com/demo/image/upload/sample.jpg
ক) বৃত্তের পরিধির সূত্র লেখো।
খ) বৃত্তটির পরিধি নির্ণয় করো।
গ) $$A=\\pi r^2$$ সূত্র ব্যবহার করে ক্ষেত্রফল নির্ণয় করো।
উত্তর খ: $2\\pi r = 44$ সেমি`,
  },
  {
    id: "image", label: "চিত্রযুক্ত উদ্দীপক", desc: "উদ্দীপকের সাথে ছবি: URL",
    sample: `উদ্দীপক: নিচের চিত্রটি লক্ষ্য করো—
ছবি: https://res.cloudinary.com/demo/image/upload/sample.jpg
ক) কোষ কাকে বলে?
খ) চিত্রের অঙ্গাণুটির কাজ ব্যাখ্যা করো।
গ) চিত্রের আলোকে কোষের গঠন বর্ণনা করো।
ঘ) "কোষই জীবনের একক"—বিশ্লেষণ করো।`,
  },

];

const SHORT: Variant[] = [
  {
    id: "normal", label: "সাধারণ সংক্ষিপ্ত প্রশ্ন", desc: "নম্বরযুক্ত প্রশ্ন + উত্তর",
    sample: `১. সালোকসংশ্লেষণ কী?
উত্তর: সবুজ উদ্ভিদ সূর্যালোকের উপস্থিতিতে যে প্রক্রিয়ায় খাদ্য তৈরি করে তাকে সালোকসংশ্লেষণ বলে।
বোর্ড: ঢাকা-২০২৩

২. গণতন্ত্রের দুটি বৈশিষ্ট্য লেখো।
উত্তর: (১) জনগণের শাসন (২) নিয়মিত নির্বাচন
ব্যাখ্যা: সংক্ষেপে ব্যাখ্যা এখানে।`,
  },
  {
    id: "latex", label: "ল্যাটেক্সসহ", desc: "গাণিতিক সূত্রসহ সংক্ষিপ্ত প্রশ্ন",
    sample: `১. $\\sin^2\\theta + \\cos^2\\theta$ এর মান কত?
উত্তর: $1$
ব্যাখ্যা: এটি মৌলিক ত্রিকোণমিতিক অভেদ।
বিশ্ববিদ্যালয়: ঢাবি-২০২০, রাবি-২০১৯`,
  },
  {
    id: "image", label: "চিত্রযুক্ত", desc: "ছবি: URL লাইন দিন",
    sample: `১. চিত্রের যন্ত্রটির নাম ও ব্যবহার লেখো।
ছবি: https://res.cloudinary.com/demo/image/upload/sample.jpg
উত্তর: এটি একটি ব্যারোমিটার, বায়ুচাপ পরিমাপে ব্যবহৃত হয়।`,
  },
];

const DESC: Variant[] = [
  {
    id: "normal", label: "সাধারণ রচনামূলক", desc: "ক/খ দুই অংশ, প্রতিটির উত্তর আলাদা",
    sample: `১. ক) মুক্তিযুদ্ধের প্রেক্ষাপট ব্যাখ্যা করো।
খ) মুক্তিযুদ্ধের ফলাফল আলোচনা করো।
উত্তর ক: ১৯৭১ সালের...
উত্তর খ: স্বাধীন বাংলাদেশের অভ্যুদয়...
বোর্ড: চট্টগ্রাম-২০২২`,
  },
  {
    id: "single", label: "একক প্রশ্ন", desc: "শুধু একটি প্রশ্ন ও উত্তর",
    sample: `১. পরিবেশ দূষণের কারণ ও প্রতিকার বর্ণনা করো।
উত্তর: পরিবেশ দূষণের প্রধান কারণ...
ব্যাখ্যা: বিস্তারিত ব্যাখ্যা এখানে।`,
  },
  {
    id: "latex", label: "ল্যাটেক্স/চিত্রসহ", desc: "ছবি ও ম্যাথ একসাথে",
    sample: `১. ক) $ax^2+bx+c=0$ সমীকরণের সমাধান সূত্র প্রতিপাদন করো।
খ) চিত্রের সাহায্যে পরাবৃত্ত ব্যাখ্যা করো।
ছবি: https://res.cloudinary.com/demo/image/upload/sample.jpg
উত্তর ক: $x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}$`,
  },
];

export const PASTE_VARIANTS: Record<QType, Variant[]> = { mcq: MCQ, cq: CQ, short: SHORT, descriptive: DESC };

const RULES = [
  "প্রতিটি প্রশ্ন আলাদা করতে নম্বর (১. / 1.) ব্যবহার করুন, অথবা দুই প্রশ্নের মাঝে --- লাইন দিন।",
  "অপশন/উপ-প্রশ্ন: ক) খ) গ) ঘ) অথবা a) b) c) d) — ব্র্যাকেট, ডট বা কোলন সবই চলবে।",
  "উত্তর: খ  |  CQ-এর উত্তর: উত্তর ক: ... , উত্তর খ: ...",
  "ব্যাখ্যা: ... — ঐচ্ছিক, একাধিক লাইনও দেওয়া যাবে।",
  "বোর্ড: ঢাকা-২০২৩, যশোর-২০২২ — কমা দিয়ে একাধিক (নাম ও সালের মাঝে - : বা স্পেস)।",
  "বিশ্ববিদ্যালয়: ঢাবি-২০২১, রাবি-২০১৯ — একইভাবে একাধিক দেওয়া যাবে।",
  "ছবি: https://... (Cloudinary) — মার্কডাউন ![](url) বা শুধু ছবির URL লাইনও কাজ করবে।",
  "গণিত: $x^2+y^2$ (ইনলাইন) বা $$\\frac{a}{b}$$ (ডিসপ্লে) — LaTeX হুবহু সংরক্ষিত হবে।",
  "একই প্রশ্ন আগে থেকেই থাকলে বা লিস্টে দুইবার থাকলে সেটি ডুপ্লিকেট হিসেবে মার্ক হয়ে স্কিপ হবে।",
];

export default function PasteGuide({ type, isMath = false, onInsert }: { type: QType; isMath?: boolean; onInsert?: (sample: string) => void }) {
  const variants = useMemo(() => {
    const list = PASTE_VARIANTS[type];
    if (type !== "cq") return list;
    // গণিত/উচ্চতর গণিতে শুধু ৩ প্রশ্নের (ক/খ/গ) ভ্যারিয়েন্টগুলোই দেখানো হয়
    return isMath ? list.filter((v) => v.id.startsWith("math")) : list.filter((v) => !v.id.startsWith("math"));
  }, [type, isMath]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(variants[0].id);
  const current = useMemo(() => variants.find((v) => v.id === active) || variants[0], [variants, active]);
  const [copied, setCopied] = useState(false);


  const copy = async () => {
    await navigator.clipboard.writeText(current.sample);
    setCopied(true);
    toast.success("নমুনা কপি হয়েছে");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setActive(variants[0].id); }}>
      <DialogTrigger asChild>
        <Button
          type="button" variant="ghost" size="icon"
          className="h-7 w-7 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
          title="কীভাবে পেস্ট করবেন?"
          aria-label="পেস্ট করার নিয়ম"
        >
          <Info className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-emerald-600" />
            {TYPE_LABELS[type]} — কীভাবে পেস্ট করবেন?
          </DialogTitle>
          <DialogDescription>
            নিচের যেকোনো ধরন বেছে নিন — হুবহু ঐ ফরম্যাটে পেস্ট করলে ১০০% সঠিকভাবে parse হবে।
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {variants.map((v) => (
            <Button
              key={v.id} type="button" size="sm"
              variant={v.id === active ? "default" : "outline"}
              className={v.id === active ? "bg-emerald-600 hover:bg-emerald-700" : ""}
              onClick={() => setActive(v.id)}
            >
              {v.label}
            </Button>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">{current.desc}</p>

        <pre className="bg-muted/60 border rounded-lg p-3 text-xs whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
          {current.sample}
        </pre>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={copy} className="gap-1">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} কপি করুন
          </Button>
          {onInsert && (
            <Button
              type="button" size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => { onInsert(current.sample); setOpen(false); toast.success("নমুনা বক্সে বসানো হয়েছে"); }}
            >
              <ClipboardPaste className="w-4 h-4" /> বক্সে নমুনা বসান
            </Button>
          )}
        </div>

        <div className="space-y-1.5 pt-2 border-t">
          <div className="font-semibold text-sm flex items-center gap-2">
            সাধারণ নিয়ম <Badge variant="outline" className="text-[10px]">সব ধরনের জন্য</Badge>
          </div>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5">
            {RULES.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
