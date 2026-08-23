import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2, ListChecks, Calendar, Target } from "lucide-react";
import { format, isBefore, startOfToday } from "date-fns";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Task = Tables<"tasks">;

export default function Tasks() {
  const { current } = useCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", due_date: "", goal_id: "" });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("company_id", current!.id)
        .order("done")
        .order("due_date", { nullsFirst: false })
        .limit(300);
      if (error) throw error;
      return data as Task[];
    },
  });

  const { data: goals = [] } = useQuery({
    queryKey: ["goals", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("id, title, blindspot_code")
        .eq("company_id", current!.id)
        .neq("status", "concluido")
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const goalById = (id?: string | null) => goals.find((g) => g.id === id);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tasks", current?.id] });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!current) throw new Error("Selecione uma empresa");
      const { error } = await supabase.from("tasks").insert({
        company_id: current.id,
        title: form.title,
        description: form.description || null,
        due_date: form.due_date || null,
        goal_id: form.goal_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarefa criada");
      setOpen(false);
      setForm({ title: "", description: "", due_date: "", goal_id: "" });
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from("tasks").update({ done }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Tarefa removida"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plano de Ação"
        subtitle="Tarefas operacionais do ciclo — o que precisa sair do papel agora."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-brand" disabled={!current}><Plus className="h-4 w-4 mr-1" /> Nova tarefa</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Nova tarefa</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Montar script de vendas" /></div>
                <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
                <div><Label>Prazo</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
                <div>
                  <Label>Meta vinculada</Label>
                  <Select value={form.goal_id} onValueChange={(v) => setForm({ ...form, goal_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Opcional — meta do ciclo" /></SelectTrigger>
                    <SelectContent>
                      {goals.length === 0 && <SelectItem value="sem-meta" disabled>Nenhuma meta em aberto</SelectItem>}
                      {goals.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => createMut.mutate()} disabled={!form.title || createMut.isPending}>Criar tarefa</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {!current && <Card className="p-12 text-center text-muted-foreground">Selecione uma empresa para ver o plano de ação.</Card>}
      {current && isLoading && <Card className="p-12 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Carregando tarefas...</Card>}
      {current && !isLoading && tasks.length === 0 && (
        <Card className="p-12 text-center text-muted-foreground">
          <ListChecks className="h-10 w-10 mx-auto mb-3 opacity-40" />
          Nenhuma tarefa ainda. Crie a primeira ação da semana.
        </Card>
      )}

      {[{ label: "Em aberto", items: pending }, { label: "Concluídas", items: done }].map((group) =>
        group.items.length > 0 ? (
          <div key={group.label} className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{group.label}</h3>
              <Badge variant="secondary">{group.items.length}</Badge>
            </div>
            {group.items.map((t) => {
              const late = !t.done && t.due_date && isBefore(new Date(t.due_date), startOfToday());
              return (
                <Card key={t.id} className="p-4 flex items-start gap-3 shadow-card group">
                  <Checkbox checked={!!t.done} onCheckedChange={(v) => toggleMut.mutate({ id: t.id, done: !!v })} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${t.done ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                    {t.description && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{t.description}</p>}
                    {t.goal_id && goalById(t.goal_id) && (
                      <div className="mt-2 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-muted/60 border border-border">
                        <Target className="h-3 w-3 text-primary" />
                        {goalById(t.goal_id)?.title}
                        {goalById(t.goal_id)?.blindspot_code && (
                          <span className="font-bold text-gold">· {goalById(t.goal_id)?.blindspot_code}</span>
                        )}
                      </div>
                    )}
                    {t.due_date && (
                      <div className={`mt-2 flex items-center gap-1 text-[11px] ${late ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                        <Calendar className="h-3 w-3" /> {format(new Date(t.due_date), "dd/MM/yyyy")}{late ? " · atrasada" : ""}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => { if (confirm("Excluir tarefa?")) removeMut.mutate(t.id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Excluir tarefa"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </Card>
              );
            })}
          </div>
        ) : null
      )}
    </div>
  );
}
