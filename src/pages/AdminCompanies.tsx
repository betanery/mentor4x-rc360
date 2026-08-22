import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { IMPROVISO_LABEL, CYCLE_LABEL, formatBRL } from "@/lib/labels";
import { Building2, Plus, Pencil, Star, Loader2, Search, Upload } from "lucide-react";

const STAGES = ["ciclo_1","ciclo_2","ciclo_3","ciclo_4","ciclo_5","ciclo_6","concluido"] as const;
const CHAOS = ["leve","moderado","severo","total","escala"] as const;

const schema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(120),
  segment: z.string().trim().max(120).optional().or(z.literal("")),
  journey_stage: z.enum(STAGES),
  chaos_level: z.enum(CHAOS),
  projected_revenue: z.number().min(0, "Valor inválido").nullable(),
  started_at: z.string().optional().or(z.literal("")),
  expected_completion: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

type CompanyRow = {
  id: string;
  name: string;
  segment: string | null;
  journey_stage: string;
  chaos_level: string;
  overall_score: number;
  owner_dependency: number;
  projected_revenue: number | null;
  started_at: string | null;
  expected_completion: string | null;
  notes: string | null;
  logo_url: string | null;
};

const emptyForm = {
  name: "",
  segment: "",
  journey_stage: "ciclo_1" as typeof STAGES[number],
  chaos_level: "moderado" as typeof CHAOS[number],
  projected_revenue: "" as string | "",
  started_at: new Date().toISOString().slice(0, 10),
  expected_completion: "",
  notes: "",
  logo_url: "" as string | "",
};

