import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useContract } from "@/hooks/useContract";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Plus, BarChart3, ArrowRight, CalendarRange } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";

export default function Reports() {
  const { current } = useCompany();
  const { currentContract } = useContract();
  const navigate = useNavigate();
  const [reports, setReports] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!current) {
      setReports([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let query = supabase.from("reports").select("*").eq("company_id", current.id).order("created_at", { ascending: false });
    query = currentContract ? query.eq("contract_id", currentContract.id) : query.is("contract_id", null);
    const { data } = await query;
    setReports(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [current, currentContract]);

  const generate = async () => {
    if (!current) return;
    setGenerating(true);
    const { error } = await supabase.functions.invoke("ai-action", {
      body: { action: "monthly_report", company_id: current.id, contract_id: currentContract?.id },
    });
    setGenerating(false);
    if (error) { toast.error("Erro ao gerar relatório"); return; }
    toast.success("Relatório mensal gerado em PDF");
    load();
  };

  const download = async (path: string, title: string) => {
    const { data, error } = await supabase.storage.from("reports").createSignedUrl(path, 300);
    if (error || !data) { toast.error("Não foi possível abrir o PDF"); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl; a.download = `${title}.pdf`; a.target = "_blank";
    document.body.appendChild(a); a.click(); a.remove();
  };

  const isSee4XReport = (title?: string | null) => (title || "").toLowerCase().startsWith("relatório see_4x") || (title || "").toLowerCase().startsWith("relatorio see_4x");
  const monthlyReports = reports.filter((r) => !isSee4XReport(r.title));
  const see4xReports = reports.filter((r) => isSee4XReport(r.title));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios"
        subtitle="Uma única área para acompanhar a operação mensal e comprovar a evolução SEE_4X da empresa."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5 shadow-card border-primary/20">
          <div className="flex items-start gap-4">
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <CalendarRange className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Acompanhamento</p>
              <h2 className="mt-1 text-lg font-bold">Relatório mensal</h2>
              <p className="mt-1 text-sm text-muted-foreground">Consolida diagnóstico, metas, execução e evolução do período para acompanhamento recorrente.</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button onClick={generate} disabled={!current || generating} className="bg-gradient-brand">
                  <Plus className="h-4 w-4 mr-1" /> {generating ? "Gerando..." : "Gerar relatório mensal"}
                </Button>
                <span className="text-xs text-muted-foreground">{monthlyReports.length} gerado{monthlyReports.length === 1 ? "" : "s"}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5 shadow-card border-gold/30">
          <div className="flex items-start gap-4">
            <div className="h-11 w-11 rounded-xl bg-gold/15 flex items-center justify-center shrink-0">
              <BarChart3 className="h-5 w-5 text-gold" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Evolução estratégica</p>
              <h2 className="mt-1 text-lg font-bold">Antes e Depois SEE_4X</h2>
              <p className="mt-1 text-sm text-muted-foreground">Compara diagnóstico baseline e follow-up, mostra indicadores 4X e consolida o Plano de 90 dias.</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => navigate("/relatorio-see4x")} disabled={!current}>
                  Abrir comparativo <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
                <span className="text-xs text-muted-foreground">{see4xReports.length} gerado{see4xReports.length === 1 ? "" : "s"}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {loading && <PageSkeleton cards={2} rows={2} />}

      {!loading && monthlyReports.length === 0 && (
        <EmptyState
          icon={FileText}
          title="Nenhum relatório mensal gerado ainda"
          description="Gere o primeiro relatório mensal para consolidar a execução e a evolução da empresa no período."
          action={
            <Button onClick={generate} disabled={!current || generating} className="bg-gradient-brand">
              <Plus className="h-4 w-4 mr-1" /> {generating ? "Gerando..." : "Gerar relatório mensal"}
            </Button>
          }
        />
      )}

      {!loading && monthlyReports.length > 0 && (
        <div className="space-y-3">
          <div>
            <h3 className="font-bold">Histórico mensal</h3>
            <p className="text-xs text-muted-foreground">Relatórios operacionais recorrentes desta contratação.</p>
          </div>
          {monthlyReports.map((r) => (
            <Card key={r.id} className="p-5 shadow-card flex flex-col md:flex-row md:items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-gold flex items-center justify-center shrink-0">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold">{r.title}</h3>
                <p className="text-xs text-muted-foreground">{format(new Date(r.created_at), "dd/MM/yyyy 'às' HH:mm")}</p>
                {r.summary && (
                  <div className="mt-3 text-sm bg-muted/40 p-3 rounded-lg max-w-3xl whitespace-pre-wrap line-clamp-4">
                    {typeof r.summary === "string" ? r.summary : (r.summary.text || JSON.stringify(r.summary).slice(0, 300))}
                  </div>
                )}
              </div>
              {r.pdf_url && (
                <Button variant="outline" onClick={() => download(r.pdf_url, r.title)}>
                  <Download className="h-4 w-4 mr-1" /> PDF
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
