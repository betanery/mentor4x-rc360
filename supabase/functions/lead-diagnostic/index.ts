// Diagnóstico de Lead público (C6) — captura de UTM, autosave, retomada por token
// e recomendação sem matrícula. Nenhum acesso direto à tabela: o cliente público
// só fala com esta função, que valida e escreve com a chave de serviço.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Pillar = "crescimento" | "eficiencia" | "encantamento" | "lideranca";

const BLINDSPOTS: { code: string; title: string; pillar: Pillar }[] = [
  { code: "BS-C1", title: "Oferta indefinida", pillar: "crescimento" },
  { code: "BS-C2", title: "Previsibilidade comercial ausente", pillar: "crescimento" },
  { code: "BS-C3", title: "Geração de demanda improvisada", pillar: "crescimento" },
  { code: "BS-C4", title: "Time comercial sem método", pillar: "crescimento" },
  { code: "BS-C5", title: "Expansão sem base", pillar: "crescimento" },
  { code: "BS-E1", title: "Processos na cabeça das pessoas", pillar: "eficiencia" },
  { code: "BS-E2", title: "Indicadores sem fonte", pillar: "eficiencia" },
  { code: "BS-E3", title: "Financeiro sem controle", pillar: "eficiencia" },
  { code: "BS-E4", title: "Retrabalho e desperdício", pillar: "eficiencia" },
  { code: "BS-E5", title: "Tecnologia subutilizada", pillar: "eficiencia" },
  { code: "BS-X1", title: "Jornada do cliente indefinida", pillar: "encantamento" },
  { code: "BS-X2", title: "Onboarding travado", pillar: "encantamento" },
  { code: "BS-X3", title: "Sem escuta do cliente", pillar: "encantamento" },
  { code: "BS-X4", title: "Retenção não gerenciada", pillar: "encantamento" },
  { code: "BS-X5", title: "Marca sem consistência", pillar: "encantamento" },
  { code: "BS-L1", title: "Dependência do dono", pillar: "lideranca" },
  { code: "BS-L2", title: "Papéis e accountability difusos", pillar: "lideranca" },
  { code: "BS-L3", title: "Ausência de rituais de gestão", pillar: "lideranca" },
  { code: "BS-L4", title: "Time sem desenvolvimento", pillar: "lideranca" },
  { code: "BS-L5", title: "Decisão sem dado", pillar: "lideranca" },
];

const IDD_KEYS = ["decisoes", "vendas", "financeiro", "operacao", "clientes", "equipe", "problemas", "conhecimento"];
const ALL_IDS = [...BLINDSPOTS.map((b) => b.code), ...IDD_KEYS.map((k) => `IDD-${k}`)];

const toImproviso = (avg: number) => Math.round(((5 - avg) / 4) * 100);

