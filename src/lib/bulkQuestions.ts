import * as XLSX from "xlsx";

export type QType = "mcq" | "cq" | "short" | "descriptive";

export const TYPE_LABELS: Record<QType, string> = {
  mcq: "MCQ (বহুনির্বাচনী)",
  cq: "CQ (সৃজনশীল)",
  short: "সংক্ষিপ্ত প্রশ্ন (SQ)",
  descriptive: "রচনামূলক (Descriptive)",
};

export type RefItem = { board?: string; name?: string; year: string };

export type ParsedQuestion = {
  tempId: string;
  type: QType;
  stimulus?: string;
  question: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correct_answer?: string;
  explanation?: string;
  creative_data?: any;
  board?: string;
  year?: string;
  boardRefs?: Array<{ board: string; year: string }>;
  uniRefs?: Array<{ name: string; year: string }>;
  image_url?: string;
  errors: string[];
};

const uid = () => Math.random().toString(36).slice(2, 10);
const s = (v: any) => (v == null ? "" : String(v).trim());

export const isMathSubjectName = (name?: string | null) =>
  /^(গণিত|উচ্চতর গণিত|math|higher\s*math)/i.test(String(name || "").trim());

// "ঢাকা-২০২৩, যশোর ২০২২; কুমিল্লা: ২০২১" => [{name:'ঢাকা', year:'২০২৩'}, ...]
export function parseRefCell(cell: string): Array<{ name: string; year: string }> {
  const raw = s(cell);
  if (!raw) return [];
  return raw
    .split(/[,;\n|]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const m = p.match(/^(.*?)[\s\-–:：]*([0-9০-৯]{2,4})\s*$/);
      if (m && m[1].trim()) return { name: m[1].trim().replace(/[\s\-–:：]+$/, ""), year: m[2] };
      return { name: p, year: "" };
    })
    .filter((r) => r.name);
}

const REF_COLS = ["বোর্ড রেফারেন্স (একাধিক: ঢাকা-২০২৩, যশোর-২০২২)", "বিশ্ববিদ্যালয় রেফারেন্স (একাধিক: ঢাবি-২০২৩, রাবি-২০২২)"];
const REF_SAMPLE = ["ঢাকা-২০২৩, যশোর-২০২২", "ঢাবি-২০২৩"];
const REF_NOTES = [
  "বোর্ড/বিশ্ববিদ্যালয় রেফারেন্স: কমা দিয়ে একাধিক দিন — যেমন: ঢাকা-২০২৩, যশোর-২০২২",
  "নাম ও সালের মাঝে - অথবা : অথবা স্পেস ব্যবহার করা যাবে",
];

