import { LIVE_ORIGINS, normalizeMarketingContext, createBrowserServerEvent, hashIdentifier } from "../_shared/metaCapi.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
      user_id: _claimedUserId,
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
    // Derive account identity from authentication; never trust a posted user_id.
    let actualUser: { id: string; email?: string } | undefined;
    const authorization = req.headers.get("authorization");
    if (authorization) {
      const { data, error } = await supabase.auth.getUser(authorization.replace(/^Bearer /i, ""));
      if (!error && data.user) actualUser = { id: data.user.id, email: data.user.email };
    }
    const user_id = actualUser?.id || null;
    const origin = req.headers.get("origin") || "";
    if (origin && !LIVE_ORIGINS.has(origin) && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
      return new Response(JSON.stringify({ error: "Origin not allowed" }), { status: 403, headers: corsHeaders });
    }
    const safeParams = params && typeof params === "object" && !Array.isArray(params) ? params : {};
    if (LIVE_ORIGINS.has(origin) && body.marketing && typeof body.event_id === "string") {
      const context = normalizeMarketingContext(body.marketing, req);
      const { data: settings } = await supabase.from("meta_capi_settings").select("enabled,customer_matching").eq("singleton", true).maybeSingle();
      if (settings?.enabled) {
        try {
          if (event_name === "sign_up" && actualUser && body.event_id === `registration:${actualUser.id}`) {
            await supabase.rpc("enrich_meta_capi_registration", { user_ref: actualUser.id, context });
          } else {
            const event = await createBrowserServerEvent(event_name, safeParams, body.event_id, context, actualUser, settings.customer_matching);
            if (event) {
              const rateKey = await hashIdentifier(context.client_ip_address || context.fbp || "anonymous");
              await supabase.rpc("enqueue_meta_capi_event", { event, rate_key: rateKey });
            }
          }
        } catch { console.error("meta_capi_ingestion_failed"); }
      }
    }


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
