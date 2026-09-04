import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCompanyAuthorization, redactCommercial, rowInScope } from "../_shared/company-authorization.ts";
import { corsHeadersFor, originAllowed } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function scopedQuery(query: any, contractId: string | null) {
  return contractId ? query.eq("contract_id", contractId) : query.is("contract_id", null);
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

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { status: originAllowed(req) ? 204 : 403, headers: corsHeaders });
  if (!originAllowed(req)) return new Response(JSON.stringify({ error: "origin_not_allowed" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    const { messages, company_id, contract_id } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let context = "";
    if (company_id) {
      const authorization = await getCompanyAuthorization(admin, userId, company_id);
      if (!authorization.allowed) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const scope = await resolveContract(admin, company_id, contract_id);
      if (scope.forbidden) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const [{ data: c }, { data: g }, { data: b }, { data: p }] = await Promise.all([
        admin.from("companies").select("id,name,journey_stage,chaos_level,overall_score,owner_dependency,projected_revenue").eq("id", company_id).single(),
        scopedQuery(admin.from("goals").select("title,status,financial_impact,pillar,blindspot_code").eq("company_id", company_id), scope.contractId).limit(50),
        scopedQuery(admin.from("bottlenecks").select("name,urgency,estimated_value,resolved,blindspot_code,area").eq("company_id", company_id), scope.contractId).limit(50),
        scopedQuery(admin.from("pillar_scores").select("pillar,score").eq("company_id", company_id).order("measured_at", { ascending: false }), scope.contractId).limit(20),
      ]);

      const visibleGoals = (g || []).filter((row: any) => rowInScope(authorization, row)).map((row: any) => redactCommercial(authorization, row, ["financial_impact"]));
      const visibleBottlenecks = (b || []).filter((row: any) => rowInScope(authorization, row)).map((row: any) => redactCommercial(authorization, row, ["estimated_value"]));
      const visiblePillars = (p || []).filter((row: any) => rowInScope(authorization, row));
      const company = c ? redactCommercial(authorization, c, ["projected_revenue"]) : c;

      const activeStage = scope.contract?.journey_stage ?? company?.journey_stage;
      const revenueLine = authorization.can_view_commercial ? `\nReceita projetada: R$ ${company?.projected_revenue}` : "";
      context = `\n\nCONTEXTO DA EMPRESA:\nNome: ${company?.name}\nContratação: ${scope.contract?.id ?? "legado/sem contratação"}\nCiclo atual: ${activeStage}\nImproviso: ${company?.chaos_level}\nScore geral: ${company?.overall_score}\nDependência do dono: ${company?.owner_dependency}%${revenueLine}\n\nMETAS VISÍVEIS (${visibleGoals.length}): ${JSON.stringify(visibleGoals)}\nGARGALOS VISÍVEIS: ${JSON.stringify(visibleBottlenecks)}\nSCORES VISÍVEIS: ${JSON.stringify(visiblePillars)}`;
    }

    const systemPrompt = `Você é "Meu Sócio IA", o conselheiro estratégico do método SEE_4X (Sistema de Estruturação Empresarial 4X, RC360).
Método: 4 pilares (Crescimento, Eficiência, Encantamento, Liderança), execução com 2 Metas Críticas por ciclo, jornada de 6 ciclos e cinco Motores (Clareza, Prioridade, Execução, Governança, Autonomia). Improviso indica por onde começar; Maturidade indica até onde levar. Você nunca decide sozinho: recomendações dependem de aprovação do Estrategista 4X e/ou Consultor 4X.
Responda em português brasileiro, direto, executivo, com bullets quando útil. Use markdown. Nunca tente inferir, reconstruir ou solicitar dados ocultados por regras de acesso.${context}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (response.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!response.ok) {
      const t = await response.text();
      return new Response(JSON.stringify({ error: t }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content ?? "";
    const [clientStream, logStream] = response.body!.tee();

    (async () => {
      try {
        const reader = logStream.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let i: number;
          while ((i = buf.indexOf("\n")) !== -1) {
            let line = buf.slice(0, i); buf = buf.slice(i + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const j = line.slice(6).trim();
            if (j === "[DONE]") continue;
            try {
              const c = JSON.parse(j).choices?.[0]?.delta?.content;
              if (c) acc += c;
            } catch { /* partial chunk */ }
          }
        }
        await admin.from("ai_logs").insert({
          user_id: userId,
          company_id: company_id ?? null,
          action: "chat",
          prompt: String(lastUserMsg).slice(0, 4000),
          response: acc.slice(0, 8000),
        });
      } catch (e) {
        console.error("ai_logs insert failed", e);
      }
    })();

    return new Response(clientStream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
