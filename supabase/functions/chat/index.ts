import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { messages, company_id } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    // Build context from company
    let context = "";
    if (company_id) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const [{ data: c }, { data: g }, { data: b }, { data: p }] = await Promise.all([
        supabase.from("companies").select("*").eq("id", company_id).single(),
        supabase.from("goals").select("title,status,financial_impact,pillar").eq("company_id", company_id).limit(20),
        supabase.from("bottlenecks").select("name,urgency,estimated_value,resolved").eq("company_id", company_id).limit(10),
        supabase.from("pillar_scores").select("pillar,score").eq("company_id", company_id).order("measured_at", { ascending: false }).limit(8),
      ]);
      context = `\n\nCONTEXTO DA EMPRESA:\nNome: ${c?.name}\nEstágio: ${c?.journey_stage}\nCaos: ${c?.chaos_level}\nScore geral: ${c?.overall_score}\nDependência do dono: ${c?.owner_dependency}%\nReceita projetada: R$ ${c?.projected_revenue}\n\nMETAS (${g?.length || 0}): ${JSON.stringify(g)}\nGARGALOS: ${JSON.stringify(b)}\nSCORES PILARES: ${JSON.stringify(p)}`;
    }

    const systemPrompt = `Você é "Meu Sócio IA", o conselheiro estratégico do método MENTOR 4X.
Método: 4 pilares (Crescimento, Eficiência, Encantamento, Liderança), execução com 2 metas críticas/semana, foco em sair do caos para escala em 4 meses.
Responda em português brasileiro, direto, executivo, com bullets quando útil. Use markdown.${context}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (response.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!response.ok) {
      const t = await response.text();
      return new Response(JSON.stringify({ error: t }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
