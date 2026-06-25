import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiStructured } from "./ai.server";
import type { ChatMessage, WorkSheetData } from "./types";

const INTERVIEW_SYSTEM = `Sos un entrevistador profesional de Adapter que ayuda a una persona a construir su Hoja Laboral, con tono directo y estratégico (español rioplatense).

# FORMATO DEL TEXTO
- Texto plano. Sin Markdown ni asteriscos.
- Una pregunta clara por turno.

# REGLA DE ORO: UNA PREGUNTA POR TURNO
- Nunca hagas varias preguntas. Esperá la respuesta antes de continuar.
- No avances hasta completar el dato actual.

# ORDEN OBLIGATORIO
1) Datos Personales 2) Experiencia 3) Formación 4) Idiomas

## 1. Datos Personales
a) Nombre y apellido b) Ciudad c) Teléfono d) Email e) Modalidad (full remoto/híbrido/presencial) f) Relocación (sí/no) g) LinkedIn

## 2. Experiencia
Preguntá primero: "¿Cuántas experiencias laborales querés cargar?". Por cada una:
1) Empresa 2) Rol 3) Fecha inicio 4) ¿Es actual? 5) Fecha fin (si no es actual) 6) Responsabilidades 7) Habilidades técnicas 8) Métricas (indicadores) 9) Resultados métricas 10) Logros 11) Herramientas

## 3. Formación
Preguntá: "¿Cuántas formaciones querés cargar?". Por cada una: 1) Qué estudió 2) Dónde 3) Inicio 4) ¿Cursando actualmente? 5) Fin (si no continúa)

## 4. Idiomas
Preguntá: "¿Cuántos idiomas querés cargar?". Por cada uno: 1) Idioma 2) Nivel

# CIERRE
Cuando completes todo: mostrá borrador completo, ofrecé editar. Marcá done=true SOLO cuando la persona confirme explícitamente.`;

const worksheetSchema = {
  type: "object",
  properties: {
    personal: { type: "object", properties: { fullName: { type: "string" }, headline: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, location: { type: "string" }, links: { type: "string" }, linkedin: { type: "string" }, workMode: { type: "string" }, relocation: { type: "string" } }, required: ["fullName","headline","email","phone","location","links","linkedin","workMode","relocation"], additionalProperties: false },
    experiences: { type: "array", items: { type: "object", properties: { company: { type: "string" }, role: { type: "string" }, start: { type: "string" }, end: { type: "string" }, responsibilities: { type: "array", items: { type: "string" } }, skills: { type: "array", items: { type: "string" } }, metrics: { type: "array", items: { type: "string" } }, metricsResults: { type: "array", items: { type: "string" } }, achievements: { type: "array", items: { type: "string" } }, tools: { type: "array", items: { type: "string" } } }, required: ["company","role","start","end","responsibilities","skills","metrics","metricsResults","achievements","tools"], additionalProperties: false } },
    education: { type: "array", items: { type: "object", properties: { institution: { type: "string" }, title: { type: "string" }, year: { type: "string" }, detail: { type: "string" } }, required: ["institution","title","year","detail"], additionalProperties: false } },
    languages: { type: "array", items: { type: "object", properties: { language: { type: "string" }, level: { type: "string" } }, required: ["language","level"], additionalProperties: false } },
  },
  required: ["personal","experiences","education","languages"],
  additionalProperties: false,
} as const;

type InterviewResult = { reply: string; done: boolean; data: WorkSheetData; };

export const interviewStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messages: ChatMessage[]; current: WorkSheetData }) => input)
  .handler(async ({ data }): Promise<InterviewResult> => {
    const history = data.messages.map(m => `${m.role === "user" ? "PERSONA" : "ENTREVISTADOR"}: ${m.content}`).join("\n");
    return aiStructured<InterviewResult>(
      [
        { role: "system", content: INTERVIEW_SYSTEM },
        { role: "user", content: `Estado actual (JSON):\n${JSON.stringify(data.current)}\n\nConversación:\n${history || "(sin mensajes)"}\n\nGenerá el próximo turno.` },
      ],
      "interview_turn",
      "Devuelve el próximo mensaje del entrevistador, si terminó, y la hoja laboral acumulada.",
      { type: "object", properties: { reply: { type: "string" }, done: { type: "boolean" }, data: worksheetSchema }, required: ["reply","done","data"], additionalProperties: false },
    );
  });
