import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function callAI(prompt: string, system: string) {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }),
  });
  const j = await r.json();
  return j.choices?.[0]?.message?.content || "";
}

function buildReportPdf(title: string, companyName: string, body: string): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  // Header band
  doc.setFillColor(20, 20, 50);
  doc.rect(0, 0, pageW, 90, "F");
  doc.setTextColor(255, 215, 130);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("RC360 · MENTOR 4X", 40, 35);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text(title, 40, 60);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(companyName, 40, 78);

  // Body
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  const margin = 40;
  const maxW = pageW - margin * 2;
  let y = 120;
  const lines = doc.splitTextToSize(body.replace(/[#*`>]/g, ""), maxW);
  for (const line of lines) {
    if (y > pageH - 60) { doc.addPage(); y = 60; }
    doc.text(line, margin, y);
    y += 16;
  }
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, margin, pageH - 30);
  return new Uint8Array(doc.output("arraybuffer"));
}

function buildCertificatePdf(companyName: string, code: string): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setFillColor(20, 20, 50); doc.rect(0, 0, w, h, "F");
  doc.setDrawColor(212, 175, 55); doc.setLineWidth(4);
  doc.rect(25, 25, w - 50, h - 50);
  doc.setTextColor(212, 175, 55); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text("SEE_4X — CERTIFICAÇÃO OFICIAL · RC360", w / 2, 90, { align: "center" });
  doc.setTextColor(255, 255, 255); doc.setFontSize(36);
  doc.text("Certificado de Conclusão", w / 2, 180, { align: "center" });
  doc.setFontSize(14); doc.setFont("helvetica", "normal");
  doc.text("Conferido a", w / 2, 230, { align: "center" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(28); doc.setTextColor(212, 175, 55);
  doc.text(companyName, w / 2, 280, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(13); doc.setTextColor(255, 255, 255);
  const txt = "Por concluir a Jornada SEE_4X de 6 ciclos,\nevoluindo do improviso à autonomia com execução estruturada.";
  doc.text(txt, w / 2, 340, { align: "center" });
  doc.setFontSize(11); doc.setTextColor(200, 200, 220);
  doc.text(`Código de validação: ${code}`, w / 2, h - 80, { align: "center" });
  doc.text(`Emitido em ${new Date().toLocaleDateString("pt-BR")}`, w / 2, h - 60, { align: "center" });
  return new Uint8Array(doc.output("arraybuffer"));
}

// ---------------------------------------------------------------------------
// SEE_4X report helpers
// ---------------------------------------------------------------------------

const GROUP_WEIGHTS: Record<string, number> = {
  dono_socio: 0.4,
  gestor: 0.35,
  equipe: 0.25,
};

const BLINDSPOTS: { code: string; title: string; pillar: string }[] = [
  { code: "BS-C1", title: "Oferta indefinida", pillar: "crescimento" },
  { code: "BS-C2", title: "Previsibilidade comercial ausente", pillar: "crescimento" },
  { code: "BS-C3", title: "Geração de demanda improvisada", pillar: "crescimento" },
  { code: "BS-C4", title: "Time comercial sem método", pillar: "crescimento" },
  { code: "BS-C5", title: "Expansão sem base", pillar: "crescimento" },
  { code: "BS-E1", title: "Processos na cabeça das pessoas", pillar: "eficiencia" },
  { code: "BS-E2", title: "Indicadores sem fonte", pillar: "eficiencia" },
  { code: "BS-E3", title: "Financeiro sem controle", pillar: "eficiencia" },
  { code: "BS-E4", title: "Retrabalho e desperdício", pillar: "eficiencia" },
  { code: "BS-E5", title: "Tecnologia subutilizada", pillar: "eficiencia" },
  { code: "BS-X1", title: "Jornada do cliente indefinida", pillar: "encantamento" },
  { code: "BS-X2", title: "Onboarding travado", pillar: "encantamento" },
  { code: "BS-X3", title: "Sem escuta do cliente", pillar: "encantamento" },
  { code: "BS-X4", title: "Retenção não gerenciada", pillar: "encantamento" },
  { code: "BS-X5", title: "Marca sem consistência", pillar: "encantamento" },
  { code: "BS-L1", title: "Dependência do dono", pillar: "lideranca" },
  { code: "BS-L2", title: "Papéis e accountability difusos", pillar: "lideranca" },
  { code: "BS-L3", title: "Ausência de rituais de gestão", pillar: "lideranca" },
  { code: "BS-L4", title: "Time sem desenvolvimento", pillar: "lideranca" },
  { code: "BS-L5", title: "Decisão sem dado", pillar: "lideranca" },
];

const PILLAR_LABEL: Record<string, string> = {
  crescimento: "Crescimento",
  eficiencia: "Eficiência",
  encantamento: "Encantamento",
  lideranca: "Liderança",
};

const MOTOR_LABEL: Record<string, string> = {
  clareza: "Clareza",
  prioridade: "Prioridade",
  execucao: "Execução",
  governanca: "Governança",
  autonomia: "Autonomia",
};

function average(values: number[]): number | null {
  const valid = values.filter((v) => typeof v === "number" && v >= 1 && v <= 5);
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function toImproviso(avg: number): number {
  return Math.round(((5 - avg) / 4) * 100);
}

function computeDiagnosticSummary(responses: any[]) {
  if (!responses.length) return null;
  const groupsPresent = Array.from(new Set(responses.map((r: any) => r.respondent_group)));
  const weightTotal = groupsPresent.reduce((s: number, g: string) => s + GROUP_WEIGHTS[g], 0);

  const weightedAvg = (ids: string[]): number | null => {
    let sum = 0;
    let usedWeight = 0;
    for (const g of groupsPresent) {
      const rs = responses.filter((r: any) => r.respondent_group === g);
      const vals = rs.flatMap((r: any) => ids.map((id) => r.answers?.[id]).filter((v) => typeof v === "number"));
      const avg = average(vals);
      if (avg === null) continue;
      sum += avg * GROUP_WEIGHTS[g];
      usedWeight += GROUP_WEIGHTS[g];
    }
    if (!usedWeight) return null;
    return sum / usedWeight;
  };

  const pillars = ["crescimento", "eficiencia", "encantamento", "lideranca"];
  const byPillar = pillars.map((pillar) => {
    const ids = BLINDSPOTS.filter((b) => b.pillar === pillar).map((b) => b.code);
    const avg = weightedAvg(ids);
    return { pillar, improviso: avg === null ? 0 : toImproviso(avg) };
  });

  const blindspots = BLINDSPOTS.map((bs) => {
    const avg = weightedAvg([bs.code]);
    return { code: bs.code, title: bs.title, pillar: bs.pillar, improviso: avg === null ? 0 : toImproviso(avg) };
  }).sort((a, b) => b.improviso - a.improviso);

  const allAvg = weightedAvg(BLINDSPOTS.map((b) => b.code));
  const improvisoGeral = allAvg === null ? 0 : toImproviso(allAvg);

  const iddIds = ["IDD-decisoes", "IDD-vendas", "IDD-financeiro", "IDD-operacao", "IDD-clientes", "IDD-equipe", "IDD-problemas", "IDD-conhecimento"];
  const iddScores = iddIds.map((id) => {
    const avg = weightedAvg([id]);
    return avg === null ? 0 : toImproviso(avg);
  }).filter((v) => v > 0);
  const iddScore = iddScores.length ? Math.round(iddScores.reduce((a, b) => a + b, 0) / iddScores.length) : 0;

  return { improvisoGeral, byPillar, blindspots, iddScore };
}

function getDiagnosticResult(diagnostic: any, responses: any[]) {
  const stored = diagnostic.results;
  if (stored && stored.improvisoGeral !== undefined) {
    return {
      improvisoGeral: stored.improvisoGeral,
      byPillar: stored.byPillar || [],
      blindspots: stored.blindspots || [],
      iddScore: stored.idd?.score ?? 0,
      maturity: diagnostic.maturity,
    };
  }
  const computed = computeDiagnosticSummary(responses);
  if (!computed) return null;
  return { ...computed, maturity: diagnostic.maturity };
}

function motorForPillar(pillar: string): string {
  switch (pillar) {
    case "crescimento": return "prioridade";
    case "lideranca": return "governanca";
    case "eficiencia":
    case "encantamento":
    default: return "execucao";
  }
}

function buildSee4xReportPdf(
  companyName: string,
  baseline: any,
  followUp: any,
  goals: any[],
  code: string,
): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const navy = [17, 33, 69]; // #112145
  const royal = [18, 67, 120]; // #124378
  const gold = [193, 138, 9]; // #C18A09

  const addFooter = () => {
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`RC360 / Roberta Cardoso · Mentor 4X · Código ${code}`, margin, pageH - 30);
    doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, pageW - margin, pageH - 30, { align: "right" });
  };

  // Cover
  doc.setFillColor(...navy);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setDrawColor(...gold);
  doc.setLineWidth(3);
  doc.rect(30, 30, pageW - 60, pageH - 60);
  doc.setTextColor(...gold);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("RC360 · ROBERTA CARDOSO", pageW / 2, 110, { align: "center" });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.text("Relatório SEE_4X", pageW / 2, 180, { align: "center" });
  doc.setFontSize(16);
  doc.setFont("helvetica", "normal");
  doc.text("Antes / Depois e Plano de 90 dias", pageW / 2, 215, { align: "center" });
  doc.setFontSize(14);
  doc.setTextColor(200, 200, 220);
  doc.text(companyName, pageW / 2, 280, { align: "center" });
  doc.setFontSize(11);
  doc.text(`Baseline: ${baseline.title} · Follow-up: ${followUp.title}`, pageW / 2, 320, { align: "center" });
  addFooter();

  // Methodology
  doc.addPage();
  doc.setFillColor(...royal);
  doc.rect(0, 0, pageW, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Metodologia SEE_4X", margin, 45);
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  let y = 100;
  const methodology = [
    "A metodologia SEE_4X avalia a empresa em quatro pilares — Crescimento, Eficiência, Encantamento e Liderança — e em oito dimensões de dependência do dono (IDD).",
    "O Improviso mede o quanto a operação ainda depende de reação em vez de padrão. A Maturidade mostra até onde a empresa pode chegar. São variáveis independentes.",
    "Os cinco Motores — Clareza, Prioridade, Execução, Governança e Autonomia — guiam os seis ciclos da jornada.",
  ];
  for (const line of methodology) {
    const lines = doc.splitTextToSize(line, pageW - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 16 + 10;
  }
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...gold);
  doc.text("Seis ciclos da jornada", margin, y);
  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  const cycles = [
    "1. Clareza e Prioridade — Diagnóstico validado, baseline, Top 5 e Plano de Execução.",
    "2. Organização e Execução — Responsáveis, controles mínimos, primeiras metas e revisão quinzenal.",
    "3. Estruturação — Padrões prioritários em uso, indicadores e evidências.",
    "4. Fortalecimento — Correções aplicadas e estruturas ganhando consistência.",
    "5. Performance — Resultados comparados à linha de base e decisões de performance.",
    "6. Autonomia — Reavaliação, antes/depois e Plano de Continuidade de 90 dias.",
  ];
  for (const line of cycles) {
    const lines = doc.splitTextToSize(line, pageW - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 14 + 4;
  }
  addFooter();

  // Comparison
  doc.addPage();
  doc.setFillColor(...royal);
  doc.rect(0, 0, pageW, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Comparativo Antes / Depois", margin, 45);

  const colW = (pageW - margin * 2) / 3;
  const startY = 100;
  const rowH = 28;

  const drawHeader = (y: number) => {
    doc.setFillColor(240, 240, 245);
    doc.rect(margin, y - rowH + 8, pageW - margin * 2, rowH, "F");
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Indicador", margin + 5, y);
    doc.text("Baseline", margin + colW + 5, y);
    doc.text("Follow-up", margin + colW * 2 + 5, y);
  };

  drawHeader(startY);
  y = startY + rowH;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const rows = [
    ["Improviso geral", `${baseline.improvisoGeral}`, `${followUp.improvisoGeral}`],
    ["Dependência do dono (IDD)", `${baseline.iddScore}%`, `${followUp.iddScore}%`],
    ["Maturidade", `${baseline.maturity ?? "—"}`, `${followUp.maturity ?? "—"}`],
  ];
  for (const [label, b, f] of rows) {
    doc.text(label, margin + 5, y);
    doc.text(b, margin + colW + 5, y);
    doc.text(f, margin + colW * 2 + 5, y);
    y += rowH;
  }

  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...gold);
  doc.text("Improviso por pilar", margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  for (const p of ["crescimento", "eficiencia", "encantamento", "lideranca"]) {
    const b = baseline.byPillar.find((x: any) => x.pillar === p)?.improviso ?? 0;
    const f = followUp.byPillar.find((x: any) => x.pillar === p)?.improviso ?? 0;
    const delta = f - b;
    const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;
    doc.text(PILLAR_LABEL[p], margin + 5, y);
    doc.text(`${b}`, margin + colW + 5, y);
    doc.text(`${f} (${deltaStr})`, margin + colW * 2 + 5, y);
    y += rowH;
  }

  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...gold);
  doc.text("Top 5 evoluções", margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  const deltas = baseline.blindspots.map((b: any) => {
    const after = followUp.blindspots.find((x: any) => x.code === b.code);
    return { ...b, delta: (after?.improviso ?? b.improviso) - b.improviso };
  }).sort((a: any, b: any) => a.delta - b.delta).slice(0, 5);
  for (const item of deltas) {
    const line = `${item.code} — ${item.title}: ${item.delta > 0 ? "+" : ""}${item.delta}`;
    const lines = doc.splitTextToSize(line, pageW - margin * 2);
    doc.text(lines, margin + 5, y);
    y += lines.length * 14 + 4;
  }

  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...gold);
  doc.text("Pontos de atenção (regressão)", margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  const regressions = baseline.blindspots.map((b: any) => {
    const after = followUp.blindspots.find((x: any) => x.code === b.code);
    return { ...b, delta: (after?.improviso ?? b.improviso) - b.improviso };
  }).sort((a: any, b: any) => b.delta - a.delta).slice(0, 5);
  for (const item of regressions) {
    const line = `${item.code} — ${item.title}: +${item.delta}`;
    const lines = doc.splitTextToSize(line, pageW - margin * 2);
    doc.text(lines, margin + 5, y);
    y += lines.length * 14 + 4;
  }
  addFooter();

  // 90-day plan
  doc.addPage();
  doc.setFillColor(...royal);
  doc.rect(0, 0, pageW, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Plano de 90 dias", margin, 45);

  y = 100;
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const intro = "Metas ativas aprovadas da empresa, organizadas pelos cinco Motores do SEE_4X. Cada meta traz responsável, prazo, indicador e impacto financeiro estimado.";
  const introLines = doc.splitTextToSize(intro, pageW - margin * 2);
  doc.text(introLines, margin, y);
  y += introLines.length * 16 + 14;

  const motorOrder = ["clareza", "prioridade", "execucao", "governanca", "autonomia"];
  for (const motor of motorOrder) {
    const motorGoals = goals.filter((g: any) => (g.motor || motorForPillar(g.pillar)) === motor);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...gold);
    doc.setFontSize(12);
    doc.text(MOTOR_LABEL[motor], margin, y);
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(10);
    if (!motorGoals.length) {
      doc.text("Nenhuma meta ativa neste motor no momento.", margin + 5, y);
      y += 18;
    } else {
      for (const g of motorGoals) {
        const line = `• ${g.title}${g.indicator ? ` — Indicador: ${g.indicator}` : ""}${g.due_date ? ` — Prazo: ${new Date(g.due_date).toLocaleDateString("pt-BR")}` : ""}${g.financial_impact ? ` — Impacto: R$ ${Number(g.financial_impact).toLocaleString("pt-BR")}` : ""}`;
        const lines = doc.splitTextToSize(line, pageW - margin * 2 - 10);
        doc.text(lines, margin + 5, y);
        y += lines.length * 13 + 6;
        if (y > pageH - 80) { doc.addPage(); y = 60; }
      }
    }
    y += 12;
    if (y > pageH - 80) { doc.addPage(); y = 60; }
  }
  addFooter();

  // Validation
  doc.addPage();
  doc.setFillColor(...navy);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setDrawColor(...gold);
  doc.setLineWidth(3);
  doc.rect(30, 30, pageW - 60, pageH - 60);
  doc.setTextColor(...gold);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Validação do relatório", pageW / 2, 120, { align: "center" });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Código: ${code}`, pageW / 2, 170, { align: "center" });
  doc.text("Consulte a autenticidade deste documento na plataforma Mentor 4X.", pageW / 2, 200, { align: "center" });
  doc.setTextColor(200, 200, 220);
  doc.setFontSize(10);
  doc.text("RC360 / Roberta Cardoso · Mentor 4X · SEE_4X", pageW / 2, pageH - 80, { align: "center" });
  addFooter();

  return new Uint8Array(doc.output("arraybuffer"));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub as string;

    const { action, company_id, payload } = await req.json();
    if (!action) {
      return new Response(JSON.stringify({ error: "action required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let isStaff = false;
    if (company_id) {
      const [{ data: s }, { data: m }] = await Promise.all([
        admin.rpc("is_staff", { _user_id: userId }),
        admin.rpc("is_company_member", { _user_id: userId, _company_id: company_id }),
      ]);
      isStaff = !!s;
      if (!s && !m) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (action === "weekly_summary") {
      const text = await callAI(
        `Gere uma ata executiva da reunião semanal em markdown:\n\nFEITO:\n${payload?.done ?? ""}\n\nTRAVOU:\n${payload?.blocked ?? ""}\n\nINDICADORES:\n${payload?.indicators ?? ""}\n\nPRÓXIMOS PASSOS:\n${payload?.next_steps ?? ""}\n\nDECISÕES:\n${payload?.decisions ?? ""}`,
        "Você gera atas executivas concisas e claras do método SEE_4X. A ata é um rascunho até revisão humana."
      );
      await admin.from("ai_logs").insert({ user_id: userId, company_id: company_id ?? null, action, prompt: JSON.stringify(payload).slice(0, 4000), response: text.slice(0, 8000) });
      return new Response(JSON.stringify({ text }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "monthly_report") {
      if (!company_id) return new Response(JSON.stringify({ error: "company_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: c } = await admin.from("companies").select("*").eq("id", company_id).single();
      const { data: g } = await admin.from("goals").select("*").eq("company_id", company_id);
      const { data: b } = await admin.from("bottlenecks").select("*").eq("company_id", company_id);
      const text = await callAI(
        `Gere o relatório do ciclo SEE_4X em texto corrido (sem markdown) para ${c?.name}. Inclua seções: 1) Evolução do score (${c?.overall_score}/100), 2) Metas (${g?.filter((x:any)=>x.status==='concluido').length}/${g?.length} concluídas), 3) Gargalos (${b?.filter((x:any)=>x.resolved).length}/${b?.length} resolvidos), 4) Próximos focos, 5) ROI percebido. Use parágrafos curtos.`,
        "Você gera relatórios executivos premium do método SEE_4X (RC360) em português."
      );
      const title = `Relatório mensal — ${new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`;
      const pdf = buildReportPdf(title, c?.name ?? "Empresa", text);
      const path = `${company_id}/${Date.now()}-mensal.pdf`;
      const up = await admin.storage.from("reports").upload(path, pdf, { contentType: "application/pdf", upsert: false });
      if (up.error) throw up.error;
      await admin.from("reports").insert({
        company_id, generated_by: userId, title,
        period_start: new Date(Date.now() - 30*86400000).toISOString().slice(0,10),
        period_end: new Date().toISOString().slice(0,10),
        summary: { text }, pdf_url: path,
      });
      await admin.from("ai_logs").insert({ user_id: userId, company_id, action, prompt: `monthly_report ${c?.name}`, response: text.slice(0, 8000) });
      return new Response(JSON.stringify({ text, pdf_path: path }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "issue_certificate") {
      if (!company_id) return new Response(JSON.stringify({ error: "company_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (!isStaff) return new Response(JSON.stringify({ error: "Apenas staff pode emitir certificado" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: c } = await admin.from("companies").select("*").eq("id", company_id).single();
      if (!c) return new Response(JSON.stringify({ error: "Empresa não encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const code = `M4X-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const pdf = buildCertificatePdf(c.name, code);
      const path = `${company_id}/cert-${code}.pdf`;
      const up = await admin.storage.from("reports").upload(path, pdf, { contentType: "application/pdf", upsert: false });
      if (up.error) throw up.error;
      const ins = await admin.from("certificates").insert({ company_id, user_id: userId, code, pdf_url: path }).select().single();
      if (ins.error) throw ins.error;
      return new Response(JSON.stringify({ code, pdf_path: path, certificate: ins.data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "generate-report") {
      if (!company_id) return new Response(JSON.stringify({ error: "company_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { baseline_diagnostic_id, follow_up_diagnostic_id } = payload || {};
      if (!baseline_diagnostic_id || !follow_up_diagnostic_id) {
        return new Response(JSON.stringify({ error: "baseline_diagnostic_id and follow_up_diagnostic_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const [{ data: company }, { data: baselineDiag }, { data: followUpDiag }] = await Promise.all([
        admin.from("companies").select("*").eq("id", company_id).single(),
        admin.from("diagnostics").select("*").eq("id", baseline_diagnostic_id).eq("company_id", company_id).single(),
        admin.from("diagnostics").select("*").eq("id", follow_up_diagnostic_id).eq("company_id", company_id).single(),
      ]);
      if (!company || !baselineDiag || !followUpDiag) {
        return new Response(JSON.stringify({ error: "Empresa ou diagnósticos não encontrados" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const [{ data: baseResponses }, { data: followResponses }, { data: goals }] = await Promise.all([
        admin.from("diagnostic_responses").select("*").eq("diagnostic_id", baseline_diagnostic_id),
        admin.from("diagnostic_responses").select("*").eq("diagnostic_id", follow_up_diagnostic_id),
        admin.from("goals").select("*").eq("company_id", company_id).in("status", ["nao_iniciado", "em_andamento", "atrasado", "bloqueado"]).eq("approval_status", "aprovada"),
      ]);

      const baseline = getDiagnosticResult(baselineDiag, baseResponses || []);
      const followUp = getDiagnosticResult(followUpDiag, followResponses || []);
      if (!baseline || !followUp) {
        return new Response(JSON.stringify({ error: "Não foi possível computar os resultados dos diagnósticos" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const code = `R4X-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const pdf = buildSee4xReportPdf(company.name, baseline, followUp, goals || [], code);
      const path = `${company_id}/see4x-${Date.now()}.pdf`;
      const up = await admin.storage.from("reports").upload(path, pdf, { contentType: "application/pdf", upsert: false });
      if (up.error) throw up.error;

      const summary = {
        baseline_diagnostic_id,
        follow_up_diagnostic_id,
        baseline_improviso: baseline.improvisoGeral,
        follow_up_improviso: followUp.improvisoGeral,
        baseline_idd: baseline.iddScore,
        follow_up_idd: followUp.iddScore,
        code,
      };
      const title = `Relatório SEE_4X — ${baselineDiag.title || "Baseline"} vs ${followUpDiag.title || "Follow-up"}`;
      const ins = await admin.from("reports").insert({
        company_id,
        generated_by: userId,
        title,
        period_start: baselineDiag.created_at?.slice(0, 10),
        period_end: followUpDiag.created_at?.slice(0, 10),
        summary,
        pdf_url: path,
      }).select().single();
      if (ins.error) throw ins.error;

      await admin.from("ai_logs").insert({ user_id: userId, company_id, action, prompt: `generate-report ${baseline_diagnostic_id} ${follow_up_diagnostic_id}`, response: JSON.stringify(summary).slice(0, 8000) });
      return new Response(JSON.stringify({ code, pdf_path: path, report: ins.data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
