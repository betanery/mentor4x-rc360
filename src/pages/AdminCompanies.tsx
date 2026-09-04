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
import { Building2, Plus, Pencil, Star, Loader2, Search, PackagePlus, ExternalLink, Boxes } from "lucide-react";

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

type ProductRow = { id: string; name: string; is_active: boolean };
type VersionRow = {
  id: string;
  product_id: string;
  version_label: string;
  is_active: boolean;
  published_at: string | null;
  duration_days: number | null;
  cycle_count: number;
};
type ContractRow = {
  id: string;
  company_id: string;
  product_id: string;
  product_version_id: string;
  status: string;
  journey_stage: string;
  current_cycle: number;
  started_at: string | null;
  expected_completion: string | null;
  onboarding_generated_at: string | null;
  products?: { name: string } | null;
  product_versions?: { version_label: string } | null;
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

const emptyContractForm = {
  company_id: "",
  product_id: "",
  product_version_id: "",
  status: "ativo",
  journey_stage: "ciclo_1" as typeof STAGES[number],
  current_cycle: 1,
  started_at: new Date().toISOString().slice(0, 10),
  expected_completion: "",
  notes: "",
};

const statusLabel: Record<string, string> = {
  rascunho: "Rascunho",
  ativo: "Ativo",
  pausado: "Pausado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export default function AdminCompanies() {
  const { isConsultor, user } = useAuth();
  const { setCurrentId, refresh, current } = useCompany();
  const nav = useNavigate();
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingContract, setSavingContract] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [contractForm, setContractForm] = useState(emptyContractForm);
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("all");
  const [filterChaos, setFilterChaos] = useState("all");

  const load = async () => {
    setLoading(true);
    const [companiesRes, productsRes, versionsRes, contractsRes] = await Promise.all([
      supabase.from("companies").select("*").order("name"),
      supabase.from("products").select("id, name, is_active").order("sort_order").order("name"),
      supabase.from("product_versions").select("id, product_id, version_label, is_active, published_at, duration_days, cycle_count").order("created_at", { ascending: false }),
      supabase.from("contracts").select("id, company_id, product_id, product_version_id, status, journey_stage, current_cycle, started_at, expected_completion, onboarding_generated_at, products(name), product_versions(version_label)").order("created_at", { ascending: false }),
    ]);
    setLoading(false);
    const error = companiesRes.error || productsRes.error || versionsRes.error || contractsRes.error;
    if (error) { toast.error(error.message || "Falha ao carregar empresas"); return; }
    setRows((companiesRes.data || []) as CompanyRow[]);
    setProducts((productsRes.data || []) as ProductRow[]);
    setVersions((versionsRes.data || []) as VersionRow[]);
    setContracts((contractsRes.data || []) as ContractRow[]);
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStage !== "all" && r.journey_stage !== filterStage) return false;
    if (filterChaos !== "all" && r.chaos_level !== filterChaos) return false;
    return true;
  }), [rows, search, filterStage, filterChaos]);

  const publishedVersionsByProduct = useMemo(() => {
    const map: Record<string, VersionRow[]> = {};
    versions
      .filter((version) => version.is_active && !!version.published_at)
      .forEach((version) => {
        map[version.product_id] = map[version.product_id] || [];
        map[version.product_id].push(version);
      });
    return map;
  }, [versions]);

  const contractsByCompany = useMemo(() => {
    const map: Record<string, ContractRow[]> = {};
    contracts.forEach((contract) => {
      map[contract.company_id] = map[contract.company_id] || [];
      map[contract.company_id].push(contract);
    });
    return map;
  }, [contracts]);

  if (!isConsultor) return <Navigate to="/" replace />;

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

  const openContract = (company: CompanyRow) => {
    const firstProduct = products.find((product) => product.is_active && (publishedVersionsByProduct[product.id]?.length || 0) > 0);
    const firstVersion = firstProduct ? publishedVersionsByProduct[firstProduct.id]?.[0] : undefined;
    setContractForm({
      ...emptyContractForm,
      company_id: company.id,
      product_id: firstProduct?.id || "",
      product_version_id: firstVersion?.id || "",
      journey_stage: "ciclo_1",
      current_cycle: 1,
      started_at: new Date().toISOString().slice(0, 10),
    });
    setContractOpen(true);
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
    void load();
  };

  const selectProductForContract = (productId: string) => {
    const firstVersion = publishedVersionsByProduct[productId]?.[0];
    setContractForm((currentForm) => ({
      ...currentForm,
      product_id: productId,
      product_version_id: firstVersion?.id || "",
    }));
  };

  const saveContract = async () => {
    if (!contractForm.company_id) { toast.error("Selecione a empresa"); return; }
    if (!contractForm.product_id) { toast.error("Selecione o produto"); return; }
    if (!contractForm.product_version_id) { toast.error("Selecione uma versão ativa e publicada"); return; }
    setSavingContract(true);
    const { data, error } = await supabase.from("contracts").insert({
      company_id: contractForm.company_id,
      product_id: contractForm.product_id,
      product_version_id: contractForm.product_version_id,
      status: contractForm.status,
      journey_stage: contractForm.journey_stage,
      current_cycle: contractForm.current_cycle,
      started_at: contractForm.started_at || null,
      expected_completion: contractForm.expected_completion || null,
      notes: contractForm.notes || null,
      contracted_scope: {},
    }).select("id").single();

    if (error || !data) {
      setSavingContract(false);
      toast.error(error?.message || "Não foi possível vincular o produto à empresa");
      return;
    }

    const { data: generatedCount, error: onboardingError } = await supabase.rpc("generate_contract_onboarding", { _contract_id: data.id });
    setSavingContract(false);
    setContractOpen(false);
    await load();
    await refresh();
    setCurrentId(contractForm.company_id);

    if (onboardingError) {
      toast.warning("Produto vinculado, mas o onboarding não pôde ser gerado automaticamente.");
      return;
    }
    const count = Number(generatedCount || 0);
    if (count > 0) {
      toast.success(`Produto vinculado e ${count} item(ns) de onboarding gerados.`);
    } else {
      toast.warning("Produto vinculado. Esta versão ainda não possui um modelo de onboarding configurado.");
    }
  };

  const setActive = async (id: string) => {
    setCurrentId(id);
    toast.success("Empresa ativa atualizada");
  };

  const goToOnboarding = (companyId: string) => {
    setCurrentId(companyId);
    nav("/onboarding");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empresas"
        subtitle="Cadastre, gerencie e vincule produtos às empresas atendidas no SEE_4X."
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
                  {editingId ? "Atualize os dados da empresa." : "Você será vinculado como Consultor 4X responsável automaticamente."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 flex items-center gap-4">
                  <div className="h-16 w-16 rounded-xl bg-muted overflow-hidden flex items-center justify-center shrink-0 border">
                    {form.logo_url ? <img src={form.logo_url} alt="Logo" className="h-full w-full object-cover" /> : <Building2 className="h-7 w-7 text-muted-foreground" />}
                  </div>
                  <div className="flex-1">
                    <Label>Logo (máx 2MB)</Label>
                    <div className="flex gap-2 items-center mt-1">
                      <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} disabled={uploading} />
                      {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                      {form.logo_url && <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, logo_url: "" })}>Remover</Button>}
                    </div>
                  </div>
                </div>
                <div className="sm:col-span-2"><Label>Nome da empresa *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Acme Ltda" /></div>
                <div className="sm:col-span-2"><Label>Segmento</Label><Input value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} placeholder="Ex: Indústria, Varejo, SaaS..." /></div>
                <div>
                  <Label>Estágio da jornada</Label>
                  <Select value={form.journey_stage} onValueChange={(v) => setForm({ ...form, journey_stage: v as typeof STAGES[number] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{CYCLE_LABEL[s].label} · {CYCLE_LABEL[s].subtitle}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nível de Improviso</Label>
                  <Select value={form.chaos_level} onValueChange={(v) => setForm({ ...form, chaos_level: v as typeof CHAOS[number] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CHAOS.map((c) => <SelectItem key={c} value={c}>{IMPROVISO_LABEL[c].label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Receita projetada (R$)</Label><Input type="number" min={0} value={form.projected_revenue} onChange={(e) => setForm({ ...form, projected_revenue: e.target.value })} placeholder="0" /></div>
                <div><Label>Data de início</Label><Input type="date" value={form.started_at} onChange={(e) => setForm({ ...form, started_at: e.target.value })} /></div>
                <div className="sm:col-span-2"><Label>Previsão de conclusão</Label><Input type="date" value={form.expected_completion} onChange={(e) => setForm({ ...form, expected_completion: e.target.value })} /></div>
                <div className="sm:col-span-2"><Label>Observações</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Contexto, particularidades, alertas..." /></div>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save} disabled={saving} className="bg-gradient-brand">{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}{editingId ? "Salvar alterações" : "Criar empresa"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="p-4 shadow-card">
        <div className="grid sm:grid-cols-3 gap-3">
          <div><Label className="text-xs">Buscar</Label><div className="relative"><Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome da empresa..." /></div></div>
          <div><Label className="text-xs">Estágio</Label><Select value={filterStage} onValueChange={setFilterStage}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{STAGES.map((s) => <SelectItem key={s} value={s}>{CYCLE_LABEL[s].label}</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="text-xs">Nível de Improviso</Label><Select value={filterChaos} onValueChange={setFilterChaos}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{CHAOS.map((c) => <SelectItem key={c} value={c}>{IMPROVISO_LABEL[c].label}</SelectItem>)}</SelectContent></Select></div>
        </div>
      </Card>

      <Card className="p-6 shadow-card">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando empresas...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground"><Building2 className="h-10 w-10 mx-auto mb-2 opacity-40" /><p className="text-sm">Nenhuma empresa encontrada.</p></div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => {
              const improviso = IMPROVISO_LABEL[r.chaos_level];
              const stage = CYCLE_LABEL[r.journey_stage];
              const isActive = current?.id === r.id;
              const companyContracts = contractsByCompany[r.id] || [];
              const activeContracts = companyContracts.filter((contract) => ["ativo", "pausado"].includes(contract.status));
              return (
                <div key={r.id} className="rounded-xl border border-border hover:border-gold transition-colors overflow-hidden">
                  <div className="flex flex-wrap items-center gap-3 p-4">
                    <div className="h-12 w-12 rounded-xl overflow-hidden bg-gradient-brand text-primary-foreground font-black flex items-center justify-center shrink-0">{r.logo_url ? <img src={r.logo_url} alt={r.name} className="h-full w-full object-cover" /> : r.name[0]?.toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold">{r.name}</h4>
                        {isActive && <Badge className="bg-gold text-primary">Ativa</Badge>}
                        {improviso && <Badge className={improviso.color} variant="secondary">{improviso.label}</Badge>}
                        {stage && <Badge variant="outline">{stage.label} · {stage.subtitle}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">{r.segment || "Sem segmento"} · Receita projetada {formatBRL(r.projected_revenue)} · Score {r.overall_score}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {!isActive && <Button size="sm" variant="ghost" onClick={() => setActive(r.id)}><Star className="h-3 w-3 mr-1" /> Definir ativa</Button>}
                      <Button size="sm" variant="outline" onClick={() => openContract(r)}><PackagePlus className="h-3.5 w-3.5 mr-1" /> Vincular produto</Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-3 w-3 mr-1" /> Editar</Button>
                    </div>
                  </div>

                  <div className="border-t border-border bg-muted/20 px-4 py-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2"><Boxes className="h-4 w-4 text-muted-foreground" /><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Produtos contratados</p></div>
                      <Badge variant="outline">{activeContracts.length} ativo(s)</Badge>
                    </div>
                    {companyContracts.length === 0 ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-background/60 px-3 py-3">
                        <p className="text-sm text-muted-foreground">Nenhum produto vinculado a esta empresa.</p>
                        <Button size="sm" variant="ghost" onClick={() => openContract(r)}><Plus className="h-3.5 w-3.5 mr-1" /> Vincular primeiro produto</Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {companyContracts.map((contract) => (
                          <div key={contract.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/70 px-3 py-2.5">
                            <div className="flex-1 min-w-[220px]">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold">{contract.products?.name ?? "Produto"}</span>
                                <Badge variant="secondary">{contract.product_versions?.version_label ?? "Versão"}</Badge>
                                <Badge variant={contract.status === "ativo" ? "default" : "outline"}>{statusLabel[contract.status] ?? contract.status}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{CYCLE_LABEL[contract.journey_stage]?.label ?? contract.journey_stage} · ciclo {contract.current_cycle}{contract.started_at ? ` · início ${new Date(`${contract.started_at}T12:00:00`).toLocaleDateString("pt-BR")}` : ""} · {contract.onboarding_generated_at ? "onboarding gerado" : "onboarding pendente"}</p>
                            </div>
                            {["ativo", "pausado"].includes(contract.status) && <Button size="sm" variant="ghost" onClick={() => goToOnboarding(r.id)}><ExternalLink className="h-3.5 w-3.5 mr-1" /> Ver onboarding</Button>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Dialog open={contractOpen} onOpenChange={setContractOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vincular produto à empresa</DialogTitle>
            <DialogDescription>Crie a contratação escolhendo um produto e uma versão ativa e publicada. O onboarding será gerado automaticamente quando houver um modelo configurado para a versão.</DialogDescription>
          </DialogHeader>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><Label>Empresa</Label><Input value={rows.find((row) => row.id === contractForm.company_id)?.name || ""} disabled /></div>
            <div>
              <Label>Produto</Label>
              <Select value={contractForm.product_id} onValueChange={selectProductForContract}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{products.filter((product) => product.is_active && (publishedVersionsByProduct[product.id]?.length || 0) > 0).map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Versão</Label>
              <Select value={contractForm.product_version_id} onValueChange={(value) => setContractForm({ ...contractForm, product_version_id: value })} disabled={!contractForm.product_id}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{(publishedVersionsByProduct[contractForm.product_id] || []).map((version) => <SelectItem key={version.id} value={version.id}>{version.version_label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Status</Label><Select value={contractForm.status} onValueChange={(value) => setContractForm({ ...contractForm, status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="pausado">Pausado</SelectItem><SelectItem value="rascunho">Rascunho</SelectItem></SelectContent></Select></div>
            <div><Label>Jornada inicial</Label><Select value={contractForm.journey_stage} onValueChange={(value) => setContractForm({ ...contractForm, journey_stage: value as typeof STAGES[number] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STAGES.filter((stage) => stage !== "concluido").map((stage) => <SelectItem key={stage} value={stage}>{CYCLE_LABEL[stage].label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Ciclo operacional</Label><Input type="number" min={1} max={24} value={contractForm.current_cycle} onChange={(e) => setContractForm({ ...contractForm, current_cycle: Number(e.target.value) || 1 })} /></div>
            <div><Label>Data de início</Label><Input type="date" value={contractForm.started_at} onChange={(e) => setContractForm({ ...contractForm, started_at: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Previsão de conclusão</Label><Input type="date" value={contractForm.expected_completion} onChange={(e) => setContractForm({ ...contractForm, expected_completion: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Observações</Label><Textarea rows={3} value={contractForm.notes} onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })} placeholder="Condições, escopo ou observações da contratação..." /></div>
          </div>
          {products.filter((product) => product.is_active && (publishedVersionsByProduct[product.id]?.length || 0) > 0).length === 0 && <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">Não há produto com versão ativa e publicada disponível para uma nova contratação.</div>}
          <DialogFooter><Button variant="outline" onClick={() => setContractOpen(false)}>Cancelar</Button><Button className="bg-gradient-brand" onClick={saveContract} disabled={savingContract || !contractForm.product_version_id}>{savingContract && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Vincular produto</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
