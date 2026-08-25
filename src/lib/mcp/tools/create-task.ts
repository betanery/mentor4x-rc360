import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthenticated, resolveContractScope, supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_task",
  title: "Criar tarefa",
  description: "Adiciona uma tarefa ao plano de ação de uma empresa do MENTOR 4X.",
  inputSchema: {
    company_id: z.string().describe("UUID da empresa."),
    contract_id: z.string().optional().describe("UUID da contratação/ciclo ativo. Se omitido, cria registro legado sem contratação."),
    title: z.string().describe("Título curto e acionável da tarefa."),
    description: z.string().optional().describe("Detalhes da execução."),
    due_date: z.string().optional().describe("Prazo no formato YYYY-MM-DD."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ company_id, contract_id, title, description, due_date }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let scope;
    try {
      scope = await resolveContractScope(supabase, company_id, contract_id);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        company_id,
        contract_id: scope.contractId,
        title: title.trim(),
        description: description ?? null,
        due_date: due_date ?? null,
        done: false,
      })
      .select()
      .maybeSingle();
    if (error) return errorResult(error.message);
    return jsonResult({ task: data });
  },
});
