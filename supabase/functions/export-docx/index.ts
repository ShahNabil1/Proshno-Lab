import { createClient } from "npm:@supabase/supabase-js@2";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  ImageRun,
  ImportedXmlComponent,
  Packer,
  Paragraph,
  SectionType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  VerticalAlign,
  WidthType,
} from "npm:docx@9.5.1";
import katex from "npm:katex@0.16.33";
import { mml2omml } from "npm:mathml2omml@0.5.0";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const FONT = "SolaimanLipi";
const MAX_QUESTIONS = 500;

type Question = {
  id: number;
  question: string;
  option_a?: string | null;
  option_b?: string | null;
  option_c?: string | null;
  option_d?: string | null;
  correct_answer?: string | null;
  type: string;
  explanation?: string | null;
  board_references?: Array<Record<string, string>> | null;
  university_references?: Array<Record<string, string>> | null;
  creative_data?: Record<string, unknown> | null;
  stimulus_group_id?: string | null;
  stimulus_text?: string | null;
};

type ExportRequest = {
  questionIds?: number[];
  questions?: Question[];
  meta: Record<string, unknown>;
  settings: Record<string, unknown>;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const banglaDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
const toBanglaNum = (value: number | string) =>
  String(value)
    .split("")
    .map((digit) => banglaDigits[Number(digit)] ?? digit)
    .join("");
const pageNumber = (value: number, english: boolean) =>
  english ? String(value) : toBanglaNum(value);
const paddedNumber = (value: number, english: boolean) => {
  const result = pageNumber(value, english);
  return result.length < 2 ? `${english ? "0" : "০"}${result}` : result;
};

const decodeHtml = (value: string) =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

const textFromHtml = (source?: string | null) => {
  if (!source) return "";
  const stripped = String(source)
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
    .replace(/<\/?(?:p|div|li|ul|ol|table|tr|td|th|span|strong|b|em|i|u|h[1-6]|small|sub|sup|label|button|a)[^>]*>/gi, "")
    .replace(/<[a-zA-Z\/][^>]*>/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
  return decodeHtml(stripped).trim();
};

const comprehensiveMathPattern =
  /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^$]+?\$|\s*\\begin\{[a-zA-Z*]+\}[\s\S]*?\\end\{[a-zA-Z*]+\})/g;

const isMathToken = (token: string): boolean =>
  /^(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^$]+?\$|\s*\\begin\{[a-zA-Z*]+\}[\s\S]*?\\end\{[a-zA-Z*]+\})$/.test(
    token
  );

function latexToOmml(tex: string): ImportedXmlComponent | null {
  try {
    let cleanTex = tex
      .replace(/^\$\$?|\$\$?$/g, "")
      .replace(/^\\\(|\\\)$/g, "")
      .replace(/^\\\[|\\\]$/g, "")
      .trim();
    if (!cleanTex) return null;

    const rawMml = katex.renderToString(cleanTex, {
      output: "mathml",
      throwOnError: false,
    });
    const mathMatch = rawMml.match(/<math[\s\S]*?<\/math>/i);
    if (!mathMatch) return null;

    const cleanMml = mathMatch[0].replace(
      /<annotation[\s\S]*?<\/annotation>/gi,
      ""
    );
    let omml = typeof mml2omml === "function" ? mml2omml(cleanMml) : "";
    if (!omml) return null;

    // Eliminate Word's dotted empty square placeholder boxes for prescripts/combinations (e.g. ^7C_0)
    omml = omml.replace(/<m:e\/>/g, '<m:e><m:r><m:t>\u200B</m:t></m:r></m:e>');

    // Safely XML-encode unescaped characters (&, <, >) inside <m:t>...</m:t> tags.
    omml = omml.replace(/(<m:t\b[^>]*>)([\s\S]*?)(<\/m:t>)/g, (_match, open, content, close) => {
      const safeContent = content
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return open + safeContent + close;
    });

    const parsed = ImportedXmlComponent.fromXmlString(omml);
    return (parsed as any).root && (parsed as any).root[0]
      ? (parsed as any).root[0]
      : parsed;
  } catch {
    return null;
  }
}

