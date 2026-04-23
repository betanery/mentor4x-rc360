import { cn } from "@/lib/utils";

export function Logo({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative h-9 w-9 rounded-xl bg-gradient-brand flex items-center justify-center shadow-elegant">
        <span className="font-black text-gold text-lg leading-none">4X</span>
        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-gold shadow-gold" />
      </div>
      <div className="leading-tight">
        <div className={cn("font-black text-base tracking-tight", dark ? "text-primary-foreground" : "text-foreground")}>MENTOR</div>
        <div className="text-[10px] font-bold tracking-[0.3em] text-gold -mt-0.5">PREMIUM 4X</div>
      </div>
    </div>
  );
}
