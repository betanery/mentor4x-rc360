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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROLE_LABEL } from "@/lib/labels";
import { Mail, UserPlus, Send, Loader2, RotateCw, CheckCircle2, Clock, AlertTriangle, History } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";

const ROLES = ["super_admin","mentor","estrategista","cliente_dono","gestor_cliente","colaborador_cliente"] as const;
const CLIENT_ROLES = ["cliente_dono","gestor_cliente","colaborador_cliente"];

type AuthStatus = "confirmado" | "pendente" | "expirado";
type AdminUser = {
  id: string;
  email: string;
  status: AuthStatus;
  invited_at: string | null;
  confirmed_at: string | null;
  last_sign_in_at: string | null;
  profile: { full_name: string | null; avatar_url: string | null } | null;
  roles: string[];
  memberships: { company_id: string; member_role: string; company?: { id: string; name: string } | null }[];
};
type Company = { id: string; name: string };

const STATUS_LABEL: Record<AuthStatus, string> = { confirmado: "Confirmado", pendente: "Convite pendente", expirado: "Convite expirado" };
const STATUS_VARIANT: Record<AuthStatus, "default" | "secondary" | "destructive" | "outline"> = {
  confirmado: "default", pendente: "secondary", expirado: "destructive",
};
const STATUS_ICON: Record<AuthStatus, typeof CheckCircle2> = { confirmado: CheckCircle2, pendente: Clock, expirado: AlertTriangle };

const AUDIT_LABEL: Record<string, string> = {
  enviado: "Enviado", reenviado: "Reenviado", aceito: "Aceito", expirado: "Expirado", falhou: "Falhou",
};
const AUDIT_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  enviado: "secondary", reenviado: "outline", aceito: "default", expirado: "destructive", falhou: "destructive",
};

export default function AdminUsers() {
  const { isStaff, hasRole } = useAuth();
  const { current, companies: ctxCompanies } = useCompany();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [form, setForm] = useState({ full_name: "", email: "", role: "cliente_dono" as typeof ROLES[number], company_id: "" });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-list-users", { body: {} });
    setLoading(false);
    if (error || data?.error) { toast.error(data?.error || error?.message || "Falha ao carregar usuários"); return; }
    setUsers(data.users || []);
    setCompanies(data.companies || []);
    setAudit(data.audit || []);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (open && !form.company_id && current?.id) {
      setForm((f) => ({ ...f, company_id: current.id }));
    }
  }, [open, current?.id]);

  const filtered = useMemo(() => users.filter((u) => {
    if (filterRole !== "all" && !u.roles.includes(filterRole)) return false;
    if (filterCompany !== "all" && !u.memberships.some((m) => m.company_id === filterCompany)) return false;
    if (filterStatus !== "all" && u.status !== filterStatus) return false;
    return true;
  }), [users, filterRole, filterCompany, filterStatus]);

  if (!isStaff) return <Navigate to="/" replace />;

  const isClientRole = CLIENT_ROLES.includes(form.role);
  const canSubmit = form.full_name.trim().length >= 2 && /\S+@\S+\.\S+/.test(form.email) && (!isClientRole || !!form.company_id);

  const invite = async () => {
    setSending(true);
    const payload = {
      email: form.email.trim().toLowerCase(),
      full_name: form.full_name.trim(),
      role: form.role,
      company_id: form.company_id || null,
    };
    const { data, error } = await supabase.functions.invoke("admin-invite", { body: payload });
    setSending(false);
    if (error || data?.error) { toast.error(data?.error || error?.message || "Falha ao enviar convite"); return; }
    toast.success(`Convite enviado para ${payload.email}. Ele receberá um link para definir a senha.`);
    setOpen(false);
    setForm({ full_name: "", email: "", role: "cliente_dono", company_id: current?.id || "" });
    load();
  };

  const resendInvite = async (u: AdminUser) => {
    if (!u.email) { toast.error("Email do usuário não encontrado"); return; }
    const role = u.roles[0] || "cliente_dono";
    setResendingId(u.id);
    const { data, error } = await supabase.functions.invoke("admin-invite", {
      body: { email: u.email, full_name: u.profile?.full_name || u.email, role, company_id: null, resend: true },
    });
    setResendingId(null);
    if (error || data?.error) { toast.error(data?.error || error?.message); return; }
    toast.success(`Convite reenviado para ${u.email}`);
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gerenciar usuários"
        subtitle="Convide usuários por email, atribua papéis, vincule a empresas e acompanhe o status."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-brand"><UserPlus className="h-4 w-4 mr-1" /> Convidar usuário</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convidar novo usuário</DialogTitle>
                <DialogDescription>O convidado receberá um email com link único para acessar e definir a própria senha. Validade: 24h.</DialogDescription>
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
                <Button onClick={invite} disabled={!canSubmit || sending} className="bg-gradient-brand">
                  {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                  Enviar convite
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="audit"><History className="h-3 w-3 mr-1" /> Auditoria de convites</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card className="p-4 shadow-card">
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Papel</Label>
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os papéis</SelectItem>
                    {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Empresa</Label>
                <Select value={filterCompany} onValueChange={setFilterCompany}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="confirmado">Confirmados</SelectItem>
                    <SelectItem value="pendente">Convite pendente</SelectItem>
                    <SelectItem value="expirado">Convite expirado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <Card className="p-6 shadow-card">
            <div className="space-y-2">
              {loading && (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando usuários...
                </div>
              )}
              {!loading && filtered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum usuário encontrado.</p>
              )}
              {!loading && filtered.map((u) => {
                const StatusIcon = STATUS_ICON[u.status];
                const canResend = u.status === "pendente" || u.status === "expirado";
                const companyNames = u.memberships.map((m) => m.company?.name).filter(Boolean);
                const displayName = u.profile?.full_name || u.email;
                return (
                  <div key={u.id} className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border">
                    <div className="h-10 w-10 rounded-full bg-gradient-brand text-primary-foreground font-bold flex items-center justify-center shrink-0">
                      {(displayName || "?")[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {u.email} · {companyNames.length ? companyNames.join(" · ") : "Sem empresa"}
                      </p>
                    </div>
                    <Badge variant={STATUS_VARIANT[u.status]} className="gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {STATUS_LABEL[u.status]}
                    </Badge>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => <Badge key={r} variant="outline">{ROLE_LABEL[r]}</Badge>)}
                    </div>
                    {canResend && (
                      <Button size="sm" variant="ghost" onClick={() => resendInvite(u)} disabled={resendingId === u.id}>
                        {resendingId === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3 mr-1" />}
                        Reenviar
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card className="p-6 shadow-card">
            <div className="space-y-2">
              {audit.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum convite registrado ainda.</p>
              )}
              {audit.map((a) => {
                const company = companies.find((c) => c.id === a.company_id);
                const inviter = users.find((u) => u.id === a.invited_by);
                return (
                  <div key={a.id} className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border text-sm">
                    <Badge variant={AUDIT_VARIANT[a.status] || "secondary"}>{AUDIT_LABEL[a.status] || a.status}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{a.email} · <span className="text-muted-foreground font-normal">{ROLE_LABEL[a.role]}</span></p>
                      <p className="text-xs text-muted-foreground truncate">
                        {company?.name || "Sem empresa"} · convidado por {inviter?.profile?.full_name || inviter?.email || "—"}
                        {a.error_message && <span className="text-destructive"> · {a.error_message}</span>}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(a.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground flex items-center gap-2">
        <Mail className="h-3 w-3" /> Convites por email com link único · validade 24h · log de auditoria completo
      </p>
    </div>
  );
}
