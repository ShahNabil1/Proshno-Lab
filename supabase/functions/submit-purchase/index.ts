import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const {
      teacher_email, teacher_name, teacher_phone, institute_name,
      package_name, package_classes, package_price,
      coupon_code, discount, total_price,
      payment_method, transaction_id,
      logged_in_user_id,
    } = body;

    if (!teacher_email || !teacher_name || !payment_method || !transaction_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let teacherId = logged_in_user_id || null;

    // If not logged in, find or create user
    if (!teacherId) {
      // Check if user exists by email
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existing = existingUsers?.users?.find(
        (u) => u.email?.toLowerCase() === teacher_email.toLowerCase()
      );

      if (existing) {
        teacherId = existing.id;
      } else {
        // Create new user with a random password (they'll use Google OAuth)
        const randomPassword = crypto.randomUUID() + "Aa1!";
        const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: teacher_email,
          password: randomPassword,
          email_confirm: true,
          user_metadata: { full_name: teacher_name },
        });

        if (createErr) {
          console.error("Create user error:", createErr);
          return new Response(JSON.stringify({ error: "অ্যাকাউন্ট তৈরি করতে সমস্যা: " + createErr.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        teacherId = newUser.user.id;
      }
    }

    // Insert purchase request with teacher_id
    const { error: insertErr } = await supabaseAdmin.from("purchase_requests").insert({
      teacher_id: teacherId,
      teacher_name,
      teacher_email,
      teacher_phone: teacher_phone || "",
      institute_name: institute_name || "",
      package_name: package_name || "",
      package_classes: package_classes || "",
      package_price: package_price || 0,
      coupon_code: coupon_code || "",
      discount: discount || 0,
      total_price: total_price || 0,
      payment_method,
      transaction_id,
      status: "pending",
    });

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Increment coupon usage if applicable
    if (coupon_code) {
      await supabaseAdmin.rpc("increment_coupon_usage", { coupon_code: coupon_code.toUpperCase() });
    }

    return new Response(JSON.stringify({ success: true, teacher_id: teacherId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
