import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

type NewNotification = {
  user_id: string;
  company_id: string;
  type: string;
  title: string;
  message: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const provided = req.headers.get("x-cron-key");
  if (!CRON_SECRET || provided !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in3d = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const daysAgo45 = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
  const daysAgo14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const iso = (d: Date) => d.toISOString();
  const day = (d: Date) => d.toISOString().slice(0, 10);

  const [members, meetings, goals, cycles, bottlenecks] = await Promise.all([
    db.from("company_members").select("company_id, user_id"),
    db.from("meetings").select("id, company_id, title, scheduled_at")
      .gte("scheduled_at", iso(now)).lte("scheduled_at", iso(in24h)),
    db.from("goals").select("id, company_id, title, due_date, status")
      .in("status", ["nao_iniciado", "em_andamento", "bloqueado"])
      .not("due_date", "is", null).lte("due_date", day(in3d)).gte("due_date", day(now)),
    db.from("cycle_records").select("id, company_id, cycle, started_at")
      .is("closed_at", null).lte("started_at", iso(daysAgo45)),
    db.from("bottlenecks").select("id, company_id, name, progress, updated_at")
      .eq("resolved", false).lte("updated_at", iso(daysAgo14)),
  ]);

  const err = [members, meetings, goals, cycles, bottlenecks].find((r) => r.error);
  if (err?.error) {
    console.error("daily-alerts query failed:", err.error.message);
    return new Response(JSON.stringify({ error: err.error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const byCompany = new Map<string, string[]>();
  for (const m of members.data ?? []) {
    const list = byCompany.get(m.company_id) ?? [];
    list.push(m.user_id);
    byCompany.set(m.company_id, list);
  }

  const pending: NewNotification[] = [];
  const push = (companyId: string, type: string, title: string, message: string) => {
    for (const userId of byCompany.get(companyId) ?? []) {
      pending.push({ user_id: userId, company_id: companyId, type, title, message });
    }
  };

  for (const m of meetings.data ?? []) {
    push(m.company_id, "meeting_soon", `Reunião em menos de 24h: ${m.title}`,
      `Agendada para ${new Date(m.scheduled_at).toLocaleString("pt-BR")}.`);
  }
  for (const g of goals.data ?? []) {
    push(g.company_id, "goal_due", `Meta vencendo: ${g.title}`,
      `Prazo em ${new Date(g.due_date as string).toLocaleDateString("pt-BR")}. Atualize o andamento ou registre evidência.`);
  }
  for (const c of cycles.data ?? []) {
    push(c.company_id, "cycle_stalled", `Ciclo aberto há mais de 45 dias`,
      `O ciclo ${c.cycle} segue aberto. Avalie o fechamento com evidências no Gate.`);
  }
  for (const b of bottlenecks.data ?? []) {
    push(b.company_id, "bottleneck_stalled", `Gargalo sem movimento: ${b.name}`,
      `Sem atualização há 14 dias (progresso ${b.progress}%). Revise o plano de correção.`);
  }

  // Evita duplicar o mesmo alerta no mesmo dia
  const { data: today, error: todayErr } = await db
    .from("notifications")
    .select("user_id, type, title")
    .gte("created_at", `${day(now)}T00:00:00Z`);
  if (todayErr) {
    console.error("daily-alerts dedupe failed:", todayErr.message);
  }
  const seen = new Set((today ?? []).map((n) => `${n.user_id}|${n.type}|${n.title}`));
  const toInsert = pending.filter((n) => {
    const key = `${n.user_id}|${n.type}|${n.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (toInsert.length > 0) {
    const { error } = await db.from("notifications").insert(toInsert);
    if (error) {
      console.error("daily-alerts insert failed:", error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ created: toInsert.length, scanned: pending.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
