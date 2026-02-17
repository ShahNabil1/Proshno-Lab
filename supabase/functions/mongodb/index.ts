import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { MongoClient } from "npm:mongodb@6.12.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let client: MongoClient | null = null;

async function getClient(): Promise<MongoClient> {
  if (!client) {
    const uri = Deno.env.get("MONGODB_URI");
    if (!uri) throw new Error("MONGODB_URI not configured");
    client = new MongoClient(uri);
    await client.connect();
  }
  return client;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, collection, database, filter, document, documents, update, pipeline, sort, limit, skip } = body;

    if (!action || !collection || !database) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: action, collection, database" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mongo = await getClient();
    const db = mongo.db(database);
    const coll = db.collection(collection);

    let result: unknown;

    switch (action) {
      case "find": {
        let cursor = coll.find(filter || {});
        if (sort) cursor = cursor.sort(sort);
        if (skip) cursor = cursor.skip(skip);
        if (limit) cursor = cursor.limit(limit);
        result = { documents: await cursor.toArray() };
        break;
      }
      case "findOne": {
        result = { document: await coll.findOne(filter || {}) };
        break;
      }
      case "insertOne": {
        const ir = await coll.insertOne(document);
        result = { insertedId: ir.insertedId };
        break;
      }
      case "insertMany": {
        const imr = await coll.insertMany(documents);
        result = { insertedIds: imr.insertedIds };
        break;
      }
      case "updateOne": {
        const ur = await coll.updateOne(filter || {}, update);
        result = { matchedCount: ur.matchedCount, modifiedCount: ur.modifiedCount };
        break;
      }
      case "updateMany": {
        const umr = await coll.updateMany(filter || {}, update);
        result = { matchedCount: umr.matchedCount, modifiedCount: umr.modifiedCount };
        break;
      }
      case "deleteOne": {
        const dr = await coll.deleteOne(filter || {});
        result = { deletedCount: dr.deletedCount };
        break;
      }
      case "deleteMany": {
        const dmr = await coll.deleteMany(filter || {});
        result = { deletedCount: dmr.deletedCount };
        break;
      }
      case "aggregate": {
        result = { documents: await coll.aggregate(pipeline || []).toArray() };
        break;
      }
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
