import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROLES = ["super_admin","mentor","estrategista","company_responsible","company_leader","cliente_dono","gestor_cliente","colaborador_cliente"] as const;
const STAFF_ROLES = ["super_admin","mentor","estrategista"];
const CLIENT_ROLES = ["company_responsible","company_leader","cliente_dono","gestor_cliente","colaborador_cliente"];

const BodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  full_name: z.string().trim().min(2).max(120),
  role: z.enum(ROLES),
  company_id: z.string().uuid().nullable().optional(),
  resend: z.boolean().optional(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function safeRedirectTo(req: Request): string | undefined {
  const configured = (Deno.env.get("APP_ALLOWED_ORIGINS") || "")
    .split(",")
    .map((v) => v.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const appUrl = (Deno.env.get("APP_URL") || "").trim().replace(/\/$/, "");
  if (appUrl && !configured.includes(appUrl)) configured.push(appUrl);

  const raw = req.headers.get("origin") || req.headers.get("referer") || "";
  let requestOrigin = "";
  try { requestOrigin = raw ? new URL(raw).origin : ""; } catch { requestOrigin = ""; }

  if (requestOrigin && configured.includes(requestOrigin)) return `${requestOrigin}/auth`;
  if (appUrl) return `${appUrl}/auth`;
  return undefined;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let callerId: string | null = null;
  let auditPayload: any = null;

  const writeAudit = async (status: string, extra: Record<string, any> = {}) => {
    if (!auditPayload) return;
    try {
      await supabase.from("invite_audit").insert({ ...auditPayload, status, invited_by: callerId, ...extra });
    } catch (e) {
      console.error("audit log failed", e);
    }
  };

  try {
    const auth = req.headers.get("Authorization") || "";
    const { data: { user } } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (!user) return json({ error: "Não autenticado" }, 401);
    callerId = user.id;

    const { data: callerRoles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const callerRoleList = (callerRoles || []).map((r: any) => r.role);
    const isStaff = callerRoleList.some((r) => STAFF_ROLES.includes(r));
    if (!isStaff) return json({ error: "Acesso negado: apenas equipe interna pode convidar usuários" }, 403);
    const isSuperAdmin = callerRoleList.includes("super_admin");

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, 400);
    }
    const { email, full_name, role, company_id, resend } = parsed.data;

    auditPayload = { email, full_name, role, company_id: company_id || null };

    if (STAFF_ROLES.includes(role) && !isSuperAdmin) {
      await writeAudit("falhou", { error_message: "Apenas Super Admin pode atribuir funções internas" });
      return json({ error: "Apenas o Super Admin pode convidar Consultores, Estrategistas ou outros administradores" }, 403);
    }

    if (CLIENT_ROLES.includes(role) && !company_id && !resend) {
      await writeAudit("falhou", { error_message: "Cliente sem empresa" });
      return json({ error: "Clientes precisam estar vinculados a uma empresa" }, 400);
    }

    if (company_id) {
      const { data: company, error: cErr } = await supabase
        .from("companies").select("id, name").eq("id", company_id).maybeSingle();
      if (cErr || !company) {
        await writeAudit("falhou", { error_message: "Empresa inexistente" });
        return json({ error: "Empresa não encontrada ou inválida" }, 400);
      }

      if (!isSuperAdmin) {
        const [{ data: legacyMembership }, { data: contextualAccess }] = await Promise.all([
          supabase.from("company_members").select("company_id").eq("user_id", user.id).eq("company_id", company_id).maybeSingle(),
          supabase.from("company_access").select("company_id").eq("user_id", user.id).eq("company_id", company_id).eq("status", "ativo").maybeSingle(),
        ]);
        if (!legacyMembership && !contextualAccess) {
          await writeAudit("falhou", { error_message: "Staff não vinculado à empresa-alvo" });
          return json({ error: "Você só pode convidar usuários para empresas das quais faz parte" }, 403);
        }
      }
    }

    const redirectTo = safeRedirectTo(req);

    const { data: existingUserList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existingUser = existingUserList?.users?.find((u: any) => u.email?.toLowerCase() === email);

    if (existingUser && !resend) {
      await writeAudit("falhou", { error_message: "Email já cadastrado", invited_user_id: existingUser.id });
      return json({
        error: "Este email já possui uma conta. Use 'Reenviar convite' se o usuário ainda não confirmou.",
        existing_user_id: existingUser.id,
        confirmed: !!existingUser.email_confirmed_at,
      }, 409);
    }

    if (resend) {
      if (!existingUser) {
        await writeAudit("falhou", { error_message: "Usuário não existe para reenvio" });
        return json({ error: "Não existe convite pendente para este email" }, 404);
      }
      if (existingUser.email_confirmed_at) {
        await writeAudit("falhou", { error_message: "Usuário já confirmado", invited_user_id: existingUser.id });
        return json({ error: "Este usuário já confirmou o email — não há convite pendente" }, 409);
      }

      const { error: invErr } = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo, data: { full_name },
      });
      if (invErr) {
        await writeAudit("falhou", { error_message: invErr.message, invited_user_id: existingUser.id });
        return json({ error: invErr.message }, 400);
      }

      await writeAudit("reenviado", { invited_user_id: existingUser.id });
      return json({ ok: true, resent: true, user_id: existingUser.id });
    }

    const { data: invited, error: invErr } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo, data: { full_name },
    });
    if (invErr) {
      await writeAudit("falhou", { error_message: invErr.message });
      return json({ error: invErr.message }, 400);
    }
    const newUserId = invited.user!.id;

    await supabase.from("profiles").upsert({ user_id: newUserId, full_name }, { onConflict: "user_id" });

    if (!['company_responsible', 'company_leader'].includes(role)) {
      const { data: existingRole } = await supabase.from("user_roles")
        .select("id").eq("user_id", newUserId).eq("role", role).maybeSingle();
      if (!existingRole) await supabase.from("user_roles").insert({ user_id: newUserId, role });
    }

    if (company_id) {
      const { data: existingMember } = await supabase.from("company_members")
        .select("id").eq("user_id", newUserId).eq("company_id", company_id).maybeSingle();
      if (!existingMember) {
        await supabase.from("company_members").insert({ company_id, user_id: newUserId, member_role: role });
      }
      if (['company_responsible', 'company_leader'].includes(role)) {
        const isResponsible = role === 'company_responsible';
        const { data: currentPrimary } = isResponsible
          ? await supabase.from("company_access").select("id").eq("company_id", company_id)
              .eq("is_primary_responsible", true).eq("status", "ativo").limit(1).maybeSingle()
          : { data: null };
        const isPrimary = isResponsible && !currentPrimary;
        const accessPayload = {
          company_id, user_id: newUserId, access_role: role,
          job_title_code: isResponsible ? 'dono' : 'gerente',
          is_primary_responsible: isPrimary,
          diagnostic_group: isPrimary ? 'responsavel_principal' : isResponsible ? 'dono_socio' : 'gestor',
          diagnostic_weight: isPrimary ? 0.40 : isResponsible ? 0.30 : 0.20,
          status: 'ativo', invited_by: user.id,
        };
        const { data: existingAccess } = await supabase.from("company_access").select("id")
          .eq("user_id", newUserId).eq("company_id", company_id).is("contract_id", null).maybeSingle();
        const { error: accessErr } = existingAccess
          ? await supabase.from("company_access").update(accessPayload).eq("id", existingAccess.id)
          : await supabase.from("company_access").insert(accessPayload);
        if (accessErr) throw accessErr;
      }
    }

    await writeAudit("enviado", { invited_user_id: newUserId });
    return json({ ok: true, user_id: newUserId });
  } catch (e) {
    console.error("admin-invite error", e);
    await writeAudit("falhou", { error_message: String(e) });
    return json({ error: String(e) }, 500);
  }
});
