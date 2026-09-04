import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCompanyAuthorization } from "../_shared/company-authorization.ts";
import { corsHeadersFor, originAllowed } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Alçada mínima exigida por ferramenta (Consultor 4X detém as decisões metodológicas). */
const REQUIRED_SCOPE: Record<string, "membro" | "estrategista" | "consultor"> = {
  create_goal: "consultor",
  create_bottleneck: "consultor",
  schedule_meeting: "estrategista",
};

const ENTITY_BY_TOOL: Record<string, string> = {
  create_goal: "goals",
  create_bottleneck: "bottlenecks",
  schedule_meeting: "meetings",
};

/** Ordena chaves para que o hash seja estável independentemente da ordem do JSON. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce((acc: Record<string, unknown>, k) => {
        acc[k] = canonical((value as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return value;
}

async function payloadHash(tool: string, args: unknown): Promise<string> {
  const text = JSON.stringify({ tool, args: canonical(args) });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function resolveContract(admin: any, companyId: string, contractId?: string | null) {
  if (!contractId) return { contractId: null, contract: null };
  const { data, error } = await admin
    .from("contracts")
    .select("id, company_id, status, journey_stage, current_cycle, product_id, product_version_id")
    .eq("id", contractId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { forbidden: true };
  return { contractId: data.id, contract: data };
}

const tools = [
  {
    type: "function",
    function: {
      name: "create_goal",
      description: "Cria uma meta crítica semanal para a empresa atual.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título curto e objetivo da meta." },
          description: { type: "string" },
          pillar: { type: "string", enum: ["crescimento", "eficiencia", "encantamento", "lideranca"] },
          indicator: { type: "string", description: "KPI ou indicador mensurável." },
          financial_impact: { type: "number", description: "Impacto financeiro estimado em reais." },
          due_date: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_bottleneck",
      description: "Registra um gargalo/trava da operação.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          area: { type: "string" },
          impact: { type: "string" },
          urgency: { type: "string", enum: ["baixa", "media", "alta", "critica"] },
          estimated_value: { type: "number" },
          correction_plan: { type: "string" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_meeting",
      description: "Agenda uma reunião (apenas staff atribuído à empresa).",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          scheduled_at: { type: "string", description: "ISO datetime" },
          duration_min: { type: "number" },
          meeting_type: { type: "string", enum: ["sala_guerra", "estrategia", "kickoff", "review", "checkin_semanal"] },
          meeting_url: { type: "string" },
        },
        required: ["title", "scheduled_at"],
      },
    },
  },
];

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { status: originAllowed(req) ? 204 : 403, headers: corsHeaders });
  if (!originAllowed(req)) return new Response(JSON.stringify({ error: "origin_not_allowed" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const { instruction, company_id, contract_id, confirm, decision, proposal_ids } = body;
    if (!company_id) return json({ error: "company_id required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authorization = await getCompanyAuthorization(admin, userId, company_id);
    if (!authorization.allowed) return json({ error: "Forbidden" }, 403);

    const isStaff = authorization.is_staff;
    const isConsultor = authorization.is_consultor;

    const contractScope = await resolveContract(admin, company_id, contract_id);
    if (contractScope.forbidden) return json({ error: "Forbidden" }, 403);

    const logDecision = async (rows: any[]) => {
      if (rows.length) await admin.from("ai_logs").insert(rows);
    };

    // ---------- Recusa explícita de propostas persistidas ----------
    if (decision === "reject") {
      const ids: string[] = Array.isArray(proposal_ids) ? proposal_ids : [];
      if (!ids.length) return json({ error: "proposal_ids required" }, 400);
      const { data: rows, error } = await admin
        .from("ai_proposals")
        .update({ status: "rejeitada", decided_by: userId, decided_at: new Date().toISOString() })
        .in("id", ids)
        .eq("company_id", company_id)
        .eq("status", "pendente")
        .select("id, tool_name, payload, payload_hash, instruction");
      if (error) return json({ error: error.message }, 500);
      await logDecision(
        (rows || []).map((p: any) => ({
          user_id: userId, company_id, contract_id: contractScope.contractId,
          action: "socio_tools_decision", decision: "rejeitada",
          tool_name: p.tool_name, payload: { ...p.payload, proposal_id: p.id, payload_hash: p.payload_hash },
          prompt: String(p.instruction ?? "").slice(0, 4000), response: null,
        })),
      );
      return json({ rejected: true, count: (rows || []).length });
    }

    // ---------- Execução fiel: usa exatamente o payload persistido ----------
    if (confirm) {
      const ids: string[] = Array.isArray(proposal_ids) ? proposal_ids : [];
      if (!ids.length) return json({ error: "proposal_ids required" }, 400);

      const { data: stored, error: fetchErr } = await admin
        .from("ai_proposals")
        .select("*")
        .in("id", ids)
        .eq("company_id", company_id)
        .eq("status", "pendente");
      if (fetchErr) return json({ error: fetchErr.message }, 500);

      const results: any[] = [];
      for (const p of stored || []) {
        const scope = (p.required_scope ?? "membro") as "membro" | "estrategista" | "consultor";
        const nowIso = new Date().toISOString();

        // Proposta expirada exige nova proposta.
        if (p.expires_at && new Date(p.expires_at) < new Date()) {
          await admin.from("ai_proposals").update({ status: "expirada", decided_by: userId, decided_at: nowIso }).eq("id", p.id);
          results.push({ id: p.id, name: p.tool_name, ok: false, error: "Proposta expirada. Gere uma nova proposta." });
          continue;
        }

        // Integridade: o payload gravado precisa casar com o hash registrado.
        const recomputed = await payloadHash(p.tool_name, p.payload);
        if (recomputed !== p.payload_hash) {
          await admin.from("ai_proposals").update({ status: "falhou", decided_by: userId, decided_at: nowIso, error_message: "Hash divergente" }).eq("id", p.id);
          results.push({ id: p.id, name: p.tool_name, ok: false, error: "Assinatura da proposta divergente. Ação bloqueada." });
          continue;
        }

        // Alçadas contextuais.
        if (scope === "consultor" && !isConsultor) {
          results.push({ id: p.id, name: p.tool_name, ok: false, error: "Somente o Consultor 4X atribuído à empresa pode aprovar esta ação." });
          continue;
        }
        if (scope === "estrategista" && !isStaff) {
          results.push({ id: p.id, name: p.tool_name, ok: false, error: "Somente a equipe interna atribuída à empresa pode aprovar esta ação." });
          continue;
        }

        // Reserva atômica: impede dupla execução em confirmações concorrentes.
        const { data: claimed, error: claimErr } = await admin.from("ai_proposals")
          .update({ status: "executando", decided_by: userId, decided_at: nowIso })
          .eq("id", p.id).eq("status", "pendente").select("id").maybeSingle();
        if (claimErr || !claimed) {
          results.push({ id: p.id, name: p.tool_name, ok: false, error: "Proposta já processada ou reservada por outra confirmação." });
          continue;
        }

        const args = p.payload ?? {};
        try {
          let row: any = null;
          if (p.tool_name === "create_goal") {
            const { data, error } = await admin.from("goals").insert({
              company_id, contract_id: p.contract_id, title: args.title, description: args.description ?? null,
              pillar: args.pillar ?? null, indicator: args.indicator ?? null,
              financial_impact: args.financial_impact ?? 0, due_date: args.due_date ?? null,
              week_start: new Date().toISOString().slice(0, 10),
              status: "nao_iniciado", created_by: userId,
            }).select().single();
            if (error) throw error;
            row = data;
          } else if (p.tool_name === "create_bottleneck") {
            const { data, error } = await admin.from("bottlenecks").insert({
              company_id, contract_id: p.contract_id, name: args.name, area: args.area ?? null,
              impact: args.impact ?? null, urgency: args.urgency ?? "media",
              estimated_value: args.estimated_value ?? 0, correction_plan: args.correction_plan ?? null,
              responsible_user_id: userId,
            }).select().single();
            if (error) throw error;
            row = data;
          } else if (p.tool_name === "schedule_meeting") {
            const { data, error } = await admin.from("meetings").insert({
              company_id, contract_id: p.contract_id, title: args.title, scheduled_at: args.scheduled_at,
              duration_min: args.duration_min ?? 60, meeting_type: args.meeting_type ?? "checkin_semanal",
              meeting_url: args.meeting_url ?? null, created_by: userId,
            }).select().single();
            if (error) throw error;
            row = data;
          } else {
            throw new Error("Ferramenta desconhecida");
          }

          await admin.from("ai_proposals").update({
            status: "executada", decided_by: userId, decided_at: nowIso,
            entity: ENTITY_BY_TOOL[p.tool_name] ?? null, entity_id: row?.id ?? null,
          }).eq("id", p.id);
          results.push({ id: p.id, name: p.tool_name, ok: true, row });
        } catch (e: any) {
          const message = String(e?.message || e);
          await admin.from("ai_proposals").update({
            status: "falhou", decided_by: userId, decided_at: nowIso, error_message: message.slice(0, 500),
          }).eq("id", p.id);
          results.push({ id: p.id, name: p.tool_name, ok: false, error: message });
        }
      }

      await logDecision(
        results.map((r: any) => ({
          user_id: userId, company_id, contract_id: contractScope.contractId,
          action: "socio_tools_execute",
          decision: r.ok ? "executada" : "falhou",
          tool_name: r.name,
          entity: ENTITY_BY_TOOL[r.name] ?? null,
          entity_id: r.row?.id ?? null,
          payload: r.ok ? { proposal_id: r.id, title: r.row?.title ?? r.row?.name ?? null } : { proposal_id: r.id, error: r.error ?? null },
          prompt: String(instruction ?? "").slice(0, 4000),
          response: JSON.stringify(r).slice(0, 8000),
        })),
      );
      return json({ executed: true, results });
    }

    // ---------- Proposta (dry-run): chama a IA e persiste o payload exato ----------
    if (!instruction) return json({ error: "instruction required" }, 400);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const sys = `Você é o Sócio IA do método MENTOR 4X. Analise o pedido do usuário e proponha ações concretas usando as funções disponíveis (criar meta, criar gargalo, agendar reunião). Seja econômico: no máximo 3 ações por turno. Sempre devolva tool_calls quando o usuário pedir para registrar/criar/agendar algo. Caso contrário responda em texto sucinto. Você recomenda; a decisão final é humana (Consultor 4X).`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: sys }, { role: "user", content: instruction }],
        tools,
        tool_choice: "auto",
      }),
    });
    if (aiResp.status === 429) return json({ error: "Rate limited" }, 429);
    if (aiResp.status === 402) return json({ error: "Credits exhausted" }, 402);
    if (!aiResp.ok) return json({ error: await aiResp.text() }, 500);

    const data = await aiResp.json();
    const msg = data.choices?.[0]?.message;
    const toolCalls = (msg?.tool_calls || []) as Array<{ id: string; function: { name: string; arguments: string } }>;

    const rows: any[] = [];
    for (const tc of toolCalls) {
      let args: any = {};
      try { args = JSON.parse(tc.function.arguments); } catch { args = {}; }
      if (!REQUIRED_SCOPE[tc.function.name]) continue;
      rows.push({
        company_id,
        contract_id: contractScope.contractId,
        created_by: userId,
        tool_name: tc.function.name,
        payload: args,
        payload_hash: await payloadHash(tc.function.name, args),
        instruction: String(instruction).slice(0, 4000),
        ai_message: String(msg?.content ?? "").slice(0, 4000),
        required_scope: REQUIRED_SCOPE[tc.function.name],
        status: "pendente",
      });
    }

    let proposals: any[] = [];
    if (rows.length) {
      const { data: inserted, error } = await admin
        .from("ai_proposals")
        .insert(rows)
        .select("id, tool_name, payload, payload_hash, required_scope, status, expires_at");
      if (error) return json({ error: error.message }, 500);
      proposals = inserted || [];
    }

    await logDecision(
      (proposals.length ? proposals : [{ id: null, tool_name: "nenhuma", payload: {} }]).map((p: any) => ({
        user_id: userId, company_id, contract_id: contractScope.contractId,
        action: "socio_tools_propose", decision: "proposta",
        tool_name: p.tool_name,
        payload: { ...(p.payload ?? {}), proposal_id: p.id, payload_hash: p.payload_hash ?? null },
        prompt: String(instruction).slice(0, 4000),
        response: JSON.stringify({ message: msg?.content }).slice(0, 8000),
      })),
    );

    return json({
      message: msg?.content || "",
      proposals: proposals.map((p: any) => ({
        id: p.id,
        name: p.tool_name,
        args: p.payload,
        payload_hash: p.payload_hash,
        required_scope: p.required_scope,
        expires_at: p.expires_at,
      })),
      viewer: { is_staff: !!isStaff, is_consultor: !!isConsultor },
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
