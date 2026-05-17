## Goal

Add a new map-based marking feature where admins can place a geographic point (latitude/longitude) for each panchayath and each ward on a Google Map. The Google Maps API key is configured in an Admin Settings page. Pins are stored in the database and cached in the browser (IndexedDB) for offline viewing.

Polygon boundaries are out of scope for this iteration (point-only, as requested).

## Database changes

1. New table `app_settings` (single-row key/value store for admin config):
   - `key text primary key`, `value text`, `updated_at timestamptz`
   - RLS: only admins can select/update. Used to store `google_maps_api_key`.

2. Add columns to existing tables:
   - `panchayaths`: `latitude double precision`, `longitude double precision`, `location_updated_at timestamptz`
   - `wards`: `latitude double precision`, `longitude double precision`, `location_updated_at timestamptz`

3. Indexes on `(latitude, longitude)` for both tables (lightweight, no PostGIS needed).

## Backend (server functions in `src/lib/`)

- `settings.functions.ts`
  - `getPublicSettings()` — returns only the Google Maps API key (used by the map UI, key is meant to be referrer-restricted in Google Cloud Console so it's safe to expose to the admin browser).
  - `updateSetting({ key, value })` — admin-only, uses `requireSupabaseAuth` + admin check.
- `geo.functions.ts`
  - `updatePanchayathLocation({ id, lat, lng })`
  - `updateWardLocation({ id, lat, lng })`
  - `listPanchayathLocations()` / `listWardLocations()` — return id, name, parent ids, lat, lng for offline cache hydration.

All mutations validated with Zod (lat ∈ [-90, 90], lng ∈ [-180, 180]) and gated by admin role.

## Frontend

### New route: `src/routes/admin.settings.tsx`
- Form with one field: **Google Maps API key**.
- Link/help text explaining how to create a key in Google Cloud Console and restrict it by HTTP referrer to the app domain.
- Save button → calls `updateSetting`.

### New route: `src/routes/admin.mapping.tsx` (map hub)
- Two cards like `/marking`: "Panchayath Map" and "Ward Map".

### New route: `src/routes/admin.mapping.panchayath.tsx`
- Loads Google Maps JS API dynamically using the key from settings. If no key is configured, shows a banner: "Add your Google Maps API key in Admin → Settings".
- Left panel: list of panchayaths (filter by district), each row shows "Marked" or "Not marked".
- Right panel: Google Map.
  - Click a panchayath → map centers on its pin (or default region center if none).
  - Click anywhere on the map → places a draggable pin and shows "Save location" / "Cancel".
  - **"Use my current location"** button → calls `navigator.geolocation.getCurrentPosition`, drops a pin at the device location, ready to save.
  - Saving calls `updatePanchayathLocation` and updates the IndexedDB cache.

### New route: `src/routes/admin.mapping.ward.tsx`
- Same UX, scoped by selected panchayath, working on `wards`.

### Offline cache (`src/lib/geoCache.ts`)
- Thin wrapper around IndexedDB (via `idb-keyval`, ~600 B) storing two keys: `panchayath_locations` and `ward_locations` (arrays of `{id, name, parent_id, lat, lng}`).
- On map page mount: render cached pins immediately, then fetch fresh data from the server function in the background and update cache + UI.
- If the user is offline, the map still renders the cached pins (Google tiles will only load when online, but pins/list remain usable).

### Navigation
- Add a "Mapping" item and a "Settings" item to the admin sidebar/nav (wherever `/admin/locations` is linked today).

## Technical notes

- **Why Google key in DB instead of env var:** the user explicitly asked for admin-configurable. The key is a browser-side key and should be locked down by HTTP referrer restrictions in Google Cloud Console. We document this in the Settings page.
- **No new npm packages required for Google Maps** — we load the JS API via a `<script>` tag injected on demand (standard pattern), so no `@react-google-maps/api` dependency.
- **IndexedDB**: add `idb-keyval` (tiny, ~600 B). Avoids hand-rolled IDB code.
- **RLS**: continue using the project's existing admin/role check pattern (the existing `admin.*` routes already gate access).
- Polygon support, search/geocoding, and clustering are deliberately out of scope for this iteration.

## Files to add/change

Add:
- `src/routes/admin.settings.tsx`
- `src/routes/admin.mapping.tsx`
- `src/routes/admin.mapping.panchayath.tsx`
- `src/routes/admin.mapping.ward.tsx`
- `src/components/map/GoogleMap.tsx` (loader + map wrapper)
- `src/components/map/MapPicker.tsx` (shared list-+-map UI used by both pages)
- `src/lib/settings.functions.ts`
- `src/lib/geo.functions.ts`
- `src/lib/geoCache.ts`
- DB migration for `app_settings` + new lat/lng columns + RLS

Change:
- Admin nav/sidebar — add "Mapping" and "Settings" entries.

## Open assumptions (will proceed unless you object)

- The Google Maps key, once set by an admin, is fetched by any admin user and used in their browser (standard for client-side Maps keys; security comes from referrer restriction).
- Default map center: derived from the first existing marked panchayath, else a Kerala-region fallback (`10.85, 76.27`, zoom 7).
