// OMR backend for Proshno Lab.
//
// Nothing has to be installed on the teacher's computer: the answer key lives
// with their account in Supabase and the actual scanning runs inside this page
// (OpenCV.js - see lib/omrVision.ts).  A phone photo never leaves the device,
// only the resulting marks are stored.
//
// This module keeps the API the dashboard pages were written against, so the
// pages did not have to change when the Python engine went away.

import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { analyzeOmr, OmrVisionError, VISION_ERROR_MESSAGES } from "@/lib/omrVision";
import { annotateScan } from "@/lib/omrSheetCanvas";

export interface OmrEngineHealth {
  ok: boolean;
  tokens?: number;
  evaluations?: number;
  error?: string;
}

export interface OmrAnswerItem {
  questionIndex: number;
  answerIndex: number;
}

export interface OmrToken {
  id: string;
  title: string;
  template: string;
  omr_code: string | null;
  column: number;
  number_of_question: number;
  negative_marking: number;
  answer_script: OmrAnswerItem[];
  answered?: number;
  created_at?: string;
}

export interface OmrQuestionResult {
  number: number;
  marked: number | null;
  correct: number;
  status: "correct" | "incorrect" | "multiple" | "unanswered";
  scores: number[];
  center: [number, number];
  markedCenter?: [number, number] | null;
}

export interface OmrResultSummary {
  result: number;
  touched: number;
  multiple_touched: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  total_negative: number;
  total_questions: number;
}

export interface OmrEvaluationEntry {
  ok: boolean;
  name: string;
  token_id?: string;
  batch_id?: string;
  result?: OmrResultSummary;
  per_question?: OmrQuestionResult[];
  answer_script_url?: string | null;
  processing_time?: number;
  error?: { code: string; message: string; details?: unknown } | null;
}

export interface OmrEvaluationRow {
  id: string;
  token_id: string;
  batch_id: string;
  image_name: string;
  result: OmrResultSummary;
  processing_time: number;
  annotated_url: string | null;
  created_at: string;
}

export class OmrEngineError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "OmrEngineError";
    this.code = code;
    this.details = details;
  }
}

type EvaluationInsert = Database["public"]["Tables"]["omr_evaluations"]["Insert"];
type TokenUpdate = Database["public"]["Tables"]["omr_tokens"]["Update"];

const SETUP_MESSAGE =
  "OMR ডেটাবেস এখনো তৈরি হয়নি। Supabase-এ omr_tokens / omr_evaluations টেবিল দুটি যোগ করুন।";

const isMissingTable = (error: { code?: string; message?: string } | null): boolean => {
  if (!error) return false;
  const code = String(error.code ?? "");
  const message = String(error.message ?? "");
  return code === "PGRST205" || code === "42P01" || /does not exist|schema cache/i.test(message);
};

const fail = (error: { code?: string; message?: string; details?: unknown } | null, fallback: string): never => {
  if (isMissingTable(error)) throw new OmrEngineError("OMR_NOT_INSTALLED", SETUP_MESSAGE, error);
  // the token table points at public.teachers, which is created on sign-up
  if (String(error?.code ?? "") === "23503") {
    throw new OmrEngineError(
      "TEACHER_PROFILE_MISSING",
      "আপনার শিক্ষক প্রোফাইল পাওয়া যাচ্ছে না - একবার লগআউট করে আবার লগইন করুন।",
      error,
    );
  }
  throw new OmrEngineError(String(error?.code || "SUPABASE_ERROR"), String(error?.message || fallback), error?.details);
};

/** Every row is scoped by RLS to the signed-in teacher, but inserts need the id. */
const currentTeacherId = async (): Promise<string> => {
  const { data } = await supabase.auth.getUser();
  const id = data?.user?.id;
  if (!id) throw new OmrEngineError("NOT_SIGNED_IN", "আগে লগইন করুন");
  return id;
};

