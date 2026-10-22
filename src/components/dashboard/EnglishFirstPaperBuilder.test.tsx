import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
import EnglishFirstPaperBuilder from './EnglishFirstPaperBuilder';
import {getEnglishBlocks} from '@/lib/englishFirstPattern';
afterEach(cleanup);
it('shows Q1-Q11 with shared seen source, separate poems and stories, and writing marks',()=>{
 const onPreview=vi.fn();
 const rows=[
 {id:1,type:'mcq',question:'Seen MCQ',chapter_id:2,topic_id:21,stimulus_text:'Same seen source'},
 {id:2,type:'answering_questions',question:'Seen answer',chapter_id:2,topic_id:21,stimulus_text:'Same seen source'},
 {id:3,type:'gap_filling',question:'Seen gap',chapter_id:2,topic_id:21,stimulus_text:'Same seen source'},
 {id:4,type:'gap_filling',question:'Other lesson gap',chapter_id:2,topic_id:22,stimulus_text:'Other source'},
 ];
 render(<EnglishFirstPaperBuilder className="Class 9" enabledBlocks={getEnglishBlocks('Class 9').map((_,i)=>i)} initialQuestions={rows} chapters={[{id:2,name:'Unit 2: Climate Change'}]} topics={[{id:21,name:'Lesson 1(A)',chapter_id:2}]} onPreview={onPreview}/>);
 expect(screen.getByText('Q1 + Q2 + Q3')).toBeTruthy();
 expect(screen.getByText('Q4 + Q5')).toBeTruthy();
 expect(screen.getByText('Q11')).toBeTruthy();
 expect(screen.queryByText('Q12')).toBeNull();
 expect(screen.getByText('Answering Questions from Stories')).toBeTruthy();
 const checkboxes=screen.getAllByRole('checkbox');
 fireEvent.click(checkboxes[2]);
 expect(screen.getByRole('status').textContent).toContain('Unit');
 fireEvent.click(screen.getByLabelText('Unit 2: Climate Change'));
 fireEvent.click(screen.getByLabelText('Lesson 1(A)'));
 fireEvent.click(checkboxes[2]);
 expect(onPreview.mock.calls.at(-1)?.[0].map((q:any)=>q.id)).toEqual([3]);
});
it('preserves the lower secondary Q1-Q13 pattern',()=>{
 render(<EnglishFirstPaperBuilder className="Class 8" enabledBlocks={getEnglishBlocks('Class 8').map((_,i)=>i)} initialQuestions={[]} chapters={[]} topics={[]} onPreview={()=>{}}/>);
 expect(screen.getByText('Q13')).toBeTruthy();expect(screen.getByText('Paragraph')).toBeTruthy();
 expect(screen.queryByText('Answering Questions from Stories')).toBeNull();
});
