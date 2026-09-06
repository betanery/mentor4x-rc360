import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const normalizePhone = (value: unknown) => {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return null;
  return digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const { data: staff } = await userClient.rpc("is_staff", { _user_id: user.id });
  if (!staff) return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => null) as { rows?: Record<string, unknown>[] } | null;
  const rows = body?.rows || [];
  if (!Array.isArray(rows) || rows.length === 0) return json({ error: "rows_required" }, 400);
  if (rows.length > 1000) return json({ error: "max_1000_rows" }, 400);

  const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  let created = 0, updated = 0, skipped = 0;
  const errors: { row: number; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const name = String(row.name || row.nome || "").trim();
      const email = String(row.email || "").trim().toLowerCase() || null;
      const phone = normalizePhone(row.phone || row.telefone || row.whatsapp);
      if (!name || (!email && !phone)) { skipped++; continue; }

      let query = db.from("crm_contacts").select("*").limit(1);
      if (phone) query = query.eq("phone", phone);
      else query = query.eq("email", email);
      const { data: existing } = await query.maybeSingle();

      const rawTags = row.tags || row.etiquetas || [];
      const rowTags = Array.isArray(rawTags)
        ? rawTags.map(String)
        : String(rawTags).split(",").map((t) => t.trim()).filter(Boolean);

      if (existing) {
        const tags = Array.from(new Set([...(existing.tags || []), ...rowTags]));
        await db.from("crm_contacts").update({
          name: name || existing.name,
          company_name: String(row.company_name || row.empresa || existing.company_name || "") || null,
          source: String(row.source || row.origem || existing.source || "") || null,
          event_name: String(row.event_name || row.evento || existing.event_name || "") || null,
          tags,
        }).eq("id", existing.id);
        updated++;
      } else {
        const { data: contact, error } = await db.from("crm_contacts").insert({
          name,
          email,
          phone,
          company_name: String(row.company_name || row.empresa || "") || null,
          source: String(row.source || row.origem || "") || null,
          event_name: String(row.event_name || row.evento || "") || null,
          tags: rowTags,
          created_by: user.id,
        }).select("id").single();
        if (error) throw error;

        const product = String(row.product || row.produto || "") || null;
        const value = Number(row.value || row.valor || 0) || 0;
        await db.from("crm_opportunities").insert({
          contact_id: contact.id,
          title: product ? `${product} · ${name}` : `Oportunidade · ${name}`,
          product,
          value,
          stage: String(row.stage || row.estagio || "novo"),
          owner_user_id: user.id,
          created_by: user.id,
        });
        created++;
      }
    } catch (e) {
      errors.push({ row: i + 1, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return json({ total: rows.length, created, updated, skipped, errors: errors.slice(0, 50) });
});