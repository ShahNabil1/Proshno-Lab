import { describe, it, expect } from "vitest";
import { parsePastedText, toDbPayload, buildLanguageTemplate, buildEnglishFirstMcqTemplate, parseExcelFile } from "./bulkQuestions";
import { ENGLISH_FIRST_VARIANTS, ENGLISH_FIRST_MCQ } from './englishFirstTemplates';
import * as XLSX from "xlsx";
import { LANGUAGE_PASTE_VARIANTS } from "./languagePasteGuides";

describe("language question sets", () => {
  for(const [type,variants] of Object.entries(ENGLISH_FIRST_VARIANTS)) it(`English first ${type} Excel preserves passage, question and answer`,async()=>{
    const bytes=XLSX.write(buildLanguageTemplate(type,true),{type:'array',bookType:'xlsx'});
    const questions=await parseExcelFile({arrayBuffer:async()=>bytes} as File,type);
    expect(questions).toHaveLength(variants.length);
    questions.forEach((q,i)=>{
      const expected=parsePastedText(variants[i].sample,type)[0];
      expect(q.errors).toEqual([]);
      expect(q.question).toEqual(expected.question);
      expect(q.stimulus).toEqual(expected.stimulus);
      expect(q.explanation).toEqual(expected.explanation);
      expect(q.topicName).toBeUndefined();
    });
  });
  it('English first MCQ Excel keeps the passage and four options',async()=>{
    const bytes=XLSX.write(buildEnglishFirstMcqTemplate(),{type:'array',bookType:'xlsx'});
    const [q]=await parseExcelFile({arrayBuffer:async()=>bytes} as File,'mcq');
    const expected=parsePastedText(ENGLISH_FIRST_MCQ,'mcq')[0];
    expect(q.errors).toEqual([]);
    expect(q.stimulus).toEqual(expected.stimulus);
    expect(q.correct_answer).toBe('b');
    expect(q.option_d).toBe('Tuesday');
  });
  it("keeps explanations and multiple board/school reference lines in the saved payload", () => {
    const [q] = parsePastedText('প্রশ্ন: Fill gaps\n(a) _____\nউত্তর: (a) is\nব্যাখ্যা: Singular subject.\nUse a singular verb.\nবোর্ড: ঢাকা-২০২৩\nবোর্ড: যশোর-২০২২\nSchool: Example School-2024\nস্কুল: Sample School-2025', 'gap_filling');
    expect(q.explanation).toContain('Singular subject.<br/>Use a singular verb.');
    expect(q.question).not.toContain('School:');
    expect(q.boardRefs).toEqual([{board:'ঢাকা',year:'২০২৩'},{board:'যশোর',year:'২০২২'},{board:'Example School',year:'2024'},{board:'Sample School',year:'2025'}]);
    const saved = toDbPayload(q,{class_id:8,subject_id:1,chapter_id:1,teacher_id:'test'});
    expect(saved.board_references).toEqual(q.boardRefs);
    expect(saved.explanation).toEqual(q.explanation);
  });
  for (const [type,variants] of Object.entries(LANGUAGE_PASTE_VARIANTS)) {
    it(`${type} Excel template round-trips all examples, marks and topics`, async () => {
      const wb = buildLanguageTemplate(type);
      const bytes = XLSX.write(wb,{type:"array",bookType:"xlsx"});
      const questions = await parseExcelFile({arrayBuffer:async()=>bytes} as File,type);
      expect(questions).toHaveLength(variants.length);
      questions.forEach((question,i)=>{
        const expected = parsePastedText(variants[i].sample,type)[0];
        expect(question.errors).toEqual([]);
        expect(question.question).toEqual(expected.question);
        expect(question.explanation).toEqual(expected.explanation);
        expect(question.creative_data.marks).toBe(0);
      });
      if(type==='gap_filling') expect(questions.map(q=>q.topicName)).toEqual(['With clues','Without clues']);
      if(type==='substitution_table') expect(questions[0].question).toContain('<table');
      expect(wb.SheetNames).toEqual(['Questions','Instructions']);
    });
  }
  it("accepts the reference answer heading and composition section headings", () => {
    const [q] = parsePastedText('প্রশ্ন: Wonders of Science\nAns:\nWonders of Science\nIntroduction:\nScience helps us.\n\nElectricity:\nIt powers our homes.\nConclusion:\nWe should use science well.', 'short_composition');
    expect(q.explanation).toContain('Introduction:');
    expect(q.explanation).toContain('Electricity:');
    expect(q.explanation).toContain('Conclusion:');
    expect(q.explanation).toContain('We should use science well.');
  });
  it("keeps the reference inline answer format through ten blanks", () => {
    const labels = 'abcdefghij'.split('');
    const answer = labels.map((label,i)=>`(${label}) word${i}`).join(' ');
    const [q] = parsePastedText(`প্রশ্ন: Fill in the gaps.\n${labels.map(label=>`(${label}) _____`).join(' ')}\nAns: ${answer}`, 'gap_filling');
    expect(q.explanation).toBe(answer);
    expect(q.question).toContain('(j) _____');
  });
  for (const [type, variants] of Object.entries(LANGUAGE_PASTE_VARIANTS)) {
    for (const variant of variants) it(`${type}: ${variant.id} keeps a complete question and answer`, () => {
      const parsed = parsePastedText(variant.sample, type);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].errors).toEqual([]);
      const [question, answer] = variant.sample.split("উত্তর:");
      expect(parsed[0].explanation).toContain(answer.trim().split("\n").at(-1));
      for (const label of question.match(/\([a-j]\)/g) || []) expect(parsed[0].question).toContain(label);
      expect(toDbPayload(parsed[0], {class_id:8,subject_id:1,chapter_id:1,teacher_id:"test"}).explanation).toEqual(parsed[0].explanation);
    });
  }
  it("keeps blank paragraphs and numeric answer lists, splits only explicit sets", () => {
    const parsed = parsePastedText("প্রশ্ন: First set\n(a) One\n(f) Six\n(j) Ten\n\nAnother paragraph\nউত্তর:\n1. First\n2. Second\n\nLast paragraph\n---\nপ্রশ্ন: Second set\nউত্তর: Done", "changing_sentences");
    expect(parsed).toHaveLength(2);
    expect(parsed[0].question).toContain("(j) Ten");
    expect(parsed[0].question).toContain("<br/><br/>Another paragraph");
    expect(parsed[0].explanation).toContain("2. Second");
    expect(parsed[0].explanation).toContain("Last paragraph");
  });
  it("preserves tab-separated table cells including empty cells", () => {
    const [q] = parsePastedText("প্রশ্ন: Make sentences\nWe\tare\tstudents\nThey\t\tlearn daily\nউত্তর: We are students.", "substitution_table");
    expect(q.question).toContain("<td>We</td><td>are</td><td>students</td>");
    expect(q.question).toContain("<td>They</td><td></td><td>learn daily</td>");
  });
  it("preserves existing HTML table spans", () => {
    const table = '<table><tr><td rowspan="2">We</td><td>learn</td></tr><tr><td>read</td></tr></table>';
    const [q] = parsePastedText(`প্রশ্ন: Make sentences\n${table}\nউত্তর: We learn.`, "substitution_table");
    expect(q.question).toContain(table);
  });
  it("collects separate labelled answers through j", () => {
    const [q] = parsePastedText("প্রশ্ন: Fill gaps\nউত্তর a: one\nউত্তর b: two\nউত্তর j: ten", "gap_filling");
    expect(q.explanation).toContain("a: one");
    expect(q.explanation).toContain("b: two");
    expect(q.explanation).toContain("j: ten");
  });
});
