import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CalendarClock, Check, MessageCircle, Mail, Phone, RotateCcw } from "lucide-react";

const db = supabase as any;

type Opportunity = {
  id: string;
  contact_id: string;
  title: string;
  product: string | null;
  value: number;
  stage: string;
  next_action: string | null;
  next_action_at: string | null;
  crm_contacts: { id: string; name: string; company_name: string | null; phone: string | null; email: string | null } | null;
};

type Activity = {
  id: string;
  contact_id: string;
  opportunity_id: string | null;
  activity_type: string;
  title: string;
  notes: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
};

const TYPES = [
  ["whatsapp", "WhatsApp"],
  ["call", "Ligação"],
  ["email", "E-mail"],
  ["meeting", "Reunião"],
  ["task", "Tarefa"],
  ["note", "Nota"],
] as const;

const typeIcon = (type: string) => {
  if (type === "whatsapp") return <MessageCircle className="h-4 w-4" />;
  if (type === "call") return <Phone className="h-4 w-4" />;
  if (type === "email") return <Mail className="h-4 w-4" />;
  return <CalendarClock className="h-4 w-4" />;
};

export function CRMFollowup({ mode = "followup" }: { mode?: "followup" | "recovery" }) {
  const { user } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: "whatsapp", title: "", notes: "", due_at: "" });

  const load = async () => {
    const [{ data: opps, error: oppError }, { data: acts, error: actError }] = await Promise.all([
      db.from("crm_opportunities").select("*, crm_contacts(id,name,company_name,phone,email)").order("next_action_at", { ascending: true, nullsFirst: false }),
      db.from("crm_activities").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    if (oppError || actError) {
      console.error(oppError || actError);
      toast.error("Não foi possível carregar os acompanhamentos.");
      return;
    }
    setOpportunities((opps || []) as Opportunity[]);
    setActivities((acts || []) as Activity[]);
  };

  useEffect(() => { load(); }, []);

  const now = Date.now();
  const followups = useMemo(() => opportunities.filter((o) => !["ganho", "perdido"].includes(o.stage)), [opportunities]);
  const recovery = useMemo(() => opportunities.filter((o) => ["perdido", "recuperacao"].includes(o.stage)), [opportunities]);
  const list = mode === "recovery" ? recovery : followups;

  const overdue = (o: Opportunity) => !!o.next_action_at && new Date(o.next_action_at).getTime() < now;
  const noAction = (o: Opportunity) => !o.next_action_at;

  const openActivity = (o: Opportunity) => {
    setSelected(o);
    setForm({
      type: mode === "recovery" ? "whatsapp" : "whatsapp",
      title: mode === "recovery" ? "Tentativa de recuperação" : (o.next_action || "Follow-up"),
      notes: "",
      due_at: "",
    });
  };

  const saveActivity = async () => {
    if (!selected || !form.title.trim()) return;
    setSaving(true);
    const dueIso = form.due_at ? new Date(form.due_at).toISOString() : null;
    const { error: activityError } = await db.from("crm_activities").insert({
      contact_id: selected.contact_id,
      opportunity_id: selected.id,
      activity_type: form.type,
      title: form.title.trim(),
      notes: form.notes.trim() || null,
      due_at: dueIso,
      created_by: user?.id || null,
    });

    if (activityError) {
      setSaving(false);
      toast.error("Não foi possível registrar a atividade.");
      return;
    }

    if (dueIso) {
      await db.from("crm_opportunities").update({ next_action: form.title.trim(), next_action_at: dueIso }).eq("id", selected.id);
    }

    setSelected(null);
    setSaving(false);
    toast.success("Atividade registrada.");
    load();
  };

  const completeActivity = async (activity: Activity) => {
    const { error } = await db.from("crm_activities").update({ completed_at: new Date().toISOString() }).eq("id", activity.id);
    if (error) return toast.error("Não foi possível concluir a atividade.");
    toast.success("Atividade concluída.");
    load();
  };

  const sendToRecovery = async (o: Opportunity) => {
    const { error } = await db.from("crm_opportunities").update({ stage: "recuperacao", recovered_at: null }).eq("id", o.id);
    if (error) return toast.error("Não foi possível mover para recuperação.");
    toast.success("Lead movido para recuperação.");
    load();
  };

  const revive = async (o: Opportunity) => {
    const { error } = await db.from("crm_opportunities").update({ stage: "qualificado", recovered_at: new Date().toISOString() }).eq("id", o.id);
    if (error) return toast.error("Não foi possível reativar o lead.");
    toast.success("Lead recuperado e voltou ao funil.");
    load();
  };

  const pendingActivities = activities.filter((a) => !a.completed_at);

  return (
    <div className="space-y-4">
      {mode === "followup" && (
        <div className="grid gap-3 md:grid-cols-3">
          <Card><CardContent className="p-4"><div className="text-2xl font-bold">{followups.filter(overdue).length}</div><div className="text-xs text-muted-foreground">follow-ups atrasados</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-2xl font-bold">{followups.filter(noAction).length}</div><div className="text-xs text-muted-foreground">oportunidades sem próxima ação</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-2xl font-bold">{pendingActivities.length}</div><div className="text-xs text-muted-foreground">atividades pendentes</div></CardContent></Card>
        </div>
      )}

      <div className="space-y-3">
        {list.map((o) => (
          <Card key={o.id} className={overdue(o) ? "border-destructive/50" : ""}>
            <CardContent className="p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{o.crm_contacts?.name || o.title}</span>
                  <Badge variant="outline">{o.product || "Sem produto"}</Badge>
                  {overdue(o) && <Badge variant="destructive">Atrasado</Badge>}
                  {noAction(o) && mode === "followup" && <Badge variant="secondary">Sem próxima ação</Badge>}
                </div>
                <div className="text-sm text-muted-foreground">{o.crm_contacts?.company_name || "Sem empresa"}</div>
                {o.next_action_at && <div className="text-xs mt-1">Próxima ação: {o.next_action || "Follow-up"} · {new Date(o.next_action_at).toLocaleString("pt-BR")}</div>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openActivity(o)}>{mode === "recovery" ? "Registrar tentativa" : "Novo follow-up"}</Button>
                {mode === "followup" && <Button size="sm" variant="ghost" onClick={() => sendToRecovery(o)}><RotateCcw className="mr-2 h-4 w-4" />Recuperação</Button>}
                {mode === "recovery" && <Button size="sm" onClick={() => revive(o)}><Check className="mr-2 h-4 w-4" />Recuperado</Button>}
              </div>
            </CardContent>
          </Card>
        ))}
        {list.length === 0 && <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum item nesta fila.</div>}
      </div>

      {mode === "followup" && pendingActivities.length > 0 && (
        <div className="space-y-2 pt-2">
          <h3 className="font-semibold">Atividades pendentes</h3>
          {pendingActivities.slice(0, 20).map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="flex items-start gap-3">{typeIcon(a.activity_type)}<div><div className="text-sm font-medium">{a.title}</div><div className="text-xs text-muted-foreground">{a.due_at ? new Date(a.due_at).toLocaleString("pt-BR") : "Sem prazo"}</div></div></div>
              <Button size="sm" variant="ghost" onClick={() => completeActivity(a)}><Check className="mr-2 h-4 w-4" />Concluir</Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{mode === "recovery" ? "Registrar tentativa de recuperação" : "Registrar follow-up"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Canal</Label><Select value={form.type} onValueChange={(type) => setForm({ ...form, type })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Ação</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-2"><Label>Próxima data</Label><Input type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} /></div>
            <div className="space-y-2"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSelected(null)}>Cancelar</Button><Button onClick={saveActivity} disabled={saving}>{saving ? "Salvando..." : "Registrar"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
