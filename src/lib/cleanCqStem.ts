/** Remove a complete duplicate sub-question suffix only when every part matches.
 * Trailing stimulus images are retained byte for byte. Ambiguous input is unchanged.
 */
export function cleanCqStem(stem: string, creative: Record<string, unknown>): string {
  const keys = creative.q_gha ? ["q_ka", "q_kha", "q_ga", "q_gha"] : ["q_ka", "q_kha", "q_ga"];
  const labels = ["ক", "খ", "গ", "ঘ"];
  const normalize = (value: string) => value.replace(/<[^>]*>/g, "").replace(/&nbsp;|&#160;/g, " ").replace(/\s|\\n/g, "");
  if (keys.some(key => typeof creative[key] !== "string" || !normalize(creative[key] as string))) return stem;
  const media = stem.match(/(?:\s*<img\b[^>]*>\s*)+$/i)?.[0] || "";
  const body = media ? stem.slice(0, -media.length) : stem;
  // Match the full known sequence, rather than splitting at labels that may also
  // occur inside a question or a mathematical statement.
  const marks = keys.length === 3 ? ["২", "৪", "৪"] : ["১", "২", "৩", "৪"];
  const expected = (withMarks: boolean, english = false) => keys.map((key, i) =>
    `(${labels[i]})${normalize(creative[key] as string)}${withMarks ? (english ? String("০১২৩৪৫৬৭৮৯".indexOf(marks[i])) : marks[i]) : ""}`
  ).join("");
  for (const match of body.matchAll(/\(ক\)/g)) {
    const suffix = body.slice(match.index);
    if (/<(?:img|svg|table)\b/i.test(suffix)) continue;
    const normalized = normalize(suffix);
    if (![expected(false), expected(true), expected(true, true)].includes(normalized)) continue;
    const prefix = body.slice(0, match.index).trim();
    if (!normalize(prefix) && !media) continue;
    return [prefix, media.trim()].filter(Boolean).join("\n");
  }
  return stem;
}
