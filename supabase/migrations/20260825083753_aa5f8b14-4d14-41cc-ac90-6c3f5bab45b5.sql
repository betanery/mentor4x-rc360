ALTER TABLE public.playbooks
  ADD COLUMN IF NOT EXISTS pillar public.pillar,
  ADD COLUMN IF NOT EXISTS blindspot_code text,
  ADD COLUMN IF NOT EXISTS motor text,
  ADD COLUMN IF NOT EXISTS tags text[],
  ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_playbooks_updated ON public.playbooks;
CREATE TRIGGER trg_playbooks_updated BEFORE UPDATE ON public.playbooks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();