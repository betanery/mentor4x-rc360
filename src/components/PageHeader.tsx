import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, action, className }: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4 mb-6 lg:mb-8", className)}>
      <div className="min-w-0">
        <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-gold mb-1.5">SEE_4X · RC360</p>
        <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-1.5 text-muted-foreground max-w-2xl">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
