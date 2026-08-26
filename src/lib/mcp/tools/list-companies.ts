import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, notAuthenticated, pageBounds, pageMeta, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_companies",
  title: "Listar empresas",
  description:
    "Lista as empresas que o usuário conectado pode acessar no Mentor 4X, com o ciclo atual da Jornada SEE_4X, nível de Improviso e score geral. Resultado paginado via `limit`/`cursor`.",
  inputSchema: {
    limit: z.number().int().min(1).max(200).optional().describe("Quantidade de empresas por página (padrão 50, máximo 200)."),
    cursor: z.string().optional().describe("Cursor `next_cursor` devolvido pela página anterior."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, cursor }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let bounds;
    try {
      bounds = pageBounds(limit, cursor);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, segment, journey_stage, chaos_level, overall_score, owner_dependency, projected_revenue, started_at, contracts(id, status, journey_stage, current_cycle, product_id, product_version_id)")
      .order("name")
      .order("id", { ascending: true })
      .range(bounds.from, bounds.to + 1);
    if (error) return errorResult(error.message);
    const { page, pagination } = pageMeta(data ?? [], bounds.size, bounds.offset);
    return jsonResult({ companies: page, pagination });
  },
});
