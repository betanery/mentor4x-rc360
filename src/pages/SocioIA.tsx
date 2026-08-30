import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useContract } from "@/hooks/useContract";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Target, FileText, AlertTriangle, TrendingUp, Loader2, Wand2, CheckCircle2, XCircle, PlayCircle, History, Ban } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };
type Proposal = {
  id: string;
  name: string;
  args: Record<string, any>;
  payload_hash?: string;
  required_scope?: "membro" | "estrategista" | "consultor";
  expires_at?: string;
};

const QUICK_ACTIONS = [
  { label: "Sugerir 2 metas críticas para a semana", icon: Target, action: "suggest_goals" },
  { label: "Gerar plano semanal completo", icon: FileText, action: "weekly_plan" },
  { label: "Analisar travas e bloqueios", icon: AlertTriangle, action: "analyze_blocks" },
  { label: "Avaliar risco do cliente", icon: TrendingUp, action: "risk_assessment" },
];

const DECISION_LABEL: Record<string, string> = {
  proposta: "Proposta",
  executada: "Executada",
  rejeitada: "Descartada",
  falhou: "Falhou",
};

const DECISION_STYLE: Record<string, string> = {
  proposta: "bg-muted text-foreground",
  executada: "bg-success text-white",
  rejeitada: "bg-royal text-white",
  falhou: "bg-destructive text-white",
};

const TOOL_LABEL: Record<string, string> = {
  create_goal: "Criar meta",
  create_bottleneck: "Registrar gargalo",
  schedule_meeting: "Agendar reunião",
};

const SCOPE_LABEL: Record<string, string> = {
  membro: "Aprovação do time",
  estrategista: "Aprovação da equipe interna",
  consultor: "Aprovação do Consultor 4X",
};

