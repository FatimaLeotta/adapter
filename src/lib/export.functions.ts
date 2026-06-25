import { createServerFn } from "@tanstack/react-start";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType } from "docx";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CvData, MatrixData, WorkSheetData } from "./types";

const ACCENT = "370068";
const INK = "101112";
const MUTED = "5b5560";

function clean(hex: string): string { return (hex || "#370068").replace("#", "").toUpperCase(); }

function sectionTitle(text: string, color = ACCENT): Paragraph {
  return new Paragraph({ spacing: { before: 240, after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color, space: 2 } }, children: [new TextRun({ text, bold: true, size: 26, color })] });
}

async function pack(doc: Document): Promise<string> {
  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer).toString("base64");
}

function bullets(items: string[]): Paragraph[] {
  return items.filter(t => t?.trim()).map(t => new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [new TextRun({ text: t, size: 20, color: INK })] }));
}

function baseBorders() {
  const b = { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" };
  return { top: b, bottom: b, left: b, right: b };
}

function cell(text: string, width: number, bold = false): TableCell {
  return new TableCell({ width: { size: width, type: WidthType.DXA }, borders: baseBorders(), margins: { top: 60, bottom: 60, left: 100, right: 100 }, children: [new Paragraph({ children: [new TextRun({ text: text || "—", bold, size: 17, color: INK })] })] });
}

function noMatchCell(gap: string, suggestions: string[], width: number): TableCell {
  const children: Paragraph[] = [new Paragraph({ children: [new TextRun({ text: "Gap: ", bold: true, size: 17, color: "B3261E" }), new TextRun({ text: gap || "—", size: 17, color: INK })] })];
  for (const s of suggestions.filter(s => s?.trim())) {
    children.push(new Paragraph({ spacing: { before: 40 }, children: [new TextRun({ text: "Sugerencia: ", bold: true, size: 17, color: ACCENT }), new TextRun({ text: s, size: 17, color: INK, italics: true })] }));
  }
  return new TableCell({ width: { size: width, type: WidthType.DXA }, borders: baseBorders(), margins: { top: 60, bottom: 60, left: 100, right: 100 }, children });
}

export const exportWorksheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { worksheet: WorkSheetData }) => input)
  .handler(async ({ data }) => {
    const w = data.worksheet;
    const children: Paragraph[] = [
      new Paragraph({ children: [new TextRun({ text: "Mi hoja laboral", bold: true, size: 40, color: INK })] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: [w.personal.fullName, w.personal.headline].filter(Boolean).join(" · "), size: 22, color: MUTED })] }),
    ];
    children.push(sectionTitle("Datos personales"));
    const contactBits = [w.personal.email, w.personal.phone, w.personal.location, w.personal.linkedin, w.personal.links].filter(Boolean);
    children.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: contactBits.join(" · "), size: 20, color: INK })] }));
    children.push(sectionTitle("Experiencia"));
    for (const exp of w.experiences) {
      children.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: exp.role, bold: true, size: 22, color: INK }), new TextRun({ text: ` — ${exp.company}`, size: 22, color: INK }), new TextRun({ text: `  (${exp.start} – ${exp.end})`, size: 18, color: MUTED })] }));
      const lb = (label: string, items: string[]) => items.filter(Boolean).length ? [new Paragraph({ spacing: { before: 60 }, children: [new TextRun({ text: label, bold: true, size: 18, color: MUTED })] }), ...bullets(items)] : [];
      children.push(...lb("Responsabilidades", exp.responsibilities));
      children.push(...lb("Habilidades técnicas", exp.skills));
      children.push(...lb("Métricas (indicadores)", exp.metrics));
      children.push(...lb("Resultados de métricas", exp.metricsResults ?? []));
      children.push(...lb("Logros", exp.achievements));
      children.push(...lb("Herramientas", exp.tools));
    }
    children.push(sectionTitle("Formación"));
    for (const ed of w.education) {
      children.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: ed.title, bold: true, size: 20, color: INK }), new TextRun({ text: ` — ${ed.institution}`, size: 20, color: INK }), new TextRun({ text: ed.year ? `  (${ed.year})` : "", size: 18, color: MUTED })] }));
    }
    children.push(sectionTitle("Idiomas"));
    children.push(new Paragraph({ children: [new TextRun({ text: w.languages.map(l => `${l.language} (${l.level})`).join(" · "), size: 20, color: INK })] }));
    const doc = new Document({ styles: { default: { document: { run: { font: "Calibri" } } } }, sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children }] });
    return { base64: await pack(doc) };
  });

