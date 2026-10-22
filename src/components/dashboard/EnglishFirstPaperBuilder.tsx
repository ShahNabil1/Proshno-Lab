import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { BuilderQuestion, blockCandidates, plainText } from '@/lib/englishFirstBuilder';
import { getEnglishBlocks, englishPatternMarks } from '@/lib/englishFirstPattern';
import { questionTypeLabel } from '@/lib/languageQuestionTypes';
import { Info } from 'lucide-react';

export default function EnglishFirstPaperBuilder<T extends BuilderQuestion>({
 initialQuestions,onPreview,chapters,topics,enabledBlocks,className='',
}: {initialQuestions:T[];enabledBlocks:number[];onPreview:(rows:T[])=>void;chapters:{id:number;name:string}[];topics:{id:number;name:string;chapter_id:number}[];className?:string}) {
 const [pool]=useState<T[]>(initialQuestions);
 const blocks=getEnglishBlocks(className), marks=englishPatternMarks(className);
 const [choices,setChoices]=useState<Record<number,string>>({});
 const [activeType,setActiveType]=useState<Record<number,string>>({});
 const [activeLesson,setActiveLesson]=useState<Record<number,number>>({});
 const [activeUnit,setActiveUnit]=useState<Record<number,number>>({});
 const [sourceHint,setSourceHint]=useState('');
 const candidates=useMemo(()=>blocks.map(block=>blockCandidates(pool,block)),[pool,blocks]);
 const chosen=candidates.map((list,i)=>list.find(item=>item.key===choices[i]));
 function sourceRows(i:number):T[] {
  const block=blocks[i];
  if(block.source==='passage')return chosen[i]?.rows || [];
  if(!activeLesson[i])return [];
  if(activeLesson[i]<0)return (chosen[i]?.rows || []).filter(q=>q.chapter_id===activeUnit[i]);
  return pool.filter(q=>q.chapter_id===activeUnit[i] && (q as T & {topic_id?:number}).topic_id===activeLesson[i] && block.needs.some(([type])=>type===q.type));
 }
 function showType(i:number,type:string) {
  const rows=sourceRows(i);
  if(activeType[i]!==type && !rows.length){setSourceHint(`${i}:${type}`);return;}
  setSourceHint('');const next=activeType[i]===type?'':type;
  setActiveType(prev=>({...prev,[i]:next}));
  onPreview(rows.filter(q=>!next || q.type===next || q.type.includes('passage')));
 }
 const clearType=(i:number)=>setActiveType(prev=>({...prev,[i]:''}));
 return <div className="space-y-4">{blocks.map((block,i)=>{
  if(!enabledBlocks.includes(i))return null;
  const label=block.title.split(' · ')[0], numbers=block.numbers.map(n=>'Q'+n).join(' + ');
  const explain=<Popover><PopoverTrigger asChild><Button variant="outline" size="sm" aria-label={`Explain ${numbers}`} title="Explain" className="h-5 w-5 p-0 shrink-0"><Info className="h-3.5 w-3.5"/></Button></PopoverTrigger>
   <PopoverContent className="w-72 text-sm space-y-2" align="end"><p className="font-semibold">{label} — {numbers}</p>
    {block.needs.map(([type,count],j)=><p key={type}>Q{block.numbers[j]}: {questionTypeLabel(type)} — {count===8?`৮টি থেকে ৫টির উত্তর; ২ × ৫ = ১০`:count===1?`১ সেট; ${marks[type]} নম্বর`:`${count} × ${marks[type]} = ${count*marks[type]}`}</p>)}
    <p className="font-semibold border-t pt-2">মোট: {block.marks} নম্বর</p>
   </PopoverContent></Popover>;
  if(block.source==='none')return <div key={block.title} className="rounded border p-3 flex items-center justify-between gap-2">
   <label className="flex items-center gap-2 min-w-0 cursor-pointer font-semibold"><input type="checkbox" checked={!!activeType[i]} onChange={()=>{
    const type=block.needs[0][0],next=activeType[i]?'':type;setActiveType(prev=>({...prev,[i]:next}));onPreview(next?pool.filter(q=>q.type===type):[]);
   }}/><span className="truncate">{label} <span className="inline-block rounded bg-violet-100 px-1.5 text-lg font-bold text-violet-800">{numbers}</span></span></label>{explain}
  </div>;
  return <div key={block.title} className="rounded border p-3 space-y-2">
   <div className="flex items-center justify-between gap-2 font-semibold"><span className="text-sm">{label} <span className="inline-block rounded bg-violet-100 px-1 text-base font-bold text-violet-800">{numbers}</span></span>{explain}</div>
   <div className="border border-slate-400 rounded p-2 space-y-2">{block.needs.map(([type],j)=><div key={type}>
    <label className="flex gap-2 items-center text-sm cursor-pointer"><input type="checkbox" checked={activeType[i]===type} onChange={()=>showType(i,type)}/><span className="text-lg font-bold text-slate-800">Q{block.numbers[j]}</span><span>{questionTypeLabel(type)}</span></label>
    {sourceHint===`${i}:${type}` && <p role="status" className="text-sm text-teal-700 pl-5">{block.source==='passage'?'আগে নিচের তালিকা থেকে Passage বেছে নিন।':'আগে নিচের তালিকা থেকে Unit ও Lesson/প্রশ্নসেট বেছে নিন।'}</p>}
   </div>)}</div>
   <div className="space-y-2 pl-2">{block.source==='passage'?candidates[i].map((candidate,index)=><label key={candidate.key} className="flex gap-2 items-start text-sm cursor-pointer">
    <input type="checkbox" checked={choices[i]===candidate.key} onChange={()=>{const next=choices[i]===candidate.key?'':candidate.key;setChoices(prev=>({...prev,[i]:next}));clearType(i);onPreview(next?candidate.rows:[]);}}/>
    <span className="min-w-0 flex-1 truncate" title={plainText(candidate.label)}>Passage-{String(index+1).padStart(2,'0')}: {plainText(candidate.label)}</span>
   </label>):chapters.filter(ch=>pool.some(q=>q.chapter_id===ch.id && block.needs.some(([type])=>type===q.type))).map(ch=><div key={ch.id}>
    <label className="flex gap-2 items-start text-sm cursor-pointer"><input type="checkbox" checked={activeUnit[i]===ch.id} onChange={()=>{setActiveUnit(prev=>({...prev,[i]:activeUnit[i]===ch.id?0:ch.id}));setActiveLesson(prev=>({...prev,[i]:0}));clearType(i);onPreview([]);}}/><span className="min-w-0 flex-1 truncate" title={ch.name}>{ch.name}</span></label>
    {activeUnit[i]===ch.id && <div className="pl-6 space-y-2 mt-2">
     {topics.filter(t=>t.chapter_id===ch.id).map(topic=><label key={topic.id} className="flex gap-2 items-center text-sm cursor-pointer"><input type="checkbox" checked={activeLesson[i]===topic.id} onChange={()=>{
      const next=activeLesson[i]===topic.id?0:topic.id;setActiveLesson(prev=>({...prev,[i]:next}));clearType(i);
      onPreview(next?pool.filter(q=>q.chapter_id===ch.id && (q as T & {topic_id?:number}).topic_id===next && block.needs.some(([type])=>type===q.type)):[]);
     }}/><span className="min-w-0 flex-1 truncate" title={topic.name}>{topic.name}</span></label>)}
     {!topics.some(t=>t.chapter_id===ch.id) && candidates[i].filter(candidate=>candidate.rows.some(q=>q.chapter_id===ch.id)).map((candidate,index)=><label key={candidate.key} className="flex gap-2 items-start text-sm cursor-pointer">
      <input type="checkbox" checked={activeLesson[i]===-(index+1) && choices[i]===candidate.key} onChange={()=>{
       const selected=activeLesson[i]===-(index+1) && choices[i]===candidate.key;setChoices(prev=>({...prev,[i]:selected?'':candidate.key}));setActiveLesson(prev=>({...prev,[i]:selected?0:-(index+1)}));clearType(i);
       onPreview(selected?[]:candidate.rows.filter(q=>q.chapter_id===ch.id));
      }}/><span className="min-w-0 flex-1 truncate" title={plainText(candidate.label)}>প্রশ্নসেট-{String(index+1).padStart(2,'0')}: {plainText(candidate.label)}</span>
     </label>)}
    </div>}
   </div>)}</div>
  </div>;
 })}</div>;
}
