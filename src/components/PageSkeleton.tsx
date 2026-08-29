import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

/**
 * Skeleton padrão de carregamento das telas do Mentor 4X.
 * Mantém a mesma silhueta do conteúdo real (cards + lista) para evitar salto de layout.
 */
export function PageSkeleton({ cards = 4, rows = 3 }: { cards?: number; rows?: number }) {
  return (
    <div className="space-y-6" role="status" aria-label="Carregando conteúdo">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: cards }).map((_, i) => (
          <Card key={i} className="p-5 space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-2 w-full" />
          </Card>
        ))}
      </div>
      <Card className="p-5 space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </Card>
    </div>
  );
}
