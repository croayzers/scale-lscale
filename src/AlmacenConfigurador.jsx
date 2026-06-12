// Configurador de importación Excel para el Almacén
// Columnas: Nombre (req), Referencia, Categoría, Stock, Unidad, StockMín, Ubicación, Estado, Proveedor, Precio, Notas
import React, { useState, useEffect, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  X, Check, ChevronRight, Plus, Trash2, Save,
  FileSpreadsheet, Table2, EyeOff,
  Loader, AlertTriangle, BookMarked, CheckCircle2,
} from "lucide-react";

const C = {
  bg:"var(--bg)", surface:"var(--surface)", s2:"var(--surface-2)",
  line:"var(--border)", strong:"var(--border-strong)",
  ink:"var(--text)", sub:"var(--text-2)", dim:"var(--text-3)",
  brand:"var(--brand)", brandSoft:"var(--brand-soft)",
  ok:"var(--ok)", okSoft:"var(--ok-soft)",
  warn:"var(--warn)", warnSoft:"var(--warn-soft)",
  danger:"var(--danger)", dangerSoft:"var(--danger-soft)",
};

/* ─── Roles de columna para almacén ───────────────────────────────────────── */
const ROL_COLS = [
  { key:"colNombre",     label:"Nombre",       color:"#3b82f6", req:true  },
  { key:"colReferencia", label:"Referencia",   color:"#6366f1", req:false },
  { key:"colCategoria",  label:"Categoría",    color:"#8b5cf6", req:false },
  { key:"colStock",      label:"Stock",        color:"#16a34a", req:false },
  { key:"colUnidad",     label:"Unidad",       color:"#0891b2", req:false },
  { key:"colStockMin",   label:"Stock mín.",   color:"#f59e0b", req:false },
  { key:"colUbicacion",  label:"Ubicación",    color:"#ea580c", req:false },
  { key:"colEstado",     label:"Estado",       color:"#64748b", req:false },
  { key:"colProveedor",  label:"Proveedor",    color:"#ec4899", req:false },
  { key:"colPrecio",     label:"Precio coste", color:"#10b981", req:false },
  { key:"colNotas",      label:"Notas",        color:"#94a3b8", req:false },
];

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function colLetter(idx) {
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

function configVacia() {
  const mapping = {};
  for (const r of ROL_COLS) mapping[r.key] = -1;
  return { tipo:"ignorar", startRow:1, colMapping:mapping, decimalSep:",", excludedRows:[] };
}

function limpiarTexto(s) {
  return String(s).trim()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/['''`´]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCantidad(raw, sep = ",") {
  if (raw === "" || raw == null) return null;
  const s = String(raw).replace(/\s/g, "");
  const n = sep === ","
    ? parseFloat(s.replace(/\./g, "").replace(",", "."))
    : parseFloat(s.replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

/* ─── Plantillas LS ───────────────────────────────────────────────────────── */
function keyPl(empresaId, almacenId) { return `lscale.almconf.${empresaId}.${almacenId}`; }
function cargarPlantillas(empresaId, almacenId) {
  try { return JSON.parse(localStorage.getItem(keyPl(empresaId, almacenId))) || []; } catch { return []; }
}
function guardarPlantillaLS(empresaId, almacenId, pl) {
  const lista = cargarPlantillas(empresaId, almacenId);
  const idx = lista.findIndex(p => p.nombre === pl.nombre);
  if (idx >= 0) lista[idx] = pl; else lista.push(pl);
  localStorage.setItem(keyPl(empresaId, almacenId), JSON.stringify(lista));
}
function aplicarPlantilla(hojasData, plantilla) {
  return hojasData.map((_, i) => {
    const cfg = plantilla.hojas?.[i];
    if (!cfg) return configVacia();
    return {
      tipo:         cfg.tipo        || "ignorar",
      startRow:     cfg.startRow    ?? 1,
      colMapping:   { ...configVacia().colMapping, ...(cfg.colMapping || {}) },
      decimalSep:   cfg.decimalSep  || ",",
      excludedRows: cfg.excludedRows || [],
    };
  });
}

/* ─── Procesar libro → array de materiales ────────────────────────────────── */
function procesarLibro(wb, hojasData, configs) {
  const resultado = [];
  for (let i = 0; i < hojasData.length; i++) {
    const cfg  = configs[i];
    const hoja = hojasData[i];
    if (!cfg || cfg.tipo !== "materiales") continue;
    const { colNombre, colReferencia, colCategoria, colStock, colUnidad,
            colStockMin, colUbicacion, colEstado, colProveedor, colPrecio, colNotas } = cfg.colMapping;
    if (colNombre < 0) continue;

    const startIdx = Math.max(0, (cfg.startRow || 1) - 1);
    const excSet   = new Set(cfg.excludedRows || []);

    for (let ri = startIdx + 1; ri < hoja.rows.length; ri++) {
      if (excSet.has(ri)) continue;
      const cells    = hoja.rows[ri].map(c => String(c ?? "").trim());
      const cellsFmt = (hoja.rowsFmt[ri] || []).map(c => String(c ?? "").trim());
      if (cells.every(c => !c)) continue;

      const nombre = limpiarTexto(cells[colNombre] || "");
      if (!nombre) continue;

      const get = (colIdx) => colIdx >= 0 ? (cells[colIdx] || "") : "";
      const getFmt = (colIdx) => colIdx >= 0 ? (cellsFmt[colIdx] || cells[colIdx] || "") : "";

      const stockRaw = getFmt(colStock);
      const stock = parseCantidad(stockRaw, cfg.decimalSep);
      const stockMinRaw = getFmt(colStockMin);
      const stockMin = parseCantidad(stockMinRaw, cfg.decimalSep);
      const precioRaw = getFmt(colPrecio);
      const precio = parseCantidad(precioRaw, cfg.decimalSep);

      resultado.push({
        nombre,
        referencia:   get(colReferencia),
        categoria:    limpiarTexto(get(colCategoria)),
        stock_actual: stock   != null ? stock   : 0,
        unidad:       get(colUnidad)   || "ud",
        stock_minimo: stockMin != null ? stockMin : 0,
        ubicacion:    get(colUbicacion),
        estado:       get(colEstado)   || "activo",
        proveedor:    get(colProveedor),
        precio_coste: precio != null ? precio : null,
        notas:        get(colNotas),
      });
    }
  }
  return resultado;
}

/* ─── Panel columnas materiales ───────────────────────────────────────────── */
function PanelColumnas({ hoja, cfg, setCfg }) {
  const [rolActivo, setRolActivo] = useState(null);
  const startIdx = Math.max(0, (cfg.startRow || 1) - 1);

  const columnas = useMemo(() => {
    const headerRow = hoja.rows[startIdx] || [];
    const cols = [];
    for (let ci = 0; ci < hoja.maxCols; ci++) {
      const label = String(headerRow[ci] ?? "").trim();
      const tieneData = hoja.rows.slice(startIdx + 1, startIdx + 20)
        .some(r => String(r[ci] ?? "").trim() !== "");
      if (label || tieneData) cols.push({ idx:ci, label: label || colLetter(ci) });
    }
    return cols;
  }, [hoja, startIdx]);

  const previewRows = useMemo(() => {
    const out = [];
    for (let ri = startIdx + 1; ri < hoja.rows.length && out.length < 10; ri++) {
      const cells = (hoja.rowsFmt[ri] || hoja.rows[ri] || []).map(c => String(c ?? "").trim());
      if (cells.every(c => !c)) continue;
      out.push(columnas.map(({ idx }) => cells[idx] || ""));
    }
    return out;
  }, [hoja, startIdx, columnas]);

  const setMapping = (key, val) =>
    setCfg(p => ({ ...p, colMapping: { ...p.colMapping, [key]: val } }));

  const rolDeCol = (idx) => ROL_COLS.find(r => cfg.colMapping[r.key] === idx);
  const rolesLibres = ROL_COLS.filter(r => cfg.colMapping[r.key] === -1);
  const todosReqOk  = ROL_COLS.filter(r => r.req).every(r => cfg.colMapping[r.key] >= 0);

  const onClickHeader = (idx) => {
    const actual = rolDeCol(idx);
    if (actual) { setMapping(actual.key, -1); setRolActivo(null); return; }
    if (rolActivo) {
      setMapping(rolActivo, idx);
      const sigLibre = ROL_COLS.find(r => r.key !== rolActivo && cfg.colMapping[r.key] === -1);
      setRolActivo(sigLibre?.key ?? null);
      return;
    }
    const libreReq = ROL_COLS.find(r => r.req && cfg.colMapping[r.key] === -1);
    if (libreReq) { setMapping(libreReq.key, idx); return; }
    const libreOpc = ROL_COLS.find(r => !r.req && cfg.colMapping[r.key] === -1);
    if (libreOpc) setMapping(libreOpc.key, idx);
  };

  const proxRolReq = rolesLibres.find(r => r.req);
  const rolActivoObj = rolActivo ? ROL_COLS.find(r => r.key === rolActivo) : null;

  const instrMsg = rolActivoObj
    ? { tipo:"pulse", texto:<>Haz clic en la columna de <strong style={{ color:rolActivoObj.color }}>{rolActivoObj.label}</strong></> }
    : proxRolReq
      ? { tipo:"pulse", texto:<>Haz clic en la cabecera de la columna que contiene el <strong style={{ color:proxRolReq.color }}>nombre del material</strong></> }
      : { tipo:"ok",    texto:<><strong>¡Todo listo!</strong> Columna obligatoria asignada. Asigna las opcionales o confirma.</> };

  const paleta = {
    pulse:{ bg:"#f5f3ff", border:"#c4b5fd", dot:"#7c3aed", text:"#4c1d95" },
    ok:   { bg:"#f0fdf4", border:"#86efac", dot:"#16a34a", text:"#166534" },
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0 }}>

      {/* Banner */}
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 16px",
        background:paleta[instrMsg.tipo].bg, borderBottom:`1px solid ${paleta[instrMsg.tipo].border}`,
        flexShrink:0 }}>
        <div style={{ width:20, height:20, borderRadius:"50%", flexShrink:0,
          background:paleta[instrMsg.tipo].dot,
          display:"flex", alignItems:"center", justifyContent:"center",
          color:"#fff", fontSize:11, fontWeight:700 }}>
          {instrMsg.tipo === "ok" ? "✓" : "→"}
        </div>
        <div style={{ fontSize:13, color:paleta[instrMsg.tipo].text, fontWeight:500 }}>
          {instrMsg.texto}
        </div>
      </div>

      {/* Controles */}
      <div style={{ display:"flex", gap:16, padding:"10px 16px",
        borderBottom:`1px solid ${C.line}`, flexShrink:0, flexWrap:"wrap", alignItems:"center" }}>

        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:12.5, color:C.sub, fontWeight:600 }}>Fila cabecera</span>
          <input type="number" min={1} max={100} value={cfg.startRow || 1}
            onChange={e => setCfg(p => ({ ...p, startRow: Math.max(1, Number(e.target.value) || 1) }))}
            style={{ width:60, padding:"5px 8px", border:`1px solid ${C.strong}`, borderRadius:8,
              fontSize:13, fontFamily:"inherit", background:C.s2, color:C.ink,
              outline:"none", textAlign:"center" }}/>
          <span style={{ fontSize:11.5, color:C.dim }}>(datos desde la siguiente)</span>
        </div>

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
        <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginLeft:"auto" }}>
          {ROL_COLS.map(({ key, label, color, req }) => {
            const val      = cfg.colMapping[key];
            const omitido  = val === null;
            const asignado = val != null && val >= 0 ? columnas.find(c => c.idx === val) : null;
            const libre    = !asignado && !omitido;
            const activo   = rolActivo === key;
            return (
              <div key={key}
                onClick={() => { if (omitido || asignado) return; setRolActivo(activo ? null : key); }}
                style={{
                  display:"flex", alignItems:"center", gap:5,
                  padding:"3px 8px 3px 9px", borderRadius:8,
                  border:`1.5px solid ${omitido ? C.line : activo ? color : asignado ? color : color+"66"}`,
                  background: omitido ? C.s2 : activo ? color+"28" : asignado ? color+"18" : "transparent",
                  opacity: omitido ? 0.45 : 1,
                  cursor: libre ? "pointer" : "default",
                  boxShadow: activo ? `0 0 0 2px ${color}55` : "none",
                }}>
                <div style={{ width:6, height:6, borderRadius:2, background: omitido ? C.dim : color, flexShrink:0 }}/>
                <span style={{ fontSize:11.5, fontWeight: activo ? 700 : 600,
                  color: omitido ? C.dim : color,
                  textDecoration: omitido ? "line-through" : "none" }}>
                  {label}
                </span>
                {req && <span style={{ color:C.danger, fontSize:9 }}>*</span>}
                {asignado && <span style={{ fontSize:10.5, color, marginLeft:2 }}>→ <strong>{asignado.label}</strong></span>}
                {!req && !omitido && (
                  <button onClick={e => { e.stopPropagation(); setMapping(key, asignado ? -1 : null); setRolActivo(null); }}
                    style={{ background:"none", border:"none", cursor:"pointer", color:C.dim, padding:"0 0 0 1px", display:"flex", flexShrink:0 }}>
                    <X size={10}/>
                  </button>
                )}
                {omitido && (
                  <button onClick={e => { e.stopPropagation(); setMapping(key, -1); }}
                    style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, padding:"0 0 0 1px", display:"flex", flexShrink:0 }}>
                    <Plus size={10}/>
                  </button>
                )}
                {req && asignado && (
                  <button onClick={e => { e.stopPropagation(); setMapping(key, -1); }}
                    style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, padding:"0 0 0 1px", display:"flex", flexShrink:0 }}>
                    <X size={10}/>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabla preview */}
      <div style={{ flex:1, overflowY:"auto", overflowX:"auto" }}>
        <table style={{ borderCollapse:"collapse", fontSize:12.5, width:"100%", tableLayout:"auto" }}>
          <thead>
            <tr>
              {columnas.map(({ idx, label }) => {
                const rol   = rolDeCol(idx);
                const libre = !rol && rolesLibres.length > 0;
                return (
                  <th key={idx} onClick={() => onClickHeader(idx)}
                    style={{ padding:"8px 10px", textAlign:"left",
                      cursor: libre || rol ? "pointer" : "default",
                      userSelect:"none", whiteSpace:"nowrap",
                      position:"sticky", top:0, zIndex:5,
                      background: rol ? rol.color : libre ? `${C.brand}10` : C.s2,
                      color: rol ? "#fff" : libre ? C.brand : C.ink,
                      borderBottom:`2px solid ${rol ? rol.color : libre ? C.brand+"66" : C.strong}`,
                      borderRight:`1px solid ${C.line}`,
                      fontSize:11, fontWeight:700, letterSpacing:.4 }}>
                    {rol && <span style={{ marginRight:4, fontSize:9, background:"rgba(255,255,255,.25)", borderRadius:3, padding:"1px 4px" }}>{rol.label.slice(0,3).toUpperCase()}</span>}
                    {!rol && libre && <span style={{ marginRight:4, fontSize:9, opacity:.5 }}>+</span>}
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

/* ─── Paso selección de filas ─────────────────────────────────────────────── */
function PasoSeleccion({ hojasData, configs, setCfgHoja, onVolver, onConfirmar }) {
  const materialHojas = hojasData
    .map((h, i) => ({ h, i, cfg: configs[i] }))
    .filter(({ cfg }) => cfg.tipo === "materiales" && cfg.colMapping.colNombre >= 0);

  const [hojaSelIdx, setHojaSelIdx] = useState(0);

  const buildRows = ({ h, cfg }) => {
    const { colNombre, colCategoria, colStock } = cfg.colMapping;
    const { startRow, excludedRows = [], decimalSep = "," } = cfg;
    const startIdx = Math.max(0, (startRow || 1) - 1);
    const out = [];
    for (let ri = startIdx + 1; ri < h.rows.length; ri++) {
      const cells    = h.rows[ri].map(c => String(c ?? "").trim());
      const cellsFmt = (h.rowsFmt[ri] || []).map(c => String(c ?? "").trim());
      if (cells.every(c => !c)) continue;
      const nombre = limpiarTexto(cells[colNombre] || "");
      if (!nombre) continue;
      const stockRaw = colStock >= 0 ? (cellsFmt[colStock] || cells[colStock] || "") : "";
      const stock = parseCantidad(stockRaw, decimalSep);
      out.push({
        ri, nombre,
        categoria: colCategoria >= 0 ? limpiarTexto(cells[colCategoria] || "") : "",
        stock: stock != null ? stock : "—",
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
    setCfgHoja(hojaIdx, cfg => ({ ...cfg, excludedRows: checked ? [] : rows.map(r => r.ri) }));
  };

  const totalSel  = materialHojas.reduce((s, mh) => s + buildRows(mh).filter(r => !r.excluded).length, 0);
  const totalRows = materialHojas.reduce((s, mh) => s + buildRows(mh).length, 0);

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0 }}>
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
          <div style={{ fontSize:12, color:C.sub }}>Desmarca las filas que no quieras importar.</div>
        </div>
        <span style={{ fontSize:13, fontWeight:600,
          color: totalSel === totalRows ? C.ok : C.brand,
          background: totalSel === totalRows ? C.okSoft : C.brandSoft,
          padding:"4px 12px", borderRadius:999 }}>
          {totalSel} / {totalRows} filas seleccionadas
        </span>
        <Btn onClick={onConfirmar} color={C.ok} style={{ padding:"7px 18px" }}>
          <Check size={14}/> Confirmar importación
        </Btn>
      </div>

      {materialHojas.length > 1 && (
        <div style={{ display:"flex", gap:0, borderBottom:`1px solid ${C.line}`, flexShrink:0, padding:"0 20px" }}>
          {materialHojas.map(({ h }, idx) => (
            <button key={idx} onClick={() => setHojaSelIdx(idx)}
              style={{ padding:"8px 16px", border:"none", background:"transparent", cursor:"pointer",
                fontFamily:"inherit", fontSize:13.5, whiteSpace:"nowrap",
                borderBottom: hojaSelIdx === idx ? `2.5px solid ${C.brand}` : "2.5px solid transparent",
                color: hojaSelIdx === idx ? C.brand : C.sub,
                fontWeight: hojaSelIdx === idx ? 600 : 400, marginBottom:-1 }}>
              {h.nombre}
            </button>
          ))}
        </div>
      )}

      <div style={{ flex:1, overflowY:"auto", padding:"0 20px 20px" }}>
        {materialHojas.filter((_, idx) => materialHojas.length === 1 || idx === hojaSelIdx).map(({ h, i, cfg }) => {
          const rows      = buildRows({ h, cfg });
          const selCount  = rows.filter(r => !r.excluded).length;
          const allSel    = selCount === rows.length;
          const noneSel   = selCount === 0;
          const hasCat    = cfg.colMapping.colCategoria >= 0;
          const hasStock  = cfg.colMapping.colStock >= 0;
          return (
            <div key={i} style={{ marginTop:16 }}>
              <div style={{ border:`1px solid ${C.line}`, borderRadius:12, overflow:"hidden" }}>
                <table style={{ borderCollapse:"collapse", width:"100%", fontSize:13 }}>
                  <thead>
                    <tr style={{ background:C.s2 }}>
                      <th style={{ padding:"8px 12px", borderBottom:`1px solid ${C.strong}`, borderRight:`1px solid ${C.line}`, width:36, textAlign:"center" }}>
                        <input type="checkbox" checked={allSel}
                          ref={el => { if (el) el.indeterminate = !allSel && !noneSel; }}
                          onChange={e => toggleAll(i, rows, e.target.checked)}
                          style={{ cursor:"pointer", width:14, height:14 }}/>
                      </th>
                      <th style={{ padding:"8px 10px", borderBottom:`1px solid ${C.strong}`, borderRight:`1px solid ${C.line}`, fontSize:11, color:C.sub, fontWeight:700, width:50, textAlign:"center" }}>#</th>
                      {hasCat && <th style={{ padding:"8px 10px", borderBottom:`1px solid ${C.strong}`, borderRight:`1px solid ${C.line}`, fontSize:11, color:C.sub, fontWeight:700, textAlign:"left" }}>CATEGORÍA</th>}
                      <th style={{ padding:"8px 10px", borderBottom:`1px solid ${C.strong}`, borderRight:`1px solid ${C.line}`, fontSize:11, color:C.sub, fontWeight:700, textAlign:"left" }}>NOMBRE</th>
                      {hasStock && <th style={{ padding:"8px 10px", borderBottom:`1px solid ${C.strong}`, fontSize:11, color:C.sub, fontWeight:700, textAlign:"right", width:80 }}>STOCK</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={row.ri} onClick={() => toggleRow(i, row.ri)}
                        style={{ cursor:"pointer",
                          background: row.excluded ? C.s2 : "transparent",
                          opacity: row.excluded ? 0.45 : 1,
                          borderBottom: idx < rows.length - 1 ? `1px solid ${C.line}` : "none",
                          transition:"background .1s, opacity .1s" }}
                        onMouseEnter={e => !row.excluded && (e.currentTarget.style.background = C.brandSoft)}
                        onMouseLeave={e => (e.currentTarget.style.background = row.excluded ? C.s2 : "transparent")}>
                        <td style={{ padding:"7px 12px", textAlign:"center", borderRight:`1px solid ${C.line}` }}>
                          <input type="checkbox" checked={!row.excluded}
                            onChange={() => toggleRow(i, row.ri)} onClick={e => e.stopPropagation()}
                            style={{ cursor:"pointer", width:14, height:14 }}/>
                        </td>
                        <td style={{ padding:"7px 10px", textAlign:"center", fontSize:11.5, color:C.dim, borderRight:`1px solid ${C.line}` }}>
                          {row.ri + 1}
                        </td>
                        {hasCat && <td style={{ padding:"7px 10px", fontSize:12.5, color:C.sub, borderRight:`1px solid ${C.line}`, whiteSpace:"nowrap" }}>{row.categoria || "—"}</td>}
                        <td style={{ padding:"7px 10px", fontWeight:600, color: row.excluded ? C.dim : C.ink, borderRight: hasStock ? `1px solid ${C.line}` : "none", textDecoration: row.excluded ? "line-through" : "none" }}>
                          {row.nombre}
                        </td>
                        {hasStock && <td style={{ padding:"7px 10px", textAlign:"right", fontWeight:700, color: row.excluded ? C.dim : C.ok, fontVariantNumeric:"tabular-nums" }}>{row.stock}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length === 0 && (
                  <div style={{ padding:24, textAlign:"center", color:C.sub, fontSize:13 }}>
                    No se detectaron filas con datos en esta hoja.
                  </div>
                )}
                <div style={{ padding:"8px 14px", background:C.s2, borderTop:`1px solid ${C.line}`,
                  fontSize:12, color:C.sub, display:"flex", justifyContent:"space-between" }}>
                  <span>
                    <button onClick={() => toggleAll(i, rows, true)}
                      style={{ background:"none", border:"none", cursor:"pointer", color:C.brand, fontSize:12, fontWeight:600, padding:"0 4px", fontFamily:"inherit" }}>
                      Seleccionar todas
                    </button>
                    ·
                    <button onClick={() => toggleAll(i, rows, false)}
                      style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, fontSize:12, padding:"0 4px", fontFamily:"inherit" }}>
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
export default function AlmacenConfigurador({ file, almacen, empresaId, onConfirm, onCancel }) {
  const [cargando,       setCargando]      = useState(true);
  const [errMsg,         setErrMsg]        = useState(null);
  const [hojasData,      setHojasData]     = useState([]);
  const [configs,        setConfigs]       = useState([]);
  const [hojaActiva,     setHojaActiva]    = useState(0);
  const [plantillas,     setPlantillas]    = useState([]);
  const [plantillaNom,   setPlantillaNom]  = useState("");
  const [guardadoOk,     setGuardadoOk]    = useState(false);
  const [showPlantillas, setShowPlantillas]= useState(false);
  const [paso,           setPaso]          = useState("config");

  useEffect(() => {
    if (!file) return;
    setCargando(true);
    leerLibro(file).then(({ hojas }) => {
      setHojasData(hojas);
      const lista = cargarPlantillas(empresaId, almacen.id);
      setPlantillas(lista);
      if (lista.length > 0) {
        setConfigs(aplicarPlantilla(hojas, lista[0]));
        setPlantillaNom(lista[0].nombre);
      } else {
        setConfigs(hojas.map(() => configVacia()));
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

  const aplicar = (pl) => { setConfigs(aplicarPlantilla(hojasData, pl)); setPlantillaNom(pl.nombre); setShowPlantillas(false); };

  const guardarPlantilla = () => {
    const nombre = plantillaNom.trim();
    if (!nombre) return;
    const pl = { nombre, hojas: configs.map(c => ({ tipo:c.tipo, startRow:c.startRow, colMapping:c.colMapping, decimalSep:c.decimalSep, excludedRows:c.excludedRows||[] })) };
    guardarPlantillaLS(empresaId, almacen.id, pl);
    setPlantillas(cargarPlantillas(empresaId, almacen.id));
    setGuardadoOk(true);
    setTimeout(() => setGuardadoOk(false), 2000);
  };

  const confirmar = () => {
    if (plantillas.length === 0) {
      const autoPl = { nombre:"Plant. Auto", hojas: configs.map(c => ({ tipo:c.tipo, startRow:c.startRow, colMapping:c.colMapping, decimalSep:c.decimalSep, excludedRows:c.excludedRows||[] })) };
      guardarPlantillaLS(empresaId, almacen.id, autoPl);
    }
    const materiales = procesarLibro(null, hojasData, configs);
    onConfirm(materiales);
  };

  const cfg = configs[hojaActiva];
  const puedeConfirmar = configs.some(c => c.tipo === "materiales" && c.colMapping.colNombre >= 0);
  const totalHojas  = hojasData.length;
  const hojasConfig = configs.filter(c => c.tipo !== "ignorar").length;

  if (cargando) return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:600, display:"grid", placeItems:"center" }}>
      <div style={{ background:C.surface, borderRadius:18, padding:40, display:"flex", alignItems:"center", gap:14, boxShadow:"var(--shadow-lg)" }}>
        <Loader size={22} color={C.brand} className="spin"/>
        <span style={{ fontSize:15, color:C.ink }}>Leyendo Excel…</span>
      </div>
    </div>
  );

  if (errMsg) return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:600, display:"grid", placeItems:"center", padding:16 }}>
      <div style={{ background:C.surface, borderRadius:18, padding:32, maxWidth:400, textAlign:"center", boxShadow:"var(--shadow-lg)" }}>
        <AlertTriangle size={32} color={C.danger} style={{ marginBottom:12 }}/>
        <p style={{ fontSize:14, color:C.ink, marginBottom:20 }}>{errMsg}</p>
        <Btn outline onClick={onCancel}>Cerrar</Btn>
      </div>
    </div>
  );

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:600, display:"grid", placeItems:"center", padding:16 }}>
      <div style={{ background:C.surface, borderRadius:18, width:"100%", maxWidth:1100,
        height:"90vh", display:"flex", flexDirection:"column", boxShadow:"var(--shadow-lg)" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 20px",
          borderBottom:`1px solid ${C.line}`, flexShrink:0, flexWrap:"wrap" }}>
          <FileSpreadsheet size={18} color={C.brand}/>
          <span style={{ fontSize:16, fontWeight:700 }}>
            Importar al almacén — <span style={{ color:C.brand }}>{almacen.nombre}</span>
          </span>
          <span style={{ fontSize:12.5, color:C.sub, maxWidth:220, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {file?.name}
          </span>

          <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:8 }}>
            {hojasConfig === 0 ? (
              <span style={{ fontSize:12, color:C.warn, fontWeight:600, background:C.warnSoft, padding:"3px 10px", borderRadius:999 }}>
                Configura las hojas →
              </span>
            ) : puedeConfirmar ? (
              <span style={{ fontSize:12, color:C.ok, fontWeight:600, background:C.okSoft, padding:"3px 10px", borderRadius:999, display:"flex", alignItems:"center", gap:5 }}>
                <CheckCircle2 size={12}/> Listo para importar
              </span>
            ) : (
              <span style={{ fontSize:12, color:C.brand, fontWeight:600, background:C.brandSoft, padding:"3px 10px", borderRadius:999 }}>
                {hojasConfig}/{totalHojas} {hojasConfig === 1 ? "hoja" : "hojas"} configuradas
              </span>
            )}
          </div>

          <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
            {/* Guardar plantilla */}
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <input value={plantillaNom} onChange={e => setPlantillaNom(e.target.value)}
                placeholder="Nombre plantilla…"
                style={{ padding:"5px 10px", border:`1px solid ${C.strong}`, borderRadius:8,
                  fontSize:12.5, fontFamily:"inherit", background:C.s2, color:C.ink,
                  outline:"none", width:160 }}/>
              <Btn outline onClick={guardarPlantilla} style={{ padding:"5px 11px", fontSize:12 }}>
                {guardadoOk ? <><Check size={13} color={C.ok}/> Guardado</> : <><Save size={13}/> Guardar</>}
              </Btn>
            </div>

            {/* Selector de plantillas */}
            <div style={{ position:"relative" }}>
              <Btn outline onClick={() => setShowPlantillas(v => !v)} style={{ padding:"5px 11px", fontSize:12 }}>
                <BookMarked size={14}/>
                {plantillas.length > 0 ? `Plantillas (${plantillas.length})` : "Plantillas"}
              </Btn>
              {showPlantillas && (
                <div style={{ position:"absolute", top:"calc(100% + 6px)", right:0, zIndex:10,
                  background:C.surface, border:`1px solid ${C.strong}`, borderRadius:12,
                  boxShadow:"var(--shadow-lg)", minWidth:220, padding:"6px 0" }}
                  onClick={e => e.stopPropagation()}>
                  {plantillas.length === 0 && <p style={{ padding:"10px 14px", fontSize:13, color:C.sub }}>Sin plantillas guardadas.</p>}
                  {plantillas.map(p => (
                    <button key={p.nombre} onClick={() => aplicar(p)}
                      style={{ display:"flex", alignItems:"center", gap:8, width:"100%",
                        padding:"9px 14px", background:"none", border:"none", cursor:"pointer",
                        fontFamily:"inherit", fontSize:13.5, color:C.ink, textAlign:"left" }}
                      onMouseEnter={e => e.currentTarget.style.background = C.s2}
                      onMouseLeave={e => e.currentTarget.style.background = ""}>
                      <ChevronRight size={13} color={C.sub}/>{p.nombre}
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

        {/* Paso selección */}
        {paso === "seleccion" && (
          <PasoSeleccion
            hojasData={hojasData} configs={configs} setCfgHoja={setCfgHoja}
            onVolver={() => setPaso("config")} onConfirmar={confirmar}
          />
        )}

        {/* Tabs hojas */}
        {paso === "config" && (
          <div style={{ display:"flex", gap:0, borderBottom:`1px solid ${C.line}`,
            flexShrink:0, overflowX:"auto", padding:"0 20px" }}>
            {hojasData.map((h, i) => {
              const tipo = configs[i]?.tipo || "ignorar";
              const Icon = tipo === "materiales" ? Table2 : EyeOff;
              const col  = tipo === "materiales" ? C.ok : C.dim;
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
                  <div style={{ fontSize:10, fontWeight:600, color:col, letterSpacing:"0.04em", textTransform:"uppercase", paddingLeft:1 }}>
                    {tipo === "materiales" ? "materiales" : "ignorar"}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Panel hoja activa */}
        {paso === "config" && cfg && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0 }}>

            {/* Selector tipo hoja */}
            <div style={{ padding:"10px 20px", borderBottom:`1px solid ${C.line}`, flexShrink:0 }}>
              <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
                <span style={{ fontSize:12, fontWeight:700, color:C.sub, marginRight:4, letterSpacing:.4 }}>
                  ¿QUÉ CONTIENE ESTA HOJA?
                </span>
                {[
                  { val:"materiales", label:"Lista de materiales", desc:"Tabla con productos y stock", Icon:Table2, color:C.ok },
                  { val:"ignorar",    label:"Ignorar",             desc:"No importar esta hoja",       Icon:EyeOff, color:C.dim },
                ].map(({ val, label, desc, Icon, color }) => (
                  <button key={val}
                    onClick={() => setCfgHoja(hojaActiva, c => ({ ...c, tipo:val }))}
                    style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 14px",
                      borderRadius:10, border:`1.5px solid ${cfg.tipo === val ? color : C.line}`,
                      background: cfg.tipo === val ? `${color}15` : "transparent",
                      cursor:"pointer", fontFamily:"inherit", color: cfg.tipo === val ? color : C.sub,
                      fontWeight: cfg.tipo === val ? 700 : 400, fontSize:12.5 }}>
                    <Icon size={15} color={cfg.tipo === val ? color : C.dim}/>
                    <div style={{ textAlign:"left" }}>
                      <div>{label}</div>
                      <div style={{ fontSize:10.5, opacity:.7 }}>{desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Panel columnas o mensaje ignorar */}
            {cfg.tipo === "materiales" ? (
              <PanelColumnas hoja={hojasData[hojaActiva]} cfg={cfg}
                setCfg={c => setCfgHoja(hojaActiva, c)}/>
            ) : (
              <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
                justifyContent:"center", color:C.dim, gap:8 }}>
                <EyeOff size={32}/>
                <p style={{ fontSize:14 }}>Esta hoja no se importará.</p>
              </div>
            )}

            {/* Footer */}
            <div style={{ padding:"12px 20px", borderTop:`1px solid ${C.line}`, flexShrink:0,
              display:"flex", justifyContent:"flex-end", gap:10 }}>
              <Btn outline onClick={onCancel}>Cancelar</Btn>
              {puedeConfirmar && (
                <Btn onClick={() => setPaso("seleccion")} color={C.ok}>
                  <Check size={14}/> Revisar y confirmar
                </Btn>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
