import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, Target, FileText, AlertTriangle, TrendingUp, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

const QUICK_ACTIONS = [
  { label: "Sugerir 2 metas críticas para a semana", icon: Target, action: "suggest_goals" },
  { label: "Gerar plano semanal completo", icon: FileText, action: "weekly_plan" },
  { label: "Analisar travas e bloqueios", icon: AlertTriangle, action: "analyze_blocks" },
  { label: "Avaliar risco do cliente", icon: TrendingUp, action: "risk_assessment" },
];

export default function SocioIA() {
  const { current } = useCompany();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Olá! Sou o **Meu Sócio IA** — seu conselheiro estratégico do método 4X. Posso analisar a empresa, sugerir metas, gerar planos, resumir reuniões e alertar riscos. Por onde quer começar?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || !current) return;
    const userMsg: Msg = { role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: [...messages, userMsg], company_id: current.id }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) throw new Error("Muitas requisições. Aguarde um instante.");
        if (resp.status === 402) throw new Error("Créditos da IA esgotados. Adicione mais em Settings.");
        throw new Error("Falha no chat");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      setMessages((m) => [...m, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, i); buf = buf.slice(i + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (j === "[DONE]") break;
          try {
            const c = JSON.parse(j).choices?.[0]?.delta?.content;
            if (c) { acc += c; setMessages((m) => { const n = [...m]; n[n.length - 1] = { role: "assistant", content: acc }; return n; }); }
          } catch { buf = line + "\n" + buf; break; }
        }
      }

      // Log
      await supabase.from("ai_logs").insert({ user_id: user?.id, company_id: current.id, action: "chat", prompt: text, response: acc });
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const runAction = async (action: string) => {
    const map: Record<string, string> = {
      suggest_goals: "Com base nos pilares 4X e nos gargalos atuais, sugira 2 metas críticas para esta semana. Retorne título, indicador e impacto esperado.",
      weekly_plan: "Gere um plano semanal completo: rotinas diárias, foco principal, 2 metas, indicadores a acompanhar e riscos.",
      analyze_blocks: "Analise as travas atuais da empresa. Aponte causas raiz e 3 ações concretas de desbloqueio.",
      risk_assessment: "Avalie o risco do cliente: nível de execução, dependência do dono, sinais de saída ou estagnação. Retorne semáforo (verde/amarelo/vermelho) e recomendações.",
    };
    send(map[action]);
  };

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
      <PageHeader title="Meu Sócio IA" subtitle="Conselheiro estratégico do método 4X. Analisa, sugere e age com você." />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-0">
        <div className="lg:col-span-1 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">Ações rápidas</p>
          {QUICK_ACTIONS.map((a) => (
            <button key={a.action} onClick={() => runAction(a.action)} disabled={loading || !current}
              className="w-full text-left p-3 rounded-lg border border-border hover:border-gold hover:bg-gold/5 transition-all text-sm font-medium flex items-start gap-2 disabled:opacity-50">
              <a.icon className="h-4 w-4 text-royal mt-0.5 shrink-0" /> {a.label}
            </button>
          ))}
        </div>

        <Card className="lg:col-span-3 flex flex-col shadow-card overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`h-8 w-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-black ${m.role === "user" ? "bg-royal text-white" : "bg-gradient-gold text-primary"}`}>
                  {m.role === "user" ? "EU" : <Sparkles className="h-4 w-4" />}
                </div>
                <div className={`max-w-[80%] p-3 rounded-2xl ${m.role === "user" ? "bg-royal text-white" : "bg-muted"}`}>
                  <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2">
                    <ReactMarkdown>{m.content || "..."}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            {loading && <div className="flex gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Pensando...</div>}
          </div>
          <div className="p-4 border-t bg-muted/20">
            <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
              <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Pergunte ao seu sócio IA..."
                className="resize-none min-h-[44px] max-h-32"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} />
              <Button type="submit" disabled={loading || !input.trim()} className="bg-gradient-brand"><Send className="h-4 w-4" /></Button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
