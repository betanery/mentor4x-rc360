import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROLES = ["super_admin","mentor","estrategista","cliente_dono","gestor_cliente","colaborador_cliente"] as const;
const CLIENT_ROLES = ["cliente_dono","gestor_cliente","colaborador_cliente"];

const BodySchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1).max(120),
  role: z.enum(ROLES),
  company_id: z.string().uuid().nullable().optional(),
  resend: z.boolean().optional(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (!user) return json({ error: "unauthenticated" }, 401);

    const { data: callerRoles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const isStaff = (callerRoles || []).some((r: any) => ["super_admin","mentor","estrategista"].includes(r.role));
    if (!isStaff) return json({ error: "forbidden" }, 403);
    const isSuperAdmin = (callerRoles || []).some((r: any) => r.role === "super_admin");

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, 400);
    const { email, full_name, role, company_id, resend } = parsed.data;

    if (role === "super_admin" && !isSuperAdmin) return json({ error: "Apenas Super Admin pode criar outro Super Admin" }, 403);
    if (CLIENT_ROLES.includes(role) && !company_id) return json({ error: "Clientes devem ser vinculados a uma empresa" }, 400);

    const origin = req.headers.get("origin") || req.headers.get("referer") || "";
    const redirectTo = origin ? `${origin.replace(/\/$/, "")}/auth` : undefined;

    // Resend flow: just resend the invite to existing user
    if (resend) {
      const { data: invited, error: invErr } = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo, data: { full_name },
      });
      if (invErr) return json({ error: invErr.message }, 400);
      return json({ ok: true, resent: true, user_id: invited.user?.id });
    }

    // Invite new user
    const { data: invited, error: invErr } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo, data: { full_name },
    });
    if (invErr) {
      const msg = invErr.message || "";
      if (/already.*registered|exists/i.test(msg)) {
        return json({ error: "Este email já possui uma conta. Use 'Reenviar convite' se necessário." }, 409);
      }
      return json({ error: msg }, 400);
    }
    const newUserId = invited.user!.id;

    // Ensure profile name is set (trigger may have used email as fallback)
    await supabase.from("profiles").upsert({ user_id: newUserId, full_name }, { onConflict: "user_id" });

    // Assign role (avoid duplicate)
    const { data: existing } = await supabase.from("user_roles").select("id").eq("user_id", newUserId).eq("role", role).maybeSingle();
    if (!existing) await supabase.from("user_roles").insert({ user_id: newUserId, role });

    if (company_id) {
      await supabase.from("company_members").insert({ company_id, user_id: newUserId, member_role: role });
    }

    return json({ ok: true, user_id: newUserId });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
