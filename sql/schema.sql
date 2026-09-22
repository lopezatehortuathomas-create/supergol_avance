-- ==============================================================================
-- 1. EXTENSIONS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ==============================================================================
-- 2. HELPER FUNCTIONS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      COALESCE(
        auth.jwt() -> 'app_metadata' ->> 'user_role',
        auth.jwt() -> 'app_metadata' ->> 'role',
        auth.jwt() -> 'app_metadata' ->> 'userRole'
      ) IN ('admin', 'superadmin')
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('admin', 'superadmin')
      )
    ),
    false
  );
$$;

-- ==============================================================================
-- 3. TABLES
-- ==============================================================================

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'usuario' CHECK (role IN ('admin', 'superadmin', 'usuario')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SPACES (recreational spaces catalog)
CREATE TABLE public.spaces (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('futbol', 'motocross', 'billar', 'otra')),
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RESERVATIONS
CREATE TABLE public.reservations (
  id SERIAL PRIMARY KEY,
  space_id INT NOT NULL REFERENCES public.spaces(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'aprobada', 'rechazada', 'cancelada', 'completada')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  EXCLUDE USING gist (space_id WITH =, tstzrange(start_time, end_time) WITH &&) WHERE (status IN ('pendiente', 'aprobada'))
);

-- USAGE LOGS (manual usage registration)
CREATE TABLE public.usage_logs (
  id SERIAL PRIMARY KEY,
  space_id INT NOT NULL REFERENCES public.spaces(id),
  reservation_id INT REFERENCES public.reservations(id),
  registered_by UUID NOT NULL REFERENCES auth.users(id),
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_min INT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PRODUCTS (store inventory)
CREATE TABLE public.products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'otro' CHECK (category IN ('refresco', 'mekato', 'cerveza', 'otro')),
  price NUMERIC(10,2) NOT NULL,
  stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock INT NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SALES
CREATE TABLE public.sales (
  id SERIAL PRIMARY KEY,
  sold_by UUID NOT NULL REFERENCES auth.users(id),
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SALE ITEMS
CREATE TABLE public.sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INT NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES public.products(id),
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 4. INDEXES
-- ==============================================================================
CREATE INDEX idx_reservations_space_time ON public.reservations(space_id, start_time);
CREATE INDEX idx_reservations_user_id ON public.reservations(user_id);
CREATE INDEX idx_reservations_status ON public.reservations(status);
CREATE INDEX idx_usage_logs_space_id ON public.usage_logs(space_id);
CREATE INDEX idx_sale_items_product_id ON public.sale_items(product_id);
CREATE INDEX idx_sale_items_sale_id ON public.sale_items(sale_id);

-- ==============================================================================
-- 5. TRIGGER FUNCTIONS
-- ==============================================================================

-- HANDLE NEW USER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Sin nombre'),
    NEW.raw_user_meta_data->>'phone',
    'usuario'
  );
  RETURN NEW;
END;
$$;

-- DECREASE STOCK
CREATE OR REPLACE FUNCTION public.decrease_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.products
  SET stock = stock - NEW.quantity
  WHERE id = NEW.product_id;
  
  IF (SELECT stock FROM public.products WHERE id = NEW.product_id) < 0 THEN
    RAISE EXCEPTION 'Stock insuficiente para el producto %', NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$;

-- UPDATE TIMESTAMP
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ==============================================================================
-- 6. TRIGGERS
-- ==============================================================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_sale_item_inserted
  AFTER INSERT ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.decrease_stock();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER set_updated_at_products
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- ==============================================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());
CREATE POLICY profiles_admin_all ON public.profiles FOR ALL TO authenticated
  USING (public.is_admin());

-- SPACES
CREATE POLICY spaces_select_all ON public.spaces FOR SELECT TO authenticated
  USING (true);
CREATE POLICY spaces_admin_modify ON public.spaces FOR ALL TO authenticated
  USING (public.is_admin());

-- RESERVATIONS
CREATE POLICY reservations_select ON public.reservations FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY reservations_insert_own ON public.reservations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY reservations_update_admin ON public.reservations FOR UPDATE TO authenticated
  USING (public.is_admin());
DROP POLICY IF EXISTS reservations_update_own ON public.reservations;
CREATE POLICY reservations_update_own ON public.reservations FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'pendiente')
  WITH CHECK (user_id = auth.uid() AND status IN ('pendiente', 'cancelada'));
CREATE POLICY reservations_delete_admin ON public.reservations FOR DELETE TO authenticated
  USING (public.is_admin());
DROP POLICY IF EXISTS reservations_delete_own ON public.reservations;
CREATE POLICY reservations_delete_own ON public.reservations FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.delete_my_reservation(p_reservation_id integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.reservations
  WHERE id = p_reservation_id
    AND user_id = auth.uid();
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_reservation(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_reservation(integer) TO authenticated;

-- USAGE LOGS
CREATE POLICY usage_logs_admin_all ON public.usage_logs FOR ALL TO authenticated
  USING (public.is_admin());

-- PRODUCTS
CREATE POLICY products_select_all ON public.products FOR SELECT TO authenticated
  USING (true);
CREATE POLICY products_admin_modify ON public.products FOR ALL TO authenticated
  USING (public.is_admin());

-- SALES
CREATE POLICY sales_admin_all ON public.sales FOR ALL TO authenticated
  USING (public.is_admin());

-- SALE ITEMS
CREATE POLICY sale_items_admin_all ON public.sale_items FOR ALL TO authenticated
  USING (public.is_admin());

-- ==============================================================================
-- 8. SEED DATA
-- ==============================================================================

INSERT INTO public.spaces (name, type, hourly_rate) VALUES
  ('Cancha de Fútbol', 'futbol', 80000),
  ('Pista de Motocross', 'motocross', 50000),
  ('Mesa de Billar 1', 'billar', 20000);

INSERT INTO public.products (name, category, price, stock, min_stock) VALUES
  ('Coca-Cola', 'refresco', 3000, 20, 5),
  ('Agua Cristal', 'refresco', 2000, 30, 5),
  ('Cerveza Poker', 'cerveza', 4000, 24, 6),
  ('Cerveza Águila', 'cerveza', 4000, 24, 6),
  ('Papas Margarita', 'mekato', 2500, 15, 5),
  ('Chocoramo', 'mekato', 2000, 20, 5),
  ('Gatorade', 'refresco', 3500, 12, 4),
  ('Doritos', 'mekato', 3000, 10, 3),
  ('Jugo Hit', 'refresco', 2500, 15, 5),
  ('Bon Bon Bum', 'mekato', 500, 50, 10);

-- ==============================================================================
-- 9. ADMIN PROMOTION (COMMENTED)
-- ==============================================================================
-- Para promover un usuario a admin, ejecutar en el SQL Editor de Supabase:
-- UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"user_role": "superadmin"}'::jsonb WHERE email = 'admin@example.com';
-- UPDATE public.profiles SET role = 'superadmin' WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@example.com');
