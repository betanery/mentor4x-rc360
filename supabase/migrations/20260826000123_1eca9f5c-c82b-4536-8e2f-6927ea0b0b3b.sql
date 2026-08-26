CREATE TYPE public.onboarding_item_type AS ENUM ('etapa','encontro','entregavel','conteudo');

CREATE TABLE public.product_version_onboarding_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_version_id uuid NOT NULL REFERENCES public.product_versions(id) ON DELETE CASCADE,
  item_type public.onboarding_item_type NOT NULL,
  stage text,
  title text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  offset_days integer NOT NULL DEFAULT 0,
  duration_min integer,
  meeting_type public.meeting_type,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_version_onboarding_items TO authenticated;
GRANT ALL ON public.product_version_onboarding_items TO service_role;
ALTER TABLE public.product_version_onboarding_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver modelos de onboarding"
ON public.product_version_onboarding_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff gerencia modelos de onboarding"
ON public.product_version_onboarding_items FOR ALL TO authenticated
USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER trg_pv_onboarding_items_updated
BEFORE UPDATE ON public.product_version_onboarding_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_pv_onboarding_items_version ON public.product_version_onboarding_items(product_version_id, order_index);

CREATE TABLE public.contract_onboarding_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.product_version_onboarding_items(id) ON DELETE SET NULL,
  item_type public.onboarding_item_type NOT NULL,
  stage text,
  title text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  due_date date,
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  done boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_onboarding_items TO authenticated;
GRANT ALL ON public.contract_onboarding_items TO service_role;
ALTER TABLE public.contract_onboarding_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros veem onboarding da contratacao"
ON public.contract_onboarding_items FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id) OR public.is_staff(auth.uid()));

CREATE POLICY "Membros concluem itens do onboarding"
ON public.contract_onboarding_items FOR UPDATE TO authenticated
USING (public.is_company_member(auth.uid(), company_id) OR public.is_staff(auth.uid()))
WITH CHECK (public.is_company_member(auth.uid(), company_id) OR public.is_staff(auth.uid()));

CREATE POLICY "Staff cria itens do onboarding"
ON public.contract_onboarding_items FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff remove itens do onboarding"
ON public.contract_onboarding_items FOR DELETE TO authenticated
USING (public.is_staff(auth.uid()));

CREATE TRIGGER trg_contract_onboarding_items_updated
BEFORE UPDATE ON public.contract_onboarding_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER contract_onboarding_items_company_match
BEFORE INSERT OR UPDATE ON public.contract_onboarding_items
FOR EACH ROW EXECUTE FUNCTION public.ensure_contract_matches_company();

CREATE UNIQUE INDEX idx_contract_onboarding_template ON public.contract_onboarding_items(contract_id, template_id) WHERE template_id IS NOT NULL;
CREATE INDEX idx_contract_onboarding_contract ON public.contract_onboarding_items(contract_id, order_index);

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS access_expires_at date,
  ADD COLUMN IF NOT EXISTS onboarding_generated_at timestamptz;

CREATE OR REPLACE FUNCTION public.generate_contract_onboarding(_contract_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  c record;
  pv record;
  t record;
  base_date date;
  inserted_count integer := 0;
  new_meeting_id uuid;
  item_due date;
BEGIN
  IF public.is_staff(auth.uid()) IS NOT TRUE THEN
    RAISE EXCEPTION 'Apenas o time interno pode gerar o onboarding da contratacao.';
  END IF;

  SELECT * INTO c FROM public.contracts WHERE id = _contract_id;
  IF c.id IS NULL THEN
    RAISE EXCEPTION 'Contratacao nao encontrada.';
  END IF;

  SELECT * INTO pv FROM public.product_versions WHERE id = c.product_version_id;
  base_date := COALESCE(c.started_at, CURRENT_DATE);

  FOR t IN
    SELECT * FROM public.product_version_onboarding_items
    WHERE product_version_id = c.product_version_id
    ORDER BY order_index, created_at
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.contract_onboarding_items
      WHERE contract_id = _contract_id AND template_id = t.id
    ) THEN
      CONTINUE;
    END IF;

    item_due := base_date + COALESCE(t.offset_days, 0);
    new_meeting_id := NULL;

    IF t.item_type = 'encontro' AND t.meeting_type IS NOT NULL THEN
      INSERT INTO public.meetings (company_id, contract_id, title, meeting_type, scheduled_at, duration_min, created_by)
      VALUES (c.company_id, c.id, t.title, t.meeting_type, (item_due::timestamptz + interval '13 hours'), COALESCE(t.duration_min, 60), auth.uid())
      RETURNING id INTO new_meeting_id;
    END IF;

    INSERT INTO public.contract_onboarding_items
      (contract_id, company_id, template_id, item_type, stage, title, description, order_index, due_date, meeting_id, course_id)
    VALUES
      (c.id, c.company_id, t.id, t.item_type, t.stage, t.title, t.description, t.order_index, item_due, new_meeting_id, t.course_id);

    inserted_count := inserted_count + 1;
  END LOOP;

  UPDATE public.contracts
  SET access_expires_at = COALESCE(access_expires_at, base_date + COALESCE(pv.duration_days, 180)),
      onboarding_generated_at = now()
  WHERE id = _contract_id;

  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_contract_onboarding(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.generate_contract_onboarding(uuid) TO authenticated, service_role;