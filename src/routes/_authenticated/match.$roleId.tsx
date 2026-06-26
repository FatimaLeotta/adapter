import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { generateMatch, generateStrategy, generateCv } from "@/lib/match.functions";
import { exportMatrix, exportCv } from "@/lib/export.functions";
import { ACCENT_PRESETS, emptyGapSelection, type CvData, type GapSelection, type MatrixData, type MatrixRow, type RoleData, type StrategyData, type WorkSheetData } from "@/lib/types";
import { downloadBase64Docx } from "@/lib/download";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Stage = "analysis" | "strategy" | "final";

export const Route = createFileRoute("/_authenticated/match/$roleId")({ component: MatchPage });

function MatchPage() {
  const { roleId } = useParams({ from: "/_authenticated/match/$roleId" });
  const { user } = useAuth();
  const runMatch = useServerFn(generateMatch);
  const runStrategy = useServerFn(generateStrategy);
  const runCvFn = useServerFn(generateCv);
  const runMatrix = useServerFn(exportMatrix);
  const runCv = useServerFn(exportCv);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<Stage>("analysis");
  const [meta, setMeta] = useState({ roleTitle: "", company: "" });
  const [score, setScore] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [matrix, setMatrix] = useState<MatrixData>({ rows: [] });
  const [gapSel, setGapSel] = useState<GapSelection>(emptyGapSelection());
  const [strategy, setStrategy] = useState<StrategyData | null>(null);
  const [cv, setCv] = useState<CvData | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [worksheet, setWorksheet] = useState<WorkSheetData | null>(null);
  const [role, setRole] = useState<RoleData | null>(null);
  const [accent, setAccent] = useState(ACCENT_PRESETS[0].value);
  const [credits, setCredits] = useState<number | null>(null);
  const [cvsGenerated, setCvsGenerated] = useState<number>(0);
  const [flowPaid, setFlowPaid] = useState(false); // si este flujo ya consumió su crédito
  const cvAlreadyGenerated = stage === "final" && !!cv;
  const isFirstEver = cvsGenerated === 0 && !flowPaid; // primer flujo gratis hasta matriz

  const selectedSuggestions = useMemo(() => {
    const out: string[] = [];
    matrix.rows.forEach((r, i) => {
      (r.concreteSuggestions ?? []).forEach((s, j) => { if (gapSel.concrete.includes(`${i}:${j}`) && s.trim()) out.push(s.trim()); });
      (r.inferredSuggestions ?? []).forEach((s, j) => { const entry = gapSel.inferred[`${i}:${j}`]; if (entry?.selected && s.trim()) out.push(entry.note.trim() ? `${s.trim()} — ${entry.note.trim()}` : s.trim()); });
      const add = gapSel.additions[`${i}`];
      if (add?.selected && add.text.trim()) out.push(add.text.trim());
    });
    return out;
  }, [matrix, gapSel]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("credits, cvs_generated").eq("id", user.id).maybeSingle().then(({ data }) => { setCredits(data?.credits ?? 0); setCvsGenerated(data?.cvs_generated ?? 0); });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: existing } = await supabase.from("cv_documents").select("*").eq("target_role_id", roleId).eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      const { data: roleRow } = await supabase.from("target_roles").select("*").eq("id", roleId).maybeSingle();
      if (!roleRow) { toast.error("No encontramos ese rol."); setLoading(false); return; }
      setMeta({ roleTitle: roleRow.role_title, company: roleRow.company });
      setRole(roleRow.data as unknown as RoleData);
      const { data: sheet } = await supabase.from("work_sheets").select("id, data").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (sheet) setWorksheet(sheet.data as unknown as WorkSheetData);
      if (existing) {
        setDocId(existing.id); setScore(existing.match_score); setExplanation(existing.match_explanation);
        const mtx = existing.matrix as unknown as MatrixData; setMatrix(mtx);
        const savedSel = existing.selected_suggestions as unknown;
        if (savedSel && !Array.isArray(savedSel) && typeof savedSel === "object") { const s = savedSel as Partial<GapSelection>; setGapSel({ concrete: s.concrete ?? [], inferred: s.inferred ?? {}, additions: s.additions ?? {} }); }
        else if (Array.isArray(savedSel)) { const legacy = savedSel as string[]; const concrete: string[] = []; mtx.rows.forEach((r, i) => { (r.concreteSuggestions ?? []).forEach((sg, j) => { if (legacy.includes(sg)) concrete.push(`${i}:${j}`); }); if (r.suggestion && legacy.includes(r.suggestion)) concrete.push(`${i}:0`); }); setGapSel({ concrete, inferred: {}, additions: {} }); }
        const savedStrategy = existing.strategy as unknown as StrategyData;
        if (savedStrategy && Object.keys(savedStrategy).length > 0) setStrategy(savedStrategy);
        const savedCv = existing.cv as unknown as CvData;
        if (savedCv && Object.keys(savedCv).length > 0) { setCv(savedCv); setFlowPaid(true); if (savedCv.accentColor) setAccent(savedCv.accentColor); }
        setStage((existing.stage as Stage) ?? "analysis"); setLoading(false); return;
      }
      if (!sheet) { toast.error("Necesitás una hoja laboral guardada."); setLoading(false); return; }
      try {
        const res = await runMatch({ data: { worksheet: sheet.data as unknown as WorkSheetData, role: roleRow.data as unknown as RoleData, roleTitle: roleRow.role_title, company: roleRow.company } });
        setScore(res.match_score); setExplanation(res.match_explanation); setMatrix(res.matrix);
        const { data: inserted } = await supabase.from("cv_documents").insert({ user_id: user.id, target_role_id: roleId, work_sheet_id: sheet.id, role_title: roleRow.role_title, company: roleRow.company, match_score: res.match_score, match_explanation: res.match_explanation, matrix: JSON.parse(JSON.stringify(res.matrix)), stage: "analysis" }).select("id").single();
        if (inserted) setDocId(inserted.id);
      } catch (e) { toast.error("No se pudo generar el análisis", { description: e instanceof Error ? e.message : "" }); }
      finally { setLoading(false); }
    })();
  }, [user, roleId]);

  const toggleConcrete = (key: string) => setGapSel(prev => ({ ...prev, concrete: prev.concrete.includes(key) ? prev.concrete.filter(k => k !== key) : [...prev.concrete, key] }));
  const toggleInferred = (key: string) => setGapSel(prev => { const cur = prev.inferred[key] ?? { selected: false, note: "" }; return { ...prev, inferred: { ...prev.inferred, [key]: { ...cur, selected: !cur.selected } } }; });
  const setInferredNote = (key: string, note: string) => setGapSel(prev => { const cur = prev.inferred[key] ?? { selected: false, note: "" }; return { ...prev, inferred: { ...prev.inferred, [key]: { ...cur, note } } }; });
  const setAdditionText = (rowKey: string, text: string) => setGapSel(prev => { const cur = prev.additions[rowKey] ?? { text: "", selected: false }; return { ...prev, additions: { ...prev.additions, [rowKey]: { ...cur, text } } }; });
  const toggleAddition = (rowKey: string) => setGapSel(prev => { const cur = prev.additions[rowKey] ?? { text: "", selected: false }; return { ...prev, additions: { ...prev.additions, [rowKey]: { ...cur, selected: !cur.selected } } }; });

  const buildStrategy = async () => {
    if (!worksheet || !role) { toast.error("Faltan datos."); return; }
    setBusy(true);
    try {
      const res = await runStrategy({ data: { worksheet, role, matrix, selectedSuggestions, roleTitle: meta.roleTitle, company: meta.company } });
      setStrategy(res); setStage("strategy");
      if (docId) await supabase.from("cv_documents").update({ strategy: JSON.parse(JSON.stringify(res)), selected_suggestions: JSON.parse(JSON.stringify(gapSel)), stage: "strategy" }).eq("id", docId);
    } catch (e) { toast.error("No se pudo construir la estrategia", { description: e instanceof Error ? e.message : "" }); }
    finally { setBusy(false); }
  };

  const confirmAndGenerate = async () => {
    if (!worksheet || !role || !strategy || !user) return;
    // Si ya hay un CV generado para este rol, regenerar cuesta otro crédito
    const isRegeneration = cvAlreadyGenerated;
    if ((credits ?? 0) < 1) {
      toast.error("Sin créditos", { description: "Necesitás un crédito para generar el CV. Compralo desde Configuración." });
      return;
    }
    setBusy(true);
    try {
      // Descontar crédito de forma atómica ANTES de generar
      const { data: remaining, error: creditError } = await supabase.rpc("consume_credit", { _user_id: user.id });
      if (creditError) { toast.error("Sin créditos disponibles", { description: "Recargá para generar el CV." }); setBusy(false); return; }
      setCredits(remaining as number);

      const res = await runCvFn({ data: { worksheet, role, matrix, strategy, selectedSuggestions, roleTitle: meta.roleTitle, company: meta.company } });
      const fullCv: CvData = { ...res, accentColor: accent }; setCv(fullCv); setStage("final");
      if (docId) await supabase.from("cv_documents").update({ cv: JSON.parse(JSON.stringify(fullCv)), stage: "final" }).eq("id", docId);
      toast.success(isRegeneration ? "CV regenerado" : "CV generado", { description: `Te ${(remaining as number) === 1 ? "queda" : "quedan"} ${remaining} crédito(s).` });
    } catch (e) { toast.error("No se pudo generar el CV", { description: e instanceof Error ? e.message : "" }); }
    finally { setBusy(false); }
  };

  const backToMatrix = async () => { setStage("analysis"); if (docId) await supabase.from("cv_documents").update({ stage: "analysis" }).eq("id", docId); };

  // Reabre la matriz en modo edición para probar otra estrategia/CV en el mismo rol
  const editSelection = async () => {
    setStage("analysis");
    if (docId) await supabase.from("cv_documents").update({ stage: "analysis" }).eq("id", docId);
    toast.info("Editá las sugerencias", { description: "Cambiá la selección y volvé a construir la estrategia para un CV distinto." });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const changeAccent = async (value: string) => {
    setAccent(value); if (!cv) return;
    const updated = { ...cv, accentColor: value }; setCv(updated);
    if (docId) await supabase.from("cv_documents").update({ cv: JSON.parse(JSON.stringify(updated)) }).eq("id", docId);
  };

  const downloadMatrixFn = async () => {
    try { const { base64 } = await runMatrix({ data: { matrix, roleTitle: meta.roleTitle, company: meta.company, score, explanation } }); downloadBase64Docx(base64, `mi matriz para ${meta.roleTitle} en ${meta.company}`); }
    catch (e) { toast.error("No se pudo exportar", { description: e instanceof Error ? e.message : "" }); }
  };

  const downloadCvFn = async () => {
    if (!cv) return;
    try { const { base64 } = await runCv({ data: { cv, roleTitle: meta.roleTitle, company: meta.company } }); downloadBase64Docx(base64, `mi CV para ${meta.roleTitle} de ${meta.company}`); }
    catch (e) { toast.error("No se pudo exportar", { description: e instanceof Error ? e.message : "" }); }
  };

  if (loading) return <div className="py-20 text-center text-muted-foreground">Analizando tu perfil contra el rol… esto puede tardar unos segundos.</div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/documentos" className="text-sm text-accent hover:underline">← Mis documentos</Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{meta.roleTitle} <span className="text-muted-foreground">· {meta.company}</span></h1>
        </div>
        <div className="rounded-lg border bg-card px-5 py-3 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Match</p>
          <p className="font-display text-4xl italic text-primary">{score}</p>
          <p className="text-xs text-muted-foreground">/100</p>
        </div>
      </div>

      <StageNav stage={stage} />
      {explanation && <p className="max-w-3xl rounded-md border bg-secondary/40 p-3 text-sm text-foreground">{explanation}</p>}

      {(stage === "analysis" || stage === "final") && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-foreground">Matriz comparativa</h2>
            <div className="flex flex-wrap gap-2">
              {stage === "final" && <Button variant="outline" size="sm" onClick={editSelection}>Editar selección y regenerar CV</Button>}
              <Button variant="outline" size="sm" onClick={downloadMatrixFn}>Descargar matriz (Word)</Button>
            </div>
          </div>
          {stage === "analysis" && <p className="mb-3 max-w-3xl text-sm text-muted-foreground">Para cada gap te mostramos sugerencias concretas e inferidas. Marcá las que quieras usar en tu CV.{cv ? " Al reconstruir la estrategia, el CV anterior se reemplaza." : ""}</p>}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  <th className="p-2 text-left font-medium">Variable</th><th className="p-2 text-left font-medium">Lo que tengo</th><th className="p-2 text-left font-medium">Lo que pide el rol</th><th className="p-2 text-left font-medium">Matchea</th><th className="p-2 text-left font-medium">No matchea + sugerencias</th>
                </tr>
              </thead>
              <tbody>
                {matrix.rows.map((r, i) => (
                  <tr key={i} className="border-t align-top">
                    <td className="p-2 font-medium text-foreground">{r.variable}</td>
                    <td className="p-2 text-muted-foreground">{r.mine || "—"}</td>
                    <td className="p-2 text-muted-foreground">{r.role || "—"}</td>
                    <td className="p-2 text-foreground">{r.match || "—"}</td>
                    <td className="p-2"><GapCell row={r} rowIndex={i} stage={stage} gapSel={gapSel} onToggleConcrete={toggleConcrete} onToggleInferred={toggleInferred} onInferredNote={setInferredNote} onAdditionText={setAdditionText} onToggleAddition={toggleAddition} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {stage === "analysis" && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={buildStrategy} disabled={busy}>{busy ? "Construyendo estrategia…" : "Construir estrategia de compensación"}</Button>
              <span className="text-xs text-muted-foreground">{selectedSuggestions.length} sugerencia(s) seleccionada(s)</span>
            </div>
          )}
        </section>
      )}

      {stage === "strategy" && strategy && (
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Estrategia de compensación de gaps</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Este es el plan con el que construiremos tu CV. Revisalo antes de generar.</p>
          </div>
          <StrategySummary strategy={strategy} />
          <div className="rounded-lg border bg-secondary/40 p-5">
            <p className="text-sm font-medium text-foreground">¿Querés continuar o hacer algún ajuste antes de generar el CV?</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {(credits ?? 0) >= 1 ? (
                <Button onClick={confirmAndGenerate} disabled={busy}>{busy ? "Generando CV…" : "Continuar y generar CV (1 crédito)"}</Button>
              ) : (
                <Link to="/settings" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Comprar créditos para generar el CV</Link>
              )}
              <Button variant="outline" onClick={backToMatrix} disabled={busy}>Revisar matriz</Button>
              {credits !== null && <span className="text-xs text-muted-foreground">Tenés {credits} crédito(s)</span>}
            </div>
          </div>
        </section>
      )}

      {stage === "final" && strategy && (
        <details className="rounded-lg border bg-card p-4">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">Ver estrategia usada</summary>
          <div className="mt-4"><StrategySummary strategy={strategy} /></div>
        </details>
      )}

      {stage === "final" && cv && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">CV one-page</h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {ACCENT_PRESETS.map(p => (
                  <button key={p.value} title={p.name} onClick={() => changeAccent(p.value)} className="h-6 w-6 rounded-full border-2" style={{ backgroundColor: p.value, borderColor: accent === p.value ? "var(--foreground)" : "transparent" }} />
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={downloadCvFn}>Descargar CV (Word)</Button>
            </div>
          </div>
          <div className="mx-auto max-w-2xl rounded-lg border bg-card p-8 shadow-sm">
            <h3 className="text-2xl font-bold text-foreground">{cv.name}</h3>
            <p className="text-lg" style={{ color: accent }}>{cv.headline}</p>
            <p className="mt-1 text-xs text-muted-foreground">{cv.contact}</p>
            {cv.summary && <p className="mt-4 text-sm text-foreground">{cv.summary}</p>}
            <CvSection title="Experiencia" accent={accent}>
              {cv.experiences.map((exp, i) => (
                <div key={i} className="mt-3">
                  <p className="text-sm font-semibold text-foreground">{exp.role} · {exp.company}</p>
                  <p className="text-xs text-muted-foreground">{exp.period}</p>
                  <ul className="mt-1 list-disc pl-5 text-sm text-foreground">{exp.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>
                </div>
              ))}
            </CvSection>
            {cv.education.length > 0 && <CvSection title="Formación" accent={accent}><ul className="list-disc pl-5 text-sm text-foreground">{cv.education.map((e, i) => <li key={i}>{e}</li>)}</ul></CvSection>}
            {cv.languages.length > 0 && <CvSection title="Idiomas" accent={accent}><p className="text-sm text-foreground">{cv.languages.join(" · ")}</p></CvSection>}
          </div>
        </section>
      )}
    </div>
  );
}

