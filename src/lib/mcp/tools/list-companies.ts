import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, jsonResult, notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_companies",
  title: "Listar empresas",
  description:
    "Lista as empresas que o usuário conectado pode acessar no MENTOR 4X, com estágio da jornada, nível de caos e score geral.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, segment, journey_stage, chaos_level, overall_score, owner_dependency, projected_revenue, started_at")
      .order("name");
    if (error) return errorResult(error.message);
    return jsonResult({ companies: data ?? [] });
  },
});
