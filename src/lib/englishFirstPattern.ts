import { patternGrade } from './languageQuestionTypes';

export type EnglishBlock = {
 title: string; marks: number; numbers: readonly number[];
 source: 'lesson' | 'passage' | 'none'; passage?: string;
 needs: readonly (readonly [string, number])[];
};
export const lowerEnglishBlocks: readonly EnglishBlock[] = [
 {title:'Seen Passage 1',marks:17,numbers:[1,2],source:'lesson',passage:'seen_passage_1',needs:[['mcq',7],['answering_questions',5]]},
 {title:'Seen Passage 2',marks:10,numbers:[3,4],source:'lesson',passage:'seen_passage_2',needs:[['gap_filling',1],['vocabulary',5]]},
 {title:'Unseen Passage',marks:20,numbers:[5,6,7],source:'passage',passage:'unseen_passage',needs:[['information_transfer',1],['true_false',5],['writing_summary',1]]},
 {title:'Matching · Q8',marks:5,numbers:[8],source:'none',needs:[['matching',1]]},
 {title:'Rearranging · Q9',marks:8,numbers:[9],source:'none',needs:[['rearranging',1]]},
 {title:'Poems · Q10 (৮টি থেকে ৫টির উত্তর)',marks:10,numbers:[10],source:'lesson',needs:[['poem_questions',8]]},
 {title:'Completing a Story · Q11',marks:10,numbers:[11],source:'none',needs:[['completing_story',1]]},
 {title:'Paragraph · Q12',marks:10,numbers:[12],source:'none',needs:[['paragraph',1]]},
 {title:'Dialogue · Q13',marks:10,numbers:[13],source:'none',needs:[['dialogue',1]]},
];
export const classNineEnglishBlocks: readonly EnglishBlock[] = [
 {title:'Seen Passage',marks:22,numbers:[1,2,3],source:'lesson',passage:'seen_passage',needs:[['mcq',7],['answering_questions',5],['gap_filling',1]]},
 {title:'Unseen Passage',marks:15,numbers:[4,5],source:'passage',passage:'unseen_passage',needs:[['information_transfer',1],['writing_summary',1]]},
 {title:'Matching · Q6',marks:5,numbers:[6],source:'none',needs:[['matching',1]]},
 {title:'Rearranging · Q7',marks:8,numbers:[7],source:'none',needs:[['rearranging',1]]},
 {title:'Poems · Q8 (৮টি থেকে ৫টির উত্তর)',marks:10,numbers:[8],source:'lesson',needs:[['poem_questions',8]]},
 {title:'Stories · Q9 (৮টি থেকে ৫টির উত্তর)',marks:10,numbers:[9],source:'lesson',needs:[['story_questions',8]]},
 {title:'Completing a Story · Q10',marks:15,numbers:[10],source:'none',needs:[['completing_story',1]]},
 {title:'Dialogue · Q11',marks:15,numbers:[11],source:'none',needs:[['dialogue',1]]},
];
export const isClassNineEnglish = (className = '') => patternGrade(className) === 9;
export const getEnglishBlocks = (className = '') => isClassNineEnglish(className) ? classNineEnglishBlocks : lowerEnglishBlocks;
const lowerMarks: Record<string,number> = {mcq:1,answering_questions:2,gap_filling:5,vocabulary:1,information_transfer:5,true_false:1,writing_summary:10,matching:5,rearranging:8,poem_questions:2,story_questions:2,completing_story:10,paragraph:10,dialogue:10};
export const englishPatternMarks = (className = ''): Record<string,number> => isClassNineEnglish(className) ? {...lowerMarks,completing_story:15,dialogue:15} : lowerMarks;
export type EnglishUploadSection = {name:string;types:string[];lesson?:boolean;passage?:boolean;passageTypes?:string[];chapterMatch?:RegExp};
const lowerUpload: EnglishUploadSection[] = [
 {name:'Seen Passage · Q1–Q4',types:['mcq','answering_questions','gap_filling','vocabulary'],lesson:true,passage:true,passageTypes:['seen_passage_1','seen_passage_2']},
 {name:'Unseen Passage · Q5–Q7',types:['information_transfer','true_false','writing_summary'],passage:true,passageTypes:['unseen_passage'],chapterMatch:/unseen/i},
 {name:'Matching · Q8',types:['matching'],chapterMatch:/matching/i},
 {name:'Rearranging · Q9',types:['rearranging'],chapterMatch:/rearrang/i},
 {name:'Poems · Q10',types:['poem_questions'],lesson:true},
 {name:'Completing a Story · Q11',types:['completing_story'],chapterMatch:/complet.*stor/i},
 {name:'Paragraph · Q12',types:['paragraph'],chapterMatch:/paragraph/i},
 {name:'Dialogue · Q13',types:['dialogue'],chapterMatch:/dialog/i},
];
const nineUpload: EnglishUploadSection[] = classNineEnglishBlocks.map(block=>({
 name:block.passage ? `${block.title} · Q${block.numbers[0]}–Q${block.numbers.at(-1)}` : block.title.replace(/ \(.*\)/,''),
 types:block.needs.map(([type])=>type),lesson:block.source==='lesson',passage:!!block.passage,
 passageTypes:block.passage?[block.passage]:undefined,
 chapterMatch:({information_transfer:/unseen/i,matching:/matching/i,rearranging:/rearrang/i,completing_story:/complet.*stor/i,dialogue:/dialog/i} as Record<string,RegExp>)[block.needs[0][0]],
}));
export const englishUploadSections = (className = '') => isClassNineEnglish(className) ? nineUpload : lowerUpload;
