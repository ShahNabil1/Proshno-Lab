import QuestionPageLayout from "@/components/QuestionPageLayout";
import { Badge } from "@/components/ui/badge";
import LatexRenderer from "@/components/LatexRenderer";
import ReferenceBadges from "@/components/ReferenceBadges";
import ExplanationToggle from "@/components/ExplanationToggle";

const mockShort = [
  { id: 1, question: "সালোকসংশ্লেষণ কী? এর সমীকরণ লিখ।", class: "৮ম", subject: "জীববিজ্ঞান", marks: 2, board_references: [{ board: "কু. বো.", year: "২০২৩" }], university_references: [], explanation: "সালোকসংশ্লেষণ হলো সূর্যালোকের সাহায্যে উদ্ভিদের খাদ্য তৈরির প্রক্রিয়া।" },
  { id: 2, question: "গণতন্ত্রের দুটি বৈশিষ্ট্য লিখ।", class: "৯ম", subject: "পৌরনীতি", marks: 2, board_references: [], university_references: [], explanation: "" },
  { id: 3, question: "নিউটনের তৃতীয় সূত্রটি বিবৃত কর।", class: "১০ম", subject: "পদার্থবিজ্ঞান", marks: 2, board_references: [{ board: "য. বো.", year: "২০২২" }], university_references: [], explanation: "প্রত্যেক ক্রিয়ার একটি সমান ও বিপরীত প্রতিক্রিয়া আছে।" },
  { id: 4, question: "বাংলাদেশের জাতীয় ফুলের নাম ও বৈশিষ্ট্য লিখ।", class: "৬ষ্ঠ", subject: "সামাজিক বিজ্ঞান", marks: 2, board_references: [], university_references: [], explanation: "" },
  { id: 5, question: "ত্রিভুজের ক্ষেত্রফলের সূত্র লিখ ও ব্যাখ্যা কর।", class: "৭ম", subject: "গণিত", marks: 2, board_references: [], university_references: [], explanation: "" },
];

export default function ShortPage() {
  return (
    <QuestionPageLayout title="সংক্ষিপ্ত প্রশ্ন" subtitle="প্রতিটি ২ নম্বর — ৫টি প্রশ্নের সেট, মোট ১০" bannerClass="gradient-purple">
      <div className="space-y-3">
        {mockShort.map((q, idx) => (
          <div key={q.id} className="bg-card rounded-xl shadow-sm p-5 border border-border">
            <div className="flex items-start justify-between gap-4">
              <p className="text-foreground font-body">
                <span className="text-primary font-bold mr-2">{idx + 1}.</span>
                <LatexRenderer text={q.question} />
              </p>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <ReferenceBadges boardRefs={q.board_references} uniRefs={q.university_references} />
                <div className="flex gap-2">
                  <Badge variant="secondary">{q.class} • {q.subject}</Badge>
                  <Badge variant="outline">{q.marks} নম্বর</Badge>
                </div>
              </div>
            </div>
            <ExplanationToggle explanation={q.explanation} />
          </div>
        ))}
      </div>
    </QuestionPageLayout>
  );
}
