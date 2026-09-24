import { describe,it,expect } from "vitest";
import * as XLSX from "xlsx";
import { parseExcelFile, toDbPayload, parseRefCell } from "@/lib/bulkQuestions";
const mk=(rows:any[][])=>{const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),"Q");const b=XLSX.write(wb,{type:"array",bookType:"xlsx"});return {arrayBuffer:async()=>b} as any as File;};
describe("bulk",()=>{
 it("math cq",async()=>{
  const f=mk([["উদ্দীপক*","প্রশ্ন ক (জ্ঞান, ২)*","উত্তর ক","প্রশ্ন খ (অনুধাবন, ৪)*","উত্তর খ","প্রশ্ন গ (প্রয়োগ, ৪)*","উত্তর গ","ছবি URL","ব্যাখ্যা","বোর্ড রেফারেন্স","বিশ্ববিদ্যালয় রেফারেন্স"],["stem","ka","aka","kha","akha","ga","aga","","expl","ঢাকা-২০২৩, যশোর ২০২২","ঢাবি-২০২১"]]);
  const [q]=await parseExcelFile(f,"cq",true);
  expect(q.errors).toEqual([]);
  expect(q.creative_data.is_math).toBe(true);
  const p=toDbPayload(q,{class_id:1,subject_id:1,chapter_id:1,teacher_id:"t"});
  expect(p.explanation).toBe("expl");
  expect(p.board_references).toEqual([{board:"ঢাকা",year:"২০২৩"},{board:"যশোর",year:"২০২২"}]);
  expect(p.university_references).toEqual([{name:"ঢাবি",year:"২০২১"}]);
 });
 it("old cq template still works",async()=>{
  const f=mk([["উদ্দীপক*","প্রশ্ন ক (জ্ঞান)*","উত্তর ক","প্রশ্ন খ (অনুধাবন)*","উত্তর খ","প্রশ্ন গ (প্রয়োগ)*","উত্তর গ","প্রশ্ন ঘ (উচ্চতর)","উত্তর ঘ","ছবি URL"],["stem","ka","aka","kha","akha","ga","aga","gha","agha",""]]);
  const [q]=await parseExcelFile(f,"cq",false);
  expect(q.errors).toEqual([]);
  expect(q.creative_data.q_gha).toBe("gha");
 });
 it("reads an optional topic column without shifting question fields",async()=>{
  const f=mk([["Topic","উদ্দীপক (optional)","প্রশ্ন*","অপশন ক*","অপশন খ*","অপশন গ*","অপশন ঘ*","সঠিক উত্তর* (a/b/c/d)"],["বীজগণিত","","২+২ কত?","১","২","৩","৪","d"]]);
  const [q]=await parseExcelFile(f,"mcq");
  expect(q.topicName).toBe("বীজগণিত");
  expect(q.question).toBe("২+২ কত?");
  expect(q.option_d).toBe("৪");
  expect(q.correct_answer).toBe("d");
  expect(q.errors).toEqual([]);
 });
 it("short refs",async()=>{
  const f=mk([["উদ্দীপক","প্রশ্ন*","উত্তর","ছবি URL","ব্যাখ্যা","বোর্ড","ইউনি"],["","প্রশ্ন","ans","","exp","ঢাকা-২০২৩",""]]);
  const [q]=await parseExcelFile(f,"short");
  const p=toDbPayload(q,{class_id:1,subject_id:1,chapter_id:1,teacher_id:"t"});
  expect(p.explanation).toBe("ans\nexp");
  expect(p.board_references.length).toBe(1);
 });
 it("normalizes imported HTML spacing and keeps image URLs",async()=>{
  const imageUrl="https://res.cloudinary.com/demo/image/upload/sample.webp";
  const f=mk([["উদ্দীপক","প্রশ্ন*","উত্তর","ছবি URL"],["","&nbsp;চিত্রটি দেখ।<br>\n","answer",imageUrl]]);
  const [q]=await parseExcelFile(f,"short");
  expect(q.question).toBe("চিত্রটি দেখ।");
  expect(q.stimulus).toContain(`<img src="${imageUrl}"`);
 });
 it("ref parse",()=>{expect(parseRefCell("ঢাকা : ২০২৩")).toEqual([{name:"ঢাকা",year:"২০২৩"}]);});
});