const textRuns = (
  value?: string | null,
  options: Record<string, unknown> = {}
): Array<TextRun | ImportedXmlComponent> => {
  let normalized = String(value || "")
    .replace(/([a-zA-Z0-9)\]]+)\s*<sup>([\s\S]*?)<\/sup>/gi, (_, base, exp) => `$${base}^{${exp}}$`)
    .replace(/([a-zA-Z0-9)\]]+)\s*<sub>([\s\S]*?)<\/sub>/gi, (_, base, sub) => `$${base}_{${sub}}$`)
    .replace(/<sup>([\s\S]*?)<\/sup>/gi, (_, exp) => `$^{${exp}}$`)
    .replace(/<sub>([\s\S]*?)<\/sub>/gi, (_, sub) => `$_{${sub}}$`);
  const source = textFromHtml(normalized);
  const parts = source.split(comprehensiveMathPattern);
  const runs: Array<TextRun | ImportedXmlComponent> = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;

    if (isMathToken(part)) {
      const omml = latexToOmml(part);
      if (omml) {
        runs.push(omml);
      } else {
        const fallback = part.replace(
          /^(\$\$|\$|\\\(|\\\[)|(\$\$|\$|\\\)|\\])$/g,
          ""
        );
        runs.push(
          new TextRun({
            text: fallback,
            font: "Cambria Math",
            ...options,
          })
        );
      }
    } else {
      // Plain text: split by \n and insert <w:br/> line breaks
      const lines = part.split("\n");
      for (let li = 0; li < lines.length; li++) {
        const line = lines[li];
        if (li > 0) {
          runs.push(new TextRun({ break: 1 }));
        }
        if (line) {
          runs.push(new TextRun({ text: line, font: FONT, ...options }));
        }
      }
    }
  }

  return runs;
};

const paragraph = (
  value?: string | null,
  options: Record<string, unknown> = {}
) =>
  new Paragraph({
    children: textRuns(value, options),
    spacing: { after: 60 },
  });

const noBorder = { style: BorderStyle.NONE, size: 0, color: "auto" };
const noBorders = {
  top: noBorder,
  bottom: noBorder,
  left: noBorder,
  right: noBorder,
  insideHorizontal: noBorder,
  insideVertical: noBorder,
};
const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const allThinBorders = {
  top: thinBorder,
  bottom: thinBorder,
  left: thinBorder,
  right: thinBorder,
  insideHorizontal: thinBorder,
  insideVertical: thinBorder,
};

const richTable = (html: string): Table | null => {
  const tableMatch = html.match(/<table\b[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return null;
  const rows = [...tableMatch[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(
    (match) => {
      const cells = [
        ...match[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi),
      ];
      return new TableRow({
        children: cells.map(
          (cell) => new TableCell({ children: [paragraph(cell[1])] })
        ),
      });
    }
  );
  return rows.length
    ? new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: "808080" },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: "808080" },
          left: { style: BorderStyle.SINGLE, size: 4, color: "808080" },
          right: { style: BorderStyle.SINGLE, size: 4, color: "808080" },
          insideHorizontal: {
            style: BorderStyle.SINGLE,
            size: 4,
            color: "B0B0B0",
          },
          insideVertical: {
            style: BorderStyle.SINGLE,
            size: 4,
            color: "B0B0B0",
          },
        },
        rows,
      })
    : null;
};

