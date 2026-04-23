import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

type Company = { id: string; name: string; segment: string | null; logo_url: string | null; journey_stage: string; chaos_level: string; overall_score: number; owner_dependency: number; projected_revenue: number | null; };

interface CompanyCtx {
  companies: Company[];
  current: Company | null;
  setCurrentId: (id: string) => void;
  refresh: () => Promise<void>;
  loading: boolean;
}

const Ctx = createContext<CompanyCtx | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user, isStaff, loading: authLoading } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [current, setCurrent] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    if (!user) { setCompanies([]); setCurrent(null); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from("companies").select("*").order("name");
    const list = (data || []) as Company[];
    setCompanies(list);
    const stored = localStorage.getItem("m4x.currentCompany");
    const found = list.find((c) => c.id === stored) || list[0] || null;
    setCurrent(found);
    setLoading(false);
  };

  useEffect(() => { if (!authLoading) fetch(); }, [user, authLoading]);

  const setCurrentId = (id: string) => {
    const found = companies.find((c) => c.id === id);
    if (found) { setCurrent(found); localStorage.setItem("m4x.currentCompany", id); }
  };

  return <Ctx.Provider value={{ companies, current, setCurrentId, refresh: fetch, loading }}>{children}</Ctx.Provider>;
}

export const useCompany = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCompany must be inside CompanyProvider");
  return v;
};
