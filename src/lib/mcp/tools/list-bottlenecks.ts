import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_bottlenecks",
  title: "Listar gargalos",
  description:
    "Lista os gargalos (bottlenecks) mapeados de uma empresa, com urgência, progresso da correção e valor estimado.",
  inputSchema: {
    company_id: z.string().describe("UUID da empresa."),
    include_resolved: z.boolean().optional().describe("Se true, inclui gargalos já resolvidos."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ company_id, include_resolved }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("bottlenecks")
      .select("id, name, area, impact, urgency, progress, estimated_value, correction_plan, resolved")
      .eq("company_id", company_id)
      .order("urgency", { ascending: false })
      .limit(200);
    if (!include_resolved) query = query.eq("resolved", false);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return jsonResult({ bottlenecks: data ?? [] });
  },
});
