import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

type Role = "super_admin" | "mentor" | "estrategista" | "cliente_dono" | "gestor_cliente" | "colaborador_cliente";

export function ProtectedRoute({ children, allow }: { children: JSX.Element; allow?: Role[] }) {
  const { user, roles, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-surface">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (!user) return <Navigate to="/auth" replace />;
  if (allow && !roles.some((r) => allow.includes(r as Role))) {
    return <Navigate to="/" replace />;
  }
  return children;
}
