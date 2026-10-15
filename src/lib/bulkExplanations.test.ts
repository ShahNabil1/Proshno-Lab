import { describe, expect, it } from "vitest";
import { parseBulkExplanations } from "./bulkExplanations";

describe("bulk explanations", () => {
  it("accepts the supplied bold examples and Bengali IDs with multiline explanations", () => {
    expect(parseBulkExplanations("**405848- ব্যাখা: this is example 1 explain**\n**405849** **- ব্যাখা: this is example**").entries).toEqual([
      { id: 405848, explanation: "this is example 1 explain" }, { id: 405849, explanation: "this is example" },
    ]);
    expect(parseBulkExplanations("#৪০৫৮৪৮ — ব্যাখ্যা: প্রথম লাইন\nদ্বিতীয় লাইন\n\n405849 | explanation: $x+1$").entries).toEqual([
      { id: 405848, explanation: "প্রথম লাইন\nদ্বিতীয় লাইন" }, { id: 405849, explanation: "$x+1$" },
    ]);
  });
  it("rejects duplicate IDs, empty explanations, and unassigned text", () => {
    expect(parseBulkExplanations("405848 - one\n405848 - two").errors).toHaveLength(1);
    expect(parseBulkExplanations("405848 - ব্যাখ্যা:").errors).toHaveLength(1);
    expect(parseBulkExplanations("unassigned\n405848 - ok").errors).toHaveLength(1);
  });
});