function GapCell({ row, rowIndex, stage, gapSel, onToggleConcrete, onToggleInferred, onInferredNote, onAdditionText, onToggleAddition }: { row: MatrixRow; rowIndex: number; stage: Stage; gapSel: GapSelection; onToggleConcrete: (key: string) => void; onToggleInferred: (key: string) => void; onInferredNote: (key: string, note: string) => void; onAdditionText: (rowKey: string, text: string) => void; onToggleAddition: (rowKey: string) => void }) {
  const editable = stage === "analysis";
  const concrete = row.concreteSuggestions ?? [];
  const inferred = row.inferredSuggestions ?? [];
  const legacy = row.suggestion ? [row.suggestion] : [];
  const rowKey = `${rowIndex}`;
  const addition = gapSel.additions[rowKey] ?? { text: "", selected: false };
  const hasGap = !!(row.gap?.trim());
  return (
    <div className="space-y-2">
      <p className="text-destructive"><span className="font-medium">Gap:</span> {row.gap || "—"}</p>
      {[...concrete, ...legacy].length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sugerencias concretas</p>
          {[...concrete, ...legacy].map((s, j) => { const key = `${rowIndex}:${j}`; const checked = gapSel.concrete.includes(key); return (
            <label key={key} className="flex cursor-pointer items-start gap-2 rounded-md bg-secondary/40 p-2">
              {editable ? <Checkbox checked={checked} onCheckedChange={() => onToggleConcrete(key)} className="mt-0.5" /> : <span className="mt-0.5 text-xs">{checked ? "✓" : "○"}</span>}
              <span className="text-foreground">{s}</span>
            </label>
          ); })}
        </div>
      )}
      {inferred.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sugerencias inferidas</p>
          {inferred.map((s, j) => { const key = `${rowIndex}:${j}`; const entry = gapSel.inferred[key] ?? { selected: false, note: "" }; return (
            <div key={key} className="rounded-md bg-accent/5 p-2">
              <label className="flex cursor-pointer items-start gap-2">{editable ? <Checkbox checked={entry.selected} onCheckedChange={() => onToggleInferred(key)} className="mt-0.5" /> : <span className="mt-0.5 text-xs">{entry.selected ? "✓" : "○"}</span>}<span className="italic text-accent">{s}</span></label>
              {editable && <Input value={entry.note} onChange={e => onInferredNote(key, e.target.value)} placeholder="Si la tuviste, completá acá (opcional)…" className="mt-2 h-8 text-xs" />}
              {!editable && entry.note && <p className="mt-1 text-xs text-muted-foreground">Tu aporte: {entry.note}</p>}
            </div>
          ); })}
        </div>
      )}
      {hasGap && (
        <div className="space-y-1 rounded-md border border-dashed p-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">¿Recordás algo que sirva para este gap?</p>
          {editable ? (
            <><Textarea value={addition.text} onChange={e => onAdditionText(rowKey, e.target.value)} placeholder="Experiencia, habilidad o herramienta (opcional)…" className="min-h-[56px] text-xs" />{addition.text.trim() && <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs text-foreground"><Checkbox checked={addition.selected} onCheckedChange={() => onToggleAddition(rowKey)} />Usar este aporte en mi CV</label>}</>
          ) : addition.text ? <p className="text-xs text-foreground">{addition.selected ? "✓" : "○"} {addition.text}</p> : <p className="text-xs text-muted-foreground">—</p>}
        </div>
      )}
    </div>
  );
}

