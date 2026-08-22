import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
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
import { Plus, CheckCircle2, Trash2, Loader2, Target } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Bottleneck = Tables<"bottlenecks">;

const EMPTY = { name: "", area: "", impact: "", urgency: "media", estimated_value: "0", correction_plan: "", blindspot_code: "" };

export default function Bottlenecks() {
  const { current } = useCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["bottlenecks", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bottlenecks")
        .select("*")
        .eq("company_id", current!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Bottleneck[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["bottlenecks", current?.id] });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!current) throw new Error("Selecione uma empresa");
      const { error } = await supabase.from("bottlenecks").insert({
        company_id: current.id,
        name: form.name,
        area: form.area || null,
        impact: form.impact || null,
        urgency: form.urgency as Bottleneck["urgency"],
        estimated_value: Number(form.estimated_value) || 0,
        correction_plan: form.correction_plan || null,
        blindspot_code: form.blindspot_code || null,
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

  const pickBlindspot = (code: string) => {
    const bs = blindspotByCode(code);
    setForm((s) => ({
      ...s,
      blindspot_code: code,
      name: s.name || bs?.title || "",
      area: bs ? PILLAR_LABEL[bs.pillar].label : s.area,
      correction_plan: s.correction_plan || (bs ? `Capacidades estruturantes: 1) ${bs.capacities[0]} · 2) ${bs.capacities[1]}` : ""),
    }));
  };

  const top5 = items.filter((i) => !i.resolved).slice(0, 5);
  const totalImpact = top5.reduce((s, i) => s + Number(i.estimated_value || 0), 0);

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
                    <span className="font-black text-destructive">#{i + 1}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-lg">{b.name}</h3>
                      <Badge className={u.color} variant="secondary">{u.label}</Badge>
                      {b.area && <Badge variant="outline">{b.area}</Badge>}
                      {bs && <Badge variant="outline" className="border-gold text-gold">{bs.code} · BlindSpot</Badge>}
                    </div>
                    {b.impact && <p className="mt-2 text-sm text-muted-foreground">{b.impact}</p>}
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
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
