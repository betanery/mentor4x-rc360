import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="max-w-md text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Erro 404</p>
        <h1 className="mt-2 text-3xl font-black">Página não encontrada</h1>
        <p className="mt-3 text-muted-foreground">
          Este endereço não faz parte do Mentor 4X ou não está mais disponível.
        </p>
        <Button asChild className="mt-6 bg-gradient-brand">
          <Link to="/">Voltar ao Dashboard</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
