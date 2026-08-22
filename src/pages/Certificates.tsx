import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, CheckCircle2, Download, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function Certificates() {
  const { current } = useCompany();
  const { isStaff } = useAuth();
  const [certs, setCerts] = useState<any[]>([]);
  const [issuing, setIssuing] = useState(false);

  const load = async () => {
    if (!current) return;
    const { data } = await supabase.from("certificates").select("*").eq("company_id", current.id).order("issued_at", { ascending: false });
    setCerts(data || []);
  };
  useEffect(() => { load(); }, [current]);

  if (!current) return null;
  const completed = current.journey_stage === "concluido";

  const issue = async () => {
    setIssuing(true);
    const { error } = await supabase.functions.invoke("ai-action", {
      body: { action: "issue_certificate", company_id: current.id },
    });
    setIssuing(false);
    if (error) { toast.error("Erro ao emitir certificado"); return; }
    toast.success("Certificado emitido!");
    load();
  };

  const download = async (path: string, code: string) => {
    const { data, error } = await supabase.storage.from("reports").createSignedUrl(path, 300);
    if (error || !data) { toast.error("Não foi possível abrir o certificado"); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl; a.download = `certificado-${code}.pdf`; a.target = "_blank";
    document.body.appendChild(a); a.click(); a.remove();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Certificação SEE_4X" subtitle="Ao concluir a jornada, sua empresa recebe a certificação oficial do método." />

      <Card className="p-12 shadow-elegant bg-gradient-brand text-primary-foreground relative overflow-hidden">
        <div className="absolute -top-20 -right-20 h-64 w-64 bg-gold/15 rounded-full blur-3xl" />
        <div className="relative text-center max-w-2xl mx-auto">
          <Award className={`h-24 w-24 mx-auto ${completed ? "text-gold" : "text-primary-foreground/30"}`} />
          <h2 className="text-3xl font-black mt-4">{completed ? "Empresa Certificada 4X" : "Certificação aguardando conclusão"}</h2>
          <p className="mt-3 text-primary-foreground/80">
            {completed
              ? `${current.name} concluiu a Jornada SEE_4X de 6 ciclos — do improviso à autonomia.`
              : `${current.name} está atualmente em ${current.journey_stage.replace("_", " ")}. Conclua os 6 ciclos para receber o certificado oficial.`}
          </p>
          {isStaff && completed && (
            <Button onClick={issue} disabled={issuing} className="mt-6 bg-gold text-gold-foreground hover:bg-gold/90">
              <Sparkles className="h-4 w-4 mr-2" />{issuing ? "Emitindo..." : "Emitir novo certificado em PDF"}
            </Button>
          )}
          {isStaff && !completed && (
            <p className="text-xs text-primary-foreground/60 mt-4">
              Como staff você pode emitir o certificado mesmo antes da conclusão para teste.
              <Button onClick={issue} disabled={issuing} variant="ghost" size="sm" className="ml-2 text-gold hover:bg-gold/10">
                Emitir mesmo assim
              </Button>
            </p>
          )}
        </div>
      </Card>

      {certs.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold">Certificados emitidos</h3>
          {certs.map((c) => (
            <Card key={c.id} className="p-5 shadow-card flex items-center gap-4">
              <CheckCircle2 className="h-8 w-8 text-gold" />
              <div className="flex-1">
                <p className="font-bold">Certificado #{c.code}</p>
                <p className="text-xs text-muted-foreground">Emitido em {format(new Date(c.issued_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
              </div>
              {c.pdf_url && (
                <Button variant="outline" onClick={() => download(c.pdf_url, c.code)}>
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
