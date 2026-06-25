import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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

function SettingsPage() {
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirm) { toast.error("Las contraseñas no coinciden"); return; }
    if (newPw.length < 8) { toast.error("La contraseña debe tener al menos 8 caracteres"); return; }
    setBusy(true);
    try {
      // Re-authenticate first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: current,
      });
      if (signInError) { toast.error("Contraseña actual incorrecta"); setBusy(false); return; }
      // Update password
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      toast.success("Contraseña actualizada correctamente");
      setCurrent(""); setNewPw(""); setConfirm("");
    } catch (e) {
      toast.error("No se pudo cambiar la contraseña", { description: e instanceof Error ? e.message : "" });
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Configuración</h1>
      <p className="mt-2 text-muted-foreground">Cuenta: {user?.email}</p>

      <section className="mt-8">
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
