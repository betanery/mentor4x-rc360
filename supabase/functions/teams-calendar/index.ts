import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCompanyAuthorization } from "../_shared/company-authorization.ts";
import { corsHeadersFor, originAllowed } from "../_shared/cors.ts";

type Host = {
  id: string;
  user_id: string;
  display_name: string;
  microsoft_email: string;
  active: boolean;
  allow_client_booking: boolean;
  timezone: string;
  graph_timezone: string;
  workday_start: string;
  workday_end: string;
  slot_duration_min: number;
  buffer_min: number;
  booking_window_days: number;
  minimum_notice_hours: number;
};

type ScheduleItem = {
  status?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
};

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Configuração ausente: ${name}`);
  return value;
}

async function graphToken() {
  const tenant = requiredEnv("MS_GRAPH_TENANT_ID");
  const clientId = requiredEnv("MS_GRAPH_CLIENT_ID");
  const clientSecret = requiredEnv("MS_GRAPH_CLIENT_SECRET");
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const response = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error(`Falha ao autenticar no Microsoft Graph: ${payload.error_description || payload.error || response.status}`);
  }
  return payload.access_token as string;
}

async function graphFetch(path: string, init: RequestInit = {}) {
  const token = await graphToken();
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Microsoft Graph respondeu ${response.status}`);
  }
  return payload;
}

function datePartsInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    year: Number(map.year), month: Number(map.month), day: Number(map.day),
    hour: Number(map.hour), minute: Number(map.minute), second: Number(map.second),
  };
}

function zonedLocalToUtc(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.slice(0, 5).split(":").map(Number);
  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  for (let i = 0; i < 2; i++) {
    const p = datePartsInZone(guess, timeZone);
    const represented = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
    guess = new Date(guess.getTime() + (desired - represented));
  }
  return guess;
}

