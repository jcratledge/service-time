// supabase/functions/invite-worker/index.ts
//
// This function runs on Supabase's servers, NOT in the browser.
// It uses the service role key (kept secret on the server) to:
//   1. Invite the worker by email (creates their auth.users login identity)
//   2. Insert their profile into public.users using THAT SAME id
//
// This is what fixes the "two disconnected ID systems" bug.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // CORS headers so the browser can call this function
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { first_name, last_name, email, case_number, judge_name, court_email, target_hours, manager_id } =
    await req.json();

    if (!email || !manager_id) {
      return new Response(
        JSON.stringify({ error: "email and manager_id are required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Service role client — full admin rights, only ever runs server-side
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Step 1: invite the worker. This creates their auth.users row
    // and sends them an email with a link to set their password.
    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (inviteError) {
      return new Response(
        JSON.stringify({ error: "Invite failed: " + inviteError.message }),
        { status: 400, headers: corsHeaders }
      );
    }

    const newAuthId = inviteData.user.id;

    // Step 2: insert the profile using the SAME id as the auth user.
    // This is the line that fixes the mismatch — without explicitly
    // setting id here, Postgres would generate a random, unrelated one.
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("users")
      .insert([
        {
          id: newAuthId,
          role: "worker",
          manager_id,
          first_name,
          last_name,
          email,
          case_number,
          judge_name,
          court_email,
          target_hours: target_hours ? Number(target_hours) : null,
        },
      ])
      .select()
      .single();

    if (profileError) {
      // Rough edge case: invite succeeded but profile insert failed.
      // We could roll back the invite here, but for now we surface
      // the error clearly so it's visible instead of silently broken.
      return new Response(
        JSON.stringify({ error: "Profile insert failed: " + profileError.message }),
        { status: 400, headers: corsHeaders }
      );
    }

    return new Response(JSON.stringify({ worker: profileData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});