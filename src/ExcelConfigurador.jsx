/* ESQUEMA ExcelConfigurador.jsx (1630 líneas)
 * ─────────────────────────────────────────────────────────────
 *  L10   C / ROL_COLS_FIJOS / CAMPOS_STD    constantes
 *  L31   buildRolCols                       fusiona roles fijos + roles custom
 *  L54   colLetter / Btn                    helpers UI
 *  L75   leerLibro                          lee Excel → { wb, hojas[] }
 *  L98   configVacia                        config por defecto de una hoja
 * L114   cargarPlantillas / guardarPlantillaLS
 * L130   aplicarPlantilla                   aplica plantilla guardada a hojas
 * L150   limpiarTexto / normalizar          sanitización de strings
 * L164   procesarLibro                      convierte hojas+configs → { expedicion, materiales }
 * L247   InstruccionBanner / parseCantidad
 * L286   PanelDatos                         panel config hoja tipo "datos"
 * L793   PanelMateriales                    panel config hoja tipo "materiales"
 * L1122  PasoSeleccion                      paso final: elegir filas a importar
 * L1339  ExcelConfigurador (default export) orquestador principal (tabs hojas, pasos)
 * ─────────────────────────────────────────────────────────────── */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  X, Check, ChevronRight, Plus, Trash2, Save,
  FileSpreadsheet, Table2, AlignLeft, EyeOff,
  Loader, AlertTriangle, BookMarked, MousePointerClick,
  CheckCircle2,
} from "lucide-react";

/* ─── Colores (CSS vars del tema) ─────────────────────────────────────────── */
const C = {
  bg:"var(--bg)", surface:"var(--surface)", s2:"var(--surface-2)",
  line:"var(--border)", strong:"var(--border-strong)",
  ink:"var(--text)", sub:"var(--text-2)", dim:"var(--text-3)",
  brand:"var(--brand)", brandSoft:"var(--brand-soft)",
  ok:"var(--ok)", okSoft:"var(--ok-soft)",
  warn:"var(--warn)", warnSoft:"var(--warn-soft)",
  danger:"var(--danger)", dangerSoft:"var(--danger-soft)",
};

/* ─── Roles fijos (siempre presentes, no editables) ───────────────────────── */
// colMapping[key]: -1 = sin asignar, null = omitido, ≥0 = índice de columna
const ROL_COLS_FIJOS = [
  { key:"colNombre",    label:"Nombre",    color:"#3b82f6", req:true  },
  { key:"colCantidad",  label:"Cantidad",  color:"#16a34a", req:true  },
  { key:"colGrupo",     label:"Grupo",     color:"#f59e0b", req:false },
  { key:"colCategoria", label:"Categoría", color:"#8b5cf6", req:false },
];

// Construir ROL_COLS combinando fijos + personalizados (pasados como prop)
function buildRolCols(rolesImport = []) {
  return [
    ...ROL_COLS_FIJOS,
    ...rolesImport.map(r => ({ key: r.key, label: r.label, color: r.color, req: false })),
  ];
}

/* ─── Campos estándar de expedición ───────────────────────────────────────── */
const CAMPOS_STD = [
  { key:"nombre",        label:"Cliente / Restaurante" },
  { key:"destino",       label:"Centro de coste / Destino" },
  { key:"fecha_entrega", label:"Fecha expedición" },
  { key:"fecha_retorno", label:"Fecha retorno / Menú" },
  { key:"pax_adults",    label:"Pax" },
  { key:"contacto",      label:"Usuario / Contacto" },
  { key:"referencia",    label:"Menú / Referencia" },
  { key:"hora_ida",      label:"Hora ida" },
  { key:"hora_vuelta",   label:"Hora vuelta" },
  { key:"fecha_carga",   label:"Fecha de carga" },
  { key:"notas",         label:"Comentario / Notas" },
];

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function colLetter(idx) {
  // 0→A, 1→B, …
  let s = "", n = idx;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}

function Btn({ children, onClick, disabled, color = C.brand, outline = false, style: s = {} }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"8px 14px",
        borderRadius:999, border: outline ? `1px solid ${C.strong}` : "none",
        background: outline ? C.s2 : color, color: outline ? C.ink : "#fff",
        fontWeight:600, fontSize:13, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1, fontFamily:"inherit", ...s }}>
      {children}
    </button>
  );
}

/* ─── Leer libro Excel completo ───────────────────────────────────────────── */
function leerLibro(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type:"array", cellDates:true });
        const hojas = wb.SheetNames.map((nombre, indice) => {
          const sh      = wb.Sheets[nombre];
          const rows    = XLSX.utils.sheet_to_json(sh, { header:1, defval:"" });
          const rowsFmt = XLSX.utils.sheet_to_json(sh, { header:1, defval:"", raw:false });
          // Calcular ancho máximo
          const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
          return { nombre, indice, rows, rowsFmt, maxCols };
        });
        resolve({ wb, hojas });
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/* ─── Config vacía por hoja ───────────────────────────────────────────────── */
function configVacia(rolCols = ROL_COLS_FIJOS) {
  const mapping = {};
  for (const r of rolCols) mapping[r.key] = -1;
  return {
    tipo: "ignorar",
    fase: "estructura",
    campos: [],
    campoActivo: null,
    startRow: 1,
    colMapping: mapping,
    decimalSep: ",",
    excludedRows: [],  // índices absolutos de filas a excluir
  };
}

/* ─── Guardar/cargar plantillas ───────────────────────────────────────────── */
function keyPlantillas(empresaId, almacenId) {
  return `lscale.plantillas.${empresaId}.${almacenId}`;
}
function cargarPlantillas(empresaId, almacenId) {
  try {
    return JSON.parse(localStorage.getItem(keyPlantillas(empresaId, almacenId))) || [];
  } catch { return []; }
}
function guardarPlantillaLS(empresaId, almacenId, plantilla) {
  const lista = cargarPlantillas(empresaId, almacenId);
  const idx   = lista.findIndex(p => p.nombre === plantilla.nombre);
  if (idx >= 0) lista[idx] = plantilla; else lista.push(plantilla);
  localStorage.setItem(keyPlantillas(empresaId, almacenId), JSON.stringify(lista));
}

/* ─── Aplicar plantilla a hojas ───────────────────────────────────────────── */
function aplicarPlantilla(hojasData, plantilla, rolCols) {
  return hojasData.map((h, i) => {
    const cfg = plantilla.hojas?.[i];
    if (!cfg) return configVacia(rolCols);
    const hasCampos = (cfg.campos || []).length > 0;
    const baseMapping = configVacia(rolCols).colMapping;
    return {
      tipo:         cfg.tipo        || "ignorar",
      fase:         hasCampos ? "asignacion" : "estructura",
      campos:       cfg.campos      || [],
      campoActivo:  null,
      startRow:     cfg.startRow    ?? 1,
      colMapping:   { ...baseMapping, ...(cfg.colMapping || {}) },
      decimalSep:   cfg.decimalSep  || ",",
      excludedRows: cfg.excludedRows || [],
    };
  });
}