const asAnswerScript = (value: unknown): OmrAnswerItem[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      questionIndex: Number((item as OmrAnswerItem)?.questionIndex),
      answerIndex: Number((item as OmrAnswerItem)?.answerIndex),
    }))
    .filter((item) => Number.isFinite(item.questionIndex) && Number.isFinite(item.answerIndex));
};

interface TokenRow {
  id: string;
  title: string;
  template: string;
  omr_code: string | null;
  columns: number;
  number_of_question: number;
  negative_marking: number | string;
  answer_script: unknown;
  created_at: string;
}

const toToken = (row: TokenRow): OmrToken => {
  const script = asAnswerScript(row.answer_script);
  return {
    id: row.id,
    title: row.title ?? "",
    template: row.template ?? "scannable",
    omr_code: row.omr_code ?? null,
    column: Number(row.columns),
    number_of_question: Number(row.number_of_question),
    negative_marking: Number(row.negative_marking ?? 0),
    answer_script: script,
    answered: script.filter((item) => item.answerIndex >= 0).length,
    created_at: row.created_at,
  };
};

export const engineHealth = async (): Promise<OmrEngineHealth> => {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, error: "ইন্টারনেট সংযোগ নেই" };
  }
  try {
    const [tokens, evaluations] = await Promise.all([
      supabase.from("omr_tokens").select("id", { count: "exact", head: true }),
      supabase.from("omr_evaluations").select("id", { count: "exact", head: true }),
    ]);
    const error = tokens.error || evaluations.error;
    if (error) return { ok: false, error: isMissingTable(error) ? SETUP_MESSAGE : String(error.message) };
    return { ok: true, tokens: tokens.count ?? 0, evaluations: evaluations.count ?? 0 };
  } catch (error) {
    return { ok: false, error: omrErrorMessage(error) };
  }
};

export const listTokens = async (): Promise<OmrToken[]> => {
  const { data, error } = await supabase
    .from("omr_tokens")
    .select("id, title, template, omr_code, columns, number_of_question, negative_marking, answer_script, created_at")
    .order("created_at", { ascending: false });
  if (error) fail(error, "টোকেনের তালিকা আনা যায়নি");
  return (data as TokenRow[]).map(toToken);
};

