// Patterns transcribed from the owner's class 6, 7, 8 and 9–10 PDFs.
export const LANGUAGE_TYPE_LABELS: Record<string, string> = {
  seen_passage: 'Seen Passage', seen_passage_1: 'Seen Passage 1', seen_passage_2: 'Seen Passage 2',
  answering_questions: 'Answering Questions', gap_filling: 'Gap Filling', vocabulary: 'Vocabulary (Synonyms & Antonyms)',
  unseen_passage: 'Unseen Passage', information_transfer: 'Information Transfer', true_false: 'True/False', writing_summary: 'Writing Summary',
  matching: 'Matching', rearranging: 'Rearranging Sentences', poem_questions: 'Answering Questions from Poems', story_questions: 'Answering Questions from Stories',
  completing_story: 'Completing a Story', dialogue: 'Writing Dialogue', paragraph: 'Paragraph',
  parts_of_speech: 'Parts of Speech', substitution_table: 'Substitution Table', right_forms_of_verbs: 'Right Forms of Verbs',
  changing_sentences: 'Changing Sentences', narration: 'Narration', punctuation: 'Punctuation and Capitalization',
  letter_application: 'Letter/E-mail/Application', short_composition: 'Short Composition', tag_questions: 'Tag Questions',
  suffix_prefix: 'Suffixes and Prefixes', preposition: 'Preposition', connectors: 'Connectors/Linking Words',
  bangla_comprehension: 'অনুধাবন দক্ষতা', bangla_paragraph: 'অনুচ্ছেদ রচনা', bangla_summary: 'সারাংশ/সারমর্ম',
  bangla_expansion: 'ভাব-সম্প্রসারণ', bangla_letter: 'পত্র/দরখাস্ত', bangla_report: 'প্রতিবেদন প্রণয়ন', bangla_translation: 'বাংলায় অনুবাদ', bangla_essay: 'প্রবন্ধ রচনা',
};
export const BASE_TYPES = ['mcq', 'short', 'cq', 'descriptive'];
export const ALL_TYPES = [...BASE_TYPES, ...Object.keys(LANGUAGE_TYPE_LABELS)];
export const questionTypeLabel = (type: string) => LANGUAGE_TYPE_LABELS[type] || ({mcq:'MCQ',short:'সংক্ষিপ্ত',cq:'সৃজনশীল',descriptive:'বর্ণনামূলক',all:'সমন্বিত প্রশ্ন'} as Record<string,string>)[type] || type;
export const isLanguageType = (type: string) => Object.prototype.hasOwnProperty.call(LANGUAGE_TYPE_LABELS, type);
export const questionMarks = (q: {type: string; creative_data?: any}) => isLanguageType(q.type) ? Math.max(0, Number(q.creative_data?.marks) || 0) : q.type === 'mcq' ? 1 : q.type === 'short' ? 2 : 10;

const normalize = (s = '') => s.toLowerCase().replace(/[০-৯]/g, c => String('০১২৩৪৫৬৭৮৯'.indexOf(c))).replace(/[‐‑–—]/g, '-').replace(/\s+/g, ' ').trim();
export function patternGrade(name: string): 6 | 7 | 8 | 9 | null {
  const n = normalize(name);
  if (/ষষ্ঠ|class\s*6\b|^6(?:\D|$)/.test(n)) return 6;
  if (/সপ্তম|class\s*7\b|^7(?:\D|$)/.test(n)) return 7;
  if (/অষ্টম|class\s*8\b|^8(?:\D|$)/.test(n)) return 8;
  if (/\bssc\b|নবম|দশম|class\s*(9|10)\b|^(9|10)(?:\D|$)/.test(n)) return 9;
  return null;
}
export function languageSubject(name: string): 'english1' | 'english2' | 'bangla2' | null {
  const n = normalize(name);
  if (/english|ইংরেজি/.test(n)) {
    if (/2nd|second|2\s*(?:paper|পত্র)|2য়|2য়|দ্বিতীয়|দ্বিতীয়/.test(n)) return 'english2';
    if (/1st|first|1\s*(?:paper|পত্র)|1ম|প্রথম/.test(n)) return 'english1';
  }
  if (/bangla|বাংলা/.test(n) && /2nd|second|2|দ্বিতীয়|দ্বিতীয়/.test(n)) return 'bangla2';
  return null;
}
// The shared upload, builder and paper layout follow the owner's class-specific templates.
export function usesEnglishFirstTemplate(className: string, subjectName: string): boolean {
  const grade = patternGrade(className);
  return (grade === 6 || grade === 7 || grade === 8 || grade === 9) && languageSubject(subjectName) === 'english1';
}

