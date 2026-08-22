import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_company_overview",
  title: "Diagnóstico da empresa",
  description:
    "Retorna o panorama de uma empresa: dados gerais, últimos scores por pilar, metas em aberto, gargalos não resolvidos e tarefas pendentes.",
  inputSchema: {
    company_id: z.string().describe("UUID da empresa (use list_companies para descobrir)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ company_id }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);

    const [company, scores, goals, bottlenecks, tasks] = await Promise.all([
      supabase.from("companies").select("*").eq("id", company_id).maybeSingle(),
      supabase
        .from("pillar_scores")
        .select("pillar, score, measured_at, blind_spots, recommendations")
        .eq("company_id", company_id)
        .order("measured_at", { ascending: false })
        .limit(30),
      supabase
        .from("goals")
        .select("id, title, status, pillar, due_date, financial_impact")
        .eq("company_id", company_id)
        .neq("status", "concluido")
        .order("due_date", { ascending: true })
        .limit(50),
      supabase
        .from("bottlenecks")
        .select("id, name, area, urgency, progress, estimated_value")
        .eq("company_id", company_id)
        .eq("resolved", false)
        .limit(50),
      supabase
        .from("tasks")
        .select("id, title, due_date, done")
        .eq("company_id", company_id)
        .eq("done", false)
        .limit(50),
    ]);

    const failure = [company, scores, goals, bottlenecks, tasks].find((r) => r.error);
    if (failure?.error) return errorResult(failure.error.message);
    if (!company.data) return errorResult("Empresa não encontrada ou sem acesso.");

    return jsonResult({
      company: company.data,
      pillar_scores: scores.data ?? [],
      open_goals: goals.data ?? [],
      open_bottlenecks: bottlenecks.data ?? [],
      pending_tasks: tasks.data ?? [],
    });
  },
});
