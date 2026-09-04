-- Complete published-version immutability and publication checklist.
DROP TRIGGER IF EXISTS trg_pv_onboarding_items_immutable ON public.product_version_onboarding_items;
CREATE TRIGGER trg_pv_onboarding_items_immutable
BEFORE INSERT OR UPDATE OR DELETE ON public.product_version_onboarding_items
FOR EACH ROW EXECUTE FUNCTION public.enforce_published_version_immutable();

CREATE OR REPLACE FUNCTION public.publish_product_version(_version_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas Super Admin pode publicar versões de produto.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.product_version_config c WHERE c.product_version_id = _version_id) THEN
    RAISE EXCEPTION 'Configure os dados gerais da versão antes de publicar.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.product_version_onboarding_items o WHERE o.product_version_id = _version_id) THEN
    RAISE EXCEPTION 'Configure ao menos um item de onboarding antes de publicar.';
  END IF;
  UPDATE public.product_versions SET published_at = now(), is_active = true WHERE id = _version_id AND published_at IS NULL;
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.publish_product_version(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_product_version(uuid) TO authenticated, service_role;
