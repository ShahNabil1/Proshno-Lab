export interface ProgramNameSuggestion {
  bangla: string;
  english: string;
}

export const PROGRAM_NAME_SUGGESTIONS: ProgramNameSuggestion[] = [
  { bangla: "অধ্যায়ভিত্তিক পরীক্ষা", english: "Chapter-wise Test" },
  { bangla: "শ্রেণি অভীক্ষা", english: "Class Test" },
  { bangla: "সাপ্তাহিক পরীক্ষা", english: "Weekly Test" },
  { bangla: "মাসিক পরীক্ষা", english: "Monthly Test" },
  { bangla: "বহুনির্বাচনি পরীক্ষা", english: "MCQ Test" },
  { bangla: "অর্ধবার্ষিক পরীক্ষা", english: "Half-Yearly Exam" },
  { bangla: "বার্ষিক পরীক্ষা", english: "Annual Exam" },
  { bangla: "প্রাক-নির্বাচনী পরীক্ষা", english: "Pre-Test Exam" },
  { bangla: "নির্বাচনী পরীক্ষা", english: "Test Exam" },
];

export const getProgramNameSuggestion = (
  suggestion: ProgramNameSuggestion,
  isEnglishVersion: boolean,
) => (isEnglishVersion ? suggestion.english : suggestion.bangla);
