import { beforeEach, describe, expect, it, vi } from 'vitest';
const fake=vi.hoisted(()=>({existing:null as null|{id:number},insert:vi.fn(),lookupError:null as any}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:()=>({
  select:()=>({eq:()=>({eq:()=>({limit:()=>({maybeSingle:async()=>({data:fake.existing,error:fake.lookupError})})})})}),
  insert:fake.insert,
})}}));
import { patternChapters, missingPatternChapters, ensurePatternChapter } from './languagePatternChapters';
import { allowedQuestionTypes, BASE_TYPES } from './languageQuestionTypes';

describe('PDF chapter suggestions and retry-safe creation',()=>{
  beforeEach(()=>{fake.existing=null;fake.lookupError=null;fake.insert.mockReset();});
  it('every PDF chapter resolves to its class-specific language pattern',()=>{
    for(const grade of [6,7,8,9]) for(const subject of ['English 1st Paper','English 2nd Paper','বাংলা ২য় পত্র']) {
      const cls=`Class ${grade===9?'9-10':grade}`;
      for(const name of patternChapters(cls,subject)) expect(allowedQuestionTypes(cls,subject,name),`${cls} / ${subject} / ${name}`).not.toEqual(BASE_TYPES);
    }
  });
  it('never suggests changes for Bangla first paper or other classes',()=>{
    expect(patternChapters('Class 8','বাংলা ১ম পত্র')).toEqual([]);
    expect(patternChapters('Class 11','English 1st Paper')).toEqual([]);
  });
  it('does not suggest a duplicate with punctuation differences',()=>{
    expect(missingPatternChapters('Class 8','English 1st Paper',[{name:'Unit-01: A Glimpse of Our Culture'}])).not.toContain('Unit 1: A Glimpse of Our Culture');
  });
  it('reuses selected and previously created chapters without inserting again',async()=>{
    expect(await ensurePatternChapter('17',2)).toBe(17);
    fake.existing={id:22};expect(await ensurePatternChapter('pattern:Matching',2)).toBe(22);
    expect(fake.insert).not.toHaveBeenCalled();
  });
  it('creates a missing chapter under the selected subject only',async()=>{
    fake.insert.mockReturnValue({select:()=>({single:async()=>({data:{id:23},error:null})})});
    expect(await ensurePatternChapter('pattern:Matching',2)).toBe(23);
    expect(fake.insert).toHaveBeenCalledWith({name:'Matching',subject_id:2,is_active:true});
  });
  it('surfaces permission or lookup errors before inserting',async()=>{
    fake.lookupError=new Error('Permission denied');
    await expect(ensurePatternChapter('pattern:Matching',2)).rejects.toThrow('Permission denied');
    expect(fake.insert).not.toHaveBeenCalled();
  });
});
