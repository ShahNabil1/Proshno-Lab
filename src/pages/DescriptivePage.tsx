import QuestionPageLayout from "@/components/QuestionPageLayout";
import { Badge } from "@/components/ui/badge";
import LatexRenderer from "@/components/LatexRenderer";
import ReferenceBadges from "@/components/ReferenceBadges";
import ExplanationToggle from "@/components/ExplanationToggle";

const mockDescriptive = [
  { id: 1, question: "বাংলাদেশের মুক্তিযুদ্ধের পটভূমি ও গুরুত্ব বিশদভাবে আলোচনা কর।", class: "১০ম", subject: "ইতিহাস", marks: 10, board_references: [{ board: "ঢা. বো.", year: "২০২৩" }], university_references: [], explanation: "" },
  { id: 2, question: "জলবায়ু পরিবর্তনের কারণ ও এর প্রভাব সম্পর্কে একটি প্রবন্ধ লিখ।", class: "৯ম", subject: "ভূগোল", marks: 10, board_references: [], university_references: [{ name: "ঢাকা বিশ্ববিদ্যালয়", year: "১৮" }], explanation: "জলবায়ু পরিবর্তনের প্রধান কারণ হলো গ্রিনহাউস গ্যাস নির্গমন।" },
  { id: 3, question: "বাংলা ভাষা আন্দোলনের ইতিহাস ও তাৎপর্য ব্যাখ্যা কর।", class: "১০ম", subject: "বাংলা", marks: 10, board_references: [{ board: "কু. বো.", year: "২০২২" }, { board: "রা. বো.", year: "২০২৩" }], university_references: [], explanation: "" },
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
                <LatexRenderer text={q.question} />
              </p>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <ReferenceBadges boardRefs={q.board_references} uniRefs={q.university_references} />
                <div className="flex gap-2">
                  <Badge variant="secondary">{q.class} • {q.subject}</Badge>
                  <Badge>{q.marks} নম্বর</Badge>
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
