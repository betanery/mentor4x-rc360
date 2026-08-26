-- ============================================================
-- Fase 5a/5b — Motor configuravel de produtos (aditivo)
-- ============================================================

CREATE TABLE public.product_version_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_version_id uuid NOT NULL UNIQUE REFERENCES public.product_versions(id) ON DELETE CASCADE,
  price_cents integer,
  currency text NOT NULL DEFAULT 'BRL',
  format text,
  audience text,
  duration_amount integer,
  duration_unit text NOT NULL DEFAULT 'meses',
  access_days integer,
  support_model text,
  community_included boolean NOT NULL DEFAULT false,
  bonuses text,
  ai_enabled boolean NOT NULL DEFAULT true,
  catalog_visibility text NOT NULL DEFAULT 'interno',
  sales_url text,
  checkout_url text,
  recommendation_mode text NOT NULL DEFAULT 'manual',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_version_config TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_version_config TO authenticated;
GRANT ALL ON public.product_version_config TO service_role;
ALTER TABLE public.product_version_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "config catalogo visivel autenticados" ON public.product_version_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "config gerenciada por staff" ON public.product_version_config FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_product_version_config_updated BEFORE UPDATE ON public.product_version_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.product_version_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_version_id uuid NOT NULL REFERENCES public.product_versions(id) ON DELETE CASCADE,
  meeting_type meeting_type NOT NULL,
  title text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  duration_min integer NOT NULL DEFAULT 60,
  cadence text,
  required boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_version_meetings TO authenticated;
GRANT ALL ON public.product_version_meetings TO service_role;
ALTER TABLE public.product_version_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "encontros versao visiveis autenticados" ON public.product_version_meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "encontros versao gerenciados por staff" ON public.product_version_meetings FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_product_version_meetings_updated BEFORE UPDATE ON public.product_version_meetings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.product_version_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_version_id uuid NOT NULL REFERENCES public.product_versions(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  duration_days integer,
  cycle_number integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_version_stages TO authenticated;
GRANT ALL ON public.product_version_stages TO service_role;
ALTER TABLE public.product_version_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "etapas versao visiveis autenticados" ON public.product_version_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "etapas versao gerenciadas por staff" ON public.product_version_stages FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_product_version_stages_updated BEFORE UPDATE ON public.product_version_stages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.product_version_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_version_id uuid NOT NULL REFERENCES public.product_versions(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES public.product_version_stages(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  format text,
  required boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_version_deliverables TO authenticated;
GRANT ALL ON public.product_version_deliverables TO service_role;
ALTER TABLE public.product_version_deliverables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entregaveis versao visiveis autenticados" ON public.product_version_deliverables FOR SELECT TO authenticated USING (true);
CREATE POLICY "entregaveis versao gerenciados por staff" ON public.product_version_deliverables FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_product_version_deliverables_updated BEFORE UPDATE ON public.product_version_deliverables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.product_inheritance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_version_id uuid NOT NULL REFERENCES public.product_versions(id) ON DELETE CASCADE,
  derived_version_id uuid NOT NULL REFERENCES public.product_versions(id) ON DELETE CASCADE,
  inherited_components text[] NOT NULL DEFAULT '{}',
  overridden_components text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (base_version_id, derived_version_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_inheritance TO authenticated;
GRANT ALL ON public.product_inheritance TO service_role;
ALTER TABLE public.product_inheritance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "heranca visivel autenticados" ON public.product_inheritance FOR SELECT TO authenticated USING (true);
CREATE POLICY "heranca gerenciada por staff" ON public.product_inheritance FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_product_inheritance_updated BEFORE UPDATE ON public.product_inheritance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.product_upgrade_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  from_version_id uuid REFERENCES public.product_versions(id) ON DELETE CASCADE,
  to_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  to_version_id uuid REFERENCES public.product_versions(id) ON DELETE CASCADE,
  condition text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_upgrade_paths TO authenticated;
GRANT ALL ON public.product_upgrade_paths TO service_role;
ALTER TABLE public.product_upgrade_paths ENABLE ROW LEVEL SECURITY;
CREATE POLICY "upgrades visiveis autenticados" ON public.product_upgrade_paths FOR SELECT TO authenticated USING (true);
CREATE POLICY "upgrades gerenciados por staff" ON public.product_upgrade_paths FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_product_upgrade_paths_updated BEFORE UPDATE ON public.product_upgrade_paths FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.contract_journey_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  stage_template_id uuid REFERENCES public.product_version_stages(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  cycle_number integer,
  status text NOT NULL DEFAULT 'nao_iniciado',
  planned_start date,
  planned_end date,
  completed_at timestamptz,
  completed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_journey_stages TO authenticated;
GRANT ALL ON public.contract_journey_stages TO service_role;
ALTER TABLE public.contract_journey_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jornada contratacao visivel membros" ON public.contract_journey_stages FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR company_id IN (SELECT public.user_companies(auth.uid())));
CREATE POLICY "jornada contratacao gerenciada por staff" ON public.contract_journey_stages FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER contract_journey_stages_company_match BEFORE INSERT OR UPDATE ON public.contract_journey_stages FOR EACH ROW EXECUTE FUNCTION public.ensure_contract_matches_company();
CREATE TRIGGER trg_contract_journey_stages_updated BEFORE UPDATE ON public.contract_journey_stages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_pv_meetings_version ON public.product_version_meetings(product_version_id, order_index);
CREATE INDEX idx_pv_stages_version ON public.product_version_stages(product_version_id, order_index);
CREATE INDEX idx_pv_deliverables_version ON public.product_version_deliverables(product_version_id, order_index);
CREATE INDEX idx_contract_journey_contract ON public.contract_journey_stages(contract_id, order_index);
CREATE INDEX idx_contract_journey_company ON public.contract_journey_stages(company_id);

-- Fase 5b: versao publicada torna-se imutavel (config, encontros, etapas, entregaveis)
CREATE OR REPLACE FUNCTION public.enforce_published_version_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target uuid;
  is_published boolean;
BEGIN
  target := COALESCE(NEW.product_version_id, OLD.product_version_id);
  SELECT (pv.published_at IS NOT NULL) INTO is_published
  FROM public.product_versions pv WHERE pv.id = target;

  IF is_published IS TRUE THEN
    RAISE EXCEPTION 'Versao de produto ja publicada e imutavel: duplique a versao, edite e publique novamente.';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_published_version_immutable() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_config_immutable BEFORE UPDATE OR DELETE ON public.product_version_config FOR EACH ROW EXECUTE FUNCTION public.enforce_published_version_immutable();
CREATE TRIGGER trg_pv_meetings_immutable BEFORE INSERT OR UPDATE OR DELETE ON public.product_version_meetings FOR EACH ROW EXECUTE FUNCTION public.enforce_published_version_immutable();
CREATE TRIGGER trg_pv_stages_immutable BEFORE INSERT OR UPDATE OR DELETE ON public.product_version_stages FOR EACH ROW EXECUTE FUNCTION public.enforce_published_version_immutable();
CREATE TRIGGER trg_pv_deliverables_immutable BEFORE INSERT OR UPDATE OR DELETE ON public.product_version_deliverables FOR EACH ROW EXECUTE FUNCTION public.enforce_published_version_immutable();