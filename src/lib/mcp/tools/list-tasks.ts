import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { applyContractScope, errorResult, jsonResult, notAuthenticated, pageBounds, pageMeta, resolveContractScope, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_tasks",
  title: "Listar plano de ação",
  description:
    "Lista as tarefas do plano de ação de uma empresa, com prioridade e checklist. Por padrão só as pendentes. Resultado paginado: use `limit` e o `next_cursor` devolvido para a próxima página.",
  inputSchema: {
    company_id: z.string().describe("UUID da empresa."),
    contract_id: z.string().optional().describe("UUID da contratação/ciclo ativo. Se omitido, lista apenas registros legados sem contratação."),
    include_done: z.boolean().optional().describe("Se true, inclui também tarefas concluídas."),
    limit: z.number().int().min(1).max(200).optional().describe("Quantidade de tarefas por página (padrão 50, máximo 200)."),
    cursor: z.string().optional().describe("Cursor `next_cursor` devolvido pela página anterior."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ company_id, contract_id, include_done, limit, cursor }, ctx) => {
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
      .from("tasks")
      .select("id, title, description, due_date, done, priority, checklist, blindspot_code, capacity_code, goal_id, created_at, updated_at")
      .eq("company_id", company_id)
      .order("due_date", { ascending: true })
      .order("id", { ascending: true })
      .range(bounds.from, bounds.to + 1);
    query = applyContractScope(query, scope.contractId);
    if (!include_done) query = query.eq("done", false);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    const { page, pagination } = pageMeta(data ?? [], bounds.size, bounds.offset);
    return jsonResult({ tasks: page, pagination });
  },
});
