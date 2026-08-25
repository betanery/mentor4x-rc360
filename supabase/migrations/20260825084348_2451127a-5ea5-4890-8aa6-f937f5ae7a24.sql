CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('mentor4x-daily-alerts')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mentor4x-daily-alerts');

SELECT cron.schedule(
  'mentor4x-daily-alerts',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://fjgdcmtwstmslmbxlsga.supabase.co/functions/v1/daily-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-key', current_setting('app.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);