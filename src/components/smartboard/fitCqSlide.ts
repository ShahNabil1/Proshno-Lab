/** Fit CQ/MCQ content into its allotted area without stretching or clipping. */
export function fitCqSlide(panel: HTMLElement) {
  const content = panel.querySelector<HTMLElement>(".smartboard-cq-content, .smartboard-mcq-content, .smartboard-answer-context-content");
  if (!content || !panel.clientHeight || !panel.clientWidth) return;
  const scale = Math.min(1, panel.clientHeight / Math.max(1, content.scrollHeight), panel.clientWidth / Math.max(1, content.scrollWidth));
  const offset = content.classList.contains("smartboard-cq-content")
    ? Math.max(0, panel.clientWidth - content.scrollWidth * scale) : 0;
  content.style.transform = `translateX(${offset}px) scale(${scale})`;
  content.style.transformOrigin = "top left";
}
