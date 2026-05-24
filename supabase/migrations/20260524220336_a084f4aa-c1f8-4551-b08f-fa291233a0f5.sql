
-- 1. Notification triggers
CREATE OR REPLACE FUNCTION public.notify_pillar_score()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, company_id, type, title, message)
  SELECT cm.user_id, NEW.company_id, 'pillar_score',
         'Novo score de pilar registrado',
         'Pilar ' || NEW.pillar::text || ' marcado em ' || NEW.score || '/100.'
  FROM public.company_members cm
  WHERE cm.company_id = NEW.company_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_pillar_score ON public.pillar_scores;
CREATE TRIGGER trg_notify_pillar_score
AFTER INSERT ON public.pillar_scores
FOR EACH ROW EXECUTE FUNCTION public.notify_pillar_score();

CREATE OR REPLACE FUNCTION public.notify_meeting_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, company_id, type, title, message)
  SELECT cm.user_id, NEW.company_id, 'meeting',
         'Nova reunião agendada: ' || NEW.title,
         'Agendada para ' || to_char(NEW.scheduled_at, 'DD/MM/YYYY HH24:MI')
  FROM public.company_members cm
  WHERE cm.company_id = NEW.company_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_meeting_created ON public.meetings;
CREATE TRIGGER trg_notify_meeting_created
AFTER INSERT ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.notify_meeting_created();

CREATE OR REPLACE FUNCTION public.notify_goal_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> OLD.status AND NEW.status = 'atrasado' THEN
    INSERT INTO public.notifications (user_id, company_id, type, title, message)
    SELECT cm.user_id, NEW.company_id, 'goal_late',
           'Meta atrasada: ' || NEW.title,
           'A meta passou para o status "atrasado".'
    FROM public.company_members cm
    WHERE cm.company_id = NEW.company_id;
  ELSIF NEW.status <> OLD.status AND NEW.status = 'concluido' THEN
    INSERT INTO public.notifications (user_id, company_id, type, title, message)
    SELECT cm.user_id, NEW.company_id, 'goal_done',
           'Meta concluída: ' || NEW.title,
           'Parabéns — meta marcada como concluída.'
    FROM public.company_members cm
    WHERE cm.company_id = NEW.company_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_goal_status ON public.goals;
CREATE TRIGGER trg_notify_goal_status
AFTER UPDATE ON public.goals
FOR EACH ROW EXECUTE FUNCTION public.notify_goal_status();

-- 2. updated_at triggers on key tables
DROP TRIGGER IF EXISTS trg_companies_updated ON public.companies;
CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_goals_updated ON public.goals;
CREATE TRIGGER trg_goals_updated BEFORE UPDATE ON public.goals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_bottlenecks_updated ON public.bottlenecks;
CREATE TRIGGER trg_bottlenecks_updated BEFORE UPDATE ON public.bottlenecks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Journey checklist
CREATE TABLE IF NOT EXISTS public.journey_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  stage text NOT NULL,
  item_key text NOT NULL,
  item_type text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, stage, item_type, item_key)
);

ALTER TABLE public.journey_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jc_select" ON public.journey_checklist FOR SELECT
USING (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), company_id));

CREATE POLICY "jc_modify" ON public.journey_checklist FOR ALL
USING (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), company_id))
WITH CHECK (public.is_staff(auth.uid()) OR public.is_company_member(auth.uid(), company_id));

CREATE INDEX IF NOT EXISTS idx_journey_checklist_company ON public.journey_checklist(company_id, stage);
