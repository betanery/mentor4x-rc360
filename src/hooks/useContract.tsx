import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useCompany } from "./useCompany";
import { E2E_CONTRACT, E2E_ENABLED } from "@/test/e2eFixtures";

export type ActiveContract = {
  id: string;
  company_id: string;
  product_id: string;
  product_version_id: string;
  status: string;
  journey_stage: string;
  current_cycle: number;
  started_at: string | null;
  expected_completion: string | null;
  completed_at: string | null;
  notes: string | null;
  access_expires_at: string | null;
  onboarding_generated_at: string | null;
  product_name: string;
  version_label: string;
};

type ContractRow = Omit<ActiveContract, "product_name" | "version_label"> & {
  products?: { name: string } | null;
  product_versions?: { version_label: string } | null;
};

interface ContractCtx {
  contracts: ActiveContract[];
  currentContract: ActiveContract | null;
  setCurrentContractId: (id: string) => void;
  refreshContracts: () => Promise<void>;
  loading: boolean;
}

const STORAGE_PREFIX = "m4x.currentContract";
const Ctx = createContext<ContractCtx | undefined>(undefined);

export function ContractProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { current } = useCompany();
  const [contracts, setContracts] = useState<ActiveContract[]>([]);
  const [currentContract, setCurrentContract] = useState<ActiveContract | null>(null);
  const [loading, setLoading] = useState(true);

  const storageKey = useMemo(() => current ? `${STORAGE_PREFIX}.${current.id}` : STORAGE_PREFIX, [current]);

  const normalize = (rows: ContractRow[]) => rows.map((row) => ({
    id: row.id,
    company_id: row.company_id,
    product_id: row.product_id,
    product_version_id: row.product_version_id,
    status: row.status,
    journey_stage: row.journey_stage,
    current_cycle: row.current_cycle,
    started_at: row.started_at,
    expected_completion: row.expected_completion,
    completed_at: row.completed_at,
    notes: row.notes,
    access_expires_at: row.access_expires_at,
    onboarding_generated_at: row.onboarding_generated_at,
    product_name: row.products?.name ?? "Produto",
    version_label: row.product_versions?.version_label ?? "Versão",
  }));

  const refreshContracts = async () => {
    if (!user || !current) {
      setContracts([]);
      setCurrentContract(null);
      setLoading(false);
      return;
    }
    if (E2E_ENABLED) {
      setContracts([E2E_CONTRACT]);
      setCurrentContract(E2E_CONTRACT);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("contracts")
      .select("id, company_id, product_id, product_version_id, status, journey_stage, current_cycle, started_at, expected_completion, completed_at, notes, access_expires_at, onboarding_generated_at, products(name), product_versions(version_label)")
      .eq("company_id", current.id)
      .in("status", ["ativo", "pausado"])
      .order("started_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    const list = normalize((data || []) as ContractRow[]);
    setContracts(list);
    const stored = localStorage.getItem(storageKey);
    const storedContract = stored ? list.find((contract) => contract.id === stored) : undefined;
    if (stored && !storedContract) localStorage.removeItem(storageKey);
    const found = storedContract || list.find((contract) => contract.status === "ativo") || list[0] || null;
    if (found && found.id !== stored) localStorage.setItem(storageKey, found.id);
    setCurrentContract(found);
    setLoading(false);
  };

  useEffect(() => { if (!authLoading) refreshContracts(); }, [user, current?.id, authLoading]);

  const setCurrentContractId = (id: string) => {
    const found = contracts.find((contract) => contract.id === id);
    if (!found || found.id === currentContract?.id) return;
    setCurrentContract(found);
    localStorage.setItem(storageKey, id);
  };

  return <Ctx.Provider value={{ contracts, currentContract, setCurrentContractId, refreshContracts, loading }}>{children}</Ctx.Provider>;
}

export const useContract = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useContract must be inside ContractProvider");
  return v;
};
