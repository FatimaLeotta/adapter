import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Configuración · Adapter" }] }),
  component: SettingsPage,
});

// Links de pago de Mercado Pago — reemplazar por los tuyos reales
const PACKS = [
  { credits: 1, price: "$3.000", perCv: "$3.000 c/u", link: "https://link.mercadopago.com.ar/REEMPLAZAR_1CV" },
  { credits: 3, price: "$7.500", perCv: "$2.500 c/u", link: "https://link.mercadopago.com.ar/REEMPLAZAR_3CV", popular: true },
  { credits: 5, price: "$11.000", perCv: "$2.200 c/u", link: "https://link.mercadopago.com.ar/REEMPLAZAR_5CV" },
];

function SettingsPage() {
  const { user } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);
  const [current, setCurrent] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("credits").eq("id", user.id).maybeSingle().then(({ data }) => setCredits(data?.credits ?? 0));
  }, [user]);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirm) { toast.error("Las contraseñas no coinciden"); return; }
    if (newPw.length < 8) { toast.error("La contraseña debe tener al menos 8 caracteres"); return; }
    setBusy(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: user!.email!, password: current });
      if (signInError) { toast.error("Contraseña actual incorrecta"); setBusy(false); return; }
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      toast.success("Contraseña actualizada correctamente");
      setCurrent(""); setNewPw(""); setConfirm("");
    } catch (e) {
      toast.error("No se pudo cambiar la contraseña", { description: e instanceof Error ? e.message : "" });
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Configuración</h1>
        <p className="mt-2 text-muted-foreground">Cuenta: {user?.email}</p>
      </div>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Créditos</h2>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            {credits === null ? "…" : `${credits} CV disponible(s)`}
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          La entrevista, la carga del rol y la matriz comparativa son gratis. Cada CV generado usa 1 crédito. Regenerar un CV usa otro crédito.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {PACKS.map(p => (
            <div key={p.credits} className={"relative rounded-lg border bg-card p-5 " + (p.popular ? "border-accent ring-1 ring-accent" : "")}>
              {p.popular && <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">Más elegido</span>}
              <p className="font-display text-3xl italic text-primary">{p.credits}</p>
              <p className="text-sm text-muted-foreground">{p.credits === 1 ? "CV" : "CVs"}</p>
              <p className="mt-3 text-lg font-semibold text-foreground">{p.price}</p>
              <p className="text-xs text-muted-foreground">{p.perCv}</p>
              <a href={p.link} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Comprar</a>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Tras el pago, los créditos se acreditan a la brevedad. Si tardan, escribinos con tu comprobante.
        </p>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Cambiar contraseña</h2>
        <form onSubmit={changePassword} className="space-y-4 rounded-lg border bg-card p-5">
          <div className="space-y-1">
            <Label htmlFor="current">Contraseña actual</Label>
            <Input id="current" type="password" required value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new">Contraseña nueva</Label>
            <Input id="new" type="password" required value={newPw} onChange={e => setNewPw(e.target.value)} autoComplete="new-password" minLength={8} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirm">Confirmar contraseña nueva</Label>
            <Input id="confirm" type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" minLength={8} />
          </div>
          <Button type="submit" disabled={busy || !current || !newPw || !confirm}>
            {busy ? "Cambiando…" : "Cambiar contraseña"}
          </Button>
        </form>
      </section>
    </div>
  );
}
