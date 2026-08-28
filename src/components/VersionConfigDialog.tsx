import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Lock, Loader2, Plus, Trash2 } from "lucide-react";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type ProductVersion = Tables<"product_versions">;
type Config = Tables<"product_version_config">;
type VMeeting = Tables<"product_version_meetings">;
type VStage = Tables<"product_version_stages">;
type VDeliverable = Tables<"product_version_deliverables">;

const MEETING_TYPES = ["kickoff", "sala_guerra", "mentoria", "estrategia", "review", "checkin_semanal"] as const;
const MEETING_LABEL: Record<string, string> = {
  kickoff: "Kickoff",
  sala_guerra: "Sala de Guerra",
  mentoria: "Encontro de orientação",
  estrategia: "Encontro estratégico",
  review: "Review",
  checkin_semanal: "Check-in semanal",
};
const DURATION_UNITS = ["dias", "semanas", "meses"] as const;
const VISIBILITY = [
  { value: "interno", label: "Somente interno" },
  { value: "catalogo", label: "Catálogo comercial" },
  { value: "publico", label: "Público" },
] as const;
const RECOMMENDATION = [
  { value: "manual", label: "Indicação manual do Consultor" },
  { value: "diagnostico", label: "Automática pelo diagnóstico" },
  { value: "nenhuma", label: "Não recomendar" },
] as const;

const SERVICE_TYPES = ["individual", "grupo", "híbrido"] as const;
const MODALITIES = ["online", "presencial", "híbrido"] as const;
const LADDER_LEVELS = ["entrada", "intermediário", "avançado"] as const;
const GOAL_FIELDS = [
  { key: "title", label: "Título / tarefa" },
  { key: "description", label: "Descrição" },
  { key: "current_situation", label: "Situação atual" },
  { key: "responsible_user_id", label: "Responsável" },
  { key: "due_date", label: "Prazo" },
  { key: "indicator", label: "Indicador" },
  { key: "expected_result", label: "Resultado esperado" },
  { key: "evidence_url", label: "Evidência" },
  { key: "notes", label: "Observação" },
  { key: "pillar", label: "Pilar" },
  { key: "blindspot_code", label: "BlindSpot" },
  { key: "capacity_code", label: "Capacidade Estruturante" },
] as const;

const emptyConfig = {
  price_cents: "",
  currency: "BRL",
  format: "",
  audience: "",
  duration_amount: "",
  duration_unit: "meses",
  access_days: "",
  support_model: "",
  community_included: false,
  bonuses: "",
  ai_enabled: true,
  catalog_visibility: "interno",
  sales_url: "",
  checkout_url: "",
  recommendation_mode: "manual",
  notes: "",
  promise: "",
  ladder_level: "",
  service_type: "",
  modality: "",
  diagnostic_required: false,
  max_critical_goals: "",
  action_plan_days: "",
  completion_rules: [] as string[],
  goal_required_fields: [] as string[],
};


interface Props {
  version: ProductVersion | null;
  onOpenChange: (open: boolean) => void;
}

