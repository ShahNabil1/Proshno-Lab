import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      event_name,
      user_id,
      params,
      timestamp,
      page_url,
      page_path,
      user_agent,
      referrer,
    } = body;

    if (!event_name) {
      return new Response(
        JSON.stringify({ error: "event_name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Store event in analytics_events table
    const { error } = await supabase.from("analytics_events").insert({
      event_name,
      user_id,
      params,
      page_url,
      page_path,
      user_agent,
      referrer,
      client_timestamp: timestamp,
      ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null,
    });

    if (error) {
      console.error("Insert error:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Forward to GTM Server-Side container if configured
    const gtmServerUrl = Deno.env.get("GTM_SERVER_URL");
    if (gtmServerUrl) {
      try {
        await fetch(gtmServerUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: user_id || "anonymous",
            events: [{
              name: event_name,
              params: {
                ...params,
                page_location: page_url,
                page_path,
                user_agent,
                engagement_time_msec: 100,
              },
            }],
          }),
        });
      } catch (e) {
        console.error("GTM server-side forward error:", e);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Track event error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
