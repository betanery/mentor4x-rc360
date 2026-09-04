import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { E2E_COMPANY, E2E_ENABLED } from "@/test/e2eFixtures";

type Company = { id: string; name: string; segment: string | null; logo_url: string | null; journey_stage: string; chaos_level: string; overall_score: number; owner_dependency: number; projected_revenue: number | null; };

interface CompanyCtx {
  companies: Company[];
  current: Company | null;
  setCurrentId: (id: string) => void;
  refresh: () => Promise<void>;
  loading: boolean;
}

const STORAGE_KEY = "m4x.currentCompany";
const Ctx = createContext<CompanyCtx | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [current, setCurrent] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    if (!user) {
      setCompanies([]);
      setCurrent(null);
      localStorage.removeItem(STORAGE_KEY);
      setLoading(false);
      return;
    }
    if (E2E_ENABLED) {
      setCompanies([E2E_COMPANY]);
      setCurrent(E2E_COMPANY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase.from("companies").select("*").order("name");
    const list = (data || []) as Company[];
    setCompanies(list);

    const stored = localStorage.getItem(STORAGE_KEY);
    const storedCompany = stored ? list.find((c) => c.id === stored) : undefined;
    if (stored && !storedCompany) localStorage.removeItem(STORAGE_KEY);

    const found = storedCompany || list[0] || null;
    if (found && found.id !== stored) localStorage.setItem(STORAGE_KEY, found.id);
    setCurrent(found);
    setLoading(false);
  };

  useEffect(() => { if (!authLoading) fetch(); }, [user, authLoading]);

  const setCurrentId = (id: string) => {
    const found = companies.find((c) => c.id === id);
    if (!found || found.id === current?.id) return;
    setCurrent(found);
    localStorage.setItem(STORAGE_KEY, id);
    qc.clear();
  };

  return <Ctx.Provider value={{ companies, current, setCurrentId, refresh: fetch, loading }}>{children}</Ctx.Provider>;
}

export const useCompany = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCompany must be inside CompanyProvider");
  return v;
};
