import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({ component: AuthenticatedLayout });

const NAV = [
  { to: "/app", label: "Inicio" }, { to: "/hoja", label: "Mi hoja laboral" },
  { to: "/rol", label: "Ahora el rol" }, { to: "/documentos", label: "Mis documentos" },
] as const;

function AuthenticatedLayout() {
  const { user, loading, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: s => s.location.pathname });

  useEffect(() => { if (!loading && !user) navigate({ to: "/login", replace: true }); }, [user, loading, navigate]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Logo className="h-6 text-muted-foreground" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-8">
            <Link to="/app" className="flex items-center text-foreground"><Logo className="h-5 text-foreground" /></Link>
            <nav className="flex flex-wrap items-center gap-1">
              {NAV.map(item => (
                <Link key={item.to} to={item.to} className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition-colors", pathname.startsWith(item.to) ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")}>{item.label}</Link>
              ))}
              {isAdmin && <Link to="/admin" className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition-colors", pathname.startsWith("/admin") ? "bg-secondary text-foreground" : "text-accent hover:text-accent/80")}>Admin</Link>}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">{user.email}</span>
            <Button variant="outline" size="sm" onClick={async () => { await signOut(); navigate({ to: "/login", replace: true }); }}>Salir</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8"><Outlet /></main>
    </div>
  );
}
