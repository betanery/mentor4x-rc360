import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let code = url.searchParams.get("code") ?? "";
    if (!code && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      code = typeof body?.code === "string" ? body.code : "";
    }
    code = code.trim().toUpperCase();

    // Códigos são curtos e alfanuméricos — evita varredura por padrões livres.
    if (!/^[A-Z0-9-]{4,40}$/.test(code)) {
      return json({ valid: false, reason: "invalid_format" });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data, error } = await admin
      .from("certificates")
      .select("code, issued_at, company_id")
      .ilike("code", code)
      .maybeSingle();

    if (error) return json({ valid: false, reason: "lookup_failed" }, 500);
    if (!data) return json({ valid: false, reason: "not_found" });

    const { data: company } = await admin
      .from("companies")
      .select("name, journey_stage")
      .eq("id", data.company_id)
      .maybeSingle();

    // Apenas dados públicos de validação — nada de IDs internos.
    return json({
      valid: true,
      code: data.code,
      issued_at: data.issued_at,
      company_name: company?.name ?? null,
      journey_stage: company?.journey_stage ?? null,
    });
  } catch (_e) {
    return json({ valid: false, reason: "unexpected_error" }, 500);
  }
});
