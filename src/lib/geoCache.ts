// IndexedDB-backed offline cache for map pins.
// Pins are written to the DB as the source of truth, then mirrored here
// so the map renders instantly (and continues to render offline).
import { get, set } from "idb-keyval";

export type GeoPoint = {
  id: string;
  name: string;
  parent_id: string | null;
  lat: number | null;
  lng: number | null;
  ward_number?: string | null;
};

const KEY = (kind: "panchayath" | "ward") => `geo_${kind}_locations_v1`;

export async function loadCachedPoints(kind: "panchayath" | "ward"): Promise<GeoPoint[]> {
  try {
    return (await get<GeoPoint[]>(KEY(kind))) ?? [];
  } catch {
    return [];
  }
}

export async function saveCachedPoints(
  kind: "panchayath" | "ward",
  points: GeoPoint[],
): Promise<void> {
  try {
    await set(KEY(kind), points);
  } catch {
    /* ignore quota / private-mode errors */
  }
}

export async function upsertCachedPoint(
  kind: "panchayath" | "ward",
  point: GeoPoint,
): Promise<void> {
  const current = await loadCachedPoints(kind);
  const idx = current.findIndex((p) => p.id === point.id);
  if (idx >= 0) current[idx] = point;
  else current.push(point);
  await saveCachedPoints(kind, current);
}