export function VersionConfigDialog({ version, onOpenChange }: Props) {
  const published = !!version?.published_at;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyConfig);
  const [configId, setConfigId] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<VMeeting[]>([]);
  const [stages, setStages] = useState<VStage[]>([]);
  const [deliverables, setDeliverables] = useState<VDeliverable[]>([]);

  const load = async (versionId: string) => {
    setLoading(true);
    const [cfg, mts, sts, dls] = await Promise.all([
      supabase.from("product_version_config").select("*").eq("product_version_id", versionId).maybeSingle(),
      supabase.from("product_version_meetings").select("*").eq("product_version_id", versionId).order("order_index"),
      supabase.from("product_version_stages").select("*").eq("product_version_id", versionId).order("order_index"),
      supabase.from("product_version_deliverables").select("*").eq("product_version_id", versionId).order("order_index"),
    ]);
    const err = cfg.error || mts.error || sts.error || dls.error;
    if (err) toast.error(err.message);
    const c = cfg.data as Config | null;
    setConfigId(c?.id ?? null);
    setForm(
      c
        ? {
            price_cents: c.price_cents === null ? "" : String(c.price_cents / 100),
            currency: c.currency,
            format: c.format ?? "",
            audience: c.audience ?? "",
            duration_amount: c.duration_amount === null ? "" : String(c.duration_amount),
            duration_unit: c.duration_unit,
            access_days: c.access_days === null ? "" : String(c.access_days),
            support_model: c.support_model ?? "",
            community_included: c.community_included,
            bonuses: c.bonuses ?? "",
            ai_enabled: c.ai_enabled,
            catalog_visibility: c.catalog_visibility,
            sales_url: c.sales_url ?? "",
            checkout_url: c.checkout_url ?? "",
            recommendation_mode: c.recommendation_mode,
            notes: c.notes ?? "",
            promise: c.promise ?? "",
            ladder_level: c.ladder_level ?? "",
            service_type: c.service_type ?? "",
            modality: c.modality ?? "",
            diagnostic_required: c.diagnostic_required,
            max_critical_goals: c.max_critical_goals === null ? "" : String(c.max_critical_goals),
            action_plan_days: c.action_plan_days === null ? "" : String(c.action_plan_days),
            completion_rules: Array.isArray(c.completion_rules) ? (c.completion_rules as string[]) : [],
            goal_required_fields: Array.isArray(c.goal_required_fields) ? (c.goal_required_fields as string[]) : [],

          }
        : emptyConfig,
    );
    setMeetings((mts.data as VMeeting[]) ?? []);
    setStages((sts.data as VStage[]) ?? []);
    setDeliverables((dls.data as VDeliverable[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (version) void load(version.id);
  }, [version?.id]);

  if (!version) return null;

  const saveConfig = async () => {
    setSaving(true);
    const payload = {
      product_version_id: version.id,
      price_cents: form.price_cents === "" ? null : Math.round(Number(form.price_cents) * 100),
      currency: form.currency || "BRL",
      format: form.format || null,
      audience: form.audience || null,
      duration_amount: form.duration_amount === "" ? null : Number(form.duration_amount),
      duration_unit: form.duration_unit,
      access_days: form.access_days === "" ? null : Number(form.access_days),
      support_model: form.support_model || null,
      community_included: form.community_included,
      bonuses: form.bonuses || null,
      ai_enabled: form.ai_enabled,
      catalog_visibility: form.catalog_visibility,
      sales_url: form.sales_url || null,
      checkout_url: form.checkout_url || null,
      recommendation_mode: form.recommendation_mode,
      notes: form.notes || null,
      promise: form.promise || null,
      ladder_level: form.ladder_level || null,
      service_type: form.service_type || null,
      modality: form.modality || null,
      diagnostic_required: form.diagnostic_required,
      max_critical_goals: form.max_critical_goals === "" ? null : Number(form.max_critical_goals),
      action_plan_days: form.action_plan_days === "" ? null : Number(form.action_plan_days),
      completion_rules: form.completion_rules,
      goal_required_fields: form.goal_required_fields,

    };
    const { error } = configId
      ? await supabase.from("product_version_config").update(payload).eq("id", configId)
      : await supabase.from("product_version_config").insert(payload as TablesInsert<"product_version_config">);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Configuração da versão salva");
    await load(version.id);
  };

  const addMeeting = async () => {
    const { error } = await supabase.from("product_version_meetings").insert({
      product_version_id: version.id,
      meeting_type: "mentoria",
      title: "Novo encontro",
      quantity: 1,
      duration_min: 60,
      order_index: meetings.length,
    });
    if (error) { toast.error(error.message); return; }
    await load(version.id);
  };

  const updateMeeting = async (id: string, patch: Partial<VMeeting>) => {
    const { error } = await supabase.from("product_version_meetings").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setMeetings((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const addStage = async () => {
    const { error } = await supabase.from("product_version_stages").insert({
      product_version_id: version.id,
      title: "Nova etapa",
      order_index: stages.length,
    });
    if (error) { toast.error(error.message); return; }
    await load(version.id);
  };

  const updateStage = async (id: string, patch: Partial<VStage>) => {
    const { error } = await supabase.from("product_version_stages").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const addDeliverable = async () => {
    const { error } = await supabase.from("product_version_deliverables").insert({
      product_version_id: version.id,
      title: "Novo entregável",
      order_index: deliverables.length,
    });
    if (error) { toast.error(error.message); return; }
    await load(version.id);
  };

  const updateDeliverable = async (id: string, patch: Partial<VDeliverable>) => {
    const { error } = await supabase.from("product_version_deliverables").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setDeliverables((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const removeRow = async (table: "product_version_meetings" | "product_version_stages" | "product_version_deliverables", id: string) => {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await load(version.id);
  };

  return (
    <Dialog open={!!version} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configuração da versão · {version.version_label}</DialogTitle>
          <DialogDescription>
            Defina condições comerciais, encontros, etapas e entregáveis desta versão sem escrever código.
          </DialogDescription>
        </DialogHeader>

        {published && (
          <Card className="p-3 flex items-start gap-2 border-warning/40 bg-warning/10">
            <Lock className="h-4 w-4 text-warning mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Esta versão está publicada e é imutável — contratações existentes dependem dela. Para alterar, duplique a versão,
              edite a cópia e publique novamente.
            </p>
          </Card>
        )}

        {loading ? (
          <div className="p-10 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Carregando configuração...</div>
        ) : (
          <Tabs defaultValue="comercial" className="space-y-4">
            <TabsList>
              <TabsTrigger value="comercial">Comercial</TabsTrigger>
              <TabsTrigger value="encontros">Encontros ({meetings.length})</TabsTrigger>
              <TabsTrigger value="etapas">Etapas ({stages.length})</TabsTrigger>
              <TabsTrigger value="entregaveis">Entregáveis ({deliverables.length})</TabsTrigger>
              <TabsTrigger value="regras">Regras</TabsTrigger>

            </TabsList>

            <TabsContent value="comercial" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div><Label>Preço</Label><Input type="number" step="0.01" value={form.price_cents} onChange={(e) => setForm({ ...form, price_cents: e.target.value })} disabled={published} /></div>
                <div><Label>Moeda</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} disabled={published} /></div>
                <div><Label>Formato</Label><Input placeholder="Presencial, online, híbrido" value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} disabled={published} /></div>
                <div><Label>Duração</Label><Input type="number" value={form.duration_amount} onChange={(e) => setForm({ ...form, duration_amount: e.target.value })} disabled={published} /></div>
                <div>
                  <Label>Unidade</Label>
                  <Select value={form.duration_unit} onValueChange={(v) => setForm({ ...form, duration_unit: v })} disabled={published}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DURATION_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Dias de acesso</Label><Input type="number" value={form.access_days} onChange={(e) => setForm({ ...form, access_days: e.target.value })} disabled={published} /></div>
                <div className="md:col-span-2"><Label>Público-alvo</Label><Input value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} disabled={published} /></div>
                <div><Label>Modelo de suporte</Label><Input value={form.support_model} onChange={(e) => setForm({ ...form, support_model: e.target.value })} disabled={published} /></div>
                <div>
                  <Label>Visibilidade</Label>
                  <Select value={form.catalog_visibility} onValueChange={(v) => setForm({ ...form, catalog_visibility: v })} disabled={published}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{VISIBILITY.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label>Modo de recomendação</Label>
                  <Select value={form.recommendation_mode} onValueChange={(v) => setForm({ ...form, recommendation_mode: v })} disabled={published}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{RECOMMENDATION.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Link de venda</Label><Input value={form.sales_url} onChange={(e) => setForm({ ...form, sales_url: e.target.value })} disabled={published} /></div>
                <div><Label>Link de checkout</Label><Input value={form.checkout_url} onChange={(e) => setForm({ ...form, checkout_url: e.target.value })} disabled={published} /></div>
                <div>
                  <Label>Nível da esteira</Label>
                  <Select value={form.ladder_level || "none"} onValueChange={(v) => setForm({ ...form, ladder_level: v === "none" ? "" : v })} disabled={published}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Não definido</SelectItem>{LADDER_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de serviço</Label>
                  <Select value={form.service_type || "none"} onValueChange={(v) => setForm({ ...form, service_type: v === "none" ? "" : v })} disabled={published}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Não definido</SelectItem>{SERVICE_TYPES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Modalidade</Label>
                  <Select value={form.modality || "none"} onValueChange={(v) => setForm({ ...form, modality: v === "none" ? "" : v })} disabled={published}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Não definido</SelectItem>{MODALITIES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Promessa</Label><Textarea rows={2} value={form.promise} onChange={(e) => setForm({ ...form, promise: e.target.value })} disabled={published} /></div>
              <div className="flex flex-wrap gap-6">

                <div className="flex items-center gap-2"><Switch checked={form.community_included} onCheckedChange={(v) => setForm({ ...form, community_included: v })} disabled={published} /><Label>Comunidade incluída</Label></div>
                <div className="flex items-center gap-2"><Switch checked={form.ai_enabled} onCheckedChange={(v) => setForm({ ...form, ai_enabled: v })} disabled={published} /><Label>Sócio IA habilitado</Label></div>
              </div>
              <div><Label>Bônus</Label><Textarea rows={2} value={form.bonuses} onChange={(e) => setForm({ ...form, bonuses: e.target.value })} disabled={published} /></div>
              <div><Label>Observações internas</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} disabled={published} /></div>
              <div className="flex justify-end">
                <Button className="bg-gradient-brand" onClick={saveConfig} disabled={published || saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Salvar configuração
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="encontros" className="space-y-3">
              <div className="flex justify-end"><Button size="sm" variant="outline" onClick={addMeeting} disabled={published}><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar encontro</Button></div>
              {meetings.length === 0 && <p className="text-sm text-muted-foreground">Nenhum encontro previsto nesta versão.</p>}
              {meetings.map((m) => (
                <Card key={m.id} className="p-3 space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div className="md:col-span-2"><Label className="text-xs">Título</Label><Input value={m.title} onChange={(e) => updateMeeting(m.id, { title: e.target.value })} disabled={published} /></div>
                    <div>
                      <Label className="text-xs">Tipo</Label>
                      <Select value={m.meeting_type} onValueChange={(v) => updateMeeting(m.id, { meeting_type: v as VMeeting["meeting_type"] })} disabled={published}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{MEETING_TYPES.map((t) => <SelectItem key={t} value={t}>{MEETING_LABEL[t]}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs">Cadência</Label><Input placeholder="semanal, quinzenal" value={m.cadence ?? ""} onChange={(e) => updateMeeting(m.id, { cadence: e.target.value })} disabled={published} /></div>
                    <div><Label className="text-xs">Quantidade</Label><Input type="number" value={m.quantity} onChange={(e) => updateMeeting(m.id, { quantity: Number(e.target.value) })} disabled={published} /></div>
                    <div><Label className="text-xs">Duração (min)</Label><Input type="number" value={m.duration_min} onChange={(e) => updateMeeting(m.id, { duration_min: Number(e.target.value) })} disabled={published} /></div>
                    <div className="flex items-end gap-2"><Switch checked={m.required} onCheckedChange={(v) => updateMeeting(m.id, { required: v })} disabled={published} /><Label className="text-xs">Obrigatório</Label></div>
                    <div className="flex items-end justify-end"><Button size="icon" variant="ghost" onClick={() => removeRow("product_version_meetings", m.id)} disabled={published}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
                  </div>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="etapas" className="space-y-3">
              <div className="flex justify-end"><Button size="sm" variant="outline" onClick={addStage} disabled={published}><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar etapa</Button></div>
              {stages.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma etapa cadastrada — a jornada seguirá o padrão do produto.</p>}
              {stages.map((s, i) => (
                <Card key={s.id} className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{i + 1}</Badge>
                    <Input value={s.title} onChange={(e) => updateStage(s.id, { title: e.target.value })} disabled={published} />
                    <Button size="icon" variant="ghost" onClick={() => removeRow("product_version_stages", s.id)} disabled={published}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div><Label className="text-xs">Ordem</Label><Input type="number" value={s.order_index} onChange={(e) => updateStage(s.id, { order_index: Number(e.target.value) })} disabled={published} /></div>
                    <div><Label className="text-xs">Duração (dias)</Label><Input type="number" value={s.duration_days ?? ""} onChange={(e) => updateStage(s.id, { duration_days: e.target.value === "" ? null : Number(e.target.value) })} disabled={published} /></div>
                    <div><Label className="text-xs">Ciclo</Label><Input type="number" value={s.cycle_number ?? ""} onChange={(e) => updateStage(s.id, { cycle_number: e.target.value === "" ? null : Number(e.target.value) })} disabled={published} /></div>
                  </div>
                  <div><Label className="text-xs">Descrição</Label><Textarea rows={2} value={s.description ?? ""} onChange={(e) => updateStage(s.id, { description: e.target.value })} disabled={published} /></div>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="entregaveis" className="space-y-3">
              <div className="flex justify-end"><Button size="sm" variant="outline" onClick={addDeliverable} disabled={published}><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar entregável</Button></div>
              {deliverables.length === 0 && <p className="text-sm text-muted-foreground">Nenhum entregável cadastrado nesta versão.</p>}
              {deliverables.map((d) => (
                <Card key={d.id} className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input value={d.title} onChange={(e) => updateDeliverable(d.id, { title: e.target.value })} disabled={published} />
                    <Button size="icon" variant="ghost" onClick={() => removeRow("product_version_deliverables", d.id)} disabled={published}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div><Label className="text-xs">Formato</Label><Input placeholder="PDF, planilha, painel" value={d.format ?? ""} onChange={(e) => updateDeliverable(d.id, { format: e.target.value })} disabled={published} /></div>
                    <div>
                      <Label className="text-xs">Etapa</Label>
                      <Select value={d.stage_id ?? "none"} onValueChange={(v) => updateDeliverable(d.id, { stage_id: v === "none" ? null : v })} disabled={published}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem etapa</SelectItem>
                          {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end gap-2"><Switch checked={d.required} onCheckedChange={(v) => updateDeliverable(d.id, { required: v })} disabled={published} /><Label className="text-xs">Obrigatório</Label></div>
                  </div>
                  <div><Label className="text-xs">Descrição</Label><Textarea rows={2} value={d.description ?? ""} onChange={(e) => updateDeliverable(d.id, { description: e.target.value })} disabled={published} /></div>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="regras" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={form.diagnostic_required} onCheckedChange={(v) => setForm({ ...form, diagnostic_required: v })} disabled={published} />
                  <Label>Diagnóstico obrigatório</Label>
                </div>
                <div><Label>Limite de Metas Críticas</Label><Input type="number" value={form.max_critical_goals} onChange={(e) => setForm({ ...form, max_critical_goals: e.target.value })} disabled={published} /></div>
                <div><Label>Plano de Ação (dias)</Label><Input type="number" value={form.action_plan_days} onChange={(e) => setForm({ ...form, action_plan_days: e.target.value })} disabled={published} /></div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Regras de conclusão</Label>
                  <Button size="sm" variant="outline" disabled={published} onClick={() => setForm({ ...form, completion_rules: [...form.completion_rules, ""] })}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar regra
                  </Button>
                </div>
                {form.completion_rules.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma regra de conclusão definida.</p>}
                {form.completion_rules.map((rule, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Badge variant="outline">{i + 1}</Badge>
                    <Input
                      value={rule}
                      disabled={published}
                      onChange={(e) => setForm({ ...form, completion_rules: form.completion_rules.map((r, j) => (j === i ? e.target.value : r)) })}
                    />
                    <Button size="icon" variant="ghost" disabled={published || i === 0}
                      onClick={() => {
                        const next = [...form.completion_rules];
                        [next[i - 1], next[i]] = [next[i], next[i - 1]];
                        setForm({ ...form, completion_rules: next });
                      }}
                    >↑</Button>
                    <Button size="icon" variant="ghost" disabled={published || i === form.completion_rules.length - 1}
                      onClick={() => {
                        const next = [...form.completion_rules];
                        [next[i + 1], next[i]] = [next[i], next[i + 1]];
                        setForm({ ...form, completion_rules: next });
                      }}
                    >↓</Button>
                    <Button size="icon" variant="ghost" disabled={published} onClick={() => setForm({ ...form, completion_rules: form.completion_rules.filter((_, j) => j !== i) })}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Campos obrigatórios da meta</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {GOAL_FIELDS.map((f) => {
                    const checked = form.goal_required_fields.includes(f.key);
                    return (
                      <div key={f.key} className="flex items-center gap-2">
                        <Switch
                          checked={checked}
                          disabled={published}
                          onCheckedChange={(v) =>
                            setForm({
                              ...form,
                              goal_required_fields: v
                                ? [...form.goal_required_fields, f.key]
                                : form.goal_required_fields.filter((k) => k !== f.key),
                            })
                          }
                        />
                        <Label className="text-xs">{f.label}</Label>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end">
                <Button className="bg-gradient-brand" onClick={saveConfig} disabled={published || saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Salvar regras
                </Button>
              </div>
            </TabsContent>

          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
