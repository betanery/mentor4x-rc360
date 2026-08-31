import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { showError } from "@/lib/feedback";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/EmptyState";
import { ScaleLegend, ScaleQuestion } from "@/components/ScaleQuestion";
import { PILLAR_LABEL } from "@/lib/labels";
import {
  BLINDSPOTS,
  GROUP_LABEL,
  IDD_DIMENSIONS,
  MATURITY_DIMENSIONS,
  type Answers,
  type RespondentGroup,
} from "@/lib/see4x";
import { Copy, Link2, Loader2, Mic, Plus, Send, Share2, UserPlus, XCircle } from "lucide-react";

type Invite = {
  id: string;
  invite_kind: string;
  full_name: string | null;
  email: string | null;
  role_title: string | null;
  respondent_group: string;
  token: string;
  status: string;
  sent_at: string | null;
  responded_at: string | null;
  expires_at: string;
};

const INVITE_STATUS: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-muted text-muted-foreground" },
  enviado: { label: "Enviado", color: "bg-info/15 text-info" },
  respondido: { label: "Respondido", color: "bg-success/15 text-success" },
  expirado: { label: "Expirado", color: "bg-warning/15 text-warning" },
  cancelado: { label: "Cancelado", color: "bg-destructive/15 text-destructive" },
};