function localDate(date: Date, timeZone: string) {
  const p = datePartsInZone(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function minutesOf(time: string) {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function timeOfMinutes(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function isBusinessDay(date: string, timeZone: string) {
  const noon = zonedLocalToUtc(date, "12:00", timeZone);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(noon);
  return !["Sat", "Sun"].includes(weekday);
}

function eachDate(startDate: string, endDate: string) {
  const out: string[] = [];
  const cursor = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  while (cursor <= end && out.length < 190) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function overlaps(start: Date, end: Date, item: ScheduleItem) {
  if (!item.start?.dateTime || !item.end?.dateTime) return false;
  const busyStart = new Date(item.start.dateTime.endsWith("Z") ? item.start.dateTime : `${item.start.dateTime}Z`);
  const busyEnd = new Date(item.end.dateTime.endsWith("Z") ? item.end.dateTime : `${item.end.dateTime}Z`);
  return start < busyEnd && end > busyStart;
}

async function getBusyItems(host: Host, start: Date, end: Date): Promise<ScheduleItem[]> {
  const payload = await graphFetch(`/users/${encodeURIComponent(host.microsoft_email)}/calendar/getSchedule`, {
    method: "POST",
    headers: { Prefer: 'outlook.timezone="UTC"' },
    body: JSON.stringify({
      schedules: [host.microsoft_email],
      startTime: { dateTime: start.toISOString().replace("Z", ""), timeZone: "UTC" },
      endTime: { dateTime: end.toISOString().replace("Z", ""), timeZone: "UTC" },
      availabilityViewInterval: 15,
    }),
  });
  return payload?.value?.[0]?.scheduleItems || [];
}

function validateSlot(host: Host, start: Date, durationMin: number) {
  const now = new Date();
  const earliest = new Date(now.getTime() + host.minimum_notice_hours * 60 * 60 * 1000);
  const latest = new Date(now.getTime() + host.booking_window_days * 24 * 60 * 60 * 1000);
  if (start < earliest) throw new Error(`Este horário exige antecedência mínima de ${host.minimum_notice_hours}h.`);
  if (start > latest) throw new Error(`A agenda está aberta por ${host.booking_window_days} dias.`);
  const date = localDate(start, host.timezone);
  if (!isBusinessDay(date, host.timezone)) throw new Error("O horário escolhido está fora dos dias úteis configurados.");
  const p = datePartsInZone(start, host.timezone);
  const startMinutes = p.hour * 60 + p.minute;
  const endMinutes = startMinutes + durationMin;
  if (startMinutes < minutesOf(host.workday_start) || endMinutes > minutesOf(host.workday_end)) {
    throw new Error("O horário escolhido está fora da janela de atendimento.");
  }
}

async function resolveHost(admin: ReturnType<typeof createClient>, hostId: string) {
  const { data, error } = await admin.from("calendar_booking_hosts").select("*").eq("id", hostId).eq("active", true).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Agenda não encontrada ou inativa.");
  return data as Host;
}

async function resolveContract(admin: ReturnType<typeof createClient>, companyId: string, contractId?: string | null) {
  if (!contractId) return null;
  const { data, error } = await admin.from("contracts").select("id, company_id").eq("id", contractId).eq("company_id", companyId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Produto contratado inválido para esta empresa.");
  return data.id as string;
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (!originAllowed(req)) return json({ error: "Origem não autorizada." }, 403, cors);
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405, cors);

  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = requiredEnv("SUPABASE_ANON_KEY");
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Não autenticado." }, 401, cors);

    const body = await req.json();
    const action = String(body.action || "");
    const companyId = String(body.company_id || "");
    if (!companyId) return json({ error: "company_id é obrigatório." }, 400, cors);
    const auth = await getCompanyAuthorization(admin, user.id, companyId);
    if (!auth.allowed) return json({ error: "Sem acesso a esta empresa." }, 403, cors);
    const contractId = await resolveContract(admin, companyId, body.contract_id || null);

    if (action === "organizers") {
      const { data, error } = await admin
        .from("calendar_booking_hosts")
        .select("id, display_name, slot_duration_min, timezone, booking_window_days, minimum_notice_hours")
        .eq("active", true)
        .eq("allow_client_booking", true)
        .order("display_name");
      if (error) throw error;
      return json({ organizers: data || [] }, 200, cors);
    }

    if (action === "upsert_my_host") {
      if (!auth.is_staff) return json({ error: "Somente equipe 4X pode configurar agenda." }, 403, cors);
      const microsoftEmail = String(body.microsoft_email || user.email || "").trim().toLowerCase();
      if (!microsoftEmail.includes("@")) return json({ error: "Informe o e-mail Microsoft 365 da agenda." }, 400, cors);
      const displayName = String(body.display_name || user.email?.split("@")[0] || "Consultor 4X").trim();
      const payload = {
        user_id: user.id,
        microsoft_email: microsoftEmail,
        display_name: displayName,
        active: true,
        allow_client_booking: body.allow_client_booking !== false,
        timezone: String(body.timezone || "America/Sao_Paulo"),
        graph_timezone: "UTC",
        workday_start: String(body.workday_start || "09:00"),
        workday_end: String(body.workday_end || "18:00"),
        slot_duration_min: Number(body.slot_duration_min || 60),
        buffer_min: Number(body.buffer_min ?? 15),
        booking_window_days: Number(body.booking_window_days || 30),
        minimum_notice_hours: Number(body.minimum_notice_hours ?? 24),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await admin.from("calendar_booking_hosts").upsert(payload, { onConflict: "user_id" }).select("id, display_name, microsoft_email").single();
      if (error) throw error;
      return json({ host: data }, 200, cors);
    }

    if (action === "availability") {
      const host = await resolveHost(admin, String(body.organizer_id || ""));
      const today = localDate(new Date(), host.timezone);
      const startDate = String(body.start_date || today);
      const maxEnd = new Date(`${today}T12:00:00Z`);
      maxEnd.setUTCDate(maxEnd.getUTCDate() + host.booking_window_days);
      const requestedEnd = String(body.end_date || maxEnd.toISOString().slice(0, 10));
      const endDate = requestedEnd > maxEnd.toISOString().slice(0, 10) ? maxEnd.toISOString().slice(0, 10) : requestedEnd;
      const queryStart = zonedLocalToUtc(startDate, "00:00", host.timezone);
      const dayAfterEnd = new Date(`${endDate}T12:00:00Z`);
      dayAfterEnd.setUTCDate(dayAfterEnd.getUTCDate() + 1);
      const queryEnd = zonedLocalToUtc(dayAfterEnd.toISOString().slice(0, 10), "00:00", host.timezone);
      const busy = await getBusyItems(host, queryStart, queryEnd);
      const duration = host.slot_duration_min;
      const slots: { start_at: string; end_at: string; local_date: string; local_time: string }[] = [];
      for (const date of eachDate(startDate, endDate)) {
        if (!isBusinessDay(date, host.timezone)) continue;
        for (let minute = minutesOf(host.workday_start); minute + duration <= minutesOf(host.workday_end); minute += duration + host.buffer_min) {
          const start = zonedLocalToUtc(date, timeOfMinutes(minute), host.timezone);
          const end = new Date(start.getTime() + duration * 60 * 1000);
          try { validateSlot(host, start, duration); } catch { continue; }
          const guardedStart = new Date(start.getTime() - host.buffer_min * 60 * 1000);
          const guardedEnd = new Date(end.getTime() + host.buffer_min * 60 * 1000);
          if (busy.some((item) => overlaps(guardedStart, guardedEnd, item))) continue;
          slots.push({ start_at: start.toISOString(), end_at: end.toISOString(), local_date: date, local_time: timeOfMinutes(minute) });
        }
      }
      return json({ organizer: { id: host.id, display_name: host.display_name, timezone: host.timezone, duration_min: duration }, slots }, 200, cors);
    }

    if (action === "book") {
      const host = await resolveHost(admin, String(body.organizer_id || ""));
      const start = new Date(String(body.start_at || ""));
      if (Number.isNaN(start.getTime())) return json({ error: "Horário inválido." }, 400, cors);
      const duration = host.slot_duration_min;
      validateSlot(host, start, duration);
      const end = new Date(start.getTime() + duration * 60 * 1000);
      const guardedStart = new Date(start.getTime() - host.buffer_min * 60 * 1000);
      const guardedEnd = new Date(end.getTime() + host.buffer_min * 60 * 1000);
      const busy = await getBusyItems(host, guardedStart, guardedEnd);
      if (busy.some((item) => overlaps(guardedStart, guardedEnd, item))) {
        return json({ error: "Este horário acabou de ficar indisponível. Escolha outro horário." }, 409, cors);
      }

      const { data: company, error: companyError } = await admin.from("companies").select("name").eq("id", companyId).single();
      if (companyError) throw companyError;
      const attendeeEmail = String(body.attendee_email || user.email || "").trim().toLowerCase();
      if (!attendeeEmail.includes("@")) return json({ error: "O participante precisa ter um e-mail válido para receber o convite." }, 400, cors);
      const attendeeName = String(body.attendee_name || attendeeEmail.split("@")[0]);
      const subject = String(body.title || `Sala de Guerra 4X · ${company.name}`).trim();
      const agenda = String(body.agenda || "Encontro de acompanhamento da Jornada 4X.").trim();
      const transactionId = crypto.randomUUID();

      const event = await graphFetch(`/users/${encodeURIComponent(host.microsoft_email)}/events`, {
        method: "POST",
        headers: { Prefer: 'outlook.timezone="UTC"' },
        body: JSON.stringify({
          subject,
          body: { contentType: "HTML", content: `<p>${agenda.replaceAll("\n", "<br>")}</p><p><strong>Empresa:</strong> ${company.name}</p><p>Agendado pelo Mentor 4X.</p>` },
          start: { dateTime: start.toISOString().replace("Z", ""), timeZone: "UTC" },
          end: { dateTime: end.toISOString().replace("Z", ""), timeZone: "UTC" },
          attendees: [{ emailAddress: { address: attendeeEmail, name: attendeeName }, type: "required" }],
          isOnlineMeeting: true,
          onlineMeetingProvider: "teamsForBusiness",
          allowNewTimeProposals: false,
          responseRequested: true,
          isReminderOn: true,
          reminderMinutesBeforeStart: 30,
          transactionId,
        }),
      });

      const joinUrl = event?.onlineMeeting?.joinUrl || event?.onlineMeetingUrl || null;
      const meetingPayload = {
        company_id: companyId,
        contract_id: contractId,
        title: subject,
        meeting_type: body.meeting_type || "sala_guerra",
        scheduled_at: start.toISOString(),
        duration_min: duration,
        agenda,
        meeting_url: joinUrl,
        teams_join_url: joinUrl,
        location: "Microsoft Teams",
        created_by: user.id,
        booked_by_user_id: user.id,
        calendar_provider: "microsoft365",
        calendar_host_user_id: host.user_id,
        calendar_host_email: host.microsoft_email,
        external_event_id: event.id,
        attendee_emails: [attendeeEmail],
        calendar_sync_status: "synced",
        recurrence: "nenhuma",
        status: "agendada",
      };
      const { data: meeting, error: meetingError } = await admin.from("meetings").insert(meetingPayload).select("id, scheduled_at, meeting_url, title").single();
      if (meetingError) {
        try { await graphFetch(`/users/${encodeURIComponent(host.microsoft_email)}/events/${encodeURIComponent(event.id)}`, { method: "DELETE" }); } catch { /* compensating delete best-effort */ }
        throw meetingError;
      }
      return json({ meeting, teams_join_url: joinUrl, organizer: host.display_name }, 200, cors);
    }

    return json({ error: "Ação inválida." }, 400, cors);
  } catch (error) {
    console.error("teams-calendar", error);
    return json({ error: error instanceof Error ? error.message : "Erro inesperado na agenda Microsoft." }, 500, corsHeadersFor(req));
  }
});
