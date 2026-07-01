import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { first_name, last_name, email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "email is required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (inviteError) {
      return new Response(
        JSON.stringify({ error: "Invite failed: " + inviteError.message }),
        { status: 400, headers: corsHeaders }
      );
    }

    const newAuthId = inviteData.user.id;

    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("users")
      .insert([{
        id: newAuthId,
        role: "manager",
        first_name,
        last_name,
        email,
      }])
      .select()
      .single();

    if (profileError) {
      return new Response(
        JSON.stringify({ error: "Profile insert failed: " + profileError.message }),
        { status: 400, headers: corsHeaders }
      );
    }

    return new Response(JSON.stringify({ manager: profileData }), {
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