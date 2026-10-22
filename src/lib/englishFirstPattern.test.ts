import { describe,it,expect } from 'vitest';
import { getEnglishBlocks, englishUploadSections, englishPatternMarks } from './englishFirstPattern';
import { blockCandidates, blockMissing, pickBlock } from './englishFirstBuilder';
import { passageType, parseMixedPassagePaste } from './englishPassageUpload';
describe('class nine reference template',()=>{
 it.each(['নবম-দশম শ্রেণি','Class 9','Class 10','SSC (Eglish Version)'])('maps %s to the eleven-question template',name=>{
  const blocks=getEnglishBlocks(name);
  expect(blocks.flatMap(b=>b.numbers)).toEqual([1,2,3,4,5,6,7,8,9,10,11]);
  expect(blocks.reduce((n,b)=>n+b.marks,0)).toBe(100);
  expect(blocks[0].needs.map(([t])=>t)).toEqual(['mcq','answering_questions','gap_filling']);
  expect(blocks[1].needs.map(([t])=>t)).toEqual(['information_transfer','writing_summary']);
  expect(englishPatternMarks(name).completing_story).toBe(15);
  expect(englishUploadSections(name).flatMap(s=>s.types)).not.toEqual(expect.arrayContaining(['true_false','vocabulary','paragraph']));
 });
 it('keeps all three seen sections bound to one passage',()=>{
  const block=getEnglishBlocks('Class 9')[0];
  const rows=block.needs.flatMap(([type,count])=>Array.from({length:count},(_,i)=>({id:100*block.needs.findIndex(([t])=>t===type)+i,type,question:'Question '+i,chapter_id:1,stimulus_text:'Shared source'})));
  const sets=blockCandidates(rows,block);expect(sets).toHaveLength(1);
  expect(blockMissing(sets[0].rows,block)).toEqual([]);
  expect(pickBlock(sets[0].rows,block)).toHaveLength(13);
 });
 it('understands Q4 and Q5 without confusing them with class eight vocabulary/true-false',()=>{
  expect(passageType('Q4',['information_transfer','writing_summary'],'Class 9')).toBe('information_transfer');
  expect(passageType('Q5',['information_transfer','writing_summary'],'Class 9')).toBe('writing_summary');
  expect(passageType('Q4',['vocabulary'])).toBe('vocabulary');
  const parsed=parseMixedPassagePaste('Passage Name: Practice\nPassage: Rina opened a library.\n---\nType: Q5\nপ্রশ্ন: Write a summary.\nউত্তর: Rina opened a library.',['information_transfer','writing_summary'],'Class 9');
  expect(parsed.rows[0].type).toBe('writing_summary');
 });
});
