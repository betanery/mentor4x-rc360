import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LayoutDashboard, Target, AlertTriangle, Compass, Map, Swords, Users, Briefcase, GraduationCap, Sparkles, FileText, Award, LogOut, Bell, Menu, X, Building2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ROLE_LABEL } from "@/lib/labels";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/jornada", label: "Jornada 4 Meses", icon: Map },
  { to: "/metas", label: "Metas", icon: Target },
  { to: "/gargalos", label: "Top 5 Gargalos", icon: AlertTriangle },
  { to: "/pilares", label: "Pilares 4X", icon: Compass },
  { to: "/sala-guerra", label: "Sala de Guerra", icon: Swords },
  { to: "/universidade", label: "Universidade 4X", icon: GraduationCap },
  { to: "/socio-ia", label: "Meu Sócio IA", icon: Sparkles, highlight: true },
  { to: "/relatorios", label: "Relatórios", icon: FileText },
  { to: "/certificados", label: "Certificação", icon: Award },
];

const STAFF_NAV = [
  { to: "/mentor", label: "Área do Mentor", icon: Users, role: ["super_admin","mentor"] as const },
  { to: "/estrategista", label: "Área Estrategista", icon: Briefcase, role: ["super_admin","mentor","estrategista"] as const },
  { to: "/empresas", label: "Empresas", icon: Building2, role: ["super_admin","mentor","estrategista"] as const },
];

export function AppLayout() {
  const { user, signOut, roles, isStaff } = useAuth();
  const { companies, current, setCurrentId } = useCompany();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const initial = (user?.email || "?")[0].toUpperCase();
  const visibleStaff = STAFF_NAV.filter(n => n.role.some(r => roles.includes(r as any)));

  return (
    <div className="min-h-screen bg-gradient-surface flex">
      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:sticky top-0 left-0 z-40 h-screen w-72 bg-sidebar text-sidebar-foreground flex-col transition-transform shrink-0",
        open ? "flex translate-x-0" : "hidden lg:flex -translate-x-full lg:translate-x-0"
      )}>
        <div className="p-6 border-b border-sidebar-border flex items-center justify-between">
          <Logo dark />
          <Button variant="ghost" size="icon" className="lg:hidden text-sidebar-foreground" onClick={() => setOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {(companies.length > 1 || isStaff) && (
          <div className="p-4 border-b border-sidebar-border space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/60 block">Empresa</label>
            {companies.length > 0 && (
              <Select value={current?.id} onValueChange={setCurrentId}>
                <SelectTrigger className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground"><SelectValue /></SelectTrigger>
                <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {isStaff && (
              <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => { setOpen(false); nav("/empresas"); }}>
                <Building2 className="h-4 w-4 mr-2" /> Nova empresa
              </Button>
            )}
          </div>
        )}

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"} onClick={() => setOpen(false)}
              className={({ isActive }) => cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-gradient-to-r from-gold to-gold-soft text-primary shadow-gold"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                item.highlight && "ring-1 ring-gold/30"
              )}>
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}

          {visibleStaff.length > 0 && (
            <div className="pt-4 mt-4 border-t border-sidebar-border">
              <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/50 mb-2">Operação</p>
              {visibleStaff.map((item) => (
                <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                    isActive ? "bg-sidebar-accent text-gold" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="text-xs text-sidebar-foreground/60 italic">"O céu não é o limite."</div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 glass border-b border-border h-16 flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            {current && (
              <div>
                <div className="text-xs text-muted-foreground">Empresa ativa</div>
                <div className="font-semibold text-sm">{current.name}</div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => nav("/notificacoes")}>
              <Bell className="h-5 w-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <Avatar className="h-8 w-8"><AvatarFallback className="bg-gradient-brand text-primary-foreground font-semibold">{initial}</AvatarFallback></Avatar>
                  <div className="text-left hidden sm:block">
                    <div className="text-sm font-semibold leading-tight">{user?.email?.split("@")[0]}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight">{roles.map(r => ROLE_LABEL[r]).join(" · ") || "Sem role"}</div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isStaff && <DropdownMenuItem onClick={() => nav("/admin/usuarios")}>Gerenciar usuários</DropdownMenuItem>}
                <DropdownMenuItem onClick={signOut} className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
