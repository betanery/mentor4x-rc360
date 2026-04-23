import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({ label, value, sub, icon: Icon, accent = "primary", className }: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: any;
  accent?: "primary" | "gold" | "success" | "warning" | "destructive" | "info";
  className?: string;
}) {
  const accentMap = {
    primary: "from-primary/10 to-royal/5 text-primary",
    gold: "from-gold/15 to-gold-soft/10 text-gold",
    success: "from-success/15 to-success/5 text-success",
    warning: "from-warning/15 to-warning/5 text-warning",
    destructive: "from-destructive/15 to-destructive/5 text-destructive",
    info: "from-info/15 to-info/5 text-info",
  } as const;

  return (
    <Card className={cn("p-5 shadow-card border-border/60 hover:shadow-elegant transition-all duration-300 hover:-translate-y-0.5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
          <div className="mt-1.5 text-3xl font-black tracking-tight text-foreground truncate">{value}</div>
          {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
        </div>
        {Icon && (
          <div className={cn("h-11 w-11 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0", accentMap[accent])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </Card>
  );
}