function avg(values: number[]): number | null {
  const valid = values.filter((v) => typeof v === "number" && v >= 1 && v <= 5);
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

const PILLAR_LABEL: Record<Pillar, string> = {
  crescimento: "Crescimento",
  eficiencia: "Eficiência",
  encantamento: "Encantamento",
  lideranca: "Liderança",
};

function band(score: number) {
  if (score >= 80) return { key: "total", label: "Improviso Total" };
  if (score >= 60) return { key: "severo", label: "Improviso Severo" };
  if (score >= 40) return { key: "moderado", label: "Improviso Moderado" };
  if (score >= 20) return { key: "leve", label: "Improviso Leve" };
  return { key: "escala", label: "Em Escala" };
}

/** Recomendação de caminho — orientação, nunca matrícula automática. */
function recommend(improviso: number, idd: number, pillar: Pillar | null) {
  const focus = pillar ? PILLAR_LABEL[pillar] : "Eficiência";
  if (improviso >= 60 || idd >= 60) {
    return {
      track: "Estruturação profunda",
      headline: "A prioridade é tirar a empresa do improviso antes de acelerar.",
      why: `Improviso em ${improviso} e dependência do dono (IDD) em ${idd}. O ponto de partida é o pilar ${focus}.`,
      next_steps: [
        "Sessão de leitura do diagnóstico com um Consultor 4X",
        "Escolher no máximo 2 Metas Críticas para os próximos 30 dias",
        "Documentar os processos que hoje só existem na cabeça das pessoas",
      ],
    };
  }
  if (improviso >= 35) {
    return {
      track: "Aceleração com método",
      headline: "A base existe, mas a execução ainda oscila.",
      why: `Improviso em ${improviso} e IDD em ${idd}. O pilar ${focus} concentra o maior ganho imediato.`,
      next_steps: [
        "Fechar os BlindSpots prioritários com responsável e prazo",
        "Instalar rituais fixos de gestão (check-in semanal)",
        "Definir indicadores com fonte e frequência",
      ],
    };
  }
  return {
    track: "Escala e governança",
    headline: "A empresa está estruturada — o próximo salto é governança e autonomia.",
    why: `Improviso em ${improviso} e IDD em ${idd}. Foco em sustentar o padrão no pilar ${focus}.`,
    next_steps: [
      "Transferir decisões operacionais com alçadas claras",
      "Comparar resultados contra a linha de base a cada ciclo",
      "Formar líderes nos padrões já documentados",
    ],
  };
}

function compute(answers: Record<string, number>) {
  const pillars: Pillar[] = ["crescimento", "eficiencia", "encantamento", "lideranca"];
  const blindspots = BLINDSPOTS.map((bs) => {
    const a = avg([answers[bs.code]]);
    return { code: bs.code, title: bs.title, pillar: bs.pillar, improviso: a === null ? 0 : toImproviso(a) };
  }).sort((a, b) => b.improviso - a.improviso);

  const byPillar = pillars.map((pillar) => {
    const a = avg(BLINDSPOTS.filter((b) => b.pillar === pillar).map((b) => answers[b.code]));
    return { pillar, label: PILLAR_LABEL[pillar], improviso: a === null ? 0 : toImproviso(a) };
  });

  const geralAvg = avg(BLINDSPOTS.map((b) => answers[b.code]));
  const improvisoGeral = geralAvg === null ? 0 : toImproviso(geralAvg);

  const iddDims = IDD_KEYS.map((k) => {
    const a = avg([answers[`IDD-${k}`]]);
    return { key: k, score: a === null ? 0 : toImproviso(a) };
  });
  const iddScore = Math.round(iddDims.reduce((s, d) => s + d.score, 0) / (iddDims.length || 1));

  const answered = ALL_IDS.filter((id) => typeof answers[id] === "number").length;
  const priorityPillar = byPillar.slice().sort((a, b) => b.improviso - a.improviso)[0]?.pillar ?? null;

  return {
    improvisoGeral,
    band: band(improvisoGeral),
    byPillar,
    blindspots,
    top5: blindspots.slice(0, 5).map((b) => b.code),
    priorityPillar,
    priorityBlindspot: blindspots[0]?.code ?? null,
    idd: { score: iddScore, dimensions: iddDims },
    completeness: Math.round((answered / ALL_IDS.length) * 100),
    computedAt: new Date().toISOString(),
    // Leitura pública é indicativa: a Maturidade oficial só existe após validação humana.
    disclaimer: "Leitura indicativa gerada pelo SEE_4X. A validação oficial é feita por um Consultor 4X.",
  };
}

const token = () =>
  crypto.randomUUID().replace(/-/g, "") + Math.random().toString(36).slice(2, 8);

const str = (v: unknown, max = 200) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

function sanitizeAnswers(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!ALL_IDS.includes(k)) continue;
    const n = Number(v);
    if (Number.isInteger(n) && n >= 1 && n <= 5) out[k] = n;
  }
  return out;
}

const publicShape = (row: Record<string, unknown>) => ({
  resume_token: row.resume_token,
  status: row.status,
  current_step: row.current_step,
  full_name: row.full_name,
  email: row.email,
  phone: row.phone,
  company_name: row.company_name,
  segment: row.segment,
  revenue_band: row.revenue_band,
  team_size: row.team_size,
  role_title: row.role_title,
  answers: row.answers,
  result: row.result,
  recommendation: row.recommendation,
  completed_at: row.completed_at,
  consent_lgpd: row.consent_lgpd,
  consent_at: row.consent_at,
});

// ---- Fase 6b — LGPD e limitação de abuso -------------------------------------
export const CONSENT_VERSION = "lgpd-v1";
const CONSENT_TEXT =
  "Autorizo o tratamento dos dados informados para geração do diagnóstico e contato da equipe Mentor 4X (RC360).";

