import { LANGUAGE_TYPE_LABELS, isLanguageType } from "@/lib/languageQuestionTypes";
import * as XLSX from "xlsx";
import { normalizeAnswerKey } from "@/lib/answerKey";
import { languagePasteVariants } from "@/lib/languagePasteGuides";
import { ENGLISH_FIRST_MCQ } from "@/lib/englishFirstTemplates";
import { splitChapterSections } from "@/lib/bulkChapterRouting";
import { cleanCqStem } from "@/lib/cleanCqStem";

export type QType = string;

export const TYPE_LABELS: Record<QType, string> = {
  ...LANGUAGE_TYPE_LABELS,
  mcq: "MCQ (বহুনির্বাচনী)",
  cq: "CQ (সৃজনশীল)",
  short: "সংক্ষিপ্ত প্রশ্ন (SQ)",
  descriptive: "রচনামূলক (Descriptive)",
};

export type RefItem = { board?: string; name?: string; year: string };

export type ParsedQuestion = {
  tempId: string;
  type: QType;
  topicName?: string;
  chapterName?: string;
  chapterId?: number;
  resolvedChapterName?: string;
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
  duplicate?: "batch" | "db";
  errors: string[];
};

const uid = () => Math.random().toString(36).slice(2, 10);
const s = (v: any) => (
  v == null
    ? ""
    : String(v)
        .replace(/&nbsp;|&#160;/gi, " ")
        .replace(/\u00a0/g, " ")
        .replace(/(?:<br\s*\/?>\s*)+$/gi, "")
        .trim()
);

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
export function downloadTemplate(type: QType, isMath = false, englishFirst = false) {
  if (type === 'mcq' && englishFirst) {
    XLSX.writeFile(buildEnglishFirstMcqTemplate(), 'mcq_english_first_template.xlsx');
    return;
  }
  if (languagePasteVariants(type,englishFirst)) {
    XLSX.writeFile(buildLanguageTemplate(type,englishFirst), `${type}${englishFirst?'_english_first':''}_template.xlsx`);
    return;
  }
  const wb = XLSX.utils.book_new();
  let rows: any[][] = [];
  let sample: any[] = [];
  let notes: string[] = [];

  switch (isLanguageType(type) ? "short" : type) {
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

  if (isLanguageType(type)) {
    rows[0].push("মোট নম্বর (প্যাসেজ হলে ০)"); sample.push(0);
    notes.unshift("একটি প্যাসেজের উপপ্রশ্নগুলো এক সারিতে সম্পূর্ণ প্রশ্নসেট হিসেবে লিখুন। টেবিল ও শব্দের বক্সের জন্য HTML ব্যবহার করা যায়।");
  }
  // Keep the topic column at the end so files made from older templates remain
  // position-compatible. The parser also accepts this column in any position.
  rows[0].push("টপিক (ঐচ্ছিক — না থাকলে অটো তৈরি হবে)");
  sample.push("উদাহরণ টপিক");
  notes.unshift("টপিক: প্রতিটি প্রশ্নের টপিক লিখুন। নির্বাচিত অধ্যায়ে না থাকলে আপলোডের সময় অটো তৈরি হবে।");
  if (["mcq", "cq", "short"].includes(type)) {
    rows[0].push("অধ্যায় (ঐচ্ছিক — না লিখলে ডিফল্ট অধ্যায়)");
    sample.push("");
    notes.unshift("অধ্যায়: নির্বাচিত বিষয়ের অধ্যায়ের নাম বা নম্বর লিখুন। ফাঁকা রাখলে dashboard-এ নির্বাচিত অধ্যায় ব্যবহার হবে। না মিললে Preview-তে ত্রুটি দেখাবে; নতুন অধ্যায় তৈরি হবে না।");
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
export function buildLanguageTemplate(type: QType, englishFirst = false) {
  const variants = languagePasteVariants(type,englishFirst);
  if (!variants) throw new Error(`No language template for ${type}`);
  const topics: Record<string,string[]> = {gap_filling:["With clues","Without clues"],letter_application:["Formal Letter","Formal E-mails","Informal Letter"]};
  const headers = ["প্যাসেজ / নির্দেশনা (ঐচ্ছিক)", "সম্পূর্ণ প্রশ্নসেট*", "সম্পূর্ণ উত্তর", "ছবি URL", "ব্যাখ্যা", ...REF_COLS, "মোট নম্বর (প্যাসেজ হলে ০)", "টপিক (ঐচ্ছিক — না থাকলে অটো তৈরি হবে)"];
  const rows = variants.map((variant,i) => {
    const [question, answer = ""] = variant.sample.split("উত্তর:");
    const parts = question.split(/^প্রশ্ন:\s*/m);
    const stimulus = parts.length > 1 ? parts[0].replace(/^উদ্দীপক:\s*/, '').trim() : '';
    const questionText = parts.length > 1 ? parts.slice(1).join('প্রশ্ন:').trim() : question.trim();
    return [stimulus, questionText, answer.trim(), "", "", "", "", 0, englishFirst ? '' : topics[type]?.[i] || ""];
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers,...rows]);
  ws["!cols"] = headers.map((_,i)=>({wch:i===1||i===2?65:25}));
  ws["!rows"] = [{hpt:30},...rows.map(()=>({hpt:180}))];
  XLSX.utils.book_append_sheet(wb,ws,"Questions");
  const notes = [
    `${TYPE_LABELS[type]} — নমুনা সারিগুলো নিজের প্রশ্ন দিয়ে বদলান বা মুছে ফেলুন।`,
    "প্রতি সারিতে একটি সম্পূর্ণ প্রশ্নসেট দিন। (a)–(j) বা একই passage-এর বাক্যগুলো আলাদা সারিতে ভাগ করবেন না।",
    "প্রশ্ন ও উত্তর আলাদা কলামে লিখুন; উত্তর কলামে উত্তর: বা Ans: লিখতে হবে না।",
    "টেবিল/শব্দের বক্সের কলাম | অথবা Tab দিয়ে আলাদা করুন। HTML টেবিলও দেওয়া যাবে। একটি cell-এ নতুন লাইন দিতে Alt+Enter চাপুন।",
    "পুরো Letter/E-mail অথবা Composition একই cell-এ একাধিক paragraph হিসেবে দিন।",
    "মোট নম্বর নিজের প্রশ্নের জন্য নির্ধারণ করুন; নমুনায় ০ দেওয়া আছে।",
    "টপিক নির্বাচিত অধ্যায়ে না থাকলে সেভের সময় তৈরি হবে।",
    ...variants.map(v=>`${v.label}: ${v.desc}`), ...REF_NOTES,
  ];
  const instructions = XLSX.utils.aoa_to_sheet([["নির্দেশনা"],...notes.map(note=>[note])]);
  instructions["!cols"] = [{wch:110}];
  XLSX.utils.book_append_sheet(wb,instructions,"Instructions");
  return wb;
}

export function buildEnglishFirstMcqTemplate() {
  const q = parsePastedText(ENGLISH_FIRST_MCQ,'mcq')[0];
  const wb = XLSX.utils.book_new();
  const headers = ["উদ্দীপক (Seen Passage)","প্রশ্ন*","অপশন ক*","অপশন খ*","অপশন গ*","অপশন ঘ*","সঠিক উত্তর* (a/b/c/d)","ব্যাখ্যা","ছবি URL","বোর্ড","বছর",...REF_COLS,"টপিক (ঐচ্ছিক)","অধ্যায় (ঐচ্ছিক — না লিখলে ডিফল্ট অধ্যায়)"];
  const ws = XLSX.utils.aoa_to_sheet([headers,[q.stimulus,q.question,q.option_a,q.option_b,q.option_c,q.option_d,q.correct_answer,'','','','','','','','']]);
  ws['!cols'] = headers.map((_,i)=>({wch:i===0?65:30}));
  XLSX.utils.book_append_sheet(wb,ws,'Questions');
  const notes = XLSX.utils.aoa_to_sheet([['নির্দেশনা'],['প্রতি সারিতে একটি MCQ এবং চারটি অপশন দিন; সঠিক উত্তর a/b/c/d হবে।'],['উদ্দীপক কলামে সংশ্লিষ্ট Seen Passage দিন; টপিক কলামে Lesson-এর নাম দিন।'],['নমুনা নিজের প্রশ্ন দিয়ে বদলান বা মুছে ফেলুন।']]);
  notes['!cols'] = [{wch:110}];
  XLSX.utils.book_append_sheet(wb,notes,'Instructions');
  return wb;
}

export async function parseExcelFile(file: File, type: QType, isMath = false): Promise<ParsedQuestion[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (rows.length < 2) return [];
  const header = (rows[0] || []).map(s);
  const headerText = header.join("|");
  const marksColumn = header.findIndex(value => /মোট নম্বর|total marks/i.test(value));
  const topicColumn = header.findIndex((value) => /(?:^|\s)(?:topic|টপিক)(?:\s|$|\()/i.test(value));
  const chapterColumn = header.findIndex(value => /^(?:chapter|অধ্যায়|অধ্যায়)(?:\s|$|\()/iu.test(value));
  // Header wins when recognizable (old/new templates both work), else fall back to subject
  const mathSheet = type === "cq"
    ? (/প্রশ্ন ঘ/.test(headerText) ? false : /জ্ঞান, ২|প্রশ্ন গ/.test(headerText) ? true : isMath)
    : false;
  const body = rows.slice(1).filter((r) => r.some((c) => s(c)));
  return body.map((r) => {
    const cells = r.filter((_, index) => ![topicColumn, chapterColumn, marksColumn].includes(index));
    const topicName = topicColumn >= 0 ? s(r[topicColumn]) : "";
    const chapterName = chapterColumn >= 0 ? s(r[chapterColumn]) : "";
    const marksRaw = marksColumn >= 0 ? r[marksColumn] : 0;
    const question = rowToQuestion(cells, type, mathSheet);
    if (isLanguageType(type)) {
      const marks = Number(String(marksRaw).replace(/[০-৯]/g,c=>String("০১২৩৪৫৬৭৮৯".indexOf(c))));
      question.creative_data = {marks: Number.isFinite(marks) && marks >= 0 ? marks : 0};
      if (!Number.isFinite(marks) || marks < 0) question.errors.push("মোট নম্বর সঠিক নয়");
    }
    if (topicName) question.topicName = topicName;
    if (chapterName) question.chapterName = chapterName;
    return question;
  });
}

function wrapImg(url: string) {
  const u = s(url);
  if (!u) return "";
  return `<img src="${u}" alt="" style="max-width:100%;height:auto" />`;
}

function applyRefs(q: ParsedQuestion, boardCell: string, uniCell: string) {
  const boards = parseRefCell(boardCell).map((r) => ({ board: r.name, year: r.year }));
  const unis = parseRefCell(uniCell).map((r) => ({ name: r.name, year: r.year }));
  if (boards.length) q.boardRefs = boards;
  if (unis.length) q.uniRefs = unis;
}

function rowToQuestion(r: any[], type: QType, isMath = false): ParsedQuestion {
  const errors: string[] = [];
  const q: ParsedQuestion = { tempId: uid(), type, question: "", errors };

  if (type === "mcq") {
    const [stim, question, a, b, c, d, correct, expl, img, board, year, boardRefs, uniRefs] = r.map(s);
    const imgTag = wrapImg(img);
    q.stimulus = [stim, imgTag].filter(Boolean).join("\n") || undefined;
    q.question = question;
    q.option_a = a; q.option_b = b; q.option_c = c; q.option_d = d;
    q.correct_answer = normalizeAnswerKey(correct, [a, b, c, d]) || "";
    q.explanation = expl || undefined;
    q.board = board || undefined; q.year = year || undefined;
    applyRefs(q, boardRefs, uniRefs);
    if (!question) errors.push("প্রশ্ন খালি");
    if (!a || !b || !c || !d) errors.push("সব অপশন (ক/খ/গ/ঘ) আবশ্যক");
    if (!["a", "b", "c", "d"].includes(q.correct_answer!)) errors.push("সঠিক উত্তর a/b/c/d হতে হবে");
  } else if (type === "cq") {
    const cells = r.map(s);
    const [stem, qk, ak, qkh, akh, qg, ag] = cells;
    const rest = isMath ? cells.slice(7) : cells.slice(9);
    const qgh = isMath ? "" : cells[7];
    const agh = isMath ? "" : cells[8];
    const [img, expl, boardRefs, uniRefs] = [rest[0] || "", rest[1] || "", rest[2] || "", rest[3] || ""];
    const imgTag = wrapImg(img);
    const finalStem = cleanCqStem([stem, imgTag].filter(Boolean).join("\n"), { q_ka: qk, q_kha: qkh, q_ga: qg, q_gha: qgh });
    q.stimulus = finalStem || undefined;
    q.question = (finalStem || qk).slice(0, 100);
    q.creative_data = isMath
      ? { is_math: true, stem: finalStem, q_ka: qk, q_kha: qkh, q_ga: qg, ans_ka: ak, ans_kha: akh, ans_ga: ag }
      : {
          is_math: false,
          stem: finalStem,
          q_ka: qk, q_kha: qkh, q_ga: qg, q_gha: qgh || undefined,
          ans_ka: ak, ans_kha: akh, ans_ga: ag, ans_gha: agh || undefined,
        };
    q.explanation = expl || undefined;
    applyRefs(q, boardRefs, uniRefs);
    if (!finalStem) errors.push("উদ্দীপক আবশ্যক");
    if (!qk || !qkh || !qg) errors.push("ক/খ/গ প্রশ্ন আবশ্যক");
  } else if ((type === "short" || isLanguageType(type))) {
    const [stim, question, ans, img, expl, boardRefs, uniRefs] = r.map(s);
    const imgTag = wrapImg(img);
    q.stimulus = [isLanguageType(type) ? languageMultiline(stim) : stim, imgTag].filter(Boolean).join("\n") || undefined;
    q.question = isLanguageType(type) ? languageMultiline(question) : question;
    q.explanation = [ans, expl].filter(Boolean).map(value => isLanguageType(type) ? languageMultiline(value) : value).join("\n") || undefined;
    applyRefs(q, boardRefs, uniRefs);
    if (!question) errors.push("প্রশ্ন খালি");
  } else if (type === "descriptive") {
    const [qk, ak, qkh, akh, img, expl, boardRefs, uniRefs] = r.map(s);
    const imgTag = wrapImg(img);
    q.stimulus = imgTag || undefined;
    q.question = qk.slice(0, 100);
    q.creative_data = { desc_q_ka: qk, desc_q_kha: qkh, desc_ans_ka: ak, desc_ans_kha: akh };
    q.explanation = expl || undefined;
    applyRefs(q, boardRefs, uniRefs);
    if (!qk && !qkh) errors.push("অন্তত একটি প্রশ্ন আবশ্যক");
  }

  return q;
}


// ============ Structured paste parsing ============
const stripTags = (h: string) => String(h || "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ");

const IMG_URL = /^https?:\/\/\S+\.(png|jpe?g|gif|webp|svg)(\?\S*)?$/i;

function mdImages(t: string) {
  return String(t || "").replace(/!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g, (_m, u) => wrapImg(u));
}

const multiline = (v: string) => mdImages(String(v || "").trim()).replace(/\n/g, "<br/>");

function languageMultiline(value: string) {
  const lines = value.trim().split("\n");
  const result: string[] = [];
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes("\t") && !/^\s*\|.*\|\s*$/.test(lines[i])) { result.push(lines[i]); continue; }
    const rows: string[] = [];
    while (i < lines.length && (lines[i].includes("\t") || /^\s*\|.*\|\s*$/.test(lines[i]))) {
      const cells = lines[i].includes("\t") ? lines[i].split("\t") : lines[i].trim().slice(1,-1).split("|");
      if (!cells.every(c => /^\s*:?-+:?\s*$/.test(c))) rows.push(`<tr>${cells.map(c => `<td>${escape(c.trim())}</td>`).join("")}</tr>`);
      i++;
    }
    i--;
    result.push(`<table border="1"><tbody>${rows.join("")}</tbody></table>`);
  }
  return multiline(result.join("\n"));
}

// key patterns — value is ALWAYS the last capture group
const KEY_PATTERNS: Array<[string, RegExp]> = [
  ["ans_ka", /^\(?\s*(?:উত্তর|উঃ|ans(?:wer)?)\s*[-–]?\s*(?:ক|a)\s*[).:：]\s*(.*)$/i],
  ["ans_kha", /^\(?\s*(?:উত্তর|উঃ|ans(?:wer)?)\s*[-–]?\s*(?:খ|b)\s*[).:：]\s*(.*)$/i],
  ["ans_ga", /^\(?\s*(?:উত্তর|উঃ|ans(?:wer)?)\s*[-–]?\s*(?:গ|c)\s*[).:：]\s*(.*)$/i],
  ["ans_gha", /^\(?\s*(?:উত্তর|উঃ|ans(?:wer)?)\s*[-–]?\s*(?:ঘ|d)\s*[).:：]\s*(.*)$/i],
  ["stimulus", /^\(?\s*(?:উদ্দীপক|উদ্দিপক|নিচের\s*উদ্দীপক|stimulus|stem)\s*[).:：]\s*(.*)$/i],
  ["question", /^\(?\s*(?:প্রশ্ন|question)\s*[).:：]\s*(.*)$/i],
  ["answer", /^\(?\s*(?:সঠিক\s*উত্তর|উত্তর|উঃ|ans(?:wer)?)\s*[).:：]\s*(.*)$/i],
  ["explanation", /^\(?\s*(?:ব্যাখ্যা|বর্ণনা|explanation|expl)\s*[).:：]\s*(.*)$/i],
  ["board", /^\(?\s*(?:বোর্ড(?:\s*রেফারেন্স)?|board(?:\s*ref)?)\s*[).:：]\s*(.*)$/i],
  ["school", /^\(?\s*(?:স্কুল(?:\s*রেফারেন্স)?|বিদ্যালয়(?:\s*রেফারেন্স)?|বিদ্যালয়(?:\s*রেফারেন্স)?|school(?:\s*(?:ref|reference))?)\s*[).:：]\s*(.*)$/i],
  ["uni", /^\(?\s*(?:বিশ্ববিদ্যালয়(?:\s*রেফারেন্স)?|ভার্সিটি|university|uni(?:versity)?\s*ref)\s*[).:：]\s*(.*)$/i],
  ["image", /^\(?\s*(?:ছবি|চিত্র|image|img)\s*(?:url)?\s*[).:：]\s*(.*)$/i],
];

const OPT_RE = /^\(?\s*([কখগঘঙ]|[a-eA-E])\s*[).।:：]\s*(.+)$/;
const OPT_KEY: Record<string, string> = { "ক": "a", "খ": "b", "গ": "c", "ঘ": "d", "ঙ": "e" };
const optKey = (raw: string) => OPT_KEY[raw] || raw.toLowerCase();

function splitBlocks(text: string, type: QType): string[] {
  const bySep = text.split(/\n\s*(?:-{3,}|={3,}|\*{3,}|#{3,})\s*\n/);
  if (bySep.length > 1) return bySep.map((t) => t.trim()).filter(Boolean);
  // Language sets may contain numbered sentences, letter paragraphs and answers.
  // Only an explicit separator starts another set; blank lines are content.
  if (isLanguageType(type)) return [text];

  const startRe = type === "cq"
    ? /^\s*(?:উদ্দীপক|উদ্দিপক|stimulus)\s*[).:：]|^\s*[0-9০-৯]+\s*[.)।]/i
    : /^\s*[0-9০-৯]+\s*[.)।]/;

  const lines = text.split("\n");
  const groups: string[][] = [];
  let cur: string[] = [];
  for (const l of lines) {
    if (startRe.test(l) && cur.some((x) => x.trim())) { groups.push(cur); cur = []; }
    cur.push(l);
  }
  if (cur.length) groups.push(cur);
  let out = groups.map((g) => g.join("\n").trim()).filter(Boolean);

  if (out.length <= 1 && type !== "cq") {
    const byBlank = text.split(/\n\s*\n+/).map((t) => t.trim()).filter(Boolean);
    if (byBlank.length > out.length) out = byBlank;
  }
  return out;
}

function parseBlockFields(block: string, languageSet = false) {
  const f: Record<string, string> = {};
  const opts: Record<string, string> = {};
  const lead: string[] = [];
  let cur: { t: "lead" | "f" | "o"; k: string } = { t: "lead", k: "" };

  const append = (v: string) => {
    if (!v && !languageSet) return;
    if (cur.t === "lead") lead.push(v);
    else if (cur.t === "f") f[cur.k] = f[cur.k] ? f[cur.k] + "\n" + v : v;
    else opts[cur.k] = opts[cur.k] ? opts[cur.k] + "\n" + v : v;
  };

  const raws = block.split("\n");
  for (let i = 0; i < raws.length; i++) {
    let line = languageSet && raws[i].includes("\t") ? raws[i].replace(/\r$/, "") : raws[i].trim();
    if (!line) { if (languageSet) append(""); continue; }
    if (i === 0 || (!languageSet && lead.length === 0)) line = line.replace(/^\s*[0-9০-৯]+\s*[.)।]\s*/, "");
    if (!line) continue;

    if (IMG_URL.test(line)) { f.image = f.image ? f.image + "\n" + line : line; cur = { t: "f", k: "image" }; continue; }

    if (languageSet && /^(?:উত্তর|উঃ|answer|ans)\s*\(?[a-jকখগঘঙচছজঝঞ]\)?\s*[).:：]/i.test(line)) {
      cur = { t: "f", k: "answer" };
      append(line.replace(/^(?:উত্তর|উঃ|answer|ans)\s*/i, ""));
      continue;
    }

    let hit = false;
    for (const [key, re] of KEY_PATTERNS) {
      if (languageSet && key.startsWith("ans_")) continue;
      const m = line.match(re);
      if (m) {
        cur = { t: "f", k: key };
        const val = (m[m.length - 1] || "").trim();
        if (["board", "school", "uni"].includes(key)) f[key] = [f[key], val].filter(Boolean).join("\n");
        else f[key] = val;
        hit = true;
        break;
      }
    }
    if (hit) continue;

    const om = line.match(OPT_RE);
    if (om && !languageSet) {
      const k = optKey(om[1]);
      cur = { t: "o", k };
      opts[k] = om[2].trim();
      continue;
    }
    append(line);
  }
  return { f, opts, lead };
}

function imagesHtml(v?: string) {
  return String(v || "")
    .split(/[\n,;\s]+/)
    .map((u) => u.trim())
    .filter(Boolean)
    .map((u) => (/^https?:\/\//i.test(u) ? wrapImg(u) : ""))
    .filter(Boolean)
    .join("\n");
}

function attachCommon(q: ParsedQuestion, f: Record<string, string>) {
  if (f.board || f.school) q.boardRefs = parseRefCell([f.board,f.school].filter(Boolean).join("\n")).map((r) => ({ board: r.name, year: r.year }));
  if (f.uni) q.uniRefs = parseRefCell(f.uni).map((r) => ({ name: r.name, year: r.year }));
}

export function parsePastedText(text: string, type: QType, isMath = false): ParsedQuestion[] {
  const norm = text.replace(/\r\n/g, "\n").trim();
  if (!norm) return [];
  const sections = ["mcq", "cq", "short"].includes(type) ? splitChapterSections(norm) : [{ text: norm }];
  return sections.flatMap(section => splitBlocks(section.text.trim(), type)
    .map(block => blockToQuestion(block, type, isMath))
    .filter((question): question is ParsedQuestion => question !== null)
    .map(question => section.chapterName === undefined ? question : { ...question, chapterName: section.chapterName }));
}

function blockToQuestion(block: string, type: QType, isMath: boolean): ParsedQuestion | null {
  const { f, opts, lead } = parseBlockFields(block, isLanguageType(type));
  const errors: string[] = [];
  const q: ParsedQuestion = { tempId: uid(), type, question: "", errors };
  const img = imagesHtml(f.image);
  const leadText = multiline(lead.join("\n"));

  if (type === "mcq") {
    const stim = [multiline(f.stimulus || ""), img].filter(Boolean).join("\n");
    q.stimulus = stim || undefined;
    q.question = multiline(f.question || "") || leadText;
    q.option_a = multiline(opts.a || "") || undefined;
    q.option_b = multiline(opts.b || "") || undefined;
    q.option_c = multiline(opts.c || "") || undefined;
    q.option_d = multiline(opts.d || "") || undefined;
    const ansRaw = (f.answer || "").trim();
    q.correct_answer = normalizeAnswerKey(ansRaw, [q.option_a, q.option_b, q.option_c, q.option_d]) || "";
    q.explanation = multiline(f.explanation || "") || undefined;
    attachCommon(q, f);
    if (!q.question) errors.push("প্রশ্ন detect করা যায়নি");
    if (!q.option_a || !q.option_b || !q.option_c || !q.option_d) errors.push("৪টি অপশন (ক/খ/গ/ঘ) detect হয়নি");
    if (!["a", "b", "c", "d"].includes(q.correct_answer || "")) errors.push("সঠিক উত্তর detect হয়নি (উত্তর: খ)");
    if (!q.question && !q.option_a) return null;
    return q;
  }

  if (type === "cq") {
    const qk = multiline(opts.a || ""), qkh = multiline(opts.b || ""), qg = multiline(opts.c || ""), qgh = multiline(opts.d || "");
    const stem = cleanCqStem([multiline(f.stimulus || "") || leadText, img].filter(Boolean).join("\n"), { q_ka: qk, q_kha: qkh, q_ga: qg, q_gha: isMath ? "" : qgh });
    q.stimulus = stem || undefined;
    q.question = (stripTags(stem) || stripTags(qk)).trim().slice(0, 100);
    // গণিত/উচ্চতর গণিত: সবসময় ৩ প্রশ্নের (ক/খ/গ) ফরম্যাট — ভুলে ঘ) দেওয়া থাকলে সেটি উপেক্ষা করা হয়
    const mathMode = isMath;
    q.creative_data = mathMode
      ? {
          is_math: true, stem,
          q_ka: qk, q_kha: qkh, q_ga: qg,
          ans_ka: multiline(f.ans_ka || "") || undefined,
          ans_kha: multiline(f.ans_kha || "") || undefined,
          ans_ga: multiline(f.ans_ga || "") || undefined,
        }
      : {
          is_math: false, stem,
          q_ka: qk, q_kha: qkh, q_ga: qg, q_gha: qgh || undefined,
          ans_ka: multiline(f.ans_ka || "") || undefined,
          ans_kha: multiline(f.ans_kha || "") || undefined,
          ans_ga: multiline(f.ans_ga || "") || undefined,
          ans_gha: multiline(f.ans_gha || "") || undefined,
        };
    q.explanation = multiline(f.explanation || "") || undefined;
    attachCommon(q, f);
    if (!stem) errors.push("উদ্দীপক detect হয়নি");
    if (!qk || !qkh || !qg) errors.push(mathMode ? "গণিত CQ-তে ক/খ/গ — ৩টি প্রশ্নই লাগবে" : "ক/খ/গ প্রশ্ন detect হয়নি");

    if (!stem && !qk) return null;
    return q;
  }


  if (isLanguageType(type)) {
    q.stimulus = [languageMultiline(f.stimulus || ""), img].filter(Boolean).join("\n") || undefined;
    q.question = languageMultiline([lead.join("\n"), f.question || ""].filter(Boolean).join("\n"));
    q.explanation = [languageMultiline(f.answer || ""), languageMultiline(f.explanation || "")].filter(Boolean).join("<br/>") || undefined;
    attachCommon(q, f);
    if (!q.question) { errors.push("প্রশ্ন detect হয়নি"); return null; }
    return q;
  }
  if (type === "short") {
    q.stimulus = [multiline(f.stimulus || ""), img].filter(Boolean).join("\n") || undefined;
    q.question = multiline(f.question || "") || leadText;
    q.explanation = [multiline(f.answer || ""), multiline(f.explanation || "")].filter(Boolean).join("<br/>") || undefined;
    attachCommon(q, f);
    if (!q.question) { errors.push("প্রশ্ন detect হয়নি"); return null; }
    return q;
  }

  // descriptive
  const dqk = multiline(opts.a || "") || multiline(f.question || "") || leadText;
  const dqkh = multiline(opts.b || "");
  q.stimulus = [multiline(f.stimulus || ""), img].filter(Boolean).join("\n") || undefined;
  q.question = stripTags(dqk).trim().slice(0, 100);
  q.creative_data = {
    desc_q_ka: dqk, desc_q_kha: dqkh,
    desc_ans_ka: multiline(f.ans_ka || f.answer || ""),
    desc_ans_kha: multiline(f.ans_kha || ""),
  };
  q.explanation = multiline(f.explanation || "") || undefined;
  attachCommon(q, f);
  if (!dqk) { errors.push("প্রশ্ন detect হয়নি"); return null; }
  return q;
}

// ============ Duplicate detection ============
const sigNorm = (v?: string) =>
  stripTags(String(v || ""))
    .replace(/[\s\u200b-\u200d]+/g, "")
    .replace(/[।.,;:'"“”‘’()\[\]{}\-–—_*`~!?]/g, "")
    .toLowerCase();

export function questionSignature(q: {
  type: string; question?: string; option_a?: string; option_b?: string; option_c?: string; option_d?: string; creative_data?: any;
}): string {
  const cd = q.creative_data || {};
  if (q.type === "mcq") {
    return ["mcq", sigNorm(q.question), sigNorm(q.option_a), sigNorm(q.option_b), sigNorm(q.option_c), sigNorm(q.option_d)].join("|");
  }
  if (q.type === "cq") return ["cq", sigNorm(cd.stem), sigNorm(cd.q_ka), sigNorm(cd.q_kha)].join("|");
  if (q.type === "descriptive") return ["desc", sigNorm(cd.desc_q_ka), sigNorm(cd.desc_q_kha)].join("|");
  return ["short", sigNorm(q.question)].join("|");
}

export function parsedSignature(q: ParsedQuestion) {
  return questionSignature({
    type: q.type, question: q.question,
    option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d,
    creative_data: q.creative_data,
  });
}

/** Marks duplicates inside the batch itself (keeps the first occurrence). */
export function markBatchDuplicates(items: ParsedQuestion[]): ParsedQuestion[] {
  const seen = new Set<string>();
  return items.map((q) => {
    const sig = `${q.chapterId ?? q.chapterName ?? ""}|${parsedSignature(q)}`;
    if (seen.has(sig)) return { ...q, duplicate: "batch" as const };
    seen.add(sig);
    return { ...q, duplicate: undefined };
  });
}

/** Marks items already present in the database (signature set). */
export function markDbDuplicates(items: ParsedQuestion[], dbSignatures: Set<string>): ParsedQuestion[] {
  return items.map((q) => (q.duplicate ? q : dbSignatures.has(parsedSignature(q)) ? { ...q, duplicate: "db" as const } : q));
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
    board_references: [
      ...(q.board ? [{ board: q.board, year: q.year || "" }] : []),
      ...(q.boardRefs || []),
    ],
    university_references: q.uniRefs || [],
  };
  if (q.type === "mcq") {
    p.option_a = q.option_a || null;
    p.option_b = q.option_b || null;
    p.option_c = q.option_c || null;
    p.option_d = q.option_d || null;
    p.correct_answer = normalizeAnswerKey(q.correct_answer, [q.option_a, q.option_b, q.option_c, q.option_d]);
    p.explanation = q.explanation || null;
  } else if (q.type === "cq" || q.type === "descriptive") {
    p.creative_data = q.creative_data || {};
    if (q.type === "cq") {
      const stem = cleanCqStem(p.creative_data.stem || "", p.creative_data);
      if (stem !== p.creative_data.stem) {
        p.creative_data = { ...p.creative_data, stem };
        p.stimulus_text = cleanCqStem(q.stimulus || "", q.creative_data);
        p.question = stripTags(stem).trim().slice(0, 100) || "প্রশ্ন";
      }
    }
    p.explanation = q.explanation || null;
  } else if ((q.type === "short" || isLanguageType(q.type))) {
    p.explanation = q.explanation || null;
  }
  if (isLanguageType(q.type)) { p.creative_data = q.creative_data || { marks: 0 }; p.correct_answer = q.correct_answer || null; }
  return p;
}
