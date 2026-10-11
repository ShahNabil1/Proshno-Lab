import { describe, expect, it } from "vitest";
import { fetchQuestionPages } from "./fetchQuestionPages";

describe("fetchQuestionPages", () => {
  it("fetches a small subject in one request", async () => {
    let calls = 0;
    const rows = await fetchQuestionPages(async () => {
      calls++;
      return { rows: [1, 2], count: 2 };
    }, 3);
    expect(rows).toEqual([1, 2]);
    expect(calls).toBe(1);
  });

  it("keeps every row in order while limiting concurrent requests", async () => {
    const source = Array.from({ length: 23 }, (_, i) => i);
    let active = 0;
    let peak = 0;
    const counted: boolean[] = [];
    const rows = await fetchQuestionPages(async (from, to, withCount) => {
      counted.push(withCount);
      active++;
      peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, from === 3 ? 15 : 1));
      active--;
      return { rows: source.slice(from, to + 1), count: withCount ? source.length : null };
    }, 3);
    expect(rows).toEqual(source);
    expect(peak).toBe(4);
    expect(counted.filter(Boolean)).toHaveLength(1);
    expect(counted).toHaveLength(8);
  });

  it("loads all rows when counts are unavailable", async () => {
    const source = [1, 2, 3, 4, 5, 6];
    const rows = await fetchQuestionPages(async (from, to) => ({
      rows: source.slice(from, to + 1), count: null,
    }), 3);
    expect(rows).toEqual(source);
  });

  it("rejects failed pages instead of returning an incomplete subject", async () => {
    await expect(fetchQuestionPages(async (from) => {
      if (from === 3) throw new Error("network failure");
      return { rows: [1, 2, 3], count: 9 };
    }, 3)).rejects.toThrow("network failure");
  });
});
