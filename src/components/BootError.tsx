import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Tela de fallback para falhas de inicialização (ex.: conexão com o servidor indisponível). */
export function BootError({ detail }: { detail?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-surface p-6">
      <div className="max-w-md w-full rounded-xl border border-border bg-card p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Não foi possível conectar ao servidor</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O Mentor 4X não conseguiu iniciar a conexão com os seus dados. Recarregue a página; se o problema
          continuar, avise a equipe RC360.
        </p>
        {detail ? (
          <p className="mt-3 text-xs text-muted-foreground/80 break-words">{detail}</p>
        ) : null}
        <Button className="mt-6" onClick={() => window.location.reload()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Recarregar
        </Button>
      </div>
    </div>
  );
}
