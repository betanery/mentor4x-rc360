import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CYCLE_LABEL, MEETING_TYPE_LABEL } from "@/lib/labels";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type TemplateItem = Tables<"product_version_onboarding_items">;
type Course = Pick<Tables<"courses">, "id" | "title">;

const ITEM_TYPES = ["etapa", "encontro", "entregavel", "conteudo"] as const;
type ItemType = typeof ITEM_TYPES[number];

export const ITEM_TYPE_LABEL: Record<ItemType, string> = {
  etapa: "Etapa",
  encontro: "Encontro",
  entregavel: "Entregável",
  conteudo: "Liberação de conteúdo",
};

const MEETING_TYPES = ["kickoff", "sala_guerra", "estrategia", "review", "checkin_semanal", "mentoria"] as const;
const STAGES = ["ciclo_1", "ciclo_2", "ciclo_3", "ciclo_4", "ciclo_5", "ciclo_6", "concluido"] as const;

const emptyForm = {
  item_type: "etapa" as ItemType,
  stage: "ciclo_1" as string,
  title: "",
  description: "",
  order_index: 0,
  offset_days: 0,
  duration_min: 60,
  meeting_type: "kickoff" as string,
  course_id: "",
};

export function OnboardingTemplateDialog({
  versionId,
  versionLabel,
  open,
  onOpenChange,
}: {
  versionId: string | null;
  versionLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    if (!versionId) return;
    setLoading(true);
    const [itemsRes, coursesRes] = await Promise.all([
      supabase.from("product_version_onboarding_items").select("*").eq("product_version_id", versionId).order("order_index").order("created_at"),
      supabase.from("courses").select("id, title").order("order_index"),
    ]);
    setLoading(false);
    if (itemsRes.error) { toast.error(itemsRes.error.message); return; }
    setItems((itemsRes.data || []) as TemplateItem[]);
    setCourses((coursesRes.data || []) as Course[]);
  };

  useEffect(() => { if (open && versionId) { void load(); setForm({ ...emptyForm }); } }, [open, versionId]);

  const addItem = async () => {
    if (!versionId) return;
    if (form.title.trim().length < 3) { toast.error("Informe um título com pelo menos 3 caracteres."); return; }
    const payload: TablesInsert<"product_version_onboarding_items"> = {
      product_version_id: versionId,
      item_type: form.item_type,
      stage: form.stage || null,
      title: form.title.trim(),
      description: form.description.trim() || null,
      order_index: Number(form.order_index) || items.length + 1,
      offset_days: Number(form.offset_days) || 0,
      duration_min: form.item_type === "encontro" ? Number(form.duration_min) || 60 : null,
      meeting_type: form.item_type === "encontro" ? (form.meeting_type as TemplateItem["meeting_type"]) : null,
      course_id: form.item_type === "conteudo" && form.course_id ? form.course_id : null,
    };
    setSaving(true);
    const { error } = await supabase.from("product_version_onboarding_items").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Item do modelo adicionado");
    setForm({ ...emptyForm, item_type: form.item_type, stage: form.stage });
    await load();
  };

  const removeItem = async (id: string) => {
    const { error } = await supabase.from("product_version_onboarding_items").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modelo de onboarding · {versionLabel}</DialogTitle>
          <DialogDescription>
            Defina as etapas, encontros, entregáveis e liberações de conteúdo. Ao gerar o onboarding de uma contratação, cada item recebe data prevista a partir do início da contratação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {loading && <p className="text-sm text-muted-foreground"><Loader2 className="h-4 w-4 inline animate-spin mr-2" /> Carregando modelo...</p>}
          {!loading && items.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item no modelo desta versão.</p>}
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
              <Badge variant="outline">{ITEM_TYPE_LABEL[item.item_type as ItemType]}</Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  D+{item.offset_days}
                  {item.stage ? ` · ${CYCLE_LABEL[item.stage]?.label ?? item.stage}` : ""}
                  {item.meeting_type ? ` · ${MEETING_TYPE_LABEL[item.meeting_type] ?? item.meeting_type}` : ""}
                  {item.course_id ? ` · curso: ${courses.find((c) => c.id === item.course_id)?.title ?? "vinculado"}` : ""}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => removeItem(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-border p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Novo item</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.item_type} onValueChange={(v) => setForm({ ...form, item_type: v as ItemType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ITEM_TYPES.map((t) => <SelectItem key={t} value={t}>{ITEM_TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ciclo</Label>
              <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{CYCLE_LABEL[s]?.label ?? s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2"><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Reunião de kickoff da contratação" /></div>
            <div className="sm:col-span-2"><Label>Descrição</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Dias após o início (D+)</Label><Input type="number" min={0} value={form.offset_days} onChange={(e) => setForm({ ...form, offset_days: Number(e.target.value) })} /></div>
            <div><Label>Ordem</Label><Input type="number" min={0} value={form.order_index} onChange={(e) => setForm({ ...form, order_index: Number(e.target.value) })} /></div>
            {form.item_type === "encontro" && (
              <>
                <div>
                  <Label>Tipo de encontro</Label>
                  <Select value={form.meeting_type} onValueChange={(v) => setForm({ ...form, meeting_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{MEETING_TYPES.map((t) => <SelectItem key={t} value={t}>{MEETING_TYPE_LABEL[t] ?? t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Duração (min)</Label><Input type="number" min={15} value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: Number(e.target.value) })} /></div>
              </>
            )}
            {form.item_type === "conteudo" && (
              <div className="sm:col-span-2">
                <Label>Curso liberado</Label>
                <Select value={form.course_id} onValueChange={(v) => setForm({ ...form, course_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o curso" /></SelectTrigger>
                  <SelectContent>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          <Button className="bg-gradient-brand" onClick={addItem} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />} Adicionar ao modelo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
