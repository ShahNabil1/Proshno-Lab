const styles = ["filled", "black", "outline", "bracket", "underline"] as const;
type ReferenceStyle = typeof styles[number];

export function normalizeQuestionReferenceSettings(saved: Record<string, unknown>) {
  const style: ReferenceStyle = styles.includes(saved.questionReferenceStyle as ReferenceStyle)
    ? saved.questionReferenceStyle as ReferenceStyle : "outline";
  const color = typeof saved.questionReferenceColor === "string" && /^#[0-9a-f]{6}$/i.test(saved.questionReferenceColor)
    ? saved.questionReferenceColor : "#000000";
  const background = style === "black" ? "#000000" : style === "filled" ? color : "#ffffff";
  const defaultText = style === "black" || style === "filled" ? "#ffffff" : "#000000";
  const text = typeof saved.questionReferenceTextColor === "string" && /^#[0-9a-f]{6}$/i.test(saved.questionReferenceTextColor)
    ? saved.questionReferenceTextColor : defaultText;
  return {
    questionReferenceStyle: style,
    questionReferenceColor: color,
    questionReferenceTextColor: text.toLowerCase() === background.toLowerCase()
      ? (background.toLowerCase() === "#ffffff" ? "#000000" : "#ffffff") : text,
  };
}
