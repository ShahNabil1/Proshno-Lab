import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MONGODB_DATA_API = "https://data.mongodb-api.com/app/data-federated-database/endpoint/data/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const mongoUri = Deno.env.get("MONGODB_URI");
    if (!mongoUri) {
      return new Response(JSON.stringify({ error: "MONGODB_URI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, collection, database, filter, document, documents, update, pipeline, sort, limit, skip } = body;

    if (!action || !collection || !database) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: action, collection, database" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse MongoDB URI to extract cluster info for Data API
    // The edge function acts as a proxy to MongoDB Data API
    const apiKey = Deno.env.get("MONGODB_API_KEY") || "";
    
    let endpoint = "";
    let payload: Record<string, unknown> = {
      dataSource: body.dataSource || "Cluster0",
      database,
      collection,
    };

    switch (action) {
      case "find":
        endpoint = "/action/find";
        if (filter) payload.filter = filter;
        if (sort) payload.sort = sort;
        if (limit) payload.limit = limit;
        if (skip) payload.skip = skip;
        break;
      case "findOne":
        endpoint = "/action/findOne";
        if (filter) payload.filter = filter;
        break;
      case "insertOne":
        endpoint = "/action/insertOne";
        payload.document = document;
        break;
      case "insertMany":
        endpoint = "/action/insertMany";
        payload.documents = documents;
        break;
      case "updateOne":
        endpoint = "/action/updateOne";
        payload.filter = filter;
        payload.update = update;
        break;
      case "updateMany":
        endpoint = "/action/updateMany";
        payload.filter = filter;
        payload.update = update;
        break;
      case "deleteOne":
        endpoint = "/action/deleteOne";
        payload.filter = filter;
        break;
      case "deleteMany":
        endpoint = "/action/deleteMany";
        payload.filter = filter;
        break;
      case "aggregate":
        endpoint = "/action/aggregate";
        payload.pipeline = pipeline;
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const mongoRes = await fetch(`${MONGODB_DATA_API}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await mongoRes.json();

    return new Response(JSON.stringify(data), {
      status: mongoRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
