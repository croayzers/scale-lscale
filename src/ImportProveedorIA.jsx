// ImportProveedorIA.jsx — Import del Excel de un proveedor → correlaciones,
// con la IA SUGIRIENDO qué columna del Excel es cada campo.
/* ───────────────────────────────────────────────────────────────────────────
   La IA no lee archivos: el navegador parsea el Excel a JSON (cabeceras + unas
   filas de muestra) y la IA SUGIERE el mapeo {nombre,referencia,coste,descuento,
   categoria} → índice de columna. El usuario REVISA y CONFIRMA antes de guardar.

   Sin IA disponible (sin keys) el modal sigue funcionando con una heurística
   simple por nombre de cabecera como fallback.

   Guarda con guardarCorrelacionesLote(proveedorId, items, companyId).
   ─────────────────────────────────────────────────────────────────────────── */
import React, { useState, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import { Upload, X, Sparkles, Loader, Save, Building2, Check } from "lucide-react";
import { C, Btn } from "./lib/ui.jsx";
import { guardarCorrelacionesLote } from "./lib/data.js";
import { llamarConFallback, PROVEEDORES } from "@scale/shared/ia";

// Campos destino de la correlación (orden de presentación).
const CAMPOS = [
  { key: "nombre",     label: "Nombre",      req: true  },
  { key: "referencia", label: "Referencia",  req: false },
  { key: "coste",      label: "Coste",       req: false },
  { key: "descuento",  label: "% Descuento", req: false },
  { key: "categoria",  label: "Categoría",   req: false },
];

// Limpia un número (coma decimal, símbolos €/$/%). Espejo de parseNumCorr.
function parseNum(v) {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(",", ".").replace(/[€$%\s]/g, ""));
  return isNaN(n) ? null : n;
}

