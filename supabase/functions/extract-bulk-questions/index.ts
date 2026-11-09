import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2.116.0/cors";

const GEMINI_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const QUESTION_TYPES = ["mcq", "cq", "short", "descriptive"] as const;
type QuestionType = (typeof QUESTION_TYPES)[number];

const SYSTEM = `You are an expert at extracting academic questions from raw text, images, and PDFs.
Return ONLY valid JSON matching the schema. Do not include markdown code fences.
For MCQ: extract question, 4 options (a/b/c/d), correct answer letter, and explanation if present.
For CQ (creative): extract stimulus (উদ্দীপক), and 4 sub-questions ক/খ/গ/ঘ with answers if present.
For short: extract question and answer.
For descriptive: extract question(s) and answer(s).
Preserve Bangla and English text exactly. Keep math/LaTeX as-is.`;

const schemaFor = (type: QuestionType) => {
  const base = {
    mcq: {
      type: "array",
      items: {
        type: "object",
        properties: {
          stimulus: { type: "string" },
          question: { type: "string" },
          option_a: { type: "string" }, option_b: { type: "string" },
          option_c: { type: "string" }, option_d: { type: "string" },
          correct_answer: { type: "string", enum: ["a", "b", "c", "d"] },
          explanation: { type: "string" },
        },
        required: ["question", "option_a", "option_b", "option_c", "option_d", "correct_answer"],
      },
    },
    cq: {
      type: "array",
      items: {
        type: "object",
        properties: {
          stimulus: { type: "string" },
          q_ka: { type: "string" }, q_kha: { type: "string" }, q_ga: { type: "string" }, q_gha: { type: "string" },
          ans_ka: { type: "string" }, ans_kha: { type: "string" }, ans_ga: { type: "string" }, ans_gha: { type: "string" },
        },
        required: ["stimulus", "q_ka", "q_kha", "q_ga"],
      },
    },
    short: {
      type: "array",
      items: {
        type: "object",
        properties: { question: { type: "string" }, explanation: { type: "string" } },
        required: ["question"],
      },
    },
    descriptive: {
      type: "array",
      items: {
        type: "object",
        properties: { q_ka: { type: "string" }, q_kha: { type: "string" }, ans_ka: { type: "string" }, ans_kha: { type: "string" } },
        required: ["q_ka"],
      },
    },
  }[type];
  return { type: "object", properties: { questions: base }, required: ["questions"] };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = req.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return json({ error: "Unauthorized" }, 401);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseKey) return json({ error: "Auth is not configured" }, 503);
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (roleError) return json({ error: "Unable to verify access" }, 503);
    if (isAdmin !== true) return json({ error: "Forbidden" }, 403);

    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return json({ error: "Question extraction is not configured" }, 503);
    const model = Deno.env.get("GEMINI_MODEL")?.trim() || "gemini-3.5-flash-lite";

    const { type, text, imageBase64, imageMime, pdfBase64 }: {
      type: QuestionType;
      text?: string;
      imageBase64?: string;
      imageMime?: string;
      pdfBase64?: string;
    } = await req.json();
    if (!QUESTION_TYPES.includes(type)) return json({ error: "Invalid question type" }, 400);

    const parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [
      { text: `Extract all ${type.toUpperCase()} questions from the input. Return {"questions": [...]}.${text ? "\n\nText:\n" + text : ""}` },
    ];
    if (imageBase64) parts.push({ inlineData: { mimeType: imageMime || "image/png", data: imageBase64 } });
    if (pdfBase64) parts.push({ inlineData: { mimeType: "application/pdf", data: pdfBase64 } });

    const response = await fetch(`${GEMINI_MODELS_URL}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseFormat: {
            text: { mimeType: "APPLICATION_JSON", schema: schemaFor(type) },
          },
        },
      }),
    });

    if (!response.ok) {
      console.error("Gemini extraction request failed", response.status);
      return json({ error: "AI request failed", status: response.status }, response.status === 429 ? 429 : 502);
    }
    const data = await response.json();
    const responseParts: { text?: string; thought?: boolean }[] = data.candidates?.[0]?.content?.parts ?? [];
    const raw = responseParts.filter((part) => !part.thought).map((part) => part.text ?? "").join("");
    const parsed = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed?.questions)) return json({ error: "No question data returned" }, 502);
    return json({ questions: parsed.questions });
  } catch {
    console.error("Question extraction could not be completed");
    return json({ error: "Question extraction failed" }, 500);
  }
});
