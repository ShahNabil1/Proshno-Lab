import { describe, expect, it } from 'vitest';
import { englishPaperSections, englishPassageInstruction, englishItemLabel, englishQuestionContent } from './englishPaperSections';
describe('English paper sections',()=>{
  it('uses the question passage instead of a stale standalone passage',()=>{
    const {sections}=englishPaperSections([{type:'seen_passage_2',question:'Wrong passage'},{type:'gap_filling',question:'Complete the passage with suitable words. Rice is (a) ___.',stimulus_text:'Cuisine passage'},{type:'vocabulary',question:'(d) staple (synonym)',stimulus_text:'Cuisine passage'}]);
    expect(sections[0].passage?.question).toBe('Cuisine passage');
    expect(sections[1].passage?.question).toBe('Cuisine passage');
    expect(englishPassageInstruction(sections,0)).toContain('1 and 2');
    expect(sections[0].instruction).toBe('Complete the passage with suitable words.');
    expect(sections[0].items[0].question).toBe('Rice is (a) ___.');
    expect(sections[1].items[0].question).toBe('staple (synonym)');
  });
  it('preserves tables, writing constraints and separates rearranging sentences',()=>{
    expect(englishQuestionContent('information_transfer','Complete the table.<table><tr><td>(i) ___</td></tr></table>').body).toContain('<table>');
    expect(englishQuestionContent('paragraph',"Write a paragraph on 'A Tea Stall' in about 150 words.").instruction).toContain('150 words');
    const story=englishQuestionContent('completing_story','Read the story and complete it. Give a suitable title to it.Once upon a time...');
    expect(story.instruction).toContain('Give a suitable title');
    expect(story.body).toBe('Once upon a time...');
    expect(englishQuestionContent('rearranging','<p>(a) First.(b) Second.</p>').body).toContain('First.<br/>(b)');
    expect(englishQuestionContent('rearranging','Put the story in order.<br>Only the corresponding numbers need to be written.<br>(a) First.<br>(b) Second.').body).not.toMatch(/^<br/i);
  });
  it('groups shuffled items and keeps passages unnumbered',()=>{
    const input=[{type:'vocabulary',question:'word'},{type:'gap_filling',question:'blanks'},{type:'seen_passage_1',question:'first'},{type:'mcq',question:'one'},{type:'answering_questions',question:'short'},{type:'mcq',question:'two'},{type:'seen_passage_2',question:'second'}];
    const result=englishPaperSections(input);
    expect(result.sections.map(s=>[s.number,s.type,s.marks])).toEqual([[1,'mcq',2],[2,'answering_questions',2],[3,'gap_filling',5],[4,'vocabulary',1]]);
    expect(result.sections[0].items).toHaveLength(2);
    expect(result.sections[0].passage?.question).toBe('first');
    expect(result.sections[2].passage?.question).toBe('second');
    expect(result.sections.flatMap(s=>s.items)).toHaveLength(5);
  });
  it('keeps explicit marks and all selected sets',()=>{
    const result=englishPaperSections([{type:'gap_filling',question:'one',creative_data:{marks:3}},{type:'gap_filling',question:'two',creative_data:{marks:4}}]);
    expect(result.sections[0].marks).toBe(7);
    expect(result.sections[0].items).toHaveLength(2);
  });
  it('matches the full class eight 70+30 pattern',()=>{
    const counts:Record<string,number>={mcq:7,answering_questions:5,gap_filling:1,vocabulary:5,information_transfer:1,true_false:5,writing_summary:1,matching:1,rearranging:1,poem_questions:8,completing_story:1,paragraph:1,dialogue:1};
    const rows=Object.entries(counts).flatMap(([type,count])=>Array.from({length:count},(_,i)=>({type,question:`${type} ${i}`})));
    rows.push({type:'seen_passage_1',question:'first'},{type:'seen_passage_2',question:'second'},{type:'unseen_passage',question:'third'});
    const {sections}=englishPaperSections(rows.reverse());
    expect(sections.map(s=>s.number)).toEqual(Array.from({length:13},(_,i)=>i+1));
    expect(sections.filter(s=>s.part==='reading').reduce((sum,s)=>sum+s.marks,0)).toBe(70);
    expect(sections.filter(s=>s.part==='writing').reduce((sum,s)=>sum+s.marks,0)).toBe(30);
    expect(sections[9].items).toHaveLength(8);
    expect(sections[9].marksLine).toBe('2 × 5 = 10');
    expect(sections[7].passage).toBeUndefined();
    expect(englishPassageInstruction(sections,4)).toContain('5, 6, 7');
    expect(englishItemLabel('mcq',0,7)).toBe('(a)');
    expect(englishItemLabel('gap_filling',0,1)).toBe('');
  });
});
