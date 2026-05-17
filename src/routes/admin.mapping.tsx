import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { MapPin, Map as MapIcon, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/admin/mapping")({
  component: MappingHub,
  head: () => ({ meta: [{ title: "Mapping — Admin" }] }),
});

const items = [
  {
    to: "/admin/mapping/panchayath" as const,
    title: "Panchayath Map",
    desc: "Place a pin on the map for each panchayath",
    icon: MapPin,
    gradient: "from-[oklch(0.55_0.2_260)] to-[oklch(0.65_0.22_290)]",
  },
  {
    to: "/admin/mapping/ward" as const,
    title: "Ward Map",
    desc: "Place a pin on the map for each ward",
    icon: MapIcon,
    gradient: "from-[oklch(0.6_0.2_30)] to-[oklch(0.7_0.2_60)]",
  },
];

function MappingHub() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Mapping</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pin panchayaths and wards on a Google Map. Pins are cached on this device for offline viewing.
      </p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {items.map(({ to, title, desc, icon: Icon, gradient }) => (
          <Link key={to} to={to}>
            <Card
              className={`group relative h-40 overflow-hidden border-0 bg-gradient-to-br ${gradient} p-6 text-white shadow-lg transition-all hover:-translate-y-1 hover:shadow-2xl`}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,oklch(1_0_0/0.25),transparent_60%)]" />
              <div className="relative flex h-full flex-col justify-between">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm transition-transform group-hover:scale-110">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                    {title} <ChevronRight className="h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100" />
                  </h2>
                  <p className="mt-1 text-sm text-white/80">{desc}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