export const exportMatrix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { matrix: MatrixData; roleTitle: string; company: string; score: number; explanation: string }) => input)
  .handler(async ({ data }) => {
    const headerCells = ["Variable", "Lo que tengo", "Lo que pide el rol", "Matchea", "No matchea"];
    const widths = [1500, 2100, 2100, 1830, 2070];
    const headerRow = new TableRow({ tableHeader: true, children: headerCells.map((text, i) => new TableCell({ width: { size: widths[i], type: WidthType.DXA }, shading: { fill: ACCENT, type: ShadingType.CLEAR, color: "auto" }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 18, color: "FDFDFD" })] })] })) });
    const rows = data.matrix.rows.map(r => {
      const suggestions = [...(r.concreteSuggestions ?? []), ...(r.inferredSuggestions ?? []), ...(r.suggestion ? [r.suggestion] : [])].filter(s => s?.trim());
      return new TableRow({ children: [cell(r.variable, widths[0], true), cell(r.mine, widths[1]), cell(r.role, widths[2]), cell(r.match, widths[3]), noMatchCell(r.gap, suggestions, widths[4])] });
    });
    const doc = new Document({ styles: { default: { document: { run: { font: "Calibri" } } } }, sections: [{ properties: { page: { size: { width: 15840, height: 12240 }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } }, children: [new Paragraph({ children: [new TextRun({ text: `Mi matriz para ${data.roleTitle} en ${data.company}`, bold: true, size: 32, color: INK })] }), new Paragraph({ spacing: { before: 80, after: 200 }, children: [new TextRun({ text: `Puntaje: ${data.score}/100. `, bold: true, size: 20, color: ACCENT }), new TextRun({ text: data.explanation, size: 20, color: INK })] }), new Table({ width: { size: 9600, type: WidthType.DXA }, columnWidths: widths, rows: [headerRow, ...rows] })] }] });
    return { base64: await pack(doc) };
  });

export const exportCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { cv: CvData; roleTitle: string; company: string }) => input)
  .handler(async ({ data }) => {
    const cv = data.cv;
    const accent = clean(cv.accentColor);
    const children: Paragraph[] = [
      new Paragraph({ children: [new TextRun({ text: cv.name, bold: true, size: 40, color: INK })] }),
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: cv.headline, size: 24, color: accent })] }),
      new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: cv.contact, size: 18, color: MUTED })] }),
    ];
    if (cv.summary) { children.push(sectionTitle("Perfil", accent)); children.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: cv.summary, size: 20, color: INK })] })); }
    children.push(sectionTitle("Experiencia", accent));
    for (const exp of cv.experiences) {
      children.push(new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: exp.role, bold: true, size: 22, color: INK }), new TextRun({ text: ` · ${exp.company}`, size: 20, color: INK })] }));
      children.push(new Paragraph({ children: [new TextRun({ text: exp.period, size: 18, color: MUTED })] }));
      children.push(...bullets(exp.bullets));
    }
    if (cv.education.filter(Boolean).length) { children.push(sectionTitle("Formación", accent)); children.push(...bullets(cv.education)); }
    if (cv.languages.filter(Boolean).length) { children.push(sectionTitle("Idiomas", accent)); children.push(new Paragraph({ children: [new TextRun({ text: cv.languages.join(" · "), size: 20, color: INK })] })); }
    const doc = new Document({ styles: { default: { document: { run: { font: "Calibri" } } } }, sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1440, bottom: 1080, left: 1440 } } }, children }] });
    return { base64: await pack(doc) };
  });