export const getToken = async (id: string): Promise<OmrToken> => {
  const { data, error } = await supabase
    .from("omr_tokens")
    .select("id, title, template, omr_code, columns, number_of_question, negative_marking, answer_script, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) fail(error, "টোকেন খুঁজে পাওয়া যায়নি");
  if (!data) throw new OmrEngineError("TOKEN_NOT_FOUND", "টোকেনটি খুঁজে পাওয়া যায়নি");
  return toToken(data as TokenRow);
};

export interface CreateTokenInput {
  title: string;
  omr_code: string;
  negative_marking?: number;
  template?: string;
  columns?: number;
  number_of_question?: number;
}

export const createToken = async (input: CreateTokenInput): Promise<OmrToken> => {
  const teacherId = await currentTeacherId();
  const { data, error } = await supabase
    .from("omr_tokens")
    .insert({
      teacher_id: teacherId,
      title: input.title ?? "",
      template: input.template ?? "scannable",
      omr_code: input.omr_code,
      columns: input.columns ?? 4,
      number_of_question: input.number_of_question ?? 20,
      negative_marking: input.negative_marking ?? 0,
      answer_script: [],
    })
    .select("id, title, template, omr_code, columns, number_of_question, negative_marking, answer_script, created_at")
    .single();
  if (error) fail(error, "টোকেন তৈরি করা যায়নি");
  return toToken(data as TokenRow);
};

export const saveAnswerScript = async (id: string, script: OmrAnswerItem[]): Promise<OmrToken> => {
  const { data, error } = await supabase
    .from("omr_tokens")
    .update({ answer_script: script as unknown as Json })
    .eq("id", id)
    .select("id, title, template, omr_code, columns, number_of_question, negative_marking, answer_script, created_at")
    .single();
  if (error) fail(error, "উত্তরপত্র সেভ করা যায়নি");
  return toToken(data as TokenRow);
};

export const updateToken = async (id: string, fields: Partial<CreateTokenInput>): Promise<OmrToken> => {
  const patch: TokenUpdate = {};
  if (fields.title !== undefined) patch.title = fields.title;
  if (fields.omr_code !== undefined) patch.omr_code = fields.omr_code;
  if (fields.template !== undefined) patch.template = fields.template;
  if (fields.columns !== undefined) patch.columns = fields.columns;
  if (fields.number_of_question !== undefined) patch.number_of_question = fields.number_of_question;
  if (fields.negative_marking !== undefined) patch.negative_marking = fields.negative_marking;
  const { data, error } = await supabase
    .from("omr_tokens")
    .update(patch)
    .eq("id", id)
    .select("id, title, template, omr_code, columns, number_of_question, negative_marking, answer_script, created_at")
    .single();
  if (error) fail(error, "টোকেন আপডেট করা যায়নি");
  return toToken(data as TokenRow);
};

export const deleteToken = async (id: string): Promise<void> => {
  const { error } = await supabase.from("omr_tokens").delete().eq("id", id);
  if (error) fail(error, "টোকেন মুছে ফেলা যায়নি");
};

const formatStamp = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("bn-BD", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const listEvaluations = async (tokenId?: string): Promise<OmrEvaluationRow[]> => {
  let query = supabase
    .from("omr_evaluations")
    .select("id, token_id, batch_id, image_name, result, processing_time, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (tokenId) query = query.eq("token_id", tokenId);
  const { data, error } = await query;
  if (error) fail(error, "পুরনো ফলাফল আনা যায়নি");
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    token_id: String(row.token_id),
    batch_id: String(row.batch_id ?? ""),
    image_name: String(row.image_name ?? ""),
    result: (row.result ?? {}) as OmrResultSummary,
    processing_time: Number(row.processing_time ?? 0),
    annotated_url: null,
    created_at: formatStamp(String(row.created_at)),
  }));
};

export interface UploadImage {
  name: string;
  /** raw base64 (no data: prefix) */
  data: string;
}

export interface EvaluateResponse {
  batch_id: string;
  results: OmrEvaluationEntry[];
}

