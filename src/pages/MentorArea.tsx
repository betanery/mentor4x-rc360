import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CHAOS_LABEL, STAGE_LABEL, formatBRL } from "@/lib/labels";
import { Building2, AlertTriangle, TrendingDown, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { useCompany } from "@/hooks/useCompany";

export default function MentorArea() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const { setCurrentId } = useCompany();

  useEffect(() => {
    (async () => {
      const { data: cs } = await supabase.from("companies").select("*").order("name");
      setCompanies(cs || []);
      const { data: goals } = await supabase.from("goals").select("company_id, status");
      const lateByCompany: Record<string, number> = {};
      (goals || []).forEach((g: any) => {
        if (g.status === "atrasado") lateByCompany[g.company_id] = (lateByCompany[g.company_id] || 0) + 1;
      });
      setStats({ lateByCompany });
    })();
  }, []);

  const atRisk = companies.filter((c) => ["total","severo"].includes(c.chaos_level));

  return (
    <div className="space-y-6">
      <PageHeader title="Área do Mentor" subtitle="Visão consolidada de todos os clientes da mentoria." />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-3"><Building2 className="h-5 w-5 text-royal" /><span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Clientes ativos</span></div>
          <div className="mt-2 text-4xl font-black">{companies.length}</div>
        </Card>
        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-destructive" /><span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Em risco</span></div>
          <div className="mt-2 text-4xl font-black text-destructive">{atRisk.length}</div>
        </Card>
        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-3"><TrendingDown className="h-5 w-5 text-warning" /><span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Score médio</span></div>
          <div className="mt-2 text-4xl font-black">{companies.length ? Math.round(companies.reduce((s, c) => s + c.overall_score, 0) / companies.length) : 0}</div>
        </Card>
      </div>

      <Card className="p-6 shadow-card">
        <h3 className="text-lg font-bold mb-4">Carteira de clientes</h3>
        <div className="space-y-2">
          {companies.map((c) => {
            const chaos = CHAOS_LABEL[c.chaos_level];
            const stage = STAGE_LABEL[c.journey_stage];
            const lateGoals = stats.lateByCompany?.[c.id] || 0;
            return (
              <Link key={c.id} to="/" onClick={() => setCurrentId(c.id)}
                className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-lg border border-border hover:border-gold hover:shadow-card transition-all">
                <div className="h-12 w-12 rounded-xl bg-gradient-brand text-primary-foreground font-black flex items-center justify-center shrink-0">
                  {c.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold">{c.name}</h4>
                    <Badge className={chaos.color} variant="secondary">{chaos.label}</Badge>
                    <Badge variant="outline">{stage.label} · {stage.subtitle}</Badge>
                    {lateGoals > 0 && <Badge variant="destructive">{lateGoals} metas atrasadas</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{c.segment} · Receita projetada {formatBRL(c.projected_revenue)}</p>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Score</div><div className="font-black text-xl">{c.overall_score}</div></div>
                  <div><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Dependência</div><div className="font-black text-xl text-warning">{c.owner_dependency}%</div></div>
                </div>
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
