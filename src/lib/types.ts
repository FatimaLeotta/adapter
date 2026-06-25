export type PersonalInfo = { fullName: string; headline: string; email: string; phone: string; location: string; links: string; linkedin: string; workMode: string; relocation: string; };
export type Experience = { company: string; role: string; start: string; end: string; responsibilities: string[]; skills: string[]; metrics: string[]; metricsResults: string[]; achievements: string[]; tools: string[]; };
export type Education = { institution: string; title: string; year: string; detail: string; };
export type Language = { language: string; level: string; };
export type WorkSheetData = { personal: PersonalInfo; experiences: Experience[]; education: Education[]; languages: Language[]; };
export const emptyWorkSheet = (): WorkSheetData => ({ personal: { fullName: "", headline: "", email: "", phone: "", location: "", links: "", linkedin: "", workMode: "", relocation: "" }, experiences: [], education: [], languages: [] });
export type RoleData = { summary: string; seniority: string; experienceRequired: string; responsibilities: string[]; skills: string[]; tools: string[]; education: string[]; languages: string[]; };
export const emptyRole = (): RoleData => ({ summary: "", seniority: "", experienceRequired: "", responsibilities: [], skills: [], tools: [], education: [], languages: [] });
export type MatrixRow = { variable: string; mine: string; role: string; match: string; gap: string; concreteSuggestions: string[]; inferredSuggestions: string[]; suggestion?: string; };
export type GapSelection = { concrete: string[]; inferred: Record<string, { selected: boolean; note: string }>; additions: Record<string, { text: string; selected: boolean }>; };
export const emptyGapSelection = (): GapSelection => ({ concrete: [], inferred: {}, additions: {} });
export type MatrixData = { rows: MatrixRow[]; };
export type CvExperience = { role: string; company: string; period: string; bullets: string[]; };
export type CvData = { name: string; headline: string; contact: string; summary: string; experiences: CvExperience[]; education: string[]; languages: string[]; accentColor: string; };
export type ChatMessage = { role: "user" | "assistant"; content: string; };
export type StrategyData = { compatibility: { matches: number; gaps: number; transferableSkills: number; suggestionsGenerated: number; suggestionsSelected: number; }; strengths: string[]; gaps: string[]; compensation: { fromUser: string[]; fromAi: string[]; }; experienceFocus: { primary: string[]; partial: string[]; context: string[]; }; writingCriteria: string; };
export const emptyStrategy = (): StrategyData => ({ compatibility: { matches: 0, gaps: 0, transferableSkills: 0, suggestionsGenerated: 0, suggestionsSelected: 0 }, strengths: [], gaps: [], compensation: { fromUser: [], fromAi: [] }, experienceFocus: { primary: [], partial: [], context: [] }, writingCriteria: "" });
export const ACCENT_PRESETS: { name: string; value: string }[] = [
  { name: "Violeta fL", value: "#370068" }, { name: "Magenta fL", value: "#701b79" }, { name: "Grafito", value: "#101112" }, { name: "Azul profundo", value: "#1e3a5f" }, { name: "Verde bosque", value: "#1f5135" }, { name: "Borgoña", value: "#7a1f2b" }, { name: "Petróleo", value: "#11505a" }, { name: "Tierra", value: "#7a4a1f" },
];
