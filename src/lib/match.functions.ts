import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiStructured } from "./ai.server";
import type { CvData, MatrixData, RoleData, StrategyData, WorkSheetData } from "./types";

const MATCH_SYSTEM = `Sos un estratega de carrera. Cruzás la hoja laboral de una persona contra un rol y producís:
1) Puntaje de match 0-100 con explicación.
2) Matriz comparativa: para cada variable (responsabilidades, habilidades, herramientas, formación, idiomas, experiencia):
   - mine: lo que la persona tiene
   - role: lo que pide el rol
   - match: lo que coincide
   - gap: lo que el rol pide y la persona NO tiene
   - concreteSuggestions: SOLO sugerencias CONCRETAS de otro punto del recorrido. Si no hay, array vacío.
   - inferredSuggestions: sugerencias INFERIDAS redactadas como hipótesis a confirmar. Si no hay, array vacío.
No inventes datos.`;

const matchSchema = {
  type: "object",
  properties: {
    match_score: { type: "integer", minimum: 0, maximum: 100 },
    match_explanation: { type: "string" },
    matrix: { type: "object", properties: { rows: { type: "array", items: { type: "object", properties: { variable: { type: "string" }, mine: { type: "string" }, role: { type: "string" }, match: { type: "string" }, gap: { type: "string" }, concreteSuggestions: { type: "array", items: { type: "string" } }, inferredSuggestions: { type: "array", items: { type: "string" } } }, required: ["variable","mine","role","match","gap","concreteSuggestions","inferredSuggestions"], additionalProperties: false } } }, required: ["rows"], additionalProperties: false },
  },
  required: ["match_score","match_explanation","matrix"],
  additionalProperties: false,
} as const;

type MatchResult = { match_score: number; match_explanation: string; matrix: MatrixData; };

export const generateMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { worksheet: WorkSheetData; role: RoleData; roleTitle: string; company: string }) => input)
  .handler(async ({ data }): Promise<MatchResult> => {
    return aiStructured<MatchResult>(
      [
        { role: "system", content: MATCH_SYSTEM },
        { role: "user", content: `Rol: ${data.roleTitle} en ${data.company}\n\nVariables del rol:\n${JSON.stringify(data.role)}\n\nHoja laboral:\n${JSON.stringify(data.worksheet)}\n\nGenerá el puntaje y la matriz.` },
      ],
      "build_match", "Cruza hoja laboral vs rol y genera puntaje y matriz.", matchSchema, "google/gemini-2.5-pro",
    );
  });

const STRATEGY_SYSTEM = `Sos un estratega de carrera. Producís una ESTRATEGIA DE ADAPTACIÓN previa al CV.
Devolvé: strengths, gaps, compensation (fromUser/fromAi), experienceFocus (primary/partial/context), transferableSkills, writingCriteria.
Español rioplatense. No inventes.`;

const strategySchema = {
  type: "object",
  properties: {
    strengths: { type: "array", items: { type: "string" } },
    gaps: { type: "array", items: { type: "string" } },
    compensation: { type: "object", properties: { fromUser: { type: "array", items: { type: "string" } }, fromAi: { type: "array", items: { type: "string" } } }, required: ["fromUser","fromAi"], additionalProperties: false },
    experienceFocus: { type: "object", properties: { primary: { type: "array", items: { type: "string" } }, partial: { type: "array", items: { type: "string" } }, context: { type: "array", items: { type: "string" } } }, required: ["primary","partial","context"], additionalProperties: false },
    transferableSkills: { type: "integer", minimum: 0 },
    writingCriteria: { type: "string" },
  },
  required: ["strengths","gaps","compensation","experienceFocus","transferableSkills","writingCriteria"],
  additionalProperties: false,
} as const;

type StrategyAi = Omit<StrategyData, "compatibility"> & { transferableSkills: number };

export const generateStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { worksheet: WorkSheetData; role: RoleData; matrix: MatrixData; selectedSuggestions: string[]; roleTitle: string; company: string }) => input)
  .handler(async ({ data }): Promise<StrategyData> => {
    const ai = await aiStructured<StrategyAi>(
      [
        { role: "system", content: STRATEGY_SYSTEM },
        { role: "user", content: `Rol: ${data.roleTitle} en ${data.company}\n\nRol (JSON):\n${JSON.stringify(data.role)}\n\nHoja laboral:\n${JSON.stringify(data.worksheet)}\n\nMatriz:\n${JSON.stringify(data.matrix)}\n\nSugerencias seleccionadas:\n${JSON.stringify(data.selectedSuggestions)}` },
      ],
      "build_strategy", "Genera la estrategia de adaptación.", strategySchema, "google/gemini-2.5-pro",
    );
    const rows = data.matrix.rows ?? [];
    const matches = rows.filter(r => r.match?.trim()).length;
    const gaps = rows.filter(r => r.gap?.trim()).length;
    const suggestionsGenerated = rows.reduce((acc, r) => acc + (r.concreteSuggestions?.length ?? 0) + (r.inferredSuggestions?.length ?? 0) + (r.suggestion?.trim() ? 1 : 0), 0);
    return { compatibility: { matches, gaps, transferableSkills: ai.transferableSkills ?? data.selectedSuggestions.length, suggestionsGenerated, suggestionsSelected: data.selectedSuggestions.length }, strengths: ai.strengths, gaps: ai.gaps, compensation: ai.compensation, experienceFocus: ai.experienceFocus, writingCriteria: ai.writingCriteria };
  });

const CV_SYSTEM = `Sos un estratega de carrera. Redactás un CV one-page en PRIMERA PERSONA (español rioplatense).
- Priorizá lo que matchea directamente, luego gaps cubiertos, luego resto relevante.
- Usá SOLO las sugerencias seleccionadas por el usuario.
- summary: 2-3 oraciones orientadas al rol.
- experiences: bullets en primera persona priorizando logros/métricas que matchean.
- Incluí siempre todos los idiomas. Formación solo si es relevante.
- No inventes datos.`;

const cvSchema = {
  type: "object",
  properties: {
    name: { type: "string" }, headline: { type: "string" }, contact: { type: "string" }, summary: { type: "string" },
    experiences: { type: "array", items: { type: "object", properties: { role: { type: "string" }, company: { type: "string" }, period: { type: "string" }, bullets: { type: "array", items: { type: "string" } } }, required: ["role","company","period","bullets"], additionalProperties: false } },
    education: { type: "array", items: { type: "string" } },
    languages: { type: "array", items: { type: "string" } },
  },
  required: ["name","headline","contact","summary","experiences","education","languages"],
  additionalProperties: false,
} as const;

export const generateCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { worksheet: WorkSheetData; role: RoleData; matrix: MatrixData; strategy: StrategyData; selectedSuggestions: string[]; roleTitle: string; company: string }) => input)
  .handler(async ({ data }): Promise<Omit<CvData, "accentColor">> => {
    return aiStructured<Omit<CvData, "accentColor">>(
      [
        { role: "system", content: CV_SYSTEM },
        { role: "user", content: `Rol: ${data.roleTitle} en ${data.company}\n\nRol:\n${JSON.stringify(data.role)}\n\nHoja laboral:\n${JSON.stringify(data.worksheet)}\n\nMatriz:\n${JSON.stringify(data.matrix)}\n\nEstrategia:\n${JSON.stringify(data.strategy)}\n\nSugerencias:\n${JSON.stringify(data.selectedSuggestions)}` },
      ],
      "build_cv", "Genera el CV one-page adaptado.", cvSchema, "google/gemini-2.5-pro",
    );
  });
