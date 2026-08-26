import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useContract } from "@/hooks/useContract";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BLINDSPOTS, blindspotByCode } from "@/lib/see4x";
import { Plus, Trash2, Loader2, ListChecks, Calendar, Target, Pencil, X } from "lucide-react";
import { format, isBefore, startOfToday } from "date-fns";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Task = Tables<"tasks">;
type ChecklistItem = { label: string; done: boolean };

const PRIORITIES = [
  { value: "baixa", label: "Baixa", className: "bg-muted text-foreground" },
  { value: "media", label: "Média", className: "bg-royal text-white" },
  { value: "alta", label: "Alta", className: "bg-gold text-primary" },
  { value: "critica", label: "Crítica", className: "bg-destructive text-white" },
];

const priorityMeta = (value?: string | null) => PRIORITIES.find((p) => p.value === value) ?? PRIORITIES[1];

const parseChecklist = (raw: unknown): ChecklistItem[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
    .map((i) => ({ label: String(i.label ?? ""), done: !!i.done }))
    .filter((i) => i.label.length > 0);
};

const EMPTY_FORM = {
  title: "",
  description: "",
  due_date: "",
  goal_id: "",
  priority: "media",
  blindspot_code: "",
  capacity_code: "",
  checklist: [] as ChecklistItem[],
};

