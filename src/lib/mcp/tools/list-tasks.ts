import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { applyContractScope, errorResult, jsonResult, notAuthenticated, resolveContractScope, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_tasks",
  title: "Listar plano de ação",
  description: "Lista as tarefas do plano de ação de uma empresa. Por padrão só as pendentes.",
  inputSchema: {
    company_id: z.string().describe("UUID da empresa."),
    contract_id: z.string().optional().describe("UUID da contratação/ciclo ativo. Se omitido, lista apenas registros legados sem contratação."),
    include_done: z.boolean().optional().describe("Se true, inclui também tarefas concluídas."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ company_id, contract_id, include_done }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let scope;
    try {
      scope = await resolveContractScope(supabase, company_id, contract_id);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
    let query = supabase
      .from("tasks")
      .select("id, title, description, due_date, done, created_at")
      .eq("company_id", company_id)
      .order("due_date", { ascending: true })
      .limit(200);
    query = applyContractScope(query, scope.contractId);
    if (!include_done) query = query.eq("done", false);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return jsonResult({ tasks: data ?? [] });
  },
});
