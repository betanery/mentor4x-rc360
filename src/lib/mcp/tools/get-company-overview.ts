import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { applyContractScope, errorResult, jsonResult, notAuthenticated, resolveContractScope, supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_company_overview",
  title: "Diagnóstico da empresa",
  description:
    "Retorna o panorama de uma empresa: dados gerais, últimos scores por pilar, metas em aberto, gargalos não resolvidos e tarefas pendentes.",
  inputSchema: {
    company_id: z.string().describe("UUID da empresa (use list_companies para descobrir)."),
    contract_id: z.string().optional().describe("UUID da contratação/ciclo ativo, quando a empresa tiver mais de uma contratação."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ company_id, contract_id }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);

    let scope;
    try {
      scope = await resolveContractScope(supabase, company_id, contract_id);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }

    const [company, scores, goals, bottlenecks, tasks] = await Promise.all([
      supabase.from("companies").select("*").eq("id", company_id).maybeSingle(),
      applyContractScope(supabase
        .from("pillar_scores")
        .select("pillar, score, measured_at, blind_spots, recommendations")
        .eq("company_id", company_id)
        .order("measured_at", { ascending: false }), scope.contractId)
        .limit(30),
      applyContractScope(supabase
        .from("goals")
        .select("id, title, status, pillar, due_date, financial_impact")
        .eq("company_id", company_id)
        .neq("status", "concluido")
        .order("due_date", { ascending: true }), scope.contractId)
        .limit(50),
      applyContractScope(supabase
        .from("bottlenecks")
        .select("id, name, area, urgency, progress, estimated_value")
        .eq("company_id", company_id)
        .eq("resolved", false), scope.contractId)
        .limit(50),
      applyContractScope(supabase
        .from("tasks")
        .select("id, title, due_date, done")
        .eq("company_id", company_id)
        .eq("done", false), scope.contractId)
        .limit(50),
    ]);

    const failure = [company, scores, goals, bottlenecks, tasks].find((r) => r.error);
    if (failure?.error) return errorResult(failure.error.message);
    if (!company.data) return errorResult("Empresa não encontrada ou sem acesso.");

    return jsonResult({
      company: company.data,
      contract: scope.contract,
      pillar_scores: scores.data ?? [],
      open_goals: goals.data ?? [],
      open_bottlenecks: bottlenecks.data ?? [],
      pending_tasks: tasks.data ?? [],
    });
  },
});
