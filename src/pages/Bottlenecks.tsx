import { useEffect, useState } from "react";
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
import { URGENCY_LABEL, formatBRL } from "@/lib/labels";
import { AlertTriangle, Plus, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Bottlenecks() {
  const { current } = useCompany();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", area: "", impact: "", urgency: "media", estimated_value: "0", correction_plan: "" });

  const load = async () => {
    if (!current) return;
    const { data } = await supabase.from("bottlenecks").select("*").eq("company_id", current.id).order("created_at", { ascending: false });
    setItems(data || []);
  };
  useEffect(() => { load(); }, [current]);

  const create = async () => {
    if (!current) return;
    const { error } = await supabase.from("bottlenecks").insert({
      company_id: current.id, ...form, urgency: form.urgency as any,
      estimated_value: Number(form.estimated_value) || 0,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Gargalo registrado");
    setOpen(false);
    setForm({ name: "", area: "", impact: "", urgency: "media", estimated_value: "0", correction_plan: "" });
    load();
  };

  const updateProgress = async (id: string, progress: number) => {
    await supabase.from("bottlenecks").update({ progress, resolved: progress >= 100 }).eq("id", id);
    load();
  };
  const remove = async (id: string) => { await supabase.from("bottlenecks").delete().eq("id", id); load(); };

  const top5 = items.filter(i => !i.resolved).slice(0, 5);
  const totalImpact = top5.reduce((s, i) => s + Number(i.estimated_value || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Top 5 Gargalos"
        subtitle="As travas que mais impactam o resultado da empresa neste momento."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-gradient-brand"><Plus className="h-4 w-4 mr-1" /> Novo gargalo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar gargalo</DialogTitle></DialogHeader>
              <div className="space-y-3">
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
                <div><Label>Plano de correção</Label><Textarea value={form.correction_plan} onChange={(e) => setForm({ ...form, correction_plan: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={create} disabled={!form.name}>Registrar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="p-6 shadow-card bg-gradient-brand text-primary-foreground">
        <p className="text-[10px] font-bold tracking-widest text-gold uppercase">Impacto financeiro total</p>
        <div className="text-5xl font-black mt-2">{formatBRL(totalImpact)}</div>
        <p className="mt-2 text-primary-foreground/70 text-sm">Travado nos {top5.length} gargalos atuais</p>
      </Card>

      <div className="space-y-4">
        {top5.length === 0 && <Card className="p-12 text-center text-muted-foreground">Nenhum gargalo ativo. 🎉</Card>}
        {top5.map((b, i) => {
          const u = URGENCY_LABEL[b.urgency];
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
                    </div>
                    {b.impact && <p className="mt-2 text-sm text-muted-foreground">{b.impact}</p>}
                    {b.correction_plan && (
                      <div className="mt-3 p-3 bg-muted/40 rounded-lg">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Plano de correção</p>
                        <p className="text-sm">{b.correction_plan}</p>
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
                  <Slider value={[b.progress]} max={100} step={5} onValueChange={(v) => updateProgress(b.id, v[0])} />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => updateProgress(b.id, 100)} className="flex-1">
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Resolver
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
