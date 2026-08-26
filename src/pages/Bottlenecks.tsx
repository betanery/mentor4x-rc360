import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useContract } from "@/hooks/useContract";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { URGENCY_LABEL, formatBRL, PILLAR_LABEL } from "@/lib/labels";
import { BLINDSPOTS, blindspotByCode } from "@/lib/see4x";
import { useAuth } from "@/hooks/useAuth";
import { Plus, CheckCircle2, Trash2, Loader2, Target, History, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Bottleneck = Tables<"bottlenecks">;
type RankHistory = Tables<"bottleneck_rank_history">;

const EMPTY = {
  name: "", area: "", impact: "", urgency: "media", estimated_value: "0", correction_plan: "",
  blindspot_code: "", capacity_code: "", rank_position: "", root_cause: "", expected_result: "", due_date: "",
};

const URGENCY_WEIGHT: Record<string, number> = { critica: 4, alta: 3, media: 2, baixa: 1 };

/** Recomendação do Top 5: criticidade × impacto financeiro × urgência (pendência considerada). */
function priorityScore(b: Bottleneck, maxValue: number) {
  const urgency = URGENCY_WEIGHT[b.urgency] ?? 1;
  const impact = maxValue > 0 ? Number(b.estimated_value || 0) / maxValue : 0;
  const pending = (100 - (b.progress ?? 0)) / 100;
  return urgency * 25 + impact * 50 + pending * 25;
}


export default function Bottlenecks() {
  const { current } = useCompany();
  const { currentContract } = useContract();
  const { user, isConsultor } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [rankTarget, setRankTarget] = useState<Bottleneck | null>(null);
  const [newRank, setNewRank] = useState("1");
  const [rankJustification, setRankJustification] = useState("");


  const { data: items = [], isLoading } = useQuery({
    queryKey: ["bottlenecks", current?.id, currentContract?.id],
    enabled: !!current,
    queryFn: async () => {
      let query = supabase
        .from("bottlenecks")
        .select("*")
        .eq("company_id", current!.id)
        .order("rank_position", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(200);
      query = currentContract ? query.eq("contract_id", currentContract.id) : query.is("contract_id", null);
      const { data, error } = await query;
      if (error) throw error;
      return data as Bottleneck[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["bottlenecks", current?.id, currentContract?.id] });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!current) throw new Error("Selecione uma empresa");
      const { error } = await supabase.from("bottlenecks").insert({
        company_id: current.id,
        contract_id: currentContract?.id ?? null,
        name: form.name,
        area: form.area || null,
        impact: form.impact || null,
        urgency: form.urgency as Bottleneck["urgency"],
        estimated_value: Number(form.estimated_value) || 0,
        correction_plan: form.correction_plan || null,
        blindspot_code: form.blindspot_code || null,
        capacity_code: form.capacity_code || null,
        rank_position: form.rank_position ? Number(form.rank_position) : null,
        root_cause: form.root_cause || null,
        expected_result: form.expected_result || null,
        due_date: form.due_date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gargalo registrado");
      setOpen(false);
      setForm(EMPTY);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const progressMut = useMutation({
    mutationFn: async ({ id, progress }: { id: string; progress: number }) => {
      const { error } = await supabase.from("bottlenecks").update({ progress, resolved: progress >= 100 }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bottlenecks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Gargalo removido"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: history = [] } = useQuery({
    queryKey: ["bottleneck_rank_history", current?.id, currentContract?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bottleneck_rank_history")
        .select("*")
        .eq("company_id", current!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as RankHistory[];
    },
  });

  const rankMut = useMutation({
    mutationFn: async () => {
      if (!rankTarget || !current) throw new Error("Selecione o gargalo");
      const position = Number(newRank);
      if (!position || position < 1 || position > 5) throw new Error("A posição deve estar entre 1 e 5");
      if (!rankJustification.trim()) throw new Error("Registre a justificativa da mudança");
      const { error } = await supabase
        .from("bottlenecks")
        .update({ rank_position: position })
        .eq("id", rankTarget.id);
      if (error) throw error;
      // O histórico de posição é gravado automaticamente pelo banco; a justificativa entra na auditoria.
      await supabase.from("governance_log").insert({
        company_id: current.id,
        actor_id: user?.id ?? null,
        action: "top5_rank_change",
        entity: "bottlenecks",
        entity_id: rankTarget.id,
        previous_value: rankTarget.rank_position ? String(rankTarget.rank_position) : null,
        new_value: String(position),
        justification: rankJustification.trim(),
      });
    },
    onSuccess: () => {
      toast.success("Posição do Top 5 atualizada e registrada no histórico");
      setRankTarget(null);
      setRankJustification("");
      invalidate();
      qc.invalidateQueries({ queryKey: ["bottleneck_rank_history", current?.id, currentContract?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pickBlindspot = (code: string) => {
    const bs = blindspotByCode(code);
    setForm((s) => ({
      ...s,
      blindspot_code: code,
      capacity_code: bs?.capacities[0] ?? "",
      name: s.name || bs?.title || "",
      area: bs ? PILLAR_LABEL[bs.pillar].label : s.area,
      correction_plan: s.correction_plan || (bs ? `Capacidades estruturantes: 1) ${bs.capacities[0]} · 2) ${bs.capacities[1]}` : ""),
    }));
  };

  const active = items.filter((i) => !i.resolved);
  const maxValue = Math.max(0, ...active.map((i) => Number(i.estimated_value || 0)));
  const recommended = [...active].sort((a, b) => priorityScore(b, maxValue) - priorityScore(a, maxValue));
  const recommendedRank = new Map(recommended.map((b, i) => [b.id, i + 1]));
  const top5 = active.slice(0, 5);
  const totalImpact = top5.reduce((s, i) => s + Number(i.estimated_value || 0), 0);
  const bottleneckName = (id: string) => items.find((i) => i.id === id)?.name ?? "Gargalo";


  return (
    <div className="space-y-6">
      <PageHeader
        title="Top 5 Gargalos"
        subtitle="As travas que mais impactam o resultado — cada uma ligada a um BlindSpot do Diagnóstico SEE_4X."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-gradient-brand" disabled={!current}><Plus className="h-4 w-4 mr-1" /> Novo gargalo</Button></DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Registrar gargalo</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>BlindSpot de origem</Label>
                  <Select value={form.blindspot_code} onValueChange={pickBlindspot}>
                    <SelectTrigger><SelectValue placeholder="Selecione o BlindSpot (opcional)" /></SelectTrigger>
                    <SelectContent>
                      {BLINDSPOTS.map((bs) => (
                        <SelectItem key={bs.code} value={bs.code}>{bs.code} · {bs.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Área</Label><Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="Comercial, Operação..." /></div>
                  <div>
                    <Label>Urgência</Label>
                    <Select value={form.urgency} onValueChange={(v) => setForm({ ...form, urgency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(URGENCY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Impacto</Label><Textarea value={form.impact} onChange={(e) => setForm({ ...form, impact: e.target.value })} /></div>
                <div><Label>Valor estimado (R$)</Label><Input type="number" value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} /></div>
                {form.blindspot_code && (
                  <div>
                    <Label>Capacidade estruturante</Label>
                    <Select value={form.capacity_code} onValueChange={(v) => setForm({ ...form, capacity_code: v })}>
                      <SelectTrigger><SelectValue placeholder="Escolha a capacidade" /></SelectTrigger>
                      <SelectContent>
                        {(blindspotByCode(form.blindspot_code)?.capacities ?? []).map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div><Label>Causa raiz</Label><Textarea value={form.root_cause} onChange={(e) => setForm({ ...form, root_cause: e.target.value })} rows={2} placeholder="Por que o gargalo existe hoje?" /></div>
                <div><Label>Resultado esperado</Label><Textarea value={form.expected_result} onChange={(e) => setForm({ ...form, expected_result: e.target.value })} rows={2} placeholder="O que muda quando estiver resolvido" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Posição no Top 5</Label><Input type="number" min={1} max={5} value={form.rank_position} onChange={(e) => setForm({ ...form, rank_position: e.target.value })} placeholder="1 a 5" /></div>
                  <div><Label>Prazo</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
                </div>
                <div><Label>Plano de correção</Label><Textarea value={form.correction_plan} onChange={(e) => setForm({ ...form, correction_plan: e.target.value })} rows={3} /></div>
              </div>
              <DialogFooter><Button onClick={() => createMut.mutate()} disabled={!form.name || createMut.isPending}>Registrar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="p-6 shadow-card bg-gradient-brand text-primary-foreground">
        <p className="text-[10px] font-bold tracking-widest text-gold uppercase">Impacto financeiro total</p>
        <div className="text-5xl font-black mt-2">{formatBRL(totalImpact)}</div>
        <p className="mt-2 text-primary-foreground/70 text-sm">Travado nos {top5.length} gargalos atuais</p>
      </Card>

      {isLoading && <Card className="p-12 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Carregando gargalos...</Card>}

      <div className="space-y-4">
        {!isLoading && top5.length === 0 && (
          <Card className="p-12 text-center text-muted-foreground">
            Nenhum gargalo ativo. Gere o Top 5 a partir do Diagnóstico SEE_4X validado.
          </Card>
        )}
        {top5.map((b, i) => {
          const u = URGENCY_LABEL[b.urgency];
          const bs = b.blindspot_code ? blindspotByCode(b.blindspot_code) : null;
          return (
            <Card key={b.id} className="p-6 shadow-card hover:shadow-elegant transition-all">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                    <span className="font-black text-destructive">#{b.rank_position ?? i + 1}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-lg">{b.name}</h3>
                      <Badge className={u.color} variant="secondary">{u.label}</Badge>
                      {b.area && <Badge variant="outline">{b.area}</Badge>}
                      {bs && <Badge variant="outline" className="border-gold text-gold">{bs.code} · BlindSpot</Badge>}
                      {b.capacity_code && <Badge variant="outline">{b.capacity_code}</Badge>}
                      {b.due_date && <Badge variant="secondary">Prazo {new Date(b.due_date + "T00:00:00").toLocaleDateString("pt-BR")}</Badge>}
                      {recommendedRank.get(b.id) !== (b.rank_position ?? i + 1) && (
                        <Badge variant="outline" className="border-primary text-primary">
                          Recomendado #{recommendedRank.get(b.id)}
                        </Badge>
                      )}
                    </div>

                    {b.impact && <p className="mt-2 text-sm text-muted-foreground">{b.impact}</p>}
                    {(b.root_cause || b.expected_result) && (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {b.root_cause && (
                          <div className="p-3 rounded-lg bg-muted/30 border border-border">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Causa raiz</p>
                            <p className="text-sm whitespace-pre-wrap">{b.root_cause}</p>
                          </div>
                        )}
                        {b.expected_result && (
                          <div className="p-3 rounded-lg bg-muted/30 border border-border">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Resultado esperado</p>
                            <p className="text-sm whitespace-pre-wrap">{b.expected_result}</p>
                          </div>
                        )}
                      </div>
                    )}
                    {bs && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {bs.capacities.map((c) => (
                          <span key={c} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-muted/50 border border-border">
                            <Target className="h-3 w-3 text-primary" />{c}
                          </span>
                        ))}
                      </div>
                    )}
                    {b.correction_plan && (
                      <div className="mt-3 p-3 bg-muted/40 rounded-lg">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Plano de correção</p>
                        <p className="text-sm whitespace-pre-wrap">{b.correction_plan}</p>
                      </div>
                    )}
                    <div className="mt-3 flex items-center gap-4 text-sm">
                      <span className="text-success font-semibold">{formatBRL(b.estimated_value)}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{b.progress}% resolvido</span>
                    </div>
                  </div>
                </div>
                <div className="lg:w-72 space-y-3">
                  <Progress value={b.progress} className="h-2" />
                  <Slider value={[b.progress]} max={100} step={5} onValueChange={(v) => progressMut.mutate({ id: b.id, progress: v[0] })} />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => progressMut.mutate({ id: b.id, progress: 100 })} className="flex-1">
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Resolver
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir gargalo?")) removeMut.mutate(b.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  {isConsultor ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setRankTarget(b);
                        setNewRank(String(b.rank_position ?? recommendedRank.get(b.id) ?? i + 1));
                        setRankJustification("");
                      }}
                    >
                      <ArrowUpDown className="h-4 w-4 mr-1" /> Alterar posição
                    </Button>
                  ) : (
                    <p className="text-[11px] text-muted-foreground text-center">
                      Posição no Top 5 definida pelo Consultor 4X
                    </p>
                  )}

                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-6 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <History className="h-4 w-4 text-primary" />
          <h3 className="font-bold">Histórico do Top 5</h3>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma mudança de posição registrada até agora.</p>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center gap-2 text-sm p-3 rounded-lg bg-muted/30 border border-border">
                <span className="font-semibold">{bottleneckName(h.bottleneck_id)}</span>
                <Badge variant="outline">
                  {h.previous_position ? `#${h.previous_position}` : "sem posição"} → {h.new_position ? `#${h.new_position}` : "sem posição"}
                </Badge>
                {h.cycle && <Badge variant="secondary">{h.cycle.replace("ciclo_", "Ciclo ")}</Badge>}
                <span className="text-muted-foreground ml-auto text-xs">
                  {new Date(h.created_at).toLocaleString("pt-BR")}
                </span>
                {h.justification && <p className="w-full text-xs text-muted-foreground">{h.justification}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={!!rankTarget} onOpenChange={(v) => !v && setRankTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Alterar posição no Top 5</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{rankTarget?.name}</p>
            <div>
              <Label>Nova posição (1 a 5)</Label>
              <Input type="number" min={1} max={5} value={newRank} onChange={(e) => setNewRank(e.target.value)} />
            </div>
            <div>
              <Label>Justificativa</Label>
              <Textarea
                rows={3}
                value={rankJustification}
                onChange={(e) => setRankJustification(e.target.value)}
                placeholder="Por que este gargalo muda de prioridade neste ciclo?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => rankMut.mutate()} disabled={rankMut.isPending}>
              {rankMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Registrar mudança
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
}