const base64ToCanvas = async (data: string): Promise<HTMLCanvasElement> => {
  const image = new Image();
  image.decoding = "sync";
  image.src = data.startsWith("data:") ? data : `data:image/png;base64,${data}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new OmrEngineError("BAD_IMAGE", VISION_ERROR_MESSAGES.BAD_IMAGE);
  context.drawImage(image, 0, 0);
  return canvas;
};

/**
 * Scans every photo in the browser and stores the outcome.  One bad photo
 * never stops the batch - its error travels in the entry instead.
 */
export const evaluateImages = async (
  tokenId: string,
  batchId: string,
  images: UploadImage[],
): Promise<EvaluateResponse> => {
  const token = await getToken(tokenId);
  const answerKey = token.answer_script
    .slice()
    .sort((a, b) => a.questionIndex - b.questionIndex)
    .map((item) => item.answerIndex);
  if (answerKey.length < token.number_of_question) {
    throw new OmrEngineError("ANSWER_SCRIPT_EMPTY", VISION_ERROR_MESSAGES.ANSWER_SCRIPT_EMPTY);
  }

  const teacherId = await currentTeacherId();
  const results: OmrEvaluationEntry[] = [];
  const pending: EvaluationInsert[] = [];

  for (const image of images) {
    try {
      const canvas = await base64ToCanvas(image.data);
      const outcome = await analyzeOmr(canvas, {
        columns: token.column,
        questions: token.number_of_question,
        answerKey,
        negativeMarking: token.negative_marking,
      });
      const summary: OmrResultSummary = {
        result: outcome.result.result,
        touched: outcome.result.touched,
        multiple_touched: outcome.result.multipleTouched,
        correct: outcome.result.correct,
        incorrect: outcome.result.incorrect,
        unanswered: outcome.result.unanswered,
        total_negative: outcome.result.totalNegative,
        total_questions: outcome.result.totalQuestions,
      };
      const annotated = await annotateScan(canvas, outcome);
      results.push({
        ok: true,
        name: image.name,
        token_id: tokenId,
        batch_id: batchId,
        result: summary,
        per_question: outcome.perQuestion,
        answer_script_url: annotated,
        processing_time: outcome.processingTime,
        error: null,
      });
      pending.push({
        teacher_id: teacherId,
        token_id: tokenId,
        batch_id: batchId,
        image_name: image.name,
        result: summary as unknown as Json,
        per_question: outcome.perQuestion as unknown as Json,
        processing_time: outcome.processingTime,
      });
    } catch (error) {
      const code = error instanceof OmrVisionError || error instanceof OmrEngineError ? error.code : "UNKNOWN";
      const message = omrErrorMessage(error);
      results.push({
        ok: false,
        name: image.name,
        token_id: tokenId,
        batch_id: batchId,
        error: { code, message },
      });
    }
  }

  if (pending.length) {
    const { error } = await supabase.from("omr_evaluations").insert(pending);
    // the marks are already on screen; do not fail the run over history
    if (error) console.error("omr history insert failed", error);
  }

  return { batch_id: batchId, results };
};

/** CSV of every stored result for one token, built in the browser. */
export const downloadEvaluationsCsv = async (tokenId: string): Promise<number> => {
  const token = await getToken(tokenId);
  const { data, error } = await supabase
    .from("omr_evaluations")
    .select("id, token_id, batch_id, image_name, result, per_question, processing_time, created_at")
    .eq("token_id", tokenId)
    .order("created_at", { ascending: false });
  if (error) fail(error, "CSV তৈরি করা যায়নি");
  const rows = (data ?? []).map((row: Record<string, unknown>) => ({
    image_name: String(row.image_name ?? ""),
    batch_id: String(row.batch_id ?? ""),
    created_at: formatStamp(String(row.created_at)),
    result: (row.result ?? {}) as OmrResultSummary,
    per_question: (row.per_question ?? []) as OmrQuestionResult[],
  }));
  const questions = token.number_of_question;
  const header = [
    "image_name",
    "batch_id",
    "created_at",
    "marks",
    "correct",
    "incorrect",
    "multiple",
    "unanswered",
    ...Array.from({ length: questions }, (_, index) => `Q${index + 1}`),
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    const perQuestion = new Map<number, string>();
    for (const question of row.per_question) {
      perQuestion.set(question.number, String(question.marked ?? ""));
    }
    lines.push(
      [
        JSON.stringify(row.image_name),
        JSON.stringify(row.batch_id),
        JSON.stringify(row.created_at),
        row.result?.result ?? 0,
        row.result?.correct ?? 0,
        row.result?.incorrect ?? 0,
        row.result?.multiple_touched ?? 0,
        row.result?.unanswered ?? 0,
        ...Array.from({ length: questions }, (_, index) => perQuestion.get(index + 1) ?? ""),
      ].join(","),
    );
  }
  const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${(token.title || "omr").replace(/[^\p{L}\p{N}_-]+/gu, "-")}-results.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return rows.length;
};

/** Reads a File/Blob as raw base64 (no data: prefix). */
export const fileToBase64 = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.slice(result.indexOf(",") + 1) : result);
    };
    reader.onerror = () => reject(new Error("ছবিটি পড়া যায়নি"));
    reader.readAsDataURL(file);
  });

export const omrErrorMessage = (error: unknown): string => {
  if (error instanceof OmrEngineError) return error.message;
  if (error instanceof OmrVisionError) return error.message;
  if (error instanceof Error) return error.message;
  return "অজানা ত্রুটি ঘটেছে";
};
