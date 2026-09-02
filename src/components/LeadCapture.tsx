// Captação — link público do diagnóstico com UTM, QR code e conversão de leads
// em empresa. Só o link é gerado no cliente; a conversão respeita as políticas
// de acesso do time interno (staff).
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { QrCode, Copy, Download, MessageCircle, Building2, Link2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type Lead = {
  id: string;
  full_name: string | null;
  email: string | null;
  company_name: string | null;
  segment?: string | null;
  status: string;
  improviso_score: number | null;
  idd_score: number | null;
  recommendation: any;
  utm_source: string | null;
  utm_campaign: string | null;
  current_step: number | null;
  created_at: string;
  converted_company_id?: string | null;
};

const PRESETS = [
  { key: "instagram", label: "Instagram", utm_source: "instagram", utm_medium: "social" },
  { key: "indicacao", label: "Indicação", utm_source: "indicacao", utm_medium: "referral" },
  { key: "email", label: "E-mail", utm_source: "email", utm_medium: "email" },
  { key: "evento", label: "Evento", utm_source: "evento", utm_medium: "offline" },
];

const slug = (v: string) =>
  v.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Faixa de Improviso → nível registrado na empresa convertida. */
const chaosFromImproviso = (score: number | null) => {
  const s = score ?? 0;
  if (s >= 80) return "total" as const;
  if (s >= 60) return "severo" as const;
  if (s >= 40) return "moderado" as const;
  if (s >= 20) return "leve" as const;
  return "escala" as const;
};

export function LeadCapture({ leads }: { leads: Lead[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [source, setSource] = useState("instagram");
  const [medium, setMedium] = useState("social");
  const [campaign, setCampaign] = useState("");
  const [content, setContent] = useState("");

  const [fSource, setFSource] = useState("todas");
  const [fBand, setFBand] = useState("todas");
  const [fTrack, setFTrack] = useState("todas");
  const [converting, setConverting] = useState<string | null>(null);

  const baseUrl = `${window.location.origin}/diagnostico-lead`;

  const link = useMemo(() => {
    const url = new URL(baseUrl);
    if (source) url.searchParams.set("utm_source", slug(source));
    if (medium) url.searchParams.set("utm_medium", slug(medium));
    if (campaign) url.searchParams.set("utm_campaign", slug(campaign));
    if (content) url.searchParams.set("utm_content", slug(content));
    return url.toString();
  }, [baseUrl, source, medium, campaign, content]);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, link, { width: 208, margin: 1, color: { dark: "#0B1220", light: "#FFFFFF" } }).catch(
      () => undefined,
    );
  }, [link]);

  const applyPreset = (key: string) => {
    const p = PRESETS.find((x) => x.key === key);
    if (!p) return;
    setSource(p.utm_source);
    setMedium(p.utm_medium);
  };

  const copy = () => {
    navigator.clipboard.writeText(link);
    toast.success("Link copiado");
  };

  const whatsapp = () => {
    const text = `Fiz um diagnóstico rápido que mostra onde a empresa ainda opera no improviso. Leva ~8 minutos: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const downloadQr = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `diagnostico-4x-${slug(campaign || source || "link")}.png`;
    a.click();
  };

  const sources = useMemo(
    () => Array.from(new Set(leads.map((l) => l.utm_source).filter(Boolean) as string[])),
    [leads],
  );
  const tracks = useMemo(
    () => Array.from(new Set(leads.map((l) => l.recommendation?.track).filter(Boolean) as string[])),
    [leads],
  );

  const filtered = leads.filter((l) => {
    if (fSource !== "todas" && (l.utm_source || "direto") !== fSource) return false;
    if (fTrack !== "todas" && l.recommendation?.track !== fTrack) return false;
    if (fBand !== "todas") {
      const s = l.improviso_score ?? -1;
      if (fBand === "alto" && s < 60) return false;
      if (fBand === "medio" && (s < 35 || s >= 60)) return false;
      if (fBand === "baixo" && (s < 0 || s >= 35)) return false;
    }
    return true;
  });

  const convert = async (lead: Lead) => {
    if (lead.converted_company_id) return;
    setConverting(lead.id);
    const { data, error } = await supabase
      .from("companies")
      .insert({
        name: lead.company_name || lead.full_name || "Empresa sem nome",
        segment: lead.segment || null,
        chaos_level: chaosFromImproviso(lead.improviso_score),
        journey_stage: "ciclo_1" as const,
        overall_score: Math.max(0, 100 - (lead.improviso_score ?? 0)),
        owner_dependency: lead.idd_score ?? 0,
        notes: `Origem: diagnóstico público${lead.utm_source ? ` (${lead.utm_source})` : ""}. Contato: ${
          [lead.full_name, lead.email].filter(Boolean).join(" · ") || "não informado"
        }.`,
      })
      .select("id")
      .single();

    if (error || !data) {
      setConverting(null);
      toast.error(error?.message || "Não foi possível converter o lead");
      return;
    }

    if (user) {
      await supabase
        .from("company_members")
        .insert({ company_id: data.id, user_id: user.id, member_role: "mentor" as const });
    }
    const { error: linkErr } = await supabase
      .from("lead_diagnostics")
      .update({ converted_company_id: data.id })
      .eq("id", lead.id);
    setConverting(null);
    if (linkErr) toast.warning("Empresa criada, mas o lead não foi marcado como convertido.");
    else toast.success("Lead convertido em empresa");
    qc.invalidateQueries({ queryKey: ["strategist-area"] });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 shadow-card lg:col-span-2 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Link2 className="h-4 w-4 text-gold" /> Link público do diagnóstico
          </h3>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button key={p.key} size="sm" variant="outline" onClick={() => applyPreset(p.key)}>
                {p.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Origem (utm_source)</Label>
              <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="instagram" />
            </div>
            <div className="space-y-1.5">
              <Label>Meio (utm_medium)</Label>
              <Input value={medium} onChange={(e) => setMedium(e.target.value)} placeholder="social" />
            </div>
            <div className="space-y-1.5">
              <Label>Campanha (utm_campaign)</Label>
              <Input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="lancamento-setembro" />
            </div>
            <div className="space-y-1.5">
              <Label>Peça (utm_content)</Label>
              <Input value={content} onChange={(e) => setContent(e.target.value)} placeholder="story-01" />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs break-all font-mono">{link}</div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={copy}>
              <Copy className="h-4 w-4 mr-2" /> Copiar link
            </Button>
            <Button size="sm" variant="outline" onClick={whatsapp}>
              <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
            </Button>
            <Button size="sm" variant="outline" onClick={downloadQr}>
              <Download className="h-4 w-4 mr-2" /> Baixar QR
            </Button>
          </div>
        </Card>

        <Card className="p-5 shadow-card flex flex-col items-center justify-center gap-3">
          <h3 className="font-semibold flex items-center gap-2 self-start">
            <QrCode className="h-4 w-4 text-gold" /> QR code
          </h3>
          <canvas ref={canvasRef} className="rounded-lg border border-border bg-white p-2" />
          <p className="text-xs text-muted-foreground text-center">
            Use em slides, cartão ou material de evento. O QR acompanha os UTMs escolhidos.
          </p>
        </Card>
      </div>

      <Card className="p-5 shadow-card space-y-4">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1 space-y-1.5">
            <Label>Origem</Label>
            <Select value={fSource} onValueChange={setFSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as origens</SelectItem>
                <SelectItem value="direto">Direto / sem UTM</SelectItem>
                {sources.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1.5">
            <Label>Improviso</Label>
            <Select value={fBand} onValueChange={setFBand}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as faixas</SelectItem>
                <SelectItem value="alto">Alto (60+)</SelectItem>
                <SelectItem value="medio">Médio (35–59)</SelectItem>
                <SelectItem value="baixo">Baixo (0–34)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1.5">
            <Label>Caminho recomendado</Label>
            <Select value={fTrack} onValueChange={setFTrack}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos os caminhos</SelectItem>
                {tracks.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Nenhum lead neste filtro"
            description="Divulgue o link público com UTM para começar a receber diagnósticos de captação."
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((l) => (
              <div key={l.id} className="flex flex-col md:flex-row md:items-center gap-3 p-4 rounded-lg border border-border">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold truncate">{l.company_name || "Empresa não informada"}</h4>
                  <p className="text-xs text-muted-foreground truncate">
                    {[l.full_name, l.email].filter(Boolean).join(" · ") || "sem contato"}
                    {` · origem ${l.utm_source || "direto"}${l.utm_campaign ? `/${l.utm_campaign}` : ""}`}
                    {` · ${format(new Date(l.created_at), "dd/MM/yyyy", { locale: ptBR })}`}
                  </p>
                  {l.recommendation?.track && (
                    <p className="text-xs text-gold font-semibold mt-1">Caminho: {l.recommendation.track}</p>
                  )}
                </div>
                {l.status === "concluido" ? (
                  <>
                    <Badge variant="outline">Improviso {l.improviso_score}</Badge>
                    <Badge variant="outline">IDD {l.idd_score}</Badge>
                  </>
                ) : (
                  <Badge variant="secondary">Em andamento · etapa {(l.current_step ?? 0) + 1}/6</Badge>
                )}
                {l.converted_company_id ? (
                  <Badge className="bg-success/15 text-success">Convertido</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={converting === l.id}
                    onClick={() => convert(l)}
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    {converting === l.id ? "Convertendo…" : "Converter em empresa"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
