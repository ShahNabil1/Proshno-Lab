export const CQ_PARTS = [
  { label: "ক", key: "ans_ka" }, { label: "খ", key: "ans_kha" },
  { label: "গ", key: "ans_ga" }, { label: "ঘ", key: "ans_gha" },
] as const;

export function parseCqAnswers(text: string) {
  const answers: Record<string, string> = {};
  const errors: string[] = [];
  let key = "";
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const match = line.match(/^\s*\[([কখগঘ])\]\s*(.*)$/);
    if (match) {
      key = CQ_PARTS.find(p => p.label === match[1])!.key;
      if (key in answers) errors.push(`${match[1]} অংশ একাধিকবার আছে`);
      answers[key] = match[2];
    } else if (key) answers[key] += `\n${line}`;
    else if (line.trim()) errors.push("CQ-এর উত্তর [ক], [খ], [গ], [ঘ] দিয়ে শুরু করুন");
  }
  for (const part of CQ_PARTS) {
    if (!answers[part.key]?.trim()) errors.push(`[${part.label}] উত্তর দিন`);
    else answers[part.key] = answers[part.key].trim();
  }
  return { answers, errors };
}
