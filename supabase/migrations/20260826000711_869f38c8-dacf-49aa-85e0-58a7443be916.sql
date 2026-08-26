-- =========================
-- C5: Encontros e Sala de Guerra
-- =========================

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'agendada',
  ADD COLUMN IF NOT EXISTS recording_url text,
  ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'nenhuma',
  ADD COLUMN IF NOT EXISTS recurrence_until date,
  ADD COLUMN IF NOT EXISTS series_id uuid,
  ADD COLUMN IF NOT EXISTS rescheduled_from timestamptz,
  ADD COLUMN IF NOT EXISTS reschedule_reason text,
  ADD COLUMN IF NOT EXISTS agenda text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.meetings
  DROP CONSTRAINT IF EXISTS meetings_status_check;
ALTER TABLE public.meetings
  ADD CONSTRAINT meetings_status_check CHECK (status IN ('agendada','realizada','cancelada','reagendada'));

ALTER TABLE public.meetings
  DROP CONSTRAINT IF EXISTS meetings_recurrence_check;
ALTER TABLE public.meetings
  ADD CONSTRAINT meetings_recurrence_check CHECK (recurrence IN ('nenhuma','semanal','quinzenal','mensal'));

CREATE INDEX IF NOT EXISTS meetings_series_idx ON public.meetings(series_id);

DROP TRIGGER IF EXISTS trg_meetings_updated ON public.meetings;
CREATE TRIGGER trg_meetings_updated BEFORE UPDATE ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- Presença ----------
CREATE TABLE IF NOT EXISTS public.meeting_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  participant_name text,
  status text NOT NULL DEFAULT 'presente',
  note text,
  recorded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meeting_attendance_status_check CHECK (status IN ('presente','ausente','justificado','atrasado'))
);

CREATE UNIQUE INDEX IF NOT EXISTS meeting_attendance_unique_user
  ON public.meeting_attendance(meeting_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS meeting_attendance_meeting_idx ON public.meeting_attendance(meeting_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_attendance TO authenticated;
GRANT ALL ON public.meeting_attendance TO service_role;

ALTER TABLE public.meeting_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members read attendance"
ON public.meeting_attendance FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.meetings m
  WHERE m.id = meeting_attendance.meeting_id
    AND (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), m.company_id))
));

CREATE POLICY "Staff insert attendance"
ON public.meeting_attendance FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff update attendance"
ON public.meeting_attendance FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff delete attendance"
ON public.meeting_attendance FOR DELETE TO authenticated
USING (public.is_staff(auth.uid()));

DROP TRIGGER IF EXISTS trg_meeting_attendance_updated ON public.meeting_attendance;
CREATE TRIGGER trg_meeting_attendance_updated BEFORE UPDATE ON public.meeting_attendance
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- Fluxo de aprovação da ata ----------
ALTER TABLE public.weekly_reviews
  ADD COLUMN IF NOT EXISTS ata_status text NOT NULL DEFAULT 'rascunho',
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS review_comment text;

ALTER TABLE public.weekly_reviews DROP CONSTRAINT IF EXISTS weekly_reviews_ata_status_check;
ALTER TABLE public.weekly_reviews
  ADD CONSTRAINT weekly_reviews_ata_status_check CHECK (ata_status IN ('rascunho','em_revisao','aprovada','ajustes_solicitados'));

CREATE OR REPLACE FUNCTION public.enforce_weekly_review_ata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  actor_is_staff boolean := public.is_staff(auth.uid());
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF actor_is_staff IS NOT TRUE THEN
      NEW.ata_status := COALESCE(NULLIF(NEW.ata_status, 'aprovada'), 'rascunho');
      IF NEW.ata_status NOT IN ('rascunho','em_revisao') THEN
        NEW.ata_status := 'rascunho';
      END IF;
      NEW.reviewed_at := NULL;
      NEW.reviewed_by := NULL;
      NEW.review_comment := NULL;
    END IF;
    IF NEW.ata_status = 'em_revisao' AND NEW.submitted_at IS NULL THEN
      NEW.submitted_at := now();
      NEW.submitted_by := COALESCE(NEW.submitted_by, actor);
    END IF;
    RETURN NEW;
  END IF;

  IF actor_is_staff IS NOT TRUE THEN
    IF OLD.ata_status = 'aprovada' THEN
      RAISE EXCEPTION 'Ata aprovada: somente o Consultor 4X pode alterar.';
    END IF;
    IF NEW.ata_status NOT IN ('rascunho','em_revisao') THEN
      RAISE EXCEPTION 'Somente o Consultor 4X pode aprovar ou solicitar ajustes na ata.';
    END IF;
    IF NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
      OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
      OR NEW.review_comment IS DISTINCT FROM OLD.review_comment THEN
      RAISE EXCEPTION 'Somente o Consultor 4X pode registrar o parecer da ata.';
    END IF;
  END IF;

  IF NEW.ata_status = 'em_revisao' AND OLD.ata_status <> 'em_revisao' THEN
    NEW.submitted_at := now();
    NEW.submitted_by := actor;
  END IF;

  IF NEW.ata_status IN ('aprovada','ajustes_solicitados') AND NEW.ata_status <> OLD.ata_status THEN
    NEW.reviewed_at := now();
    NEW.reviewed_by := COALESCE(NEW.reviewed_by, actor);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a_weekly_reviews_ata ON public.weekly_reviews;
CREATE TRIGGER a_weekly_reviews_ata BEFORE INSERT OR UPDATE ON public.weekly_reviews
FOR EACH ROW EXECUTE FUNCTION public.enforce_weekly_review_ata();

REVOKE ALL ON FUNCTION public.enforce_weekly_review_ata() FROM PUBLIC, anon, authenticated;