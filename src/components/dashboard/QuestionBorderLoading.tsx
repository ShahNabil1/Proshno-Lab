import { useEffect, useRef, useState, type CSSProperties } from "react";

export default function QuestionBorderLoading({ ready, failed }: { ready: boolean; failed: boolean }) {
  const [progress, setProgress] = useState(0);
  const position = useRef(0);
  useEffect(() => {
    if (failed) return;
    const started = performance.now();
    const initial = position.current;
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = now - started;
      // Response completion drives the final lap. While waiting, slow down
      // before the starting corner instead of restarting or claiming completion.
      const next = ready
        ? initial + (100 - initial) * Math.min(1, elapsed / 650)
        : initial + (Math.max(92, initial) - initial) * (1 - Math.exp(-elapsed / 2400));
      position.current = next;
      setProgress(next);
      if (next < 100) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready, failed]);
  return <div className={`question-paper-reference-border${progress >= 100 ? " is-complete" : ""}`} aria-hidden="true"
    style={{ "--question-border-angle": `${progress * 3.6}deg` } as CSSProperties} />;
}