type Rule = { match: RegExp; types: string[]; topics?: string[] };
export function languageRules(className: string, subjectName: string): Rule[] | null {
  const grade = patternGrade(className), subject = languageSubject(subjectName);
  if (!grade || !subject) return null;
  const lower = grade !== 9;
  if (subject === 'english1') return [
    {match:/unseen/,types:lower?['unseen_passage','information_transfer','true_false','writing_summary']:['unseen_passage','information_transfer','writing_summary']},
    {match:/matching/,types:['matching']}, {match:/rearrang/,types:['rearranging']},
    {match:/poem/,types:['poem_questions']}, ...(lower?[]:[{match:/questions?.*stor/,types:['story_questions']}]),
    {match:/complet.*stor/,types:['completing_story']}, {match:/dialog/,types:['dialogue']},
    ...(lower?[{match:/paragraph/,types:['paragraph'],topics:grade===6?[]:['Recent topic based','Non-Textual','Textual']}]:[]),
    {match:/unit|lesson|seen comprehension/,types:lower?['seen_passage_1','mcq','answering_questions','seen_passage_2','gap_filling','vocabulary']:['seen_passage','mcq','answering_questions','gap_filling']},
  ];
  if (subject === 'english2') return [
    ...(grade===6?[{match:/parts? of speech/,types:['parts_of_speech']}]:[]),
    ...(grade!==7?[{match:/gap.*fill/,types:['gap_filling'],topics:grade===8?['With clues','Without clues']:[]}]:[]),
    {match:/substitution/,types:['substitution_table']}, {match:/right forms? of verbs?/,types:['right_forms_of_verbs']},
    {match:/changing sentence/,types:['changing_sentences']},
    ...([7,8].includes(grade)?[{match:/narration/,types:['narration']}]:[]),
    ...(grade===9?[
      {match:/tag question/,types:['tag_questions']}, {match:/suffix|prefix/,types:['suffix_prefix']},
      {match:/preposition/,types:['preposition']}, {match:/connector|linking/,types:['connectors']},
      {match:/paragraph/,types:['paragraph'],topics:['Textual','Non Textual']},
    ]:[]),
    {match:/punctuation|capitalization/,types:['punctuation']},
    {match:/letter|e-?mail|application/,types:['letter_application'],topics:['Formal Letter','Informal Letter','Formal E-mail','Informal E-mail']},
    {match:/composition/,types:['short_composition']},
  ];
  return [
    {match:/অনুধাবন|অনুচ্ছেদ/,types:lower?['bangla_comprehension']:['bangla_paragraph'],topics:lower?['অনুধাবন দক্ষতা','অনুচ্ছেদ রচনা']:[]},
    {match:/সারাংশ|সারমর্ম/,types:['bangla_summary'],topics:['সারাংশ','সারমর্ম']},
    {match:/ভাব.?সম্প্রসারণ/,types:['bangla_expansion'],topics:lower?['গদ্যাংশ','কবিতাংশ']:[]},
    {match:/পত্র|চিঠি/,types:['bangla_letter'],topics:lower?['ব্যক্তিগত পত্র','আবেদনপত্র বা দরখাস্ত']:['ব্যক্তিগত পত্র','আবেদনপত্র','নিমন্ত্রণপত্র','ব্যবসায় সংক্রান্ত পত্র','অভিনন্দনপত্র']},
    ...(lower?[]:[{match:/প্রতিবেদন/,types:['bangla_report']},{match:/অনুবাদ/,types:['bangla_translation']}]),
    {match:/প্রবন্ধ|রচনা/,types:['bangla_essay']},
    // Grammar chapters retain their existing MCQ/short questions.
  ];
}
export function allowedQuestionTypes(className: string, subjectName: string, chapterName = ''): string[] {
  const rules = languageRules(className, subjectName);
  if (!rules) return [...BASE_TYPES];
  if (!chapterName) return [...new Set([...rules.flatMap(r => r.types), ...(languageSubject(subjectName)==='bangla2'?['mcq','short']:[])])];
  const rule = rules.find(r => r.match.test(normalize(chapterName)));
  return rule ? rule.types : [...BASE_TYPES];
}
export function suggestedLanguageTopics(className: string, subjectName: string, chapterName: string): string[] {
  return languageRules(className,subjectName)?.find(r=>r.match.test(normalize(chapterName)))?.topics || [];
}