export default function SocioIA() {
  const { current } = useCompany();
  const { currentContract } = useContract();
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Olá! Sou o **Meu Sócio IA** — seu conselheiro estratégico do método 4X. Posso analisar a empresa, sugerir metas, gerar planos, resumir reuniões e alertar riscos. Por onde quer começar?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Tools tab
  const [instruction, setInstruction] = useState("");
  const [proposing, setProposing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [proposalMsg, setProposalMsg] = useState("");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [rejecting, setRejecting] = useState(false);

  // Log de decisões da IA
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const loadLogs = async () => {
    if (!current) return;
    setLogsLoading(true);
    const { data } = await supabase
      .from("ai_logs")
      .select("id, created_at, action, decision, tool_name, payload, entity, entity_id")
      .eq("company_id", current.id)
      .not("decision", "is", null)
      .order("created_at", { ascending: false })
      .limit(60);
    setLogs(data || []);
    setLogsLoading(false);
  };

  useEffect(() => { loadLogs(); }, [current?.id]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || !current) return;
    const userMsg: Msg = { role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: [...messages, userMsg], company_id: current.id, contract_id: currentContract?.id }),
      });
      if (!resp.ok || !resp.body) {
        if (resp.status === 429) throw new Error("Muitas requisições. Aguarde um instante.");
        if (resp.status === 402) throw new Error("Créditos da IA esgotados.");
        throw new Error("Falha no chat");
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = ""; let acc = "";
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
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const runAction = (action: string) => {
    const map: Record<string, string> = {
      suggest_goals: "Com base nos pilares 4X e nos gargalos atuais, sugira 2 metas críticas para esta semana. Retorne título, indicador e impacto esperado.",
      weekly_plan: "Gere um plano semanal completo: rotinas diárias, foco principal, 2 metas, indicadores a acompanhar e riscos.",
      analyze_blocks: "Analise as travas atuais da empresa. Aponte causas raiz e 3 ações concretas de desbloqueio.",
      risk_assessment: "Avalie o risco do cliente: nível de execução, dependência do dono, sinais de saída ou estagnação. Retorne semáforo (verde/amarelo/vermelho) e recomendações.",
    };
    send(map[action]);
  };

  const propose = async () => {
    if (!instruction.trim() || !current) return;
    setProposing(true); setProposals([]); setResults([]); setProposalMsg("");
    try {
      const { data, error } = await supabase.functions.invoke("socio-tools", {
        body: { instruction, company_id: current.id, contract_id: currentContract?.id, confirm: false },
      });
      if (error) throw error;
      setProposalMsg(data.message || "");
      setProposals(data.proposals || []);
      if ((data.proposals || []).length === 0) toast.info("Nenhuma ação proposta. Refine a instrução.");
    } catch (e: any) {
      toast.error(e.message || "Falha ao propor ações");
    } finally {
      setProposing(false);
    }
  };

  const execute = async () => {
    if (!current || proposals.length === 0) return;
    setExecuting(true);
    try {
      const { data, error } = await supabase.functions.invoke("socio-tools", {
        body: {
          instruction,
          company_id: current.id,
          contract_id: currentContract?.id,
          confirm: true,
          proposal_ids: proposals.map((p) => p.id),
        },
      });
      if (error) throw error;
      setResults(data.results || []);
      loadLogs();
      const ok = (data.results || []).filter((r: any) => r.ok).length;
      toast.success(`${ok}/${(data.results || []).length} ações executadas`);
      setProposals([]);
    } catch (e: any) {
      toast.error(e.message || "Falha ao executar");
    } finally {
      setExecuting(false);
    }
  };

  const rejectProposals = async () => {
    if (!current || proposals.length === 0) return;
    setRejecting(true);
    try {
      const { error } = await supabase.functions.invoke("socio-tools", {
        body: {
          instruction,
          company_id: current.id,
          contract_id: currentContract?.id,
          decision: "reject",
          proposal_ids: proposals.map((p) => p.id),
        },
      });
      if (error) throw error;
      setProposals([]);
      setProposalMsg("");
      toast.success("Ações descartadas e registradas no log de decisões");
      loadLogs();
    } catch (e: any) {
      toast.error(e.message || "Falha ao registrar a recusa");
    } finally {
      setRejecting(false);
    }
  };


  if (!current) {
    return (
      <div className="space-y-6">
        <PageHeader title="Meu Sócio IA" subtitle="Conselheiro estratégico do método 4X." />
        <Card className="p-10 text-center space-y-3">
          <Sparkles className="h-10 w-10 text-gold mx-auto" />
          <h2 className="text-xl font-bold">Vincule uma empresa para começar</h2>
          <p className="text-sm text-muted-foreground">O Sócio IA precisa do contexto de uma empresa para sugerir metas e analisar riscos.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Meu Sócio IA" subtitle="Conselheiro estratégico do método 4X. Analisa, sugere e age com você." />

      <Tabs defaultValue="chat" className="w-full">
        <TabsList>
          <TabsTrigger value="chat"><Sparkles className="h-4 w-4 mr-2" /> Conversa</TabsTrigger>
          <TabsTrigger value="actions"><Wand2 className="h-4 w-4 mr-2" /> Ações</TabsTrigger>
          <TabsTrigger value="logs"><History className="h-4 w-4 mr-2" /> Decisões</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-16rem)]">
            <div className="lg:col-span-1 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">Ações rápidas</p>
              {QUICK_ACTIONS.map((a) => (
                <button key={a.action} onClick={() => runAction(a.action)} disabled={loading}
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
        </TabsContent>

        <TabsContent value="actions" className="mt-4 space-y-4">
          <Card className="p-6 shadow-card space-y-4">
            <div>
              <h3 className="font-bold text-lg">Peça ações concretas ao Sócio IA</h3>
              <p className="text-sm text-muted-foreground">Ex: <em>"Crie 2 metas para reduzir churn esta semana e registre o gargalo de operação de logística."</em> A IA propõe — você confirma antes de gravar.</p>
            </div>
            <Textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={4}
              placeholder="Descreva o que você quer registrar, criar ou agendar..." />
            <div className="flex gap-2">
              <Button onClick={propose} disabled={proposing || !instruction.trim()} className="bg-gradient-brand">
                {proposing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
                Propor ações
              </Button>
            </div>
          </Card>

          {proposalMsg && (
            <Card className="p-4 bg-muted/30">
              <div className="prose prose-sm max-w-none"><ReactMarkdown>{proposalMsg}</ReactMarkdown></div>
            </Card>
          )}

          {proposals.length > 0 && (
            <Card className="p-6 shadow-card space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold">Ações propostas ({proposals.length})</h4>
                  <p className="text-xs text-muted-foreground">
                    A confirmação executa exatamente o conteúdo exibido abaixo. Qualquer ajuste exige nova proposta.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={rejectProposals} disabled={rejecting || executing} variant="outline">
                    {rejecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Ban className="h-4 w-4 mr-2" />}
                    Descartar
                  </Button>
                  <Button onClick={execute} disabled={executing || rejecting} variant="default">
                    {executing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlayCircle className="h-4 w-4 mr-2" />}
                    Aprovar e executar
                  </Button>
                </div>
              </div>
              <div className="space-y-3">
                {proposals.map((p) => (
                  <div key={p.id} className="border border-border rounded-lg p-3">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge className="bg-royal text-white">{TOOL_LABEL[p.name] || p.name}</Badge>
                      {p.required_scope && (
                        <Badge variant="outline">{SCOPE_LABEL[p.required_scope] || p.required_scope}</Badge>
                      )}
                    </div>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(p.args, null, 2)}</pre>
                    <p className="text-[10px] text-muted-foreground mt-2 font-mono break-all">
                      ID {p.id}
                      {p.payload_hash ? ` · assinatura ${p.payload_hash.slice(0, 16)}…` : ""}
                      {p.expires_at ? ` · válida até ${new Date(p.expires_at).toLocaleString("pt-BR")}` : ""}
                    </p>
                  </div>
                ))}
              </div>

            </Card>
          )}

          {results.length > 0 && (
            <Card className="p-6 shadow-card space-y-3">
              <h4 className="font-bold">Resultado</h4>
              {results.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  {r.ok ? <CheckCircle2 className="h-4 w-4 text-success mt-0.5" /> : <XCircle className="h-4 w-4 text-destructive mt-0.5" />}
                  <div>
                    <p className="font-semibold">{TOOL_LABEL[r.name] || r.name}</p>
                    {r.ok ? <p className="text-xs text-muted-foreground">{r.row?.title || r.row?.name || "OK"}</p>
                          : <p className="text-xs text-destructive">{r.error}</p>}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="logs" className="mt-4 space-y-4">
          <Card className="p-6 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">Log de decisões da IA</h3>
                <p className="text-sm text-muted-foreground">Toda ação proposta pelo Sócio IA fica registrada com a decisão humana — executada, descartada ou falha.</p>
              </div>
              <Button variant="outline" size="sm" onClick={loadLogs} disabled={logsLoading}>
                {logsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar"}
              </Button>
            </div>
            {logsLoading && <PageSkeleton cards={0} rows={3} />}
            {logs.length === 0 && !logsLoading && (
              <p className="text-sm text-muted-foreground">
                Nenhuma decisão registrada ainda. Proponha ações na aba Ações para começar o histórico.
              </p>
            )}
            <div className="space-y-2">
              {logs.map((l) => (
                <div key={l.id} className="border border-border rounded-lg p-3 flex items-start gap-3">
                  <Badge className={DECISION_STYLE[l.decision] || "bg-muted text-foreground"}>{DECISION_LABEL[l.decision] || l.decision}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{TOOL_LABEL[l.tool_name] || l.tool_name}</p>
                    {l.payload && Object.keys(l.payload).length > 0 && (
                      <pre className="text-[11px] bg-muted mt-1 p-2 rounded overflow-x-auto">{JSON.stringify(l.payload, null, 2)}</pre>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {new Date(l.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
