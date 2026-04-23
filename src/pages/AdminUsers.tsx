import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABEL } from "@/lib/labels";
import { Mail, UserPlus, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";

const ROLES = ["super_admin","mentor","estrategista","cliente_dono","gestor_cliente","colaborador_cliente"] as const;
const CLIENT_ROLES = ["cliente_dono","gestor_cliente","colaborador_cliente"];

export default function AdminUsers() {
  const { isStaff, hasRole } = useAuth();
  const { current, companies: ctxCompanies } = useCompany();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [form, setForm] = useState({ full_name: "", email: "", role: "cliente_dono" as typeof ROLES[number], company_id: "" });

  const load = async () => {
    const [p, r, c, m] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("*"),
      supabase.from("companies").select("id, name"),
      supabase.from("company_members").select("user_id, company_id, member_role"),
    ]);
    setProfiles(p.data || []); setRoles(r.data || []); setCompanies(c.data || []); setMembers(m.data || []);
  };
  useEffect(() => { load(); }, []);

  // Auto-fill company when dialog opens
  useEffect(() => {
    if (open && !form.company_id && current?.id) {
      setForm((f) => ({ ...f, company_id: current.id }));
    }
  }, [open, current?.id]);

  const rolesOf = (uid: string) => roles.filter((r) => r.user_id === uid).map((r) => r.role);
  const companiesOf = (uid: string) => members.filter((m) => m.user_id === uid).map((m) => companies.find((c) => c.id === m.company_id)?.name).filter(Boolean);

  const filtered = useMemo(() => profiles.filter((p) => {
    const rs = roles.filter((r) => r.user_id === p.user_id).map((r) => r.role);
    const cs = members.filter((m) => m.user_id === p.user_id).map((m) => m.company_id);
    if (filterRole !== "all" && !rs.includes(filterRole)) return false;
    if (filterCompany !== "all" && !cs.includes(filterCompany)) return false;
    return true;
  }), [profiles, roles, members, filterRole, filterCompany]);

  if (!isStaff) return <Navigate to="/" replace />;

  const isClientRole = CLIENT_ROLES.includes(form.role);
  const canSubmit = form.full_name.trim().length >= 2 && /\S+@\S+\.\S+/.test(form.email) && (!isClientRole || !!form.company_id);

  const invite = async (resend = false) => {
    setSending(true);
    const payload = {
      email: form.email.trim().toLowerCase(),
      full_name: form.full_name.trim(),
      role: form.role,
      company_id: form.company_id || null,
      resend,
    };
    const { data, error } = await supabase.functions.invoke("admin-invite", { body: payload });
    setSending(false);
    if (error || data?.error) { toast.error(data?.error || error?.message || "Falha ao enviar convite"); return; }
    toast.success(resend
      ? `Convite reenviado para ${payload.email}`
      : `Convite enviado para ${payload.email}. Ele receberá um link para definir a senha.`);
    setOpen(false);
    setForm({ full_name: "", email: "", role: "cliente_dono", company_id: current?.id || "" });
    load();
  };

  const resendFor = async (email: string) => {
    const { data, error } = await supabase.functions.invoke("admin-invite", {
      body: { email, full_name: profiles.find((p) => p.user_id)?.full_name || email, role: "cliente_dono", company_id: null, resend: true },
    });
    if (error || data?.error) { toast.error(data?.error || error?.message); return; }
    toast.success(`Convite reenviado para ${email}`);
  };

  const filtered = useMemo(() => profiles.filter((p) => {
    const rs = rolesOf(p.user_id);
    const cs = members.filter((m) => m.user_id === p.user_id).map((m) => m.company_id);
    if (filterRole !== "all" && !rs.includes(filterRole)) return false;
    if (filterCompany !== "all" && !cs.includes(filterCompany)) return false;
    return true;
  }), [profiles, roles, members, filterRole, filterCompany]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gerenciar usuários"
        subtitle="Convide novos usuários por email, atribua papéis e vincule a empresas."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-brand"><UserPlus className="h-4 w-4 mr-1" /> Convidar usuário</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convidar novo usuário</DialogTitle>
                <DialogDescription>O convidado receberá um email com link para acessar e definir a própria senha.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Nome completo</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Ex: Maria Silva" />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@empresa.com" />
                </div>
                <div>
                  <Label>Papel</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as typeof ROLES[number] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r} disabled={r === "super_admin" && !hasRole("super_admin")}>
                          {ROLE_LABEL[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Empresa {isClientRole ? <span className="text-destructive">*</span> : <span className="text-muted-foreground text-xs">(opcional para staff)</span>}</Label>
                  <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione uma empresa..." /></SelectTrigger>
                    <SelectContent>
                      {(ctxCompanies.length ? ctxCompanies : companies).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}{current?.id === c.id ? " (atual)" : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isClientRole && !form.company_id && (
                    <p className="text-xs text-destructive mt-1">Clientes precisam estar vinculados a uma empresa.</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => invite(false)} disabled={!canSubmit || sending} className="bg-gradient-brand">
                  {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                  Enviar convite
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="p-4 shadow-card">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs">Filtrar por papel</Label>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os papéis</SelectItem>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs">Filtrar por empresa</Label>
            <Select value={filterCompany} onValueChange={setFilterCompany}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-6 shadow-card">
        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum usuário encontrado com esses filtros.</p>
          )}
          {filtered.map((p) => {
            const userRoles = rolesOf(p.user_id);
            const userCompanies = companiesOf(p.user_id);
            return (
              <div key={p.user_id} className="flex items-center gap-4 p-3 rounded-lg border border-border">
                <div className="h-10 w-10 rounded-full bg-gradient-brand text-primary-foreground font-bold flex items-center justify-center shrink-0">
                  {(p.full_name || "?")[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{p.full_name || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {userCompanies.length ? userCompanies.join(" · ") : "Sem empresa vinculada"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1 justify-end">
                  {userRoles.map((r) => <Badge key={r} variant="secondary">{ROLE_LABEL[r]}</Badge>)}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <p className="text-xs text-muted-foreground flex items-center gap-2">
        <Mail className="h-3 w-3" /> Convites são enviados por email com link único. Validade: 24h.
      </p>
    </div>
  );
}
