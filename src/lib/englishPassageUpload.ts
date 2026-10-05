import * as XLSX from 'xlsx';
import { buildEnglishFirstMcqTemplate, buildLanguageTemplate, parseExcelFile, parsePastedText, QType } from './bulkQuestions';
const aliases: Record<string,QType> = {mcq:'mcq',q1:'mcq',q2:'answering_questions','answering questions':'answering_questions',answering_questions:'answering_questions',q3:'gap_filling','gap filling':'gap_filling',gap_filling:'gap_filling',q4:'vocabulary',vocabulary:'vocabulary',q5:'information_transfer','information transfer':'information_transfer',information_transfer:'information_transfer',q6:'true_false','true/false':'true_false',true_false:'true_false',q7:'writing_summary','writing summary':'writing_summary',writing_summary:'writing_summary'};
export function passageType(value: string, allowed: readonly string[]) {
  const type = aliases[value.trim().toLowerCase()];
  if (!type || !allowed.includes(type)) throw new Error(`প্রশ্নের ধরন সঠিক নয়: ${value}`);
  return type;
}

export function parseMixedPassagePaste(text: string, allowed: readonly string[]) {
  const markers = [...text.matchAll(/^Type\s*:\s*(.+)$/gim)];
  if (!markers.length) throw new Error('প্রতিটি ধরনের আগে Type: লিখুন');
  const context = parsePassagePaste(text.slice(0,markers[0].index),'mcq');
  const rows = markers.flatMap((marker,i)=>parsePastedText(text.slice(marker.index!+marker[0].length,markers[i+1]?.index).trim().replace(/\n---\s*$/,''),passageType(marker[1],allowed)));
  return {...context,rows};
}

export function downloadMixedPassageTemplate(allowed: readonly string[]) {
  const wb = XLSX.utils.book_new();
  const data = [['Type','Passage Name','Passage','Question','Option A','Option B','Option C','Option D','Answer','Explanation'],...allowed.map((type,i)=>[type,i===0?'Passage name':'',i===0?'Write the full passage here':'','Replace with your question',...(type==='mcq'?['Option A','Option B','Option C','Option D','a']:['','','','','Write answer']),''])];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(data),'Questions');
  wb.Sheets.Questions['!cols'] = data[0].map((_,i)=>({wch:i===2||i===3?65:25}));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['প্রথম সারিতে Passage Name ও Passage দিন।'],['প্রতি সারিতে Type দিন; নমুনা নিজের প্রশ্ন দিয়ে বদলান।'],['একই ধরনের একাধিক সারি বা শুধু একটি ধরনের প্রশ্নও দিতে পারবেন।'],['Gap Filling / Information Transfer-এর সম্পূর্ণ সেট Question ঘরে দিন।']]),'Instructions');
  XLSX.writeFile(wb,'all_types_passage_template.xlsx');
}

export async function parseMixedPassageExcel(file: File, allowed: readonly string[]) {
  const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()),{type:'array'});
  const data = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''});
  const header = (data[0] || []).map(v=>String(v).trim().toLowerCase());
  const cell = (row:any[],key:string)=>String(row[header.indexOf(key)] || '').trim();
  if (!header.includes('type') || !header.includes('question')) throw new Error('Type ও Question কলাম প্রয়োজন');
  const body = data.slice(1).filter(row=>row.some(v=>String(v).trim()));
  const names = body.map(row=>cell(row,'passage name')).filter(Boolean), passages=body.map(row=>cell(row,'passage')).filter(Boolean);
  if (new Set(names).size>1 || new Set(passages).size>1) throw new Error('একবারে একটি Passage-এর প্রশ্ন দিন');
  const rows = [];
  for (const row of body) {
    const type = passageType(cell(row,'type'),allowed);
    const question = cell(row,'question');
    const answer = cell(row,'answer'), explanation=cell(row,'explanation');
    const parsed = parsePastedText(`প্রশ্ন: ${question}\n${type==='mcq'?['a','b','c','d'].map(k=>`(${k}) ${cell(row,`option ${k}`)}`).join('\n')+'\n':''}উত্তর: ${answer}\nব্যাখ্যা: ${explanation}`,type);
    rows.push(...parsed);
  }
  return {name:names[0]||'',passage:passages[0]||'',rows};
}

export function parsePassagePaste(text: string, type: QType) {
  const nameMatch = text.match(/^(?:Passage Name|Passage Title|প্যাসেজের নাম)\s*:\s*(.+)$/im);
  const passageMatch = text.match(/^(?:Passage|প্যাসেজ|উদ্দীপক)\s*:\s*([\s\S]*?)(?=^(?:প্রশ্ন|Question)\s*:|^---\s*$|$(?![\s\S]))/im);
  const questionText = text.replace(/^(?:Passage Name|Passage Title|প্যাসেজের নাম)\s*:\s*.+\r?\n?/im, '').replace(passageMatch?.[0] || /$^/, '').replace(/^---\s*$/m, '').trim();
  return { name: nameMatch?.[1].trim() || '', passage: passageMatch?.[1].trim() || '', rows: parsePastedText(questionText, type) };
}

export function downloadPassageTemplate(type: QType) {
  const wb = type === 'mcq' ? buildEnglishFirstMcqTemplate() : buildLanguageTemplate(type, true);
  const sheetName = wb.SheetNames[0];
  const data = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[sheetName], {header:1, defval:''});
  data[0][0] = 'Passage';
  data.slice(2).forEach(row=>{row[0]='';});
  data.forEach((row, i) => row.unshift(i === 0 ? 'Passage Name' : i === 1 ? 'Reading books' : ''));
  wb.Sheets[sheetName] = XLSX.utils.aoa_to_sheet(data);
  wb.Sheets[sheetName]['!cols'] = data[0].map((_, i) => ({wch:i===1?65:30}));
  wb.Sheets.Instructions = XLSX.utils.aoa_to_sheet([['নির্দেশনা'],['প্রথম প্রশ্নের সারিতে Passage Name ও Passage একবার দিন; পরের সারিগুলো খালি রাখুন।'],['এক ফাইলে একটি Passage-এর প্রশ্ন দিন। আগের Passage বাছাই করলে দুটি কলাম খালি রাখতে পারবেন।']]);
  wb.Sheets.Instructions['!cols'] = [{wch:110}];
  XLSX.writeFile(wb, `${type}_passage_template.xlsx`);
}

export async function parsePassageExcel(file: File, type: QType) {
  const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), {type:'array'});
  const data = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], {header:1,defval:''});
  const nameColumn = (data[0] || []).findIndex(v => /^passage (name|title)$/i.test(String(v).trim()));
  const names = nameColumn >= 0 ? data.slice(1).map(row=>String(row[nameColumn] || '').trim()).filter(Boolean) : [];
  if (new Set(names).size > 1) throw new Error('একবারে একটি Passage-এর প্রশ্ন দিন');
  if (nameColumn >= 0) data.forEach(row=>row.splice(nameColumn,1));
  const clean = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(clean,XLSX.utils.aoa_to_sheet(data),'Questions');
  const rows = await parseExcelFile(new File([new Uint8Array(XLSX.write(clean,{type:'array',bookType:'xlsx'}))],file.name),type);
  const passages = data.slice(1).map(row=>String(row[0] || '').trim()).filter(Boolean);
  if (new Set(passages).size > 1) throw new Error('একবারে একটি Passage-এর প্রশ্ন দিন');
  return {name:names[0] || '', passage:passages[0] || '', rows};
}