export default function AdminCompanies() {
  const { isStaff, user } = useAuth();
  const { setCurrentId, refresh, current } = useCompany();
  const nav = useNavigate();
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("all");
  const [filterChaos, setFilterChaos] = useState("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("companies").select("*").order("name");
    setLoading(false);
    if (error) { toast.error("Falha ao carregar empresas"); return; }
    setRows((data || []) as CompanyRow[]);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStage !== "all" && r.journey_stage !== filterStage) return false;
    if (filterChaos !== "all" && r.chaos_level !== filterChaos) return false;
    return true;
  }), [rows, search, filterStage, filterChaos]);

  if (!isStaff) return <Navigate to="/" replace />;

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (r: CompanyRow) => {
    setEditingId(r.id);
    setForm({
      name: r.name,
      segment: r.segment || "",
      journey_stage: (r.journey_stage as typeof STAGES[number]) || "ciclo_1",
      chaos_level: (r.chaos_level as typeof CHAOS[number]) || "moderado",
      projected_revenue: r.projected_revenue != null ? String(r.projected_revenue) : "",
      started_at: r.started_at || "",
      expected_completion: r.expected_completion || "",
      notes: r.notes || "",
      logo_url: r.logo_url || "",
    });
    setOpen(true);
  };

  const uploadLogo = async (file: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Máx 2MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `companies/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { setUploading(false); toast.error(error.message); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setForm((f) => ({ ...f, logo_url: data.publicUrl }));
    setUploading(false);
    toast.success("Logo enviada");
  };

  const save = async () => {
    const parsed = schema.safeParse({
      ...form,
      projected_revenue: form.projected_revenue === "" ? null : Number(form.projected_revenue),
    });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setSaving(true);
    const payload = {
      name: parsed.data.name,
      segment: parsed.data.segment || null,
      journey_stage: parsed.data.journey_stage,
      chaos_level: parsed.data.chaos_level,
      projected_revenue: parsed.data.projected_revenue,
      started_at: parsed.data.started_at || null,
      expected_completion: parsed.data.expected_completion || null,
      notes: parsed.data.notes || null,
      logo_url: form.logo_url || null,
    };

    if (editingId) {
      const { error } = await supabase.from("companies").update(payload).eq("id", editingId);
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Empresa atualizada");
    } else {
      const { data, error } = await supabase.from("companies").insert(payload).select("id").single();
      if (error || !data) { setSaving(false); toast.error(error?.message || "Falha ao criar empresa"); return; }
      const newId = data.id;
      // Vincular criador como mentor
      const isFirst = rows.length === 0;
      if (user) {
        const { error: memErr } = await supabase.from("company_members").insert({
          company_id: newId,
          user_id: user.id,
          member_role: "mentor" as const,
          is_primary: isFirst,
        });
        if (memErr) console.warn("Falha ao vincular mentor", memErr);
      }
      setSaving(false);
      toast.success("Empresa criada e vinculada a você");
      await refresh();
      if (isFirst) setCurrentId(newId);
    }
    setOpen(false);
    load();
  };

  const setActive = async (id: string) => {
    setCurrentId(id);
    toast.success("Empresa ativa atualizada");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empresas"
        subtitle="Cadastre e gerencie todas as empresas atendidas no SEE_4X."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew} className="bg-gradient-brand">
                <Plus className="h-4 w-4 mr-1" /> Nova empresa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar empresa" : "Cadastrar nova empresa"}</DialogTitle>
                <DialogDescription>
                  {editingId ? "Atualize os dados da empresa." : "Você será vinculado como mentor responsável automaticamente."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 flex items-center gap-4">
                  <div className="h-16 w-16 rounded-xl bg-muted overflow-hidden flex items-center justify-center shrink-0 border">
                    {form.logo_url ? (
                      <img src={form.logo_url} alt="Logo" className="h-full w-full object-cover" />
                    ) : (
                      <Building2 className="h-7 w-7 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <Label>Logo (máx 2MB)</Label>
                    <div className="flex gap-2 items-center mt-1">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
                        disabled={uploading}
                      />
                      {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                      {form.logo_url && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, logo_url: "" })}>
                          Remover
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Label>Nome da empresa *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Acme Ltda" />
                </div>
                <div className="sm:col-span-2">
                  <Label>Segmento</Label>
                  <Input value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} placeholder="Ex: Indústria, Varejo, SaaS..." />
                </div>
                <div>
                  <Label>Estágio da jornada</Label>
                  <Select value={form.journey_stage} onValueChange={(v) => setForm({ ...form, journey_stage: v as typeof STAGES[number] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STAGES.map((s) => <SelectItem key={s} value={s}>{CYCLE_LABEL[s].label} · {CYCLE_LABEL[s].subtitle}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nível de Improviso</Label>
                  <Select value={form.chaos_level} onValueChange={(v) => setForm({ ...form, chaos_level: v as typeof CHAOS[number] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CHAOS.map((c) => <SelectItem key={c} value={c}>{IMPROVISO_LABEL[c].label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Receita projetada (R$)</Label>
                  <Input type="number" min={0} value={form.projected_revenue} onChange={(e) => setForm({ ...form, projected_revenue: e.target.value })} placeholder="0" />
                </div>
                <div>
                  <Label>Data de início</Label>
                  <Input type="date" value={form.started_at} onChange={(e) => setForm({ ...form, started_at: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Previsão de conclusão</Label>
                  <Input type="date" value={form.expected_completion} onChange={(e) => setForm({ ...form, expected_completion: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Observações</Label>
                  <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Contexto, particularidades, alertas..." />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={save} disabled={saving} className="bg-gradient-brand">
                  {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  {editingId ? "Salvar alterações" : "Criar empresa"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="p-4 shadow-card">
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome da empresa..." />
            </div>
          </div>
          <div>
            <Label className="text-xs">Estágio</Label>
            <Select value={filterStage} onValueChange={setFilterStage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {STAGES.map((s) => <SelectItem key={s} value={s}>{CYCLE_LABEL[s].label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Nível de Improviso</Label>
            <Select value={filterChaos} onValueChange={setFilterChaos}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {CHAOS.map((c) => <SelectItem key={c} value={c}>{IMPROVISO_LABEL[c].label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-6 shadow-card">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando empresas...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Building2 className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhuma empresa encontrada.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => {
              const improviso = IMPROVISO_LABEL[r.chaos_level];
              const stage = CYCLE_LABEL[r.journey_stage];
              const isActive = current?.id === r.id;
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-3 p-4 rounded-lg border border-border hover:border-gold transition-colors">
                  <div className="h-12 w-12 rounded-xl overflow-hidden bg-gradient-brand text-primary-foreground font-black flex items-center justify-center shrink-0">
                    {r.logo_url ? <img src={r.logo_url} alt={r.name} className="h-full w-full object-cover" /> : r.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold">{r.name}</h4>
                      {isActive && <Badge className="bg-gold text-primary">Ativa</Badge>}
                      {improviso && <Badge className={improviso.color} variant="secondary">{improviso.label}</Badge>}
                      {stage && <Badge variant="outline">{stage.label} · {stage.subtitle}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {r.segment || "Sem segmento"} · Receita projetada {formatBRL(r.projected_revenue)} · Score {r.overall_score}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {!isActive && (
                      <Button size="sm" variant="ghost" onClick={() => setActive(r.id)}>
                        <Star className="h-3 w-3 mr-1" /> Definir ativa
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                      <Pencil className="h-3 w-3 mr-1" /> Editar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
