import QuestionPageLayout from "@/components/QuestionPageLayout";
import { Badge } from "@/components/ui/badge";
import LatexRenderer from "@/components/LatexRenderer";

const mockShort = [
  { id: 1, question: "সালোকসংশ্লেষণ কী? এর সমীকরণ লিখ।", class: "৮ম", subject: "জীববিজ্ঞান", marks: 2 },
  { id: 2, question: "গণতন্ত্রের দুটি বৈশিষ্ট্য লিখ।", class: "৯ম", subject: "পৌরনীতি", marks: 2 },
  { id: 3, question: "নিউটনের তৃতীয় সূত্রটি বিবৃত কর।", class: "১০ম", subject: "পদার্থবিজ্ঞান", marks: 2 },
  { id: 4, question: "বাংলাদেশের জাতীয় ফুলের নাম ও বৈশিষ্ট্য লিখ।", class: "৬ষ্ঠ", subject: "সামাজিক বিজ্ঞান", marks: 2 },
  { id: 5, question: "ত্রিভুজের ক্ষেত্রফলের সূত্র লিখ ও ব্যাখ্যা কর।", class: "৭ম", subject: "গণিত", marks: 2 },
];

export default function ShortPage() {
  return (
    <QuestionPageLayout title="সংক্ষিপ্ত প্রশ্ন" subtitle="প্রতিটি ২ নম্বর — ৫টি প্রশ্নের সেট, মোট ১০" bannerClass="gradient-purple">
      <div className="space-y-3">
        {mockShort.map((q, idx) => (
          <div key={q.id} className="bg-card rounded-xl shadow-sm p-5 border border-border flex items-start justify-between gap-4">
            <p className="text-foreground font-body">
              <span className="text-primary font-bold mr-2">{idx + 1}.</span>
              <LatexRenderer text={q.question} />
            </p>
            <div className="flex gap-2 shrink-0">
              <Badge variant="secondary">{q.class} • {q.subject}</Badge>
              <Badge variant="outline">{q.marks} নম্বর</Badge>
            </div>
          </div>
        ))}
      </div>
    </QuestionPageLayout>
  );
}
