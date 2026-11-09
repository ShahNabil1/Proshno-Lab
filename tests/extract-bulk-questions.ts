let handleRequest: (req: Request) => Promise<Response>;
const originalServe = Object.getOwnPropertyDescriptor(Deno, "serve")!;
Object.defineProperty(Deno, "serve", {
  configurable: true,
  value: (handler: typeof handleRequest) => { handleRequest = handler; },
});
try {
  await import("../supabase/functions/extract-bulk-questions/index.ts");
} finally {
  Object.defineProperty(Deno, "serve", originalServe);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const questions = [{ question: "একটি মৌলিক সংখ্যা লেখো।", explanation: "২" }];
const payload = { type: "short", text: "Bangla and English sample", imageBase64: "aW1hZ2U=", pdfBase64: "cGRm" };

function extractionRequest(withAuth = true) {
  return new Request("https://functions.test/extract-bulk-questions", {
    method: "POST",
    headers: withAuth ? { Authorization: "Bearer session-test" } : {},
    body: JSON.stringify(payload),
  });
}

async function withMockServices(isAdmin: boolean, run: (providerCalls: Request[]) => Promise<void>) {
  const env = {
    SUPABASE_URL: "https://database.test",
    SUPABASE_PUBLISHABLE_KEY: "public-test",
    GEMINI_API_KEY: "gemini-test",
    GEMINI_MODEL: "",
  };
  const previous = Object.keys(env).map((key) => [key, Deno.env.get(key)] as const);
  const originalFetch = globalThis.fetch;
  const providerCalls: Request[] = [];

  try {
    for (const [key, value] of Object.entries(env)) Deno.env.set(key, value);
    globalThis.fetch = async (input, init) => {
      const req = new Request(input, init);
      const url = new URL(req.url);
      if (url.pathname === "/auth/v1/user") {
        assert(req.headers.get("authorization") === "Bearer session-test", "Auth must verify the calling user's token");
        return Response.json({ id: "teacher-1" });
      }
      if (url.pathname === "/rest/v1/rpc/has_role") {
        const role = await req.json();
        assert(role._user_id === "teacher-1" && role._role === "admin", "Role check must use the verified user");
        return Response.json(isAdmin);
      }
      if (url.hostname === "generativelanguage.googleapis.com") {
        providerCalls.push(req);
        return Response.json({
          candidates: [{ content: { parts: [{ thought: true, text: "ignored" }, { text: JSON.stringify({ questions }) }] } }],
        });
      }
      throw new Error("Unexpected request during extraction");
    };
    await run(providerCalls);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of previous) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
}

Deno.test("anonymous requests and non-admin users never reach Gemini", async () => {
  await withMockServices(false, async (calls) => {
    assert((await handleRequest(extractionRequest(false))).status === 401, "Expected missing auth to return 401");
    assert((await handleRequest(extractionRequest())).status === 403, "Expected non-admin to return 403");
    assert(calls.length === 0, "Unauthorized request reached Gemini");
  });
});

Deno.test("admin extraction sends text, image and PDF and returns the questions envelope", async () => {
  await withMockServices(true, async (calls) => {
    const result = await handleRequest(extractionRequest());
    assert(result.ok, "Expected the provider result to be returned");
    assert(JSON.stringify(await result.json()) === JSON.stringify({ questions }), "The client contract changed");
    assert(calls.length === 1, "Expected exactly one direct Gemini request");
    const request = calls[0];
    assert(request.url.endsWith("/gemini-3.5-flash-lite:generateContent"), "Unexpected Gemini model or API method");
    assert(request.headers.get("x-goog-api-key") === "gemini-test", "The API key must use the provider header");
    const body = await request.json();
    const [text, image, pdf] = body.contents[0].parts;
    assert(text.text.includes(payload.text), "Text input was lost");
    assert(image.inlineData.mimeType === "image/png" && image.inlineData.data === payload.imageBase64, "Image input was lost");
    assert(pdf.inlineData.mimeType === "application/pdf" && pdf.inlineData.data === payload.pdfBase64, "PDF input was lost");
    const format = body.generationConfig.responseFormat.text;
    assert(format.mimeType === "APPLICATION_JSON", "Structured JSON output was not requested");
    assert(format.schema.properties.questions.type === "array", "Missing output schema");
  });
});
