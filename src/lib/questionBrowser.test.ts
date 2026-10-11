import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
import { supabase } from "@/integrations/supabase/client";
import { fetchBrowserPage, mergePageWithSelection, type BrowserScope, type BrowserFilters } from "./questionBrowser";

const scope: BrowserScope = { classIds: [1], subjectIds: [2], chapterIds: [3], types: [], includeInactive: false };
const filters: BrowserFilters = { search: "", type: null, chapterIds: [], topicIds: [], untopicedChapterIds: [], boards: [], year: "", schools: [], schoolYear: "", special: null };
describe("session question page cache", () => {
  it("reuses loaded pages while separating accounts, pages and filters", async () => {
    const rpc = vi.mocked(supabase.rpc);
    rpc.mockResolvedValue({ data: { rows: [{ id: 7 }], total: 1 }, error: null } as never);
    const before = rpc.mock.calls.length;
    await fetchBrowserPage(scope, filters, 1, "cache-account-a");
    await fetchBrowserPage(scope, filters, 1, "cache-account-a");
    expect(rpc.mock.calls.length - before).toBe(1);
    await fetchBrowserPage(scope, filters, 2, "cache-account-a");
    await fetchBrowserPage(scope, { ...filters, search: "different" }, 1, "cache-account-a");
    await fetchBrowserPage(scope, filters, 1, "cache-account-b");
    expect(rpc.mock.calls.length - before).toBe(4);
  });
  it("does not cache failed requests", async () => {
    const rpc = vi.mocked(supabase.rpc);
    rpc.mockResolvedValueOnce({ data: null, error: new Error("offline") } as never);
    await expect(fetchBrowserPage(scope, filters, 1, "cache-retry")).rejects.toThrow("offline");
    rpc.mockResolvedValueOnce({ data: { rows: [], total: 0 }, error: null } as never);
    await expect(fetchBrowserPage(scope, filters, 1, "cache-retry")).resolves.toMatchObject({ total: 0 });
  });
});

describe("paged question selections", () => {
  it("retains selections across pages and discards unselected old rows", () => {
    expect(mergePageWithSelection([{id:1},{id:2}], [{id:3},{id:4}], new Set([1])))
      .toEqual([{id:1},{id:3},{id:4}]);
  });
  it("refreshes a selected row without duplication", () => {
    expect(mergePageWithSelection([{id:1,text:"old"}], [{id:1,text:"new"}], new Set([1])))
      .toEqual([{id:1,text:"new"}]);
  });
  it("retains selections outside the currently filtered page", () => {
    expect(mergePageWithSelection([{id:1},{id:2}], [], new Set([1,2])))
      .toEqual([{id:1},{id:2}]);
  });
});