function StageNav({ stage }: { stage: Stage }) {
  const steps: { key: Stage; label: string }[] = [{ key: "analysis", label: "1 · Análisis y matriz" }, { key: "strategy", label: "2 · Estrategia" }, { key: "final", label: "3 · CV adaptado" }];
  const order = ["analysis", "strategy", "final"];
  const current = order.indexOf(stage);
  return <div className="flex flex-wrap gap-2">{steps.map((s, i) => <span key={s.key} className={"rounded-full px-3 py-1 text-xs font-medium " + (i <= current ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>{s.label}</span>)}</div>;
}

function StrategySummary({ strategy }: { strategy: StrategyData }) {
  const c = strategy.compatibility;
  const stats = [{ label: "Matches", value: c.matches }, { label: "Gaps", value: c.gaps }, { label: "Habilidades transferibles", value: c.transferableSkills }, { label: "Sugerencias generadas", value: c.suggestionsGenerated }, { label: "Sugerencias seleccionadas", value: c.suggestionsSelected }];
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">Resumen de compatibilidad</h3>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">{stats.map(s => <div key={s.label} className="rounded-lg border bg-card p-3 text-center"><p className="font-display text-2xl italic text-primary">{s.value}</p><p className="mt-1 text-xs text-muted-foreground">{s.label}</p></div>)}</div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ListCard title="Fortalezas principales" items={strategy.strengths} tone="accent" />
        <ListCard title="Gaps principales" items={strategy.gaps} tone="destructive" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ListCard title="Compensación con datos tuyos" items={strategy.compensation.fromUser} tone="foreground" />
        <ListCard title="Compensación con inferencias aprobadas" items={strategy.compensation.fromAi} tone="foreground" />
      </div>
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">Criterio de redacción</h3>
        <p className="mt-2 rounded-lg border bg-card p-4 text-sm text-foreground">{strategy.writingCriteria || "—"}</p>
      </div>
    </div>
  );
}

function ListCard({ title, items, tone }: { title: string; items: string[]; tone: "accent" | "destructive" | "foreground" | "muted" }) {
  const toneClass = tone === "accent" ? "text-accent" : tone === "destructive" ? "text-destructive" : tone === "muted" ? "text-muted-foreground" : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className={"text-sm font-semibold " + toneClass}>{title}</p>
      {items.length > 0 ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">{items.map((it, i) => <li key={i}>{it}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">—</p>}
    </div>
  );
}

function CvSection({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return <div className="mt-5"><h4 className="border-b pb-1 text-sm font-bold uppercase tracking-wide" style={{ color: accent, borderColor: accent }}>{title}</h4>{children}</div>;
}
