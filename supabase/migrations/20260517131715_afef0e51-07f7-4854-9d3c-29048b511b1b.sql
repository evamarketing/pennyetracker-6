-- Add map location columns
ALTER TABLE public.panchayaths
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

ALTER TABLE public.wards
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

-- Public read for marked panchayaths only
DROP POLICY IF EXISTS "Public read marked panchayaths" ON public.panchayaths;
CREATE POLICY "Public read marked panchayaths"
ON public.panchayaths
FOR SELECT
TO anon
USING (latitude IS NOT NULL AND longitude IS NOT NULL);

-- Public helper to expose only the Google Maps API key
CREATE OR REPLACE FUNCTION public.get_public_google_maps_key()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM public.app_settings WHERE key = 'google_maps_api_key' LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_google_maps_key() TO anon, authenticated;