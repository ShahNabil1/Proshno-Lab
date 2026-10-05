import { describe, expect, it, vi } from 'vitest';
import { File } from 'node:buffer';
import * as XLSX from 'xlsx';
import { parsePassagePaste, parsePassageExcel, parseMixedPassagePaste, parseMixedPassageExcel } from './englishPassageUpload';

describe('passage upload', () => {
  it('imports mixed types and rejects types from another passage section', () => {
    const result=parseMixedPassagePaste('Passage Name: Library\nPassage: Rina reads.\n---\nType: mcq\nপ্রশ্ন: Who reads?\n(a) Rina\n(b) Mina\n(c) Karim\n(d) Rahim\nউত্তর: a\n---\nType: Q2\nপ্রশ্ন: What does Rina do?\nউত্তর: Reads.', ['mcq','answering_questions']);
    expect(result.passage).toBe('Rina reads.');
    expect(result.rows.map(q=>q.type)).toEqual(['mcq','answering_questions']);
    expect(()=>parseMixedPassagePaste('Type: Q6\nপ্রশ্ন: True?', ['mcq'])).toThrow();
  });
  it('imports different Excel question types with a single shared passage', async () => {
    vi.stubGlobal('File',File);
    try {
      const wb=XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
        ['Type','Passage Name','Passage','Question','Option A','Option B','Option C','Option D','Answer','Explanation'],
        ['mcq','Library','Rina reads.','Who?','Rina','Mina','Karim','Rahim','a',''],
        ['answering_questions','','','What does Rina do?','','','','','Reads.',''],
      ]),'Questions');
      const result=await parseMixedPassageExcel(new File([new Uint8Array(XLSX.write(wb,{type:'array',bookType:'xlsx'}))],'mixed.xlsx') as any,['mcq','answering_questions']);
      expect(result.name).toBe('Library');
      expect(result.rows.map(q=>q.type)).toEqual(['mcq','answering_questions']);
      expect(result.rows.every(q=>!q.errors.length)).toBe(true);
    } finally {vi.unstubAllGlobals();}
  });
  it('separates a multiline passage from the MCQ and answer', () => {
    const result = parsePassagePaste('Passage Name: Library\nPassage: Rina reads books.\nShe visits on Friday.\n---\nপ্রশ্ন: When does she visit?\n(a) Friday\n(b) Monday\n(c) Sunday\n(d) Tuesday\nউত্তর: a','mcq');
    expect(result.name).toBe('Library');
    expect(result.passage).toBe('Rina reads books.\nShe visits on Friday.');
    expect(result.rows[0].question).toBe('When does she visit?');
    expect(result.rows[0].correct_answer).toBe('a');
    expect(result.rows[0].errors).toEqual([]);
  });
  it('accepts subsequent questions without repeating passage metadata', () => {
    const result = parsePassagePaste('প্রশ্ন: Where does she read?\nউত্তর: Library','answering_questions');
    expect(result.name).toBe('');
    expect(result.passage).toBe('');
    expect(result.rows[0].question).toBe('Where does she read?');
  });
  it('reads passage columns once and keeps question columns aligned', async () => {
    vi.stubGlobal('File',File);
    try {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
        ['Passage Name','Passage','প্রশ্ন','a','b','c','d','উত্তর'],
        ['Library','Rina reads books.','Where?','Library','Home','School','Market','a'],
        ['','','Who?','Rina','Mina','Karim','Rahim','a'],
      ]),'Questions');
      const result = await parsePassageExcel(new File([new Uint8Array(XLSX.write(wb,{type:'array',bookType:'xlsx'}))],'test.xlsx') as any,'mcq');
      expect(result.name).toBe('Library');
      expect(result.passage).toBe('Rina reads books.');
      expect(result.rows.map(q=>q.question)).toEqual(['Where?','Who?']);
      expect(result.rows.map(q=>q.option_a)).toEqual(['Library','Rina']);
    } finally {vi.unstubAllGlobals();}
  });
});
