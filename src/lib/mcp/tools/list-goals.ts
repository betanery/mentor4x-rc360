import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_goals",
  title: "Listar metas",
  description:
    "Lista as metas (semanais/mensais) de uma empresa no MENTOR 4X. Opcionalmente filtra por status.",
  inputSchema: {
    company_id: z.string().describe("UUID da empresa."),
    status: z
      .enum(["nao_iniciado", "em_andamento", "concluido", "atrasado", "bloqueado"])
      .optional()
      .describe("Filtro opcional por status da meta."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ company_id, status }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("goals")
      .select("id, title, description, status, pillar, indicator, due_date, week_start, financial_impact, mentor_comment, evidence_url")
      .eq("company_id", company_id)
      .order("due_date", { ascending: true })
      .limit(200);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return jsonResult({ goals: data ?? [] });
  },
});
