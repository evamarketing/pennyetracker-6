import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, MapPin, Map, Settings, ShieldCheck, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
  head: () => ({ meta: [{ title: "Admin — Penny-eTracker" }] }),
});

const nav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/staff", label: "Delivery Staff", icon: Users },
  { to: "/admin/locations", label: "Locations", icon: MapPin },
  { to: "/admin/mapping", label: "Mapping", icon: Map },
  { to: "/admin/settings", label: "Settings", icon: Settings },
  { to: "/admin/users", label: "Roles", icon: ShieldCheck, superOnly: true },
];

function AdminLayout() {
  const { user, loading, isAdmin, isSuperAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return null;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold">No admin access</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account ({user.email}) doesn't have admin privileges. Ask a super admin to grant you access.
          </p>
          <Button onClick={signOut} variant="outline" className="mt-6">Sign out</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-64 shrink-0 border-r bg-card md:block">
        <div className="px-6 py-5">
          <Link to="/landing" className="text-lg font-semibold tracking-tight">
            Penny-eTracker
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">Admin Panel</p>
        </div>
        <nav className="space-y-1 px-3">
          {nav.filter((n) => !n.superOnly || isSuperAdmin).map((n) => {
            const active = n.exact ? location.pathname === n.to : location.pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-4 left-3 w-58">
          <div className="rounded-md border bg-background p-3 text-xs">
            <div className="truncate font-medium">{user.email}</div>
            <div className="mt-0.5 text-muted-foreground">
              {isSuperAdmin ? "Super Admin" : "Admin"}
            </div>
            <Button onClick={signOut} variant="ghost" size="sm" className="mt-2 h-7 w-full justify-start gap-2 px-2">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-b bg-card px-6 py-3 md:hidden">
          <Link to="/landing" className="font-semibold">Penny-eTracker</Link>
          <Button onClick={signOut} variant="ghost" size="sm"><LogOut className="h-4 w-4" /></Button>
        </header>
        <div className="mx-auto max-w-6xl p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