// ============ Template generation ============
export function downloadTemplate(type: QType, isMath = false) {
  const wb = XLSX.utils.book_new();
  let rows: any[][] = [];
  let sample: any[] = [];
  let notes: string[] = [];

  switch (type) {
    case "mcq":
      rows = [["উদ্দীপক (HTML, optional)", "প্রশ্ন*", "অপশন ক*", "অপশন খ*", "অপশন গ*", "অপশন ঘ*", "সঠিক উত্তর* (a/b/c/d)", "ব্যাখ্যা", "ছবি URL (Cloudinary)", "বোর্ড", "বছর", ...REF_COLS]];
      sample = ["", "বাংলাদেশের রাজধানী কোথায়?", "চট্টগ্রাম", "ঢাকা", "রাজশাহী", "সিলেট", "b", "ঢাকা বাংলাদেশের রাজধানী", "", "", "", ...REF_SAMPLE];
      notes = ["সঠিক উত্তরে শুধু a/b/c/d লিখুন", "গণিতের জন্য LaTeX ব্যবহার করুন: $x^2 + y^2$", "ছবি: Cloudinary URL দিন — auto <img> ট্যাগ যোগ হবে", "পুরোনো 'বোর্ড'/'বছর' কলামও কাজ করবে", ...REF_NOTES];
      break;
    case "cq":
      if (isMath) {
        rows = [["উদ্দীপক*", "প্রশ্ন ক (জ্ঞান, ২)*", "উত্তর ক", "প্রশ্ন খ (অনুধাবন, ৪)*", "উত্তর খ", "প্রশ্ন গ (প্রয়োগ, ৪)*", "উত্তর গ", "ছবি URL", "ব্যাখ্যা", ...REF_COLS]];
        sample = ["একটি সমকোণী ত্রিভুজের ভূমি ৩ সেমি ও উচ্চতা ৪ সেমি।", "অতিভুজ কাকে বলে?", "...", "ত্রিভুজটির অতিভুজ নির্ণয় করো।", "...", "ত্রিভুজটির ক্ষেত্রফল নির্ণয় করো।", "...", "", "", ...REF_SAMPLE];
        notes = ["গণিত/উচ্চতর গণিতের CQ-তে শুধু ক/খ/গ — নম্বর: ২/৪/৪", "গণিতের জন্য LaTeX ব্যবহার করুন: $x^2 + y^2$", ...REF_NOTES];
      } else {
        rows = [["উদ্দীপক*", "প্রশ্ন ক (জ্ঞান)*", "উত্তর ক", "প্রশ্ন খ (অনুধাবন)*", "উত্তর খ", "প্রশ্ন গ (প্রয়োগ)*", "উত্তর গ", "প্রশ্ন ঘ (উচ্চতর)", "উত্তর ঘ", "ছবি URL", "ব্যাখ্যা", ...REF_COLS]];
        sample = ["রহিম একজন কৃষক। তিনি জৈব সার ব্যবহার করেন।", "জৈব সার কী?", "জৈব সার হলো...", "জৈব সারের সুবিধা ব্যাখ্যা করো।", "...", "উদ্দীপকের আলোকে রহিমের পদক্ষেপ ব্যাখ্যা করো।", "...", "মূল্যায়ন করো।", "...", "", "", ...REF_SAMPLE];
        notes = ["উদ্দীপকে ছবি: Cloudinary URL দিন", ...REF_NOTES];
      }
      break;
    case "short":
      rows = [["উদ্দীপক (optional)", "প্রশ্ন*", "উত্তর", "ছবি URL", "ব্যাখ্যা", ...REF_COLS]];
      sample = ["", "সালোকসংশ্লেষণ কী?", "সালোকসংশ্লেষণ হলো উদ্ভিদের খাদ্য তৈরির প্রক্রিয়া।", "", "", ...REF_SAMPLE];
      notes = ["উত্তর ও ব্যাখ্যা দুটোই দিলে একসাথে সংরক্ষিত হবে", ...REF_NOTES];
      break;
    case "descriptive":
      rows = [["প্রশ্ন ক*", "উত্তর ক", "প্রশ্ন খ", "উত্তর খ", "ছবি URL", "ব্যাখ্যা", ...REF_COLS]];
      sample = ["মুক্তিযুদ্ধের কারণ ব্যাখ্যা করো।", "...", "মুক্তিযুদ্ধের ফলাফল আলোচনা করো।", "...", "", "", ...REF_SAMPLE];
      notes = [...REF_NOTES];
      break;
  }

  const data = [...rows, sample, Array(rows[0].length).fill("")];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = rows[0].map(() => ({ wch: 25 }));
  XLSX.utils.book_append_sheet(wb, ws, "Questions");

  if (notes.length) {
    const nws = XLSX.utils.aoa_to_sheet([["নোট"], ...notes.map((n) => [n])]);
    XLSX.utils.book_append_sheet(wb, nws, "Instructions");
  }

  const filename = `${type}${type === "cq" && isMath ? "_math" : ""}_template.xlsx`;
  XLSX.writeFile(wb, filename);
}


