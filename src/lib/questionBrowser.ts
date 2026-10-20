import { supabase } from "@/integrations/supabase/client";

export type BrowserScope = {
  classIds: number[];
  subjectIds: number[];
  chapterIds: number[];
  types: string[];
  includeInactive: boolean;
};
export type BrowserFilters = {
  search: string; type: string | null; chapterIds: number[]; topicIds: number[];
  untopicedChapterIds: number[]; boards: string[]; year: string;
  schools: string[]; schoolYear: string; special: string | null;
};
export type BrowserPage<T> = {
  rows: T[]; total: number; types: Record<string, number>; filterTypes: Record<string, number>;
  chapters: Record<string, number>; topics: Record<string, number>;
  untopiced: Record<string, number>; topicChapters: Record<string, number>;
  schools: string[]; boardYears: string[]; schoolYears: string[];
};
export function mergePageWithSelection<T extends { id: number }>(
  cached: T[], page: T[], selectedIds: ReadonlySet<number>,
): T[] {
  return [...new Map([...cached.filter(q => selectedIds.has(q.id)), ...page].map(q => [q.id, q])).values()];
}
type CachedPage = { data: BrowserPage<unknown>; expiresAt: number };
const pageCache = new Map<string, CachedPage>();
const pendingPages = new Map<string, Promise<BrowserPage<unknown>>>();
const cachePrefix = "questionBrowserPage:v2:";
const cacheLifetimeMs = 30_000;
function pageCacheKey(scope: BrowserScope, filters: BrowserFilters, page: number, owner: string) {
  return cachePrefix + JSON.stringify([owner, scope, filters, page]);
}
export function getCachedBrowserPage<T>(scope: BrowserScope, filters: BrowserFilters, page: number, owner: string): BrowserPage<T> | null {
  const key = pageCacheKey(scope, filters, page, owner);
  let cached = pageCache.get(key);
  if (!cached) {
    try {
      const stored = sessionStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored) as CachedPage;
        if (Array.isArray(parsed.data?.rows) && typeof parsed.data?.total === "number" && typeof parsed.expiresAt === "number") cached = parsed;
      }
    } catch { /* Storage can be unavailable; memory caching still works. */ }
  }
  if (!cached || cached.expiresAt <= Date.now()) {
    pageCache.delete(key);
    try { sessionStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
    return null;
  }
  return cached.data as BrowserPage<T>;
}
export async function fetchBrowserPage<T>(scope: BrowserScope, filters: BrowserFilters, page: number, owner = ""): Promise<BrowserPage<T>> {
  // Cache only authenticated callers and keep each account's pages separate.
  if (!owner) return requestBrowserPage<T>(scope, filters, page);
  const key = pageCacheKey(scope, filters, page, owner);
  const cached = getCachedBrowserPage<T>(scope, filters, page, owner);
  if (cached) return cached;
  const pending = pendingPages.get(key);
  if (pending) return pending as Promise<BrowserPage<T>>;
  const request = requestBrowserPage<T>(scope, filters, page).then(result => {
    const entry = { data: result, expiresAt: Date.now() + cacheLifetimeMs };
    pageCache.set(key, entry);
    if (pageCache.size > 80) pageCache.delete(pageCache.keys().next().value!);
    try {
      const keys = Object.keys(sessionStorage).filter(item => item.startsWith(cachePrefix));
      if (keys.length >= 40) sessionStorage.removeItem(keys[0]);
      sessionStorage.setItem(key, JSON.stringify(entry));
    } catch { /* Quota failures do not affect question browsing. */ }
    return result;
  }).finally(() => pendingPages.delete(key));
  pendingPages.set(key, request);
  return request;
}
async function requestBrowserPage<T>(scope: BrowserScope, filters: BrowserFilters, page: number): Promise<BrowserPage<T>> {
  const { data, error } = await supabase.rpc("question_browser_page" as never, {
    _scope: scope, _filters: filters, _page: page,
  } as never);
  if (error) throw error;
  const result = data as unknown as BrowserPage<T>;
  if (!result || !Array.isArray(result.rows) || typeof result.total !== "number") {
    throw new Error("Invalid question browser response");
  }
  return result;
}

export async function fetchBrowserGroups<T>(scope: BrowserScope, groups: string[]): Promise<T[]> {
  let query = supabase.from("questions").select("*, chapters!inner(is_active)")
    .in("class_id", scope.classIds).in("subject_id", scope.subjectIds)
    .in("chapter_id", scope.chapterIds).in("stimulus_group_id", groups);
  if (!scope.includeInactive) query = query.eq("chapters.is_active", true);
  if (scope.types.length) query = query.in("type", scope.types);
  const { data, error } = await query.order("id", { ascending: false }).limit(201);
  if (error) throw error;
  return (data || []) as unknown as T[];
}
