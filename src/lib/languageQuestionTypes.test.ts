import { describe, expect, it } from 'vitest';
import { allowedQuestionTypes, BASE_TYPES, patternGrade, suggestedLanguageTopics, questionMarks } from './languageQuestionTypes';
import { parseExcelFile, parsePastedText, toDbPayload } from './bulkQuestions';
import * as XLSX from 'xlsx';

describe('owner supplied class-specific language patterns',()=>{
  it.each(['ষষ্ঠ শ্রেণি','Class 6 (Eglish Version)','৬ষ্ঠ'])('recognizes %s',name=>expect(patternGrade(name)).toBe(6));
  it.each([6,7,8])('uses the same seen types for every lesson in class %s',grade=>{
    const expected=['seen_passage_1','mcq','answering_questions','seen_passage_2','gap_filling','vocabulary'];
    for(const chapter of ['Unit 1 - Culture','Unit 9 - Climate','Seen Comprehension','Lesson 24: Our wage earners']) expect(allowedQuestionTypes(`Class ${grade}`,'English 1st Paper',chapter)).toEqual(expected);
    expect(allowedQuestionTypes(`Class ${grade}`,'English 1st Paper','Unseen Comprehension')).toContain('true_false');
  });
  it('keeps 9–10 separate from 6–8',()=>{
    expect(allowedQuestionTypes('নবম-দশম শ্রেণি','English First Paper','Unit 16: Graffiti')).toEqual(['seen_passage','mcq','answering_questions','gap_filling']);
    expect(allowedQuestionTypes('Class 9-10','English 1st Paper','Unseen Comprehension')).not.toContain('true_false');
    expect(allowedQuestionTypes('Class 9-10','English 1st Paper','Answering Questions from Stories')).toEqual(['story_questions']);
  });
  it('scopes grammar types to the correct class',()=>{
    expect(allowedQuestionTypes('Class 6','English 2nd Paper')).toContain('parts_of_speech');
    expect(allowedQuestionTypes('Class 7','English 2nd Paper')).not.toContain('gap_filling');
    expect(allowedQuestionTypes('Class 7','English 2nd Paper','Passage Narration')).toEqual(['narration']);
    expect(suggestedLanguageTopics('Class 8','English 2nd Paper','Gap filling activities with/without clues')).toEqual(['With clues','Without clues']);
    expect(allowedQuestionTypes('Class 8','English 2nd Paper')).not.toContain('tag_questions');
    expect(allowedQuestionTypes('Class 9-10','English 2nd Paper')).toContain('tag_questions');
  });
  it('preserves Bangla 1st, other subjects and unconfigured grades',()=>{
    for(const grade of ['Class 6','Class 7','Class 8','Class 9-10']) expect(allowedQuestionTypes(grade,'বাংলা ১ম পত্র','নাটক বহিপীর')).toEqual(BASE_TYPES);
    expect(allowedQuestionTypes('Class 11','English 2nd Paper')).toEqual(BASE_TYPES);
    expect(allowedQuestionTypes('Class 8','গণিত')).toEqual(BASE_TYPES);
    expect(allowedQuestionTypes('Class 8','বাংলা ২য় পত্র','পরিচ্ছেদ ১: ভাষা')).toEqual(BASE_TYPES);
    expect(allowedQuestionTypes('Class 6','বাংলা ২য় পত্র','অনুধাবন দক্ষতা/অনুচ্ছেদ রচনা')).toEqual(['bangla_comprehension']);
    expect(allowedQuestionTypes('Class 9-10','বাংলা ২য় পত্র','অনুচ্ছেদ রচনা')).toEqual(['bangla_paragraph']);
  });
});
describe('language upload persistence',()=>{
  const ctx={class_id:6,subject_id:1,chapter_id:1,teacher_id:'teacher'};
  it('roundtrips a complete table, passage and answer with fractional marks',async()=>{
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
      ['উদ্দীপক','প্রশ্ন','উত্তর','ছবি URL','ব্যাখ্যা','বোর্ড রেফারেন্স','বিশ্ববিদ্যালয় রেফারেন্স','মোট নম্বর','টপিক'],
      ['<p>Passage</p>','<table><tr><td>(a) ___</td><td>(b) ___</td></tr></table>','a: word; b: word','','','','','২.৫','Lesson 3'],
    ]),'Questions');
    const buffer=XLSX.write(wb,{type:'array',bookType:'xlsx'});
    const parsed=await parseExcelFile({arrayBuffer:async()=>buffer} as File,'gap_filling');
    expect(parsed[0].errors).toEqual([]);expect(parsed[0].topicName).toBe('Lesson 3');
    const payload=toDbPayload(parsed[0],ctx);
    expect(payload.type).toBe('gap_filling');expect(payload.stimulus_text).toBe('<p>Passage</p>');
    expect(payload.question).toContain('<table>');expect(payload.explanation).toContain('a: word');expect(questionMarks(payload)).toBe(2.5);
  });
  it('parses language paste using the complete written question format',()=>{
    const parsed=parsePastedText('1. Question: Fill (a) ___ and (b) ___\nAnswer: a: one, b: two','gap_filling');
    expect(parsed).toHaveLength(1);expect(parsed[0].type).toBe('gap_filling');
    expect(parsed[0].question).toContain('(b)');expect(toDbPayload(parsed[0],ctx).creative_data).toEqual({marks:0});
  });
});