export default function Tasks() {
  const { current } = useCompany();
  const { currentContract } = useContract();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [checklistDraft, setChecklistDraft] = useState("");
  const [editing, setEditing] = useState<Task | null>(null);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", current?.id, currentContract?.id],
    enabled: !!current,
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select("*")
        .eq("company_id", current!.id)
        .order("done")
        .order("due_date", { nullsFirst: false })
        .limit(300);
      query = currentContract ? query.eq("contract_id", currentContract.id) : query.is("contract_id", null);
      const { data, error } = await query;
      if (error) throw error;
      return data as Task[];
    },
  });

  const { data: goals = [] } = useQuery({
    queryKey: ["goals", current?.id, currentContract?.id],
    enabled: !!current,
    queryFn: async () => {
      let query = supabase
        .from("goals")
        .select("id, title, blindspot_code")
        .eq("company_id", current!.id)
        .neq("status", "concluido")
        .limit(100);
      query = currentContract ? query.eq("contract_id", currentContract.id) : query.is("contract_id", null);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const goalById = (id?: string | null) => goals.find((g) => g.id === id);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["tasks", current?.id, currentContract?.id] });

  const capacityOptions = form.blindspot_code ? blindspotByCode(form.blindspot_code)?.capacities ?? [] : [];

  const resetForm = () => { setForm(EMPTY_FORM); setChecklistDraft(""); setEditing(null); };

  const openEdit = (t: Task) => {
    setEditing(t);
    setForm({
      title: t.title,
      description: t.description ?? "",
      due_date: t.due_date ?? "",
      goal_id: t.goal_id ?? "",
      priority: t.priority ?? "media",
      blindspot_code: t.blindspot_code ?? "",
      capacity_code: t.capacity_code ?? "",
      checklist: parseChecklist(t.checklist),
    });
    setChecklistDraft("");
    setOpen(true);
  };

  const payloadFromForm = () => ({
    title: form.title,
    description: form.description || null,
    due_date: form.due_date || null,
    goal_id: form.goal_id || null,
    priority: form.priority,
    blindspot_code: form.blindspot_code || null,
    capacity_code: form.capacity_code || null,
    checklist: form.checklist as unknown as Task["checklist"],
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!current) throw new Error("Selecione uma empresa");
      if (editing) {
        // Controle de edição concorrente: só grava se ninguém alterou a tarefa nesse meio-tempo.
        const { data, error } = await supabase
          .from("tasks")
          .update(payloadFromForm())
          .eq("id", editing.id)
          .eq("updated_at", editing.updated_at)
          .select("id");
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error("Esta tarefa foi alterada por outra pessoa. Feche e abra novamente para ver a versão atual.");
        }
        return;
      }
      const { error } = await supabase.from("tasks").insert({
        company_id: current.id,
        contract_id: currentContract?.id ?? null,
        ...payloadFromForm(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editing ? "Tarefa atualizada" : "Tarefa criada");
      setOpen(false);
      resetForm();
      invalidate();
    },
    onError: (e: Error) => { toast.error(e.message); invalidate(); },
  });

  const toggleMut = useMutation({
    mutationFn: async ({ task, done }: { task: Task; done: boolean }) => {
      const { data, error } = await supabase
        .from("tasks")
        .update({ done })
        .eq("id", task.id)
        .eq("updated_at", task.updated_at)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Tarefa alterada por outra pessoa — lista atualizada.");
    },
    onSuccess: invalidate,
    onError: (e: Error) => { toast.error(e.message); invalidate(); },
  });

  const checklistMut = useMutation({
    mutationFn: async ({ task, index }: { task: Task; index: number }) => {
      const items = parseChecklist(task.checklist);
      if (!items[index]) return;
      items[index] = { ...items[index], done: !items[index].done };
      const { data, error } = await supabase
        .from("tasks")
        .update({ checklist: items as unknown as Task["checklist"] })
        .eq("id", task.id)
        .eq("updated_at", task.updated_at)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Checklist alterado por outra pessoa — lista atualizada.");
    },
    onSuccess: invalidate,
    onError: (e: Error) => { toast.error(e.message); invalidate(); },
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Tarefa removida"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  const addChecklistItem = () => {
    const label = checklistDraft.trim();
    if (!label) return;
    setForm((f) => ({ ...f, checklist: [...f.checklist, { label, done: false }] }));
    setChecklistDraft("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plano de Ação"
        subtitle="Tarefas operacionais do ciclo — prioridade, checklist e vínculo com o BlindSpot correspondente."
        action={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-brand" disabled={!current}><Plus className="h-4 w-4 mr-1" /> Nova tarefa</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? "Editar tarefa" : "Nova tarefa"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Montar script de vendas" /></div>
                <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Prazo</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
                  <div>
                    <Label>Prioridade</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
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
                <div>
                  <Label>BlindSpot</Label>
                  <Select value={form.blindspot_code} onValueChange={(v) => setForm({ ...form, blindspot_code: v, capacity_code: "" })}>
                    <SelectTrigger><SelectValue placeholder="Opcional — BlindSpot do Diagnóstico SEE_4X" /></SelectTrigger>
                    <SelectContent>
                      {BLINDSPOTS.map((b) => <SelectItem key={b.code} value={b.code}>{b.code} · {b.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {capacityOptions.length > 0 && (
                  <div>
                    <Label>Capacidade estruturante</Label>
                    <Select value={form.capacity_code} onValueChange={(v) => setForm({ ...form, capacity_code: v })}>
                      <SelectTrigger><SelectValue placeholder="Escolha a capacidade" /></SelectTrigger>
                      <SelectContent>
                        {capacityOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Checklist</Label>
                  <div className="flex gap-2">
                    <Input
                      value={checklistDraft}
                      onChange={(e) => setChecklistDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChecklistItem(); } }}
                      placeholder="Adicionar subitem e pressionar Enter"
                    />
                    <Button type="button" variant="outline" onClick={addChecklistItem}>Adicionar</Button>
                  </div>
                  {form.checklist.map((item, i) => (
                    <div key={`${item.label}-${i}`} className="flex items-center gap-2 text-sm border border-border rounded-md px-2 py-1">
                      <span className="flex-1">{item.label}</span>
                      <button type="button" onClick={() => setForm((f) => ({ ...f, checklist: f.checklist.filter((_, idx) => idx !== i) }))} aria-label="Remover subitem">
                        <X className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => saveMut.mutate()} disabled={!form.title || saveMut.isPending}>
                  {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {editing ? "Salvar alterações" : "Criar tarefa"}
                </Button>
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
              const checklist = parseChecklist(t.checklist);
              const doneItems = checklist.filter((c) => c.done).length;
              const prio = priorityMeta(t.priority);
              return (
                <Card key={t.id} className="p-4 flex items-start gap-3 shadow-card group">
                  <Checkbox checked={!!t.done} onCheckedChange={(v) => toggleMut.mutate({ task: t, done: !!v })} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-semibold text-sm ${t.done ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                      <Badge className={prio.className}>{prio.label}</Badge>
                      {t.blindspot_code && <Badge variant="outline" className="text-[10px]">{t.blindspot_code}</Badge>}
                    </div>
                    {t.description && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{t.description}</p>}
                    {t.capacity_code && <p className="text-[11px] text-muted-foreground mt-1">Capacidade: {t.capacity_code}</p>}

                    {checklist.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-2">
                          <Progress value={(doneItems / checklist.length) * 100} className="h-1.5 flex-1" />
                          <span className="text-[10px] text-muted-foreground">{doneItems}/{checklist.length}</span>
                        </div>
                        {checklist.map((item, i) => (
                          <label key={`${item.label}-${i}`} className="flex items-center gap-2 text-xs cursor-pointer">
                            <Checkbox checked={item.done} onCheckedChange={() => checklistMut.mutate({ task: t, index: i })} />
                            <span className={item.done ? "line-through text-muted-foreground" : ""}>{item.label}</span>
                          </label>
                        ))}
                      </div>
                    )}

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
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(t)} aria-label="Editar tarefa">
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button onClick={() => { if (confirm("Excluir tarefa?")) removeMut.mutate(t.id); }} aria-label="Excluir tarefa">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : null
      )}
    </div>
  );
}
