import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOTCONVERSA_KEY = Deno.env.get("BOTCONVERSA_API_KEY");
const EMAIL_WEBHOOK_URL = Deno.env.get("CRM_EMAIL_WEBHOOK_URL");
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const BOT_BASE = "https://backend.botconversa.com.br/api/v1/webhook";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

async function sendWhatsApp(phone: string, message: string) {
  if (!BOTCONVERSA_KEY) throw new Error("BOTCONVERSA_API_KEY not configured");
  const normalized = phone.replace(/\D/g, "");
  const withCountry = normalized.startsWith("55") ? normalized : `55${normalized}`;

  const findRes = await fetch(`${BOT_BASE}/subscriber/get_by_phone/${withCountry}/`, {
    headers: { "API-KEY": BOTCONVERSA_KEY },
  });
  if (!findRes.ok) throw new Error(`BotConversa subscriber lookup failed: ${findRes.status}`);
  const subscriber = await findRes.json();
  const subscriberId = subscriber?.id;
  if (!subscriberId) throw new Error("BotConversa subscriber not found");

  const sendRes = await fetch(`${BOT_BASE}/subscriber/${subscriberId}/send_message/`, {
    method: "POST",
    headers: { "API-KEY": BOTCONVERSA_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "text", value: message }),
  });
  if (!sendRes.ok) throw new Error(`BotConversa send failed: ${sendRes.status}`);
}

async function sendEmail(email: string, subject: string, message: string, metadata: Record<string, unknown>) {
  if (!EMAIL_WEBHOOK_URL) throw new Error("CRM_EMAIL_WEBHOOK_URL not configured");
  const res = await fetch(EMAIL_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: email, subject, message, metadata }),
  });
  if (!res.ok) throw new Error(`Email webhook failed: ${res.status}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!CRON_SECRET || req.headers.get("x-cron-key") !== CRON_SECRET) return json({ error: "unauthorized" }, 401);

  const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: queue, error } = await db
    .from("crm_automation_queue")
    .select("*, crm_contacts(id,name,email,phone,whatsapp_opt_in,email_opt_in)")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(50);

  if (error) return json({ error: error.message }, 500);

  let sent = 0, failed = 0, blocked = 0;
  for (const item of queue ?? []) {
    const contact = item.crm_contacts;
    try {
      await db.from("crm_automation_queue").update({ status: "processing", attempts: item.attempts + 1 }).eq("id", item.id);
      if (item.channel === "whatsapp") {
        if (!contact?.whatsapp_opt_in || !contact?.phone) {
          blocked++;
          await db.from("crm_automation_queue").update({ status: "blocked", last_error: "WhatsApp sem opt-in ou telefone" }).eq("id", item.id);
          continue;
        }
        await sendWhatsApp(contact.phone, item.message || "");
      } else {
        if (!contact?.email_opt_in || !contact?.email) {
          blocked++;
          await db.from("crm_automation_queue").update({ status: "blocked", last_error: "E-mail sem opt-in ou endereço" }).eq("id", item.id);
          continue;
        }
        await sendEmail(contact.email, item.subject || "RC360", item.message || "", item.metadata || {});
      }
      sent++;
      await db.from("crm_automation_queue").update({ status: "sent", sent_at: new Date().toISOString(), last_error: null }).eq("id", item.id);
      await db.from("crm_contacts").update({ last_contact_at: new Date().toISOString() }).eq("id", item.contact_id);
      await db.from("crm_activities").insert({
        contact_id: item.contact_id,
        opportunity_id: item.opportunity_id,
        activity_type: item.channel,
        title: `Automação: ${item.automation_type}`,
        notes: item.message,
        completed_at: new Date().toISOString(),
      });
    } catch (e) {
      failed++;
      await db.from("crm_automation_queue").update({
        status: item.attempts + 1 >= 3 ? "failed" : "pending",
        last_error: e instanceof Error ? e.message : String(e),
      }).eq("id", item.id);
    }
  }

  return json({ scanned: queue?.length ?? 0, sent, failed, blocked });
});