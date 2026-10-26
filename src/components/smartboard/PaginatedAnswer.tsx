import { useEffect, useRef, useState, type ReactNode } from 'react';
import { answerSlices, type AnswerSlice } from './answerPagination';

export default function PaginatedAnswer({ children, resetKey, onPageChange }: { children: ReactNode; resetKey: string; onPageChange?: (index: number) => void }) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [slices, setSlices] = useState<AnswerSlice[]>([{ start: 0, end: 0 }]);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const area = viewport.current;
    const body = content.current;
    if (!area || !body) return;
    let disposed = false;
    setIndex(0);
    const measure = () => { if (!disposed) setSlices(answerSlices(body, area.clientHeight)); };
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(area);
    observer?.observe(body);
    body.addEventListener('load', measure, true);
    document.fonts?.ready.then(measure);
    measure();
    return () => { disposed = true; observer?.disconnect(); body.removeEventListener('load', measure, true); };
  }, [resetKey]);
  const current = Math.min(index, slices.length - 1);
  const slice = slices[current];
  useEffect(() => { onPageChange?.(current); }, [current, onPageChange]);
  return <div className="flex min-h-0 flex-1 flex-col gap-3">
    <div className="flex shrink-0 items-center justify-between gap-4" style={{ fontSize: 26 }}>
      <span data-answer-page-label>সমাধান {current + 1} / {slices.length}{current ? ' — পরবর্তী অংশ' : ''}</span>
      <div data-answer-controls className="pointer-events-auto flex gap-3">
        <button type="button" aria-label="সমাধানের আগের অংশ" disabled={current === 0} onClick={() => setIndex(current - 1)} className="rounded border px-3 disabled:opacity-30">←</button>
        <button type="button" aria-label="সমাধানের পরের অংশ" disabled={current >= slices.length - 1} onClick={() => setIndex(current + 1)} className="rounded border px-3 disabled:opacity-30">→</button>
      </div>
    </div>
    <div ref={viewport} data-answer-viewport className="relative min-h-0 flex-1 overflow-hidden" onPointerDown={event => event.stopPropagation()}>
      <div data-answer-window style={{ overflow: 'hidden', height: slice.end > 0 ? slice.end - slice.start : '100%' }}>
        <div ref={content} data-answer-content style={{ transform: `translateY(-${slice.start}px)` }}>{children}</div>
      </div>
    </div>
  </div>;
}
