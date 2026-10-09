import { describe, it, expect, vi } from "vitest";
import { selectUniqueQuestions } from "./selectUniqueQuestions";
const row = (id: number, text: string) => ({ id, type: "mcq", question: text });
describe("automatic unique selection", () => {
  it("fills 50 from replacement batches instead of shrinking after removing duplicates", async () => {
    const rows = Array.from({ length: 120 }, (_, i) => row(i + 1, `Find x when x = ${Math.floor(i / 2)}`));
    const fetch = vi.fn(async (ids: number[]) => rows.filter(q => ids.includes(q.id)).reverse());
    const selected = await selectUniqueQuestions(rows.map(q => q.id), 50, fetch);
    expect(selected).toHaveLength(50);
    expect(new Set(selected.map(q => q.question)).size).toBe(50);
    expect(selected[0].id).toBe(1);
    expect(fetch.mock.calls.length).toBeGreaterThan(1);
  });
  it("exhausts the pool and reports the actual unique count without repeating", async () => {
    const rows = [row(1, "x = 1"), row(2, "<b>x = 1</b>"), row(3, "x = 2")];
    expect(await selectUniqueQuestions([1, 2, 3, 1], 50, async ids => rows.filter(q => ids.includes(q.id)))).toHaveLength(2);
  });
  it("propagates failures instead of silently creating a short paper", async () => {
    await expect(selectUniqueQuestions([1], 1, async () => { throw new Error("offline"); })).rejects.toThrow("offline");
  });
});
