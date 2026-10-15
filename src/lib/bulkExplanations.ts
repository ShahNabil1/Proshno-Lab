export interface ExplanationEntry { id: number; explanation: string; }

/** Each entry starts with an explicit question ID and separator; following lines belong to it. */
export function parseBulkExplanations(input: string, label = "ব্যাখ্যা") {
  const entries: ExplanationEntry[] = [];
  const errors: string[] = [];
  let current: { id: number; lines: string[] } | null = null;
  const flush = () => {
    if (!current) return;
    const explanation = current.lines.join("\n").trim();
    if (!Number.isSafeInteger(current.id) || current.id < 1) errors.push("প্রশ্নের সিরিয়াল সঠিক নয়");
    else if (!explanation) errors.push(`#${current.id}: ${label} খালি`);
    else if (entries.some(e => e.id === current!.id)) errors.push(`#${current.id}: একই সিরিয়াল একাধিকবার আছে`);
    else entries.push({ id: current.id, explanation });
  };
  input.replace(/\r\n?/g, "\n").split("\n").forEach((raw, index) => {
    const line = raw.trim().replace(/^\*\*|\*\*$/g, "").replace(/^([#0-9০-৯]+)\*\*\s*(?:\*\*)?/, "$1");
    const match = line.match(/^#?([0-9০-৯]+)\s*[-–—:|]\s*(?:(?:ব্যাখ্যা|ব্যাখা|explanation|উত্তর|answer)\s*[:：]\s*)?(.*)$/i);
    if (match) {
      flush();
      const id = Number(match[1].replace(/[০-৯]/g, d => String(d.charCodeAt(0) - 0x09e6)));
      current = { id, lines: [match[2]] };
    } else if (current) current.lines.push(raw);
    else if (line) errors.push(`লাইন ${index + 1}: প্রথমে সিরিয়াল ও '-' দিন`);
  });
  flush();
  if (entries.length > 500) errors.push(`একবারে সর্বোচ্চ ৫০০টি ${label} দিন`);
  return { entries, errors };
}