const imageBlocks = async (html?: string | null): Promise<Paragraph[]> => {
  const srcs = [
    ...String(html || "").matchAll(
      /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi
    ),
  ].map((match) => match[1]);
  const blocks: Paragraph[] = [];
  for (const src of srcs) {
    try {
      const url = new URL(src);
      if (url.protocol !== "https:" && url.protocol !== "http:") continue;
      const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      if (!response.ok) continue;
      const contentType = response.headers.get("content-type") || "";
      const type = contentType.includes("png")
        ? "png"
        : contentType.includes("gif")
        ? "gif"
        : "jpg";
      const data = new Uint8Array(await response.arrayBuffer());
      blocks.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data,
              type,
              transformation: { width: 360, height: 220 },
            }),
          ],
          spacing: { after: 60 },
        })
      );
    } catch {
      // Ignore broken image
    }
  }
  return blocks;
};

const appendRich = async (
  target: Array<Paragraph | Table>,
  html?: string | null,
  options: Record<string, unknown> = {}
) => {
  const source = String(html || "");
  const table = richTable(source);
  const text = textFromHtml(
    source.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, "")
  );
  if (text) target.push(paragraph(text, options));
  if (table) target.push(table);
  target.push(...(await imageBlocks(source)));
};

const refsFor = (question: Question) => {
  const refs: string[] = [];
  for (const ref of question.board_references || [])
    if (ref.board && ref.year) refs.push(`${ref.board} '${ref.year}`);
  for (const ref of question.university_references || []) {
    const name = ref.name || ref.university;
    if (name && ref.year) refs.push(`${name} '${ref.year}`);
  }
  return refs.length ? ` [${refs.join(", ")}]` : "";
};

const answerLabel = (question: Question, english: boolean) => {
  const raw = String(question.correct_answer || "").trim();
  if (!raw) return "";
  const options = [
    question.option_a,
    question.option_b,
    question.option_c,
    question.option_d,
  ];
  const index = options.findIndex(
    (option) => String(option || "").trim() === raw
  );
  const rawIndex = ["a", "b", "c", "d", "ক", "খ", "গ", "ঘ"].indexOf(
    raw.toLowerCase()
  );
  const finalIndex = index >= 0 ? index : rawIndex >= 0 ? rawIndex % 4 : -1;
  if (finalIndex < 0) return raw;
  return english
    ? ["a", "b", "c", "d"][finalIndex]
    : ["ক", "খ", "গ", "ঘ"][finalIndex];
};

const paperSize = (name: unknown) => {
  switch (name) {
    case "Letter":
      return { width: 12240, height: 15840 };
    case "Legal":
      return { width: 12240, height: 20160 };
    case "A5":
      return { width: 8391, height: 11906 };
    default:
      return { width: 11906, height: 16838 }; // A4
  }
};

