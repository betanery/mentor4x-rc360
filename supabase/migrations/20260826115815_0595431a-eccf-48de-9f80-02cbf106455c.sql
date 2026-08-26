CREATE OR REPLACE FUNCTION public.generate_contract_journey(_contract_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _contract record;
  _inserted integer := 0;
BEGIN
  SELECT c.id, c.company_id, c.product_version_id, c.started_at
    INTO _contract
  FROM public.contracts c
  WHERE c.id = _contract_id;

  IF _contract.id IS NULL THEN
    RAISE EXCEPTION 'Contratacao nao encontrada';
  END IF;

  IF NOT (public.is_staff(auth.uid()) OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Somente a equipe interna pode gerar a jornada da contratacao';
  END IF;

  IF EXISTS (SELECT 1 FROM public.contract_journey_stages WHERE contract_id = _contract.id) THEN
    RETURN 0;
  END IF;

  INSERT INTO public.contract_journey_stages (
    contract_id, company_id, stage_template_id, title, description,
    order_index, cycle_number, status, planned_start, planned_end
  )
  SELECT
    _contract.id,
    _contract.company_id,
    s.id,
    s.title,
    s.description,
    s.order_index,
    s.cycle_number,
    CASE WHEN s.order_index = (SELECT MIN(order_index) FROM public.product_version_stages WHERE product_version_id = _contract.product_version_id)
      THEN 'em_andamento' ELSE 'pendente' END,
    CASE WHEN _contract.started_at IS NULL THEN NULL
      ELSE _contract.started_at + COALESCE((
        SELECT SUM(COALESCE(p.duration_days, 0))
        FROM public.product_version_stages p
        WHERE p.product_version_id = _contract.product_version_id
          AND p.order_index < s.order_index
      ), 0) END,
    CASE WHEN _contract.started_at IS NULL THEN NULL
      ELSE _contract.started_at + COALESCE((
        SELECT SUM(COALESCE(p.duration_days, 0))
        FROM public.product_version_stages p
        WHERE p.product_version_id = _contract.product_version_id
          AND p.order_index <= s.order_index
      ), 0) END
  FROM public.product_version_stages s
  WHERE s.product_version_id = _contract.product_version_id
  ORDER BY s.order_index;

  SELECT count(*) INTO _inserted FROM public.contract_journey_stages WHERE contract_id = _contract.id;
  RETURN _inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_contract_journey(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_contract_journey(uuid) TO authenticated, service_role;