import { it, expect } from "vitest";
import { preparePayg } from "../../supabase/functions/_shared/payg";
function database() {
  const questions = [{ id: 1, type: "mcq", question: "x = 1" }, { id: 2, type: "mcq", question: "<b>x = 1</b>" }, { id: 3, type: "mcq", question: "x = 2" }];
  return { from(table: string) {
    let selected = "", ids: number[] | null = null;
    const query = {
      select(value: string) { selected = value; return query; },
      in(key: string, value: number[]) { if (key === "id") ids = value; return query; },
      eq() { return query; }, order() { return query; },
      range() { return Promise.resolve({ data: questions.map(q => ({ id: q.id })), error: null }); },
      then(resolve: (value: any) => any) {
        const data = table === "questions" ? questions.filter(q => !ids || ids.includes(q.id))
          : table === "chapters" ? [{ id: 1, name: "Chapter", subject_id: 1 }]
          : table === "subjects" ? [{ id: 1, name: "Math", class_id: 1 }]
          : [{ id: 1, name: "Class" }];
        return Promise.resolve({ data, error: null }).then(resolve);
      }
    };
    return query;
  } };
}
it("reserves the full unique count before payment", async () => {
  const order = await preparePayg(database(), { chapter_ids: [1], counts: { mcq: 2 } });
  expect(order.question_ids).toHaveLength(2);
  expect(order.question_ids).toContain(3);
  expect(order.price).toBe(0.5);
});
it("blocks payment reservation when there are too few unique questions", async () => {
  await expect(preparePayg(database(), { chapter_ids: [1], counts: { mcq: 3 } })).rejects.toThrow("Not enough unique");
});
