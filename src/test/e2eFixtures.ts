import type { User } from "@supabase/supabase-js";
import type { ActiveContract } from "@/hooks/useContract";

export const E2E_ENABLED = import.meta.env.VITE_E2E_MODE === "true";
export const E2E_ROLE_KEY = "m4x.e2eRole";

export type E2ERole = "super_admin" | "mentor" | "estrategista" | "company_responsible" | "company_leader" | "cliente_dono" | "gestor_cliente" | "colaborador_cliente";

export const e2eRole = (): E2ERole | null => {
  if (!E2E_ENABLED || typeof window === "undefined") return null;
  return localStorage.getItem(E2E_ROLE_KEY) as E2ERole | null;
};

export const e2eUser = (role: E2ERole): User => ({
  id: `00000000-0000-4000-8000-${role.padEnd(12, "0").slice(0, 12)}`,
  app_metadata: {},
  user_metadata: { full_name: `Teste ${role}` },
  aud: "authenticated",
  created_at: "2026-01-01T00:00:00.000Z",
  email: `${role}@e2e.mentor4x.local`,
}) as User;

export const E2E_COMPANY = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Empresa E2E RC360",
  segment: "Serviços",
  logo_url: null,
  journey_stage: "ciclo_2",
  chaos_level: "moderado",
  overall_score: 62,
  owner_dependency: 58,
  projected_revenue: 2400000,
};

export const E2E_CONTRACT: ActiveContract = {
  id: "20000000-0000-4000-8000-000000000001",
  company_id: E2E_COMPANY.id,
  product_id: "30000000-0000-4000-8000-000000000001",
  product_version_id: "40000000-0000-4000-8000-000000000001",
  status: "ativo",
  journey_stage: "ciclo_2",
  current_cycle: 2,
  started_at: "2026-08-01",
  expected_completion: "2027-01-31",
  completed_at: null,
  notes: "Contrato isolado de QA",
  access_expires_at: "2027-02-28T23:59:59.000Z",
  onboarding_generated_at: "2026-08-01T12:00:00.000Z",
  product_name: "4X Master",
  version_label: "E2E",
};
