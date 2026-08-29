import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Estado vazio padrão do Mentor 4X: ícone, frase completa e ação sugerida.
 * Use sempre que uma lista, aba ou painel não tiver dados para exibir.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <Card className={cn("text-center border-dashed", compact ? "p-6" : "p-10", className)}>
      <Icon className="h-9 w-9 mx-auto mb-3 text-muted-foreground opacity-50" aria-hidden="true" />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-1.5 text-sm text-muted-foreground max-w-md mx-auto">{description}</p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </Card>
  );
}
