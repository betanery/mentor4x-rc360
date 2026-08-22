import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_goal",
  title: "Criar meta",
  description:
    "Cria uma nova meta de execução para uma empresa do MENTOR 4X. Use após confirmar a empresa correta com list_companies.",
  inputSchema: {
    company_id: z.string().describe("UUID da empresa."),
    title: z.string().describe("Título da meta, objetivo e mensurável."),
    description: z.string().optional().describe("Detalhes do plano de execução."),
    pillar: z
      .enum(["pessoas", "processos", "produto", "performance"])
      .optional()
      .describe("Pilar 4X relacionado, se aplicável."),
    indicator: z.string().optional().describe("Indicador de sucesso (KPI)."),
    due_date: z.string().optional().describe("Prazo no formato YYYY-MM-DD."),
    financial_impact: z.number().optional().describe("Impacto financeiro estimado em BRL."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("goals")
      .insert({
        company_id: input.company_id,
        title: input.title.trim(),
        description: input.description ?? null,
        pillar: input.pillar ?? null,
        indicator: input.indicator ?? null,
        due_date: input.due_date ?? null,
        financial_impact: input.financial_impact ?? null,
        status: "nao_iniciado",
        created_by: ctx.getUserId(),
      })
      .select()
      .maybeSingle();
    if (error) return errorResult(error.message);
    return jsonResult({ goal: data });
  },
});
