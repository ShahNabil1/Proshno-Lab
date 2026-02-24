import QuestionPageLayout from "@/components/QuestionPageLayout";
import { Badge } from "@/components/ui/badge";
import LatexRenderer from "@/components/LatexRenderer";

const mockCQs = [
  {
    id: 1,
    stimulus: "একটি দোকানদার ১০০ টাকায় একটি পণ্য কিনে ১২০ টাকায় বিক্রি করলো...",
    parts: [
      { label: "ক", question: "লাভের পরিমাণ কত?", marks: 2 },
      { label: "খ", question: "লাভের শতকরা হার নির্ণয় কর।", marks: 4 },
      { label: "গ", question: "যদি ১৫% ক্ষতি হতো তবে বিক্রয়মূল্য কত হতো?", marks: 4 },
    ],
    class: "৯ম",
    subject: "গণিত",
    totalMarks: 10,
  },
  {
    id: 2,
    stimulus: "রবীন্দ্রনাথ ঠাকুর তাঁর 'গীতাঞ্জলি' কাব্যগ্রন্থের জন্য নোবেল পুরস্কার লাভ করেন...",
    parts: [
      { label: "ক", question: "গীতাঞ্জলি কত সালে প্রকাশিত হয়?", marks: 1 },
      { label: "খ", question: "গীতাঞ্জলির মূল ভাবধারা ব্যাখ্যা কর।", marks: 2 },
      { label: "গ", question: "বাংলা সাহিত্যে গীতাঞ্জলির প্রভাব বিশ্লেষণ কর।", marks: 3 },
      { label: "ঘ", question: "রবীন্দ্রনাথের সাহিত্যিক অবদান মূল্যায়ন কর।", marks: 4 },
    ],
    class: "১০ম",
    subject: "বাংলা",
    totalMarks: 10,
  },
];

export default function CQPage() {
  return (
    <QuestionPageLayout title="সৃজনশীল প্রশ্ন (CQ)" subtitle="মোট ১০ নম্বর — ক, খ, গ, ঘ অংশে বিভক্ত" bannerClass="gradient-yellow">
      <div className="space-y-6">
        {mockCQs.map((q, idx) => (
          <div key={q.id} className="bg-card rounded-xl shadow-sm p-6 border border-border">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <Badge variant="secondary" className="mb-2">{q.class} • {q.subject}</Badge>
                <p className="text-foreground font-body font-medium">
                  <span className="text-primary font-bold mr-2">{idx + 1}.</span>
                  <LatexRenderer text={q.stimulus} />
                </p>
              </div>
              <Badge className="shrink-0">মোট {q.totalMarks}</Badge>
            </div>
            <div className="space-y-2 ml-4">
              {q.parts.map((p) => (
                <div key={p.label} className="flex items-start gap-3 bg-muted/50 rounded-lg px-4 py-3">
                  <span className="font-heading font-bold text-primary shrink-0">{p.label}.</span>
                  <span className="text-foreground font-body flex-1"><LatexRenderer text={p.question} /></span>
                  <Badge variant="outline" className="shrink-0">{p.marks}</Badge>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </QuestionPageLayout>
  );
}
