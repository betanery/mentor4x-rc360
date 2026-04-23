import { useEffect, useState } from "react";
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
import { Plus, Calendar, DollarSign, User, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const STATUSES = ["nao_iniciado", "em_andamento", "concluido", "atrasado", "bloqueado"] as const;

export default function Goals() {
  const { current } = useCompany();
  const { user } = useAuth();
  const [goals, setGoals] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", pillar: "crescimento", indicator: "", financial_impact: "0", due_date: "", week_start: format(new Date(), "yyyy-MM-dd") });

  const load = async () => {
    if (!current) return;
    const { data } = await supabase.from("goals").select("*").eq("company_id", current.id).order("created_at", { ascending: false });
    setGoals(data || []);
  };
  useEffect(() => { load(); }, [current]);

  const create = async () => {
    if (!current || !user) return;
    const { error } = await supabase.from("goals").insert({
      company_id: current.id,
      title: form.title,
      description: form.description,
      pillar: form.pillar as any,
      indicator: form.indicator,
      financial_impact: Number(form.financial_impact) || 0,
      due_date: form.due_date || null,
      week_start: form.week_start,
      created_by: user.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Meta criada!");
    setOpen(false);
    setForm({ title: "", description: "", pillar: "crescimento", indicator: "", financial_impact: "0", due_date: "", week_start: format(new Date(), "yyyy-MM-dd") });
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("goals").update({ status }).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir meta?")) return;
    await supabase.from("goals").delete().eq("id", id);
    load();
  };

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
              <DialogFooter><Button onClick={create} disabled={!form.title}>Criar meta</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

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
                  const p = PILLAR_LABEL[g.pillar];
                  return (
                    <Card key={g.id} className="p-3 shadow-card hover:shadow-elegant transition-all cursor-pointer group">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm line-clamp-2 flex-1">{g.title}</p>
                        <button onClick={() => remove(g.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      </div>
                      {p && <span className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded bg-gradient-to-r ${p.color} text-white`}>{p.label}</span>}
                      {g.financial_impact > 0 && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-success font-semibold">
                          <DollarSign className="h-3 w-3" />{formatBRL(g.financial_impact)}
                        </div>
                      )}
                      {g.due_date && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Calendar className="h-3 w-3" />{format(new Date(g.due_date), "dd/MM/yyyy")}
                        </div>
                      )}
                      <Select value={g.status} onValueChange={(v) => updateStatus(g.id, v)}>
                        <SelectTrigger className="h-7 mt-2 text-[11px]"><SelectValue /></SelectTrigger>
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
    </div>
  );
}
