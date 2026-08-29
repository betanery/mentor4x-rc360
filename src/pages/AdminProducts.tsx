import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useContract } from "@/hooks/useContract";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CYCLE_LABEL } from "@/lib/labels";
import { OnboardingTemplateDialog } from "@/components/OnboardingTemplateDialog";
import { VersionConfigDialog } from "@/components/VersionConfigDialog";
import { Boxes, Calendar, Copy, Layers3, ListChecks, Lock, Loader2, Package, Pencil, Plus, RefreshCw, SlidersHorizontal, Trash2 } from "lucide-react";

import type { Json, Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type Product = Tables<"products">;
type ProductVersion = Tables<"product_versions">;
type Company = Pick<Tables<"companies">, "id" | "name">;
type Contract = Tables<"contracts"> & {
  companies?: { name: string } | null;
  products?: { name: string } | null;
  product_versions?: { version_label: string } | null;
};

const CONTRACT_STATUS = ["rascunho", "ativo", "pausado", "concluido", "cancelado"] as const;
const STAGES = ["ciclo_1", "ciclo_2", "ciclo_3", "ciclo_4", "ciclo_5", "ciclo_6", "concluido"] as const;
type ContractStatus = typeof CONTRACT_STATUS[number];
type ContractStage = typeof STAGES[number];
type ContractForm = {
  company_id: string;
  product_id: string;
  product_version_id: string;
  status: ContractStatus;
  journey_stage: ContractStage;
  current_cycle: number;
  started_at: string;
  expected_completion: string;
  completed_at: string;
  contracted_scope: string;
  notes: string;
};

const statusLabel: Record<string, string> = {
  rascunho: "Rascunho",
  ativo: "Ativo",
  pausado: "Pausado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const productSchema = z.object({
  name: z.string().trim().min(2, "Nome do produto é obrigatório").max(120),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug deve usar letras minúsculas, números e hífen"),
  category: z.string().trim().min(2, "Categoria é obrigatória").max(80),
  description: z.string().max(2000).optional().or(z.literal("")),
  sort_order: z.number().int(),
  is_active: z.boolean(),
});

const versionSchema = z.object({
  product_id: z.string().uuid("Selecione o produto"),
  version_label: z.string().trim().min(1, "Versão é obrigatória").max(80),
  methodology_code: z.string().trim().min(2).max(40),
  description: z.string().max(2000).optional().or(z.literal("")),
  cycle_count: z.number().int().min(1).max(24),
  duration_days: z.number().int().positive().nullable(),
  is_active: z.boolean(),
});

