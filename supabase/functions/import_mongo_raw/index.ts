import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return new Response(
        JSON.stringify({ success: false, error: "Expected multipart/form-data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formData = await req.formData();
    const collection = formData.get("collection");
    const file = formData.get("file");

    if (!collection || typeof collection !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Missing or invalid 'collection' field" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!file || !(file instanceof File)) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing 'file' field" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const text = await file.text();
    const lines = text.split("\n");

    const rows: { mongo_collection: string; mongo_id: string; doc: unknown }[] = [];
    let skippedLines = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        rows.push({
          mongo_collection: parsed.mongo_collection || collection,
          mongo_id: parsed.mongo_id || parsed._id?.$oid || parsed._id || "",
          doc: parsed.doc !== undefined ? parsed.doc : parsed,
        });
      } catch {
        skippedLines++;
      }
    }

    const BATCH_SIZE = 500;
    const MAX_RETRIES = 3;
    let totalInserted = 0;
    let totalUpdated = 0;
    let batchCount = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      let success = false;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const { data, error } = await supabase
          .from("mongo_raw")
          .upsert(batch, {
            onConflict: "mongo_collection,mongo_id",
            ignoreDuplicates: false,
          })
          .select("mongo_id");

        if (!error) {
          // Supabase upsert doesn't distinguish inserts vs updates directly.
          // We count all rows as processed; approximate by batch size.
          const processed = data?.length ?? batch.length;
          totalInserted += processed;
          success = true;
          batchCount++;
          break;
        }

        if (attempt === MAX_RETRIES - 1) {
          console.error(`Batch ${batchCount + 1} failed after ${MAX_RETRIES} retries:`, error.message);
          // Count these as skipped but continue
          skippedLines += batch.length;
        } else {
          // Wait before retry with exponential backoff
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    const durationMs = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        inserted: totalInserted,
        updated: totalUpdated,
        batches: batchCount,
        skipped_lines: skippedLines,
        duration_ms: durationMs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
