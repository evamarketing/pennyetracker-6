import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save, ExternalLink } from "lucide-react";
import { GOOGLE_MAPS_KEY_NAME, useGoogleMapsKey } from "@/hooks/use-google-maps-key";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — Admin" }] }),
});

function SettingsPage() {
  const qc = useQueryClient();
  const existingKey = useGoogleMapsKey();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (existingKey != null) setValue(existingKey);
  }, [existingKey]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        key: GOOGLE_MAPS_KEY_NAME,
        value: value.trim() || null,
        updated_at: new Date().toISOString(),
        updated_by: u.user?.id ?? null,
      };
      const { error } = await supabase.from("app_settings").upsert(payload, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app_settings"] });
      toast.success("Settings saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">App-wide configuration available to admins.</p>

      <Card className="mt-6 max-w-2xl">
        <CardHeader>
          <CardTitle>Google Maps API key</CardTitle>
          <CardDescription>
            Used by the Mapping pages to render Google Maps. The key is exposed to logged-in admins in
            the browser, so you must restrict it in Google Cloud Console.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="key">API key</Label>
            <Input
              id="key"
              placeholder="AIza…"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">How to get a key</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4">
              <li>Open Google Cloud Console → APIs &amp; Services → Credentials.</li>
              <li>Create an API key and enable the <b>Maps JavaScript API</b>.</li>
              <li>
                Restrict it: <b>Application restrictions</b> → HTTP referrers → add your app URLs
                (e.g. <code>*.lovable.app/*</code> and your custom domain).
              </li>
            </ol>
            <a
              href="https://console.cloud.google.com/google/maps-apis/credentials"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-primary hover:underline"
            >
              Open Google Cloud Console <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="h-4 w-4" /> {save.isPending ? "Saving…" : "Save"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
