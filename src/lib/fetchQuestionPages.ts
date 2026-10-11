export type QuestionPage<T> = { rows: T[]; count: number | null };

// Keep all matching questions available to client-side filters, with at most
// four requests in flight. Only the first request needs a total count.
export async function fetchQuestionPages<T>(
  fetchPage: (from: number, to: number, withCount: boolean) => Promise<QuestionPage<T>>,
  pageSize = 1000,
): Promise<T[]> {
  const first = await fetchPage(0, pageSize - 1, true);
  if (first.rows.length < pageSize) return first.rows;
  const pages: T[][] = [first.rows];
  if (first.count === null) {
    // Preserve completeness when the server does not return a count.
    for (let from = pageSize; ; from += pageSize) {
      const page = await fetchPage(from, from + pageSize - 1, false);
      pages.push(page.rows);
      if (page.rows.length < pageSize) break;
    }
  } else {
    const totalPages = Math.ceil(first.count / pageSize);
    let nextPage = 1;
    await Promise.all(Array.from({ length: Math.min(4, totalPages - 1) }, async () => {
      while (nextPage < totalPages) {
        const index = nextPage++;
        const from = index * pageSize;
        const page = await fetchPage(from, from + pageSize - 1, false);
        pages[index] = page.rows;
      }
    }));
  }
  return pages.flat();
}
