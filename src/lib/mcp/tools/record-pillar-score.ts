import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "record_pillar_score",
  title: "Registrar score de pilar",
  description:
    "Registra uma nova nota (0 a 100) para um pilar do método 4X de uma empresa, com pontos cegos e recomendações. Requer permissão de mentor/estrategista.",
  inputSchema: {
    company_id: z.string().describe("UUID da empresa."),
    pillar: z
      .enum(["crescimento", "eficiencia", "encantamento", "lideranca"])
      .describe("Pilar do método 4X."),
    score: z.number().describe("Nota de 0 a 100."),
    blind_spots: z.string().optional().describe("Pontos cegos identificados."),
    recommendations: z.string().optional().describe("Recomendações de ação."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const score = Math.max(0, Math.min(100, Math.round(input.score)));
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("pillar_scores")
      .insert({
        company_id: input.company_id,
        pillar: input.pillar,
        score,
        blind_spots: input.blind_spots ?? null,
        recommendations: input.recommendations ?? null,
      })
      .select()
      .maybeSingle();
    if (error) return errorResult(error.message);
    return jsonResult({ pillar_score: data });
  },
});
