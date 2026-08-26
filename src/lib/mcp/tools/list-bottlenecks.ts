import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { applyContractScope, errorResult, jsonResult, notAuthenticated, pageBounds, pageMeta, resolveContractScope, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_bottlenecks",
  title: "Listar gargalos",
  description:
    "Lista os gargalos (bottlenecks) mapeados de uma empresa, com posição no Top 5, urgência, causa raiz, resultado esperado, progresso da correção e valor estimado. Resultado paginado via `limit`/`cursor`.",
  inputSchema: {
    company_id: z.string().describe("UUID da empresa."),
    contract_id: z.string().optional().describe("UUID da contratação/ciclo ativo. Se omitido, lista apenas registros legados sem contratação."),
    include_resolved: z.boolean().optional().describe("Se true, inclui gargalos já resolvidos."),
    limit: z.number().int().min(1).max(200).optional().describe("Quantidade de gargalos por página (padrão 50, máximo 200)."),
    cursor: z.string().optional().describe("Cursor `next_cursor` devolvido pela página anterior."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ company_id, contract_id, include_resolved, limit, cursor }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let scope;
    let bounds;
    try {
      scope = await resolveContractScope(supabase, company_id, contract_id);
      bounds = pageBounds(limit, cursor);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
    let query = supabase
      .from("bottlenecks")
      .select("id, name, area, impact, urgency, progress, estimated_value, correction_plan, resolved, rank_position, root_cause, expected_result, due_date, blindspot_code, capacity_code")
      .eq("company_id", company_id)
      .order("rank_position", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .range(bounds.from, bounds.to + 1);
    query = applyContractScope(query, scope.contractId);
    if (!include_resolved) query = query.eq("resolved", false);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    const { page, pagination } = pageMeta(data ?? [], bounds.size, bounds.offset);
    return jsonResult({ bottlenecks: page, pagination });
  },
});
