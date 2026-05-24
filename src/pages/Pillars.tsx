import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PILLAR_LABEL } from "@/lib/labels";
import { Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from "recharts";

export default function Pillars() {
  const { current } = useCompany();
  const { isStaff } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ pillar: "crescimento", score: 70, blind_spots: "", recommendations: "" });

  const { data: scores = [] } = useQuery({
    queryKey: ["pillar_scores", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data } = await supabase.from("pillar_scores").select("*").eq("company_id", current!.id).order("measured_at", { ascending: false });
      return data || [];
    },
  });
  const { data: goals = [] } = useQuery({
    queryKey: ["goals_for_pillars", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data } = await supabase.from("goals").select("pillar,status").eq("company_id", current!.id);
      return data || [];
    },
  });

  const mut = useMutation({
    mutationFn: async () => {
      if (!current) throw new Error("Sem empresa");
      if (form.score < 0 || form.score > 100) throw new Error("Score deve estar entre 0 e 100");
      const { error } = await supabase.from("pillar_scores").insert({
        company_id: current.id,
        pillar: form.pillar as any,
        score: form.score,
        blind_spots: form.blind_spots || null,
        recommendations: form.recommendations || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pillar_scores"] });
      toast.success("Score registrado");
      setOpen(false);
      setForm({ pillar: "crescimento", score: 70, blind_spots: "", recommendations: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const latest = (key: string) => scores.find((s: any) => s.pillar === key);
  const evolution = (key: string) => scores.filter((s: any) => s.pillar === key).slice(0, 6).reverse();

  const radarData = Object.entries(PILLAR_LABEL).map(([k, p]) => ({
    pillar: p.label,
    atual: latest(k)?.score || 0,
    meta: 80,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader title="Pilares 4X" subtitle="Crescimento, Eficiência, Encantamento e Liderança — os quatro eixos do método." />
        {isStaff && current && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-brand"><Plus className="h-4 w-4 mr-2" /> Lançar score</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo score de pilar</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Pilar</Label>
                  <Select value={form.pillar} onValueChange={(v) => setForm({ ...form, pillar: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PILLAR_LABEL).map(([k, p]) => <SelectItem key={k} value={k}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Score (0-100)</Label>
                  <Input type="number" min={0} max={100} value={form.score} onChange={(e) => setForm({ ...form, score: parseInt(e.target.value) || 0 })} />
                </div>
                <div><Label>Pontos cegos</Label>
                  <Textarea value={form.blind_spots} onChange={(e) => setForm({ ...form, blind_spots: e.target.value })} placeholder="O que está invisível ao gestor..." />
                </div>
                <div><Label>Recomendações</Label>
                  <Textarea value={form.recommendations} onChange={(e) => setForm({ ...form, recommendations: e.target.value })} placeholder="Próximas ações sugeridas..." />
                </div>
                <Button className="w-full bg-gradient-brand" disabled={mut.isPending} onClick={() => mut.mutate()}>
                  {mut.isPending ? "Salvando..." : "Salvar score"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {scores.length > 0 && (
        <Card className="p-6 shadow-card">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Radar atual vs meta</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="pillar" tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar name="Meta" dataKey="meta" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground))" fillOpacity={0.1} />
                <Radar name="Atual" dataKey="atual" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.5} />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(PILLAR_LABEL).map(([key, p]) => {
          const latestScore = latest(key);
          const score = latestScore?.score || 0;
          const pillarGoals = goals.filter((g: any) => g.pillar === key);
          const completed = pillarGoals.filter((g: any) => g.status === "concluido").length;
          const evol = evolution(key);

          return (
            <Card key={key} className="shadow-card overflow-hidden">
              <div className={`p-6 bg-gradient-to-br ${p.color} text-white relative`}>
                <div className="absolute -top-10 -right-10 h-32 w-32 bg-white/10 rounded-full blur-2xl" />
                <p className="text-[10px] font-bold tracking-widest opacity-80 uppercase">Pilar</p>
                <h2 className="text-3xl font-black mt-1">{p.label}</h2>
                <p className="text-sm opacity-90 mt-1">{p.description}</p>
                <div className="mt-6 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase opacity-80">Score atual</p>
                    <div className="text-6xl font-black leading-none">{score}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-bold">{pillarGoals.length} metas</div>
                    <div className="opacity-80">{completed} concluídas</div>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Evolução</p>
                  <div className="flex items-end gap-1.5 h-16">
                    {evol.length > 0 ? evol.map((s: any, i: number) => (
                      <div key={i} className="flex-1 bg-gradient-to-t from-royal to-gold rounded-t" style={{ height: `${s.score}%` }} title={`${s.score}`} />
                    )) : <p className="text-xs text-muted-foreground">Sem histórico ainda.</p>}
                  </div>
                </div>

                {latestScore?.blind_spots && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Pontos cegos</p>
                    <p className="text-sm">{latestScore.blind_spots}</p>
                  </div>
                )}
                {latestScore?.recommendations && (
                  <div className="p-3 bg-gold/10 rounded-lg border border-gold/20">
                    <p className="text-xs font-bold uppercase tracking-widest text-gold mb-1">Recomendações</p>
                    <p className="text-sm">{latestScore.recommendations}</p>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
