import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABEL } from "@/lib/labels";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";

const ROLES = ["super_admin","mentor","estrategista","cliente_dono","gestor_cliente","colaborador_cliente"] as const;

export default function AdminUsers() {
  const { isStaff, hasRole } = useAuth();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", role: "cliente_dono", company_id: "" });

  const load = async () => {
    const [p, r, c] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("*"),
      supabase.from("companies").select("id, name"),
    ]);
    setProfiles(p.data || []); setRoles(r.data || []); setCompanies(c.data || []);
  };
  useEffect(() => { load(); }, []);

  if (!isStaff) return <Navigate to="/" replace />;

  const invite = async () => {
    const { data, error } = await supabase.functions.invoke("admin-invite", {
      body: { email: form.email, password: form.password, role: form.role, company_id: form.company_id || null },
    });
    if (error || data?.error) { toast.error(data?.error || error?.message); return; }
    toast.success("Usuário convidado com sucesso");
    setOpen(false);
    setForm({ email: "", password: "", role: "cliente_dono", company_id: "" });
    load();
  };

  const rolesOf = (uid: string) => roles.filter((r) => r.user_id === uid).map((r) => r.role);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gerenciar usuários"
        subtitle="Convide novos usuários, atribua papéis e vincule a empresas."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-gradient-brand"><UserPlus className="h-4 w-4 mr-1" /> Convidar usuário</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Convidar novo usuário</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Senha temporária</Label><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="mín. 6 caracteres" /></div>
                <div>
                  <Label>Papel</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r} disabled={r === "super_admin" && !hasRole("super_admin")}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Empresa (opcional para staff)</Label>
                  <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button onClick={invite} disabled={!form.email || form.password.length < 6}>Convidar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="p-6 shadow-card">
        <div className="space-y-2">
          {profiles.map((p) => (
            <div key={p.user_id} className="flex items-center gap-4 p-3 rounded-lg border border-border">
              <div className="h-10 w-10 rounded-full bg-gradient-brand text-primary-foreground font-bold flex items-center justify-center">{(p.full_name || "?")[0]}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{p.full_name}</p>
                <p className="text-xs text-muted-foreground">ID: {p.user_id.slice(0, 8)}...</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {rolesOf(p.user_id).map((r) => <Badge key={r} variant="secondary">{ROLE_LABEL[r]}</Badge>)}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
