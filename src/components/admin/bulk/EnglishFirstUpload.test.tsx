import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { it, expect, vi, afterEach } from 'vitest';
const state = vi.hoisted(() => ({ topics: [] as {id:number;name:string}[] }));
vi.mock('@/integrations/supabase/client', () => ({supabase:{
  from: (table:string) => {
    const query:any={select:()=>query,eq:()=>query,in:()=>query,
      then:(resolve:any)=>Promise.resolve({data:table==='topics'?state.topics:[],error:null}).then(resolve)};
    return query;
  },
}}));
vi.mock('./AIExtract',()=>({default:()=>null}));
vi.mock('./PasteGuide',()=>({default:()=>null}));
import EnglishFirstUpload from './EnglishFirstUpload';
afterEach(()=>{cleanup();state.topics=[];});
it('accepts Class 6 seen comprehension without inventing a required lesson',async()=>{
  render(<EnglishFirstUpload classId="6" subjectId="1" chapters={[{id:61,name:'Seen Comprehension'}]}/>);
  fireEvent.change(screen.getByLabelText('Upload Unit'),{target:{value:'61'}});
  await waitFor(()=>expect(screen.queryByLabelText('Upload Lesson')).toBeNull());
  fireEvent.change(screen.getByRole('textbox'),{target:{value:'Passage Name: Library\nPassage: Rina reads books.\n---\nType: mcq\nপ্রশ্ন: Who reads?\n(a) Rina\n(b) Mina\n(c) Tina\n(d) Sima\nউত্তর: a'}});
  expect(screen.getByRole('button',{name:'প্রশ্ন তালিকায় যোগ করুন'})).toBeEnabled();
  for(const text of ['Unseen Passage · Q5–Q7','Matching · Q8','Dialogue · Q13'])
    expect(screen.getByRole('option',{name:text})).toBeTruthy();
});
it('requires an existing lesson for Class 7 unit-based uploads',async()=>{
  state.topics=[{id:71,name:'Lesson 1: Attention'}];
  render(<EnglishFirstUpload classId="7" subjectId="1" chapters={[{id:70,name:'Unit 1: Attention, Please'}]}/>);
  fireEvent.change(screen.getByLabelText('Upload Unit'),{target:{value:'70'}});
  await screen.findByRole('option',{name:'Lesson 1: Attention'});
  fireEvent.change(screen.getByRole('textbox'),{target:{value:'sample'}});
  expect(screen.getByRole('button',{name:'প্রশ্ন তালিকায় যোগ করুন'})).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Upload Lesson'),{target:{value:'71'}});
  expect(screen.getByRole('button',{name:'প্রশ্ন তালিকায় যোগ করুন'})).toBeEnabled();
});
