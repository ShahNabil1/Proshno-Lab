import {describe,it,expect} from "vitest";
import {addToPaperForm} from "./addToPaperContext";
describe("add questions to an existing paper",()=>{
  it("restores exam details and replaces stale subject selections",()=>{
    const form=addToPaperForm({classId:"11",subjectId:"74",chapterIds:[3]},{programName:"অধ্যায়ভিত্তিক পরীক্ষা"},[{class_id:11,subject_id:74,chapter_id:3}]);
    expect(form).toEqual({classId:"11",subjectId:"74",subjectIds:["74"],chapterIds:["3"],type:"all",programName:"অধ্যায়ভিত্তিক পরীক্ষা"});
  });
  it("supports legacy papers with only question scope and no exam name",()=>{
    const form=addToPaperForm({}, {}, [{class_id:31,subject_id:126,chapter_id:6},{chapter_id:7}]);
    expect(form.programName).toBe("ক্লাস টেস্ট");
    expect(form.subjectIds).toEqual(["126"]);
    expect(form.chapterIds).toEqual(["6","7"]);
  });
});
