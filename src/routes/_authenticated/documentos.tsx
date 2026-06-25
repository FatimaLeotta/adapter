import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/documentos")({ component: DocumentosPage });

type RoleRow = { id: string; role_title: string; company: string; created_at: string };
type DocRow = { id: string; target_role_id: string | null; match_score: number; stage: string; cv: { headline?: string } | null };

function DocumentosPage() {
  const { user } = useAuth();
  const [hasSheet, setHasSheet] = useState(false);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("work_sheets").select("id").eq("user_id", user.id).limit(1).maybeSingle().then(({ data }) => setHasSheet(!!data));
    supabase.from("target_roles").select("id, role_title, company, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).then(({ data }) => setRoles(data ?? []));
    supabase.from("cv_documents").select("id, target_role_id, match_score, stage, cv").eq("user_id", user.id).then(({ data }) => setDocs((data as unknown as DocRow[]) ?? []));
  }, [user]);

  const docFor = (roleId: string) => docs.find(d => d.target_role_id === roleId);
  const hasCv = (doc?: DocRow) => !!doc && doc.stage === "final" && !!doc.cv && Object.keys(doc.cv).length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Mis documentos</h1>
        <p className="mt-2 text-muted-foreground">Tu hoja laboral alimenta todos los roles y CVs que generes.</p>
      </div>
      <section className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold text-foreground">Hoja laboral</h2>
        {hasSheet ? (
          <p className="mt-1 text-sm text-muted-foreground">Tenés tu hoja laboral guardada. <Link to="/hoja" className="text-accent hover:underline">Editar</Link></p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Todavía no creaste tu hoja laboral. <Link to="/hoja" className="text-accent hover:underline">Empezar</Link></p>
        )}
      </section>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Roles y CVs</h2>
          <Link to="/rol" className="text-sm text-accent hover:underline">+ Nuevo rol</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {roles.map(r => {
            const doc = docFor(r.id);
            const cvReady = hasCv(doc);
            return (
              <Link key={r.id} to="/match/$roleId" params={{ roleId: r.id }} className="flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-accent">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-medium text-foreground">{r.role_title}</p><p className="text-sm text-muted-foreground">{r.company}</p></div>
                  {typeof doc?.match_score === "number" && <span className="font-display text-2xl italic text-primary">{doc.match_score}</span>}
                </div>
                <div className="flex items-center gap-2 border-t pt-2">
                  {cvReady ? (
                    <><span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">CV propuesto</span>{doc?.cv?.headline && <span className="truncate text-xs text-muted-foreground">{doc.cv.headline}</span>}</>
                  ) : (
                    <span className="text-xs text-muted-foreground">{doc ? "CV propuesto pendiente" : "Sin análisis todavía"}</span>
                  )}
                </div>
              </Link>
            );
          })}
          {roles.length === 0 && <p className="text-sm text-muted-foreground">Todavía no analizaste ningún rol.</p>}
        </div>
      </section>
    </div>
  );
}
