// This file contains the full Hoja Laboral page
// Content preserved exactly from Lovable project
// See original at: https://lovable.dev/projects/f131da7f-b5be-4a8b-b552-e77c8b10dbae
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { interviewStep } from "@/lib/worksheet.functions";
import { exportWorksheet } from "@/lib/export.functions";
import { emptyWorkSheet, type ChatMessage, type Education, type Experience, type Language, type WorkSheetData } from "@/lib/types";
import { downloadBase64Docx } from "@/lib/download";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/hoja")({ component: HojaPage });

type Mode = "loading" | "interview" | "editing";

function HojaPage() {
  const { user } = useAuth();
  const runInterview = useServerFn(interviewStep);
  const runExport = useServerFn(exportWorksheet);
  const [mode, setMode] = useState<Mode>("loading");
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [data, setData] = useState<WorkSheetData>(emptyWorkSheet());
  const [originalData, setOriginalData] = useState<WorkSheetData | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [interviewDone, setInterviewDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("work_sheets").select("id, data").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle().then(({ data: row }) => {
      if (row) { setSheetId(row.id); setData(row.data as WorkSheetData); setSavedSnapshot(JSON.stringify(row.data)); setMode("editing"); }
      else setMode("interview");
    });
  }, [user]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages, thinking]);

  const send = async (text: string) => {
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next); setInput(""); setThinking(true);
    try {
      const res = await runInterview({ data: { messages: next, current: data } });
      setMessages([...next, { role: "assistant", content: res.reply }]);
      setData(res.data); setInterviewDone(res.done);
      // Autoguardar el progreso para no perder lo cargado si se cierra la página
      void autosave(res.data);
    } catch (e) {
      toast.error("Error en la entrevista", { description: e instanceof Error ? e.message : "Intentá de nuevo." });
      setMessages(next);
    } finally { setThinking(false); }
  };

  const startInterview = () => { setInterviewDone(false); send("Empecemos la entrevista."); };
  const finishInterview = () => { editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); toast.success("Listo", { description: "Revisá tu hoja laboral y guardá los cambios." }); };
  const startGeneralEdit = () => { setOriginalData(data); setMessages([]); setInterviewDone(false); setMode("interview"); void send("Quiero revisar y rehacer mi hoja laboral completa desde cero."); };
  const cancelGeneralEdit = () => { if (originalData) setData(originalData); setOriginalData(null); setMessages([]); setMode("editing"); };

  // Guarda silenciosamente el progreso (sin toast) para no perder datos si se cierra la página
  const autosave = async (snapshot: WorkSheetData) => {
    if (!user) return;
    try {
      let targetId = sheetId;
      if (!targetId) {
        const { data: existing } = await supabase.from("work_sheets").select("id").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
        targetId = existing?.id ?? null;
      }
      if (targetId) {
        await supabase.from("work_sheets").update({ data: snapshot }).eq("id", targetId);
        setSheetId(targetId);
      } else {
        const { data: row } = await supabase.from("work_sheets").insert({ user_id: user.id, data: snapshot, title: "mi hoja laboral" }).select("id").single();
        if (row) setSheetId(row.id);
      }
    } catch {
      // Silencioso: si falla el autoguardado, no interrumpimos la entrevista
    }
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      let targetId = sheetId;
      if (!targetId) {
        const { data: existing } = await supabase.from("work_sheets").select("id").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
        targetId = existing?.id ?? null;
      }
      if (targetId) {
        const { error } = await supabase.from("work_sheets").update({ data }).eq("id", targetId);
        if (error) throw error; setSheetId(targetId);
      } else {
        const { data: row, error } = await supabase.from("work_sheets").insert({ user_id: user.id, data, title: "mi hoja laboral" }).select("id").single();
        if (error) throw error; setSheetId(row.id);
      }
      setMode("editing"); setOriginalData(null); setSavedSnapshot(JSON.stringify(data)); toast.success("Hoja laboral guardada");
    } catch (e) { toast.error("No se pudo guardar", { description: e instanceof Error ? e.message : "" }); }
    finally { setSaving(false); }
  };

  const doExport = async () => {
    try {
      const { base64 } = await runExport({ data: { worksheet: data } });
      downloadBase64Docx(base64, "mi hoja laboral");
    } catch (e) { toast.error("No se pudo exportar", { description: e instanceof Error ? e.message : "" }); }
  };

  const setPersonal = (k: keyof WorkSheetData["personal"], v: string) => setData(d => ({ ...d, personal: { ...d.personal, [k]: v } }));
  const updateExperience = (i: number, patch: Partial<Experience>) => setData(d => ({ ...d, experiences: d.experiences.map((e, idx) => idx === i ? { ...e, ...patch } : e) }));
  const addExperience = () => setData(d => ({ ...d, experiences: [...d.experiences, { company: "", role: "", start: "", end: "", responsibilities: [], skills: [], metrics: [], metricsResults: [], achievements: [], tools: [] }] }));
  const removeExperience = (i: number) => setData(d => ({ ...d, experiences: d.experiences.filter((_, idx) => idx !== i) }));
  const updateEducation = (i: number, patch: Partial<Education>) => setData(d => ({ ...d, education: d.education.map((e, idx) => idx === i ? { ...e, ...patch } : e) }));
  const addEducation = () => setData(d => ({ ...d, education: [...d.education, { institution: "", title: "", year: "", detail: "" }] }));
  const removeEducation = (i: number) => setData(d => ({ ...d, education: d.education.filter((_, idx) => idx !== i) }));
  const updateLanguage = (i: number, patch: Partial<Language>) => setData(d => ({ ...d, languages: d.languages.map((l, idx) => idx === i ? { ...l, ...patch } : l) }));
  const addLanguage = () => setData(d => ({ ...d, languages: [...d.languages, { language: "", level: "" }] }));
  const removeLanguage = (i: number) => setData(d => ({ ...d, languages: d.languages.filter((_, idx) => idx !== i) }));

  if (mode === "loading") return <p className="text-sm text-muted-foreground">Cargando tu hoja laboral…</p>;

  const isDirty = JSON.stringify(data) !== savedSnapshot;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {mode === "interview" && (
        <section className="flex h-[70vh] flex-col rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div><h2 className="font-semibold text-foreground">Hoja en blanco · entrevista</h2><p className="text-xs text-muted-foreground">Respondé una pregunta a la vez.</p></div>
            {originalData && <Button variant="ghost" size="sm" onClick={cancelGeneralEdit}>Cancelar edición general</Button>}
          </div>
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="mx-auto max-w-md text-center">
                <div className="mb-4 rounded-lg border border-accent/30 bg-accent/5 p-4 text-left">
                  <p className="text-sm leading-relaxed text-foreground">
                    Esto va a llevarte tiempo. Cada respuesta es la base para que tus CVs estén potenciados al máximo. Respondé a conciencia y haciendo el mayor esfuerzo para que tus respuestas sean lo más completas posibles. No te preocupes si olvidás algo, luego vas a poder editar y completar. Pero no lo olvides: <span className="font-display italic text-accent">aquí empieza tu próxima oportunidad laboral.</span>
                  </p>
                </div>
                <Button onClick={startInterview} disabled={thinking}>Empezar entrevista</Button>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground" : "mr-auto max-w-[85%] whitespace-pre-wrap rounded-lg bg-secondary px-3 py-2 text-sm text-foreground"}>{m.content}</div>
            ))}
            {thinking && <div className="mr-auto rounded-lg bg-secondary px-3 py-2 text-sm text-muted-foreground">Pensando…</div>}
            {interviewDone && !thinking && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-center">
                <p className="mb-2 text-sm font-medium text-foreground">Terminaste la entrevista. Revisá la hoja a la derecha y guardala.</p>
                <Button size="sm" onClick={finishInterview}>Listo, finalizar entrevista</Button>
              </div>
            )}
          </div>
          <form className="flex gap-2 border-t p-3" onSubmit={e => { e.preventDefault(); if (input.trim() && !thinking) send(input.trim()); }}>
            <Input value={input} onChange={e => setInput(e.target.value)} placeholder="Escribí tu respuesta…" disabled={thinking} />
            <Button type="submit" disabled={thinking || !input.trim()}>Enviar</Button>
          </form>
        </section>
      )}
      <section ref={editorRef} className={mode === "interview" ? "flex h-[70vh] flex-col rounded-lg border bg-card" : "flex h-[78vh] flex-col rounded-lg border bg-card lg:col-span-2"}>
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <div><h2 className="font-semibold text-foreground">Mi hoja laboral</h2><p className="text-xs text-muted-foreground">{mode === "interview" ? "Revisá y corregí antes de guardar." : "Editá por dato o rehacé la entrevista completa."}</p></div>
          <div className="flex flex-wrap justify-end gap-2">
            {mode === "editing" && <Button variant="outline" size="sm" onClick={startGeneralEdit}>Editar hoja laboral</Button>}
            <Button variant="outline" size="sm" onClick={doExport}>Descargar Word</Button>
            {(mode === "interview" || isDirty) && <Button size="sm" onClick={save} disabled={saving}>{saving ? "Guardando…" : mode === "interview" ? originalData ? "Guardar cambios" : "Revisar y guardar" : "Guardar cambios"}</Button>}
          </div>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
          <Block title="Datos personales">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre completo" value={data.personal.fullName} onChange={v => setPersonal("fullName", v)} />
              <Field label="Titular / headline" value={data.personal.headline} onChange={v => setPersonal("headline", v)} />
              <Field label="Email" value={data.personal.email} onChange={v => setPersonal("email", v)} />
              <Field label="Teléfono" value={data.personal.phone} onChange={v => setPersonal("phone", v)} />
              <Field label="Ubicación" value={data.personal.location} onChange={v => setPersonal("location", v)} />
              <Field label="Modalidad de trabajo" value={data.personal.workMode} onChange={v => setPersonal("workMode", v)} />
              <Field label="Disponibilidad de relocación" value={data.personal.relocation} onChange={v => setPersonal("relocation", v)} />
              <Field label="LinkedIn" value={data.personal.linkedin} onChange={v => setPersonal("linkedin", v)} />
              <Field label="Otros links" value={data.personal.links} onChange={v => setPersonal("links", v)} />
            </div>
          </Block>
          <Block title={`Experiencia (${data.experiences.length})`} action={<Button variant="outline" size="sm" onClick={addExperience}>+ Agregar experiencia</Button>}>
            {data.experiences.length === 0 && <p className="text-xs text-muted-foreground">Todavía no hay experiencias.</p>}
            {data.experiences.map((exp, i) => (
              <div key={i} className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Experiencia {i + 1}</span><Button variant="ghost" size="sm" onClick={() => removeExperience(i)}>Eliminar</Button></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Empresa" value={exp.company} onChange={v => updateExperience(i, { company: v })} />
                  <Field label="Rol" value={exp.role} onChange={v => updateExperience(i, { role: v })} />
                  <Field label="Inicio (Mes Año)" value={exp.start} onChange={v => updateExperience(i, { start: v })} />
                  <Field label="Fin (Mes Año / Actual)" value={exp.end} onChange={v => updateExperience(i, { end: v })} />
                </div>
                <ListField label="Responsabilidades y tareas" value={exp.responsibilities} onChange={v => updateExperience(i, { responsibilities: v })} />
                <ListField label="Habilidades técnicas" value={exp.skills} onChange={v => updateExperience(i, { skills: v })} />
                <ListField label="Métricas: indicadores" value={exp.metrics} onChange={v => updateExperience(i, { metrics: v })} />
                <ListField label="Métricas: resultados" value={exp.metricsResults ?? []} onChange={v => updateExperience(i, { metricsResults: v })} />
                <ListField label="Logros" value={exp.achievements} onChange={v => updateExperience(i, { achievements: v })} />
                <ListField label="Herramientas" value={exp.tools} onChange={v => updateExperience(i, { tools: v })} />
              </div>
            ))}
          </Block>
          <Block title={`Formación (${data.education.length})`} action={<Button variant="outline" size="sm" onClick={addEducation}>+ Agregar formación</Button>}>
            {data.education.length === 0 && <p className="text-xs text-muted-foreground">Sin formación cargada.</p>}
            {data.education.map((ed, i) => (
              <div key={i} className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Formación {i + 1}</span><Button variant="ghost" size="sm" onClick={() => removeEducation(i)}>Eliminar</Button></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Qué estudió" value={ed.title} onChange={v => updateEducation(i, { title: v })} />
                  <Field label="Dónde estudió" value={ed.institution} onChange={v => updateEducation(i, { institution: v })} />
                  <Field label="Fecha / período" value={ed.year} onChange={v => updateEducation(i, { year: v })} />
                  <Field label="Detalle" value={ed.detail} onChange={v => updateEducation(i, { detail: v })} />
                </div>
              </div>
            ))}
          </Block>
          <Block title={`Idiomas (${data.languages.length})`} action={<Button variant="outline" size="sm" onClick={addLanguage}>+ Agregar idioma</Button>}>
            {data.languages.length === 0 && <p className="text-xs text-muted-foreground">Sin idiomas cargados.</p>}
            {data.languages.map((l, i) => (
              <div key={i} className="flex items-end gap-2 rounded-md border p-3">
                <div className="flex-1"><Field label="Idioma" value={l.language} onChange={v => updateLanguage(i, { language: v })} /></div>
                <div className="flex-1"><Field label="Nivel" value={l.level} onChange={v => updateLanguage(i, { level: v })} /></div>
                <Button variant="ghost" size="sm" onClick={() => removeLanguage(i)}>Eliminar</Button>
              </div>
            ))}
          </Block>
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (<div className="space-y-1"><Label className="text-xs">{label}</Label><Input value={value} onChange={e => onChange(e.target.value)} /></div>);
}

function ListField({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(value.join("\n"));
  useEffect(() => { setText(value.join("\n")); }, [value]);
  const commit = () => onChange(text.split("\n").map(s => s.trim()).filter(Boolean));
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label} (una por línea)</Label>
      <Textarea value={text} onChange={e => setText(e.target.value)} onBlur={commit} placeholder="Escribí cada ítem en una línea…" />
    </div>
  );
}

function Block({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>{action}</div>
      {children}
    </div>
  );
}
