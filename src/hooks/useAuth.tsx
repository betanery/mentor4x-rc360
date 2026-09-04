import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { E2E_ENABLED, e2eRole, e2eUser } from "@/test/e2eFixtures";

type AppRole = "super_admin" | "mentor" | "estrategista" | "cliente_dono" | "gestor_cliente" | "colaborador_cliente" | "company_responsible" | "company_leader";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  globalRoles: AppRole[];
  currentCompanyRole: AppRole | null;
  loading: boolean;
  isStaff: boolean;
  isConsultor: boolean;
  hasRole: (r: AppRole) => boolean;
  setActiveCompanyId: (companyId: string | null) => Promise<void>;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [globalRoles, setGlobalRoles] = useState<AppRole[]>([]);
  const [currentCompanyRole, setCurrentCompanyRole] = useState<AppRole | null>(null);
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadGlobalRoles = async (uid: string) => {
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    if (error) throw error;
    setGlobalRoles([...new Set((data || []).map((r) => r.role as AppRole))]);
  };

  const loadCompanyRole = async (uid: string, companyId: string | null) => {
    if (!companyId) { setCurrentCompanyRole(null); return; }
    const { data, error } = await supabase
      .from("company_access")
      .select("access_role, is_primary_responsible")
      .eq("user_id", uid)
      .eq("company_id", companyId)
      .eq("status", "ativo")
      .order("is_primary_responsible", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("Failed to load company-scoped role", error);
      setCurrentCompanyRole(null);
      return;
    }
    setCurrentCompanyRole((data?.access_role as AppRole | undefined) ?? null);
  };

  const setActiveCompanyId = async (companyId: string | null) => {
    setActiveCompanyIdState(companyId);
    if (!user || E2E_ENABLED) return;
    await loadCompanyRole(user.id, companyId);
  };

  useEffect(() => {
    if (E2E_ENABLED) {
      const role = e2eRole();
      setUser(role ? e2eUser(role) : null);
      setSession(null);
      setGlobalRoles(role ? [role] : []);
      setCurrentCompanyRole(null);
      setLoading(false);
      return;
    }
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(async () => {
try {
  await loadGlobalRoles(sess.user.id);
  if (activeCompanyId) await loadCompanyRole(sess.user.id, activeCompanyId);
} catch (error) { console.error("Failed to load roles", error); }
        }, 0);
      } else {
        setGlobalRoles([]);
        setCurrentCompanyRole(null);
      }
    });
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      try { if (session?.user) await loadGlobalRoles(session.user.id); }
      catch (error) { console.error("Failed to load roles", error); }
      finally { setLoading(false); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setGlobalRoles([]);
    setCurrentCompanyRole(null);
    setActiveCompanyIdState(null);
  };

  const refreshRoles = async () => {
    if (!user) return;
    await loadGlobalRoles(user.id);
    await loadCompanyRole(user.id, activeCompanyId);
  };

  const roles = useMemo(() => [...new Set(currentCompanyRole ? [...globalRoles, currentCompanyRole] : globalRoles)] as AppRole[], [globalRoles, currentCompanyRole]);
  const isStaff = globalRoles.some((r) => ["super_admin", "mentor", "estrategista"].includes(r));
  const isConsultor = globalRoles.some((r) => ["super_admin", "mentor"].includes(r));
  const hasRole = (r: AppRole) => roles.includes(r);

  return <Ctx.Provider value={{ user, session, roles, globalRoles, currentCompanyRole, loading, isStaff, isConsultor, hasRole, setActiveCompanyId, signOut, refreshRoles }}>{children}</Ctx.Provider>;
}

export const useAuth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
};
