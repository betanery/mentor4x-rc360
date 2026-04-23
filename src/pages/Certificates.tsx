import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Award, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Certificates() {
  const { current } = useCompany();
  const [certs, setCerts] = useState<any[]>([]);

  useEffect(() => {
    if (!current) return;
    supabase.from("certificates").select("*").eq("company_id", current.id).then(({ data }) => setCerts(data || []));
  }, [current]);

  if (!current) return null;
  const completed = current.journey_stage === "concluido";

  return (
    <div className="space-y-6">
      <PageHeader title="Certificação MENTOR 4X" subtitle="Ao concluir a jornada, sua empresa recebe a certificação oficial do método." />

      <Card className="p-12 shadow-elegant bg-gradient-brand text-primary-foreground relative overflow-hidden">
        <div className="absolute -top-20 -right-20 h-64 w-64 bg-gold/15 rounded-full blur-3xl" />
        <div className="relative text-center max-w-2xl mx-auto">
          <Award className={`h-24 w-24 mx-auto ${completed ? "text-gold" : "text-primary-foreground/30"}`} />
          <h2 className="text-3xl font-black mt-4">{completed ? "Empresa Certificada 4X" : "Certificação aguardando conclusão"}</h2>
          <p className="mt-3 text-primary-foreground/80">
            {completed
              ? `${current.name} completou a jornada de 4 meses do método MENTOR 4X. Saiu do caos para o controle.`
              : `${current.name} está atualmente em ${current.journey_stage.replace("_", " ")}. Conclua os 4 estágios para receber o certificado oficial.`}
          </p>
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
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
