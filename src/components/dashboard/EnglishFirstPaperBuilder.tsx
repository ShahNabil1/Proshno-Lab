import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { BuilderQuestion, blockCandidates, englishBlocks, plainText } from '@/lib/englishFirstBuilder';
import { Info } from 'lucide-react';

export default function EnglishFirstPaperBuilder<T extends BuilderQuestion>({ initialQuestions, onPreview, chapters, topics, enabledBlocks }: { initialQuestions: T[]; enabledBlocks: number[]; onPreview: (rows: T[]) => void; chapters: { id: number; name: string }[]; topics: { id: number; name: string; chapter_id: number }[] }) {
  const [pool] = useState<T[]>(initialQuestions);
  const [choices, setChoices] = useState<Record<number, string>>({});
  const [activeType, setActiveType] = useState<Record<number, string>>({});
  const [activeLesson, setActiveLesson] = useState<Record<number, number>>({});
  const [activeUnit, setActiveUnit] = useState<Record<number, number>>({});
  function preview(i: number, rows: T[], type = activeType[i]) {
    onPreview(rows.filter(q => !type || q.type === type || q.type.includes('passage')));
  }
  const candidates = useMemo(() => englishBlocks.map(b => blockCandidates(pool, b)), [pool]);
  const chosen = candidates.map((list, i) => list.find(c => c.key === choices[i]));
  function sourceRows(i: number): T[] {
    if (i === 2) return chosen[i]?.rows || [];
    if (i < 2 || i === 5) {
      if (!activeLesson[i]) return [];
      if (activeLesson[i] < 0) return (chosen[i]?.rows || []).filter(q => q.chapter_id === activeUnit[i]);
      return pool.filter(q => q.chapter_id === activeUnit[i] && (q as T & { topic_id?: number }).topic_id === activeLesson[i] && englishBlocks[i].needs.some(([type]: readonly [string, number]) => q.type === type));
    }
    return chosen[i]?.rows || [];
  }
  function clearType(i: number) { setActiveType(prev => ({ ...prev, [i]: '' })); }
  return <div className="space-y-4">
    <>
      {englishBlocks.map((block, i) => !enabledBlocks.includes(i) ? null : i >= 3 && i !== 5 ? <div key={block.title} className="rounded border p-3 flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 min-w-0 cursor-pointer font-semibold">
          <input type="checkbox" className="shrink-0" checked={Boolean(activeType[i])} onChange={() => {
            const type = block.needs[0][0];
            const next = activeType[i] ? '' : type;
            setActiveType(prev => ({ ...prev, [i]: next }));
            onPreview(next ? pool.filter(q => q.type === type) : []);
          }} />
          <span className="truncate">{block.title.split(' · ')[0]} <span className="inline-block rounded bg-violet-100 px-1.5 text-lg font-bold text-violet-800">Q{i + 5}</span></span>
        </label>
        <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" aria-label="Explain" title="Explain" className="h-5 w-5 p-0 shrink-0"><Info className="h-3.5 w-3.5" /></Button></PopoverTrigger><PopoverContent className="w-64 text-sm space-y-2" align="end">
          <p className="font-semibold">{block.title.split(' · ')[0]} Q{i + 5}</p>
          <p>মডেল টেস্টের মানবণ্টন: {block.marks} নম্বর।</p>
          {i === 5 && <p>৮টি প্রশ্ন থেকে ৫টির উত্তর; প্রতিটির মান ২।</p>}
          <p>বাম পাশের তালিকা থেকে প্রয়োজনমতো প্রশ্ন নির্বাচন করুন।</p>
        </PopoverContent></Popover>
      </div> : <div key={block.title} className="rounded border p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 font-semibold">
          <span className="min-w-0 whitespace-nowrap text-sm">{i === 5 ? <>Poems <span className="inline-block rounded bg-violet-100 px-1.5 text-lg font-bold text-violet-800">Q10</span></> : block.title}{i < 3 && <span className="ml-2 inline-block rounded bg-violet-100 px-1 text-base font-bold text-violet-800">{['Q1 + Q2', 'Q3 + Q4', 'Q5 + Q6 + Q7'][i]}</span>}</span>
          {i < 3 || i === 5 ? <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" aria-label="Explain" title="Explain" className="h-5 w-5 p-0 shrink-0"><Info className="h-3.5 w-3.5" /></Button></PopoverTrigger><PopoverContent className="w-64 text-sm space-y-2" align="end">
            <p className="font-semibold">{block.title} — মানবণ্টন</p>
            {i === 0 && <><p>Q1: MCQ — ৭টি × ১ = ৭ নম্বর</p><p>Q2: Answering Questions — ৫টি × ২ = ১০ নম্বর</p></>}
            {i === 1 && <><p>Q3: Gap Filling — ৫টি শূন্যস্থান × ১ = ৫ নম্বর</p><p>Q4: Vocabulary — ৫টি × ১ = ৫ নম্বর</p></>}
            {i === 2 && <><p>Q5: Information Transfer — ৫টি × ১ = ৫ নম্বর</p><p>Q6: True/False — ৫টি × ১ = ৫ নম্বর</p><p>Q7: Writing Summary — ১০ নম্বর</p></>}
            {i === 5 && <p>Q10: Poems — ৮টি থেকে ৫টির উত্তর; ৫ × ২ = ১০ নম্বর। আগে Unit ও Lesson নির্বাচন করুন।</p>}
            <p className="font-semibold border-t pt-2">মোট: {block.marks} নম্বর</p>
          </PopoverContent></Popover> : <span className="shrink-0">{block.marks} নম্বর</span>}
        </div>
        <div className="border border-slate-400 rounded p-2 space-y-2">
          {block.needs.map(([type, count], j) => <label key={type} className="flex gap-2 items-center text-sm cursor-pointer">
            <input type="checkbox" name={`block-type-${i}`} disabled={(i < 3 || i === 5) && !sourceRows(i).length} checked={activeType[i] === type} onChange={() => { const next = activeType[i] === type ? '' : type; setActiveType(prev => ({ ...prev, [i]: next })); preview(i, sourceRows(i), next); }} />
            <span className="text-lg font-bold text-slate-800 shrink-0">Q{i < 3 ? [1, 3, 5][i] + j : i + 5}</span>
            <span>{({ mcq: 'MCQ', answering_questions: 'Answering Questions', gap_filling: 'Gap Filling', vocabulary: 'Vocabulary', information_transfer: 'Information Transfer', true_false: 'True/False', writing_summary: 'Writing Summary', poem_questions: 'Poems' } as Record<string, string>)[type] || type.replace(/_/g, ' ')}</span>
          </label>)}
        </div>
        <div className="space-y-2 pl-2">
          {i === 2 ? candidates[i].map((c, index) => <label key={c.key} className="flex gap-2 items-start text-sm cursor-pointer">
            <input type="checkbox" className="mt-1 shrink-0" checked={choices[i] === c.key} onChange={() => { const next = choices[i] === c.key ? '' : c.key; setChoices(prev => ({ ...prev, [i]: next })); clearType(i); onPreview(next ? c.rows : []); }} />
            <span className="min-w-0 flex-1 truncate" title={`Passage-${String(index + 1).padStart(2, '0')}: ${plainText(c.label).split(/[.!?]/)[0]}`}>Passage-{String(index + 1).padStart(2, '0')}: {plainText(c.label).split(/[.!?]/)[0]}</span>
          </label>) : chapters.filter(ch => pool.some(q => q.chapter_id === ch.id && block.needs.some(([type]: readonly [string, number]) => type === q.type))).map(ch => <div key={ch.id}>
            <label className="flex gap-2 items-start text-sm cursor-pointer"><input type="checkbox" className="mt-1 shrink-0" checked={activeUnit[i] === ch.id} onChange={() => { const next = activeUnit[i] === ch.id ? 0 : ch.id; setActiveUnit(prev => ({ ...prev, [i]: next })); setActiveLesson(prev => ({ ...prev, [i]: 0 })); clearType(i); onPreview([]); }} /><span className="min-w-0 flex-1 truncate" title={ch.name}>{ch.name}</span></label>
            {activeUnit[i] === ch.id && <div className="pl-6 space-y-2 mt-2">
              {topics.filter(t => t.chapter_id === ch.id).map(t => <label key={t.id} className="flex min-w-0 gap-2 items-center text-sm cursor-pointer"><input className="shrink-0" type="checkbox" checked={activeLesson[i] === t.id} onChange={() => { const next = activeLesson[i] === t.id ? 0 : t.id; setActiveLesson(prev => ({ ...prev, [i]: next })); if (i === 5) setActiveType(prev => ({ ...prev, [i]: next ? 'poem_questions' : '' })); else clearType(i); onPreview(next ? pool.filter(q => (q as T & { topic_id?: number }).topic_id === t.id && block.needs.some(([type]: readonly [string, number]) => type === q.type)) : []); }} /><span className="min-w-0 flex-1 truncate" title={t.name}>{t.name}</span></label>)}
              {((i >= 3 && i !== 5) || !topics.some(t => t.chapter_id === ch.id)) && candidates[i].filter(c => c.rows.some(q => q.chapter_id === ch.id)).map((c, index) => <label key={c.key} className="flex gap-2 items-start text-sm cursor-pointer"><input className="mt-1 shrink-0" type="checkbox" checked={i < 2 || i === 5 ? activeLesson[i] === -(index + 1) && choices[i] === c.key : choices[i] === c.key} onChange={() => { const selected = i < 2 || i === 5 ? activeLesson[i] === -(index + 1) && choices[i] === c.key : choices[i] === c.key; setChoices(prev => ({ ...prev, [i]: selected ? '' : c.key })); setActiveLesson(prev => ({ ...prev, [i]: selected ? 0 : -(index + 1) })); if (i === 5) setActiveType(prev => ({ ...prev, [i]: selected ? '' : 'poem_questions' })); else clearType(i); onPreview(selected ? [] : c.rows); }} /><span className="min-w-0 flex-1 truncate" title={plainText(c.label)}>{i < 2 || i === 5 ? `Lesson-${String(index + 1).padStart(2, '0')}: ${plainText(c.label).split(/[.!?]/)[0].slice(0, 60)}` : `${block.title.split(' ? ')[0]} ${index + 1}`}</span></label>)}
            </div>}
          </div>)}
        </div>
      </div>)}
    </>
  </div>;
}