const newToken = () => `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
const respondUrl = (token: string) => `${window.location.origin}/responder/${token}`;
const fmt = (v?: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");

/**
 * Coleta do Diagnóstico 4X: link geral por empresa, convites individuais
 * rastreáveis e modo entrevista conduzido pelo Consultor/Estrategista.
 */
export function DiagnosticCollection({
  diagnosticId,
  companyId,
  contractId,
  status,
  isStaff,
  userId,
  responses,
}: {
  diagnosticId: string;
  companyId: string;
  contractId: string | null;
  status: string;
  isStaff: boolean;
  userId?: string;
  responses: { respondent_group: string; collection_method?: string | null }[];
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ full_name: "", email: "", role_title: "", respondent_group: "gestor" as RespondentGroup });
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [interview, setInterview] = useState({ full_name: "", role_title: "", respondent_group: "equipe" as RespondentGroup });
  const [answers, setAnswers] = useState<Answers>({});

  const { data: invites = [], isLoading } = useQuery({
    queryKey: ["diagnostic_invites", diagnosticId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diagnostic_invites")
        .select("id,invite_kind,full_name,email,role_title,respondent_group,token,status,sent_at,responded_at,expires_at")
        .eq("diagnostic_id", diagnosticId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Invite[];
    },
  });

  const general = invites.find((i) => i.invite_kind === "geral" && i.status !== "cancelado") ?? null;
  const individuals = invites.filter((i) => i.invite_kind === "individual");

  const coverage = useMemo(() => {
    const byGroup = (g: string) => responses.filter((r) => r.respondent_group === g).length;
    return {
      dono_socio: byGroup("dono_socio"),
      gestor: byGroup("gestor"),
      equipe: byGroup("equipe"),
      total: responses.length,
      entrevistas: responses.filter((r) => r.collection_method === "entrevista").length,
      links: responses.filter((r) => r.collection_method === "link").length,
    };
  }, [responses]);

  const expiresAt = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const createGeneral = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("diagnostic_invites").insert({
        diagnostic_id: diagnosticId,
        company_id: companyId,
        contract_id: contractId,
        invite_kind: "geral",
        respondent_group: "equipe",
        token: newToken(),
        status: "enviado",
        sent_at: new Date().toISOString(),
        invited_by: userId ?? null,
        expires_at: expiresAt(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diagnostic_invites", diagnosticId] });
      toast.success("Link geral criado. Quem responder informa nome, cargo e papel na empresa.");
    },
    onError: (e: Error) => showError("criar o link de coleta", e),
  });

  const addIndividual = useMutation({
    mutationFn: async () => {
      if (form.full_name.trim().length < 2) throw new Error("Informe o nome do respondente");
      const { error } = await supabase.from("diagnostic_invites").insert({
        diagnostic_id: diagnosticId,
        company_id: companyId,
        contract_id: contractId,
        invite_kind: "individual",
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        role_title: form.role_title.trim() || null,
        respondent_group: form.respondent_group,
        token: newToken(),
        status: "pendente",
        invited_by: userId ?? null,
        expires_at: expiresAt(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm({ full_name: "", email: "", role_title: "", respondent_group: "gestor" });
      qc.invalidateQueries({ queryKey: ["diagnostic_invites", diagnosticId] });
      toast.success("Convite criado com link individual rastreável.");
    },
    onError: (e: Error) => showError("criar o convite", e),
  });

  const markSent = useMutation({
    mutationFn: async (invite: Invite) => {
      const { error } = await supabase
        .from("diagnostic_invites")
        .update({ status: "enviado", sent_at: new Date().toISOString(), expires_at: expiresAt() })
        .eq("id", invite.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["diagnostic_invites", diagnosticId] }),
    onError: (e: Error) => showError("registrar o envio do convite", e),
  });

  const cancelInvite = useMutation({
    mutationFn: async (invite: Invite) => {
      const { error } = await supabase.from("diagnostic_invites").update({ status: "cancelado" }).eq("id", invite.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diagnostic_invites", diagnosticId] });
      toast.success("Convite cancelado — o link deixa de funcionar.");
    },
    onError: (e: Error) => showError("cancelar o convite", e),
  });

  const saveInterview = useMutation({
    mutationFn: async () => {
      if (interview.full_name.trim().length < 2) throw new Error("Informe quem foi entrevistado");
      const missing = BLINDSPOTS.filter((b) => !answers[b.code]).length;
      if (missing > 0) throw new Error(`Faltam ${missing} afirmações principais para registrar a entrevista`);
      const { error } = await supabase.from("diagnostic_responses").insert({
        diagnostic_id: diagnosticId,
        respondent_name: interview.full_name.trim(),
        respondent_role: interview.role_title.trim() || null,
        respondent_group: interview.respondent_group,
        collection_method: "entrevista",
        interviewer_user_id: userId ?? null,
        answers: answers as never,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setInterviewOpen(false);
      setAnswers({});
      setInterview({ full_name: "", role_title: "", respondent_group: "equipe" });
      qc.invalidateQueries({ queryKey: ["diagnostic_responses", diagnosticId] });
      toast.success("Entrevista registrada e identificada como coleta assistida.");
    },
    onError: (e: Error) => showError("registrar a entrevista", e),
  });

  const copy = async (token: string) => {
    await navigator.clipboard.writeText(respondUrl(token));
    toast.success("Link copiado.");
  };

  const share = (invite: Invite) => {
    const text = `Olá${invite.full_name ? ` ${invite.full_name}` : ""}! Este é o seu link do Diagnóstico 4X: ${respondUrl(invite.token)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  const mailto = (invite: Invite) => {
    const subject = "Diagnóstico 4X — sua resposta em 10 minutos";
    const body = `Olá${invite.full_name ? ` ${invite.full_name}` : ""},\n\nVocê foi convidado para responder o Diagnóstico 4X da empresa. São 20 afirmações e leva cerca de 10 minutos. Não existe resposta certa — o valor está na sinceridade.\n\nResponda aqui: ${respondUrl(invite.token)}\n\nO link é individual e expira em 30 dias.\n\nMENTOR 4X`;
    window.open(`mailto:${invite.email ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    markSent.mutate(invite);
  };

  const closed = status !== "rascunho";
  const answeredInterview = BLINDSPOTS.filter((b) => answers[b.code]).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {(["dono_socio", "gestor", "equipe"] as RespondentGroup[]).map((g) => (
          <Card key={g} className="p-5">
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">{GROUP_LABEL[g]}</p>
            <p className="text-3xl font-black mt-1">{coverage[g]}</p>
            <p className="text-xs text-muted-foreground mt-1">respostas registradas</p>
          </Card>
        ))}
        <Card className="p-5">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">Como responderam</p>
          <p className="text-sm mt-2">{coverage.links} por link</p>
          <p className="text-sm">{coverage.entrevistas} por entrevista</p>
          <p className="text-xs text-muted-foreground mt-1">Total: {coverage.total}</p>
        </Card>
      </div>

      {closed && (
        <Card className="p-4 text-sm text-muted-foreground">
          Este diagnóstico não está mais em coleta — os links criados param de aceitar respostas.
        </Card>
      )}

      <Card className="p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold">Link geral da empresa</h3>
            <p className="text-xs text-muted-foreground">
              Um único link para distribuir ao time. Quem responde informa nome, cargo e papel na empresa.
            </p>
          </div>
          {isStaff && !general && (
            <Button size="sm" onClick={() => createGeneral.mutate()} disabled={createGeneral.isPending}>
              <Link2 className="h-4 w-4 mr-1.5" /> Gerar link geral
            </Button>
          )}
        </div>
        {general && (
          <div className="flex flex-wrap items-center gap-2">
            <Input readOnly value={respondUrl(general.token)} className="flex-1 min-w-[240px] font-mono text-xs" aria-label="Link geral de resposta" />
            <Button size="sm" variant="outline" onClick={() => copy(general.token)} aria-label="Copiar link geral">
              <Copy className="h-4 w-4 mr-1.5" /> Copiar
            </Button>
            <Button size="sm" variant="outline" onClick={() => share(general)} aria-label="Compartilhar link geral no WhatsApp">
              <Share2 className="h-4 w-4 mr-1.5" /> WhatsApp
            </Button>
            {isStaff && (
              <Button size="sm" variant="ghost" onClick={() => cancelInvite.mutate(general)} aria-label="Cancelar link geral">
                <XCircle className="h-4 w-4 mr-1.5" /> Cancelar
              </Button>
            )}
          </div>
        )}
      </Card>

      {isStaff && (
        <Card className="p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold">Convites individuais</h3>
              <p className="text-xs text-muted-foreground">
                Cada pessoa recebe um link próprio já vinculado à empresa, ao cargo e ao papel — o status acompanha quem
                respondeu.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setInterviewOpen(true)} disabled={closed}>
              <Mic className="h-4 w-4 mr-1.5" /> Registrar entrevista
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-5">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="inv_name">Nome *</Label>
              <Input id="inv_name" value={form.full_name} onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv_role">Cargo</Label>
              <Input id="inv_role" value={form.role_title} onChange={(e) => setForm((s) => ({ ...s, role_title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv_email">E-mail</Label>
              <Input id="inv_email" type="email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Papel</Label>
              <Select value={form.respondent_group} onValueChange={(v) => setForm((s) => ({ ...s, respondent_group: v as RespondentGroup }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(GROUP_LABEL) as RespondentGroup[]).map((g) => (
                    <SelectItem key={g} value={g}>
                      {GROUP_LABEL[g]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button size="sm" onClick={() => addIndividual.mutate()} disabled={addIndividual.isPending || closed}>
            <UserPlus className="h-4 w-4 mr-1.5" /> Criar convite
          </Button>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando convites…</p>
          ) : individuals.length === 0 ? (
            <EmptyState
              icon={Plus}
              title="Nenhum convite individual"
              description="Crie convites para o dono, gestores e equipe para acompanhar a cobertura da coleta."
            />
          ) : (
            <div className="divide-y">
              {individuals.map((inv) => (
                <div key={inv.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-[200px]">
                    <p className="text-sm font-semibold">{inv.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {GROUP_LABEL[inv.respondent_group as RespondentGroup]}
                      {inv.role_title ? ` · ${inv.role_title}` : ""}
                      {inv.email ? ` · ${inv.email}` : ""}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Enviado {fmt(inv.sent_at)} · Respondido {fmt(inv.responded_at)} · Expira {fmt(inv.expires_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={INVITE_STATUS[inv.status]?.color}>{INVITE_STATUS[inv.status]?.label ?? inv.status}</Badge>
                    <Button size="sm" variant="outline" onClick={() => copy(inv.token)} aria-label={`Copiar link de ${inv.full_name}`}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => share(inv)} aria-label={`Enviar link de ${inv.full_name} por WhatsApp`}>
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => mailto(inv)} aria-label={`Enviar link de ${inv.full_name} por e-mail`}>
                      <Send className="h-4 w-4" />
                    </Button>
                    {inv.status !== "respondido" && inv.status !== "cancelado" && (
                      <Button size="sm" variant="ghost" onClick={() => cancelInvite.mutate(inv)} aria-label={`Cancelar convite de ${inv.full_name}`}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Dialog open={interviewOpen} onOpenChange={setInterviewOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar entrevista</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Use este modo quando o Consultor 4X ou o Estrategista conduz a conversa e preenche as respostas junto da pessoa. A
              resposta fica identificada como coleta assistida.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="ent_name">Entrevistado *</Label>
                <Input id="ent_name" value={interview.full_name} onChange={(e) => setInterview((s) => ({ ...s, full_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ent_role">Cargo</Label>
                <Input id="ent_role" value={interview.role_title} onChange={(e) => setInterview((s) => ({ ...s, role_title: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Papel</Label>
                <Select
                  value={interview.respondent_group}
                  onValueChange={(v) => setInterview((s) => ({ ...s, respondent_group: v as RespondentGroup }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(GROUP_LABEL) as RespondentGroup[]).map((g) => (
                      <SelectItem key={g} value={g}>
                        {GROUP_LABEL[g]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">
                {answeredInterview} de {BLINDSPOTS.length} afirmações principais
              </p>
              <Progress value={(answeredInterview / BLINDSPOTS.length) * 100} className="mt-2" />
            </div>

            <ScaleLegend />
            {(["crescimento", "eficiencia", "encantamento", "lideranca"] as const).map((pillar) => (
              <div key={pillar} className="space-y-2">
                <h4 className="text-sm font-bold">{PILLAR_LABEL[pillar].label}</h4>
                {BLINDSPOTS.filter((b) => b.pillar === pillar).map((bs) => (
                  <ScaleQuestion
                    key={bs.code}
                    id={bs.code}
                    statement={bs.statement}
                    tag={bs.title}
                    value={answers[bs.code]}
                    onChange={(v) => setAnswers((a) => ({ ...a, [bs.code]: v }))}
                  />
                ))}
              </div>
            ))}
            <div className="space-y-2">
              <h4 className="text-sm font-bold">Dependência do dono</h4>
              {IDD_DIMENSIONS.map((d) => (
                <ScaleQuestion
                  key={d.key}
                  id={`IDD-${d.key}`}
                  statement={d.statement}
                  value={answers[`IDD-${d.key}`]}
                  onChange={(v) => setAnswers((a) => ({ ...a, [`IDD-${d.key}`]: v }))}
                />
              ))}
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-bold">Estrutura instalada</h4>
              {MATURITY_DIMENSIONS.map((d) => (
                <ScaleQuestion
                  key={d.key}
                  id={`MAT-${d.key}`}
                  statement={d.statement}
                  value={answers[`MAT-${d.key}`]}
                  onChange={(v) => setAnswers((a) => ({ ...a, [`MAT-${d.key}`]: v }))}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInterviewOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => saveInterview.mutate()} disabled={saveInterview.isPending}>
              {saveInterview.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Registrar entrevista
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
