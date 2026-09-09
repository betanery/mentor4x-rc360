import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor, originAllowed } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STAFF_ROLES = ["super_admin","mentor","estrategista"];
const INVITE_TTL_HOURS = 24;

type Company = { id: string; name: string };
type Profile = { user_id: string; full_name: string | null; avatar_url: string | null; job_title: string | null; phone: string | null };
type MemberRow = { user_id: string; company_id: string; member_role: string; is_primary: boolean | null };
type AccessRow = { user_id: string; company_id: string; access_role: string; is_primary_responsible: boolean | null; status: string };
type MemberEntry = { company_id: string; member_role: string; is_primary?: boolean | null; company?: Company | null };
type AuthUser = { id: string; email?: string | null; email_confirmed_at?: string | null; invited_at?: string | null; last_sign_in_at?: string | null };

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { status: originAllowed(req) ? 204 : 403, headers: corsHeaders });
  if (!originAllowed(req)) return new Response(JSON.stringify({ error: "origin_not_allowed" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const auth = req.headers.get("Authorization") || "";
    const { data: { user } } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (!user) return json({ error: "unauthenticated" }, 401);

    const { data: callerRoles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const roleList = (callerRoles || []).map((r: { role: string }) => r.role);
    const isStaff = roleList.some((r: string) => STAFF_ROLES.includes(r));
    if (!isStaff) return json({ error: "forbidden" }, 403);

    // Somente Super Admin tem visão global. Mentor e Estrategista ficam limitados à carteira atribuída.
    const isFullScope = roleList.includes("super_admin");

    let scopedCompanyIds: string[] | null = null;
    if (!isFullScope) {
      const [{ data: memberships }, { data: accesses }] = await Promise.all([
        supabase.from("company_members").select("company_id").eq("user_id", user.id),
        supabase.from("company_access").select("company_id").eq("user_id", user.id).eq("status", "ativo"),
      ]);
      scopedCompanyIds = [...new Set([
        ...(memberships || []).map((m: { company_id: string }) => m.company_id),
        ...(accesses || []).map((a: { company_id: string }) => a.company_id),
      ])];
    }

    const page = Math.max(1, Number(new URL(req.url).searchParams.get("page") ?? "1"));
    const perPage = Math.min(200, Math.max(10, Number(new URL(req.url).searchParams.get("per_page") ?? "200")));

    const companiesQuery = supabase.from("companies").select("id, name");
    const auditQuery = supabase.from("invite_audit").select("*").order("created_at", { ascending: false }).limit(200);
    if (scopedCompanyIds) {
      const ids = scopedCompanyIds.length ? scopedCompanyIds : ["00000000-0000-0000-0000-000000000000"];
      companiesQuery.in("id", ids);
      auditQuery.in("company_id", ids);
    }

    const [authList, profiles, roles, members, accesses, companies, audit] = await Promise.all([
      supabase.auth.admin.listUsers({ page, perPage }),
      supabase.from("profiles").select("user_id, full_name, avatar_url, job_title, phone"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("company_members").select("user_id, company_id, member_role, is_primary"),
      supabase.from("company_access").select("user_id, company_id, access_role, is_primary_responsible, status").eq("status", "ativo"),
      companiesQuery,
      auditQuery,
    ]);

    if (authList.error) return json({ error: authList.error.message }, 500);

    const now = Date.now();
    const companyMap = new Map((companies.data || []).map((c: Company) => [c.id, c]));
    const profileMap = new Map((profiles.data || []).map((p: Profile) => [p.user_id, p]));
    const rolesMap = new Map<string, string[]>();
    (roles.data || []).forEach((r: { user_id: string; role: string }) => {
      const arr = rolesMap.get(r.user_id) || [];
      arr.push(r.role);
      rolesMap.set(r.user_id, arr);
    });

    const membersMap = new Map<string, MemberEntry[]>();
    (members.data || []).forEach((m: MemberRow) => {
      if (scopedCompanyIds && !scopedCompanyIds.includes(m.company_id)) return;
      const arr = membersMap.get(m.user_id) || [];
      arr.push({ ...m, company: companyMap.get(m.company_id) });
      membersMap.set(m.user_id, arr);
    });
    (accesses.data || []).forEach((a: AccessRow) => {
      if (scopedCompanyIds && !scopedCompanyIds.includes(a.company_id)) return;
      const arr = membersMap.get(a.user_id) || [];
      if (!arr.some((m) => m.company_id === a.company_id && m.member_role === a.access_role)) {
        arr.push({ company_id: a.company_id, member_role: a.access_role, is_primary: a.is_primary_responsible, company: companyMap.get(a.company_id) });
      }
      membersMap.set(a.user_id, arr);
      const userRoles = rolesMap.get(a.user_id) || [];
      if (!userRoles.includes(a.access_role)) userRoles.push(a.access_role);
      rolesMap.set(a.user_id, userRoles);
    });

    const users = ((authList.data?.users || []) as AuthUser[]).map((u) => {
      const confirmed = !!u.email_confirmed_at;
      const invitedAt = u.invited_at ? new Date(u.invited_at).getTime() : null;
      const lastSignIn = u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : null;
      let status: "confirmado" | "pendente" | "expirado" = "pendente";
      if (confirmed || lastSignIn) status = "confirmado";
      else if (invitedAt && now - invitedAt > INVITE_TTL_HOURS * 3600 * 1000) status = "expirado";

      const profile = profileMap.get(u.id);
      return {
        id: u.id,
        email: u.email,
        confirmed_at: u.email_confirmed_at,
        invited_at: u.invited_at,
        last_sign_in_at: u.last_sign_in_at,
        status,
        profile: profile || null,
        roles: rolesMap.get(u.id) || [],
        memberships: membersMap.get(u.id) || [],
      };
    });

    const scopedUsers = scopedCompanyIds
      ? users.filter((u) =>
          u.id === user.id ||
          (u.memberships || []).some((m) => scopedCompanyIds!.includes(m.company_id)))
      : users;

    return json({
      users: scopedUsers,
      companies: companies.data || [],
      audit: audit.data || [],
      scope: isFullScope ? "global" : "empresa",
      page,
      per_page: perPage,
      has_more: (authList.data?.users || []).length === perPage,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
