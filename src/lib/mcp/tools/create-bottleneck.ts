import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthenticated, resolveContractScope, supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_bottleneck",
  title: "Registrar gargalo",
  description: "Registra um novo gargalo operacional de uma empresa do MENTOR 4X, com urgência e plano de correção.",
  inputSchema: {
    company_id: z.string().describe("UUID da empresa."),
    contract_id: z.string().optional().describe("UUID da contratação/ciclo ativo. Se omitido, cria registro legado sem contratação."),
    name: z.string().describe("Nome do gargalo."),
    area: z.string().optional().describe("Área da empresa afetada (ex.: comercial, financeiro)."),
    impact: z.string().optional().describe("Descrição do impacto no negócio."),
    urgency: z
      .enum(["baixa", "media", "alta", "critica"])
      .optional()
      .describe("Urgência do gargalo. Padrão: media."),
    correction_plan: z.string().optional().describe("Plano de correção proposto."),
    estimated_value: z.number().optional().describe("Valor estimado em BRL travado por este gargalo."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let scope;
    try {
      scope = await resolveContractScope(supabase, input.company_id, input.contract_id);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
    const { data, error } = await supabase
      .from("bottlenecks")
      .insert({
        company_id: input.company_id,
        contract_id: scope.contractId,
        name: input.name.trim(),
        area: input.area ?? null,
        impact: input.impact ?? null,
        urgency: input.urgency ?? "media",
        correction_plan: input.correction_plan ?? null,
        estimated_value: input.estimated_value ?? null,
        progress: 0,
        resolved: false,
      })
      .select()
      .maybeSingle();
    if (error) return errorResult(error.message);
    return jsonResult({ bottleneck: data });
  },
});
