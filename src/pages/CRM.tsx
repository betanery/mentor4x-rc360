import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, Users, CircleDollarSign, Clock3 } from "lucide-react";

const db = supabase as any;

type Contact = {
  id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  event_name: string | null;
  tags: string[];
  notes: string | null;
};

type Opportunity = {
  id: string;
  contact_id: string;
  title: string;
  product: string | null;
  value: number;
  stage: string;
  next_action: string | null;
  next_action_at: string | null;
  crm_contacts: Contact | null;
};

const STAGES = [
  ["novo", "Novo"],
  ["qualificado", "Qualificado"],
  ["diagnostico", "Diagnóstico"],
  ["proposta", "Proposta"],
  ["negociacao", "Negociação"],
  ["ganho", "Ganho"],
  ["perdido", "Perdido"],
  ["recuperacao", "Recuperação"],
] as const;

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function CRM() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    company_name: "",
    email: "",
    phone: "",
    source: "",
    event_name: "",
    tags: "",
    notes: "",
    product: "",
    value: "",
  });

  const load = async () => {
    setLoading(true);
    const [{ data: contactData, error: contactError }, { data: opportunityData, error: opportunityError }] = await Promise.all([
      db.from("crm_contacts").select("*").order("created_at", { ascending: false }),
      db.from("crm_opportunities").select("*, crm_contacts(*)").order("created_at", { ascending: false }),
    ]);

    if (contactError || opportunityError) {
      console.error(contactError || opportunityError);
      toast.error("Não foi possível carregar o CRM.");
    } else {
      setContacts((contactData || []) as Contact[]);
      setOpportunities((opportunityData || []) as Opportunity[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filteredContacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => [c.name, c.company_name, c.email, c.phone, c.source, c.event_name, ...(c.tags || [])]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q)));
  }, [contacts, query]);

  const openValue = opportunities
    .filter((o) => !["ganho", "perdido"].includes(o.stage))
    .reduce((sum, o) => sum + Number(o.value || 0), 0);
  const wonValue = opportunities
    .filter((o) => o.stage === "ganho")
    .reduce((sum, o) => sum + Number(o.value || 0), 0);
  const nextActions = opportunities.filter((o) => o.next_action_at && !["ganho", "perdido"].includes(o.stage)).length;

  const createLead = async () => {
    if (!form.name.trim()) {
      toast.error("Informe o nome do contato.");
      return;
    }
    setSaving(true);
    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const { data: contact, error: contactError } = await db.from("crm_contacts").insert({
      name: form.name.trim(),
      company_name: form.company_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      source: form.source.trim() || null,
      event_name: form.event_name.trim() || null,
      tags,
      notes: form.notes.trim() || null,
      created_by: user?.id || null,
    }).select("*").single();

    if (contactError) {
      setSaving(false);
      toast.error("Erro ao criar contato.");
      return;
    }

    const { error: opportunityError } = await db.from("crm_opportunities").insert({
      contact_id: contact.id,
      title: form.product.trim() ? `${form.product.trim()} · ${form.name.trim()}` : `Oportunidade · ${form.name.trim()}`,
      product: form.product.trim() || null,
      value: Number(form.value.replace(/\./g, "").replace(",", ".")) || 0,
      stage: "novo",
      owner_user_id: user?.id || null,
      created_by: user?.id || null,
    });

    if (opportunityError) {
      toast.error("Contato criado, mas a oportunidade não foi criada.");
    } else {
      toast.success("Lead adicionado ao funil.");
    }

    setForm({ name: "", company_name: "", email: "", phone: "", source: "", event_name: "", tags: "", notes: "", product: "", value: "" });
    setOpen(false);
    setSaving(false);
    load();
  };

  const moveStage = async (id: string, stage: string) => {
    const previous = opportunities;
    setOpportunities((items) => items.map((o) => o.id === id ? { ...o, stage } : o));
    const { error } = await db.from("crm_opportunities").update({ stage }).eq("id", id);
    if (error) {
      setOpportunities(previous);
      toast.error("Não foi possível mover a oportunidade.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CRM Comercial</h1>
          <p className="text-muted-foreground">Captação, oportunidades, follow-up e recuperação em um único lugar.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Novo lead</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Novo lead</DialogTitle></DialogHeader>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Empresa</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
              <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-2"><Label>WhatsApp / telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="space-y-2"><Label>Origem</Label><Input placeholder="Instagram, indicação, LinkB2B..." value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></div>
              <div className="space-y-2"><Label>Evento</Label><Input placeholder="BlindSpot BSB..." value={form.event_name} onChange={(e) => setForm({ ...form, event_name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Produto</Label><Input placeholder="4X Start, Fast, Rotas..." value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} /></div>
              <div className="space-y-2"><Label>Valor estimado</Label><Input placeholder="20000" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
              <div className="space-y-2 md:col-span-2"><Label>Etiquetas</Label><Input placeholder="Inscrito, Show, Campanha LinkB2B" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /><p className="text-xs text-muted-foreground">Separe por vírgulas.</p></div>
              <div className="space-y-2 md:col-span-2"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={createLead} disabled={saving}>{saving ? "Salvando..." : "Adicionar ao funil"}</Button></div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Pipeline aberto</CardTitle><CircleDollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{money.format(openValue)}</div><p className="text-xs text-muted-foreground">{opportunities.filter((o) => !["ganho", "perdido"].includes(o.stage)).length} oportunidades ativas</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Vendas ganhas</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{money.format(wonValue)}</div><p className="text-xs text-muted-foreground">{opportunities.filter((o) => o.stage === "ganho").length} negócios ganhos</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Próximas ações</CardTitle><Clock3 className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{nextActions}</div><p className="text-xs text-muted-foreground">follow-ups programados</p></CardContent></Card>
      </div>

      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList><TabsTrigger value="pipeline">Funil</TabsTrigger><TabsTrigger value="contatos">Contatos</TabsTrigger></TabsList>
        <TabsContent value="pipeline" className="space-y-4">
          {loading ? <p className="text-sm text-muted-foreground">Carregando CRM...</p> : (
            <div className="grid gap-4 xl:grid-cols-4">
              {STAGES.map(([key, label]) => {
                const items = opportunities.filter((o) => o.stage === key);
                const total = items.reduce((sum, o) => sum + Number(o.value || 0), 0);
                return (
                  <div key={key} className="rounded-xl border bg-muted/20 p-3 min-h-48">
                    <div className="mb-3 flex items-center justify-between"><div className="font-semibold text-sm">{label} <Badge variant="secondary" className="ml-1">{items.length}</Badge></div><div className="text-xs text-muted-foreground">{money.format(total)}</div></div>
                    <div className="space-y-3">
                      {items.map((o) => (
                        <Card key={o.id} className="shadow-sm">
                          <CardContent className="p-4 space-y-3">
                            <div><div className="font-semibold text-sm">{o.crm_contacts?.name || o.title}</div><div className="text-xs text-muted-foreground">{o.crm_contacts?.company_name || o.product || "Sem empresa/produto"}</div></div>
                            <div className="flex items-center justify-between"><span className="text-sm font-medium">{money.format(Number(o.value || 0))}</span>{o.product && <Badge variant="outline">{o.product}</Badge>}</div>
                            <Select value={o.stage} onValueChange={(stage) => moveStage(o.id, stage)}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{STAGES.map(([value, text]) => <SelectItem key={value} value={value}>{text}</SelectItem>)}</SelectContent></Select>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
        <TabsContent value="contatos" className="space-y-4">
          <div className="relative max-w-lg"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar por nome, empresa, origem, evento ou etiqueta" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredContacts.map((c) => (
              <Card key={c.id}><CardContent className="p-4 space-y-2"><div><div className="font-semibold">{c.name}</div><div className="text-sm text-muted-foreground">{c.company_name || "Sem empresa"}</div></div><div className="text-xs text-muted-foreground space-y-1">{c.email && <div>{c.email}</div>}{c.phone && <div>{c.phone}</div>}{c.source && <div>Origem: {c.source}</div>}{c.event_name && <div>Evento: {c.event_name}</div>}</div>{c.tags?.length > 0 && <div className="flex flex-wrap gap-1">{c.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}</div>}</CardContent></Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