/** IP nunca é gravado em claro — apenas o hash. */
async function ipHash(req: Request): Promise<string> {
  const ip =
    req.headers.get("cf-connecting-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "desconhecido";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`mentor4x:${ip}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const LIMITS: Record<string, number> = { start: 5, save: 240, finish: 10, resume: 60 };

/** Janela fixa de 1 hora por origem e ação. Retorna true quando o limite foi excedido. */
async function throttled(admin: any, hash: string, action: string): Promise<boolean> {
  const limit = LIMITS[action];
  if (!limit) return false;
  const now = new Date();
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()));
  const { data: existing } = await admin
    .from("lead_throttle")
    .select("id,count")
    .eq("ip_hash", hash)
    .eq("action", action)
    .eq("window_start", windowStart.toISOString())
    .maybeSingle();

  if (!existing) {
    await admin.from("lead_throttle").insert({ ip_hash: hash, action, window_start: windowStart.toISOString(), count: 1 });
    return false;
  }
  if (existing.count >= limit) return true;
  await admin.from("lead_throttle").update({ count: existing.count + 1 }).eq("id", existing.id);
  return false;
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = str(body?.action, 20);
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const hash = await ipHash(req);
    if (action && (await throttled(admin, hash, action))) {
      return json({ error: "rate_limited", message: "Muitas tentativas a partir desta conexão. Tente novamente mais tarde." }, 429);
    }

    if (action === "start") {
      const t = token();
      const utm = body?.utm ?? {};
      const consent = body?.consent_lgpd === true;
      if (!consent) return json({ error: "consent_required", consent_text: CONSENT_TEXT }, 400);
      const { data, error } = await admin
        .from("lead_diagnostics")
        .insert({
          resume_token: t,
          consent_lgpd: true,
          consent_at: new Date().toISOString(),
          consent_version: CONSENT_VERSION,
          consent_ip_hash: hash,
          utm_source: str(utm?.utm_source, 120),
          utm_medium: str(utm?.utm_medium, 120),
          utm_campaign: str(utm?.utm_campaign, 160),
          utm_content: str(utm?.utm_content, 160),
          utm_term: str(utm?.utm_term, 160),
          referrer: str(body?.referrer, 400),
          landing_page: str(body?.landing_page, 400),
        })
        .select("*")
        .single();
      if (error) return json({ error: "start_failed" }, 500);
      return json({ lead: publicShape(data) });
    }


    const t = str(body?.resume_token, 80);
    if (!t || !/^[a-z0-9]{20,64}$/i.test(t)) return json({ error: "invalid_token" }, 400);

    const { data: existing } = await admin
      .from("lead_diagnostics")
      .select("*")
      .eq("resume_token", t)
      .maybeSingle();
    if (!existing) return json({ error: "not_found" }, 404);

    if (action === "resume") {
      await admin.from("lead_diagnostics").update({ last_seen_at: new Date().toISOString() }).eq("id", existing.id);
      return json({ lead: publicShape(existing) });
    }

    if (action === "save" || action === "finish") {
      if (existing.status !== "em_andamento" && action === "save") {
        return json({ lead: publicShape(existing) });
      }

      const answers = { ...(existing.answers as Record<string, number>), ...sanitizeAnswers(body?.answers) };
      const step = Number.isInteger(body?.current_step) ? Math.max(0, Math.min(20, body.current_step)) : existing.current_step;

      const patch: Record<string, unknown> = {
        answers,
        current_step: step,
        last_seen_at: new Date().toISOString(),
        full_name: str(body?.full_name, 160) ?? existing.full_name,
        email: str(body?.email, 200)?.toLowerCase() ?? existing.email,
        phone: str(body?.phone, 40) ?? existing.phone,
        company_name: str(body?.company_name, 160) ?? existing.company_name,
        segment: str(body?.segment, 120) ?? existing.segment,
        revenue_band: str(body?.revenue_band, 60) ?? existing.revenue_band,
        team_size: str(body?.team_size, 60) ?? existing.team_size,
        role_title: str(body?.role_title, 120) ?? existing.role_title,
      };

      if (action === "finish") {
        const answered = ALL_IDS.filter((id) => typeof answers[id] === "number").length;
        if (answered < ALL_IDS.length) return json({ error: "incomplete", answered, total: ALL_IDS.length }, 400);
        if (!patch.email) return json({ error: "email_required" }, 400);

        const result = compute(answers);
        patch.result = result;
        patch.improviso_score = result.improvisoGeral;
        patch.idd_score = result.idd.score;
        patch.priority_pillar = result.priorityPillar;
        patch.priority_blindspot = result.priorityBlindspot;
        patch.top5 = result.top5;
        patch.recommendation = recommend(result.improvisoGeral, result.idd.score, result.priorityPillar);
        patch.status = "concluido";
        patch.completed_at = new Date().toISOString();
      }

      const { data, error } = await admin
        .from("lead_diagnostics")
        .update(patch)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) return json({ error: "save_failed" }, 500);
      return json({ lead: publicShape(data) });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (_e) {
    return json({ error: "unexpected" }, 500);
  }
});
