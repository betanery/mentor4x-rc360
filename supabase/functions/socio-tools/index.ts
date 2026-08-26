import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      description: "Agenda uma reunião (apenas staff).",
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub as string;

    const { instruction, company_id, contract_id, confirm, decision, proposals: rejectedProposals } = await req.json();
    if (!instruction || !company_id) {
      return new Response(JSON.stringify({ error: "instruction and company_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const [{ data: isStaff }, { data: isMember }] = await Promise.all([
      admin.rpc("is_staff", { _user_id: userId }),
      admin.rpc("is_company_member", { _user_id: userId, _company_id: company_id }),
    ]);
    if (!isStaff && !isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const contractScope = await resolveContract(admin, company_id, contract_id);
    if (contractScope.forbidden) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const sys = `Você é o Sócio IA do método MENTOR 4X. Analise o pedido do usuário e proponha ações concretas usando as funções disponíveis (criar meta, criar gargalo, agendar reunião). Seja econômico: no máximo 3 ações por turno. Sempre devolva tool_calls quando o usuário pedir para registrar/criar/agendar algo. Caso contrário responda em texto sucinto.`;

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
    if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!aiResp.ok) {
      const t = await aiResp.text();
      return new Response(JSON.stringify({ error: t }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await aiResp.json();
    const msg = data.choices?.[0]?.message;
    const toolCalls = (msg?.tool_calls || []) as Array<{ id: string; function: { name: string; arguments: string } }>;
    const proposals = toolCalls.map((tc) => {
      let args: any = {};
      try { args = JSON.parse(tc.function.arguments); } catch {}
      return { id: tc.id, name: tc.function.name, args };
    });

    // Dry-run: return proposals for the user to confirm
    if (!confirm) {
      await admin.from("ai_logs").insert({
        user_id: userId, company_id, action: "socio_tools_propose",
        prompt: instruction.slice(0, 4000),
        response: JSON.stringify({ message: msg?.content, proposals }).slice(0, 8000),
      });
      return new Response(JSON.stringify({ message: msg?.content || "", proposals }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Execute proposals as the user (admin client, but with explicit guards)
    const results: any[] = [];
    for (const p of proposals) {
      try {
        if (p.name === "create_goal") {
          const { data: row, error } = await admin.from("goals").insert({
            company_id, contract_id: contractScope.contractId, title: p.args.title, description: p.args.description ?? null,
            pillar: p.args.pillar ?? null, indicator: p.args.indicator ?? null,
            financial_impact: p.args.financial_impact ?? 0, due_date: p.args.due_date ?? null,
            week_start: new Date().toISOString().slice(0, 10),
            status: "nao_iniciado", created_by: userId,
          }).select().single();
          if (error) throw error;
          results.push({ name: p.name, ok: true, row });
        } else if (p.name === "create_bottleneck") {
          if (!isStaff) { results.push({ name: p.name, ok: false, error: "Apenas staff pode registrar gargalos oficiais." }); continue; }
          const { data: row, error } = await admin.from("bottlenecks").insert({
            company_id, contract_id: contractScope.contractId, name: p.args.name, area: p.args.area ?? null,
            impact: p.args.impact ?? null, urgency: p.args.urgency ?? "media",
            estimated_value: p.args.estimated_value ?? 0, correction_plan: p.args.correction_plan ?? null,
            responsible_user_id: userId,
          }).select().single();
          if (error) throw error;
          results.push({ name: p.name, ok: true, row });
        } else if (p.name === "schedule_meeting") {
          if (!isStaff) { results.push({ name: p.name, ok: false, error: "Apenas staff pode agendar reuniões." }); continue; }
          const { data: row, error } = await admin.from("meetings").insert({
            company_id, contract_id: contractScope.contractId, title: p.args.title, scheduled_at: p.args.scheduled_at,
            duration_min: p.args.duration_min ?? 60, meeting_type: p.args.meeting_type ?? "checkin_semanal",
            meeting_url: p.args.meeting_url ?? null, created_by: userId,
          }).select().single();
          if (error) throw error;
          results.push({ name: p.name, ok: true, row });
        } else {
          results.push({ name: p.name, ok: false, error: "Unknown tool" });
        }
      } catch (e: any) {
        results.push({ name: p.name, ok: false, error: String(e?.message || e) });
      }
    }
    await admin.from("ai_logs").insert({
      user_id: userId, company_id, action: "socio_tools_execute",
      prompt: instruction.slice(0, 4000),
      response: JSON.stringify(results).slice(0, 8000),
    });
    return new Response(JSON.stringify({ executed: true, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
