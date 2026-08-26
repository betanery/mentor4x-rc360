import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { applyContractScope, errorResult, jsonResult, notAuthenticated, pageBounds, pageMeta, resolveContractScope, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_goals",
  title: "Listar metas",
  description:
    "Lista as metas (semanais/mensais) de uma empresa no MENTOR 4X. Opcionalmente filtra por status. Resultado paginado: use `limit` e o `next_cursor` devolvido para buscar a próxima página.",
  inputSchema: {
    company_id: z.string().describe("UUID da empresa."),
    contract_id: z.string().optional().describe("UUID da contratação/ciclo ativo. Se omitido, lista apenas registros legados sem contratação."),
    status: z
      .enum(["nao_iniciado", "em_andamento", "concluido", "atrasado", "bloqueado"])
      .optional()
      .describe("Filtro opcional por status da meta."),
    limit: z.number().int().min(1).max(200).optional().describe("Quantidade de metas por página (padrão 50, máximo 200)."),
    cursor: z.string().optional().describe("Cursor `next_cursor` devolvido pela página anterior."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ company_id, contract_id, status, limit, cursor }, ctx) => {
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
      .from("goals")
      .select("id, title, description, status, pillar, indicator, due_date, week_start, financial_impact, mentor_comment, evidence_url, is_critical, approval_status, blindspot_code, capacity_code")
      .eq("company_id", company_id)
      .order("due_date", { ascending: true })
      .order("id", { ascending: true })
      .range(bounds.from, bounds.to + 1);
    query = applyContractScope(query, scope.contractId);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    const { page, pagination } = pageMeta(data ?? [], bounds.size, bounds.offset);
    return jsonResult({ goals: page, pagination });
  },
});