const contractSchema = z.object({
  company_id: z.string().uuid("Selecione a empresa"),
  product_id: z.string().uuid("Selecione o produto"),
  product_version_id: z.string().uuid("Selecione a versão"),
  status: z.enum(CONTRACT_STATUS),
  journey_stage: z.enum(STAGES),
  current_cycle: z.number().int().min(1).max(24),
  started_at: z.string().optional().or(z.literal("")),
  expected_completion: z.string().optional().or(z.literal("")),
  completed_at: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

const emptyProduct = { name: "", slug: "", category: "SEE_4X", description: "", sort_order: 0, is_active: true };
const emptyVersion = { product_id: "", version_label: "", methodology_code: "SEE_4X", description: "", cycle_count: 6, duration_days: 180, is_active: true };
const emptyContract: ContractForm = {
  company_id: "",
  product_id: "",
  product_version_id: "",
  status: "ativo" as const,
  journey_stage: "ciclo_1" as const,
  current_cycle: 1,
  started_at: new Date().toISOString().slice(0, 10),
  expected_completion: "",
  completed_at: "",
  contracted_scope: "{}",
  notes: "",
};

const slugify = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

export default function AdminProducts() {
  const { isStaff } = useAuth();
  const { refreshContracts } = useContract();
  const [products, setProducts] = useState<Product[]>([]);
  const [versions, setVersions] = useState<ProductVersion[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [productDialog, setProductDialog] = useState(false);
  const [versionDialog, setVersionDialog] = useState(false);
  const [contractDialog, setContractDialog] = useState(false);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [versionForm, setVersionForm] = useState(emptyVersion);
  const [contractForm, setContractForm] = useState(emptyContract);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingVersion, setEditingVersion] = useState<ProductVersion | null>(null);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [deleting, setDeleting] = useState<{ table: "products" | "product_versions" | "contracts"; id: string; title: string } | null>(null);
  const [templateVersion, setTemplateVersion] = useState<ProductVersion | null>(null);
  const [configVersion, setConfigVersion] = useState<ProductVersion | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);


  const generateOnboarding = async (contract: Contract) => {
    setGeneratingId(contract.id);
    const { data, error } = await supabase.rpc("generate_contract_onboarding", { _contract_id: contract.id });
    setGeneratingId(null);
    if (error) { toast.error(error.message); return; }
    const count = (data as number) ?? 0;
    toast.success(count > 0 ? `${count} item(ns) de onboarding gerados` : "Onboarding já estava gerado — nenhum item novo.");
    await load();
    await refreshContracts();
  };

  const load = async () => {
    setLoading(true);
    const [productsRes, versionsRes, companiesRes, contractsRes] = await Promise.all([
      supabase.from("products").select("*").order("sort_order", { ascending: true }).order("name", { ascending: true }),
      supabase.from("product_versions").select("*").order("created_at", { ascending: false }),
      supabase.from("companies").select("id, name").order("name", { ascending: true }),
      supabase
        .from("contracts")
        .select("*, companies(name), products(name), product_versions(version_label)")
        .order("created_at", { ascending: false }),
    ]);
    setLoading(false);
    const firstError = productsRes.error || versionsRes.error || companiesRes.error || contractsRes.error;
    if (firstError) {
      toast.error(firstError.message);
      return;
    }
    setProducts((productsRes.data || []) as Product[]);
    setVersions((versionsRes.data || []) as ProductVersion[]);
    setCompanies((companiesRes.data || []) as Company[]);
    setContracts((contractsRes.data || []) as Contract[]);
  };

  useEffect(() => { load(); }, []);

  const versionsByProduct = useMemo(() => {
    const map: Record<string, ProductVersion[]> = {};
    versions.forEach((version) => {
      map[version.product_id] = map[version.product_id] || [];
      map[version.product_id].push(version);
    });
    return map;
  }, [versions]);

  if (!isStaff) return <Navigate to="/" replace />;

  const openProduct = (product?: Product) => {
    setEditingProduct(product || null);
    setProductForm(product ? {
      name: product.name,
      slug: product.slug,
      category: product.category,
      description: product.description || "",
      sort_order: product.sort_order,
      is_active: product.is_active,
    } : { ...emptyProduct, sort_order: products.length + 1 });
    setProductDialog(true);
  };

  const openVersion = (version?: ProductVersion, productId?: string) => {
    setEditingVersion(version || null);
    setVersionForm(version ? {
      product_id: version.product_id,
      version_label: version.version_label,
      methodology_code: version.methodology_code,
      description: version.description || "",
      cycle_count: version.cycle_count,
      duration_days: version.duration_days || 180,
      is_active: version.is_active,
    } : { ...emptyVersion, product_id: productId || products[0]?.id || "" });
    setVersionDialog(true);
  };

  const openContract = (contract?: Contract) => {
    setEditingContract(contract || null);
    setContractForm(contract ? {
      company_id: contract.company_id,
      product_id: contract.product_id,
      product_version_id: contract.product_version_id,
      status: CONTRACT_STATUS.includes(contract.status as ContractStatus) ? contract.status as ContractStatus : "ativo",
      journey_stage: STAGES.includes(contract.journey_stage as ContractStage) ? contract.journey_stage as ContractStage : "ciclo_1",
      current_cycle: contract.current_cycle,
      started_at: contract.started_at || "",
      expected_completion: contract.expected_completion || "",
      completed_at: contract.completed_at || "",
      contracted_scope: JSON.stringify(contract.contracted_scope ?? {}, null, 2),
      notes: contract.notes || "",
    } : { ...emptyContract, company_id: companies[0]?.id || "", product_id: products[0]?.id || "", product_version_id: versionsByProduct[products[0]?.id || ""]?.[0]?.id || "" });
    setContractDialog(true);
  };

  const saveProduct = async () => {
    const parsed = productSchema.safeParse(productForm);
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    const payload: TablesInsert<"products"> = {
      name: parsed.data.name,
      slug: parsed.data.slug,
      category: parsed.data.category,
      sort_order: parsed.data.sort_order,
      is_active: parsed.data.is_active,
      description: parsed.data.description || null,
    };
    const { error } = editingProduct
      ? await supabase.from("products").update(payload).eq("id", editingProduct.id)
      : await supabase.from("products").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editingProduct ? "Produto atualizado" : "Produto criado");
    setProductDialog(false);
    await load();
  };

  const saveVersion = async () => {
    const parsed = versionSchema.safeParse(versionForm);
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    const payload: TablesInsert<"product_versions"> | TablesUpdate<"product_versions"> = {
      ...parsed.data,
      description: parsed.data.description || null,
      published_at: parsed.data.is_active ? new Date().toISOString() : null,
    };
    const { error } = editingVersion
      ? await supabase.from("product_versions").update(payload).eq("id", editingVersion.id)
      : await supabase.from("product_versions").insert(payload as TablesInsert<"product_versions">);
    if (error) { toast.error(error.message); return; }
    toast.success(editingVersion ? "Versão atualizada" : "Versão criada");
    setVersionDialog(false);
    await load();
  };

  const saveContract = async () => {
    const parsed = contractSchema.safeParse(contractForm);
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    let scope: Json = {};
    try {
      scope = contractForm.contracted_scope.trim() ? JSON.parse(contractForm.contracted_scope) : {};
    } catch {
      toast.error("Escopo contratado precisa ser um JSON válido");
      return;
    }
    const payload: TablesInsert<"contracts"> | TablesUpdate<"contracts"> = {
      ...parsed.data,
      started_at: parsed.data.started_at || null,
      expected_completion: parsed.data.expected_completion || null,
      completed_at: parsed.data.completed_at || null,
      notes: parsed.data.notes || null,
      contracted_scope: scope,
    };
    const { error } = editingContract
      ? await supabase.from("contracts").update(payload).eq("id", editingContract.id)
      : await supabase.from("contracts").insert(payload as TablesInsert<"contracts">);
    if (error) { toast.error(error.message); return; }
    toast.success(editingContract ? "Contratação atualizada" : "Contratação criada");
    setContractDialog(false);
    await load();
    await refreshContracts();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from(deleting.table).delete().eq("id", deleting.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Registro removido");
    setDeleting(null);
    await load();
    await refreshContracts();
  };

  const selectProductForContract = (productId: string) => {
    const firstVersion = versionsByProduct[productId]?.[0];
    setContractForm({ ...contractForm, product_id: productId, product_version_id: firstVersion?.id || "" });
  };

  const publishVersion = async (version: ProductVersion) => {
    const { error } = await supabase.from("product_versions").update({ published_at: new Date().toISOString() }).eq("id", version.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Versão publicada — a partir de agora ela é imutável.");
    await load();
  };

  const duplicateVersion = async (version: ProductVersion) => {
    setDuplicatingId(version.id);
    const { data: created, error } = await supabase
      .from("product_versions")
      .insert({
        product_id: version.product_id,
        version_label: `${version.version_label} (cópia)`,
        methodology_code: version.methodology_code,
        description: version.description,
        cycle_count: version.cycle_count,
        duration_days: version.duration_days,
        is_active: false,
      })
      .select("id")
      .single();
    if (error || !created) { setDuplicatingId(null); toast.error(error?.message ?? "Falha ao duplicar versão"); return; }

    const newId = created.id;
    const [cfg, mts, sts] = await Promise.all([
      supabase.from("product_version_config").select("*").eq("product_version_id", version.id).maybeSingle(),
      supabase.from("product_version_meetings").select("*").eq("product_version_id", version.id).order("order_index"),
      supabase.from("product_version_stages").select("*").eq("product_version_id", version.id).order("order_index"),
    ]);

    if (cfg.data) {
      const { id: _id, created_at: _c, updated_at: _u, product_version_id: _pv, ...rest } = cfg.data;
      await supabase.from("product_version_config").insert({ ...rest, product_version_id: newId });
    }
    if (mts.data?.length) {
      await supabase.from("product_version_meetings").insert(
        mts.data.map(({ id: _i, created_at: _c, updated_at: _u, product_version_id: _pv, ...rest }) => ({ ...rest, product_version_id: newId })),
      );
    }
    const stageMap: Record<string, string> = {};
    for (const stage of sts.data ?? []) {
      const { id: oldId, created_at: _c, updated_at: _u, product_version_id: _pv, ...rest } = stage;
      const { data: newStage } = await supabase
        .from("product_version_stages")
        .insert({ ...rest, product_version_id: newId })
        .select("id")
        .single();
      if (newStage) stageMap[oldId] = newStage.id;
    }
    const { data: dls } = await supabase.from("product_version_deliverables").select("*").eq("product_version_id", version.id).order("order_index");
    if (dls?.length) {
      await supabase.from("product_version_deliverables").insert(
        dls.map(({ id: _i, created_at: _c, updated_at: _u, product_version_id: _pv, stage_id, ...rest }) => ({
          ...rest,
          product_version_id: newId,
          stage_id: stage_id ? stageMap[stage_id] ?? null : null,
        })),
      );
    }
    await supabase.from("product_inheritance").insert({
      base_version_id: version.id,
      derived_version_id: newId,
      inherited_components: ["config", "encontros", "etapas", "entregaveis"],
      notes: "Duplicada a partir da versão base para edição.",
    });

    setDuplicatingId(null);
    toast.success("Versão duplicada — edite a cópia e publique quando estiver pronta.");
    await load();
  };


  return (
    <div className="space-y-6">
      <PageHeader
        title="Produtos e Contratações"
        subtitle="Catálogo multiproduto do Mentor 4X: produtos, versões e jornadas contratadas por empresa."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 shadow-card"><p className="text-xs text-muted-foreground">Produtos</p><div className="text-2xl font-bold">{products.length}</div></Card>
        <Card className="p-4 shadow-card"><p className="text-xs text-muted-foreground">Versões</p><div className="text-2xl font-bold">{versions.length}</div></Card>
        <Card className="p-4 shadow-card"><p className="text-xs text-muted-foreground">Contratações ativas</p><div className="text-2xl font-bold">{contracts.filter((c) => c.status === "ativo").length}</div></Card>
      </div>

      <Tabs defaultValue="produtos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="contratacoes">Contratações</TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="space-y-4">
          <div className="flex justify-end">
            <Button className="bg-gradient-brand" onClick={() => openProduct()}><Plus className="h-4 w-4 mr-1" /> Novo produto</Button>
          </div>
          {loading ? <Card className="p-12 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Carregando produtos...</Card> : (
            <div className="space-y-3">
              {products.length === 0 && <Card className="p-12 text-center text-muted-foreground"><Package className="h-10 w-10 mx-auto mb-3 opacity-40" /> Nenhum produto cadastrado.</Card>}
              {products.map((product) => {
                const productVersions = versionsByProduct[product.id] || [];
                return (
                  <Card key={product.id} className="p-5 shadow-card">
                    <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                      <div className="h-12 w-12 rounded-lg bg-gradient-brand flex items-center justify-center shrink-0"><Package className="h-6 w-6 text-gold" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-lg">{product.name}</h3>
                          <Badge variant={product.is_active ? "default" : "secondary"}>{product.is_active ? "Ativo" : "Inativo"}</Badge>
                          <Badge variant="outline">{product.category}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">/{product.slug} · ordem {product.sort_order}</p>
                        {product.description && <p className="text-sm text-muted-foreground mt-2">{product.description}</p>}
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Versões</p>
                            <Button size="sm" variant="outline" onClick={() => openVersion(undefined, product.id)}><Plus className="h-3.5 w-3.5 mr-1" /> Nova versão</Button>
                          </div>
                          {productVersions.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center">
                              <p className="text-sm font-semibold">Nenhuma versão cadastrada</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Configuração comercial, encontros, etapas, entregáveis, regras e onboarding pertencem a uma versão.
                                Crie a primeira versão para liberar essas opções.
                              </p>
                              <Button size="sm" className="mt-3 bg-gradient-brand" onClick={() => openVersion(undefined, product.id)}>
                                <Plus className="h-3.5 w-3.5 mr-1" /> Criar primeira versão
                              </Button>
                            </div>
                          ) : productVersions.map((version) => (

                            <div key={version.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
                              <Layers3 className="h-4 w-4 text-primary" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold">{version.version_label}</p>
                                <p className="text-xs text-muted-foreground">{version.methodology_code} · {version.cycle_count} ciclos{version.duration_days ? ` · ${version.duration_days} dias` : ""}</p>
                              </div>
                              <Badge variant={version.is_active ? "default" : "secondary"}>{version.is_active ? "Ativa" : "Inativa"}</Badge>
                              {version.published_at && <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" /> Publicada</Badge>}
                              <Button size="sm" variant="outline" onClick={() => setConfigVersion(version)}><SlidersHorizontal className="h-3.5 w-3.5 mr-1" /> Configuração</Button>
                              <Button size="sm" variant="outline" onClick={() => setTemplateVersion(version)}><ListChecks className="h-3.5 w-3.5 mr-1" /> Onboarding</Button>
                              <Button size="sm" variant="outline" onClick={() => duplicateVersion(version)} disabled={duplicatingId === version.id}>
                                {duplicatingId === version.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Copy className="h-3.5 w-3.5 mr-1" />} Duplicar
                              </Button>
                              {!version.published_at && <Button size="sm" variant="outline" onClick={() => publishVersion(version)}>Publicar</Button>}
                              <Button size="icon" variant="ghost" onClick={() => openVersion(version)} aria-label="Configurar versão"><Pencil className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => setDeleting({ table: "product_versions", id: version.id, title: version.version_label })} aria-label="Excluir versão"><Trash2 className="h-4 w-4 text-destructive" /></Button>

                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openProduct(product)}><Pencil className="h-4 w-4 mr-1" /> Editar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleting({ table: "products", id: product.id, title: product.name })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="contratacoes" className="space-y-4">
          <div className="flex justify-end">
            <Button className="bg-gradient-brand" onClick={() => openContract()} disabled={products.length === 0 || companies.length === 0}><Plus className="h-4 w-4 mr-1" /> Nova contratação</Button>
          </div>
          <div className="space-y-3">
            {contracts.length === 0 && <Card className="p-12 text-center text-muted-foreground"><Boxes className="h-10 w-10 mx-auto mb-3 opacity-40" /> Nenhuma contratação cadastrada.</Card>}
            {contracts.map((contract) => (
              <Card key={contract.id} className="p-5 shadow-card">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-gradient-brand flex items-center justify-center shrink-0"><RefreshCw className="h-6 w-6 text-gold" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">{contract.companies?.name ?? "Empresa"}</h3>
                      <Badge variant="outline">{contract.products?.name ?? "Produto"}</Badge>
                      <Badge variant="secondary">{contract.product_versions?.version_label ?? "Versão"}</Badge>
                      <Badge>{statusLabel[contract.status] ?? contract.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {CYCLE_LABEL[contract.journey_stage]?.label ?? contract.journey_stage} · ciclo operacional {contract.current_cycle}
                      {contract.started_at ? ` · início ${new Date(contract.started_at).toLocaleDateString("pt-BR")}` : ""}
                      {contract.expected_completion ? ` · previsão ${new Date(contract.expected_completion).toLocaleDateString("pt-BR")}` : ""}
                      {contract.access_expires_at ? ` · acesso até ${new Date(`${contract.access_expires_at}T12:00:00`).toLocaleDateString("pt-BR")}` : ""}
                      {contract.onboarding_generated_at ? " · onboarding gerado" : " · onboarding pendente"}
                    </p>
                    {contract.notes && <p className="text-sm text-muted-foreground mt-2">{contract.notes}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => generateOnboarding(contract)} disabled={generatingId === contract.id}>
                      {generatingId === contract.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ListChecks className="h-4 w-4 mr-1" />} Gerar onboarding
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openContract(contract)}><Pencil className="h-4 w-4 mr-1" /> Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting({ table: "contracts", id: contract.id, title: `${contract.companies?.name ?? "Empresa"} · ${contract.products?.name ?? "Produto"}` })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <OnboardingTemplateDialog
        versionId={templateVersion?.id ?? null}
        versionLabel={templateVersion?.version_label ?? ""}
        open={!!templateVersion}
        onOpenChange={(o) => { if (!o) setTemplateVersion(null); }}
      />

      <VersionConfigDialog version={configVersion} onOpenChange={(o) => { if (!o) setConfigVersion(null); }} />


      <Dialog open={productDialog} onOpenChange={setProductDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingProduct ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value, slug: productForm.slug || slugify(e.target.value) })} /></div>
            <div><Label>Slug</Label><Input value={productForm.slug} onChange={(e) => setProductForm({ ...productForm, slug: slugify(e.target.value) })} placeholder="see-4x" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Categoria</Label><Input value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} /></div>
              <div><Label>Ordem</Label><Input type="number" value={productForm.sort_order} onChange={(e) => setProductForm({ ...productForm, sort_order: Number(e.target.value) })} /></div>
            </div>
            <div><Label>Descrição</Label><Textarea rows={3} value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm"><Switch checked={productForm.is_active} onCheckedChange={(v) => setProductForm({ ...productForm, is_active: v })} /> Produto ativo</label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setProductDialog(false)}>Cancelar</Button><Button className="bg-gradient-brand" onClick={saveProduct}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={versionDialog} onOpenChange={setVersionDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingVersion ? "Editar versão" : "Nova versão"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Produto</Label><Select value={versionForm.product_id} onValueChange={(v) => setVersionForm({ ...versionForm, product_id: v })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Nome da versão</Label><Input value={versionForm.version_label} onChange={(e) => setVersionForm({ ...versionForm, version_label: e.target.value })} placeholder="SEE_4X 2026" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Código</Label><Input value={versionForm.methodology_code} onChange={(e) => setVersionForm({ ...versionForm, methodology_code: e.target.value })} /></div>
              <div><Label>Ciclos</Label><Input type="number" min={1} max={24} value={versionForm.cycle_count} onChange={(e) => setVersionForm({ ...versionForm, cycle_count: Number(e.target.value) })} /></div>
              <div><Label>Dias</Label><Input type="number" min={1} value={versionForm.duration_days} onChange={(e) => setVersionForm({ ...versionForm, duration_days: Number(e.target.value) || 0 })} /></div>
            </div>
            <div><Label>Descrição</Label><Textarea rows={3} value={versionForm.description} onChange={(e) => setVersionForm({ ...versionForm, description: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm"><Switch checked={versionForm.is_active} onCheckedChange={(v) => setVersionForm({ ...versionForm, is_active: v })} /> Versão ativa</label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setVersionDialog(false)}>Cancelar</Button><Button className="bg-gradient-brand" onClick={saveVersion}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={contractDialog} onOpenChange={setContractDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingContract ? "Editar contratação" : "Nova contratação"}</DialogTitle>
            <DialogDescription>Vincule uma empresa a um produto e uma versão específica para acompanhar jornadas independentes.</DialogDescription>
          </DialogHeader>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>Empresa</Label><Select value={contractForm.company_id} onValueChange={(v) => setContractForm({ ...contractForm, company_id: v })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Status</Label><Select value={contractForm.status} onValueChange={(v) => setContractForm({ ...contractForm, status: v as typeof CONTRACT_STATUS[number] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CONTRACT_STATUS.map((s) => <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Produto</Label><Select value={contractForm.product_id} onValueChange={selectProductForContract}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Versão</Label><Select value={contractForm.product_version_id} onValueChange={(v) => setContractForm({ ...contractForm, product_version_id: v })} disabled={!contractForm.product_id}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{(versionsByProduct[contractForm.product_id] || []).map((v) => <SelectItem key={v.id} value={v.id}>{v.version_label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Jornada</Label><Select value={contractForm.journey_stage} onValueChange={(v) => setContractForm({ ...contractForm, journey_stage: v as typeof STAGES[number] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{CYCLE_LABEL[s].label} · {CYCLE_LABEL[s].subtitle}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Ciclo operacional</Label><Input type="number" min={1} max={24} value={contractForm.current_cycle} onChange={(e) => setContractForm({ ...contractForm, current_cycle: Number(e.target.value) })} /></div>
            <div><Label>Início</Label><Input type="date" value={contractForm.started_at} onChange={(e) => setContractForm({ ...contractForm, started_at: e.target.value })} /></div>
            <div><Label>Previsão</Label><Input type="date" value={contractForm.expected_completion} onChange={(e) => setContractForm({ ...contractForm, expected_completion: e.target.value })} /></div>
            <div><Label>Conclusão</Label><Input type="date" value={contractForm.completed_at} onChange={(e) => setContractForm({ ...contractForm, completed_at: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Escopo contratado (JSON)</Label><Textarea rows={4} value={contractForm.contracted_scope} onChange={(e) => setContractForm({ ...contractForm, contracted_scope: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Observações</Label><Textarea rows={3} value={contractForm.notes} onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setContractDialog(false)}>Cancelar</Button><Button className="bg-gradient-brand" onClick={saveContract}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover registro?</AlertDialogTitle>
            <AlertDialogDescription>"{deleting?.title}" será removido se não houver dependências vinculadas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={confirmDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}