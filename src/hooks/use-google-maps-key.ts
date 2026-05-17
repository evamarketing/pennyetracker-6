import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const GOOGLE_MAPS_KEY_NAME = "google_maps_api_key";

/** Returns the configured Google Maps API key, or null if unset. */
export function useGoogleMapsKey(): string | null {
  const { data } = useQuery({
    queryKey: ["app_settings", GOOGLE_MAPS_KEY_NAME],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", GOOGLE_MAPS_KEY_NAME)
        .maybeSingle();
      if (error) throw error;
      return (data?.value as string | null) ?? null;
    },
    staleTime: 5 * 60_000,
  });
  return data ?? null;
}
