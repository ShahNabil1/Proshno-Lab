import type { SmartBoardQuestion } from "./QuestionSlide";

/** A CQ overview followed by one independent board per available sub-question. */
export function expandSmartboardQuestions(questions: SmartBoardQuestion[]): SmartBoardQuestion[] {
  let number = 0;
  let detailId = -1_000_000_000_000;
  return questions.flatMap(question => {
    if (question.type === "blank") return [question];
    const overview = { ...question, sourceQuestionNumber: ++number };
    if (question.type !== "cq") return [overview];
    const data = question.creative_data || {};
    const subs = Array.isArray(data.sub_questions) ? data.sub_questions : [];
    const details = ["q_ka", "q_kha", "q_ga", "q_gha"].flatMap((key, index) => {
      const text = subs.length ? subs[index]?.question || subs[index]?.text : data[key];
      return text ? [{ ...overview, id: detailId--, cqPartIndex: index }] : [];
    });
    return [overview, ...details];
  });
}
