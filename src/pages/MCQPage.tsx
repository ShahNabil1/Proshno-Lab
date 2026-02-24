import QuestionPageLayout from "@/components/QuestionPageLayout";
import { Badge } from "@/components/ui/badge";
import LatexRenderer from "@/components/LatexRenderer";
import ReferenceBadges from "@/components/ReferenceBadges";
import ExplanationToggle from "@/components/ExplanationToggle";

const mockMCQs = [
  {
    id: 1, question: "বাংলাদেশের রাজধানী কোথায়?", options: ["চট্টগ্রাম", "ঢাকা", "রাজশাহী", "সিলেট"], correct: 1,
    class: "৯ম", subject: "সামাজিক বিজ্ঞান", chapter: "অধ্যায় ১",
    board_references: [{ board: "কু. বো.", year: "২০২৩" }, { board: "রা. বো.", year: "২০২৩" }],
    university_references: [], explanation: "ঢাকা বাংলাদেশের রাজধানী এবং সবচেয়ে বড় শহর।"
  },
  {
    id: 2, question: "পানির রাসায়নিক সংকেত কী?", options: ["CO2", "H2O", "NaCl", "O2"], correct: 1,
    class: "৮ম", subject: "রসায়ন", chapter: "অধ্যায় ৩",
    board_references: [{ board: "ঢা. বো.", year: "২০২২" }],
    university_references: [{ name: "ঢাকা বিশ্ববিদ্যালয়", year: "১৭" }], explanation: ""
  },
  {
    id: 3, question: "১+১ = কত?", options: ["১", "২", "৩", "৪"], correct: 1,
    class: "৬ষ্ঠ", subject: "গণিত", chapter: "অধ্যায় ১",
    board_references: [], university_references: [], explanation: ""
  },
  {
    id: 4, question: "'সোনার তরী' কবিতাটি কার লেখা?", options: ["কাজী নজরুল ইসলাম", "রবীন্দ্রনাথ ঠাকুর", "জীবনানন্দ দাশ", "মাইকেল মধুসূদন"], correct: 1,
    class: "১০ম", subject: "বাংলা", chapter: "অধ্যায় ৫",
    board_references: [{ board: "য. বো.", year: "২০২৩" }], university_references: [],
    explanation: "রবীন্দ্রনাথ ঠাকুর 'সোনার তরী' কবিতার রচয়িতা।"
  },
];

const optionLabels = ["ক", "খ", "গ", "ঘ"];

export default function MCQPage() {
  return (
    <QuestionPageLayout title="বহুনির্বাচনি প্রশ্ন (MCQ)" subtitle="প্রতিটি প্রশ্ন ১ নম্বর" bannerClass="gradient-purple">
      <div className="space-y-4">
        {mockMCQs.map((q, idx) => (
          <div key={q.id} className="bg-card rounded-xl shadow-sm p-5 border border-border">
            <div className="flex items-start justify-between gap-4 mb-3">
              <h3 className="font-body font-medium text-foreground">
                <span className="text-primary font-bold mr-2">{idx + 1}.</span>
                <LatexRenderer text={q.question} />
              </h3>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <ReferenceBadges boardRefs={q.board_references} uniRefs={q.university_references} />
                <Badge variant="secondary" className="shrink-0">{q.class} • {q.subject}</Badge>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {q.options.map((opt, oi) => (
                <div
                  key={oi}
                  className={`px-4 py-2.5 rounded-lg border text-sm font-body ${oi === q.correct
                    ? "bg-accent border-primary/30 text-accent-foreground font-medium"
                    : "bg-muted/50 border-border text-muted-foreground"
                  }`}
                >
                  <span className="font-bold mr-2">{optionLabels[oi]}.</span>
                  <LatexRenderer text={opt} />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">{q.chapter} • ১ নম্বর</p>
            <ExplanationToggle explanation={q.explanation} />
          </div>
        ))}
      </div>
    </QuestionPageLayout>
  );
}
