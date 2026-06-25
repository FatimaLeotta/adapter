import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { extractRole } from "@/lib/role.functions";
import { emptyRole, type RoleData } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/rol")({ component: RolPage });

function RolPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const runExtract = useServerFn(extractRole);
  const [source, setSource] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState<RoleData>(emptyRole());
  const [extracted, setExtracted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hasSheet, setHasSheet] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("work_sheets").select("id").eq("user_id", user.id).limit(1).maybeSingle().then(({ data }) => setHasSheet(!!data));
  }, [user]);

  const extract = async () => {
    if (!source.trim()) return;
    setBusy(true);
    try {
      const res = await runExtract({ data: { sourceText: source } });
      setRoleTitle(res.role_title); setCompany(res.company);
      setRole({ summary: res.summary, seniority: res.seniority, experienceRequired: res.experienceRequired, responsibilities: res.responsibilities, skills: res.skills, tools: res.tools, education: res.education, languages: res.languages });
      setExtracted(true);
    } catch (e) { toast.error("No se pudo analizar el aviso", { description: e instanceof Error ? e.message : "" }); }
    finally { setBusy(false); }
  };

  const saveAndMatch = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { data: row, error } = await supabase.from("target_roles").insert({ user_id: user.id, role_title: roleTitle || "Rol", company: company || "Empresa", source_text: source, data: JSON.parse(JSON.stringify(role)) }).select("id").single();
      if (error) throw error;
      navigate({ to: "/match/$roleId", params: { roleId: row.id } });
    } catch (e) { toast.error("No se pudo guardar el rol", { description: e instanceof Error ? e.message : "" }); setBusy(false); }
  };

  const editList = (k: keyof RoleData, v: string) => setRole(r => ({ ...r, [k]: v.split("\n").map(s => s.trim()).filter(Boolean) }));

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Ahora el rol</h1>
      <p className="mt-2 text-muted-foreground">Pegá el aviso del puesto y la IA extrae las variables. Después ajustás lo que quieras.</p>
      {!hasSheet && <div className="mt-4 rounded-md border border-accent/40 bg-accent/5 p-3 text-sm">Todavía no tenés una hoja laboral guardada. Para hacer el match, completá y guardá tu hoja primero.</div>}
      <div className="mt-6 space-y-2">
        <Label>Aviso del puesto</Label>
        <Textarea rows={8} value={source} onChange={e => setSource(e.target.value)} placeholder="Pegá acá el texto completo del aviso…" />
        <Button onClick={extract} disabled={busy || !source.trim()}>{busy && !extracted ? "Analizando…" : "Analizar aviso"}</Button>
      </div>
      {extracted && (
        <div className="mt-8 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label className="text-xs">Rol</Label><Input value={roleTitle} onChange={e => setRoleTitle(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Empresa</Label><Input value={company} onChange={e => setCompany(e.target.value)} /></div>
          </div>
          <ListField label="Responsabilidades" value={role.responsibilities} onChange={v => editList("responsibilities", v)} />
          <ListField label="Habilidades técnicas" value={role.skills} onChange={v => editList("skills", v)} />
          <ListField label="Herramientas" value={role.tools} onChange={v => editList("tools", v)} />
          <ListField label="Formación requerida" value={role.education} onChange={v => editList("education", v)} />
          <ListField label="Idiomas" value={role.languages} onChange={v => editList("languages", v)} />
          <Button onClick={saveAndMatch} disabled={busy || !hasSheet} className="w-full sm:w-auto">{busy ? "Generando…" : "Guardar y ver el match"}</Button>
        </div>
      )}
    </div>
  );
}

function ListField({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label} (una por línea)</Label>
      <Textarea rows={3} value={value.join("\n")} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
