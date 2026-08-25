import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { applyContractScope, errorResult, jsonResult, notAuthenticated, resolveContractScope, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_bottlenecks",
  title: "Listar gargalos",
  description:
    "Lista os gargalos (bottlenecks) mapeados de uma empresa, com urgência, progresso da correção e valor estimado.",
  inputSchema: {
    company_id: z.string().describe("UUID da empresa."),
    contract_id: z.string().optional().describe("UUID da contratação/ciclo ativo. Se omitido, lista apenas registros legados sem contratação."),
    include_resolved: z.boolean().optional().describe("Se true, inclui gargalos já resolvidos."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ company_id, contract_id, include_resolved }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let scope;
    try {
      scope = await resolveContractScope(supabase, company_id, contract_id);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
    let query = supabase
      .from("bottlenecks")
      .select("id, name, area, impact, urgency, progress, estimated_value, correction_plan, resolved")
      .eq("company_id", company_id)
      .order("urgency", { ascending: false })
      .limit(200);
    query = applyContractScope(query, scope.contractId);
    if (!include_resolved) query = query.eq("resolved", false);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return jsonResult({ bottlenecks: data ?? [] });
  },
});
