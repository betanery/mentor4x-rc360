import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
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
import { Plus, Calendar, DollarSign, Trash2, Paperclip, MessageSquare, Loader2, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Goal = Tables<"goals">;
const STATUSES = ["nao_iniciado", "em_andamento", "concluido", "atrasado", "bloqueado"] as const;

export default function Goals() {
  const { current } = useCompany();
  const { user, isStaff } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [mentorDraft, setMentorDraft] = useState("");
  const [updateDraft, setUpdateDraft] = useState("");
  const [form, setForm] = useState({ title: "", description: "", pillar: "crescimento", indicator: "", financial_impact: "0", due_date: "", week_start: format(new Date(), "yyyy-MM-dd") });

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ["goals", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("*").eq("company_id", current!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Goal[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["goals", current?.id] });

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


  const createMut = useMutation({
    mutationFn: async () => {
      if (!current || !user) throw new Error("Sem empresa");
      const { error } = await supabase.from("goals").insert({
        company_id: current.id,
        title: form.title,
        description: form.description,
        pillar: form.pillar as Goal["pillar"],
        indicator: form.indicator,
        financial_impact: Number(form.financial_impact) || 0,
        due_date: form.due_date || null,
        week_start: form.week_start,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Meta criada");
      setOpen(false);
      setForm({ title: "", description: "", pillar: "crescimento", indicator: "", financial_impact: "0", due_date: "", week_start: format(new Date(), "yyyy-MM-dd") });
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
        subtitle="2 metas críticas por semana — board de execução estilo ClickUp."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-gradient-brand"><Plus className="h-4 w-4 mr-1" /> Nova meta</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Nova meta crítica</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Fechar 5 contratos novos" /></div>
                <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
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
              </div>
              <DialogFooter><Button onClick={() => createMut.mutate()} disabled={!form.title || createMut.isPending}>Criar meta</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading && <Card className="p-12 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Carregando metas...</Card>}

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

      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{detail?.title}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4">
              {detail.description && <p className="text-sm text-muted-foreground">{detail.description}</p>}

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
                <Label className="text-xs uppercase tracking-wide">Comentário do mentor</Label>
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
                    {detail.mentor_comment || "Aguardando feedback do mentor."}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
