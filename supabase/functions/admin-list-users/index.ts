import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STAFF_ROLES = ["super_admin","mentor","estrategista"];
const INVITE_TTL_HOURS = 24;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const auth = req.headers.get("Authorization") || "";
    const { data: { user } } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: callerRoles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const isStaff = (callerRoles || []).some((r: any) => STAFF_ROLES.includes(r.role));
    if (!isStaff) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // List all users (paginate up to 1000)
    const { data: list, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const now = Date.now();
    const users = (list?.users || []).map((u: any) => {
      const confirmed = !!u.email_confirmed_at;
      const invitedAt = u.invited_at ? new Date(u.invited_at).getTime() : null;
      const lastSignIn = u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : null;
      let status: "confirmado" | "pendente" | "expirado" = "pendente";
      if (confirmed || lastSignIn) status = "confirmado";
      else if (invitedAt && now - invitedAt > INVITE_TTL_HOURS * 3600 * 1000) status = "expirado";
      return {
        id: u.id,
        email: u.email,
        confirmed_at: u.email_confirmed_at,
        invited_at: u.invited_at,
        last_sign_in_at: u.last_sign_in_at,
        status,
      };
    });

    return new Response(JSON.stringify({ users }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
