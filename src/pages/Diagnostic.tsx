import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useContract } from "@/hooks/useContract";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { showError } from "@/lib/feedback";
import { PILLAR_LABEL } from "@/lib/labels";
import { ScaleLegend, ScaleQuestion } from "@/components/ScaleQuestion";
import { DiagnosticCollection } from "@/components/DiagnosticCollection";
import {
  BLINDSPOTS,
  DIVERGENCE_THRESHOLD,
  GROUP_LABEL,
  GROUP_WEIGHTS,
  IDD_DIMENSIONS,
  MATURITY_DIMENSIONS,
  MATURITY_LABEL,
  MATURITY_ORDER,
  QUESTIONS,
  blindspotByCode,
  computeDiagnostic,
  improvisoBand,
  improvisoToLegacyLevel,
  type Answers,
  type MaturityLevel,
  type Pillar,
  type RespondentGroup,
  urgencyForImproviso,
} from "@/lib/see4x";

import { AlertTriangle, CheckCircle2, ClipboardList, Plus, ShieldCheck, Users } from "lucide-react";

const DIAGNOSTIC_SUBTITLE =
  "Baseline oficial da empresa: Maturidade, Improviso, Pilar e BlindSpot prioritários e IDD — com múltiplos respondentes e validação do Consultor 4X.";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho — coletando respostas", color: "bg-warning/15 text-warning" },
  consolidado: { label: "Consolidado — aguardando validação", color: "bg-info/15 text-info" },
  validado: { label: "Validado pelo Consultor 4X", color: "bg-success/15 text-success" },
};

const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");