// ============ Excel parsing ============
export async function parseExcelFile(file: File, type: QType): Promise<ParsedQuestion[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (rows.length < 2) return [];
  const body = rows.slice(1).filter((r) => r.some((c) => s(c)));
  return body.map((r) => rowToQuestion(r, type));
}

function wrapImg(url: string) {
  const u = s(url);
  if (!u) return "";
  return `<img src="${u}" alt="" style="max-width:100%;height:auto" />`;
}

function rowToQuestion(r: any[], type: QType): ParsedQuestion {
  const errors: string[] = [];
  const q: ParsedQuestion = { tempId: uid(), type, question: "", errors };

  if (type === "mcq") {
    const [stim, question, a, b, c, d, correct, expl, img, board, year] = r.map(s);
    const imgTag = wrapImg(img);
    q.stimulus = [stim, imgTag].filter(Boolean).join("\n") || undefined;
    q.question = question;
    q.option_a = a; q.option_b = b; q.option_c = c; q.option_d = d;
    q.correct_answer = correct.toLowerCase();
    q.explanation = expl || undefined;
    q.board = board || undefined; q.year = year || undefined;
    if (!question) errors.push("প্রশ্ন খালি");
    if (!a || !b || !c || !d) errors.push("সব অপশন (ক/খ/গ/ঘ) আবশ্যক");
    if (!["a", "b", "c", "d"].includes(q.correct_answer!)) errors.push("সঠিক উত্তর a/b/c/d হতে হবে");
  } else if (type === "cq") {
    const [stem, qk, ak, qkh, akh, qg, ag, qgh, agh, img] = r.map(s);
    const imgTag = wrapImg(img);
    const finalStem = [stem, imgTag].filter(Boolean).join("\n");
    q.stimulus = finalStem || undefined;
    q.question = (stem || qk).slice(0, 100);
    q.creative_data = {
      is_math: false,
      stem: finalStem,
      q_ka: qk, q_kha: qkh, q_ga: qg, q_gha: qgh || undefined,
      ans_ka: ak, ans_kha: akh, ans_ga: ag, ans_gha: agh || undefined,
    };
    if (!finalStem) errors.push("উদ্দীপক আবশ্যক");
    if (!qk || !qkh || !qg) errors.push("ক/খ/গ প্রশ্ন আবশ্যক");
  } else if (type === "short") {
    const [stim, question, ans, img] = r.map(s);
    const imgTag = wrapImg(img);
    q.stimulus = [stim, imgTag].filter(Boolean).join("\n") || undefined;
    q.question = question;
    q.explanation = ans || undefined;
    if (!question) errors.push("প্রশ্ন খালি");
  } else if (type === "descriptive") {
    const [qk, ak, qkh, akh, img] = r.map(s);
    const imgTag = wrapImg(img);
    q.stimulus = imgTag || undefined;
    q.question = qk.slice(0, 100);
    q.creative_data = { desc_q_ka: qk, desc_q_kha: qkh, desc_ans_ka: ak, desc_ans_kha: akh };
    if (!qk && !qkh) errors.push("অন্তত একটি প্রশ্ন আবশ্যক");
  }

  return q;
}

// ============ Structured paste parsing ============
const banglaDigits: Record<string, string> = { "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9" };
const normDigits = (str: string) => str.replace(/[০-৯]/g, (d) => banglaDigits[d] || d);

export function parsePastedText(text: string, type: QType): ParsedQuestion[] {
  const norm = text.replace(/\r\n/g, "\n").trim();
  if (!norm) return [];

  if (type === "mcq") return parseMCQBlocks(norm);
  if (type === "cq") return parseCQBlocks(norm);
  if (type === "short") return parseShortBlocks(norm);
  if (type === "descriptive") return parseDescBlocks(norm);
  return [];
}

