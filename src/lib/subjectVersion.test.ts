import { describe, expect, it } from "vitest";
import {
  filterSubjectsByVersion,
  getClassLevelKey,
  getRelatedVersionClassIds,
  getSubjectVersion,
  isSharedBanglaEnglishSubject,
} from "./subjectVersion";

const classes = [
  { id: 11, name: "নবম-দশম শ্রেণি" },
  { id: 29, name: "অষ্টম শ্রেণি" },
  { id: 31, name: "Class 9-10 (Eglish Version)" },
  { id: 32, name: "তৃতীয় শ্রেণি" },
];

const subjects = [
  { id: 71, class_id: 11, name: "বাংলা ১ম পত্র" },
  { id: 74, class_id: 11, name: "সাধারণ গণিত" },
  { id: 126, class_id: 31, name: "Mathematics" },
];

describe("subject version grouping", () => {
  it("matches Bangla and English labels for the same class level", () => {
    expect(getClassLevelKey(classes[0].name)).toBe("9-10");
    expect(getClassLevelKey(classes[2].name)).toBe("9-10");
    expect(getRelatedVersionClassIds(11, classes)).toEqual([11, 31]);
  });

  it("keeps unrelated class levels out of the version group", () => {
    expect(getRelatedVersionClassIds(29, classes)).toEqual([29]);
  });

  it("identifies and filters subjects using their owning class", () => {
    expect(getSubjectVersion(subjects[0], classes)).toBe("bangla");
    expect(getSubjectVersion(subjects[2], classes)).toBe("english");
    expect(filterSubjectsByVersion(subjects, classes, "bangla")).toHaveLength(2);
    expect(filterSubjectsByVersion(subjects, classes, "english")).toEqual([subjects[0], subjects[2]]);
    expect(filterSubjectsByVersion(subjects, classes, "all")).toEqual(subjects);
  });

  it("shares Bangla and English first and second paper subjects across versions for class 3-12", () => {
    expect(isSharedBanglaEnglishSubject(subjects[0], classes)).toBe(true);
    expect(isSharedBanglaEnglishSubject(subjects[1], classes)).toBe(false);
    expect(isSharedBanglaEnglishSubject(subjects[2], classes)).toBe(false);
    expect(isSharedBanglaEnglishSubject({ class_id: 31, name: "English 2nd Paper" }, classes)).toBe(true);
    expect(isSharedBanglaEnglishSubject({ class_id: 32, name: "বাংলা ২য় পত্র" }, classes)).toBe(true);
  });
});
