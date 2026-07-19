import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM = `You are an expert at extracting Bangla academic questions from raw text/images/PDFs.
Return ONLY valid JSON matching the schema. Do not include markdown code fences.
For MCQ: extract question, 4 options (a/b/c/d), correct answer letter, and explanation if present.
For CQ (creative): extract stimulus (উদ্দীপক), and 4 sub-questions ক/খ/গ/ঘ with answers if present.
For short: extract question and answer.
For descriptive: extract question(s) and answer(s).
Preserve Bangla text exactly. Keep math/LaTeX as-is.`;

const schemaFor = (type: string) => {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { type, text, imageBase64, imageMime, pdfBase64 } = await req.json();
    if (!type || !["mcq", "cq", "short", "descriptive"].includes(type)) {
      return new Response(JSON.stringify({ error: "invalid type" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const content: any[] = [];
    const instruction = `Extract all ${type.toUpperCase()} type Bangla questions from the input. Return {"questions": [...]}.`;
    content.push({ type: "text", text: instruction + (text ? "\n\nText:\n" + text : "") });
    if (imageBase64) content.push({ type: "image_url", image_url: { url: `data:${imageMime || "image/png"};base64,${imageBase64}` } });
    if (pdfBase64) content.push({ type: "file", file: { filename: "input.pdf", file_data: `data:application/pdf;base64,${pdfBase64}` } });

    const body = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "extract_questions", strict: true, schema: schemaFor(type) },
      },
    };

    const resp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error("Gateway error", resp.status, err);
      return new Response(JSON.stringify({ error: "AI request failed", status: resp.status, details: err }),
        { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