function splitByNumberedItems(text: string): string[] {
  // split on lines that start with a number + . or )
  const lines = text.split("\n");
  const blocks: string[][] = [];
  let cur: string[] = [];
  const isNew = (l: string) => /^\s*[0-9০-৯]+\s*[.)।]/.test(l);
  for (const l of lines) {
    if (isNew(l) && cur.length) { blocks.push(cur); cur = []; }
    cur.push(l);
  }
  if (cur.length) blocks.push(cur);
  return blocks.map((b) => b.join("\n").trim()).filter(Boolean);
}

function parseMCQBlocks(text: string): ParsedQuestion[] {
  const blocks = splitByNumberedItems(text);
  return blocks.map((block) => {
    const errors: string[] = [];
    const q: ParsedQuestion = { tempId: uid(), type: "mcq", question: "", errors };
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    // remove leading number
    if (lines[0]) lines[0] = lines[0].replace(/^\s*[0-9০-৯]+\s*[.)।]\s*/, "");

    const optRe = /^([কখগঘabcd])[).\s]\s*(.+)$/i;
    const ansRe = /^(উত্তর|Ans|Answer)\s*[:：]?\s*(.+)$/i;
    const explRe = /^(ব্যাখ্যা|Explanation)\s*[:：]?\s*(.+)$/i;
    const questionLines: string[] = [];
    const opts: Record<string, string> = {};
    const optOrder = ["ক", "খ", "গ", "ঘ"];
    let ans = ""; let expl = "";
    for (const l of lines) {
      const om = l.match(optRe);
      const am = l.match(ansRe);
      const em = l.match(explRe);
      if (em) { expl = em[2]; continue; }
      if (am) { ans = am[2].trim(); continue; }
      if (om) {
        const key = om[1];
        const idx = optOrder.indexOf(key) >= 0 ? optOrder.indexOf(key) : "abcd".indexOf(key.toLowerCase());
        if (idx >= 0) opts[["a", "b", "c", "d"][idx]] = om[2];
        continue;
      }
      questionLines.push(l);
    }
    q.question = questionLines.join(" ").trim();
    q.option_a = opts.a; q.option_b = opts.b; q.option_c = opts.c; q.option_d = opts.d;
    // normalize answer
    const a = ans.trim();
    const map: Record<string, string> = { "ক": "a", "খ": "b", "গ": "c", "ঘ": "d" };
    q.correct_answer = (map[a] || a.toLowerCase()).slice(0, 1);
    q.explanation = expl || undefined;

    if (!q.question) errors.push("প্রশ্ন detect করা যায়নি");
    if (!opts.a || !opts.b || !opts.c || !opts.d) errors.push("৪টা অপশন detect হয়নি");
    if (!["a", "b", "c", "d"].includes(q.correct_answer!)) errors.push("সঠিক উত্তর detect হয়নি");
    return q;
  });
}

function parseCQBlocks(text: string): ParsedQuestion[] {
  // Split by "উদ্দীপক" occurrences or double newlines
  const chunks = text.split(/\n\s*\n(?=উদ্দীপক|[0-9০-৯]+[.)।])/);
  return chunks.map((chunk) => {
    const errors: string[] = [];
    const q: ParsedQuestion = { tempId: uid(), type: "cq", question: "", errors };
    // Extract stem
    const stemMatch = chunk.match(/উদ্দীপক\s*[:：]?\s*([\s\S]*?)(?=\n\s*[কখগঘ][).]|$)/);
    const stem = stemMatch ? stemMatch[1].trim() : "";
    const sub = (marker: string) => {
      const re = new RegExp(`\\n\\s*${marker}[).]\\s*([\\s\\S]*?)(?=\\n\\s*[কখগঘ][).]|$)`);
      const m = ("\n" + chunk).match(re);
      return m ? m[1].trim() : "";
    };
    const qk = sub("ক"), qkh = sub("খ"), qg = sub("গ"), qgh = sub("ঘ");
    q.stimulus = stem || undefined;
    q.question = (stem || qk).slice(0, 100);
    q.creative_data = { is_math: false, stem, q_ka: qk, q_kha: qkh, q_ga: qg, q_gha: qgh || undefined };
    if (!stem) errors.push("উদ্দীপক detect হয়নি");
    if (!qk || !qkh || !qg) errors.push("ক/খ/গ প্রশ্ন detect হয়নি");
    return q;
  }).filter((q) => q.question || q.creative_data?.stem);
}

