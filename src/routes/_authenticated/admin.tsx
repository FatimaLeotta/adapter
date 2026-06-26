import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { createAccess, listAccess, revokeAccess, grantCredits } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin")({ component: AdminPage });

const APP_URL = "https://adapter-blond.vercel.app";

function buildMailto(email: string, password: string): string {
  const subject = "Tus accesos a Adapter";
  const body = [
    "¡Hola!",
    "",
    "Te comparto tus accesos para entrar a Adapter, la herramienta para adaptar tu CV a cada rol:",
    "",
    `Ingresá en: ${APP_URL}/login`,
    `Email: ${email}`,
    `Contraseña: ${password}`,
    "",
    "Una vez adentro, podés cambiar tu contraseña desde Configuración.",
    "",
    "La entrevista para armar tu hoja laboral, la carga del rol y la matriz comparativa son gratis. Para generar el CV final usás un crédito, que podés comprar desde Configuración.",
    "",
    "Cualquier duda, escribime.",
    "",
    "Fátima",
  ].join("\n");
  // Gmail web compose — funciona en el navegador sin depender de una app de correo
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function buildWhatsapp(email: string, password: string): string {
  const msg = [
    "¡Hola! Te comparto tus accesos a Adapter, la herramienta para adaptar tu CV a cada rol:",
    "",
    `Ingresá en: ${APP_URL}/login`,
    `Email: ${email}`,
    `Contraseña: ${password}`,
    "",
    "Adentro podés cambiar tu contraseña desde Configuración. La entrevista, la carga del rol y la matriz son gratis; el CV final usa un crédito que comprás desde Configuración.",
    "",
    "Cualquier duda, escribime. ¡Éxitos!",
  ].join("\n");
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

type AccessRow = { id: string; email: string | null; fullName: string | null; createdAt: string; credits: number; cvsGenerated: number; isAdmin: boolean };

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const runList = useServerFn(listAccess);
  const runCreate = useServerFn(createAccess);
  const runRevoke = useServerFn(revokeAccess);
  const runGrant = useServerFn(grantCredits);
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => { if (!loading && !isAdmin) navigate({ to: "/app", replace: true }); }, [isAdmin, loading, navigate]);
  const refresh = () => { runList().then(data => setRows(data as AccessRow[])).catch(e => toast.error("No se pudo cargar", { description: e?.message })); };
  useEffect(() => { if (isAdmin) refresh(); }, [isAdmin]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const res = await runCreate({ data: { email, fullName } });
      setGenerated({ email: res.email, password: res.password }); setEmail(""); setFullName(""); refresh(); toast.success("Acceso creado");
    } catch (err) { toast.error("No se pudo crear el acceso", { description: err instanceof Error ? err.message : "" }); }
    finally { setBusy(false); }
  };

  const revoke = async (userId: string) => {
    if (!confirm("¿Revocar el acceso de esta persona? Se borrará su cuenta.")) return;
    try { await runRevoke({ data: { userId } }); toast.success("Acceso revocado"); refresh(); }
    catch (e) { toast.error("No se pudo revocar", { description: e instanceof Error ? e.message : "" }); }
  };

  const grant = async (userId: string, email: string | null) => {
    const input = prompt(`¿Cuántos créditos cargar a ${email}?`, "3");
    if (!input) return;
    const amount = parseInt(input, 10);
    if (isNaN(amount) || amount < 1) { toast.error("Cantidad inválida"); return; }
    try {
      const res = await runGrant({ data: { userId, amount } });
      toast.success(`Créditos cargados`, { description: `${email} ahora tiene ${res.credits} crédito(s).` });
      refresh();
    } catch (e) { toast.error("No se pudo cargar créditos", { description: e instanceof Error ? e.message : "" }); }
  };

  if (loading || !isAdmin) return null;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Administración</h1>
        <p className="mt-2 text-muted-foreground">Creá accesos por email. La contraseña se genera automáticamente.</p>
      </div>
      <form onSubmit={create} className="space-y-4 rounded-lg border bg-card p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label className="text-xs">Email</Label><Input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Nombre (opcional)</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} /></div>
        </div>
        <Button type="submit" disabled={busy}>{busy ? "Creando…" : "Crear acceso"}</Button>
      </form>
      {generated && (
        <div className="rounded-lg border border-accent/40 bg-accent/5 p-4">
          <p className="text-sm font-medium text-foreground">Acceso generado</p>
          <p className="mt-1 text-sm text-muted-foreground">Email: <span className="font-mono text-foreground">{generated.email}</span></p>
          <p className="text-sm text-muted-foreground">Contraseña: <span className="font-mono text-foreground">{generated.password}</span></p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={buildMailto(generated.email, generated.password)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Enviar por Gmail
            </a>
            <a
              href={buildWhatsapp(generated.email, generated.password)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              Enviar por WhatsApp
            </a>
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(`Ingresá en: ${APP_URL}/login\nEmail: ${generated.email}\nContraseña: ${generated.password}`); toast.success("Copiado al portapapeles"); }}>
              Copiar
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Gmail abre el correo redactado en una pestaña nueva. WhatsApp abre el mensaje listo para elegir contacto.</p>
        </div>
      )}
      <section>
        <h2 className="mb-3 font-semibold text-foreground">Accesos</h2>
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-secondary"><tr><th className="p-3 text-left font-medium">Email</th><th className="p-3 text-left font-medium">Nombre</th><th className="p-3 text-center font-medium">Créditos</th><th className="p-3 text-center font-medium">CVs</th><th className="p-3 text-left font-medium">Rol</th><th className="p-3"></th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 text-foreground">{r.email}</td>
                  <td className="p-3 text-muted-foreground">{r.fullName || "—"}</td>
                  <td className="p-3 text-center"><span className="font-medium text-primary">{r.credits}</span></td>
                  <td className="p-3 text-center text-muted-foreground">{r.cvsGenerated}</td>
                  <td className="p-3 text-muted-foreground">{r.isAdmin ? "Admin" : "Usuario"}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => grant(r.id, r.email)}>+ Créditos</Button>
                      {!r.isAdmin && <Button variant="outline" size="sm" onClick={() => revoke(r.id)}>Revocar</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