export default function Diagnostic() {
  const { current } = useCompany();
  const { currentContract } = useContract();
  const { user, isStaff, roles } = useAuth();
  const qc = useQueryClient();

  const [answers, setAnswers] = useState<Answers>({});
  const [group, setGroup] = useState<RespondentGroup>(
    roles.includes("company_responsible") ? "responsavel_principal"
      : roles.includes("cliente_dono") ? "dono_socio"
      : roles.includes("company_leader") || roles.includes("gestor_cliente") ? "gestor"
      : "equipe",
  );
  const [validateOpen, setValidateOpen] = useState(false);
  const [validation, setValidation] = useState<{ maturity: MaturityLevel; pillar: Pillar | ""; blindspot: string; notes: string }>({
    maturity: "inicial",
    pillar: "",
    blindspot: "",
    notes: "",
  });

  const { data: diagnostics = [], isLoading } = useQuery({
    queryKey: ["diagnostics", current?.id, currentContract?.id],
    enabled: !!current,
    queryFn: async () => {
      let query = supabase
        .from("diagnostics")
        .select("*")
        .eq("company_id", current!.id)
        .order("version", { ascending: false });
      query = currentContract ? query.eq("contract_id", currentContract.id) : query.is("contract_id", null);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const activeDiag = diagnostics[0] ?? null;

  const { data: responses = [] } = useQuery({
    queryKey: ["diagnostic_responses", activeDiag?.id],
    enabled: !!activeDiag,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diagnostic_responses")
        .select("*")
        .eq("diagnostic_id", activeDiag!.id)
        .order("submitted_at");
      if (error) throw error;
      return data;
    },
  });

  const myResponse = responses.find((r) => r.respondent_user_id === user?.id) ?? null;

  const live = useMemo(
    () =>
      computeDiagnostic(
        responses.map((r) => ({
          respondent_group: r.respondent_group as RespondentGroup,
          respondent_name: r.respondent_name,
          answers: (r.answers ?? {}) as Answers,
        })),
      ),
    [responses],
  );

  // Resultado oficial gravado na validação; enquanto isso, cálculo ao vivo das respostas.
  const stored = (activeDiag?.results ?? null) as unknown as ReturnType<typeof computeDiagnostic> | null;
  const result = activeDiag?.status === "validado" ? stored ?? live : live;

  const createDiag = useMutation({
    mutationFn: async () => {
      if (!current) throw new Error("Selecione uma empresa");
      const nextVersion = (diagnostics[0]?.version ?? 0) + 1;
      const { error } = await supabase.from("diagnostics").insert({
        company_id: current.id,
        contract_id: currentContract?.id ?? null,
        mode: "cliente",
        version: nextVersion,
        status: "rascunho",
        title: `Diagnóstico SEE_4X v${nextVersion}`,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diagnostics"] });
      toast.success("Novo diagnóstico aberto para coleta de respostas.");
    },
    onError: (e: Error) => showError("salvar o diagnóstico", e),
  });

  const saveResponse = useMutation({
    mutationFn: async () => {
      if (!activeDiag) throw new Error("Nenhum diagnóstico aberto");
      if (activeDiag.status !== "rascunho") throw new Error("Este diagnóstico não aceita mais respostas");
      const missing = QUESTIONS.filter((q) => !answers[q.id]).length;
      if (missing > 0) throw new Error(`Faltam ${missing} respostas para enviar`);
      const payload = {
        diagnostic_id: activeDiag.id,
        respondent_user_id: user!.id,
        respondent_name: user?.email ?? null,
        respondent_group: group,
        answers,
        submitted_at: new Date().toISOString(),
      };
      const { error } = myResponse
        ? await supabase.from("diagnostic_responses").update(payload).eq("id", myResponse.id)
        : await supabase.from("diagnostic_responses").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diagnostic_responses"] });
      toast.success("Resposta registrada. Divergências de percepção são sinalizadas, nunca corrigidas.");
    },
    onError: (e: Error) => showError("salvar o diagnóstico", e),
  });

  const consolidate = useMutation({
    mutationFn: async () => {
      if (!activeDiag || !live) throw new Error("Sem respostas para consolidar");
      const { error } = await supabase
        .from("diagnostics")
        .update({ status: "consolidado", results: live as never })
        .eq("id", activeDiag.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diagnostics"] });
      toast.success("Consolidado. A classificação final depende da validação do Consultor 4X.");
    },
    onError: (e: Error) => showError("salvar o diagnóstico", e),
  });

  const validate = useMutation({
    mutationFn: async () => {
      if (!activeDiag || !live) throw new Error("Sem resultado para validar");
      if (!validation.pillar) throw new Error("Defina o pilar prioritário");
      const { error } = await supabase
        .from("diagnostics")
        .update({
          status: "validado",
          results: live as never,
          maturity: validation.maturity,
          improviso_score: live.improvisoGeral,
          priority_pillar: validation.pillar,
          priority_blindspot: validation.blindspot || live.priorityBlindspot,
          idd_score: live.idd.score,
          notes: validation.notes || null,
          validated_by: user?.id ?? null,
          validated_at: new Date().toISOString(),
        })
        .eq("id", activeDiag.id);
      if (error) throw error;
      // Baseline oficial reflete no cadastro da empresa (Improviso e dependência do dono).
      await supabase
        .from("companies")
        .update({ chaos_level: improvisoToLegacyLevel(live.improvisoGeral), owner_dependency: live.idd.score })
        .eq("id", activeDiag.company_id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diagnostics"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setValidateOpen(false);
      toast.success("Diagnóstico validado — baseline oficial registrado.");
    },
    onError: (e: Error) => showError("salvar o diagnóstico", e),
  });

  // Motor metodológico: transforma o Top 5 validado em gargalos rastreáveis (sem duplicar BlindSpot).
  const generateTop5 = useMutation({
    mutationFn: async () => {
      if (!activeDiag || !result) throw new Error("Sem resultado consolidado");
      if (activeDiag.status !== "validado") throw new Error("Valide o diagnóstico antes de gerar o Top 5");
      let existingQuery = supabase
        .from("bottlenecks")
        .select("blindspot_code")
        .eq("company_id", activeDiag.company_id)
        .not("blindspot_code", "is", null);
      existingQuery = currentContract ? existingQuery.eq("contract_id", currentContract.id) : existingQuery.is("contract_id", null);
      const { data: existing, error: exErr } = await existingQuery;
      if (exErr) throw exErr;
      const taken = new Set((existing ?? []).map((b) => b.blindspot_code));
      const rows = result.top5
        .filter((code) => !taken.has(code))
        .map((code) => {
          const bs = blindspotByCode(code)!;
          const score = result.blindspots.find((b) => b.code === code)?.improviso ?? 0;
          return {
            company_id: activeDiag.company_id,
            contract_id: currentContract?.id ?? null,
            diagnostic_id: activeDiag.id,
            blindspot_code: code,
            name: bs.title,
            area: PILLAR_LABEL[bs.pillar].label,
            impact: `${bs.statement} (Improviso ${score}/100)`,
            urgency: urgencyForImproviso(score),
            correction_plan: `Capacidades estruturantes: 1) ${bs.capacities[0]} · 2) ${bs.capacities[1]}`,
            progress: 0,
          };
        });
      if (!rows.length) throw new Error("Os cinco BlindSpots já viraram gargalos");
      const { error } = await supabase.from("bottlenecks").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["bottlenecks"] });
      toast.success(`${n} gargalo(s) criado(s) a partir do Top 5.`);
    },
    onError: (e: Error) => showError("salvar o diagnóstico", e),
  });

  const openValidate = () => {

    if (!live) return;
    setValidation({
      maturity: live.suggestedMaturity,
      pillar: (live.priorityPillar ?? "") as Pillar | "",
      blindspot: live.priorityBlindspot ?? "",
      notes: "",
    });
    setValidateOpen(true);
  };

  const loadMyAnswers = () => {
    if (myResponse) {
      setAnswers((myResponse.answers ?? {}) as Answers);
      setGroup(myResponse.respondent_group as RespondentGroup);
    }
  };

  if (!current) {
    return (
      <div>
        <PageHeader title="Diagnóstico SEE_4X" subtitle={DIAGNOSTIC_SUBTITLE} />
        <Card className="p-10 text-center text-muted-foreground">Selecione uma empresa para começar.</Card>
      </div>
    );
  }

  const answeredCount = QUESTIONS.filter((q) => answers[q.id]).length;

  return (
    <div>
      <PageHeader
        title="Diagnóstico SEE_4X"
        subtitle={DIAGNOSTIC_SUBTITLE}
        action={
          isStaff && (
            <Button onClick={() => createDiag.mutate()} disabled={createDiag.isPending}>
              <Plus className="h-4 w-4 mr-1.5" /> Novo diagnóstico
            </Button>
          )
        }
      />

      {isLoading ? (
        <Card className="p-10 text-center text-muted-foreground">Carregando…</Card>
      ) : !activeDiag ? (
        <Card className="p-10 text-center space-y-3">
          <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="font-semibold">Nenhum diagnóstico aberto para esta empresa.</p>
          <p className="text-sm text-muted-foreground">
            O Consultor 4X abre a versão do diagnóstico; dono, gestores e equipe respondem e a classificação final é validada.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-gold">
                Versão {activeDiag.version} · {activeDiag.mode === "lead" ? "Modo Lead" : "Cliente 4X"}
              </p>
              <p className="text-xl font-black">{activeDiag.title || `Diagnóstico v${activeDiag.version}`}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Aberto em {fmtDate(activeDiag.created_at)} · Validado em {fmtDate(activeDiag.validated_at)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={STATUS_LABEL[activeDiag.status].color}>{STATUS_LABEL[activeDiag.status].label}</Badge>
              {isStaff && activeDiag.status === "rascunho" && (
                <Button variant="outline" size="sm" onClick={() => consolidate.mutate()} disabled={!live || consolidate.isPending}>
                  Consolidar
                </Button>
              )}
              {isStaff && activeDiag.status !== "validado" && (
                <Button size="sm" onClick={openValidate} disabled={!live}>
                  <ShieldCheck className="h-4 w-4 mr-1.5" /> Validar classificação
                </Button>
              )}
            </div>
          </Card>

          <Tabs defaultValue="resultado">
            <TabsList>
              <TabsTrigger value="resultado">Resultado</TabsTrigger>
              <TabsTrigger value="responder">Responder</TabsTrigger>
              <TabsTrigger value="coleta">Coleta</TabsTrigger>
              <TabsTrigger value="respondentes">Respondentes</TabsTrigger>
              <TabsTrigger value="historico">Versões</TabsTrigger>
            </TabsList>

            {/* --------------------------------- Coleta -------------------------------- */}
            <TabsContent value="coleta" className="mt-6">
              <DiagnosticCollection
                diagnosticId={activeDiag.id}
                companyId={activeDiag.company_id}
                contractId={currentContract?.id ?? null}
                status={activeDiag.status}
                isStaff={isStaff}
                userId={user?.id}
                responses={responses}
              />
            </TabsContent>

            {/* ------------------------------- Resultado ------------------------------- */}
            <TabsContent value="resultado" className="space-y-6 mt-6">
              {!result ? (
                <Card className="p-10 text-center text-muted-foreground">
                  Ainda sem respostas. Use a aba <strong>Responder</strong> para enviar a sua percepção.
                </Card>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-4">
                    <Card className="p-5">
                      <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">Maturidade</p>
                      <Badge className={`mt-2 ${MATURITY_LABEL[(activeDiag.maturity as MaturityLevel) || result.suggestedMaturity].color}`}>
                        {MATURITY_LABEL[(activeDiag.maturity as MaturityLevel) || result.suggestedMaturity].label}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-2">
                        {activeDiag.maturity ? "Validada pelo Consultor 4X" : "Sugerida pelo sistema · pendente de validação"}
                      </p>
                    </Card>
                    <Card className="p-5">
                      <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">Improviso geral</p>
                      <p className="text-3xl font-black mt-1">{result.improvisoGeral}</p>
                      <Badge className={`mt-1 ${improvisoBand(result.improvisoGeral).color}`}>{improvisoBand(result.improvisoGeral).label}</Badge>
                    </Card>
                    <Card className="p-5">
                      <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">Pilar prioritário</p>
                      <p className="text-xl font-black mt-1">
                        {result.priorityPillar ? PILLAR_LABEL[result.priorityPillar].label : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Maior Improviso entre os quatro pilares</p>
                    </Card>
                    <Card className="p-5">
                      <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">IDD · Dependência do dono</p>
                      <p className="text-3xl font-black mt-1">{result.idd.score}%</p>
                      <p className="text-xs text-muted-foreground mt-1">8 dimensões · meta &lt; 30%</p>
                    </Card>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <Card className="p-5">
                      <h3 className="font-bold mb-4">Improviso por pilar</h3>
                      <div className="space-y-3">
                        {result.byPillar.map((p) => (
                          <div key={p.pillar}>
                            <div className="flex justify-between text-sm mb-1">
                              <span>{PILLAR_LABEL[p.pillar].label}</span>
                              <span className="font-bold">{p.improviso}</span>
                            </div>
                            <Progress value={p.improviso} />
                          </div>
                        ))}
                      </div>
                    </Card>

                    <Card className="p-5">
                      <h3 className="font-bold mb-1">Top 5 recomendado</h3>
                      <p className="text-xs text-muted-foreground mb-4">
                        O sistema sempre recomenda cinco. O Consultor 4X valida e pode alterar com justificativa.
                      </p>
                      <div className="space-y-2">
                        {result.top5.map((code, i) => {
                          const bs = blindspotByCode(code);
                          const score = result.blindspots.find((b) => b.code === code)?.improviso ?? 0;
                          return (
                            <div key={code} className="flex items-center gap-3 rounded-lg border p-2.5">
                              <span className="h-7 w-7 shrink-0 rounded-md bg-primary/10 text-primary grid place-items-center text-xs font-bold">
                                {i + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold truncate">{bs?.title}</p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {code} · {bs && PILLAR_LABEL[bs.pillar].label} · Capacidade: {bs?.capacities[0]}
                                </p>
                              </div>
                              <span className="text-sm font-bold">{score}</span>
                            </div>
                          );
                        })}
                      </div>
                      {isStaff && (
                        <Button
                          variant="outline"
                          className="w-full mt-4"
                          disabled={activeDiag.status !== "validado" || generateTop5.isPending}
                          onClick={() => generateTop5.mutate()}
                        >
                          <ClipboardList className="h-4 w-4 mr-2" />
                          {activeDiag.status === "validado" ? "Gerar Top 5 Gargalos" : "Valide para gerar gargalos"}
                        </Button>
                      )}
                    </Card>

                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <Card className="p-5">
                      <h3 className="font-bold mb-4">IDD por dimensão</h3>
                      <div className="space-y-3">
                        {result.idd.dimensions.map((d) => (
                          <div key={d.key}>
                            <div className="flex justify-between text-sm mb-1">
                              <span>{d.label}</span>
                              <span className="font-bold">{d.score}</span>
                            </div>
                            <Progress value={d.score} />
                          </div>
                        ))}
                      </div>
                    </Card>

                    <Card className="p-5">
                      <h3 className="font-bold mb-1">Divergência de percepção</h3>
                      <p className="text-xs text-muted-foreground mb-4">
                        Diferenças de {DIVERGENCE_THRESHOLD} pontos ou mais entre grupos. Sinalizadas para pedido de evidência — nunca corrigidas automaticamente.
                      </p>
                      {result.divergences.length === 0 ? (
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-success" /> Nenhuma divergência relevante.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                          {result.divergences.map((d) => (
                            <div key={d.question} className="rounded-lg border p-2.5">
                              <p className="text-sm font-semibold flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-warning shrink-0" /> {d.label}
                                <span className="ml-auto text-xs font-bold">{d.spread} pp</span>
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-1">{d.detail}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  </div>

                  <Card className="p-5">
                    <h3 className="font-bold mb-1">Maturidade estrutural (independente do Improviso)</h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      Maturidade mostra até onde levar e é medida por capacidades, padrões, rituais, evidências e alçadas.
                      Improviso mostra por onde começar. Uma variável nunca é calculada a partir da outra — a validação é do Consultor 4X.
                    </p>
                    {result.maturityScore === null ? (
                      <p className="text-sm text-warning mb-4">
                        Este diagnóstico não tem o bloco estrutural respondido: a Maturidade exibida é leitura histórica de compatibilidade.
                      </p>
                    ) : (
                      <div className="mb-4 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">Score estrutural</p>
                          <p className="text-2xl font-black">{result.maturityScore}/100</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">Improviso geral (variável independente)</p>
                          <p className="text-2xl font-black">{result.improvisoGeral}/100</p>
                        </div>
                        {result.maturityDimensions.map((d) => (
                          <div key={d.key} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                            <span>{d.label}</span>
                            <span className="font-bold">{d.score}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                      Critérios mínimos de passagem
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {result.maturityCriteria.map((c) => (
                        <div key={c.label} className="flex items-center gap-2 text-sm">
                          {c.met ? (
                            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                          )}
                          <span className={c.met ? "" : "text-muted-foreground"}>{c.label}</span>
                        </div>
                      ))}
                    </div>

                    {activeDiag.notes && (
                      <p className="mt-4 text-sm text-muted-foreground border-t pt-3">
                        <strong>Nota do Consultor 4X:</strong> {activeDiag.notes}
                      </p>
                    )}
                  </Card>
                </>
              )}
            </TabsContent>

            {/* ------------------------------- Responder ------------------------------- */}
            <TabsContent value="responder" className="space-y-6 mt-6">
              {activeDiag.status !== "rascunho" ? (
                <Card className="p-10 text-center text-muted-foreground">
                  Este diagnóstico já foi consolidado. Abra uma nova versão para coletar respostas.
                </Card>
              ) : (
                <>
                  <Card className="p-5 flex flex-wrap items-end gap-4">
                    <div className="min-w-[220px]">
                      <Label>Grupo respondente</Label>
                      <Select value={group} onValueChange={(v) => setGroup(v as RespondentGroup)}>
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(GROUP_LABEL) as RespondentGroup[]).map((g) => (
                            <SelectItem key={g} value={g}>
                              {GROUP_LABEL[g]} · peso {Math.round(GROUP_WEIGHTS[g] * 100)}%
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <p className="text-sm text-muted-foreground">
                        {answeredCount} de {QUESTIONS.length} respondidas
                      </p>
                      <Progress value={(answeredCount / QUESTIONS.length) * 100} className="mt-2" />
                    </div>
                    {myResponse && (
                      <Button variant="outline" onClick={loadMyAnswers}>
                        Carregar minhas respostas
                      </Button>
                    )}
                    <Button onClick={() => saveResponse.mutate()} disabled={saveResponse.isPending}>
                      {myResponse ? "Atualizar resposta" : "Enviar resposta"}
                    </Button>
                  </Card>

                  {(["crescimento", "eficiencia", "encantamento", "lideranca"] as Pillar[]).map((pillar) => (
                    <Card key={pillar} className="p-5">
                      <h3 className="font-bold">{PILLAR_LABEL[pillar].label}</h3>
                      <p className="text-xs text-muted-foreground mb-4">{PILLAR_LABEL[pillar].description}</p>
                      <div className="space-y-3">
                        <ScaleLegend />
                        {BLINDSPOTS.filter((b) => b.pillar === pillar).map((bs) => (
                          <ScaleQuestion
                            key={bs.code}
                            id={bs.code}
                            statement={bs.statement}
                            tag={isStaff ? `${bs.code} · ${bs.title}` : undefined}
                            value={answers[bs.code]}
                            onChange={(v) => setAnswers((a) => ({ ...a, [bs.code]: v }))}
                          />
                        ))}
                      </div>
                    </Card>
                  ))}

                  <Card className="p-5">
                    <h3 className="font-bold">IDD · Dependência do dono</h3>
                    <p className="text-xs text-muted-foreground mb-4">Oito dimensões de dependência.</p>
                    <div className="space-y-3">
                      <ScaleLegend />
                      {IDD_DIMENSIONS.map((d) => (
                        <ScaleQuestion
                          key={d.key}
                          id={`IDD-${d.key}`}
                          statement={d.statement}
                          tag={d.label}
                          value={answers[`IDD-${d.key}`]}
                          onChange={(v) => setAnswers((a) => ({ ...a, [`IDD-${d.key}`]: v }))}
                        />
                      ))}
                    </div>
                  </Card>

                  <Card className="p-5">
                    <h3 className="font-bold">Maturidade estrutural</h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      Oito dimensões de estrutura instalada. Este bloco define a Maturidade e não influencia o Improviso.
                    </p>
                    <div className="space-y-3">
                      <ScaleLegend />
                      {IDD_DIMENSIONS.map((d) => (
                        <ScaleQuestion
                          key={d.key}
                          id={`MAT-${d.key}`}
                          statement={d.statement}
                          tag={d.label}
                          value={answers[`MAT-${d.key}`]}
                          onChange={(v) => setAnswers((a) => ({ ...a, [`MAT-${d.key}`]: v }))}
                        />
                      ))}
                    </div>
                  </Card>

                </>
              )}
            </TabsContent>

            {/* ------------------------------ Respondentes ----------------------------- */}
            <TabsContent value="respondentes" className="mt-6">
              <Card className="p-5">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <Users className="h-4 w-4" /> Respondentes e médias por grupo
                </h3>
                {responses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma resposta enviada ainda.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      {live?.groups.map((g) => (
                        <div key={g.group} className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">{GROUP_LABEL[g.group]}</p>
                          <p className="text-2xl font-black">{g.improviso}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {g.count} resposta{g.count > 1 ? "s" : ""} · peso {Math.round(GROUP_WEIGHTS[g.group] * 100)}%
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="divide-y">
                      {responses.map((r) => (
                        <div key={r.id} className="flex items-center justify-between py-2 text-sm">
                          <span className="truncate">{r.respondent_name || "Respondente"}</span>
                          <span className="text-muted-foreground">
                            {GROUP_LABEL[r.respondent_group as RespondentGroup]} · {fmtDate(r.submitted_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* -------------------------------- Versões -------------------------------- */}
            <TabsContent value="historico" className="mt-6">
              <Card className="divide-y">
                {diagnostics.map((d) => (
                  <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-semibold">{d.title || `Diagnóstico v${d.version}`}</p>
                      <p className="text-xs text-muted-foreground">
                        v{d.version} · aberto {fmtDate(d.created_at)} · validado {fmtDate(d.validated_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {d.improviso_score !== null && <Badge variant="outline">Improviso {d.improviso_score}</Badge>}
                      {d.idd_score !== null && <Badge variant="outline">IDD {d.idd_score}%</Badge>}
                      {d.maturity && <Badge className={MATURITY_LABEL[d.maturity as MaturityLevel].color}>{MATURITY_LABEL[d.maturity as MaturityLevel].label}</Badge>}
                      <Badge className={STATUS_LABEL[d.status].color}>{STATUS_LABEL[d.status].label}</Badge>
                    </div>
                  </div>
                ))}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      <Dialog open={validateOpen} onOpenChange={setValidateOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Validar classificação do diagnóstico</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              A sugestão do sistema não é a classificação final. O Consultor 4X confirma Maturidade, Pilar e BlindSpot prioritários.
            </p>
            <div>
              <Label>Maturidade validada</Label>
              <Select value={validation.maturity} onValueChange={(v) => setValidation((s) => ({ ...s, maturity: v as MaturityLevel }))}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MATURITY_ORDER.map((m) => (
                    <SelectItem key={m} value={m}>
                      {MATURITY_LABEL[m].label} — {MATURITY_LABEL[m].description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {live && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Sugestão do sistema: {MATURITY_LABEL[live.suggestedMaturity].label} · Maturidade estrutural{" "}
                  {live.maturityScore === null ? "não respondida" : `${live.maturityScore}/100`} · Improviso {live.improvisoGeral} · IDD {live.idd.score}%

                </p>
              )}
            </div>
            <div>
              <Label>Pilar prioritário</Label>
              <Select value={validation.pillar} onValueChange={(v) => setValidation((s) => ({ ...s, pillar: v as Pillar }))}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PILLAR_LABEL) as Pillar[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PILLAR_LABEL[p].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>BlindSpot prioritário</Label>
              <Select value={validation.blindspot} onValueChange={(v) => setValidation((s) => ({ ...s, blindspot: v }))}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {BLINDSPOTS.map((b) => (
                    <SelectItem key={b.code} value={b.code}>
                      {b.code} · {b.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Justificativa / observações</Label>
              <Textarea
                className="mt-1.5"
                rows={3}
                value={validation.notes}
                onChange={(e) => setValidation((s) => ({ ...s, notes: e.target.value }))}
                placeholder="Evidências consideradas, ajustes na classificação e limites de atribuição."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setValidateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => validate.mutate()} disabled={validate.isPending}>
              Validar e registrar baseline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