function shouldStackOptionsServer(q: Question, cols = 2): boolean {
  const rawOpts = [q.option_a, q.option_b, q.option_c, q.option_d].filter(
    (o): o is string => Boolean(o && o.trim())
  );
  if (rawOpts.length === 0) return false;
  const maxLen = Math.max(...rawOpts.map((o) => o.length));
  const totalLen = rawOpts.reduce((a, b) => a + b.length, 0);
  const threshold = cols >= 3 ? 20 : cols === 2 ? 28 : 40;
  return maxLen > threshold || totalLen > threshold * 2.5;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST")
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer "))
    return new Response("Forbidden", { status: 403, headers: corsHeaders });

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user)
    return new Response("Forbidden", { status: 403, headers: corsHeaders });

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: isAdmin, error: roleError } = await adminClient.rpc(
    "has_role",
    { _user_id: user.id, _role: "admin" }
  );
  if (roleError || !isAdmin)
    return new Response("Forbidden", { status: 403, headers: corsHeaders });

  try {
    const body = (await request.json()) as ExportRequest;
    if (!body.meta || !body.settings) {
      return new Response(
        JSON.stringify({ error: "Invalid export request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let questions: Question[] = [];
    if (Array.isArray(body.questions) && body.questions.length > 0) {
      questions = body.questions.slice(0, MAX_QUESTIONS);
    } else if (Array.isArray(body.questionIds) && body.questionIds.length > 0) {
      const ids = body.questionIds.map(Number);
      const { data, error } = await adminClient
        .from("questions")
        .select("*")
        .in("id", ids);
      if (error || !data) throw error || new Error("Questions could not be loaded");
      const byId = new Map(
        (data as Question[]).map((question) => [question.id, question])
      );
      questions = ids.map((id) => byId.get(id)).filter(Boolean) as Question[];
    }

    if (questions.length === 0) {
      return new Response(
        JSON.stringify({ error: "No questions provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const typePriority: Record<string, number> = {
      mcq: 1,
      short: 2,
      cq: 3,
      descriptive: 4,
    };
    questions.sort(
      (a, b) => (typePriority[a.type] || 5) - (typePriority[b.type] || 5)
    );

    const meta = body.meta;
    const settings = body.settings;
    const english = /english|eglish|ইংলিশ/i.test(String(meta.className || ""));
    const fontSize = Math.round((Number(settings.fontSize) || 14) * 1.5);

    const mcq = questions.filter((question) => question.type === "mcq");
    const short = questions.filter((question) => question.type === "short");
    const cq = questions.filter((question) => question.type === "cq");
    const descriptive = questions.filter(
      (question) => question.type === "descriptive"
    );

    const requested = (key: string, total: number) =>
      Math.min(Number(settings[key] || total) || total, total);
    const shortToAnswer = requested("shortToAnswer", short.length);
    const cqToAnswer = requested("cqToAnswer", cq.length);
    const descToAnswer = requested("descToAnswer", descriptive.length);

    const totalMarks =
      mcq.length + shortToAnswer * 2 + cqToAnswer * 10 + descToAnswer * 10;
    const minutes =
      (english ? Math.ceil(mcq.length * 1.5) : mcq.length) +
      shortToAnswer * 2 +
      cqToAnswer * 10 +
      descToAnswer * 10;

    // --- Section 1: Header (1 Column) ---
    const headerContent: Array<Paragraph | Table> = [];

    // Left Marks Box
    let leftCellChildren: Array<Paragraph | Table> = [new Paragraph({ children: [] })];
    if (settings.showMarksBox !== false) {
      const marksBox = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: allThinBorders,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders: allThinBorders,
                shading: { fill: "000000" },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: english ? "Obtained Marks" : "প্রাপ্ত নম্বর",
                        bold: true,
                        color: "FFFFFF",
                        size: fontSize - 2,
                        font: FONT,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          new TableRow({
            height: { value: 340, rule: HeightRule.ATLEAST },
            children: [
              new TableCell({
                borders: allThinBorders,
                children: [new Paragraph({ children: [new TextRun(" ")] })],
              }),
            ],
          }),
        ],
      });
      leftCellChildren = [marksBox];
    }

    // Center Info
    const centerChildren: Paragraph[] = [];
    if (meta.instituteName) {
      centerChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: textRuns(String(meta.instituteName), {
            bold: true,
            size: fontSize + 10,
          }),
          spacing: { after: 20 },
        })
      );
    }
    if (meta.programName) {
      centerChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: textRuns(String(meta.programName), {
            bold: true,
            size: fontSize + 4,
          }),
          spacing: { after: 20 },
        })
      );
    }
    const details = [
      meta.className,
      meta.subjectName,
      Array.isArray(meta.chapterNames) ? meta.chapterNames.join(", ") : "",
    ]
      .filter(Boolean)
      .join(" | ");
    if (details) {
      centerChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: textRuns(details, { size: fontSize }),
          spacing: { after: 20 },
        })
      );
    }

    // Right Box (Set Code / Subject Code)
    const rightChildren: Paragraph[] = [];
    if (settings.showSetCode !== false) {
      rightChildren.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({
              text: english ? "Set Code: " : "সেট কোড: ",
              bold: true,
              font: FONT,
              size: fontSize,
            }),
            new TextRun({
              text: english ? "[ A ]" : "[ ক ]",
              bold: true,
              font: FONT,
              size: fontSize,
            }),
          ],
          spacing: { after: 15 },
        })
      );
    }
    if (settings.showSubjectCode !== false && meta.subjectCode) {
      const codeBoxes = String(meta.subjectCode)
        .split("")
        .map((d) => `[ ${d} ]`)
        .join(" ");
      rightChildren.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({
              text: english ? "Subject Code: " : "বিষয় কোড: ",
              bold: true,
              font: FONT,
              size: fontSize,
            }),
            new TextRun({
              text: codeBoxes,
              bold: true,
              font: FONT,
              size: fontSize,
            }),
          ],
        })
      );
    }

    // Top Header Table (3 columns)
    const topTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorders,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 24, type: WidthType.PERCENTAGE },
              borders: noBorders,
              verticalAlign: VerticalAlign.TOP,
              children: leftCellChildren as any,
            }),
            new TableCell({
              width: { size: 52, type: WidthType.PERCENTAGE },
              borders: noBorders,
              verticalAlign: VerticalAlign.TOP,
              children:
                centerChildren.length > 0
                  ? centerChildren
                  : [new Paragraph({ children: [] })],
            }),
            new TableCell({
              width: { size: 24, type: WidthType.PERCENTAGE },
              borders: noBorders,
              verticalAlign: VerticalAlign.TOP,
              children:
                rightChildren.length > 0
                  ? rightChildren
                  : [new Paragraph({ children: [] })],
            }),
          ],
        }),
      ],
    });
    headerContent.push(topTable);

    // Time & Marks Row
    const timeText = english
      ? `Time— ${minutes} min`
      : `সময়— ${toBanglaNum(minutes)} মিনিট`;
    const marksText = english
      ? `Marks— ${totalMarks}`
      : `পূর্ণমান— ${toBanglaNum(totalMarks)}`;
    const timeMarksRow = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorders,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: noBorders,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: timeText,
                      bold: true,
                      font: FONT,
                      size: fontSize,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: noBorders,
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: marksText,
                      bold: true,
                      font: FONT,
                      size: fontSize,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });
    headerContent.push(timeMarksRow);

    // Instructions
    if (settings.showInstruction !== false) {
      headerContent.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: english
                ? "Note: In the provided MCQ answer sheet, fill the circle corresponding to the correct answer for each question completely. Each question carries 1 mark."
                : "দ্রষ্টব্য: সরবরাহকৃত বহুনির্বাচনি অভীক্ষার উত্তরপত্রে প্রশ্নের ক্রমিক নম্বরের বিপরীতে প্রদত্ত বৃত্তসমূহ সম্পূর্ণ ভরাট করো। প্রতিটি প্রশ্নের মান ১।",
              italics: true,
              font: FONT,
              size: fontSize - 3,
            }),
          ],
          spacing: { before: 20, after: 15 },
        })
      );
      headerContent.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: english
                ? "No marks, signs, or symbols are allowed on the question paper."
                : "প্রশ্নপত্রে কোনো প্রকার দাগ/চিহ্ন দেয়া যাবে না।",
              bold: true,
              font: FONT,
              size: fontSize - 3,
            }),
          ],
          spacing: { after: 30 },
        })
      );
    }

    // Divider
    headerContent.push(
      new Paragraph({
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 6,
            color: "999999",
            space: 4,
          },
        },
        spacing: { after: 100 },
      })
    );

    // --- Section 2: Questions (2 Columns) ---
    const questionContent: Array<Paragraph | Table> = [];
    const section = (heading: string, marks: string, instruction = "") => {
      questionContent.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: textRuns(heading, {
            bold: true,
            underline: { type: UnderlineType.SINGLE },
            size: fontSize + 1,
          }),
          spacing: { before: 100, after: 20 },
        })
      );
      if (marks) {
        questionContent.push(
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: textRuns(marks, { bold: true, size: fontSize - 1 }),
            spacing: { after: 20 },
          })
        );
      }
      if (instruction) {
        questionContent.push(
          new Paragraph({
            children: textRuns(instruction, { bold: true, size: fontSize - 1 }),
            spacing: { after: 50 },
          })
        );
      }
    };
    const answerPrefix = english ? "Answer: " : "উত্তর: ";

    if (mcq.length) {
      if (short.length || cq.length || descriptive.length) {
        section(
          english ? "Multiple Choice Questions" : "বহুনির্বাচনি প্রশ্ন",
          english
            ? `${mcq.length} × 1 = ${mcq.length}`
            : `${toBanglaNum(mcq.length)} × ১ = ${toBanglaNum(mcq.length)}`
        );
      }
      const shownStimuli = new Set<string>();
      for (let index = 0; index < mcq.length; index++) {
        const question = mcq[index];
        const stimulusKey =
          question.stimulus_group_id || textFromHtml(question.stimulus_text);
        if (
          question.stimulus_text &&
          (!stimulusKey || !shownStimuli.has(stimulusKey))
        ) {
          if (stimulusKey) shownStimuli.add(stimulusKey);
          questionContent.push(
            new Paragraph({
              children: textRuns(
                english
                  ? "Read the following stimulus and answer the questions:"
                  : "নিচের উদ্দীপকটি পড়ে পরবর্তী প্রশ্নগুলোর উত্তর দাও:",
                { bold: true, italics: true, size: fontSize - 1 }
              ),
              spacing: { before: 60, after: 20 },
            })
          );
          await appendRich(questionContent, question.stimulus_text, {
            italics: true,
            size: fontSize - 1,
          });
        }
        const ref = settings.showQuestionInfo ? refsFor(question) : "";
        questionContent.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${paddedNumber(index + 1, english)}${
                  english ? ". " : "। "
                }`,
                bold: true,
                font: FONT,
                size: fontSize,
              }),
              ...textRuns(question.question, { size: fontSize }),
              ...(ref
                ? textRuns(` ${ref}`, { italics: true, size: fontSize - 3 })
                : []),
            ],
            spacing: { before: 30, after: 20 },
          })
        );

        const labels = english
          ? ["a", "b", "c", "d"]
          : ["ক", "খ", "গ", "ঘ"];
        const options = [
          question.option_a,
          question.option_b,
          question.option_c,
          question.option_d,
        ];
        const isStacked = shouldStackOptionsServer(
          question,
          Number(settings.columns) || 2
        );

        if (isStacked) {
          for (let oi = 0; oi < options.length; oi++) {
            if (!options[oi]) continue;
            questionContent.push(
              new Paragraph({
                indent: { left: 240 },
                children: [
                  new TextRun({
                    text: `(${labels[oi]}) `,
                    bold: true,
                    font: FONT,
                    size: fontSize - 1,
                  }),
                  ...textRuns(options[oi], { size: fontSize - 1 }),
                ],
                spacing: { after: 10 },
              })
            );
          }
        } else {
          const cells: TableCell[] = [];
          for (let oi = 0; oi < 4; oi++) {
            const val = options[oi];
            cells.push(
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: noBorders,
                margins: { top: 15, bottom: 15, left: 30, right: 30 },
                children: [
                  new Paragraph({
                    children: val
                      ? [
                          new TextRun({
                            text: `(${labels[oi]}) `,
                            bold: true,
                            font: FONT,
                            size: fontSize - 1,
                          }),
                          ...textRuns(val, { size: fontSize - 1 }),
                        ]
                      : [new TextRun("")],
                    spacing: { line: 240 },
                  }),
                ],
              })
            );
          }
          questionContent.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: noBorders,
              rows: [
                new TableRow({ children: [cells[0], cells[1]] }),
                new TableRow({ children: [cells[2], cells[3]] }),
              ],
            })
          );
        }

        if (
          settings.showAnswerSheet &&
          (question.correct_answer || question.explanation)
        ) {
          await appendRich(
            questionContent,
            `${answerPrefix}${answerLabel(question, english)}${
              question.explanation ? `\n${question.explanation}` : ""
            }`,
            { color: "047857", size: fontSize - 2 }
          );
        }
      }
    }

    if (short.length) {
      section(
        english
          ? "Short-answer Questions (2 marks each)"
          : "সংক্ষিপ্ত উত্তর প্রশ্ন (প্রতি প্রশ্নের মান ২)",
        `${pageNumber(shortToAnswer, english)} × ${pageNumber(
          2,
          english
        )} = ${pageNumber(shortToAnswer * 2, english)}`,
        short.length === shortToAnswer
          ? ""
          : english
          ? `Answer any ${shortToAnswer} questions:`
          : `যেকোনো ${toBanglaNum(shortToAnswer)}টি প্রশ্নের উত্তর দাও :`
      );
      for (let index = 0; index < short.length; index++) {
        const question = short[index];
        questionContent.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${paddedNumber(index + 1, english)}${
                  english ? ". " : "। "
                }`,
                bold: true,
                font: FONT,
                size: fontSize,
              }),
              ...textRuns(question.question, { size: fontSize }),
            ],
            spacing: { before: 40, after: 20 },
          })
        );
        if (question.stimulus_text)
          await appendRich(questionContent, question.stimulus_text, {
            italics: true,
          });
        if (
          settings.showAnswerSheet &&
          (question.correct_answer || question.explanation)
        )
          await appendRich(
            questionContent,
            `${answerPrefix}${
              question.correct_answer || question.explanation || ""
            }`,
            { color: "047857" }
          );
      }
    }

    const subLabels = english
      ? ["a", "b", "c", "d"]
      : ["ক", "খ", "গ", "ঘ"];
    const appendStructured = async (
      questionsOfType: Question[],
      heading: string,
      marksPerQuestion: number,
      selected: number,
      kind: "cq" | "descriptive"
    ) => {
      const titleText = english
        ? heading
        : kind === "cq"
        ? "সৃজনশীল প্রশ্ন (প্রতিটি প্রশ্নের মান ১০)"
        : "বর্ণনামূলক প্রশ্ন (প্রতি প্রশ্নের মান ১০)";
      const instruction =
        questionsOfType.length === selected
          ? ""
          : english
          ? `Answer any ${selected} questions:`
          : `যেকোনো ${toBanglaNum(selected)}টি প্রশ্নের উত্তর দাও :`;
      section(
        titleText,
        `${pageNumber(marksPerQuestion, english)} × ${pageNumber(
          selected,
          english
        )} = ${pageNumber(marksPerQuestion * selected, english)}`,
        instruction
      );
      for (let index = 0; index < questionsOfType.length; index++) {
        const question = questionsOfType[index];
        const creative = question.creative_data || {};
        const stem = String(
          creative.stem ||
            question.stimulus_text ||
            (kind === "cq" ? question.question : "")
        );
        questionContent.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${paddedNumber(index + 1, english)}${
                  english ? ". " : "। "
                }`,
                bold: true,
                font: FONT,
                size: fontSize,
              }),
              ...textRuns(stem, { size: fontSize }),
            ],
            spacing: { before: 50, after: 20 },
          })
        );
        await imageBlocks(stem).then((images) =>
          questionContent.push(...images)
        );
        const subQuestions = Array.isArray(creative.sub_questions)
          ? (creative.sub_questions as Array<Record<string, unknown>>)
          : [];
        const keys =
          kind === "cq"
            ? ["q_ka", "q_kha", "q_ga", "q_gha"]
            : ["desc_q_ka", "desc_q_kha"];
        const values = subQuestions.length
          ? subQuestions.map((item) =>
              String(item.question || item.text || "")
            )
          : keys.map((key) => String(creative[key] || ""));
        const marks = kind === "cq" ? [1, 2, 3, 4] : [3, 7];
        for (let part = 0; part < values.length; part++) {
          if (!values[part]) continue;
          questionContent.push(
            new Paragraph({
              indent: { left: 240 },
              children: [
                new TextRun({
                  text: `(${subLabels[part]}) `,
                  bold: true,
                  font: FONT,
                  size: fontSize - 1,
                }),
                ...textRuns(values[part], { size: fontSize - 1 }),
                new TextRun({
                  text: `     ${pageNumber(
                    Number(subQuestions[part]?.marks || marks[part]),
                    english
                  )}`,
                  bold: true,
                  font: FONT,
                  size: fontSize - 1,
                }),
              ],
              spacing: { after: 10 },
            })
          );
        }
        if (settings.showAnswerSheet) {
          const answerKeys =
            kind === "cq"
              ? ["ans_ka", "ans_kha", "ans_ga", "ans_gha"]
              : ["desc_ans_ka", "desc_ans_kha"];
          const answers = subQuestions.length
            ? subQuestions.map((item) => String(item.answer || ""))
            : answerKeys.map((key) => String(creative[key] || ""));
          if (answers.some(Boolean) || question.explanation) {
            questionContent.push(
              new Paragraph({
                children: textRuns(answerPrefix, {
                  bold: true,
                  color: "047857",
                  size: fontSize - 2,
                }),
              })
            );
            for (let part = 0; part < answers.length; part++)
              if (answers[part])
                await appendRich(
                  questionContent,
                  `(${subLabels[part]}) ${answers[part]}`,
                  { color: "047857", size: fontSize - 2 }
                );
            if (!answers.some(Boolean) && question.explanation)
              await appendRich(questionContent, question.explanation, {
                color: "047857",
                size: fontSize - 2,
              });
          }
        }
      }
    };
    if (cq.length)
      await appendStructured(
        cq,
        "Creative Questions (10 marks each)",
        10,
        cqToAnswer,
        "cq"
      );
    if (descriptive.length)
      await appendStructured(
        descriptive,
        "Descriptive Questions (10 marks each)",
        10,
        descToAnswer,
        "descriptive"
      );

    const columnsCount = Number(settings.columns) || 2;
    const columnGapTwips =
      Math.round((Number(settings.columnGap) || 20) * 15) || 567;
    const margins = {
      top: 400 + Math.round(Number(settings.pageMarginTop || 0) * 15),
      bottom: 400 + Math.round(Number(settings.pageMarginBottom || 0) * 15),
      left: 400 + Math.round(Number(settings.pageMarginLeft || 0) * 15),
      right: 400 + Math.round(Number(settings.pageMarginRight || 0) * 15),
    };

    const document = new Document({
      styles: {
        default: {
          document: {
            run: { font: FONT, size: fontSize },
            paragraph: { spacing: { line: 260 } },
          },
        },
      },
      sections: [
        // Section 1: Header (1 column)
        {
          properties: {
            type: SectionType.CONTINUOUS,
            page: { size: paperSize(settings.paperSize), margin: margins },
          },
          children: headerContent,
        },
        // Section 2: Questions (2 columns with separator line)
        {
          properties: {
            type: SectionType.CONTINUOUS,
            column: {
              count: columnsCount,
              space: columnGapTwips,
              separate: settings.columnDivider !== false,
            },
            page: { size: paperSize(settings.paperSize), margin: margins },
          },
          children: questionContent,
        },
      ],
    });

    const buffer = await Packer.toBuffer(document);
    return new Response(buffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": DOCX_MIME,
        "Content-Disposition": "attachment; filename=question-paper.docx",
      },
    });
  } catch (error) {
    console.error("DOCX export failed", error);
    return new Response(JSON.stringify({ error: "DOCX export failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
