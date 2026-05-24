import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    if (company_id) {
      const [{ data: isStaff }, { data: isMember }] = await Promise.all([
        admin.rpc("is_staff", { _user_id: userId }),
        admin.rpc("is_company_member", { _user_id: userId, _company_id: company_id }),
      ]);
      if (!isStaff && !isMember) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (action === "weekly_summary") {
      const text = await callAI(
        `Gere uma ata executiva da reunião semanal em markdown:\n\nFEITO:\n${payload?.done ?? ""}\n\nTRAVOU:\n${payload?.blocked ?? ""}\n\nINDICADORES:\n${payload?.indicators ?? ""}\n\nPRÓXIMOS PASSOS:\n${payload?.next_steps ?? ""}\n\nDECISÕES:\n${payload?.decisions ?? ""}`,
        "Você gera atas executivas concisas e claras do método MENTOR 4X."
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
        `Gere o relatório mensal MENTOR 4X em markdown para ${c?.name}. Inclua: evolução do score (${c?.overall_score}/100), metas concluídas (${g?.filter((x:any)=>x.status==='concluido').length}/${g?.length}), gargalos resolvidos (${b?.filter((x:any)=>x.resolved).length}/${b?.length}), próximos focos e ROI percebido.`,
        "Você gera relatórios executivos premium do método MENTOR 4X em português."
      );
      await admin.from("reports").insert({
        company_id,
        generated_by: userId,
        title: `Relatório mensal — ${new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`,
        period_start: new Date(Date.now() - 30*86400000).toISOString().slice(0,10),
        period_end: new Date().toISOString().slice(0,10),
        summary: { text },
      });
      await admin.from("ai_logs").insert({ user_id: userId, company_id, action, prompt: `monthly_report ${c?.name}`, response: text.slice(0, 8000) });
      return new Response(JSON.stringify({ text }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
