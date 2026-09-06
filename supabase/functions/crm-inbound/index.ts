import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("CRM_WEBHOOK_SECRET");

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const pick = (obj: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return null;
};
const normalizePhone = (value: unknown) => {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, "");
  return digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!WEBHOOK_SECRET || req.headers.get("x-crm-webhook-secret") !== WEBHOOK_SECRET) return json({ error: "unauthorized" }, 401);

  const payload = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!payload) return json({ error: "invalid_json" }, 400);

  const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const provider = String(pick(payload, ["provider", "source", "platform"]) || "webhook").toLowerCase();
  const eventType = String(pick(payload, ["event_type", "event", "type", "status"]) || "lead").toLowerCase();
  const externalEventId = pick(payload, ["event_id", "id", "transaction_id", "order_id"]);

  if (externalEventId) {
    const { data: duplicate } = await db.from("crm_external_events").select("id").eq("provider", provider).eq("external_event_id", String(externalEventId)).maybeSingle();
    if (duplicate) return json({ ok: true, duplicate: true, event_id: duplicate.id });
  }

  const nested = (payload.customer || payload.contact || payload.buyer || {}) as Record<string, unknown>;
  const source = { ...payload, ...nested };
  const name = String(pick(source, ["name", "full_name", "customer_name", "buyer_name"]) || "Contato sem nome");
  const phone = normalizePhone(pick(source, ["phone", "whatsapp", "mobile", "telephone"]));
  const emailValue = pick(source, ["email", "customer_email", "buyer_email"]);
  const email = emailValue ? String(emailValue).toLowerCase() : null;
  const productValue = pick(payload, ["product", "product_name", "offer_name", "item_name"]);
  const product = productValue ? String(productValue) : null;
  const value = Number(pick(payload, ["value", "amount", "price", "total"]) || 0) || 0;
  const eventNameValue = pick(payload, ["event_name", "campaign", "event_title"]);
  const eventName = eventNameValue ? String(eventNameValue) : null;

  let contactQuery = db.from("crm_contacts").select("*").limit(1);
  if (phone) contactQuery = contactQuery.eq("phone", phone);
  else if (email) contactQuery = contactQuery.eq("email", email);
  else return json({ error: "phone_or_email_required" }, 400);

  const { data: found } = await contactQuery.maybeSingle();
  let contact = found;
  const inferredTags = [provider];
  if (eventType.includes("abandon")) inferredTags.push("Carrinho Abandonado");
  if (eventType.includes("purchase") || eventType.includes("approved") || eventType.includes("paid")) inferredTags.push("Compra Aprovada");

  if (!contact) {
    const { data, error } = await db.from("crm_contacts").insert({ name, email, phone, source: provider, event_name: eventName, tags: inferredTags }).select("*").single();
    if (error) return json({ error: error.message }, 500);
    contact = data;
  } else {
    const tags = Array.from(new Set([...(contact.tags || []), ...inferredTags]));
    await db.from("crm_contacts").update({ tags, event_name: eventName || contact.event_name }).eq("id", contact.id);
  }

  let stage = "novo";
  if (eventType.includes("abandon")) stage = "recuperacao";
  if (eventType.includes("purchase") || eventType.includes("approved") || eventType.includes("paid")) stage = "ganho";

  const { data: existingOpp } = await db.from("crm_opportunities").select("*").eq("contact_id", contact.id).eq("product", product).not("stage", "eq", "ganho").order("created_at", { ascending: false }).limit(1).maybeSingle();
  let opportunity = existingOpp;
  if (opportunity) {
    const { data } = await db.from("crm_opportunities").update({ stage, value: value || opportunity.value }).eq("id", opportunity.id).select("*").single();
    opportunity = data;
  } else {
    const { data, error } = await db.from("crm_opportunities").insert({ contact_id: contact.id, title: product ? `${product} · ${name}` : `Oportunidade · ${name}`, product, value, stage, loss_reason: eventType.includes("abandon") ? "Carrinho abandonado" : null }).select("*").single();
    if (error) return json({ error: error.message }, 500);
    opportunity = data;
  }

  const { data: evt, error: evtError } = await db.from("crm_external_events").insert({ provider, event_type: eventType, external_event_id: externalEventId ? String(externalEventId) : null, contact_id: contact.id, opportunity_id: opportunity.id, payload, processed: true, processed_at: new Date().toISOString() }).select("id").single();
  if (evtError) return json({ error: evtError.message }, 500);

  if (stage === "recuperacao") {
    await db.from("crm_activities").insert({ contact_id: contact.id, opportunity_id: opportunity.id, activity_type: "task", title: "Recuperar carrinho abandonado", notes: `Evento recebido de ${provider}`, due_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() });
  }

  return json({ ok: true, event_id: evt.id, contact_id: contact.id, opportunity_id: opportunity.id, stage });
});