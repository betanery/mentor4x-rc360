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

    return new Response(JSON.stringify({ error: "unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
