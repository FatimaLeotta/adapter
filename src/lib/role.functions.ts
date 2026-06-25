import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiStructured } from "./ai.server";
import type { RoleData } from "./types";

const roleSchema = {
  type: "object",
  properties: {
    role_title: { type: "string" }, company: { type: "string" }, summary: { type: "string" },
    seniority: { type: "string" }, experienceRequired: { type: "string" },
    responsibilities: { type: "array", items: { type: "string" } },
    skills: { type: "array", items: { type: "string" } },
    tools: { type: "array", items: { type: "string" } },
    education: { type: "array", items: { type: "string" } },
    languages: { type: "array", items: { type: "string" } },
  },
  required: ["role_title","company","summary","seniority","experienceRequired","responsibilities","skills","tools","education","languages"],
  additionalProperties: false,
} as const;

type ExtractResult = { role_title: string; company: string } & RoleData;

export const extractRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sourceText: string }) => input)
  .handler(async ({ data }): Promise<ExtractResult> => {
    return aiStructured<ExtractResult>(
      [
        { role: "system", content: "Sos un analista de selección. Extraé del aviso de empleo todas las variables relevantes. No inventes; si algo no figura, dejá el campo vacío." },
        { role: "user", content: `Aviso de empleo:\n\n${data.sourceText}` },
      ],
      "extract_role", "Extrae las variables del rol a partir del aviso.", roleSchema,
    );
  });
