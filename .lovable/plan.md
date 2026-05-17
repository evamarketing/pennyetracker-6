## Goal

On the `/landing` page, add a new feature card that opens a public, read-only Google Map showing all panchayaths that already have a saved location.

Today, marked locations only exist behind the admin pages (`/admin/mapping/panchayath`). This makes them visible to any visitor.

## Changes

### 1. New public route: `src/routes/map.panchayath.tsx`
- Path: `/map/panchayath`
- Loads the Google Maps API key from `app_settings` via the existing `useGoogleMapsKey` hook.
- Queries `panchayaths` (id, name, district_id, latitude, longitude) where `latitude` and `longitude` are not null.
- Renders a full-height Google Map with one marker per panchayath. Marker tooltip = panchayath name. Map auto-fits bounds to all markers; falls back to Kerala default if none.
- Read-only: no click-to-place, no edit controls, no auth required.
- Uses the same `useGoogleMaps` loader hook as the admin picker.
- Hydrates instantly from the IndexedDB cache (`loadCachedPoints("panchayath")`) on mount, then refreshes from Supabase.
- Empty state: "No panchayath locations have been marked yet."
- Missing key state: "Map is not configured yet. Ask an admin to set the Google Maps API key."

### 2. New card on `/landing`
- Add a 5th card titled **"Panchayath Map"** to the `features` array in `src/routes/landing.tsx`.
- Icon: `Map` (lucide-react).
- Links to `/map/panchayath`.
- Reuses an existing gradient style for visual consistency.

## Notes

- No DB changes; reuses existing `panchayaths.latitude/longitude` columns and `app_settings.google_maps_api_key`.
- Public RLS on `panchayaths` is `authenticated`-only today. If we want this map fully public (no login), we'll need to either (a) add a public SELECT policy filtered to rows with non-null lat/lng, or (b) expose the data through a `SECURITY DEFINER` SQL function similar to `get_public_delivery_partners`. **Assumption: option (a)** — add a permissive public read policy limited to marked rows. Tell me if you'd rather keep it auth-only and I'll skip that migration.
- Google Maps key is read from `app_settings` (admin-only RLS). For an unauthenticated viewer we'd need a small change: a public `get_public_google_maps_key()` SQL function, or move the key to an `import.meta.env.VITE_*` value. **Assumption: add a `SECURITY DEFINER` function** that returns just that one key so the public viewer page can load the map. Tell me if you'd prefer the env-var route or want to keep the map admin-only.

## Out of scope

- Ward map viewer (can be added the same way later).
- Clustering, search, polygons, directions.