/* ─── Limpiar texto: quitar tildes, apóstrofes y diacríticos ─────────────── */
function limpiarTexto(s) {
  return String(s).trim()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")  // quitar diacríticos (tildes, diéresis…)
    .replace(/['''`´]/g, "")                            // quitar apóstrofes y similares
    .replace(/\s+/g, " ")                               // colapsar espacios múltiples
    .trim();
}

/* ─── Normalizar para comparar (clave de deduplicación) ──────────────────── */
function normalizar(s) {
  return limpiarTexto(s).toUpperCase();
}

/* ─── Procesar libro con configuración ────────────────────────────────────── */
function procesarLibro(wb, hojasData, configs, rolCols) {
  const expedicion = {};
  // Usamos un Map para deduplicar: clave = `timing§categoria§nombre_normalizado`
  const matMap = new Map();

  for (let i = 0; i < hojasData.length; i++) {
    const cfg  = configs[i];
    const hoja = hojasData[i];
    if (!cfg || cfg.tipo === "ignorar") continue;

    if (cfg.tipo === "datos") {
      for (const campo of cfg.campos) {
        if (campo.fila == null || campo.col == null) continue;
        const row    = hoja.rows[campo.fila]    || [];
        const rowFmt = hoja.rowsFmt[campo.fila] || [];
        const val = String(rowFmt[campo.col] ?? row[campo.col] ?? "").trim();
        if (val && campo.key) expedicion[campo.key] = val;
      }
    }

    if (cfg.tipo === "materiales") {
      const { colNombre, colCantidad, colGrupo, colCategoria, decimalSep } = cfg.colMapping;
      if (colNombre < 0 || colCantidad < 0) continue;

      const rolesOpc = rolCols.filter(r => !["colNombre","colCantidad","colGrupo","colCategoria"].includes(r.key));

      let currentGrupo = "";
      let currentCat   = "";
      const startIdx   = Math.max(0, (cfg.startRow || 1) - 1);
      const excSet     = new Set(cfg.excludedRows || []);

      for (let ri = startIdx; ri < hoja.rows.length; ri++) {
        if (excSet.has(ri)) continue;
        const cells    = hoja.rows[ri].map(c => String(c ?? "").trim());
        const cellsFmt = (hoja.rowsFmt[ri] || []).map(c => String(c ?? "").trim());
        if (cells.every(c => !c)) continue;

        const grupo  = limpiarTexto(colGrupo     >= 0 ? (cells[colGrupo]     || "") : "");
        const cat    = limpiarTexto(colCategoria >= 0 ? (cells[colCategoria]  || "") : "");
        const nombre = limpiarTexto(cells[colNombre] || "");
        const cantRaw = cellsFmt[colCantidad] || cells[colCantidad] || "";

        if (grupo) currentGrupo = grupo;
        if (cat)   currentCat   = cat;

        const cantidad = parseCantidad(cantRaw, decimalSep);
        if (!nombre || cantidad === 0) continue;

        const timingNorm = normalizar(currentGrupo);
        const catNorm    = normalizar(currentCat || currentGrupo);
        const nombreNorm = normalizar(nombre);
        const clave      = `${timingNorm}§${catNorm}§${nombreNorm}`;

        const extras = {};
        for (const rol of rolesOpc) {
          const colIdx = cfg.colMapping[rol.key];
          extras[rol.key] = colIdx >= 0 ? (cells[colIdx] || "") : "";
        }

        if (matMap.has(clave)) {
          const existing = matMap.get(clave);
          existing.cantidad += cantidad;
          for (const rol of rolesOpc) {
            if (!existing[rol.key] && extras[rol.key]) existing[rol.key] = extras[rol.key];
          }
        } else {
          matMap.set(clave, {
            timing:        currentGrupo,
            categoria:     currentCat || currentGrupo || "",
            nombre,
            nombre_custom: "",
            cantidad,
            ...extras,
          });
        }
      }
    }
  }

  return { expedicion, materiales: Array.from(matMap.values()) };
}

/* ─── Banner de instrucción contextual ────────────────────────────────────── */
function InstruccionBanner({ tipo = "info", children, style: s = {} }) {
  const paleta = {
    info:    { bg:"#eff6ff", border:"#93c5fd", icon:"#3b82f6", text:"#1e40af" },
    ok:      { bg:"#f0fdf4", border:"#86efac", icon:"#16a34a", text:"#166534" },
    warn:    { bg:"#fffbeb", border:"#fcd34d", icon:"#d97706", text:"#92400e" },
    pulse:   { bg:"#f5f3ff", border:"#c4b5fd", icon:"#7c3aed", text:"#4c1d95" },
  };
  const p = paleta[tipo] || paleta.info;
  const Icon = tipo === "ok" ? CheckCircle2 : MousePointerClick;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 16px",
      background:p.bg, border:`1px solid ${p.border}`, borderRadius:10,
      fontSize:13, color:p.text, fontWeight:500, ...s }}>
      <Icon size={16} color={p.icon} style={{ flexShrink:0 }}/>
      <span>{children}</span>
    </div>
  );
}

function parseCantidad(raw, decimalSep = ",") {
  if (raw === "" || raw == null) return 0;
  const s = String(raw).replace(/\s/g, "");
  const n = decimalSep === ","
    ? parseFloat(s.replace(/\./g, "").replace(",", "."))
    : parseFloat(s.replace(/,/g, ""));
  if (isNaN(n) || n <= 0) return 0;
  return Math.round(n);
}

/* ═══════════════════════════════════════════════════════════════════════════
   PANEL HOJA DATOS  —  dos fases: 1) definir estructura, 2) asignar celdas
   ═══════════════════════════════════════════════════════════════════════════ */

// Paleta de colores por índice para distinguir campos visualmente
const CAMPO_COLORES = [
  "#3b82f6","#16a34a","#d97706","#8b5cf6","#ef4444",
  "#0891b2","#be185d","#65a30d","#7c3aed","#b45309",
];

function PanelDatos({ hoja, cfg, setCfg,
  hojaActiva, totalHojas, siguienteHojaIdx, onSiguienteHoja,
  plantillaNom, setPlantillaNom, onGuardarPlantilla, guardadoOk,
  puedeConfirmar, onConfirmar,
}) {
  const [nuevoLabel,   setNuevoLabel]   = useState("");
  const [nuevoCampoKey,setNuevoCampoKey]= useState("");

  // fase: "estructura" | "asignacion"
  const fase = cfg.fase || "estructura";
  const setFase = (f) => setCfg(p => ({ ...p, fase: f, campoActivo: null }));

  const addCampo = () => {
    const label = nuevoLabel.trim();
    if (!label) return;
    const usados = cfg.campos.map(c => c.key);
    const key = nuevoCampoKey && !usados.includes(nuevoCampoKey)
      ? nuevoCampoKey
      : `custom_${Date.now()}`;
    setCfg(p => ({
      ...p,
      campos: [...p.campos, { label, key, fila: null, col: null }],
    }));
    setNuevoLabel("");
    setNuevoCampoKey("");
  };

  const removeCampo = (key) =>
    setCfg(p => ({
      ...p,
      campos: p.campos.filter(c => c.key !== key),
      campoActivo: p.campoActivo === key ? null : p.campoActivo,
    }));

  const moveCampo = (key, dir) =>
    setCfg(p => {
      const arr = [...p.campos];
      const i = arr.findIndex(c => c.key === key);
      const j = i + dir;
      if (j < 0 || j >= arr.length) return p;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...p, campos: arr };
    });

  const onCellClick = (fila, col) => {
    if (!cfg.campoActivo) return;
    // avanzar al siguiente campo sin asignar automáticamente
    const idx    = cfg.campos.findIndex(c => c.key === cfg.campoActivo);
    const campos = cfg.campos.map((c, i) => i === idx ? { ...c, fila, col } : c);
    const sig    = campos.find((c, i) => i > idx && (c.fila == null));
    setCfg(p => ({ ...p, campos, campoActivo: sig?.key ?? null }));
  };

  const campoActivoObj = cfg.campos.find(c => c.key === cfg.campoActivo);
  const maxCols        = hoja.maxCols || 15;
  const previewRows    = hoja.rows.slice(0, 25);

  // Color por posición en la lista
  const colorDeCampo = (campo) => {
    const i = cfg.campos.findIndex(c => c.key === campo.key);
    return CAMPO_COLORES[i % CAMPO_COLORES.length];
  };

  // Mapa celda → campo para colorear la tabla
  const celMap = {};
  for (const campo of cfg.campos) {
    if (campo.fila != null && campo.col != null)
      celMap[`${campo.fila}_${campo.col}`] = campo;
  }

  const todosAsignados = cfg.campos.length > 0 && cfg.campos.every(c => c.fila != null);
  const sinAsignar     = cfg.campos.filter(c => c.fila == null);

  /* ── Subpanel: tabla preview (compartido entre fases) ── */
  const TablaPreview = (
    <div style={{ flex:1, overflowY:"auto", overflowX:"auto", position:"relative" }}>
      {/* Banner de instrucción sobre la tabla */}
      {fase === "estructura" && (
        <div style={{ padding:"8px 14px", background:"#fffbeb",
          borderBottom:`1px solid #fcd34d`, fontSize:12, color:"#92400e",
          display:"flex", alignItems:"center", gap:7, flexShrink:0 }}>
          <span>👀</span>
          Usa esta preview para identificar qué datos contiene el Excel y añadir los campos correspondientes.
        </div>
      )}
      {fase === "asignacion" && campoActivoObj && (
        <div style={{ padding:"9px 16px", background:"#f5f3ff",
          borderBottom:`2px solid #7c3aed`, fontSize:13, color:"#4c1d95",
          fontWeight:600, display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          <MousePointerClick size={15} color="#7c3aed"/>
          Haz clic en la celda que contiene{" "}
          <strong style={{ color: colorDeCampo(campoActivoObj), marginLeft:4 }}>
            «{campoActivoObj.label}»
          </strong>
          <span style={{ marginLeft:"auto", fontSize:11, fontWeight:400, color:"#6d28d9" }}>
            Esc para cancelar
          </span>
        </div>
      )}
      {fase === "asignacion" && !campoActivoObj && sinAsignar.length > 0 && (
        <div style={{ padding:"8px 14px", background:"#fffbeb",
          borderBottom:`1px solid #fcd34d`, fontSize:12.5, color:"#92400e",
          display:"flex", alignItems:"center", gap:7, flexShrink:0 }}>
          <span>👈</span>
          Selecciona un campo de la lista para asignarle su celda en esta tabla.
        </div>
      )}
      <table style={{ borderCollapse:"collapse", fontSize:12, width:"100%" }}>
        <thead>
          <tr style={{ background:C.s2 }}>
            <th style={{ padding:"5px 8px", borderRight:`1px solid ${C.line}`,
              borderBottom:`1px solid ${C.strong}`, fontSize:10, color:C.sub, width:32 }}>#</th>
            {Array.from({ length: maxCols }, (_, ci) => (
              <th key={ci} style={{ padding:"5px 8px", borderRight:`1px solid ${C.line}`,
                borderBottom:`1px solid ${C.strong}`, fontSize:10, color:C.sub,
                whiteSpace:"nowrap", minWidth:60 }}>
                {colLetter(ci)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {previewRows.map((row, ri) => (
            <tr key={ri} style={{ borderBottom:`1px solid ${C.line}` }}>
              <td style={{ padding:"4px 8px", fontSize:10, color:C.dim,
                borderRight:`1px solid ${C.line}`, textAlign:"right", background:C.s2 }}>
                {ri + 1}
              </td>
              {Array.from({ length: maxCols }, (_, ci) => {
                const celKey   = `${ri}_${ci}`;
                const campo    = celMap[celKey];
                const isTarget = fase === "asignacion" && cfg.campoActivo != null;
                const val      = String((hoja.rowsFmt[ri] || [])[ci] ?? (row[ci] ?? "")).trim();
                const col      = campo ? colorDeCampo(campo) : null;
                return (
                  <td key={ci}
                    onClick={() => isTarget && onCellClick(ri, ci)}
                    title={campo ? campo.label : undefined}
                    style={{
                      padding:"4px 8px", borderRight:`1px solid ${C.line}`,
                      cursor: isTarget ? "crosshair" : "default",
                      background: col ? `${col}22`
                        : isTarget && val ? `${C.brand}0a` : "transparent",
                      color: col ? col : C.ink,
                      fontWeight: col ? 700 : 400,
                      maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                      position:"relative", transition:"background .1s",
                    }}>
                    {col && (
                      <span style={{ position:"absolute", top:1, right:3,
                        fontSize:9, color:col, fontWeight:700, opacity:.65,
                        maxWidth:60, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {campo.label}
                      </span>
                    )}
                    {val}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  /* ════════════════════════════════════
     FASE 1 — ESTRUCTURA DE CAMPOS
     ════════════════════════════════════ */
  if (fase === "estructura") {
    return (
      <div style={{ display:"flex", gap:0, height:"100%", minHeight:0 }}>

        {/* Sidebar izquierdo */}
        <div style={{ width:270, flexShrink:0, borderRight:`1px solid ${C.line}`,
          display:"flex", flexDirection:"column", overflowY:"auto" }}>

          {/* Cabecera fase */}
          <div style={{ padding:"12px 14px 8px", borderBottom:`1px solid ${C.line}` }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.brand, letterSpacing:.5,
              display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
              <span style={{ background:C.brand, color:"#fff", borderRadius:"50%",
                width:18, height:18, display:"inline-flex", alignItems:"center",
                justifyContent:"center", fontSize:10, fontWeight:800, flexShrink:0 }}>1</span>
              DEFINE LOS CAMPOS DEL PEDIDO
            </div>
            <p style={{ fontSize:12, color:C.sub, lineHeight:1.5, margin:0 }}>
              Añade todos los campos que quieres importar. Puedes verlos en la preview para no dejarte ninguno.
            </p>
          </div>

          {/* Formulario añadir campo */}
          <div style={{ padding:"10px 14px", borderBottom:`1px solid ${C.line}` }}>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              <input value={nuevoLabel} onChange={e => setNuevoLabel(e.target.value)}
                placeholder='Nombre del campo (ej. "Lugar evento")'
                onKeyDown={e => e.key === "Enter" && addCampo()}
                autoFocus
                style={{ padding:"7px 10px", border:`1.5px solid ${nuevoLabel ? C.brand : C.strong}`,
                  borderRadius:8, fontSize:13, fontFamily:"inherit",
                  background:C.s2, color:C.ink, outline:"none", transition:"border .15s" }}/>
              <select value={nuevoCampoKey} onChange={e => setNuevoCampoKey(e.target.value)}
                style={{ padding:"6px 9px", border:`1px solid ${C.strong}`, borderRadius:8,
                  fontSize:12.5, fontFamily:"inherit", background:C.s2, color:C.ink, outline:"none" }}>
                <option value="">— Tipo de campo personalizado —</option>
                <optgroup label="Campos estándar del pedido">
                  {CAMPOS_STD.filter(s => !cfg.campos.some(c => c.key === s.key))
                    .map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </optgroup>
              </select>
              <button onClick={addCampo} disabled={!nuevoLabel.trim()}
                style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                  padding:"7px 10px", borderRadius:8, border:"none",
                  background: nuevoLabel.trim() ? C.brand : C.s2,
                  color: nuevoLabel.trim() ? "#fff" : C.dim,
                  fontWeight:600, fontSize:13, cursor: nuevoLabel.trim() ? "pointer" : "not-allowed",
                  fontFamily:"inherit", transition:"background .15s" }}>
                <Plus size={14}/> Añadir campo
              </button>
            </div>
          </div>

          {/* Lista de campos definidos */}
          <div style={{ flex:1, overflowY:"auto", padding:"6px 0" }}>
            {cfg.campos.length === 0 && (
              <div style={{ padding:"16px 14px", fontSize:12.5, color:C.sub,
                textAlign:"center", lineHeight:1.6 }}>
                <div style={{ fontSize:24, marginBottom:8 }}>📝</div>
                Aún no hay campos.<br/>
                Añade el primero arriba.
              </div>
            )}
            {cfg.campos.map((campo, i) => {
              const col = CAMPO_COLORES[i % CAMPO_COLORES.length];
              return (
                <div key={campo.key}
                  style={{ display:"flex", alignItems:"center", gap:6,
                    padding:"7px 10px 7px 14px",
                    borderLeft:`3px solid ${col}`,
                    marginBottom:1 }}>
                  <div style={{ width:10, height:10, borderRadius:3, background:col, flexShrink:0 }}/>
                  <span style={{ flex:1, fontSize:13, fontWeight:500, color:C.ink,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {campo.label}
                  </span>
                  {/* mover arriba/abajo */}
                  <button onClick={() => moveCampo(campo.key, -1)} disabled={i === 0}
                    style={{ background:"none", border:"none", cursor: i===0?"not-allowed":"pointer",
                      color:C.sub, padding:"2px 3px", opacity: i===0?.3:1, display:"flex" }}>
                    ▲
                  </button>
                  <button onClick={() => moveCampo(campo.key, 1)} disabled={i === cfg.campos.length-1}
                    style={{ background:"none", border:"none",
                      cursor: i===cfg.campos.length-1?"not-allowed":"pointer",
                      color:C.sub, padding:"2px 3px",
                      opacity: i===cfg.campos.length-1?.3:1, display:"flex" }}>
                    ▼
                  </button>
                  <button onClick={() => removeCampo(campo.key)}
                    style={{ background:"none", border:"none", cursor:"pointer",
                      color:C.sub, padding:"2px 3px", display:"flex" }}>
                    <Trash2 size={13}/>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Botón continuar a fase 2 */}
          <div style={{ padding:"12px 14px", borderTop:`1px solid ${C.line}`, flexShrink:0 }}>
            <button onClick={() => setFase("asignacion")}
              disabled={cfg.campos.length === 0}
              style={{ width:"100%", display:"flex", alignItems:"center",
                justifyContent:"center", gap:8,
                padding:"9px 14px", borderRadius:10, border:"none",
                background: cfg.campos.length > 0 ? C.brand : C.s2,
                color: cfg.campos.length > 0 ? "#fff" : C.dim,
                fontWeight:700, fontSize:13.5, cursor: cfg.campos.length > 0 ? "pointer" : "not-allowed",
                fontFamily:"inherit", transition:"background .15s" }}>
              Asignar celdas <ChevronRight size={16}/>
            </button>
            {cfg.campos.length === 0 && (
              <p style={{ fontSize:11, color:C.dim, textAlign:"center", margin:"6px 0 0" }}>
                Añade al menos un campo para continuar
              </p>
            )}
          </div>
        </div>

        {/* Preview tabla (siempre visible) */}
        {TablaPreview}
      </div>
    );
  }

  /* ════════════════════════════════════
     FASE 2 — ASIGNACIÓN DE CELDAS
     ════════════════════════════════════ */
  return (
    <div style={{ display:"flex", gap:0, height:"100%", minHeight:0 }}
      onKeyDown={e => e.key === "Escape" && setCfg(p => ({ ...p, campoActivo: null }))}
      tabIndex={-1}>

      {/* Sidebar izquierdo */}
      <div style={{ width:270, flexShrink:0, borderRight:`1px solid ${C.line}`,
        display:"flex", flexDirection:"column" }}>

        {/* Cabecera fase */}
        <div style={{ padding:"10px 14px 8px", borderBottom:`1px solid ${C.line}`, flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
            <button onClick={() => setFase("estructura")}
              style={{ background:"none", border:`1px solid ${C.strong}`, cursor:"pointer",
                color:C.sub, padding:"3px 8px", borderRadius:6, fontSize:11.5,
                fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}>
              ← Editar campos
            </button>
            <div style={{ fontSize:12, fontWeight:700, color:C.brand, letterSpacing:.5,
              display:"flex", alignItems:"center", gap:5, marginLeft:"auto" }}>
              <span style={{ background:C.brand, color:"#fff", borderRadius:"50%",
                width:18, height:18, display:"inline-flex", alignItems:"center",
                justifyContent:"center", fontSize:10, fontWeight:800, flexShrink:0 }}>2</span>
              ASIGNA CADA CELDA
            </div>
          </div>
          <p style={{ fontSize:12, color:C.sub, lineHeight:1.5, margin:0 }}>
            Haz clic en cada campo y luego en la celda del Excel que lo contiene.
          </p>
        </div>

        {/* Lista de campos con estado de asignación */}
        <div style={{ flex:1, overflowY:"auto", padding:"6px 0" }}>
          {cfg.campos.map((campo, i) => {
            const isActive = cfg.campoActivo === campo.key;
            const asignada = campo.fila != null && campo.col != null;
            const col      = CAMPO_COLORES[i % CAMPO_COLORES.length];
            return (
              <div key={campo.key}
                onClick={() => setCfg(p => ({
                  ...p, campoActivo: isActive ? null : campo.key
                }))}
                style={{ display:"flex", alignItems:"center", gap:8,
                  padding:"9px 12px 9px 14px",
                  cursor:"pointer",
                  background: isActive ? `${col}18` : "transparent",
                  borderLeft: `3px solid ${isActive ? col : asignada ? col+"99" : C.line}`,
                  transition:"background .1s" }}>
                <div style={{ width:10, height:10, borderRadius:3, flexShrink:0,
                  background: asignada ? col : isActive ? col : C.strong,
                  opacity: asignada ? 1 : isActive ? .9 : .4 }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight: isActive ? 700 : 500,
                    color: isActive ? col : C.ink }}>
                    {campo.label}
                  </div>
                  <div style={{ fontSize:11, marginTop:1,
                    color: asignada ? col : isActive ? col : C.sub }}>
                    {asignada
                      ? `✓ Fila ${campo.fila + 1}, col ${colLetter(campo.col)}`
                      : isActive
                        ? "→ haz clic en la tabla"
                        : "sin asignar — haz clic aquí"}
                  </div>
                </div>
                {asignada && (
                  <button
                    onClick={e => { e.stopPropagation();
                      setCfg(p => ({ ...p,
                        campos: p.campos.map(c => c.key===campo.key ? {...c,fila:null,col:null} : c)
                      }));
                    }}
                    title="Borrar asignación"
                    style={{ background:"none", border:"none", cursor:"pointer",
                      color:C.sub, padding:3, display:"flex", flexShrink:0, opacity:.6 }}>
                    <X size={12}/>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Barra de progreso + panel completado */}
        {!todosAsignados ? (
          <div style={{ padding:"10px 14px", borderTop:`1px solid ${C.line}`,
            flexShrink:0, background:C.s2 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
              <div style={{ flex:1, height:5, borderRadius:3, background:C.line, overflow:"hidden" }}>
                <div style={{ height:"100%", borderRadius:3, background:C.brand,
                  width:`${cfg.campos.length > 0
                    ? Math.round((cfg.campos.filter(c=>c.fila!=null).length/cfg.campos.length)*100)
                    : 0}%`,
                  transition:"width .3s" }}/>
              </div>
              <span style={{ fontSize:11, color:C.sub, flexShrink:0 }}>
                {cfg.campos.filter(c=>c.fila!=null).length}/{cfg.campos.length}
              </span>
            </div>
            <div style={{ fontSize:12, color:C.sub }}>
              Pendiente: <strong style={{ color:C.ink }}>
                {sinAsignar.map(c=>c.label).join(", ")}
              </strong>
            </div>
          </div>
        ) : (
          /* ── Panel de hoja completada ── */
          <div style={{ flexShrink:0, borderTop:`2px solid ${C.ok}`,
            background:"#f0fdf4", padding:"14px 14px 12px" }}>

            {/* Cabecera éxito */}
            <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:10 }}>
              <CheckCircle2 size={18} color={C.ok}/>
              <span style={{ fontSize:14, fontWeight:700, color:"#166534" }}>
                ¡Datos correlacionados!
              </span>
            </div>

            {/* Tabla resumen de asignaciones */}
            <div style={{ background:"#fff", border:"1px solid #86efac", borderRadius:8,
              overflow:"hidden", marginBottom:12 }}>
              {cfg.campos.map((campo, i) => {
                const col = CAMPO_COLORES[i % CAMPO_COLORES.length];
                const val = String(
                  (hoja.rowsFmt[campo.fila] || hoja.rows[campo.fila] || [])[campo.col] ?? ""
                ).trim();
                return (
                  <div key={campo.key}
                    style={{ display:"flex", alignItems:"center", gap:0,
                      borderBottom: i < cfg.campos.length-1 ? "1px solid #dcfce7" : "none" }}>
                    <div style={{ width:8, background:col, alignSelf:"stretch", flexShrink:0 }}/>
                    <div style={{ flex:1, padding:"5px 8px",
                      fontSize:12, color:"#374151", fontWeight:600, borderRight:"1px solid #dcfce7" }}>
                      {campo.label}
                    </div>
                    <div style={{ flex:2, padding:"5px 8px",
                      fontSize:12, color:"#166534", fontWeight:500,
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {val || <span style={{ color:"#9ca3af", fontStyle:"italic" }}>vacío</span>}
                    </div>
                    <div style={{ padding:"5px 6px",
                      fontSize:10.5, color:"#6b7280", flexShrink:0 }}>
                      F{campo.fila+1}/{colLetter(campo.col)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Guardar plantilla */}
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:11.5, color:"#166534", fontWeight:600, marginBottom:5 }}>
                Guardar esta configuración como plantilla:
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <input value={plantillaNom} onChange={e => setPlantillaNom(e.target.value)}
                  placeholder='Nombre de plantilla (ej. "Almacén 1 - 2024")'
                  onKeyDown={e => e.key === "Enter" && onGuardarPlantilla()}
                  style={{ flex:1, padding:"6px 9px",
                    border:"1px solid #86efac", borderRadius:7,
                    fontSize:12.5, fontFamily:"inherit",
                    background:"#fff", color:C.ink, outline:"none" }}/>
                <button onClick={onGuardarPlantilla} disabled={!plantillaNom.trim()}
                  style={{ display:"flex", alignItems:"center", gap:5,
                    padding:"6px 11px", borderRadius:7, border:"none",
                    background: guardadoOk ? C.ok : plantillaNom.trim() ? "#16a34a" : "#d1fae5",
                    color: plantillaNom.trim() ? "#fff" : "#6b7280",
                    fontWeight:600, fontSize:12.5, cursor: plantillaNom.trim() ? "pointer" : "not-allowed",
                    fontFamily:"inherit", transition:"background .2s", flexShrink:0 }}>
                  {guardadoOk ? <><Check size={13}/> ¡Guardado!</> : <><Save size={13}/> Guardar</>}
                </button>
              </div>
            </div>

            {/* Acción: siguiente hoja o confirmar */}
            {siguienteHojaIdx !== null ? (
              <button onClick={onSiguienteHoja}
                style={{ width:"100%", display:"flex", alignItems:"center",
                  justifyContent:"center", gap:7, padding:"9px 14px",
                  borderRadius:9, border:"none", background:C.brand, color:"#fff",
                  fontWeight:700, fontSize:13.5, cursor:"pointer", fontFamily:"inherit" }}>
                Ir a la siguiente hoja <ChevronRight size={16}/>
              </button>
            ) : puedeConfirmar ? (
              <button onClick={onConfirmar}
                style={{ width:"100%", display:"flex", alignItems:"center",
                  justifyContent:"center", gap:7, padding:"9px 14px",
                  borderRadius:9, border:"none", background:C.ok, color:"#fff",
                  fontWeight:700, fontSize:13.5, cursor:"pointer", fontFamily:"inherit" }}>
                <Check size={16}/> Confirmar importación
              </button>
            ) : (
              <div style={{ fontSize:12, color:"#16a34a", textAlign:"center", padding:"6px 0" }}>
                Configura las demás hojas para poder confirmar.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview tabla */}
      {TablaPreview}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PANEL HOJA MATERIALES
   ═══════════════════════════════════════════════════════════════════════════ */
function PanelMateriales({ hoja, cfg, setCfg, ROL_COLS }) {
  const [rolActivo, setRolActivo] = useState(null); // key del rol que espera un clic en cabecera
  const startIdx = Math.max(0, (cfg.startRow || 1) - 1);

  // Detectar qué columnas tienen contenido (incluyendo las que tienen cabecera aunque estén vacías en datos)
  const columnas = useMemo(() => {
    const headerRow = hoja.rows[startIdx] || [];
    const cols = [];
    for (let ci = 0; ci < hoja.maxCols; ci++) {
      const label = String(headerRow[ci] ?? "").trim();
      // Incluir si tiene cabecera O si alguna fila de datos tiene valor en esta columna
      const tieneData = hoja.rows.slice(startIdx + 1, startIdx + 20)
        .some(r => String(r[ci] ?? "").trim() !== "");
      if (label || tieneData) cols.push({ idx:ci, label: label || colLetter(ci) });
    }
    return cols;
  }, [hoja, startIdx]);

  // Preview: filas desde startRow+1, máx 12 no vacías
  const previewRows = useMemo(() => {
    const out = [];
    for (let ri = startIdx + 1; ri < hoja.rows.length && out.length < 12; ri++) {
      const cells = (hoja.rowsFmt[ri] || hoja.rows[ri] || []).map(c => String(c ?? "").trim());
      if (cells.every(c => !c)) continue;
      out.push(columnas.map(({ idx }) => cells[idx] || ""));
    }
    return out;
  }, [hoja, startIdx, columnas]);

  const setMapping = (key, val) =>
    setCfg(p => ({ ...p, colMapping: { ...p.colMapping, [key]: val } }));

  // Devuelve el rol asignado a un índice de columna (solo si está asignado, no omitido)
  const rolDeCol = (idx) => ROL_COLS.find(r => cfg.colMapping[r.key] === idx);

  const onClickHeader = (idx) => {
    const actual = rolDeCol(idx);
    if (actual) { setMapping(actual.key, -1); setRolActivo(null); return; }
    // Si hay un rol activo seleccionado manualmente, asignar a ese
    if (rolActivo) {
      setMapping(rolActivo, idx);
      // Avanzar al siguiente rol libre automáticamente
      const sigLibre = ROL_COLS.find(r => r.key !== rolActivo && cfg.colMapping[r.key] === -1);
      setRolActivo(sigLibre?.key ?? null);
      return;
    }
    // Si no, asignar al primer rol obligatorio libre
    const libreReq = ROL_COLS.find(r => r.req && cfg.colMapping[r.key] === -1);
    if (libreReq) { setMapping(libreReq.key, idx); return; }
    // Fallback: primer rol opcional libre
    const libreOpc = ROL_COLS.find(r => !r.req && cfg.colMapping[r.key] === -1);
    if (libreOpc) setMapping(libreOpc.key, idx);
  };

  /* ── Instrucción dinámica ── */
  const rolesLibres   = ROL_COLS.filter(r => cfg.colMapping[r.key] === -1);
  const proxRolReq    = rolesLibres.find(r => r.req);
  const proxRolOpc    = rolesLibres.find(r => !r.req);
  const todosReqOk    = ROL_COLS.filter(r => r.req).every(r => cfg.colMapping[r.key] >= 0);

  const rolActivoObj = rolActivo ? ROL_COLS.find(r => r.key === rolActivo) : null;

  let instruccion = null;
  if (rolActivoObj) {
    instruccion = {
      tipo: "pulse",
      paso: "→",
      texto: <>Haz clic en la cabecera de la columna que contiene{" "}
        <strong style={{ color: rolActivoObj.color }}>{rolActivoObj.label}</strong></>,
      sub: "Haz clic en otra tarjeta para cambiar de rol, o pulsa la misma para cancelar.",
    };
  } else if (proxRolReq) {
    const esElPrimero = ROL_COLS.filter(r => r.req && cfg.colMapping[r.key] >= 0).length === 0;
    instruccion = {
      tipo: "pulse",
      paso: esElPrimero ? "1" : "2",
      texto: <>Haz clic en la cabecera de la columna que contiene el{" "}
        <strong style={{ color: proxRolReq.color }}>
          {proxRolReq.label === "Nombre" ? "nombre del producto" : "valor de la cantidad"}
        </strong></>,
      sub: esElPrimero
        ? "Las cabeceras de la tabla son las celdas superiores con el nombre de cada columna."
        : null,
    };
  } else if (todosReqOk && proxRolOpc) {
    instruccion = {
      tipo: "ok",
      paso: "✓",
      texto: <>Columnas principales asignadas. Haz clic en una tarjeta opcional para seleccionarla y luego en su columna, u omítela con <strong>×</strong>.</>,
      sub: null,
    };
  } else if (todosReqOk) {
    instruccion = {
      tipo: "ok",
      paso: "✓",
      texto: <><strong>¡Todo listo!</strong> Ya puedes confirmar la importación.</>,
      sub: null,
    };
  }

  const pulsePaleta = {
    pulse: { bg:"#f5f3ff", border:"#c4b5fd", dot:"#7c3aed", text:"#4c1d95" },
    ok:    { bg:"#f0fdf4", border:"#86efac", dot:"#16a34a", text:"#166534" },
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0 }}>

      {/* Banner instrucción */}
      {instruccion && (
        <div style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"10px 16px",
          background: pulsePaleta[instruccion.tipo].bg,
          borderBottom:`1px solid ${pulsePaleta[instruccion.tipo].border}`,
          flexShrink:0 }}>
          <div style={{ width:22, height:22, borderRadius:"50%", flexShrink:0,
            background: pulsePaleta[instruccion.tipo].dot,
            display:"flex", alignItems:"center", justifyContent:"center",
            color:"#fff", fontSize:11, fontWeight:700, marginTop:1 }}>
            {instruccion.paso}
          </div>
          <div>
            <div style={{ fontSize:13, color: pulsePaleta[instruccion.tipo].text, fontWeight:500, lineHeight:1.4 }}>
              {instruccion.texto}
            </div>
            {instruccion.sub && (
              <div style={{ fontSize:11.5, color: pulsePaleta[instruccion.tipo].text,
                opacity:.7, marginTop:3, lineHeight:1.4 }}>
                {instruccion.sub}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Controles superiores */}
      <div style={{ display:"flex", gap:16, padding:"12px 16px", borderBottom:`1px solid ${C.line}`,
        flexShrink:0, flexWrap:"wrap", alignItems:"center" }}>

        {/* Fila inicio */}
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:12.5, color:C.sub, fontWeight:600 }}>Fila cabecera tabla</span>
          <input type="number" min={1} max={100} value={cfg.startRow || 1}
            onChange={e => setCfg(p => ({ ...p, startRow: Math.max(1, Number(e.target.value) || 1) }))}
            style={{ width:64, padding:"5px 8px", border:`1px solid ${C.strong}`, borderRadius:8,
              fontSize:13, fontFamily:"inherit", background:C.s2, color:C.ink,
              outline:"none", textAlign:"center" }}/>
          <span style={{ fontSize:11.5, color:C.dim }}>(los datos empiezan en la siguiente)</span>
        </div>

        {/* Separador decimal */}
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontSize:12.5, color:C.sub, fontWeight:600 }}>Decimal</span>
          {[{ val:",", ex:"1.000,50" }, { val:".", ex:"1,000.50" }].map(({ val, ex }) => (
            <button key={val} onClick={() => setCfg(p => ({ ...p, decimalSep: val }))}
              style={{ padding:"4px 10px", borderRadius:6,
                border:`1.5px solid ${cfg.decimalSep === val ? C.brand : C.strong}`,
                background: cfg.decimalSep === val ? C.brandSoft : "transparent",
                color: cfg.decimalSep === val ? C.brand : C.sub,
                fontWeight: cfg.decimalSep === val ? 700 : 400,
                cursor:"pointer", fontFamily:"inherit", fontSize:12 }}>
              {ex}
            </button>
          ))}
        </div>

        {/* Tarjetas de roles */}
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginLeft:"auto" }}>
          {ROL_COLS.map(({ key, label, color, req }) => {
            const val      = cfg.colMapping[key];
            const omitido  = val === null;
            const asignado = val != null && val >= 0 ? columnas.find(c => c.idx === val) : null;
            const libre    = !asignado && !omitido;
            const activo   = rolActivo === key;

            return (
              <div key={key}
                onClick={() => {
                  if (omitido || asignado) return; // no activar si omitido o ya asignado
                  setRolActivo(activo ? null : key);
                }}
                title={libre ? (activo ? "Cancelar selección" : "Haz clic aquí y luego en la columna del Excel") : undefined}
                style={{
                  display:"flex", alignItems:"center", gap:5,
                  padding:"4px 8px 4px 10px", borderRadius:8,
                  border:`1.5px solid ${omitido ? C.line : activo ? color : asignado ? color : color + "66"}`,
                  background: omitido ? C.s2 : activo ? color + "28" : asignado ? color + "18" : "transparent",
                  opacity: omitido ? 0.45 : 1,
                  cursor: libre ? "pointer" : "default",
                  boxShadow: activo ? `0 0 0 2px ${color}55` : "none",
                  transition:"box-shadow .15s, background .15s",
                }}>
                <div style={{ width:7, height:7, borderRadius:2,
                  background: omitido ? C.dim : color, flexShrink:0 }}/>
                <span style={{ fontSize:12, fontWeight: activo ? 700 : 600,
                  color: omitido ? C.dim : color,
                  textDecoration: omitido ? "line-through" : "none" }}>
                  {label}
                </span>
                {req && <span style={{ color:C.danger, fontSize:9 }}>*</span>}
                {asignado && (
                  <span style={{ fontSize:11, color: color, marginLeft:2 }}>
                    → <strong>{asignado.label}</strong>
                  </span>
                )}
                {libre && !activo && (
                  <span style={{ fontSize:10.5, color:C.dim, marginLeft:2 }}>
                    {req ? "sin asignar" : "clic para asignar"}
                  </span>
                )}
                {activo && (
                  <span style={{ fontSize:10.5, color, marginLeft:2, fontWeight:700 }}>
                    → haz clic en la columna
                  </span>
                )}
                {/* X para omitir (solo opcionales sin asignar) o para desasignar (si asignado) */}
                {!req && !omitido && (
                  <button
                    onClick={e => { e.stopPropagation(); setMapping(key, asignado ? -1 : null); setRolActivo(null); }}
                    title={asignado ? "Desasignar columna" : "Omitir este rol"}
                    style={{ background:"none", border:"none", cursor:"pointer",
                      color: asignado ? C.sub : C.dim,
                      padding:"0 0 0 2px", display:"flex", flexShrink:0 }}>
                    <X size={11}/>
                  </button>
                )}
                {/* Restaurar si omitido */}
                {omitido && (
                  <button
                    onClick={e => { e.stopPropagation(); setMapping(key, -1); }}
                    title="Restaurar rol"
                    style={{ background:"none", border:"none", cursor:"pointer",
                      color:C.sub, padding:"0 0 0 2px", display:"flex", flexShrink:0 }}>
                    <Plus size={11}/>
                  </button>
                )}
                {/* X para desasignar en obligatorios asignados */}
                {req && asignado && (
                  <button
                    onClick={e => { e.stopPropagation(); setMapping(key, -1); }}
                    title="Desasignar columna"
                    style={{ background:"none", border:"none", cursor:"pointer",
                      color:C.sub, padding:"0 0 0 2px", display:"flex", flexShrink:0 }}>
                    <X size={11}/>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabla preview con cabecera clicable */}
      <div style={{ flex:1, overflowY:"auto", overflowX:"auto" }}>
        <table style={{ borderCollapse:"collapse", fontSize:12.5, width:"100%", tableLayout:"auto" }}>
          <thead>
            <tr>
              {columnas.map(({ idx, label }) => {
                const rol    = rolDeCol(idx);
                const libre  = !rol && rolesLibres.length > 0;
                const tooltip = rol
                  ? `Haz clic para desasignar «${rol.label}»`
                  : proxRolReq
                    ? `Asignar como «${proxRolReq.label}» — haz clic`
                    : proxRolOpc
                      ? `Asignar como «${proxRolOpc.label}» — haz clic`
                      : "";
                return (
                  <th key={idx} onClick={() => onClickHeader(idx)}
                    title={tooltip}
                    style={{ padding:"8px 10px", textAlign:"left",
                      cursor: libre || rol ? "pointer" : "default",
                      userSelect:"none", whiteSpace:"nowrap",
                      position:"sticky", top:0, zIndex:5,
                      background: rol ? rol.color : libre ? `${C.brand}10` : C.s2,
                      color: rol ? "#fff" : libre ? C.brand : C.ink,
                      borderBottom:`2px solid ${rol ? rol.color : libre ? C.brand + "66" : C.strong}`,
                      borderRight:`1px solid ${C.line}`,
                      fontSize:11, fontWeight:700, letterSpacing:.4,
                      transition:"background .15s" }}>
                    {rol && (
                      <span style={{ marginRight:4, fontSize:9,
                        background:"rgba(255,255,255,.25)", borderRadius:3, padding:"1px 4px" }}>
                        {rol.label.slice(0,3).toUpperCase()}
                      </span>
                    )}
                    {!rol && libre && (
                      <span style={{ marginRight:4, fontSize:9, opacity:.5 }}>+</span>
                    )}
                    {label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, ri) => (
              <tr key={ri} style={{ borderBottom:`1px solid ${C.line}` }}
                onMouseEnter={e => e.currentTarget.style.background = C.s2}
                onMouseLeave={e => e.currentTarget.style.background = ""}>
                {columnas.map(({ idx }, ci) => {
                  const rol = rolDeCol(idx);
                  return (
                    <td key={ci} style={{ padding:"6px 10px",
                      borderRight:`1px solid ${C.line}`,
                      background: rol ? `${rol.color}18` : "transparent",
                      color: rol ? rol.color : C.ink,
                      fontWeight: rol ? 600 : 400,
                      maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {row[ci] || ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {previewRows.length === 0 && (
          <p style={{ padding:24, color:C.sub, fontSize:13, textAlign:"center" }}>
            Sin datos para previsualizar. Ajusta la fila de cabecera.
          </p>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PASO SELECCIÓN DE FILAS
   ═══════════════════════════════════════════════════════════════════════════ */
function PasoSeleccion({ hojasData, configs, setCfgHoja, ROL_COLS, onVolver, onConfirmar }) {
  const materialHojas = hojasData
    .map((h, i) => ({ h, i, cfg: configs[i] }))
    .filter(({ cfg }) =>
      cfg.tipo === "materiales" &&
      cfg.colMapping.colNombre >= 0 &&
      cfg.colMapping.colCantidad >= 0
    );

  const buildRows = ({ h, cfg }) => {
    const { colNombre, colCantidad, colGrupo, colCategoria, startRow, excludedRows = [], decimalSep = "," } = cfg;
    const startIdx = Math.max(0, (startRow || 1) - 1);
    const out = [];
    for (let ri = startIdx + 1; ri < h.rows.length; ri++) {
      const cells    = h.rows[ri].map(c => String(c ?? "").trim());
      const cellsFmt = (h.rowsFmt[ri] || []).map(c => String(c ?? "").trim());
      if (cells.every(c => !c)) continue;
      const nombre = limpiarTexto(cells[colNombre] || "");
      if (!nombre) continue;
      const cantRaw  = cellsFmt[colCantidad] || cells[colCantidad] || "";
      const cantidad = parseCantidad(cantRaw, decimalSep);
      if (cantidad === 0) continue;
      out.push({
        ri,
        nombre,
        cantidad,
        grupo:    colGrupo     >= 0 ? limpiarTexto(cells[colGrupo]     || "") : "",
        categoria:colCategoria >= 0 ? limpiarTexto(cells[colCategoria] || "") : "",
        excluded: excludedRows.includes(ri),
      });
    }
    return out;
  };

  const toggleRow = (hojaIdx, ri) => {
    setCfgHoja(hojaIdx, cfg => {
      const exc  = cfg.excludedRows || [];
      const next = exc.includes(ri) ? exc.filter(x => x !== ri) : [...exc, ri];
      return { ...cfg, excludedRows: next };
    });
  };

  const toggleAll = (hojaIdx, rows, checked) => {
    setCfgHoja(hojaIdx, cfg => ({
      ...cfg,
      excludedRows: checked ? [] : rows.map(r => r.ri),
    }));
  };

  const totalSel = materialHojas.reduce((sum, mh) => {
    const rows = buildRows(mh);
    return sum + rows.filter(r => !r.excluded).length;
  }, 0);
  const totalRows = materialHojas.reduce((sum, mh) => sum + buildRows(mh).length, 0);

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0 }}>

      {/* Sub-header */}
      <div style={{ padding:"10px 20px", borderBottom:`1px solid ${C.line}`, flexShrink:0,
        display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <button onClick={onVolver}
          style={{ display:"flex", alignItems:"center", gap:5, background:"none",
            border:`1px solid ${C.strong}`, cursor:"pointer", color:C.sub,
            padding:"5px 12px", borderRadius:8, fontSize:12.5, fontFamily:"inherit" }}>
          ← Volver a configurar
        </button>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:14.5 }}>Seleccionar filas a importar</div>
          <div style={{ fontSize:12, color:C.sub, marginTop:1 }}>
            Desmarca las filas que no quieras importar. Por defecto se importan todas.
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:13, fontWeight:600,
            color: totalSel === totalRows ? C.ok : C.brand,
            background: totalSel === totalRows ? C.okSoft : C.brandSoft,
            padding:"4px 12px", borderRadius:999 }}>
            {totalSel} / {totalRows} filas seleccionadas
          </span>
          <Btn onClick={onConfirmar} color={C.ok} disabled={totalSel === 0}
            style={{ padding:"7px 18px" }}>
            <Check size={14}/> Confirmar importación
          </Btn>
        </div>
      </div>

      {/* Tablas por hoja */}
      <div style={{ flex:1, overflowY:"auto", padding:"0 20px 20px" }}>
        {materialHojas.map(({ h, i, cfg }) => {
          const rows    = buildRows({ h, cfg });
          const selCount = rows.filter(r => !r.excluded).length;
          const allSel   = selCount === rows.length;
          const noneSel  = selCount === 0;
          const hasGrupo = cfg.colMapping.colGrupo >= 0;
          const hasCat   = cfg.colMapping.colCategoria >= 0;

          return (
            <div key={i} style={{ marginTop:16 }}>
              {materialHojas.length > 1 && (
                <div style={{ fontSize:12, fontWeight:700, color:C.sub, letterSpacing:.5,
                  marginBottom:8 }}>HOJA: {h.nombre.toUpperCase()}</div>
              )}
              <div style={{ border:`1px solid ${C.line}`, borderRadius:12, overflow:"hidden" }}>
                <table style={{ borderCollapse:"collapse", width:"100%", fontSize:13 }}>
                  <thead>
                    <tr style={{ background:C.s2 }}>
                      <th style={{ padding:"8px 12px", borderBottom:`1px solid ${C.strong}`,
                        borderRight:`1px solid ${C.line}`, width:36, textAlign:"center" }}>
                        <input type="checkbox"
                          checked={allSel}
                          ref={el => { if (el) el.indeterminate = !allSel && !noneSel; }}
                          onChange={e => toggleAll(i, rows, e.target.checked)}
                          style={{ cursor:"pointer", width:14, height:14 }}/>
                      </th>
                      <th style={{ padding:"8px 10px", borderBottom:`1px solid ${C.strong}`,
                        borderRight:`1px solid ${C.line}`, fontSize:11, color:C.sub,
                        fontWeight:700, width:50, textAlign:"center" }}>#</th>
                      {hasGrupo && <th style={{ padding:"8px 10px", borderBottom:`1px solid ${C.strong}`,
                        borderRight:`1px solid ${C.line}`, fontSize:11, color:C.sub,
                        fontWeight:700, textAlign:"left" }}>GRUPO</th>}
                      {hasCat && <th style={{ padding:"8px 10px", borderBottom:`1px solid ${C.strong}`,
                        borderRight:`1px solid ${C.line}`, fontSize:11, color:C.sub,
                        fontWeight:700, textAlign:"left" }}>CATEGORÍA</th>}
                      <th style={{ padding:"8px 10px", borderBottom:`1px solid ${C.strong}`,
                        borderRight:`1px solid ${C.line}`, fontSize:11, color:C.sub,
                        fontWeight:700, textAlign:"left" }}>NOMBRE</th>
                      <th style={{ padding:"8px 10px", borderBottom:`1px solid ${C.strong}`,
                        fontSize:11, color:C.sub, fontWeight:700, textAlign:"right", width:80 }}>CANT.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={row.ri}
                        onClick={() => toggleRow(i, row.ri)}
                        style={{ cursor:"pointer",
                          background: row.excluded ? C.s2 : "transparent",
                          opacity: row.excluded ? 0.45 : 1,
                          borderBottom: idx < rows.length - 1 ? `1px solid ${C.line}` : "none",
                          transition:"background .1s, opacity .1s" }}
                        onMouseEnter={e => !row.excluded && (e.currentTarget.style.background = C.brandSoft)}
                        onMouseLeave={e => (e.currentTarget.style.background = row.excluded ? C.s2 : "transparent")}>
                        <td style={{ padding:"7px 12px", textAlign:"center",
                          borderRight:`1px solid ${C.line}` }}>
                          <input type="checkbox" checked={!row.excluded}
                            onChange={() => toggleRow(i, row.ri)}
                            onClick={e => e.stopPropagation()}
                            style={{ cursor:"pointer", width:14, height:14 }}/>
                        </td>
                        <td style={{ padding:"7px 10px", textAlign:"center", fontSize:11.5,
                          color:C.dim, borderRight:`1px solid ${C.line}` }}>
                          {row.ri + 1}
                        </td>
                        {hasGrupo && (
                          <td style={{ padding:"7px 10px", fontSize:12.5, color:C.sub,
                            borderRight:`1px solid ${C.line}`, whiteSpace:"nowrap" }}>
                            {row.grupo || "—"}
                          </td>
                        )}
                        {hasCat && (
                          <td style={{ padding:"7px 10px", fontSize:12.5, color:C.sub,
                            borderRight:`1px solid ${C.line}`, whiteSpace:"nowrap" }}>
                            {row.categoria || "—"}
                          </td>
                        )}
                        <td style={{ padding:"7px 10px", fontWeight:600,
                          color: row.excluded ? C.dim : C.ink,
                          borderRight:`1px solid ${C.line}`,
                          textDecoration: row.excluded ? "line-through" : "none" }}>
                          {row.nombre}
                        </td>
                        <td style={{ padding:"7px 10px", textAlign:"right",
                          fontWeight:700, color: row.excluded ? C.dim : C.brand,
                          fontVariantNumeric:"tabular-nums" }}>
                          {row.cantidad}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length === 0 && (
                  <div style={{ padding:24, textAlign:"center", color:C.sub, fontSize:13 }}>
                    No se detectaron filas con datos en esta hoja.
                  </div>
                )}
                <div style={{ padding:"8px 14px", background:C.s2,
                  borderTop:`1px solid ${C.line}`, fontSize:12, color:C.sub,
                  display:"flex", justifyContent:"space-between" }}>
                  <span>
                    <button onClick={() => toggleAll(i, rows, true)}
                      style={{ background:"none", border:"none", cursor:"pointer",
                        color:C.brand, fontSize:12, fontWeight:600, padding:"0 4px", fontFamily:"inherit" }}>
                      Seleccionar todas
                    </button>
                    ·
                    <button onClick={() => toggleAll(i, rows, false)}
                      style={{ background:"none", border:"none", cursor:"pointer",
                        color:C.sub, fontSize:12, padding:"0 4px", fontFamily:"inherit" }}>
                      Deseleccionar todas
                    </button>
                  </span>
                  <span style={{ fontWeight:600, color: selCount === rows.length ? C.ok : C.brand }}>
                    {selCount} de {rows.length} seleccionadas
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */
export default function ExcelConfigurador({ file, almacen, empresaId, onConfirm, onCancel, rolesImport = [] }) {
  const [cargando,      setCargando]     = useState(true);
  const [errMsg,        setErrMsg]       = useState(null);
  const [wb,            setWb]           = useState(null);
  const [hojasData,     setHojasData]    = useState([]);   // { nombre, indice, rows, rowsFmt, maxCols }
  const [configs,       setConfigs]      = useState([]);   // config por hoja
  const [hojaActiva,    setHojaActiva]   = useState(0);
  const [plantillas,    setPlantillas]   = useState([]);
  const [plantillaNom,  setPlantillaNom] = useState("");
  const [guardando,     setGuardando]    = useState(false);
  const [guardadoOk,    setGuardadoOk]   = useState(false);
  const [showPlantillas, setShowPlantillas] = useState(false);
  const [paso,          setPaso]         = useState("config"); // "config" | "seleccion"

  const ROL_COLS = useMemo(() => buildRolCols(rolesImport), [rolesImport]);

  // Cargar Excel
  useEffect(() => {
    if (!file) return;
    setCargando(true);
    leerLibro(file).then(({ wb: libro, hojas }) => {
      setWb(libro);
      setHojasData(hojas);
      const rolCols = buildRolCols(rolesImport);
      // Cargar plantillas y auto-aplicar la primera si existe
      const lista = cargarPlantillas(empresaId, almacen.id);
      setPlantillas(lista);
      if (lista.length > 0) {
        setConfigs(aplicarPlantilla(hojas, lista[0], rolCols));
        setPlantillaNom(lista[0].nombre);
      } else {
        setConfigs(hojas.map(() => configVacia(rolCols)));
      }
      setCargando(false);
    }).catch(err => {
      setErrMsg(`Error leyendo el archivo: ${err.message}`);
      setCargando(false);
    });
  }, [file]);

  const setCfgHoja = useCallback((idx, fn) => {
    setConfigs(prev => prev.map((c, i) => i === idx ? (typeof fn === "function" ? fn(c) : fn) : c));
  }, []);

  // Aplicar plantilla seleccionada
  const aplicar = (plantilla) => {
    setConfigs(aplicarPlantilla(hojasData, plantilla, ROL_COLS));
    setPlantillaNom(plantilla.nombre);
    setShowPlantillas(false);
  };

  // Guardar plantilla
  const guardarPlantilla = () => {
    const nombre = plantillaNom.trim();
    if (!nombre) return;
    setGuardando(true);
    const plantilla = {
      nombre,
      hojas: configs.map(c => ({
        tipo:         c.tipo,
        campos:       c.campos.map(({ label, key, fila, col }) => ({ label, key, fila, col })),
        startRow:     c.startRow,
        colMapping:   c.colMapping,
        decimalSep:   c.decimalSep,
        excludedRows: c.excludedRows || [],
        // fase no se guarda; se recalcula al cargar
      })),
    };
    guardarPlantillaLS(empresaId, almacen.id, plantilla);
    setPlantillas(cargarPlantillas(empresaId, almacen.id));
    setGuardando(false);
    setGuardadoOk(true);
    setTimeout(() => setGuardadoOk(false), 2000);
  };

  // Confirmar y procesar
  const confirmar = () => {
    if (!wb) return;
    // Si no había plantillas para este almacén, crear "Plant. Auto" automáticamente
    if (plantillas.length === 0) {
      const autoPlantilla = {
        nombre: "Plant. Auto",
        hojas: configs.map(c => ({
          tipo:         c.tipo,
          campos:       c.campos.map(({ label, key, fila, col }) => ({ label, key, fila, col })),
          startRow:     c.startRow,
          colMapping:   c.colMapping,
          decimalSep:   c.decimalSep,
          excludedRows: c.excludedRows || [],
        })),
      };
      guardarPlantillaLS(empresaId, almacen.id, autoPlantilla);
    }
    const result = procesarLibro(wb, hojasData, configs, ROL_COLS);
    onConfirm(result);
  };

  const cfg         = configs[hojaActiva];
  const puedeConfirmar = configs.some(c => c.tipo === "materiales" &&
    c.colMapping.colNombre >= 0 && c.colMapping.colCantidad >= 0);

  // Progreso global
  const totalHojas      = hojasData.length;
  const hojasConfig     = configs.filter(c => c.tipo !== "ignorar").length;
  const materialesListo = configs.some(c => c.tipo === "materiales" &&
    c.colMapping.colNombre >= 0 && c.colMapping.colCantidad >= 0);

  // Siguiente hoja que aún no tiene tipo configurado (para el panel completado de datos)
  const siguienteHojaIdx = (() => {
    for (let i = hojaActiva + 1; i < hojasData.length; i++) {
      if ((configs[i]?.tipo || "ignorar") === "ignorar") return i;
    }
    return null;
  })();

  if (cargando) return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:600,
      display:"grid", placeItems:"center" }}>
      <div style={{ background:C.surface, borderRadius:18, padding:40, display:"flex",
        alignItems:"center", gap:14, boxShadow:"var(--shadow-lg)" }}>
        <Loader size={22} color={C.brand} className="spin"/>
        <span style={{ fontSize:15, color:C.ink }}>Leyendo Excel…</span>
      </div>
    </div>
  );

  if (errMsg) return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:600,
      display:"grid", placeItems:"center", padding:16 }}>
      <div style={{ background:C.surface, borderRadius:18, padding:32, maxWidth:400,
        textAlign:"center", boxShadow:"var(--shadow-lg)" }}>
        <AlertTriangle size={32} color={C.danger} style={{ marginBottom:12 }}/>
        <p style={{ fontSize:14, color:C.ink, marginBottom:20 }}>{errMsg}</p>
        <Btn outline onClick={onCancel}>Cerrar</Btn>
      </div>
    </div>
  );

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:600,
      display:"grid", placeItems:"center", padding:16 }}>
      <div style={{ background:C.surface, borderRadius:18, width:"100%", maxWidth:1100,
        height:"90vh", display:"flex", flexDirection:"column", boxShadow:"var(--shadow-lg)" }}>

        {/* ── Header ── */}
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 20px",
          borderBottom:`1px solid ${C.line}`, flexShrink:0, flexWrap:"wrap" }}>
          <FileSpreadsheet size={18} color={C.brand}/>
          <span style={{ fontSize:16, fontWeight:700 }}>
            Configurar importación — <span style={{ color:C.brand }}>{almacen.nombre}</span>
          </span>
          <span style={{ fontSize:12.5, color:C.sub, maxWidth:220,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {file?.name}
          </span>

          {/* Indicador de progreso */}
          <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:8 }}>
            {hojasConfig === 0 ? (
              <span style={{ fontSize:12, color:C.warn, fontWeight:600,
                background:C.warnSoft, padding:"3px 10px", borderRadius:999 }}>
                Configura las hojas →
              </span>
            ) : materialesListo ? (
              <span style={{ fontSize:12, color:C.ok, fontWeight:600,
                background:C.okSoft, padding:"3px 10px", borderRadius:999,
                display:"flex", alignItems:"center", gap:5 }}>
                <CheckCircle2 size={12}/> Listo para importar
              </span>
            ) : (
              <span style={{ fontSize:12, color:C.brand, fontWeight:600,
                background:C.brandSoft, padding:"3px 10px", borderRadius:999 }}>
                {hojasConfig}/{totalHojas} {hojasConfig === 1 ? "hoja" : "hojas"} configuradas
              </span>
            )}
          </div>

          <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
            {/* Selector de plantillas */}
            <div style={{ position:"relative" }}>
              <Btn outline onClick={() => setShowPlantillas(v => !v)}
                style={{ padding:"6px 12px", fontSize:12.5 }}>
                <BookMarked size={14}/>
                {plantillas.length > 0 ? `Plantillas (${plantillas.length})` : "Plantillas"}
              </Btn>
              {showPlantillas && (
                <div style={{ position:"absolute", top:"calc(100% + 6px)", right:0, zIndex:10,
                  background:C.surface, border:`1px solid ${C.strong}`, borderRadius:12,
                  boxShadow:"var(--shadow-lg)", minWidth:220, padding:"6px 0" }}
                  onClick={e => e.stopPropagation()}>
                  {plantillas.length === 0 && (
                    <p style={{ padding:"10px 14px", fontSize:13, color:C.sub }}>
                      Sin plantillas guardadas.
                    </p>
                  )}
                  {plantillas.map(p => (
                    <button key={p.nombre} onClick={() => aplicar(p)}
                      style={{ display:"flex", alignItems:"center", gap:8, width:"100%",
                        padding:"9px 14px", background:"none", border:"none", cursor:"pointer",
                        fontFamily:"inherit", fontSize:13.5, color:C.ink, textAlign:"left" }}
                      onMouseEnter={e => e.currentTarget.style.background = C.s2}
                      onMouseLeave={e => e.currentTarget.style.background = ""}>
                      <ChevronRight size={13} color={C.sub}/>
                      {p.nombre}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={onCancel}
              style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, padding:4 }}>
              <X size={18}/>
            </button>
          </div>
        </div>

        {/* ── Paso selección de filas ── */}
        {paso === "seleccion" && (
          <PasoSeleccion
            hojasData={hojasData}
            configs={configs}
            setCfgHoja={setCfgHoja}
            ROL_COLS={ROL_COLS}
            onVolver={() => setPaso("config")}
            onConfirmar={confirmar}
          />
        )}

        {/* ── Tabs de hojas ── */}
        {paso === "config" && <div style={{ display:"flex", gap:0, borderBottom:`1px solid ${C.line}`,
          flexShrink:0, overflowX:"auto", padding:"0 20px" }}>
          {hojasData.map((h, i) => {
            const c    = configs[i];
            const tipo = c?.tipo || "ignorar";
            const Icon = tipo === "datos" ? AlignLeft : tipo === "materiales" ? Table2 : EyeOff;
            const col  = tipo === "datos" ? C.warn : tipo === "materiales" ? C.ok : C.dim;
            return (
              <button key={i} onClick={() => setHojaActiva(i)}
                style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", gap:2,
                  padding:"8px 16px", border:"none", background:"transparent", cursor:"pointer",
                  fontFamily:"inherit",
                  borderBottom: hojaActiva === i ? `2.5px solid ${C.brand}` : "2.5px solid transparent",
                  color: hojaActiva === i ? C.brand : C.sub,
                  fontWeight: hojaActiva === i ? 600 : 400, fontSize:13.5,
                  whiteSpace:"nowrap", marginBottom:-1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <Icon size={13} color={col}/>
                  {h.nombre}
                </div>
                <div style={{ fontSize:10, fontWeight:600, color:col, letterSpacing:"0.04em",
                  textTransform:"uppercase", paddingLeft:1 }}>
                  {tipo === "datos" ? "datos pedido" : tipo === "materiales" ? "materiales" : "ignorar"}
                </div>
              </button>
            );
          })}
        </div>}

        {/* ── Panel de la hoja activa ── */}
        {paso === "config" && cfg && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0 }}>

            {/* Selector de tipo */}
            <div style={{ padding:"10px 20px", borderBottom:`1px solid ${C.line}`, flexShrink:0 }}>
              <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
                <span style={{ fontSize:12, fontWeight:700, color:C.sub, marginRight:4,
                  letterSpacing:.4 }}>
                  ¿QUÉ CONTIENE ESTA HOJA?
                </span>
                {[
                  { val:"datos",      label:"Datos del pedido",    desc:"Fecha, cliente, destino…",
                    Icon:AlignLeft,  color:C.warn },
                  { val:"materiales", label:"Lista de materiales", desc:"Tabla con productos y cantidades",
                    Icon:Table2,     color:C.ok   },
                  { val:"ignorar",    label:"Ignorar",             desc:"No importar esta hoja",
                    Icon:EyeOff,     color:C.dim  },
                ].map(({ val, label, desc, Icon, color }) => (
                  <button key={val}
                    onClick={() => setCfgHoja(hojaActiva, p => ({ ...p, tipo: val }))}
                    style={{ display:"flex", flexDirection:"column", alignItems:"flex-start",
                      gap:1, padding:"7px 14px",
                      borderRadius:10, border:`1.5px solid ${cfg.tipo === val ? color : C.strong}`,
                      background: cfg.tipo === val ? `${color}22` : "transparent",
                      cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
                    <span style={{ display:"flex", alignItems:"center", gap:5,
                      fontSize:13, fontWeight:700,
                      color: cfg.tipo === val ? color : C.sub }}>
                      <Icon size={13}/>{label}
                    </span>
                    <span style={{ fontSize:11, color: cfg.tipo === val ? color : C.dim,
                      opacity: cfg.tipo === val ? 1 : .7 }}>
                      {desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Contenido según tipo */}
            <div style={{ flex:1, minHeight:0, overflow:"hidden" }}>
              {cfg.tipo === "ignorar" && (() => {
                const todasIgnoradas = configs.every(c => c.tipo === "ignorar");
                return (
                  <div style={{ display:"grid", placeItems:"center", height:"100%", color:C.sub }}>
                    <div style={{ textAlign:"center", maxWidth:420, padding:24 }}>
                      {todasIgnoradas ? (
                        <>
                          <div style={{ fontSize:36, marginBottom:16 }}>📋</div>
                          <div style={{ fontSize:16, fontWeight:700, color:C.ink, marginBottom:10 }}>
                            Bienvenido al configurador de importación
                          </div>
                          <div style={{ fontSize:13.5, color:C.sub, lineHeight:1.7, marginBottom:20 }}>
                            Para cada pestaña del Excel, indica qué contiene:<br/>
                            <strong>Datos del pedido</strong> (fecha, cliente…) o<br/>
                            <strong>Lista de materiales</strong> (productos y cantidades).
                          </div>
                          <div style={{ display:"inline-flex", alignItems:"center", gap:8,
                            padding:"10px 18px", background:C.brandSoft, borderRadius:10,
                            fontSize:13, color:C.brand, fontWeight:600 }}>
                            <span style={{ fontSize:16 }}>👆</span>
                            Empieza eligiendo el tipo de hoja arriba
                          </div>
                        </>
                      ) : (
                        <>
                          <EyeOff size={32} color={C.line} style={{ marginBottom:12 }}/>
                          <p style={{ fontSize:14 }}>Esta hoja no se importará.</p>
                          <p style={{ fontSize:12, color:C.dim, marginTop:6 }}>
                            Cámbialo arriba si contiene datos que necesitas.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}
              {cfg.tipo === "datos" && (
                <PanelDatos
                  hoja={hojasData[hojaActiva]}
                  cfg={cfg}
                  setCfg={fn => setCfgHoja(hojaActiva, fn)}
                  hojaActiva={hojaActiva}
                  totalHojas={totalHojas}
                  siguienteHojaIdx={siguienteHojaIdx}
                  onSiguienteHoja={() => setHojaActiva(siguienteHojaIdx)}
                  plantillaNom={plantillaNom}
                  setPlantillaNom={setPlantillaNom}
                  onGuardarPlantilla={guardarPlantilla}
                  guardadoOk={guardadoOk}
                  puedeConfirmar={puedeConfirmar}
                  onConfirmar={() => setPaso("seleccion")}
                />
              )}
              {cfg.tipo === "materiales" && (
                <PanelMateriales
                  hoja={hojasData[hojaActiva]}
                  cfg={cfg}
                  setCfg={fn => setCfgHoja(hojaActiva, fn)}
                  ROL_COLS={ROL_COLS}/>
              )}
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 20px",
          borderTop:`1px solid ${C.line}`, flexShrink:0, flexWrap:"wrap" }}>

          {/* Guardar plantilla global (para hojas de materiales) */}
          <div style={{ display:"flex", alignItems:"center", gap:6, flex:1, minWidth:200 }}>
            <Save size={13} color={C.dim}/>
            <input value={plantillaNom} onChange={e => setPlantillaNom(e.target.value)}
              placeholder="Guardar configuración como plantilla…"
              onKeyDown={e => e.key === "Enter" && guardarPlantilla()}
              style={{ flex:1, padding:"6px 9px", border:`1px solid ${C.strong}`, borderRadius:8,
                fontSize:12.5, fontFamily:"inherit", background:C.s2, color:C.ink, outline:"none" }}/>
            <Btn onClick={guardarPlantilla} disabled={!plantillaNom.trim() || guardando}
              color={guardadoOk ? C.ok : C.brand} style={{ padding:"6px 12px", fontSize:12 }}>
              {guardadoOk ? <><Check size={13}/> ¡Guardado!</> : "Guardar"}
            </Btn>
          </div>

          <div style={{ display:"flex", gap:8, marginLeft:"auto", alignItems:"center" }}>
            {paso === "config" && !puedeConfirmar && (
              <span style={{ fontSize:12, color:C.sub }}>
                Asigna <strong>Nombre</strong> y <strong>Cantidad</strong> en una hoja de materiales
              </span>
            )}
            <Btn outline onClick={onCancel}>Cancelar</Btn>
            {paso === "config" && (
              <Btn onClick={() => setPaso("seleccion")} disabled={!puedeConfirmar}
                color={puedeConfirmar ? C.brand : C.brand}>
                Elegir filas <ChevronRight size={14}/>
              </Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
