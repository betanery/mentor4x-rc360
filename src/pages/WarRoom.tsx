import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Sparkles, Save } from "lucide-react";
import { toast } from "sonner";

const BLOCKS = [
  { key: "done", label: "1. O que foi feito", color: "border-success/30 bg-success/5" },
  { key: "blocked", label: "2. O que travou", color: "border-destructive/30 bg-destructive/5" },
  { key: "indicators", label: "3. Indicadores", color: "border-info/30 bg-info/5" },
  { key: "next_steps", label: "4. Próximos passos", color: "border-gold/30 bg-gold/5" },
  { key: "decisions", label: "5. Decisões tomadas", color: "border-primary/30 bg-primary/5" },
];

export default function WarRoom() {
  const { current } = useCompany();
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [review, setReview] = useState<any>({ done: "", blocked: "", indicators: "", next_steps: "", decisions: "", ai_summary: "" });
  const [history, setHistory] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const load = async () => {
    if (!current) return;
    const { data: h } = await supabase.from("weekly_reviews").select("*").eq("company_id", current.id).order("week_start", { ascending: false });
    setHistory(h || []);
    const found = (h || []).find((w) => w.week_start === weekStart);
    if (found) setReview(found);
    else setReview({ done: "", blocked: "", indicators: "", next_steps: "", decisions: "", ai_summary: "" });
  };
  useEffect(() => { load(); }, [current, weekStart]);

  const save = async () => {
    if (!current || !user) return;
    setSaving(true);
    const payload = { company_id: current.id, week_start: weekStart, ...review, created_by: user.id };
    const { error } = await supabase.from("weekly_reviews").upsert(payload, { onConflict: "company_id,week_start" });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Sala de Guerra salva"); load(); }
  };

  const generateAta = async () => {
    if (!current) return;
    setAiLoading(true);
    const { data, error } = await supabase.functions.invoke("ai-action", {
      body: { action: "weekly_summary", company_id: current.id, payload: review },
    });
    setAiLoading(false);
    if (error) { toast.error("Erro ao gerar ata"); return; }
    setReview((r: any) => ({ ...r, ai_summary: data.text }));
    toast.success("Ata gerada pela IA");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sala de Guerra Semanal"
        subtitle="Reunião de cadência: feito, travado, indicadores, próximos passos, decisões."
        action={
          <div className="flex items-center gap-2">
            <Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="w-44" />
            <Button onClick={save} disabled={saving} className="bg-gradient-brand"><Save className="h-4 w-4 mr-1" /> Salvar</Button>
          </div>
        }
      />

      <p className="text-sm text-muted-foreground">Semana de {format(new Date(weekStart), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {BLOCKS.map((b) => (
          <Card key={b.key} className={`p-5 shadow-card border-l-4 ${b.color}`}>
            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{b.label}</Label>
            <Textarea
              className="mt-2 min-h-[140px] resize-none border-0 bg-transparent focus-visible:ring-0 px-0"
              placeholder="Liste aqui..."
              value={(review as any)[b.key] || ""}
              onChange={(e) => setReview({ ...review, [b.key]: e.target.value })}
            />
          </Card>
        ))}
        <Card className="p-5 shadow-card border-l-4 border-gold/40 bg-gradient-to-br from-gold/5 to-transparent">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold uppercase tracking-widest text-gold flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Ata gerada pela IA</Label>
            <Button size="sm" variant="outline" onClick={generateAta} disabled={aiLoading}>
              {aiLoading ? "Gerando..." : "Gerar ata"}
            </Button>
          </div>
          <Textarea
            className="mt-2 min-h-[140px] resize-none border-0 bg-transparent focus-visible:ring-0 px-0"
            placeholder="A ata da reunião aparece aqui após geração pela IA."
            value={review.ai_summary || ""}
            onChange={(e) => setReview({ ...review, ai_summary: e.target.value })}
          />
        </Card>
      </div>

      {history.length > 0 && (
        <div>
          <h3 className="text-lg font-bold mt-8 mb-3">Histórico semanal</h3>
          <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {history.map((h) => (
              <button key={h.id} onClick={() => setWeekStart(h.week_start)}
                className={`p-3 rounded-lg text-left text-xs border transition-all hover:border-gold ${h.week_start === weekStart ? "border-gold bg-gold/10" : "border-border bg-card"}`}>
                <div className="font-bold">{format(new Date(h.week_start), "dd MMM", { locale: ptBR })}</div>
                <div className="text-muted-foreground mt-1">Semana</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
