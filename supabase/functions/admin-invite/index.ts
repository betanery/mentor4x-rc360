import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Check caller is staff
    const { data: callerRoles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const isStaff = (callerRoles || []).some((r: any) => ["super_admin","mentor","estrategista"].includes(r.role));
    if (!isStaff) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { email, password, role, company_id } = await req.json();
    if (!email || !password || !role) return new Response(JSON.stringify({ error: "missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Only super_admin can create super_admin
    const isSuperAdmin = (callerRoles || []).some((r: any) => r.role === "super_admin");
    if (role === "super_admin" && !isSuperAdmin) return new Response(JSON.stringify({ error: "only super_admin can create super_admin" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: created, error: cErr } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (cErr) return new Response(JSON.stringify({ error: cErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    await supabase.from("user_roles").insert({ user_id: created.user!.id, role });
    if (company_id) {
      await supabase.from("company_members").insert({ company_id, user_id: created.user!.id, member_role: role });
    }

    return new Response(JSON.stringify({ ok: true, user_id: created.user!.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
