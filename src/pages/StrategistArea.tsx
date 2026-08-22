import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IMPROVISO_LABEL, formatBRL } from "@/lib/labels";
import { Copy, MessageSquare } from "lucide-react";
import { toast } from "sonner";

const TEMPLATES = [
  { title: "Cobrança gentil de meta atrasada", text: "Oi! Vi aqui no painel que a meta '{{meta}}' está marcada como atrasada. Bora destravar? Me conta o que está pegando — agendo um call rápido se ajudar." },
  { title: "Convite para Sala de Guerra", text: "Confirmando nossa Sala de Guerra desta semana. Por favor já preencha os 5 blocos no painel: feito / travou / indicadores / próximos passos / decisões." },
  { title: "Parabéns por meta concluída", text: "Excelente! 🎉 Vi que você bateu a meta '{{meta}}'. Esse é exatamente o tipo de execução que destrava a empresa. Bora pra próxima!" },
  { title: "Cliente sumido (7 dias sem login)", text: "Ei, tudo certo? Notei que você não acessou o sistema há alguns dias. O que está pegando aí? Estou à disposição." },
];

export default function StrategistArea() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [c, t] = await Promise.all([
        supabase.from("companies").select("*"),
        supabase.from("tasks").select("*").eq("done", false),
      ]);
      setCompanies(c.data || []);
      setTasks(t.data || []);
    })();
  }, []);

  const copyTpl = (t: string) => { navigator.clipboard.writeText(t); toast.success("Mensagem copiada"); };

  return (
    <div className="space-y-6">
      <PageHeader title="Área do Estrategista" subtitle="Carteira, follow-up, cobranças e biblioteca de mensagens." />

      <Tabs defaultValue="carteira">
        <TabsList>
          <TabsTrigger value="carteira">Carteira</TabsTrigger>
          <TabsTrigger value="tarefas">Tarefas abertas</TabsTrigger>
          <TabsTrigger value="mensagens">Mensagens prontas</TabsTrigger>
        </TabsList>

        <TabsContent value="carteira" className="space-y-2">
          {companies.map((c) => {
            const improviso = IMPROVISO_LABEL[c.chaos_level];
            return (
              <Card key={c.id} className="p-4 shadow-card flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-royal text-white font-bold flex items-center justify-center">{c.name[0]}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2"><h4 className="font-semibold">{c.name}</h4><Badge className={improviso.color} variant="secondary">{improviso.label}</Badge></div>
                  <p className="text-xs text-muted-foreground">Score {c.overall_score} · {formatBRL(c.projected_revenue)}</p>
                </div>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="tarefas" className="space-y-2">
          {tasks.length === 0 && <Card className="p-8 text-center text-muted-foreground">Sem tarefas abertas.</Card>}
          {tasks.map((t) => (
            <Card key={t.id} className="p-4 shadow-card">
              <h4 className="font-semibold">{t.title}</h4>
              <p className="text-xs text-muted-foreground">{t.description}</p>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="mensagens" className="space-y-3">
          {TEMPLATES.map((tpl, i) => (
            <Card key={i} className="p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h4 className="font-semibold flex items-center gap-2"><MessageSquare className="h-4 w-4 text-royal" /> {tpl.title}</h4>
                  <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{tpl.text}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => copyTpl(tpl.text)}><Copy className="h-4 w-4" /></Button>
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
