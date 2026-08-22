import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_tasks",
  title: "Listar plano de ação",
  description: "Lista as tarefas do plano de ação de uma empresa. Por padrão só as pendentes.",
  inputSchema: {
    company_id: z.string().describe("UUID da empresa."),
    include_done: z.boolean().optional().describe("Se true, inclui também tarefas concluídas."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ company_id, include_done }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("tasks")
      .select("id, title, description, due_date, done, created_at")
      .eq("company_id", company_id)
      .order("due_date", { ascending: true })
      .limit(200);
    if (!include_done) query = query.eq("done", false);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return jsonResult({ tasks: data ?? [] });
  },
});
