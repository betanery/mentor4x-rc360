// Resposta pública do Diagnóstico 4X por link (geral ou individual).
// O visitante nunca fala com as tabelas: esta função resolve o token, valida as
// respostas e grava com a chave de serviço, vinculando empresa e contratação
// exatamente como cadastradas no convite.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const BLINDSPOT_CODES = [
  "BS-C1", "BS-C2", "BS-C3", "BS-C4", "BS-C5",
  "BS-E1", "BS-E2", "BS-E3", "BS-E4", "BS-E5",
  "BS-X1", "BS-X2", "BS-X3", "BS-X4", "BS-X5",
  "BS-L1", "BS-L2", "BS-L3", "BS-L4", "BS-L5",
];
const IDD_KEYS = ["decisoes", "vendas", "financeiro", "operacao", "clientes", "equipe", "problemas", "conhecimento"];
const MAT_KEYS = ["capacidades", "padroes", "rituais", "evidencias", "indicadores", "alcadas", "sucessao", "melhoria"];
const VALID_IDS = new Set([
  ...BLINDSPOT_CODES,
  ...IDD_KEYS.map((k) => `IDD-${k}`),
  ...MAT_KEYS.map((k) => `MAT-${k}`),
]);
const GROUPS = new Set(["dono_socio", "gestor", "equipe"]);

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

async function ipHash(req: Request): Promise<string> {
  const ip =
    req.headers.get("cf-connecting-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "desconhecido";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`mentor4x:${ip}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const LIMITS: Record<string, number> = { resolve: 60, submit: 15 };

async function throttled(admin: any, hash: string, action: string): Promise<boolean> {
  const limit = LIMITS[action];
  if (!limit) return false;
  const now = new Date();
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()));
  const key = `diag_${action}`;
  const { data: existing } = await admin
    .from("lead_throttle")
    .select("id,count")
    .eq("ip_hash", hash)
    .eq("action", key)
    .eq("window_start", windowStart.toISOString())
    .maybeSingle();
  if (!existing) {
    await admin.from("lead_throttle").insert({ ip_hash: hash, action: key, window_start: windowStart.toISOString(), count: 1 });
    return false;
  }
  if (existing.count >= limit) return true;
  await admin.from("lead_throttle").update({ count: existing.count + 1 }).eq("id", existing.id);
  return false;
}

/** Convite válido, dentro do prazo e com diagnóstico ainda em coleta. */
async function loadInvite(admin: any, token: string) {
  const { data: invite } = await admin
    .from("diagnostic_invites")
    .select("id,diagnostic_id,company_id,contract_id,invite_kind,full_name,role_title,respondent_group,status,expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!invite) return { error: "invite_not_found" as const };
  if (new Date(invite.expires_at) < new Date() || invite.status === "cancelado") {
    return { error: "invite_expired" as const };
  }
  const { data: diag } = await admin
    .from("diagnostics")
    .select("id,status,company_id")
    .eq("id", invite.diagnostic_id)
    .maybeSingle();
  if (!diag) return { error: "invite_not_found" as const };
  if (diag.status !== "rascunho") return { error: "collection_closed" as const };
  const { data: company } = await admin.from("companies").select("name").eq("id", invite.company_id).maybeSingle();
  return { invite, company_name: company?.name ?? "sua empresa" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = str(body?.action, 20);
    const token = str(body?.token, 80);
    if (!action || !token) return json({ error: "invalid_request" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    const hash = await ipHash(req);
    if (await throttled(admin, hash, action)) {
      return json({ error: "rate_limited", message: "Muitas tentativas a partir desta conexão. Tente novamente mais tarde." }, 429);
    }

    const loaded = await loadInvite(admin, token);
    if ("error" in loaded) {
      const map: Record<string, string> = {
        invite_not_found: "Este link não é válido. Peça um novo link ao seu Consultor 4X.",
        invite_expired: "Este link expirou. Peça um novo link ao seu Consultor 4X.",
        collection_closed: "A coleta deste diagnóstico já foi encerrada.",
      };
      return json({ error: loaded.error, message: map[loaded.error] }, 410);
    }
    const { invite, company_name } = loaded;

    if (action === "resolve") {
      return json({
        company_name,
        invite_kind: invite.invite_kind,
        full_name: invite.full_name,
        role_title: invite.role_title,
        respondent_group: invite.respondent_group,
        already_responded: invite.invite_kind === "individual" && invite.status === "respondido",
      });
    }

    if (action === "submit") {
      if (invite.invite_kind === "individual" && invite.status === "respondido") {
        return json({ error: "already_responded", message: "Esta resposta já foi registrada. Obrigado!" }, 409);
      }

      const full_name = str(body?.full_name, 120) || invite.full_name || "";
      const role_title = str(body?.role_title, 120) || invite.role_title || "";
      const group = invite.invite_kind === "individual" ? invite.respondent_group : str(body?.respondent_group, 20);
      if (!full_name) return json({ error: "invalid_name", message: "Informe seu nome." }, 400);
      if (!GROUPS.has(group)) return json({ error: "invalid_group", message: "Selecione seu papel na empresa." }, 400);

      const raw = body?.answers;
      if (!raw || typeof raw !== "object") return json({ error: "invalid_answers" }, 400);
      const answers: Record<string, number> = {};
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (!VALID_IDS.has(k)) continue;
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1 || n > 5) continue;
        answers[k] = n;
      }
      const answeredBlindspots = BLINDSPOT_CODES.filter((c) => answers[c]).length;
      if (answeredBlindspots < BLINDSPOT_CODES.length) {
        return json({ error: "incomplete", message: "Responda todas as afirmações antes de enviar." }, 400);
      }

      const { data: inserted, error } = await admin
        .from("diagnostic_responses")
        .insert({
          diagnostic_id: invite.diagnostic_id,
          respondent_name: full_name,
          respondent_role: role_title || null,
          respondent_group: group,
          collection_method: "link",
          answers,
        })
        .select("id")
        .single();
      if (error) {
        console.error("diagnostic-response insert failed", error.message);
        return json({ error: "save_failed", message: "Não foi possível registrar sua resposta agora." }, 500);
      }

      if (invite.invite_kind === "individual") {
        await admin
          .from("diagnostic_invites")
          .update({ status: "respondido", responded_at: new Date().toISOString(), response_id: inserted.id })
          .eq("id", invite.id);
      }

      return json({ ok: true, company_name });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("diagnostic-response error", e instanceof Error ? e.message : String(e));
    return json({ error: "unexpected" }, 500);
  }
});
