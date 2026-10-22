import { getEnglishBlocks, englishPatternMarks, isClassNineEnglish } from './englishFirstPattern';
import { questionMarks } from './languageQuestionTypes';

export type EnglishPaperQuestion = { type: string; question: string; stimulus_text?: string | null; creative_data?: any };
const order = ['mcq', 'answering_questions', 'gap_filling', 'vocabulary', 'information_transfer', 'true_false', 'writing_summary', 'matching', 'rearranging', 'poem_questions', 'completing_story', 'paragraph', 'dialogue'];
export const englishSectionInstruction: Record<string, string> = {
  mcq: 'Choose the correct answer from the alternatives.',
  answering_questions: 'Answer the following questions from your reading of the above text.',
  gap_filling: 'Fill in each gap with a suitable word based on the passage.',
  vocabulary: 'Read the passage and write the synonyms and antonyms of the words as directed below.',
  information_transfer: 'Complete the following table with the information given in the passage.',
  true_false: 'Read the passage again and write True or False. If false give the correct answer.',
  writing_summary: 'Write a summary of the above passage in your own words.',
  matching: 'Match column A and column B and make five complete sentences.',
  rearranging: 'Rearrange the following sentences in correct order.',
  poem_questions: 'Answer the following questions from the poems of your textbook.',
  story_questions: 'Answer any five of the following questions from the stories in your textbook.',
  completing_story: 'Read the beginning of a story. Add at least ten new sentences to complete the story.',
  paragraph: 'Write a paragraph of 150 words on the following topic.',
  dialogue: 'Write a dialogue on the following situation.',
};
const passageKey = (text:string) => text.replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
export function englishQuestionContent(type:string, text:string) {
  let body=text.trim(), instruction='';
  if (['mcq','answering_questions','vocabulary','true_false','poem_questions','story_questions'].includes(type)) {
    body=body.replace(/^(\s*<(?:p|div)[^>]*>\s*)?\([a-z]\)\s*/i,(_,tag)=>tag || '');
  } else {
    // Preserve the source's wording and constraints in the section heading.
    const match=body.match(/^(?:<(?:p|div)[^>]*>\s*)?((?:Complete|Fill|Match|Put|Rearrange|Write|Read)\b[^.!?]*[.!?])\s*(?:<\/(?:p|div)>\s*)?/i);
    if(match) {instruction=match[1];body=body.slice(match[0].length).trim().replace(/^(?:<br\s*\/?\s*>\s*)+/i,'');}
    if(type==='completing_story' || type==='rearranging') {
      const extra=body.match(/^(?:<(?:p|div)[^>]*>\s*)?((?:Give a suitable title|Only the corresponding)[^.!?]*[.!?])\s*(?:<\/(?:p|div)>\s*)?/i);
      if(extra) {instruction+=' '+extra[1];body=body.slice(extra[0].length).trim();}
    }
    if(type==='rearranging') body=body.replace(/^(\s*(?:<(?:p|div)[^>]*>\s*)?)(?:<br\s*\/?\s*>\s*)+/i,'$1').replace(/([^>\s])\s*(\([a-z]\))/g,'$1<br/>$2');
  }
  return {body,instruction};
}
export function englishItemLabel(type:string,index:number,count:number) {
  if (['mcq','answering_questions','vocabulary','true_false','poem_questions','story_questions'].includes(type)) return `(${String.fromCharCode(97+index)})`;
  return count > 1 ? `${index+1}.` : '';
}
export function englishPaperSections<T extends EnglishPaperQuestion>(questions: T[], className = '') {
  const classNine = isClassNineEnglish(className);
  const defaults = englishPatternMarks(className);
  const patternOrder = classNine ? getEnglishBlocks(className).flatMap(b => b.needs.map(([type]) => type)) : order;
  const passages = questions.filter(q => /^seen_passage|^unseen_passage/.test(q.type));
  const types = [...new Set(questions.filter(q => !passages.includes(q)).map(q => q.type))];
  types.sort((a,b) => (patternOrder.indexOf(a) < 0 ? 99 : patternOrder.indexOf(a)) - (patternOrder.indexOf(b) < 0 ? 99 : patternOrder.indexOf(b)));
  const sections = types.map((type,index) => {
    const originals = questions.filter(q => q.type === type);
    const contents=originals.map(q=>englishQuestionContent(type,q.question));
    const items = originals.map((q,i)=>({...q,question:contents[i].body}));
    const passageType = ['mcq','answering_questions'].includes(type) ? (classNine ? 'seen_passage' : 'seen_passage_1') : ['gap_filling','vocabulary'].includes(type) ? (classNine ? 'seen_passage' : 'seen_passage_2') : ['information_transfer','true_false','writing_summary'].includes(type) ? 'unseen_passage' : undefined;
    const source=originals.find(q=>q.stimulus_text)?.stimulus_text;
    const matchingPassage=source ? passages.find(q=>passageKey(q.question)===passageKey(source)) : undefined;
    const fallback=passageType ? passages.find(q=>q.type===passageType) || (classNine && passageType==='seen_passage' ? passages.find(q=>q.type==='seen_passage_1') : undefined) : undefined;
    const passage = passageType ? matchingPassage || (source ? {...(fallback || originals[0]),question:source,type:passageType} : fallback) : undefined;
    const answerCount = ['poem_questions','story_questions'].includes(type) ? Math.min(5,items.length) : items.length;
    const marks = items.slice(0,answerCount).reduce((sum,q)=>sum+(classNine ? defaults[type] || 0 : questionMarks(q) || defaults[type] || 0),0);
    const unit = defaults[type];
    const marksLine = ['mcq','answering_questions','vocabulary','true_false','poem_questions','story_questions'].includes(type) ? `${unit} × ${answerCount} = ${marks}` : ['gap_filling','information_transfer','matching','rearranging'].includes(type) && items.length === 1 ? `1 × ${marks} = ${marks}` : String(marks);
    return { type, number:index+1, items, passage, instruction:contents.find(c=>c.instruction)?.instruction || (classNine && type==='matching' ? "Match the parts of sentences in columns A, B and C to write five complete sentences." : englishSectionInstruction[type]), marks, marksLine, answerCount, part:['completing_story','paragraph','dialogue'].includes(type) ? 'writing' : 'reading' };
  });
  return { sections, passages };
}
export function englishPassageInstruction(sections:ReturnType<typeof englishPaperSections>['sections'],index:number) {
  const section=sections[index];
  const numbers=sections.filter(s=>s.passage && section.passage && passageKey(s.passage.question) === passageKey(section.passage.question)).map(s=>s.number);
  return `Read the text and answer the questions ${numbers.length === 2 ? numbers.join(' and ') : numbers.join(', ')}.`;
}
