-- War Room Phase 1: Microsoft 365 calendar + Teams booking
-- This migration only prepares data structures. Microsoft Graph credentials remain in Edge Function secrets.

create table if not exists public.calendar_booking_hosts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  display_name text not null,
  microsoft_email text not null unique,
  active boolean not null default true,
  allow_client_booking boolean not null default true,
  timezone text not null default 'America/Sao_Paulo',
  graph_timezone text not null default 'UTC',
  workday_start time not null default '09:00',
  workday_end time not null default '18:00',
  slot_duration_min integer not null default 60 check (slot_duration_min between 15 and 240),
  buffer_min integer not null default 15 check (buffer_min between 0 and 120),
  booking_window_days integer not null default 30 check (booking_window_days between 1 and 180),
  minimum_notice_hours integer not null default 24 check (minimum_notice_hours between 0 and 336),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_booking_hosts enable row level security;

-- Booking hosts contain private Microsoft identities. Normal users consume only the safe projection returned by the Edge Function.
drop policy if exists "staff_manage_calendar_booking_hosts" on public.calendar_booking_hosts;
create policy "staff_manage_calendar_booking_hosts"
on public.calendar_booking_hosts
for all
to authenticated
using (public.is_staff(auth.uid()))
with check (public.is_staff(auth.uid()));

alter table public.meetings
  add column if not exists calendar_provider text not null default 'manual',
  add column if not exists calendar_host_user_id uuid,
  add column if not exists calendar_host_email text,
  add column if not exists external_event_id text,
  add column if not exists teams_join_url text,
  add column if not exists attendee_emails text[] not null default '{}',
  add column if not exists calendar_sync_status text not null default 'manual',
  add column if not exists calendar_sync_error text,
  add column if not exists booked_by_user_id uuid;

create unique index if not exists meetings_external_event_id_uidx
  on public.meetings(external_event_id)
  where external_event_id is not null;

create index if not exists meetings_calendar_host_scheduled_idx
  on public.meetings(calendar_host_user_id, scheduled_at);

comment on table public.calendar_booking_hosts is 'Staff calendars that can receive Mentor 4X client bookings through Microsoft Graph.';
comment on column public.meetings.external_event_id is 'Microsoft Graph event id for calendar-backed Teams meetings.';
comment on column public.meetings.teams_join_url is 'Teams join URL returned from the calendar event onlineMeeting payload.';
comment on column public.meetings.calendar_sync_status is 'manual | pending | synced | error';
