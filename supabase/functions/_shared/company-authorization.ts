export type CompanyAuthorization = {
  allowed: boolean;
  is_super_admin: boolean;
  is_staff: boolean;
  is_consultor: boolean;
  is_strategist: boolean;
  is_responsible: boolean;
  is_leader: boolean;
  full_scope: boolean;
  can_view_commercial: boolean;
  can_view_full_reports: boolean;
  pillar_scopes: string[];
  department_scopes: string[];
};

export async function getCompanyAuthorization(admin: any, userId: string, companyId: string): Promise<CompanyAuthorization> {
  const { data, error } = await admin.rpc("actor_company_permissions", {
    _user_id: userId,
    _company_id: companyId,
  });
  if (error) throw error;
  if (!data) throw new Error("Não foi possível resolver a autorização da empresa.");
  return {
    allowed: !!data.allowed,
    is_super_admin: !!data.is_super_admin,
    is_staff: !!data.is_staff,
    is_consultor: !!data.is_consultor,
    is_strategist: !!data.is_strategist,
    is_responsible: !!data.is_responsible,
    is_leader: !!data.is_leader,
    full_scope: !!data.full_scope,
    can_view_commercial: !!data.can_view_commercial,
    can_view_full_reports: !!data.can_view_full_reports,
    pillar_scopes: Array.isArray(data.pillar_scopes) ? data.pillar_scopes : [],
    department_scopes: Array.isArray(data.department_scopes) ? data.department_scopes : [],
  };
}

export function pillarFromBlindspot(code?: string | null): string | null {
  if (!code) return null;
  if (code.startsWith("BS-C")) return "crescimento";
  if (code.startsWith("BS-E")) return "eficiencia";
  if (code.startsWith("BS-X")) return "encantamento";
  if (code.startsWith("BS-L")) return "lideranca";
  return null;
}

export function rowInScope(auth: CompanyAuthorization, row: any): boolean {
  if (auth.full_scope || !auth.is_leader) return true;
  const pillar = row?.pillar ?? pillarFromBlindspot(row?.blindspot_code);
  const department = row?.department ?? row?.area_code ?? null;
  if (pillar && auth.pillar_scopes.includes(String(pillar))) return true;
  if (department && auth.department_scopes.includes(String(department))) return true;
  return false;
}

export function redactCommercial<T extends Record<string, any>>(auth: CompanyAuthorization, row: T, fields: string[]): T {
  if (auth.can_view_commercial) return row;
  const copy: Record<string, any> = { ...row };
  for (const field of fields) delete copy[field];
  return copy as T;
}
