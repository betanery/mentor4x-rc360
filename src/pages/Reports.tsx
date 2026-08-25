import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useContract } from "@/hooks/useContract";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function Reports() {
  const { current } = useCompany();
  const { currentContract } = useContract();
  const [reports, setReports] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    if (!current) return;
    let query = supabase.from("reports").select("*").eq("company_id", current.id).order("created_at", { ascending: false });
    query = currentContract ? query.eq("contract_id", currentContract.id) : query.is("contract_id", null);
    const { data } = await query;
    setReports(data || []);
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios Premium"
        subtitle="PDFs com a evolução completa da empresa, gerados pela IA com identidade RC360 · SEE_4X."
        action={<Button onClick={generate} disabled={generating} className="bg-gradient-brand"><Plus className="h-4 w-4 mr-1" /> {generating ? "Gerando..." : "Gerar relatório mensal"}</Button>}
      />

      {reports.length === 0 && (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum relatório gerado ainda. Clique em "Gerar relatório mensal" para começar.</p>
        </Card>
      )}

      <div className="space-y-3">
        {reports.map((r) => (
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
    </div>
  );
}
