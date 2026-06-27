// exportFile.js — Generación de archivos descargables (Excel/PDF) para L-Scale.
/* ───────────────────────────────────────────────────────────────────────────
   Estas funciones SÍ tocan el DOM (XLSX.writeFile / jsPDF doc.save), por eso
   viven aquí y NO en actions.js (que debe seguir siendo puro-orquestador).

   La capa de IA (actions.js) no genera el archivo: el dispatcher recibe por
   ctx un callback `onExport` que App.jsx implementa con estas funciones.

   `columnas` = [{ key, label }]  ·  `filas` = array de objetos { [key]: valor }.
   Para mantenerlas testables sin DOM, la construcción de la matriz (AOA) se
   extrae a funciones puras: `construirAOA` / `normalizarColumnas` / `filaAValores`.
   ─────────────────────────────────────────────────────────────────────────── */
import * as XLSX from "xlsx";

// ── Funciones puras (testables sin DOM) ──────────────────────────────────────

// Normaliza `columnas` a [{ key, label }]. Acepta strings (labels) o {key,label}.
export function normalizarColumnas(columnas = []) {
  return (columnas || []).map((c, i) => {
    if (typeof c === "string") return { key: String(i), label: c };
    const key = c?.key != null ? String(c.key) : String(i);
    const label = c?.label != null ? String(c.label) : key;
    return { key, label };
  });
}

// Extrae los valores de una fila siguiendo el orden de las columnas.
// `fila` puede ser un array (se indexa por posición) o un objeto (por key).
export function filaAValores(fila, cols) {
  if (Array.isArray(fila)) return cols.map((_, i) => celda(fila[i]));
  return cols.map((c) => celda(fila?.[c.key]));
}

// Normaliza una celda a un valor primitivo apto para Excel/PDF.
function celda(v) {
  if (v == null) return "";
  if (typeof v === "object") { try { return JSON.stringify(v); } catch { return String(v); } }
  return v;
}

// Construye la matriz [cabecera, ...filas] (Array-Of-Arrays) lista para la hoja.
export function construirAOA({ columnas = [], filas = [] } = {}) {
  const cols = normalizarColumnas(columnas);
  const head = cols.map((c) => c.label);
  const body = (filas || []).map((f) => filaAValores(f, cols));
  return [head, ...body];
}

// Sanea un nombre de archivo (sin extensión) a algo seguro.
export function nombreArchivoSeguro(base, fallback = "export") {
  const s = String(base || fallback).trim().replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_");
  return s || fallback;
}

// ── Funciones que tocan el DOM (descarga) ────────────────────────────────────

// Genera y descarga un Excel con una hoja a partir de columnas + filas.
export function exportarTablaExcel({ titulo, columnas = [], filas = [], nombreArchivo } = {}) {
  const aoa = construirAOA({ columnas, filas });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const hoja = nombreArchivoSeguro(titulo || "Datos", "Datos").slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, hoja);
  const fname = `${nombreArchivoSeguro(nombreArchivo || titulo || "export")}.xlsx`;
  XLSX.writeFile(wb, fname);
  return { nombreArchivo: fname, filas: filas.length };
}

// Genera y descarga un PDF con cabecera + filas (paginando cuando y > 280).
export async function exportarTablaPDF({ titulo, subtitulo, columnas = [], filas = [], nombreArchivo } = {}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const cols = normalizarColumnas(columnas);
  const nCols = cols.length || 1;

  // Reparte el ancho útil (14..196) entre columnas a partes iguales.
  const xIni = 14, xFin = 196;
  const paso = (xFin - xIni) / nCols;
  const xDe = (i) => xIni + paso * i;

  doc.setFontSize(16);
  doc.text(String(titulo || "Informe"), 14, 18);
  let y = 26;
  if (subtitulo) {
    doc.setFontSize(10); doc.setTextColor(120);
    doc.text(String(subtitulo), 14, y); doc.setTextColor(0); y += 8;
  }

  // Cabecera
  doc.setFontSize(9); doc.setFont(undefined, "bold");
  cols.forEach((c, i) => doc.text(String(c.label).slice(0, 26), xDe(i), y));
  y += 2; doc.setLineWidth(0.2); doc.line(14, y, 196, y); y += 5;
  doc.setFont(undefined, "normal");

  // Filas
  for (const f of (filas || [])) {
    if (y > 280) { doc.addPage(); y = 20; }
    const vals = filaAValores(f, cols);
    vals.forEach((v, i) => doc.text(String(v ?? "").slice(0, 30), xDe(i), y));
    y += 6;
  }

  const fname = `${nombreArchivoSeguro(nombreArchivo || titulo || "informe")}.pdf`;
  doc.save(fname);
  return { nombreArchivo: fname, filas: filas.length };
}
