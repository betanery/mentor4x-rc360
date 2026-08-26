import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useContract } from "@/hooks/useContract";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GOAL_STATUS_LABEL, formatBRL, PILLAR_LABEL } from "@/lib/labels";
import { Plus, Calendar, DollarSign, Trash2, Paperclip, MessageSquare, Loader2, ExternalLink, AlertTriangle, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { BLINDSPOTS, CAPACITIES, blindspotByCode, capacityByCode } from "@/lib/see4x";
import type { Tables } from "@/integrations/supabase/types";


type Goal = Tables<"goals">;
const STATUSES = ["nao_iniciado", "em_andamento", "concluido", "atrasado", "bloqueado"] as const;
const ACTIVE_STATUSES: Goal["status"][] = ["nao_iniciado", "em_andamento", "atrasado", "bloqueado"];
/** Alçada SEE_4X: até 2 Metas Críticas ativas por empresa. */
const CRITICAL_LIMIT = 2;
const GOVERNANCE_ACTION_LABEL: Record<string, string> = {
  meta_excedente_solicitada: "Meta excedente solicitada",
  meta_excedente_aprovada: "Meta excedente aprovada pelo Consultor 4X",
  meta_excedente_rejeitada: "Meta excedente recusada pelo Consultor 4X",
};


export default function Goals() {
  const { current } = useCompany();
  const { currentContract } = useContract();
  const { user, isStaff, isConsultor } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [mentorDraft, setMentorDraft] = useState("");
  const [updateDraft, setUpdateDraft] = useState("");
  const [approvalDraft, setApprovalDraft] = useState("");
  const [form, setForm] = useState({ title: "", description: "", pillar: "crescimento", indicator: "", financial_impact: "0", due_date: "", week_start: format(new Date(), "yyyy-MM-dd"), blindspot_code: "", capacity_code: "", bottleneck_id: "", capacity_justification: "", current_situation: "", expected_result: "", notes: "" });


  const { data: goals = [], isLoading } = useQuery({
    queryKey: ["goals", current?.id, currentContract?.id],
    enabled: !!current,
    queryFn: async () => {
      let query = supabase.from("goals").select("*").eq("company_id", current!.id).order("created_at", { ascending: false });
      query = currentContract ? query.eq("contract_id", currentContract.id) : query.is("contract_id", null);
      const { data, error } = await query;
      if (error) throw error;
      return data as Goal[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["goals", current?.id, currentContract?.id] });

  const { data: updates = [] } = useQuery({
    queryKey: ["goal_updates", detailId],
    enabled: !!detailId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goal_updates")
        .select("*")
        .eq("goal_id", detailId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as Tables<"goal_updates">[];
    },
  });

  const addUpdateMut = useMutation({
    mutationFn: async () => {
      if (!detailId || !user) throw new Error("Sem meta");
      const { error } = await supabase.from("goal_updates").insert({ goal_id: detailId, author_id: user.id, message: updateDraft });
      if (error) throw error;
    },
    onSuccess: () => {
      setUpdateDraft("");
      qc.invalidateQueries({ queryKey: ["goal_updates", detailId] });
      toast.success("Atualização registrada");
    },
    onError: (e: any) => toast.error(e.message),
  });


  const { data: bottlenecks = [] } = useQuery({
    queryKey: ["bottlenecks", current?.id, currentContract?.id],
    enabled: !!current,
    queryFn: async () => {
      let query = supabase
        .from("bottlenecks")
        .select("id, name, blindspot_code, resolved")
        .eq("company_id", current!.id)
        .eq("resolved", false)
        .limit(50);
      query = currentContract ? query.eq("contract_id", currentContract.id) : query.is("contract_id", null);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Vincular a meta ao BlindSpot puxa o pilar e as capacidades correspondentes.
  const pickBlindspot = (code: string) => {
    const bs = blindspotByCode(code);
    setForm((s) => ({
      ...s,
      blindspot_code: code,
      capacity_code: "",
      pillar: bs ? bs.pillar : s.pillar,
    }));
  };

  // Alçada de capacidade: contam apenas Metas Críticas ativas já aprovadas.
  const activeCritical = goals.filter(
    (g) => g.is_critical && g.approval_status === "aprovada" && ACTIVE_STATUSES.includes(g.status),
  );
  const atCapacity = activeCritical.length >= CRITICAL_LIMIT;
  const pendingApproval = goals.filter((g) => g.approval_status === "pendente");

  const { data: governance = [] } = useQuery({
    queryKey: ["governance_log", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("governance_log")
        .select("*")
        .eq("company_id", current!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as Tables<"governance_log">[];
    },
  });

  const logDecision = async (entry: {
    action: string;
    entity: string;
    entity_id?: string | null;
    justification?: string | null;
    previous_value?: string | null;
    new_value?: string | null;
  }) => {
    if (!current || !user) return;
    await supabase.from("governance_log").insert({ company_id: current.id, actor_id: user.id, ...entry });
    qc.invalidateQueries({ queryKey: ["governance_log", current.id] });
  };

  const createMut = useMutation({
    mutationFn: async () => {
      if (!current || !user) throw new Error("Sem empresa");
      // Excedente de capacidade entra como pendente e só vale após aprovação do Consultor 4X.
      const needsApproval = atCapacity;
      if (needsApproval && !form.capacity_justification.trim()) {
        throw new Error("Limite de 2 Metas Críticas ativas: escreva a justificativa de capacidade.");
      }
      const { data, error } = await supabase
        .from("goals")
        .insert({
          company_id: current.id,
          contract_id: currentContract?.id ?? null,
          title: form.title,
          description: form.description,
          pillar: form.pillar as Goal["pillar"],
          indicator: form.indicator,
          financial_impact: Number(form.financial_impact) || 0,
          due_date: form.due_date || null,
          week_start: form.week_start,
          blindspot_code: form.blindspot_code || null,
          capacity_code: form.capacity_code || null,
          bottleneck_id: form.bottleneck_id || null,
          current_situation: form.current_situation || null,
          expected_result: form.expected_result || null,
          notes: form.notes || null,

          is_critical: true,
          approval_status: needsApproval ? "pendente" : "aprovada",
          capacity_justification: needsApproval ? form.capacity_justification.trim() : null,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (needsApproval) {
        await logDecision({
          action: "meta_excedente_solicitada",
          entity: "goal",
          entity_id: data.id,
          justification: form.capacity_justification.trim(),
          new_value: "pendente",
        });
      }
      return needsApproval;
    },
    onSuccess: (needsApproval) => {
      toast.success(needsApproval ? "Meta registrada como pendente de aprovação do Consultor 4X." : "Meta criada");
      setOpen(false);
      setForm({ title: "", description: "", pillar: "crescimento", indicator: "", financial_impact: "0", due_date: "", week_start: format(new Date(), "yyyy-MM-dd"), blindspot_code: "", capacity_code: "", bottleneck_id: "", capacity_justification: "", current_situation: "", expected_result: "", notes: "" });

      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Aprovação/recusa da meta excedente — decisão humana, sempre registrada.
  const decideMut = useMutation({
    mutationFn: async ({ goal, approve, note }: { goal: Goal; approve: boolean; note: string }) => {
      if (!user) throw new Error("Sem usuário");
      const { error } = await supabase
        .from("goals")
        .update(
          approve
            ? { approval_status: "aprovada", approved_by: user.id, approved_at: new Date().toISOString(), validated_by: user.id, validated_at: new Date().toISOString(), capacity_justification: note || goal.capacity_justification }
            : { approval_status: "rejeitada", approved_by: user.id, approved_at: new Date().toISOString() },

        )
        .eq("id", goal.id);
      if (error) throw error;
      await logDecision({
        action: approve ? "meta_excedente_aprovada" : "meta_excedente_rejeitada",
        entity: "goal",
        entity_id: goal.id,
        justification: note || goal.capacity_justification,
        previous_value: "pendente",
        new_value: approve ? "aprovada" : "rejeitada",
      });
    },
    onSuccess: () => {
      setApprovalDraft("");
      toast.success("Decisão registrada");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });


  const updateStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("goals").update({ status: status as Goal["status"] }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Meta removida"); invalidate(); },
  });

  const updateMentorCommentMut = useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment: string }) => {
      const { error } = await supabase.from("goals").update({ mentor_comment: comment }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Comentário salvo"); invalidate(); },
  });

  const uploadEvidence = async (goal: Goal, file: File) => {
    if (!current) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Máx 10MB"); return; }
    setUploadingFor(goal.id);
    const ext = file.name.split(".").pop() || "bin";
    const path = `${current.id}/${goal.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("evidences").upload(path, file, { contentType: file.type });
    if (upErr) { setUploadingFor(null); toast.error(upErr.message); return; }
    const { data: signed } = await supabase.storage.from("evidences").createSignedUrl(path, 60 * 60 * 24 * 365);
    const url = signed?.signedUrl || path;
    const { error: updErr } = await supabase.from("goals").update({ evidence_url: url }).eq("id", goal.id);
    setUploadingFor(null);
    if (updErr) { toast.error(updErr.message); return; }
    toast.success("Evidência anexada");
    invalidate();
  };

  const remove = (id: string) => { if (confirm("Excluir meta?")) removeMut.mutate(id); };
  const detail = goals.find((g) => g.id === detailId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sistema de Metas"
        subtitle="Até 2 Metas Críticas ativas por empresa — a terceira exige justificativa de capacidade e aprovação do Consultor 4X."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-gradient-brand"><Plus className="h-4 w-4 mr-1" /> Nova meta</Button></DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Nova Meta Crítica</DialogTitle></DialogHeader>
              <div className="space-y-3">
                {atCapacity && (
                  <div className="rounded-lg border border-gold/40 bg-gold/10 p-3">
                    <p className="flex items-center gap-2 text-xs font-bold text-gold">
                      <AlertTriangle className="h-4 w-4" /> Alerta de capacidade
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      A empresa já tem {activeCritical.length} Metas Críticas ativas. Esta meta entra como <strong>pendente</strong> e só passa a valer após aprovação do Consultor 4X.
                    </p>
                    <div className="mt-2">
                      <Label>Justificativa de capacidade</Label>
                      <Textarea
                        rows={3}
                        value={form.capacity_justification}
                        onChange={(e) => setForm({ ...form, capacity_justification: e.target.value })}
                        placeholder="Por que a empresa consegue sustentar uma terceira meta ativa?"
                      />
                    </div>
                  </div>
                )}
                <div><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Fechar 5 contratos novos" /></div>
                <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>

                <div className="grid grid-cols-1 gap-3 rounded-lg border border-border p-3 bg-muted/30">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Vínculo metodológico SEE_4X</p>
                  <div>
                    <Label>BlindSpot</Label>
                    <Select value={form.blindspot_code} onValueChange={pickBlindspot}>
                      <SelectTrigger><SelectValue placeholder="Selecione o BlindSpot" /></SelectTrigger>
                      <SelectContent>
                        {BLINDSPOTS.map((bs) => <SelectItem key={bs.code} value={bs.code}>{bs.code} · {bs.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Capacidade estruturante</Label>
                    <Select
                      value={form.capacity_code}
                      onValueChange={(v) => setForm({ ...form, capacity_code: v })}
                      disabled={!form.blindspot_code}
                    >
                      <SelectTrigger><SelectValue placeholder={form.blindspot_code ? "Selecione a capacidade" : "Escolha o BlindSpot primeiro"} /></SelectTrigger>
                      <SelectContent>
                        {CAPACITIES.filter((c) => c.blindspot === form.blindspot_code).map((c) => (
                          <SelectItem key={c.code} value={c.code}>{c.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Gargalo atacado</Label>
                    <Select value={form.bottleneck_id} onValueChange={(v) => setForm({ ...form, bottleneck_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Opcional — gargalo do Top 5" /></SelectTrigger>
                      <SelectContent>
                        {bottlenecks.length === 0 && <SelectItem value="sem-gargalo" disabled>Nenhum gargalo ativo</SelectItem>}
                        {bottlenecks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Pilar</Label>
                    <Select value={form.pillar} onValueChange={(v) => setForm({ ...form, pillar: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(PILLAR_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Indicador</Label><Input value={form.indicator} onChange={(e) => setForm({ ...form, indicator: e.target.value })} placeholder="Ex.: R$ 100k" /></div>
                  <div><Label>Impacto financeiro (R$)</Label><Input type="number" value={form.financial_impact} onChange={(e) => setForm({ ...form, financial_impact: e.target.value })} /></div>
                  <div><Label>Prazo</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
                  <div className="col-span-2"><Label>Semana (início)</Label><Input type="date" value={form.week_start} onChange={(e) => setForm({ ...form, week_start: e.target.value })} /></div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label>Situação atual</Label>
                    <Textarea rows={2} value={form.current_situation} onChange={(e) => setForm({ ...form, current_situation: e.target.value })} placeholder="Como está hoje, com número quando houver" />
                  </div>
                  <div>
                    <Label>Resultado esperado</Label>
                    <Textarea rows={2} value={form.expected_result} onChange={(e) => setForm({ ...form, expected_result: e.target.value })} placeholder="O que passa a ser verdade quando a meta for atingida" />
                  </div>
                  <div>
                    <Label>Observações</Label>
                    <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Riscos, dependências e combinados" />
                  </div>
                </div>

              </div>
              <DialogFooter><Button onClick={() => createMut.mutate()} disabled={!form.title || createMut.isPending}>Criar meta</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading && <Card className="p-12 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Carregando metas...</Card>}

      <Card className="p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Alçada de capacidade</p>
            <p className="text-sm font-semibold">
              {activeCritical.length} de {CRITICAL_LIMIT} Metas Críticas ativas
            </p>
          </div>
          {atCapacity && (
            <Badge variant="secondary" className="bg-gold/15 text-gold font-semibold">
              <AlertTriangle className="h-3 w-3 mr-1" /> Capacidade no limite
            </Badge>
          )}
          {pendingApproval.length > 0 && (
            <Badge variant="secondary" className="bg-warning/15 text-warning font-semibold">
              <ShieldCheck className="h-3 w-3 mr-1" /> {pendingApproval.length} aguardando aprovação
            </Badge>
          )}
        </div>
      </Card>


      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {STATUSES.map((status) => {
          const items = goals.filter((g) => g.status === status);
          const meta = GOAL_STATUS_LABEL[status];
          return (
            <div key={status} className="space-y-3">
              <div className="flex items-center justify-between px-2">
                <Badge className={`${meta.color} font-semibold`} variant="secondary">{meta.label}</Badge>
                <span className="text-xs font-bold text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2 min-h-[120px]">
                {items.map((g) => {
                  const p = g.pillar ? PILLAR_LABEL[g.pillar] : null;
                  return (
                    <Card key={g.id} className="p-3 shadow-card hover:shadow-elegant transition-all cursor-pointer group" onClick={() => { setDetailId(g.id); setMentorDraft(g.mentor_comment || ""); }}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm line-clamp-2 flex-1">{g.title}</p>
                        <button onClick={(e) => { e.stopPropagation(); remove(g.id); }} className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      </div>
                      {p && <span className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded bg-gradient-to-r ${p.color} text-white`}>{p.label}</span>}
                      {g.approval_status === "pendente" && (
                        <span className="inline-block mt-2 ml-1 text-[10px] font-bold px-2 py-0.5 rounded bg-warning/15 text-warning">Aguardando aprovação</span>
                      )}
                      {g.approval_status === "rejeitada" && (
                        <span className="inline-block mt-2 ml-1 text-[10px] font-bold px-2 py-0.5 rounded bg-destructive/15 text-destructive">Excedente recusado</span>
                      )}

                      {g.blindspot_code && (
                        <div className="mt-2 text-[10px] leading-tight text-muted-foreground">
                          <span className="font-bold text-gold">{g.blindspot_code}</span>{" "}
                          {blindspotByCode(g.blindspot_code)?.title}
                          {g.capacity_code && <div>Capacidade: {capacityByCode(g.capacity_code)?.title}</div>}
                        </div>
                      )}

                      {g.financial_impact && g.financial_impact > 0 && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-success font-semibold">
                          <DollarSign className="h-3 w-3" />{formatBRL(g.financial_impact)}
                        </div>
                      )}
                      {g.due_date && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Calendar className="h-3 w-3" />{format(new Date(g.due_date), "dd/MM/yyyy")}
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                        {g.evidence_url && <Paperclip className="h-3 w-3 text-primary" />}
                        {g.mentor_comment && <MessageSquare className="h-3 w-3 text-gold" />}
                      </div>
                      <Select value={g.status} onValueChange={(v) => updateStatusMut.mutate({ id: g.id, status: v })}>
                        <SelectTrigger className="h-7 mt-2 text-[11px]" onClick={(e) => e.stopPropagation()}><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{GOAL_STATUS_LABEL[s].label}</SelectItem>)}</SelectContent>
                      </Select>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <Card className="p-5 shadow-card">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-gold" /> Registro de decisões
        </h3>
        <div className="mt-3 space-y-2">
          {governance.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma decisão de alçada registrada nesta empresa.</p>}
          {governance.map((g) => (
            <div key={g.id} className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold">{GOVERNANCE_ACTION_LABEL[g.action] ?? g.action}</p>
                <span className="text-[10px] text-muted-foreground">{format(new Date(g.created_at), "dd/MM/yyyy HH:mm")}</span>
              </div>
              {g.justification && <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{g.justification}</p>}
            </div>
          ))}
        </div>
      </Card>


      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{detail?.title}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4">
              {detail.approval_status !== "aprovada" && (
                <div className={`rounded-lg border p-3 ${detail.approval_status === "pendente" ? "border-warning/40 bg-warning/10" : "border-destructive/40 bg-destructive/10"}`}>
                  <p className="text-xs font-bold uppercase tracking-widest">
                    {detail.approval_status === "pendente" ? "Meta excedente aguardando aprovação" : "Meta excedente recusada"}
                  </p>
                  {detail.capacity_justification && (
                    <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">
                      Justificativa de capacidade: {detail.capacity_justification}
                    </p>
                  )}
                  {isConsultor && detail.approval_status === "pendente" && (
                    <div className="mt-2 space-y-2">
                      <Textarea
                        rows={2}
                        value={approvalDraft}
                        onChange={(e) => setApprovalDraft(e.target.value)}
                        placeholder="Parecer da decisão (opcional)"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" disabled={decideMut.isPending} onClick={() => decideMut.mutate({ goal: detail, approve: true, note: approvalDraft })}>
                          Aprovar excedente
                        </Button>
                        <Button size="sm" variant="outline" disabled={decideMut.isPending} onClick={() => decideMut.mutate({ goal: detail, approve: false, note: approvalDraft })}>
                          Recusar
                        </Button>
                      </div>
                    </div>
                  )}
                  {!isConsultor && detail.approval_status === "pendente" && (
                    <p className="mt-1 text-xs text-muted-foreground">Somente o Consultor 4X pode liberar esta meta.</p>
                  )}
                </div>
              )}
              {detail.description && <p className="text-sm text-muted-foreground">{detail.description}</p>}

              {(detail.current_situation || detail.expected_result || detail.notes) && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {detail.current_situation && (
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Situação atual</p>
                      <p className="text-sm whitespace-pre-wrap">{detail.current_situation}</p>
                    </div>
                  )}
                  {detail.expected_result && (
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Resultado esperado</p>
                      <p className="text-sm whitespace-pre-wrap">{detail.expected_result}</p>
                    </div>
                  )}
                  {detail.notes && (
                    <div className="rounded-lg border border-border bg-muted/30 p-3 sm:col-span-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Observações</p>
                      <p className="text-sm whitespace-pre-wrap">{detail.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {detail.validated_at && (
                <p className="text-xs text-muted-foreground">
                  Validada pelo Consultor 4X em {format(new Date(detail.validated_at), "dd/MM/yyyy HH:mm")}
                </p>
              )}




              <div>
                <Label className="text-xs uppercase tracking-wide">Evidência</Label>
                {detail.evidence_url ? (
                  <a href={detail.evidence_url} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-2 text-sm text-primary hover:underline">
                    <Paperclip className="h-4 w-4" /> Ver evidência atual <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">Sem evidência ainda.</p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    type="file"
                    onChange={(e) => e.target.files?.[0] && uploadEvidence(detail, e.target.files[0])}
                    disabled={uploadingFor === detail.id}
                  />
                  {uploadingFor === detail.id && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
              </div>

              <div>
                <Label className="text-xs uppercase tracking-wide">Parecer do Consultor 4X</Label>
                {isStaff ? (
                  <>
                    <Textarea value={mentorDraft} onChange={(e) => setMentorDraft(e.target.value)} rows={3} placeholder="Feedback, próximos passos..." className="mt-1" />
                    <Button
                      size="sm"
                      className="mt-2"
                      onClick={() => updateMentorCommentMut.mutate({ id: detail.id, comment: mentorDraft })}
                      disabled={updateMentorCommentMut.isPending}
                    >
                      Salvar comentário
                    </Button>
                  </>
                ) : (
                  <p className="mt-1 text-sm whitespace-pre-wrap p-3 bg-muted/40 rounded-lg">
                    {detail.mentor_comment || "Aguardando parecer do Consultor 4X."}
                  </p>
                )}
              </div>

              <div>
                <Label className="text-xs uppercase tracking-wide">Histórico de atualizações</Label>
                <div className="mt-2 space-y-2">
                  <Textarea value={updateDraft} onChange={(e) => setUpdateDraft(e.target.value)} rows={2} placeholder="O que avançou nesta meta?" />
                  <Button size="sm" variant="outline" onClick={() => addUpdateMut.mutate()} disabled={!updateDraft.trim() || addUpdateMut.isPending}>
                    Registrar atualização
                  </Button>
                </div>
                <div className="mt-3 space-y-2">
                  {updates.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma atualização registrada ainda.</p>}
                  {updates.map((u) => (
                    <div key={u.id} className="p-3 rounded-lg bg-muted/40 border border-border">
                      <p className="text-sm whitespace-pre-wrap">{u.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(u.created_at), "dd/MM/yyyy HH:mm")}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
