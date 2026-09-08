import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { outlookFetch, OUTLOOK_GATEWAY } from "../../supabase/functions/_shared/outlook-gateway";

const state = vi.hoisted(() => ({ client: null as any }));
vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({ createClient: () => state.client }));
let handler: (req: Request) => Promise<Response>;
const host = {
  id: "host-1", user_id: "mentor-1", display_name: "Consultora", microsoft_email: "mentor@example.com",
  active: true, allow_client_booking: true, timezone: "America/Sao_Paulo", graph_timezone: "UTC",
  workday_start: "09:00", workday_end: "18:00", slot_duration_min: 60, buffer_min: 15,
  booking_window_days: 30, minimum_notice_hours: 24,
};
let insert: ReturnType<typeof vi.fn>;
let upsert: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;
let meetingError: any;
let allowed = true;
let staff = true;
const env = { get: (name: string) => ({ LOVABLE_API_KEY: "test-lovable", MICROSOFT_OUTLOOK_API_KEY: "test-outlook", SUPABASE_URL: "http://localhost", SUPABASE_SERVICE_ROLE_KEY: "test-service", SUPABASE_ANON_KEY: "test-anon" }[name]) };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const call = (body: Record<string, unknown>) => handler(new Request("http://localhost", {
  method: "POST", headers: { Authorization: "Bearer user", "Content-Type": "application/json" },
  body: JSON.stringify({ company_id: "company-1", ...body }),
}));
const book = { action: "book", organizer_id: host.id, start_at: "2026-09-09T12:00:00Z" };

beforeAll(async () => {
  vi.stubGlobal("Deno", { env, serve: (fn: typeof handler) => { handler = fn; } });
  await import("../../supabase/functions/teams-calendar/index");
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-07T12:00:00Z"));
  allowed = true; staff = true; meetingError = null;
  insert = vi.fn(); upsert = vi.fn();
  state.client = {
    auth: { getUser: async () => ({ data: { user: { id: "user-1", email: "client@example.com" } } }) },
    rpc: async () => ({ data: { allowed, is_staff: staff } }),
    from: (table: string) => {
      const chain: any = {
        select: () => chain, eq: () => chain, order: async () => ({ data: [host] }),
        maybeSingle: async () => ({ data: host }),
        upsert: (value: any) => { upsert(value); return chain; },
        insert: (value: any) => { insert(value); return chain; },
        single: async () => table === "meetings"
          ? { data: { id: "meeting-1", meeting_url: "https://teams.microsoft.com/l/meetup-join/test" }, error: meetingError }
          : { data: table === "companies" ? { name: "Empresa" } : host },
      };
      return chain;
    },
  };
  fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    if (init.method === "DELETE") return new Response(null, { status: 204 });
    if (_url.includes("getSchedule")) return response({ value: [{ scheduleItems: [] }] });
    if (_url.includes("?$select")) return response({ canEdit: true, allowedOnlineMeetingProviders: ["teamsForBusiness"] });
    return response({ id: "event-1", onlineMeeting: { joinUrl: "https://teams.microsoft.com/l/meetup-join/test" } }, 201);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.useRealTimers(); });

describe("Outlook gateway contract", () => {
  it("checks availability, creates a Teams invite and persists the event in meetings", async () => {
    expect((await call(book)).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [url, init] of fetchMock.mock.calls) {
      expect(url).toMatch(/^https:\/\/connector-gateway\.lovable\.dev\/microsoft_outlook\/v1.0\/users\//);
      const headers = new Headers(init.headers);
      expect(headers.get("Authorization")).toBe("Bearer test-lovable");
      expect(headers.get("X-Connection-Api-Key")).toBe("test-outlook");
      expect(headers.get("Prefer")).toBe('outlook.timezone="UTC"');
    }
    const event = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(event).toMatchObject({ isOnlineMeeting: true, onlineMeetingProvider: "teamsForBusiness", attendees: [{ emailAddress: { address: "client@example.com" }, type: "required" }], start: { dateTime: "2026-09-09T12:00:00.000", timeZone: "UTC" } });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ external_event_id: "event-1", calendar_host_email: host.microsoft_email, calendar_sync_status: "synced", meeting_url: "https://teams.microsoft.com/l/meetup-join/test", attendee_emails: ["client@example.com"] }));
  });
  it("does not create an event when the slot became busy", async () => {
    fetchMock.mockResolvedValueOnce(response({ value: [{ scheduleItems: [{ status: "busy", start: { dateTime: "2026-09-09T12:00:00" }, end: { dateTime: "2026-09-09T13:00:00" } }] }] }));
    expect((await call(book)).status).toBe(409);
    expect(insert).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([{ value: [{ error: { message: "denied" } }] }, {}, { value: [] }])("fails closed on missing/per-mailbox availability errors", async (payload) => {
    fetchMock.mockResolvedValueOnce(response(payload));
    expect((await call(book)).status).toBe(500);
    expect(insert).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("returns slots through the gateway and excludes occupied times", async () => {
    fetchMock.mockResolvedValueOnce(response({ value: [{ scheduleItems: [{ status: "busy", start: { dateTime: "2026-09-09T12:00:00" }, end: { dateTime: "2026-09-09T13:00:00" } }] }] }));
    const result = await call({ action: "availability", organizer_id: host.id, start_date: "2026-09-09", end_date: "2026-09-09" });
    const body = await result.json();
    expect(body.slots.length).toBeGreaterThan(0);
    expect(body.slots.some((slot: any) => slot.local_time === "09:00")).toBe(false);
  });
  it("deletes the Outlook event through the gateway if meetings insert fails", async () => {
    meetingError = new Error("database unavailable");
    expect((await call(book)).status).toBe(500);
    expect(fetchMock.mock.calls[2][0]).toBe(`${OUTLOOK_GATEWAY}/users/mentor%40example.com/events/event-1`);
    expect(fetchMock.mock.calls[2][1].method).toBe("DELETE");
  });
  it("does not confirm an event without a Teams URL", async () => {
    fetchMock.mockResolvedValueOnce(response({ value: [{ scheduleItems: [] }] })).mockResolvedValueOnce(response({ id: "event-1" }, 201));
    expect((await call(book)).status).toBe(500);
    expect(insert).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[2][1].method).toBe("DELETE");
  });
  it("validates editing and Teams capability before enabling a host", async () => {
    fetchMock.mockResolvedValueOnce(response({ canEdit: false, allowedOnlineMeetingProviders: [] }));
    expect((await call({ action: "upsert_my_host", microsoft_email: host.microsoft_email })).status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
    expect((await call({ action: "upsert_my_host", microsoft_email: host.microsoft_email })).status).toBe(200);
    expect(upsert).toHaveBeenCalledTimes(1);
  });
  it("keeps company and staff authorization before gateway calls", async () => {
    allowed = false;
    expect((await call(book)).status).toBe(403);
    allowed = true; staff = false;
    expect((await call({ action: "upsert_my_host" })).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([401, 403, 429, 502])("handles non-JSON gateway error %s without leaking its body", async (status) => {
    fetchMock.mockResolvedValueOnce(new Response("sensitive upstream error", { status }));
    await expect(outlookFetch("/users/test/events")).rejects.not.toThrow("sensitive upstream");
  });
  it("requires only the new connector secrets and never calls OAuth", async () => {
    await expect(outlookFetch("/users/test/events", {}, { env: { get: () => undefined }, fetch: fetchMock })).rejects.toThrow("MICROSOFT_OUTLOOK_API_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
