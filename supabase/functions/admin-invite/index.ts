import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROLES = ["super_admin","mentor","estrategista","cliente_dono","gestor_cliente","colaborador_cliente"] as const;
const STAFF_ROLES = ["super_admin","mentor","estrategista"];
const CLIENT_ROLES = ["cliente_dono","gestor_cliente","colaborador_cliente"];

const BodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  full_name: z.string().trim().min(2).max(120),
  role: z.enum(ROLES),
  company_id: z.string().uuid().nullable().optional(),
  resend: z.boolean().optional(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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

    // ====== Validações de segurança ======

    // 1. Apenas super_admin pode criar outro super_admin
    if (role === "super_admin" && !isSuperAdmin) {
      await writeAudit("falhou", { error_message: "Apenas Super Admin pode criar Super Admin" });
      return json({ error: "Apenas Super Admin pode criar outro Super Admin" }, 403);
    }

    // 2. Roles de cliente DEVEM ter empresa
    if (CLIENT_ROLES.includes(role) && !company_id) {
      await writeAudit("falhou", { error_message: "Cliente sem empresa" });
      return json({ error: "Clientes precisam estar vinculados a uma empresa" }, 400);
    }

    // 3. Se uma empresa foi informada, ela DEVE existir
    if (company_id) {
      const { data: company, error: cErr } = await supabase
        .from("companies").select("id, name").eq("id", company_id).maybeSingle();
      if (cErr || !company) {
        await writeAudit("falhou", { error_message: "Empresa inexistente" });
        return json({ error: "Empresa não encontrada ou inválida" }, 400);
      }

      // 4. Mentor/Estrategista (não super_admin) só pode convidar para empresas onde ele é membro
      if (!isSuperAdmin) {
        const { data: callerMembership } = await supabase
          .from("company_members").select("company_id")
          .eq("user_id", user.id).eq("company_id", company_id).maybeSingle();
        if (!callerMembership) {
          await writeAudit("falhou", { error_message: "Mentor não vinculado à empresa-alvo" });
          return json({ error: "Você só pode convidar usuários para empresas das quais faz parte" }, 403);
        }
      }
    }

    // 5. Staff (mentor/estrategista) NÃO deve ser vinculado a empresa cliente como membro de equipe
    //    A menos que isso seja explicitamente desejado: aqui permitimos, mas registramos no audit.

    const origin = req.headers.get("origin") || req.headers.get("referer") || "";
    const redirectTo = origin ? `${origin.replace(/\/$/, "").split("?")[0]}/auth` : undefined;

    // ====== Verifica se email já existe ======
    const { data: existingUserList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existingUser = existingUserList?.users?.find((u: any) => u.email?.toLowerCase() === email);

    if (existingUser && !resend) {
      // Usuário já existe e não é reenvio explícito
      await writeAudit("falhou", { error_message: "Email já cadastrado", invited_user_id: existingUser.id });
      return json({
        error: "Este email já possui uma conta. Use 'Reenviar convite' se o usuário ainda não confirmou.",
        existing_user_id: existingUser.id,
        confirmed: !!existingUser.email_confirmed_at,
      }, 409);
    }

    // ====== Reenvio: usuário deve existir e NÃO estar confirmado ======
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

      // NÃO sobrescreve role nem company_members no reenvio — apenas reenvia o email
      await writeAudit("reenviado", { invited_user_id: existingUser.id });
      return json({ ok: true, resent: true, user_id: existingUser.id });
    }

    // ====== Convite novo ======
    const { data: invited, error: invErr } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo, data: { full_name },
    });
    if (invErr) {
      await writeAudit("falhou", { error_message: invErr.message });
      return json({ error: invErr.message }, 400);
    }
    const newUserId = invited.user!.id;

    await supabase.from("profiles").upsert({ user_id: newUserId, full_name }, { onConflict: "user_id" });

    // Atribui role (idempotente)
    const { data: existingRole } = await supabase.from("user_roles")
      .select("id").eq("user_id", newUserId).eq("role", role).maybeSingle();
    if (!existingRole) {
      await supabase.from("user_roles").insert({ user_id: newUserId, role });
    }

    // Vincula à empresa (idempotente — uma única vez por empresa)
    if (company_id) {
      const { data: existingMember } = await supabase.from("company_members")
        .select("id").eq("user_id", newUserId).eq("company_id", company_id).maybeSingle();
      if (!existingMember) {
        await supabase.from("company_members").insert({ company_id, user_id: newUserId, member_role: role });
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
