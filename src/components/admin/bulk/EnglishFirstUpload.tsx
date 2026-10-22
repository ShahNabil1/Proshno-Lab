import { englishUploadSections, englishPatternMarks } from '@/lib/englishFirstPattern';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import LatexRenderer from '@/components/LatexRenderer';
import AIExtract from './AIExtract';
import PasteGuide from './PasteGuide';
import { ParsedQuestion, QType, TYPE_LABELS, parsePastedText, parseExcelFile, downloadTemplate, toDbPayload, markBatchDuplicates } from '@/lib/bulkQuestions';
import { toast } from 'sonner';
import { downloadPassageTemplate, parsePassageExcel, parsePassagePaste, downloadMixedPassageTemplate, parseMixedPassagePaste, parseMixedPassageExcel } from '@/lib/englishPassageUpload';

export default function EnglishFirstUpload({ classId, subjectId, chapters, className = '' }: {classId: string; subjectId: string; chapters: {id:number;name:string}[]; className?:string}) {
  const sections = englishUploadSections(className);
  const marks = englishPatternMarks(className);
  const [section, setSection] = useState(0);
  const config = sections[section];
  const [chapter, setChapter] = useState('');
  const [lesson, setLesson] = useState('');
  const [topics, setTopics] = useState<{id:number;name:string}[]>([]);
  const [name, setName] = useState('');
  const [passage, setPassage] = useState('');
  const [type, setType] = useState<QType>('mcq');
  const [text, setText] = useState('');
  const [method, setMethod] = useState('paste');
  const [rows, setRows] = useState<ParsedQuestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(false);
  const [existing, setExisting] = useState(false);
  const [savedPassages, setSavedPassages] = useState<any[]>([]);
  const [chosen, setChosen] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [allTypes, setAllTypes] = useState(true);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const lessonRequired = !!config.lesson && (topicsLoading || topics.length > 0);
  useEffect(()=>{setExisting(false);setText('');},[section]);
  const unitChapters = chapters.filter(c => /^unit[\s-]/i.test(c.name) || (section === 0 && /^seen\s+(comprehension|passage)/i.test(c.name)) || (config.types.includes('poem_questions') && /poem/i.test(c.name)) || (config.types.includes('story_questions') && /questions?.*stor/i.test(c.name)));
  useEffect(() => {
    if (config.lesson) return;
    const target = chapters.find(c => config.chapterMatch?.test(c.name));
    setChapter(target ? String(target.id) : '');
  }, [section, chapters]);
  useEffect(() => {
    let active = true;
    setLesson(''); setTopics([]); setTopicsLoading(!!chapter);
    if (chapter) supabase.from('topics').select('id,name').eq('chapter_id',Number(chapter)).then(({data,error})=>{
      if (!active) return;
      if (error) { toast.error('Lesson পড়া যায়নি'); return; }
      setTopics(data || []); setTopicsLoading(false);
    });
    return () => { active = false; };
  }, [chapter]);
  useEffect(() => {
    setChosen(''); setName(''); setPassage(''); setSavedPassages([]);
    if (!config.passage || !chapter || (lessonRequired && !lesson)) return;
    let active = true;
    let query = supabase.from('questions').select('id,chapter_id,topic_id,question,stimulus_text,stimulus_group_id,creative_data').eq('class_id',Number(classId)).eq('subject_id',Number(subjectId)).in('type',config.passageTypes || []);
    if (section === 0) query = query.eq('chapter_id',Number(chapter));
    if (lesson) query = query.eq('topic_id',Number(lesson));
    query.then(({data,error})=>{ if (!active) return; if (error) toast.error('আগের Passage পড়া যায়নি'); else {const unique = new Map<string,any>(); (data || []).forEach(p=>{const key=(p.stimulus_text || p.question).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();if(!unique.has(key))unique.set(key,p);});setSavedPassages([...unique.values()]);} });
    return ()=>{active=false;};
  }, [chapter, lesson, lessonRequired, section, classId, subjectId, refresh]);
  const contextReady = !!chapter && (!lessonRequired || !!lesson);
  const ready = !!chapter && (!lessonRequired || !!lesson) && (!config.passage || (!!name.trim() && !!passage.trim()));
  function add(items: ParsedQuestion[]) { setRows(previous => markBatchDuplicates([...previous,...items])); setText(''); setReview(false); }
  function insertSample(sample: string) {
    const stimulus = parsePastedText(sample,type)[0]?.stimulus || 'সম্পূর্ণ Passage এখানে লিখুন';
    setText(config.passage && !existing ? `Passage Name: Sample passage\nPassage: ${stimulus}\n---\n${sample.replace(/^উদ্দীপক:[\s\S]*?(?=^প্রশ্ন:)/m,'')}` : sample);
  }
  function importPaste() {
    try {
      if (config.passage && allTypes) acceptImport(parseMixedPassagePaste(text,config.types,className));
      else if (config.passage&&!existing) acceptImport(parsePassagePaste(text,type));
      else add(parsePastedText(text,type));
    } catch(error:any) {toast.error(error.message);}
  }
  function acceptImport(result: {name:string;passage:string;rows:ParsedQuestion[]}) {
    if (config.passage && !existing) {
      const nextName = result.name || name, nextPassage = result.passage || passage;
      if (!nextName || !nextPassage) {toast.error('Passage Name ও Passage ইনপুটের মধ্যে দিন');return;}
      if (rows.length && ((result.passage && result.passage !== passage) || (result.name && result.name !== name))) {toast.error('এই তালিকায় একই Passage-এর প্রশ্ন যোগ করুন');return;}
      setName(nextName); setPassage(nextPassage);
    }
    if (!result.rows.length) {toast.error('কোনো প্রশ্ন পাওয়া যায়নি');return;}
    add(result.rows);
  }
  async function save() {
    if (!ready || !rows.length || rows.some(q=>q.errors.length || q.duplicate)) return;
    setBusy(true);
    try {
      const {data:{user}} = await supabase.auth.getUser(); if (!user) throw new Error('লগইন প্রয়োজন');
      const selectedPassage = savedPassages.find(p=>String(p.id)===chosen);
      const group = config.passage ? (existing ? selectedPassage?.stimulus_group_id || null : crypto.randomUUID()) : null;
      const ctx = {class_id:Number(classId),subject_id:Number(subjectId),chapter_id:existing && config.passage ? selectedPassage.chapter_id : Number(chapter),topic_id:existing && config.passage ? selectedPassage.topic_id : lesson ? Number(lesson) : null,teacher_id:user.id,stimulus_group_id:group};
      const payload = rows.map(q=>toDbPayload({...q,stimulus:config.passage ? passage : q.stimulus, creative_data:{...q.creative_data,marks:marks[q.type],passage_name:name}},ctx));
      if (config.passage && !existing) {
        const passageTypes = config.passageTypes || [];
        passageTypes.forEach(t=>payload.push(toDbPayload({tempId:crypto.randomUUID(),type:t as QType,question:passage,stimulus:passage,creative_data:{passage_name:name},errors:[]},ctx)));
      }
      // One database statement: a failed upload cannot leave half a passage set.
      const {error} = await supabase.from('questions').insert(payload); if (error) throw error;
      toast.success(`${rows.length}টি প্রশ্ন সংরক্ষিত হয়েছে`); setRows([]); setReview(false); setPassage(''); setName(''); setRefresh(v=>v+1);
    } catch(e:any) { toast.error(e.message || 'সংরক্ষণ হয়নি'); } finally {setBusy(false);}
  }
  return <div className="space-y-5">
    <div className="border rounded p-5 space-y-4 bg-white">
      <h2 className="font-bold">১ · অংশ ও Context</h2>
      <select aria-label="প্রশ্নপত্রের অংশ" className="border rounded p-2 w-full" value={section} disabled={busy} onChange={e=>{setSection(Number(e.target.value));setType(sections[Number(e.target.value)].types[0] as QType);setRows([]);setChapter('');setName('');setPassage('');setReview(false);}}>{sections.map((s,i)=><option key={s.name} value={i}>{s.name}</option>)}</select>
      <div className="grid sm:grid-cols-2 gap-3">
        {(config.lesson || !chapter) && <label>{config.lesson ? 'Unit *' : 'অধ্যায় *'}<select aria-label="Upload Unit" className="border rounded p-2 w-full" value={chapter} disabled={rows.length > 0 || busy} onChange={e=>setChapter(e.target.value)}><option value="">বাছাই করুন</option>{(config.lesson ? unitChapters : chapters).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
        {config.lesson && lessonRequired && <label>Lesson *<select aria-label="Upload Lesson" className="border rounded p-2 w-full" value={lesson} disabled={!chapter || rows.length > 0 || busy} onChange={e=>setLesson(e.target.value)}><option value="">বাছাই করুন</option>{topics.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
      </div>
      {config.passage && <div className="space-y-3"><div className="flex gap-2"><Button variant={!existing?'default':'outline'} disabled={rows.length>0} onClick={()=>{setExisting(false);setChosen('');setName('');setPassage('');}}>নতুন Passage</Button><Button variant={existing?'default':'outline'} disabled={rows.length>0} onClick={()=>{setExisting(true);setName('');setPassage('');}}>আগের Passage-এ প্রশ্ন যোগ করুন</Button></div>{existing && <><select aria-label="আগের Passage" className="border rounded p-2 w-full" value={chosen} disabled={!contextReady || rows.length>0} onChange={e=>{setChosen(e.target.value); const p=savedPassages.find(p=>String(p.id)===e.target.value);setName(p?.creative_data?.passage_name || (p?.question || '').replace(/<[^>]*>/g,' ').slice(0,80));setPassage(p?.stimulus_text || p?.question || '');setReview(false);}}><option value="">Passage বাছাই করুন</option>{savedPassages.map(p=><option key={p.id} value={p.id}>{p.creative_data?.passage_name || (p.question || '').replace(/<[^>]*>/g,' ').slice(0,80)}</option>)}</select>{contextReady && !savedPassages.length && <p className="text-sm text-muted-foreground">এই Context-এ আগে আপলোড করা Passage নেই।</p>}{passage && <div className="bg-blue-50 p-3"><strong>{name}</strong><LatexRenderer text={passage}/></div>}</>}</div>}
    </div>
    <div className="border rounded p-5 space-y-4 bg-white">
      <h2 className="font-bold">২ · প্রশ্ন যোগ করুন</h2>
      <div className="flex gap-2 flex-wrap">{config.passage && <Button variant={allTypes?'default':'outline'} onClick={()=>{setAllTypes(true);setText('');}}>সব ধরনের প্রশ্ন একসঙ্গে</Button>}{config.types.map(t=><Button key={t} variant={(!config.passage||!allTypes)&&type===t?'default':'outline'} onClick={()=>{setAllTypes(false);setType(t as QType);setText('');}}>{TYPE_LABELS[t as QType]}</Button>)}</div>
      <div className="flex gap-2">{['paste','excel','ai'].map(m=><Button key={m} variant={method===m?'default':'outline'} onClick={()=>setMethod(m)}>{m.toUpperCase()}</Button>)}</div>
      {method === 'paste' && <>{config.passage&&allTypes ? <pre className="text-sm bg-slate-50 p-3 whitespace-pre-wrap">{`${existing?'':'Passage Name: নাম\nPassage: সম্পূর্ণ Passage\n---\n'}${config.types.map(t=>`Type: ${t}\nপ্রশ্ন: ...${t==='mcq'?'\n(a) ...\n(b) ...\n(c) ...\n(d) ...':''}\nউত্তর: ...`).join('\n---\n')}`}</pre> : <><PasteGuide type={type} englishFirst onInsert={insertSample} />{config.passage && !existing && <pre className="text-sm bg-slate-50 p-3 whitespace-pre-wrap">{'Passage Name: নাম\nPassage: সম্পূর্ণ Passage\n---\nপ্রশ্ন: ...\nউত্তর: ...'}</pre>}</>}<Textarea placeholder="এই ধরনের প্রশ্নগুলো Paste করুন" rows={8} value={text} onChange={e=>setText(e.target.value)} /><Button disabled={!(existing?ready:contextReady) || !text.trim()} onClick={importPaste}>প্রশ্ন তালিকায় যোগ করুন</Button></>}
      {method === 'excel' && <><Button variant="outline" onClick={()=>config.passage ? allTypes ? downloadMixedPassageTemplate(config.types) : downloadPassageTemplate(type) : downloadTemplate(type,false,true)}>টেমপ্লেট ডাউনলোড</Button><input aria-label="প্রশ্নের Excel" type="file" accept=".xlsx,.xls,.csv" disabled={!(existing?ready:contextReady)} onChange={async e=>{const f=e.target.files?.[0];if(f)try{if(config.passage)acceptImport(allTypes?await parseMixedPassageExcel(f,config.types,className):await parsePassageExcel(f,type));else add(await parseExcelFile(f,type));}catch(error:any){toast.error(error.message || 'ফাইল পড়া যায়নি');}e.target.value='';}} /></>}
      {method === 'ai' && (existing?ready:contextReady) && <AIExtract key={type} type={type} onExtracted={items=>acceptImport({name:items[0]?.creative_data?.passage_name || items[0]?.stimulus?.slice(0,80) || '',passage:items[0]?.stimulus || '',rows:items})} />}
      {config.types.map(t=><span key={t} className="inline-block mr-3 text-sm">{TYPE_LABELS[t as QType]}: {rows.filter(q=>q.type===t).length}</span>)}
    </div>
    {rows.length > 0 && <div className="border rounded p-5 bg-white space-y-3">
      <h2 className="font-bold">৩ · প্রিভিউ ও সেভ</h2>
      {config.passage && <div className="bg-blue-50 p-3"><strong>{name}</strong><LatexRenderer text={passage} /></div>}
      {rows.map(q=><div key={q.tempId} className="border-b pb-3"><div className="flex justify-between"><strong>{TYPE_LABELS[q.type]}</strong><Button variant="ghost" onClick={()=>{setRows(prev=>prev.filter(r=>r.tempId!==q.tempId));setReview(false);}}>বাদ দিন</Button></div><LatexRenderer text={q.question} />{[q.option_a,q.option_b,q.option_c,q.option_d].filter(Boolean).map((o,i)=><p key={i}>{String.fromCharCode(97+i)}. {o}</p>)}{q.correct_answer && <p>উত্তর: {q.correct_answer}</p>}{(q.errors.length>0 || q.duplicate) && <p className="text-red-600">{q.errors.join(', ') || 'একই প্রশ্ন আবার আছে'}</p>}</div>)}
      <label className="flex gap-2"><input type="checkbox" checked={review} onChange={e=>setReview(e.target.checked)} />প্রিভিউ যাচাই করেছি</label>
      <Button disabled={!ready || !review || busy || rows.some(q=>q.errors.length || q.duplicate)} onClick={save}>{busy?'সংরক্ষণ হচ্ছে…':'সব প্রশ্ন একসঙ্গে সেভ করুন'}</Button>
    </div>}
  </div>;
}
