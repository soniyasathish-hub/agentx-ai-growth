ALTER TABLE public.autonomous_actions
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS performed_by uuid,
  ADD COLUMN IF NOT EXISTS dismissed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS previous_price numeric,
  ADD COLUMN IF NOT EXISTS new_price numeric;

CREATE TABLE IF NOT EXISTS public.retention_offers (
  offer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(business_id) ON DELETE CASCADE,
  action_id uuid NOT NULL UNIQUE REFERENCES public.autonomous_actions(action_id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(customer_id) ON DELETE SET NULL,
  discount_percent numeric NOT NULL DEFAULT 10,
  estimated_opportunity numeric NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.retention_offers TO authenticated;
GRANT ALL ON public.retention_offers TO service_role;

ALTER TABLE public.retention_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "retention offers scoped" ON public.retention_offers
  FOR ALL TO authenticated
  USING (business_id = public.current_business_id())
  WITH CHECK (business_id = public.current_business_id());

CREATE TRIGGER retention_offers_touch
  BEFORE UPDATE ON public.retention_offers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();