function norm(s) {
  return (s || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// Heurística de fallback (sin IA): empareja cabeceras por palabras clave.
function heuristicaMapeo(headers = []) {
  const reglas = {
    nombre:     ["nombre", "descripcion", "producto", "articulo", "item", "concepto"],
    referencia: ["referencia", "ref", "codigo", "cod", "sku", "ean"],
    coste:      ["coste", "costo", "precio", "pvp", "importe", "tarifa"],
    descuento:  ["descuento", "dto", "dcto", "%"],
    categoria:  ["categoria", "familia", "grupo", "tipo"],
  };
  const map = {};
  const usados = new Set();
  for (const campo of Object.keys(reglas)) {
    const idx = headers.findIndex((h, i) => !usados.has(i) && reglas[campo].some((kw) => norm(h).includes(kw)));
    map[campo] = idx >= 0 ? idx : null;
    if (idx >= 0) usados.add(idx);
  }
  return map;
}

// Extrae el primer bloque JSON de la respuesta del LLM.
function parsearMapeoIA(texto, nCols) {
  if (!texto) return null;
  const m = texto.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let obj;
  try { obj = JSON.parse(m[0]); } catch { return null; }
  const out = {};
  for (const { key } of CAMPOS) {
    const v = obj[key];
    const n = v == null ? null : Number(v);
    out[key] = Number.isInteger(n) && n >= 0 && n < nCols ? n : null;
  }
  return out;
}

export default function ImportProveedorIA({
  proveedores = [], materiales = [], companyId, provIdInicial = null,
  provider, keys = {}, orden, onCerrar, onTerminar,
}) {
  const fileRef = useRef();
  const [provId, setProvId] = useState(Number(provIdInicial || proveedores[0]?.id || 0) || "");
  const [headers, setHeaders] = useState([]);
  const [muestra, setMuestra] = useState([]);      // ~5 filas de muestra
  const [filas, setFilas] = useState([]);          // todas las filas de datos
  const [colMap, setColMap] = useState({});        // { campo: idx|null }
  const [sugiriendo, setSugiriendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [resultado, setResultado] = useState(null);

  const hayIA = !!(provider && keys && keys[provider]);

  function leerArchivo(file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        const head = (aoa[0] || []).map((h) => String(h ?? ""));
        const body = aoa.slice(1).filter((r) => r.some((c) => String(c).trim()));
        setHeaders(head);
        setMuestra(body.slice(0, 5));
        setFilas(body);
        setColMap(heuristicaMapeo(head));   // pre-relleno por heurística hasta que la IA sugiera
        setResultado(null); setAviso(null);
      } catch (e) { setAviso("Error leyendo el archivo: " + (e?.message || e)); }
    };
    reader.readAsArrayBuffer(file);
  }

  async function sugerirConIA() {
    if (!hayIA || !headers.length) return;
    setSugiriendo(true); setAviso(null);
    const cols = headers.map((h, i) => `${i}: ${h || "(vacío)"}`).join("\n");
    const filasTxt = muestra.map((r) => headers.map((_, i) => String(r[i] ?? "")).join(" | ")).join("\n");
    const prompt = `Eres un asistente que mapea columnas de un Excel de catálogo de proveedor.
Columnas (índice: cabecera):
${cols}

Primeras filas de datos (valores separados por |, en orden de columna):
${filasTxt}

Devuelve SOLO un objeto JSON con el índice de columna (entero) para cada campo, o null si no existe:
{"nombre": idx, "referencia": idx, "coste": idx, "descuento": idx, "categoria": idx}`;
    try {
      const r = await llamarConFallback({
        prefer: provider,
        orden,
        keys,
        modeloDe: (id) => PROVEEDORES.find((p) => p.id === id)?.modelo,
        system: "Devuelve únicamente un objeto JSON válido, sin texto adicional.",
        messages: [{ role: "user", content: prompt }],
        tools: [],
      });
      const sugerido = parsearMapeoIA(r?.text, headers.length);
      if (sugerido) {
        setColMap((prev) => ({ ...prev, ...sugerido }));
        if (r?.cambioDesde) setAviso(`La IA preferida no respondió; usé ${r.proveedorUsado}.`);
      } else {
        setAviso("La IA no devolvió un mapeo válido. Revisa el mapeo manualmente.");
      }
    } catch (e) {
      setAviso("No se pudo consultar la IA: " + (e?.message || e) + ". Usa el mapeo manual.");
    } finally { setSugiriendo(false); }
  }

  const provSel = useMemo(() => proveedores.find((p) => Number(p.id) === Number(provId)), [proveedores, provId]);

  // Índices de materiales propios por nombre y por referencia (normalizados),
  // para enlazar cada fila del Excel del proveedor con TU material (material_id).
  const idxMateriales = useMemo(() => {
    const porNombre = new Map(), porRef = new Map();
    for (const m of (materiales || [])) {
      if (m.nombre) porNombre.set(norm(m.nombre), m.id);
      if (m.referencia) porRef.set(norm(m.referencia), m.id);
    }
    return { porNombre, porRef };
  }, [materiales]);

  // Empareja una fila (nombre + referencia del proveedor) con un material propio.
  // 1º por referencia exacta, 2º por nombre exacto. null si no casa.
  const matchMaterialId = (nombre, referencia) => {
    if (referencia) { const id = idxMateriales.porRef.get(norm(referencia)); if (id != null) return id; }
    if (nombre)     { const id = idxMateriales.porNombre.get(norm(nombre));   if (id != null) return id; }
    return null;
  };

  // Filas con nombre Y que casan con un material propio (las que sí se guardarán).
  const filasValidas = useMemo(() => {
    if (colMap.nombre == null) return 0;
    let n = 0;
    for (const r of filas) {
      const nombre = String(r[colMap.nombre] ?? "").trim();
      if (!nombre) continue;
      const ref = colMap.referencia != null ? String(r[colMap.referencia] ?? "").trim() : "";
      if (matchMaterialId(nombre, ref) != null) n++;
    }
    return n;
  }, [filas, colMap, idxMateriales]);

  // Filas con nombre pero SIN material propio que case (informativo).
  const filasSinMatch = useMemo(() => {
    if (colMap.nombre == null) return 0;
    let n = 0;
    for (const r of filas) {
      const nombre = String(r[colMap.nombre] ?? "").trim();
      if (!nombre) continue;
      const ref = colMap.referencia != null ? String(r[colMap.referencia] ?? "").trim() : "";
      if (matchMaterialId(nombre, ref) == null) n++;
    }
    return n;
  }, [filas, colMap, idxMateriales]);

  async function confirmar() {
    if (colMap.nombre == null || !provId || guardando) return;
    setGuardando(true); setAviso(null);
    try {
      const idx = (campo) => colMap[campo];
      const items = filas.map((r) => {
        const nombre = String(r[idx("nombre")] ?? "").trim();
        if (!nombre) return null;
        const referencia = idx("referencia") != null ? (String(r[idx("referencia")] ?? "").trim() || null) : null;
        // Enlaza con TU material: por referencia exacta, luego por nombre exacto.
        const material_id = matchMaterialId(nombre, referencia);
        if (material_id == null) return null;   // sin material propio que case → no es correlación
        return {
          material_id,
          nombre_proveedor: nombre,
          referencia,
          coste:      idx("coste")      != null ? parseNum(r[idx("coste")])      : null,
          descuento:  idx("descuento")  != null ? parseNum(r[idx("descuento")])  : null,
          datos:      idx("categoria")  != null && String(r[idx("categoria")] ?? "").trim()
                        ? { categoria: String(r[idx("categoria")]).trim() } : {},
        };
      }).filter(Boolean);
      const guardados = await guardarCorrelacionesLote(Number(provId), items, companyId);
      setResultado({ enviados: items.length, guardados: (guardados || []).length, sin_match: filasSinMatch });
      onTerminar?.();
    } catch (e) {
      setAviso("Error al guardar: " + (e?.message || e));
    } finally { setGuardando(false); }
  }

  const inp = { width: "100%", padding: "8px 10px", border: `1px solid ${C.strong}`, borderRadius: 8, fontSize: 13.5, fontFamily: "inherit", background: C.bg, color: C.ink, boxSizing: "border-box" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "grid", placeItems: "center", zIndex: 320 }}>
      <div style={{ background: C.surface, borderRadius: 18, width: "min(720px,96vw)", maxHeight: "92vh", display: "flex", flexDirection: "column", boxShadow: "var(--shadow-lg)", overflow: "hidden" }}>
        {/* Cabecera */}
        <div style={{ padding: "18px 24px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ background: C.brandSoft, color: C.brand, borderRadius: 10, padding: 8, display: "flex" }}><Sparkles size={18} /></div>
            <div>
              <h3 style={{ fontSize: 17, color: C.ink, margin: 0 }}>Importar catálogo con IA</h3>
              <p style={{ fontSize: 12.5, color: C.sub, margin: 0 }}>La IA sugiere el mapeo de columnas; tú lo confirmas.</p>
            </div>
          </div>
          <button onClick={onCerrar} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", padding: 6, display: "flex" }}><X size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {resultado ? (
            <div style={{ textAlign: "center", padding: "32px 24px" }}>
              <div style={{ width: 56, height: 56, borderRadius: 999, background: C.okSoft, color: C.ok, display: "grid", placeItems: "center", margin: "0 auto 16px" }}><Check size={28} /></div>
              <h3 style={{ fontSize: 18, color: C.ink, marginBottom: 8 }}>Correlaciones guardadas</h3>
              <p style={{ fontSize: 14, color: C.sub }}>
                <strong style={{ color: C.ok }}>{resultado.guardados}</strong> correlaciones guardadas
                {resultado.enviados !== resultado.guardados && <> de {resultado.enviados} filas (las que casan con un material tuyo)</>} para <span style={{ color: provSel?.color }}>{provSel?.nombre}</span>.
              </p>
            </div>
          ) : (
            <>
              {/* Proveedor + archivo */}
              <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ fontSize: 12, color: C.sub, display: "block", marginBottom: 5 }}>Proveedor *</label>
                  <select value={provId} onChange={(e) => setProvId(Number(e.target.value))} style={inp}>
                    {proveedores.length === 0 && <option value="">Sin proveedores</option>}
                    {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
              </div>

              <FileDrop onFile={leerArchivo} fileRef={fileRef} />

              {headers.length > 0 && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 12px" }}>
                    <Btn onClick={sugerirConIA} disabled={!hayIA || sugiriendo}>
                      {sugiriendo ? <Loader size={14} className="spin" /> : <Sparkles size={14} />}
                      {sugiriendo ? "Consultando IA…" : "Sugerir mapeo con IA"}
                    </Btn>
                    {!hayIA && <span style={{ fontSize: 12, color: C.dim }}>Sin IA configurada: mapeo manual (heurística aplicada).</span>}
                  </div>

                  {/* Mapeo editable: una fila por campo destino → columna del Excel */}
                  <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden" }}>
                    {CAMPOS.map((campo, i) => (
                      <div key={campo.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: i < CAMPOS.length - 1 ? `1px solid ${C.line}` : "none" }}>
                        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: C.ink }}>
                          {campo.label}{campo.req ? " *" : ""}
                        </span>
                        <select
                          value={colMap[campo.key] == null ? "" : String(colMap[campo.key])}
                          onChange={(e) => setColMap((m) => ({ ...m, [campo.key]: e.target.value === "" ? null : Number(e.target.value) }))}
                          style={{ ...inp, width: 280, flex: "none" }}>
                          <option value="">— (ninguna) —</option>
                          {headers.map((h, ci) => <option key={ci} value={ci}>{`Col ${ci + 1}: ${h || "(vacío)"}`}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>

                  <p style={{ fontSize: 12.5, color: C.sub, marginTop: 10 }}>
                    <strong style={{ color: C.ok }}>{filasValidas}</strong> filas casan con un material tuyo (por referencia o nombre) y se guardarán como correlación.
                    {filasSinMatch > 0 && <span style={{ color: C.warn }}> · {filasSinMatch} no encuentran material propio y se omiten.</span>}
                  </p>
                </>
              )}

              {aviso && (
                <div style={{ marginTop: 12, padding: "10px 12px", background: C.warnSoft, color: C.warn, borderRadius: 8, fontSize: 12.5 }}>{aviso}</div>
              )}
            </>
          )}
        </div>

        {/* Pie */}
        <div style={{ padding: "14px 24px", borderTop: `1px solid ${C.line}`, display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center" }}>
          {resultado ? (
            <Btn onClick={onCerrar}>Cerrar</Btn>
          ) : (
            <>
              <Btn outline onClick={onCerrar}>Cancelar</Btn>
              <Btn onClick={confirmar} disabled={colMap.nombre == null || !provId || guardando || !filasValidas}>
                {guardando ? <Loader size={14} className="spin" /> : <Save size={14} />}
                {guardando ? "Guardando…" : `Importar ${filasValidas} correlaciones`}
              </Btn>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FileDrop({ onFile, fileRef }) {
  return (
    <>
      <div onClick={() => fileRef.current?.click()}
        style={{ border: `2px dashed ${C.strong}`, borderRadius: 12, padding: "28px 24px", textAlign: "center", cursor: "pointer", color: C.sub }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.brand)} onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.strong)}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}>
        <Upload size={26} style={{ opacity: .4, marginBottom: 10 }} />
        <p style={{ fontSize: 14, marginBottom: 4 }}>Arrastra el Excel del proveedor o haz clic para seleccionar</p>
        <p style={{ fontSize: 12 }}>.xlsx · .xls · .csv</p>
      </div>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); }} />
    </>
  );
}
