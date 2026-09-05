import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";

type Role = "super_admin" | "mentor" | "estrategista" | "cliente_dono" | "gestor_cliente" | "colaborador_cliente" | "company_responsible" | "company_leader";

export function ProtectedRoute({ children, allow }: { children: JSX.Element; allow?: Role[] }) {
  const { user, roles, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-surface">
      <Logo />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Carregando seu acesso...
      </div>
    </div>
  );
  if (!user) return <Navigate to="/auth" replace />;
  if (allow && !roles.some((r) => allow.includes(r as Role))) {
    return <Navigate to="/" replace />;
  }
  return children;
}
