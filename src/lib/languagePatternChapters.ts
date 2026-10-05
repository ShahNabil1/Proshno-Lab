import { languageSubject, patternGrade } from './languageQuestionTypes';
import { supabase } from '@/integrations/supabase/client';

export const PATTERN_CHAPTER_PREFIX = 'pattern:';
export const patternChapterName = (id: string, chapters: Array<{id: number; name: string}>) => id.startsWith(PATTERN_CHAPTER_PREFIX) ? id.slice(PATTERN_CHAPTER_PREFIX.length) : chapters.find(c=>String(c.id)===id)?.name || '';
export function patternChapters(className: string, subjectName: string): string[] {
  const grade=patternGrade(className),subject=languageSubject(subjectName);
  if(!grade || !subject) return [];
  if(subject==='english1') {
    const units: Record<number,string[]> = {
      6:['Seen Comprehension'],
      7:['Attention, Please','My Study Guide','What are Friends for?','People Who Make a Difference','Great Woman to Remember','Leisure','Games and Sports','Likes and Dislikes','Climate Change'],
      8:['A Glimpse of Our Culture','Food and Nutrition','Health and Hygiene','Check Your Reference','Humans and Environment','Going on a Trip','People and Occupations','News! News! News!','Things that Have Changed Our Life','Fables',"Women's Role in Uprising"],
      9:['Sense of Self','Climate Change','Pastimes','Events & Festivals','Problems Around Us','Our Neighbours','People Who Stand Out','World Heritage','Unconventional Jobs','Dreams','Reading from English Literature','Roots','Loneliness','Renewable Energy','Media and Modes of E-communication','Graffiti'],
    };
    return [...units[grade].map((name,i)=>grade===6?name:`Unit ${i+1}: ${name}`),'Unseen Comprehension','Matching','Rearranging Sentences','Answering Questions from Poems',...(grade===9?['Answering Questions from Stories']:[]),'Completing a Story',...(grade===9?[]:['Writing Paragraph']),'Writing Dialogue'];
  }
  if(subject==='english2') return [
    ...(grade===6?['Identification of Parts of Speech']:[]),
    ...(grade===7?[]:[grade===8?'Gap filling activities with/without clues':'Gap Filling with Clues']),
    'Substitution Table','Right Forms of Verbs','Changing Sentences',...([7,8].includes(grade)?['Passage Narration']:[]),
    ...(grade===9?['Tag Questions','Suffixes and Prefixes','Preposition','Connectors/Linking Words','Paragraph']:[]),
    'Punctuation and Capitalization','E-mail/Letter/Application','Short Composition',
  ];
  return [grade===9?'অনুচ্ছেদ রচনা':'অনুধাবন দক্ষতা/অনুচ্ছেদ রচনা','সারাংশ ও সারমর্ম','ভাব-সম্প্রসারণ','চিঠিপত্র লিখন',...(grade===9?['সংবাদ প্রতিবেদন প্রণয়ন','বাংলায় অনুবাদ']:[]),'প্রবন্ধ রচনা'];
}
export function missingPatternChapters(className:string,subjectName:string,chapters:Array<{name:string}>) {
  const key=(name:string)=>name.toLowerCase().replace(/[০-৯]/g,c=>String('০১২৩৪৫৬৭৮৯'.indexOf(c))).replace(/\d+/g,d=>String(Number(d))).replace(/[\s:‐‑–—-]+/g,'');
  return patternChapters(className,subjectName).filter(name=>!chapters.some(c=>key(c.name)===key(name)));
}
// Only called on a user-triggered save. Reuses an existing chapter on retries.
export async function ensurePatternChapter(id:string,subjectId:number):Promise<number> {
  if(!id.startsWith(PATTERN_CHAPTER_PREFIX)) return Number(id);
  const name=id.slice(PATTERN_CHAPTER_PREFIX.length);
  const {data:existing,error:lookupError}=await supabase.from('chapters').select('id').eq('subject_id',subjectId).eq('name',name).limit(1).maybeSingle();
  if(lookupError) throw lookupError;
  if(existing) return existing.id;
  const {data,error}=await supabase.from('chapters').insert({name,subject_id:subjectId,is_active:true}).select('id').single();
  if(error || !data) throw error || new Error('Chapter could not be created');
  return data.id;
}