function parseShortBlocks(text: string): ParsedQuestion[] {
  const blocks = splitByNumberedItems(text);
  return blocks.map((block) => {
    const errors: string[] = [];
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines[0]) lines[0] = lines[0].replace(/^\s*[0-9০-৯]+\s*[.)।]\s*/, "");
    const ansIdx = lines.findIndex((l) => /^(উত্তর|Ans)\s*[:：]/i.test(l));
    const q: ParsedQuestion = { tempId: uid(), type: "short", question: "", errors };
    if (ansIdx >= 0) {
      q.question = lines.slice(0, ansIdx).join(" ").trim();
      q.explanation = lines[ansIdx].replace(/^(উত্তর|Ans)\s*[:：]?\s*/i, "") + " " + lines.slice(ansIdx + 1).join(" ");
      q.explanation = q.explanation.trim();
    } else {
      q.question = lines.join(" ");
    }
    if (!q.question) errors.push("প্রশ্ন detect হয়নি");
    return q;
  });
}

function parseDescBlocks(text: string): ParsedQuestion[] {
  const blocks = splitByNumberedItems(text);
  return blocks.map((block) => {
    const errors: string[] = [];
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines[0]) lines[0] = lines[0].replace(/^\s*[0-9০-৯]+\s*[.)।]\s*/, "");
    const ansIdx = lines.findIndex((l) => /^(উত্তর|Ans)\s*[:：]/i.test(l));
    const q: ParsedQuestion = { tempId: uid(), type: "descriptive", question: "", errors };
    const qk = ansIdx >= 0 ? lines.slice(0, ansIdx).join(" ") : lines.join(" ");
    const ak = ansIdx >= 0 ? lines[ansIdx].replace(/^(উত্তর|Ans)\s*[:：]?\s*/i, "") + " " + lines.slice(ansIdx + 1).join(" ") : "";
    q.question = qk.slice(0, 100);
    q.creative_data = { desc_q_ka: qk, desc_q_kha: "", desc_ans_ka: ak.trim(), desc_ans_kha: "" };
    if (!qk) errors.push("প্রশ্ন detect হয়নি");
    return q;
  });
}

// ============ Convert to DB payload ============
export function toDbPayload(q: ParsedQuestion, ctx: {
  class_id: number; subject_id: number; chapter_id: number; topic_id?: number | null;
  teacher_id: string; stimulus_group_id?: string | null;
}): any {
  const p: any = {
    class_id: ctx.class_id,
    subject_id: ctx.subject_id,
    chapter_id: ctx.chapter_id,
    topic_id: ctx.topic_id || null,
    teacher_id: ctx.teacher_id,
    type: q.type,
    question: q.question || (q.creative_data?.stem?.slice(0, 100)) || "প্রশ্ন",
    stimulus_text: q.stimulus || null,
    stimulus_group_id: ctx.stimulus_group_id || null,
    board_references: q.board ? [{ board: q.board, year: q.year || "" }] : [],
    university_references: [],
  };
  if (q.type === "mcq") {
    p.option_a = q.option_a || null;
    p.option_b = q.option_b || null;
    p.option_c = q.option_c || null;
    p.option_d = q.option_d || null;
    p.correct_answer = q.correct_answer || null;
    p.explanation = q.explanation || null;
  } else if (q.type === "cq" || q.type === "descriptive") {
    p.creative_data = q.creative_data || {};
  } else if (q.type === "short") {
    p.explanation = q.explanation || null;
  }
  return p;
}
