import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCompaniesTool from "./tools/list-companies";
import getCompanyOverviewTool from "./tools/get-company-overview";
import listGoalsTool from "./tools/list-goals";
import createGoalTool from "./tools/create-goal";
import listTasksTool from "./tools/list-tasks";
import createTaskTool from "./tools/create-task";
import listBottlenecksTool from "./tools/list-bottlenecks";
import createBottleneckTool from "./tools/create-bottleneck";
import recordPillarScoreTool from "./tools/record-pillar-score";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "mentor-4x",
  title: "Mentor 4X",
  version: "0.1.0",
  instructions:
    "Ferramentas do Mentor 4X, plataforma do SEE_4X (Sistema de Estruturação Empresarial 4X, RC360). Use `list_companies` primeiro para descobrir as empresas acessíveis e seus UUIDs, e `get_company_overview` para um diagnóstico completo (scores por pilar, metas, gargalos e tarefas). As demais ferramentas leem e criam metas, tarefas do plano de ação, gargalos e scores de pilar. Todas as operações respeitam as permissões do usuário conectado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listCompaniesTool,
    getCompanyOverviewTool,
    listGoalsTool,
    createGoalTool,
    listTasksTool,
    createTaskTool,
    listBottlenecksTool,
    createBottleneckTool,
    recordPillarScoreTool,
  ],
});
