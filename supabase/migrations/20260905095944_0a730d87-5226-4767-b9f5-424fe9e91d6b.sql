
CREATE TABLE public.businesses (
  business_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  owner_name text NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.users (
  user_id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(business_id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL DEFAULT 'managed_by_auth',
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  product_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(business_id) ON DELETE CASCADE,
  product_name text NOT NULL,
  category text NOT NULL,
  price numeric(12,2) NOT NULL,
  cost numeric(12,2) NOT NULL,
  stock integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.customers (
  customer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(business_id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  total_spent numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sales (
  sale_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(business_id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(product_id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(customer_id) ON DELETE SET NULL,
  quantity integer NOT NULL,
  unit_price numeric(12,2) NOT NULL,
  total_amount numeric(12,2) NOT NULL,
  sale_date timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.autonomous_actions (
  action_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(business_id) ON DELETE CASCADE,
  action_type text NOT NULL,
  product_id uuid REFERENCES public.products(product_id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(customer_id) ON DELETE CASCADE,
  priority text NOT NULL DEFAULT 'Medium',
  reason text NOT NULL,
  estimated_opportunity numeric(12,2) NOT NULL DEFAULT 0,
  discount_percent numeric(6,2) NOT NULL DEFAULT 10,
  price_change_percent numeric(6,2) NOT NULL DEFAULT 0,
  margin_percent numeric(6,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Pending Approval',
  block_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  executed_at timestamptz,
  rejected_at timestamptz
);

CREATE UNIQUE INDEX autonomous_actions_unique_open
  ON public.autonomous_actions (business_id, action_type, COALESCE(product_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(customer_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status IN ('Pending Approval', 'Approved', 'Blocked');

CREATE TABLE public.action_history (
  history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES public.autonomous_actions(action_id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(business_id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  performed_by uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.autonomous_actions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_history TO authenticated;
GRANT ALL ON public.businesses, public.users, public.products, public.customers, public.sales, public.autonomous_actions, public.action_history TO service_role;

CREATE OR REPLACE FUNCTION public.current_business_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT business_id FROM public.users WHERE user_id = auth.uid()
$$;

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autonomous_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own business readable" ON public.businesses FOR SELECT TO authenticated
  USING (business_id = public.current_business_id());
CREATE POLICY "create business" ON public.businesses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update own business" ON public.businesses FOR UPDATE TO authenticated
  USING (business_id = public.current_business_id());

CREATE POLICY "read own membership" ON public.users FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR business_id = public.current_business_id());
CREATE POLICY "create own membership" ON public.users FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "update own membership" ON public.users FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "products scoped" ON public.products FOR ALL TO authenticated
  USING (business_id = public.current_business_id())
  WITH CHECK (business_id = public.current_business_id());
CREATE POLICY "customers scoped" ON public.customers FOR ALL TO authenticated
  USING (business_id = public.current_business_id())
  WITH CHECK (business_id = public.current_business_id());
CREATE POLICY "sales scoped" ON public.sales FOR ALL TO authenticated
  USING (business_id = public.current_business_id())
  WITH CHECK (business_id = public.current_business_id());
CREATE POLICY "actions scoped" ON public.autonomous_actions FOR ALL TO authenticated
  USING (business_id = public.current_business_id())
  WITH CHECK (business_id = public.current_business_id());
CREATE POLICY "history scoped" ON public.action_history FOR ALL TO authenticated
  USING (business_id = public.current_business_id())
  WITH CHECK (business_id = public.current_business_id());

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER products_touch BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ DEMO SEED ============
INSERT INTO public.businesses (business_id, business_name, owner_name, email) VALUES
('11111111-1111-1111-1111-111111111111', 'Northwind Retail Co.', 'Ava Mercer', 'ops@northwindretail.com');

INSERT INTO public.products (product_id, business_id, product_name, category, price, cost, stock) VALUES
('21111111-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Aurora Wireless Headphones','Audio',199.00,112.00,140),
('21111111-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Nimbus Smart Speaker','Audio',129.00,71.00,320),
('21111111-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Vertex 4K Webcam','Video',89.00,44.00,58),
('21111111-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','Helix Mechanical Keyboard','Peripherals',149.00,79.00,96),
('21111111-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','Orbit Ergonomic Mouse','Peripherals',69.00,31.00,410),
('21111111-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','Lumen Desk Lamp Pro','Office',59.00,26.00,275),
('21111111-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','Atlas Standing Desk','Furniture',649.00,402.00,22),
('21111111-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','Cirrus Laptop Stand','Office',45.00,18.00,530),
('21111111-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111','Pulse Fitness Tracker','Wearables',179.00,98.00,64),
('21111111-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111111','Echo Noise-Cancel Earbuds','Audio',139.00,66.00,188);

INSERT INTO public.customers (customer_id, business_id, name, email, phone, created_at) VALUES
('31111111-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Meridian Studios','buying@meridianstudios.com','+1 415 555 0132', now() - interval '400 days'),
('31111111-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Halcyon Labs','ops@halcyonlabs.io','+1 212 555 0117', now() - interval '350 days'),
('31111111-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Bluepeak Consulting','finance@bluepeak.co','+1 646 555 0188', now() - interval '300 days'),
('31111111-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','Cedar & Co.','hello@cedarandco.com','+1 503 555 0143', now() - interval '260 days'),
('31111111-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','Nova Freight','procure@novafreight.com','+1 312 555 0175', now() - interval '220 days'),
('31111111-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','Larkspur Design','team@larkspur.design','+1 718 555 0164', now() - interval '180 days'),
('31111111-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','Kestrel Analytics','it@kestrelanalytics.com','+1 206 555 0199', now() - interval '150 days'),
('31111111-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','Sable Interiors','orders@sableinteriors.com','+1 305 555 0121', now() - interval '120 days');

INSERT INTO public.sales (business_id, product_id, customer_id, quantity, unit_price, total_amount, sale_date)
SELECT
  '11111111-1111-1111-1111-111111111111',
  p.product_id,
  c.customer_id,
  q.qty,
  p.price,
  ROUND(p.price * q.qty, 2),
  now() - (q.days_ago || ' days')::interval
FROM (
  SELECT
    g AS n,
    1 + (g * 7 % 4) AS qty,
    (g * 13 % 330) AS days_ago,
    (g * 5 % 10) + 1 AS pidx,
    (g * 3 % 8) + 1 AS cidx
  FROM generate_series(1, 420) g
) q
JOIN public.products p ON p.product_id = ('21111111-0000-0000-0000-0000000000' || lpad(q.pidx::text, 2, '0'))::uuid
JOIN public.customers c ON c.customer_id = ('31111111-0000-0000-0000-0000000000' || lpad(q.cidx::text, 2, '0'))::uuid
WHERE NOT (q.pidx IN (7, 9) AND q.days_ago < 240)
  AND NOT (q.cidx IN (4, 8) AND q.days_ago < 200);

UPDATE public.customers c
SET total_spent = COALESCE((SELECT SUM(s.total_amount) FROM public.sales s WHERE s.customer_id = c.customer_id), 0);
