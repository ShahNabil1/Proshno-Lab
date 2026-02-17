import QuestionPageLayout from "@/components/QuestionPageLayout";
import { Badge } from "@/components/ui/badge";

const mockDescriptive = [
  { id: 1, question: "বাংলাদেশের মুক্তিযুদ্ধের পটভূমি ও গুরুত্ব বিশদভাবে আলোচনা কর।", class: "১০ম", subject: "ইতিহাস", marks: 10 },
  { id: 2, question: "জলবায়ু পরিবর্তনের কারণ ও এর প্রভাব সম্পর্কে একটি প্রবন্ধ লিখ।", class: "৯ম", subject: "ভূগোল", marks: 10 },
  { id: 3, question: "বাংলা ভাষা আন্দোলনের ইতিহাস ও তাৎপর্য ব্যাখ্যা কর।", class: "১০ম", subject: "বাংলা", marks: 10 },
];

export default function DescriptivePage() {
  return (
    <QuestionPageLayout title="বর্ণনামূলক প্রশ্ন" subtitle="বিস্তারিত উত্তরের জন্য বর্ণনামূলক প্রশ্ন" bannerClass="gradient-yellow">
      <div className="space-y-4">
        {mockDescriptive.map((q, idx) => (
          <div key={q.id} className="bg-card rounded-xl shadow-sm p-6 border border-border">
            <div className="flex items-start justify-between gap-4">
              <p className="text-foreground font-body text-lg">
                <span className="text-primary font-bold mr-2">{idx + 1}.</span>
                {q.question}
              </p>
              <div className="flex gap-2 shrink-0">
                <Badge variant="secondary">{q.class} • {q.subject}</Badge>
                <Badge>{q.marks} নম্বর</Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
    </QuestionPageLayout>
  );
}
