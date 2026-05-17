
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'delivery');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','super_admin')) $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'delivery');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ LOCATIONS ============
CREATE TABLE public.states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id UUID NOT NULL REFERENCES public.states(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(state_id, name)
);
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.panchayaths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(district_id, name),
  CONSTRAINT panchayaths_lat_range CHECK (latitude  IS NULL OR (latitude  BETWEEN -90  AND 90)),
  CONSTRAINT panchayaths_lng_range CHECK (longitude IS NULL OR (longitude BETWEEN -180 AND 180))
);
ALTER TABLE public.panchayaths ENABLE ROW LEVEL SECURITY;
CREATE INDEX panchayaths_latlng_idx ON public.panchayaths (latitude, longitude);

CREATE TABLE public.wards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panchayath_id UUID NOT NULL REFERENCES public.panchayaths(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ward_number TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(panchayath_id, name),
  CONSTRAINT wards_lat_range CHECK (latitude  IS NULL OR (latitude  BETWEEN -90  AND 90)),
  CONSTRAINT wards_lng_range CHECK (longitude IS NULL OR (longitude BETWEEN -180 AND 180))
);
ALTER TABLE public.wards ENABLE ROW LEVEL SECURITY;
CREATE INDEX wards_latlng_idx ON public.wards (latitude, longitude);

-- ============ MARKING CONNECTIONS (existing feature) ============
CREATE TABLE public.panchayath_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_panchayath_id UUID NOT NULL REFERENCES public.panchayaths(id) ON DELETE CASCADE,
  target_panchayath_id UUID NOT NULL REFERENCES public.panchayaths(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('north','south','east','west')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_panchayath_id, direction)
);
ALTER TABLE public.panchayath_connections ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ward_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_ward_id UUID NOT NULL REFERENCES public.wards(id) ON DELETE CASCADE,
  target_ward_id UUID NOT NULL REFERENCES public.wards(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('north','south','east','west')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_ward_id, direction)
);
ALTER TABLE public.ward_connections ENABLE ROW LEVEL SECURITY;

-- ============ DELIVERY STAFF ============
CREATE TABLE public.delivery_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  alt_phone TEXT,
  email TEXT,
  vehicle_number TEXT,
  license_number TEXT,
  ward_id UUID REFERENCES public.wards(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_staff ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER delivery_staff_updated_at BEFORE UPDATE ON public.delivery_staff
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.delivery_staff_panchayaths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.delivery_staff(id) ON DELETE CASCADE,
  panchayath_id uuid NOT NULL REFERENCES public.panchayaths(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, panchayath_id)
);
CREATE INDEX idx_dsp_staff ON public.delivery_staff_panchayaths(staff_id);

CREATE TABLE public.delivery_staff_wards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.delivery_staff(id) ON DELETE CASCADE,
  ward_id uuid NOT NULL REFERENCES public.wards(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, ward_id)
);
CREATE INDEX idx_dsw_staff ON public.delivery_staff_wards(staff_id);

ALTER TABLE public.delivery_staff_panchayaths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_staff_wards ENABLE ROW LEVEL SECURITY;

-- ============ APP SETTINGS (key/value config, e.g. Google Maps API key) ============
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER app_settings_updated_at BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ POLICIES ============
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins update profiles" ON public.profiles FOR UPDATE USING (public.is_admin(auth.uid()));

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Super admin manage roles insert" ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Super admin manage roles delete" ON public.user_roles FOR DELETE USING (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Super admin manage roles update" ON public.user_roles FOR UPDATE USING (public.has_role(auth.uid(),'super_admin'));

DO $$ DECLARE t TEXT; BEGIN
  FOR t IN SELECT unnest(ARRAY['states','districts','panchayaths','wards']) LOOP
    EXECUTE format('CREATE POLICY "Authenticated read %1$s" ON public.%1$s FOR SELECT TO authenticated USING (true);', t);
    EXECUTE format('CREATE POLICY "Admins insert %1$s" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));', t);
    EXECUTE format('CREATE POLICY "Admins update %1$s" ON public.%1$s FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));', t);
    EXECUTE format('CREATE POLICY "Admins delete %1$s" ON public.%1$s FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));', t);
  END LOOP;
END $$;

DO $$ DECLARE t TEXT; BEGIN
  FOR t IN SELECT unnest(ARRAY['panchayath_connections','ward_connections']) LOOP
    EXECUTE format('CREATE POLICY "Authenticated read %1$s" ON public.%1$s FOR SELECT TO authenticated USING (true);', t);
    EXECUTE format('CREATE POLICY "Admins insert %1$s" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));', t);
    EXECUTE format('CREATE POLICY "Admins update %1$s" ON public.%1$s FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));', t);
    EXECUTE format('CREATE POLICY "Admins delete %1$s" ON public.%1$s FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));', t);
  END LOOP;
END $$;

CREATE POLICY "Admins view staff" ON public.delivery_staff FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff view self" ON public.delivery_staff FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins insert staff" ON public.delivery_staff FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update staff" ON public.delivery_staff FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete staff" ON public.delivery_staff FOR DELETE USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage staff panchayaths select" ON public.delivery_staff_panchayaths FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage staff panchayaths insert" ON public.delivery_staff_panchayaths FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage staff panchayaths delete" ON public.delivery_staff_panchayaths FOR DELETE USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff view own panchayaths" ON public.delivery_staff_panchayaths FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.delivery_staff s WHERE s.id = staff_id AND s.user_id = auth.uid())
);

CREATE POLICY "Admins manage staff wards select" ON public.delivery_staff_wards FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage staff wards insert" ON public.delivery_staff_wards FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage staff wards delete" ON public.delivery_staff_wards FOR DELETE USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff view own wards" ON public.delivery_staff_wards FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.delivery_staff s WHERE s.id = staff_id AND s.user_id = auth.uid())
);

CREATE POLICY "Authenticated read app_settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert app_settings" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update app_settings" ON public.app_settings FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete app_settings" ON public.app_settings FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- ============ Helpers ============
CREATE OR REPLACE FUNCTION public.promote_to_super_admin(_email TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email = _email LIMIT 1;
  IF _uid IS NULL THEN RAISE EXCEPTION 'User % not found', _email; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'super_admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END; $$;

CREATE OR REPLACE FUNCTION public.get_public_delivery_partners()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(g ORDER BY g->>'panchayath_name'), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'panchayath_id', p.id,
      'panchayath_name', p.name,
      'partners', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', s.id, 'full_name', s.full_name, 'phone', s.phone, 'alt_phone', s.alt_phone,
          'wards', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('name', w.name, 'ward_number', w.ward_number)
              ORDER BY w.ward_number NULLS LAST, w.name)
            FROM public.delivery_staff_wards dsw
            JOIN public.wards w ON w.id = dsw.ward_id
            WHERE dsw.staff_id = s.id AND w.panchayath_id = p.id
          ), '[]'::jsonb)
        ) ORDER BY s.full_name)
        FROM public.delivery_staff s
        JOIN public.delivery_staff_panchayaths dsp ON dsp.staff_id = s.id
        WHERE dsp.panchayath_id = p.id AND s.status = 'active'
      ), '[]'::jsonb)
    ) AS g
    FROM public.panchayaths p
    WHERE EXISTS (
      SELECT 1 FROM public.delivery_staff_panchayaths dsp
      JOIN public.delivery_staff s ON s.id = dsp.staff_id
      WHERE dsp.panchayath_id = p.id AND s.status = 'active'
    )
  ) t;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_delivery_partners() TO anon, authenticated;
