import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { showError } from "@/lib/feedback";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { useContract } from "@/hooks/useContract";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { CYCLE_LABEL } from "@/lib/labels";
import { ITEM_TYPE_LABEL } from "@/components/OnboardingTemplateDialog";
import { CalendarClock, GraduationCap, ListChecks, Loader2, Rocket, Users } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Item = Tables<"contract_onboarding_items">;

const TYPE_ICON: Record<string, typeof ListChecks> = {
  etapa: ListChecks,
  encontro: Users,
  entregavel: Rocket,
  conteudo: GraduationCap,
};

const fmt = (value: string | null) => (value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "sem data");

export default function Onboarding() {
  const { current } = useCompany();
  const { currentContract, refreshContracts } = useContract();
  const { isStaff, user } = useAuth();
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["contract_onboarding_items", currentContract?.id],
    enabled: !!currentContract,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_onboarding_items")
        .select("*")
        .eq("contract_id", currentContract!.id)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data || []) as Item[];
    },
  });

  const generate = useMutation({
    mutationFn: async () => {
      if (!currentContract) throw new Error("Selecione uma contratação ativa.");
      const { data, error } = await supabase.rpc("generate_contract_onboarding", { _contract_id: currentContract.id });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      toast.success(count > 0 ? `${count} item(ns) de onboarding gerados` : "Onboarding já estava gerado — nenhum item novo.");
      qc.invalidateQueries({ queryKey: ["contract_onboarding_items"] });
      qc.invalidateQueries({ queryKey: ["journey_meetings"] });
      void refreshContracts();
    },
    onError: (e: Error) => showError("atualizar o onboarding", e),
  });

  const toggle = useMutation({
    mutationFn: async (v: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from("contract_onboarding_items")
        .update({ done: v.done, completed_at: v.done ? new Date().toISOString() : null, completed_by: v.done ? user?.id ?? null : null })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contract_onboarding_items"] }),
    onError: (e: Error) => showError("atualizar o onboarding", e),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    items.forEach((item) => {
      const key = item.stage || "sem_ciclo";
      map.set(key, [...(map.get(key) || []), item]);
    });
    return [...map.entries()];
  }, [items]);

  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const accessExpires = currentContract?.access_expires_at ?? null;
  const daysLeft = accessExpires
    ? Math.ceil((new Date(`${accessExpires}T12:00:00`).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Onboarding da Contratação"
        subtitle="Etapas, encontros, entregáveis e liberação de conteúdo gerados a partir da versão contratada."
      />

      {!current || !currentContract ? (
        <Card className="p-12 text-center text-muted-foreground">
          Selecione uma empresa e uma contratação ativa para acompanhar o onboarding.
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 shadow-card">
              <p className="text-xs text-muted-foreground">Contratação</p>
              <div className="font-bold">{currentContract.product_name}</div>
              <p className="text-xs text-muted-foreground">{currentContract.version_label} · {CYCLE_LABEL[currentContract.journey_stage]?.label ?? currentContract.journey_stage}</p>
            </Card>
            <Card className="p-4 shadow-card">
              <p className="text-xs text-muted-foreground">Progresso do onboarding</p>
              <div className="text-2xl font-bold">{pct}%</div>
              <Progress value={pct} className="mt-2 h-1.5" />
              <p className="text-xs text-muted-foreground mt-1">{done} de {items.length} itens concluídos</p>
            </Card>
            <Card className="p-4 shadow-card">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> Prazo de acesso</p>
              <div className="font-bold">{accessExpires ? fmt(accessExpires) : "não definido"}</div>
              {daysLeft !== null && (
                <Badge className={daysLeft < 0 ? "bg-destructive text-destructive-foreground mt-1" : daysLeft <= 30 ? "bg-warning text-warning-foreground mt-1" : "bg-success text-success-foreground mt-1"}>
                  {daysLeft < 0 ? "Acesso expirado" : `${daysLeft} dias restantes`}
                </Badge>
              )}
            </Card>
          </div>

          {isStaff && (
            <Card className="p-4 shadow-card flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-sm">Gerar plano de onboarding</p>
                <p className="text-xs text-muted-foreground">
                  Cria as etapas do modelo da versão contratada, agenda os encontros previstos, define as datas de liberação de conteúdo e calcula o prazo de acesso.
                </p>
              </div>
              <Button className="bg-gradient-brand" onClick={() => generate.mutate()} disabled={generate.isPending}>
                {generate.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Rocket className="h-4 w-4 mr-1" />} Gerar onboarding
              </Button>
            </Card>
          )}

          {isLoading && <Card className="p-12 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Carregando onboarding...</Card>}

          {!isLoading && items.length === 0 && (
            <Card className="p-12 text-center text-muted-foreground">
              Nenhum item de onboarding gerado para esta contratação.
              {isStaff ? " Cadastre o modelo na versão do produto e clique em Gerar onboarding." : " O time interno vai liberar as etapas em breve."}
            </Card>
          )}

          <div className="space-y-4">
            {grouped.map(([stage, stageItems]) => (
              <Card key={stage} className="p-5 shadow-card">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold">{CYCLE_LABEL[stage]?.label ?? "Sem ciclo definido"}</h3>
                  <Badge variant="outline">{stageItems.filter((i) => i.done).length}/{stageItems.length}</Badge>
                </div>
                <div className="mt-3 space-y-2">
                  {stageItems.map((item) => {
                    const Icon = TYPE_ICON[item.item_type] ?? ListChecks;
                    const late = !item.done && item.due_date && new Date(`${item.due_date}T12:00:00`).getTime() < Date.now();
                    return (
                      <div key={item.id} className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
                        <Checkbox checked={item.done} onCheckedChange={(v) => toggle.mutate({ id: item.id, done: !!v })} className="mt-1" />
                        <Icon className="h-4 w-4 text-primary mt-1 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.title}</p>
                          {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                          <p className="text-xs text-muted-foreground mt-1">
                            {ITEM_TYPE_LABEL[item.item_type as keyof typeof ITEM_TYPE_LABEL]} · previsto para {fmt(item.due_date)}
                          </p>
                        </div>
                        {late && <Badge className="bg-warning text-warning-foreground">Atrasado</Badge>}
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
