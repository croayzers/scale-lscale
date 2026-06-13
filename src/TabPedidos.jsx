// MARK: - Constantes UI (C, CHIP_ESTADO, ESTADOS)
// MARK: - Btn / Field
// MARK: - ExpedicionForm
// MARK: - MaterialesList
// MARK: - ListaPedidos
// MARK: - cfgExportDefecto / lineasParaExportar / exportarExcelCfg / exportarPDFCfg
// MARK: - ExportConfigurador
// MARK: - DetallePedido
// MARK: - ModalNotificaciones
// MARK: - TabPedidos [export default]
import React, { useState, useEffect, useRef, useMemo, Fragment } from "react";
import * as XLSX from "xlsx";
import {
  Upload, Loader, X, Check, AlertTriangle, Plus, Trash2,
  Warehouse, ArrowLeft, FileSpreadsheet, Pencil, ClipboardList,
  ChevronRight, ArrowRight, Download, FileDown, Save, Bell, BellOff,
} from "lucide-react";
import { useL } from "./lib/i18n.js";
import { parsearExcelPedido } from "./lib/parseExcelPedido.js";
import ExcelConfigurador from "./ExcelConfigurador.jsx";
import { guardarPedido, borrarPedido, cargarMiembrosEmpresa, enviarNotificacionPedido, recargarMateriales } from "./lib/data.js";
import { fmtFecha, siguienteCodigo } from "./lib/fechas.js";
import { conflictosPedido } from "./lib/stockConflictos.js";

// MARK: - Constantes UI (C, CHIP_ESTADO, ESTADOS)
/* ─── Paleta ──────────────────────────────────────────────────────────────── */
const C = {
  bg:"var(--bg)", surface:"var(--surface)", s2:"var(--surface-2)",
  line:"var(--border)", strong:"var(--border-strong)",
  ink:"var(--text)", sub:"var(--text-2)", dim:"var(--text-3)",
  brand:"var(--brand)", brandSoft:"var(--brand-soft)",
  ok:"var(--ok)", okSoft:"var(--ok-soft)",
  warn:"var(--warn)", warnSoft:"var(--warn-soft)",
  danger:"var(--danger)", dangerSoft:"var(--danger-soft)",
};

const CHIP_ESTADO = {
  reservado:   { bg:"var(--surface-2)",    ink:"var(--text-2)"  },
  confirmado:  { bg:"var(--ok-soft)",      ink:"var(--ok)"      },
  retorno:     { bg:"var(--warn-soft)",    ink:"var(--warn)"    },
  finalizado:  { bg:"var(--brand-soft)",   ink:"var(--brand)"   },
  cancelado:   { bg:"var(--danger-soft)",  ink:"var(--danger)"  },
};
const ESTADOS = ["reservado","confirmado","retorno","finalizado","cancelado"];
const ESTADO_SEQ = ["reservado","confirmado","retorno","finalizado"];

// MARK: - Btn / Field
/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function Btn({ children, onClick, disabled, color = C.brand, outline = false, style: s = {} }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"9px 16px",
        borderRadius:999, border: outline ? `1px solid ${C.strong}` : "none",
        background: outline ? C.s2 : color, color: outline ? C.ink : "#fff",
        fontWeight:600, fontSize:13.5, cursor:"pointer", opacity: disabled ? 0.5 : 1,
        fontFamily:"inherit", ...s }}>
      {children}
    </button>
  );
}

function Field({ label, value, onChange, type = "text", placeholder = "", span = false }) {
  return (
    <div style={span ? { gridColumn:"1 / -1" } : {}}>
      <label style={{ fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.5, display:"block", marginBottom:4 }}>{label}</label>
      <input type={type} value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width:"100%", padding:"8px 10px", border:`1px solid ${C.strong}`, borderRadius:9,
          fontSize:13.5, fontFamily:"inherit", background:C.s2, color:C.ink, outline:"none" }}/>
    </div>
  );
}

// MARK: - ExpedicionForm
/* ─── Formulario de expedición (wizard) ───────────────────────────────────── */
function ExpedicionForm({ form, setForm, nextCodigo, L }) {
  const f = (k) => (v) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      <Field label={L("CÓDIGO EVENTO","EVENT CODE")}        value={form.codigo}         onChange={f("codigo")} placeholder={nextCodigo || "OA_00000"}/>
      <Field label={L("REFERENCIA PEDIDO","ORDER REF")}     value={form.referencia}     onChange={f("referencia")}/>
      <Field label={L("CLIENTE","CLIENT")}                  value={form.nombre}         onChange={f("nombre")} span/>
      <Field label={L("CONTACTO","CONTACT")}                value={form.contacto}       onChange={f("contacto")}/>
      <Field label={L("DESTINO / LLOC","DESTINATION")}      value={form.destino}        onChange={f("destino")}/>
      <Field label={L("FECHA EXPEDICIÓN","DISPATCH DATE")}  value={form.fecha_entrega}  onChange={f("fecha_entrega")} placeholder="YYYY-MM-DD"/>
      <Field label={L("FECHA RETORNO","RETURN DATE")}       value={form.fecha_retorno}  onChange={f("fecha_retorno")} placeholder="YYYY-MM-DD"/>
      <Field label={L("HORA IDA (descarga)","DEPARTURE TIME")}    value={form.hora_ida    ?? ""} onChange={f("hora_ida")}    type="time" placeholder="HH:MM"/>
      <Field label={L("HORA VUELTA (recogida)","RETURN TIME")}    value={form.hora_vuelta ?? ""} onChange={f("hora_vuelta")} type="time" placeholder="HH:MM"/>
      <Field label={L("FECHA CARGA","LOAD DATE")}                 value={form.fecha_carga ?? ""} onChange={f("fecha_carga")} type="date" placeholder="YYYY-MM-DD"/>
      <Field label={L("PAX ADULTS","PAX ADULTS")}           value={form.pax_adults ?? ""} onChange={f("pax_adults")} type="number"/>
      <Field label={L("PAX NENS","PAX KIDS")}               value={form.pax_nens   ?? ""} onChange={f("pax_nens")}   type="number"/>
      <div style={{ gridColumn:"1 / -1" }}>
        <label style={{ fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.5, display:"block", marginBottom:4 }}>NOTAS</label>
        <textarea value={form.notas || ""} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
          rows={2} placeholder={L("Instrucciones adicionales…","Additional instructions…")}
          style={{ width:"100%", padding:"8px 10px", border:`1px solid ${C.strong}`, borderRadius:9,
            fontSize:13.5, fontFamily:"inherit", background:C.s2, color:C.ink, outline:"none", resize:"vertical" }}/>
      </div>
    </div>
  );
}

// MARK: - MaterialesList
/* ─── Lista de materiales con nombre editable (wizard) ───────────────────── */
function MaterialesList({ grouped, updateMaterial, L }) {
  if (!grouped.length) return (
    <p style={{ color:C.sub, textAlign:"center", padding:30 }}>
      {L("No se detectaron materiales en Hoja2.","No materials detected in Sheet2.")}
    </p>
  );
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 140px 56px", gap:"0 10px",
        padding:"6px 8px", borderBottom:`1px solid ${C.line}`,
        fontSize:10.5, fontWeight:700, color:C.dim, letterSpacing:.6, marginBottom:2 }}>
        <div>{L("NOMBRE ORIGINAL","ORIGINAL NAME")}</div>
        <div>{L("NOMBRE EN APP (opcional)","APP NAME (optional)")}</div>
        <div>COMENTARIO</div>
        <div style={{ textAlign:"right" }}>CANT.</div>
      </div>
      {grouped.map((row, i) => {
        if (row.type === "timing") return (
          <div key={i} style={{ marginTop:14, marginBottom:3, padding:"5px 8px",
            background:C.brandSoft, borderRadius:7,
            fontSize:12.5, fontWeight:800, color:C.brand, letterSpacing:.8 }}>
            {row.label || L("(sin timing)","(no timing)")}
          </div>
        );
        if (row.type === "categoria") return (
          <div key={i} style={{ fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.5,
            padding:"4px 8px 2px", marginTop:6, borderBottom:`1px solid ${C.line}` }}>
            {row.label || L("(sin categoría)","(no category)")}
          </div>
        );
        const { item, idx } = row;
        return (
          <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 140px 56px",
            gap:"0 10px", padding:"4px 8px", alignItems:"center", fontSize:13,
            borderBottom:`1px solid ${C.line}` }}
            onMouseEnter={e => e.currentTarget.style.background = C.s2}
            onMouseLeave={e => e.currentTarget.style.background = ""}>
            <div style={{ color: item.nombre_custom ? C.dim : C.ink,
              textDecoration: item.nombre_custom ? "line-through" : "none",
              fontSize: item.nombre_custom ? 12 : 13,
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {item.nombre}
            </div>
            <input value={item.nombre_custom} onChange={e => updateMaterial(idx, "nombre_custom", e.target.value)}
              placeholder={L("← usa el original","← keep original")}
              style={{ padding:"3px 7px", border:`1px solid ${item.nombre_custom ? C.brand : C.line}`,
                borderRadius:6, fontSize:12.5, fontFamily:"inherit", background:"transparent",
                color: item.nombre_custom ? C.brand : C.ink, outline:"none",
                boxShadow: item.nombre_custom ? `0 0 0 2px ${C.brandSoft}` : "none" }}/>
            <div style={{ fontSize:11.5, color:C.sub, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {item.comentario || ""}
            </div>
            <div style={{ textAlign:"right", fontWeight:600 }}>{item.cantidad}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LISTA DE PEDIDOS
   ═══════════════════════════════════════════════════════════════════════════ */
// MARK: - ListaPedidos
function ListaPedidos({ pedidos, almacenes, vehiculosEmpresa, onSelect, onImport, formatoFecha = "DD/MM/YYYY", highlightedPedidoId, L }) {
  const sorted = [...pedidos].sort((a, b) => {
    const fa = a.fecha_entrega || a.fecha_pedido || "";
    const fb = b.fecha_entrega || b.fecha_pedido || "";
    return fb.localeCompare(fa);
  });

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0 }}>

      {/* Toolbar */}
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 20px",
        borderBottom:`1px solid ${C.line}`, flexShrink:0 }}>
        <h2 style={{ fontSize:18, margin:0 }}>{L("Pedidos","Orders")}</h2>
        <span style={{ fontSize:12.5, color:C.sub }}>{pedidos.length} {L("pedidos","orders")}</span>
        <div style={{ flex:1 }}/>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {almacenes.map(alm => (
            <button key={alm.id} onClick={() => onImport(alm)}
              style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"7px 14px",
                borderRadius:999, border:`1.5px dashed ${C.brand}`, background:C.brandSoft,
                color:C.brand, cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600 }}>
              <Warehouse size={14}/> {L("Importar","Import")} — {alm.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div style={{ flex:1, overflowY:"auto" }}>
        {sorted.length === 0 ? (
          <div style={{ padding:48, textAlign:"center", color:C.sub }}>
            <ClipboardList size={36} color={C.line} style={{ display:"block", margin:"0 auto 14px" }}/>
            <p style={{ fontSize:14 }}>{L("Sin pedidos. Importa un Excel para empezar.","No orders yet. Import an Excel to get started.")}</p>
          </div>
        ) : (
          sorted.map(p => {
            const chip = CHIP_ESTADO[p.estado] || CHIP_ESTADO.reservado;
            const almNombre = almacenes.find(a => a.id === p.almacen_id)?.nombre || p.almacen_nombre || "—";
            return (
              <div key={p.id} onClick={() => onSelect(p)}
                className={highlightedPedidoId === p.id ? "pedido-rainbow" : ""}
                style={{ display:"flex", alignItems:"center", gap:14, padding:"13px 20px",
                  borderBottom:`1px solid ${C.line}`, cursor:"pointer", transition:"background .1s" }}
                onMouseEnter={e => { if (highlightedPedidoId !== p.id) e.currentTarget.style.background = C.s2; }}
                onMouseLeave={e => { if (highlightedPedidoId !== p.id) e.currentTarget.style.background = ""; }}>
                <div style={{ width:36, height:36, borderRadius:10, background:C.brandSoft,
                  color:C.brand, display:"grid", placeItems:"center", flexShrink:0 }}>
                  <ClipboardList size={17}/>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    <span style={{ fontWeight:700, fontSize:14 }}>{p.codigo || `PED-${p.id}`}</span>
                    <span style={{ fontSize:11, padding:"2px 8px", borderRadius:999, background:chip.bg, color:chip.ink, fontWeight:600 }}>
                      {p.estado}
                    </span>
                  </div>
                  <div style={{ fontSize:13, color:C.ink, marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {p.nombre || "—"}
                  </div>
                  <div style={{ display:"flex", gap:12, flexWrap:"wrap", fontSize:11.5, color:C.sub, marginTop:2 }}>
                    {p.fecha_entrega && <span>📅 {fmtFecha(p.fecha_entrega, formatoFecha)}{p.hora_ida ? ` ${p.hora_ida}` : ""}</span>}
                    {p.hora_vuelta && <span>↩ {p.hora_vuelta}</span>}
                    <span>🏭 {almNombre}</span>
                    {p.destino && <span>📍 {p.destino}</span>}
                    {p.lineas && <span>{p.lineas.length} líneas</span>}
                    {p.vehiculo_id && vehiculosEmpresa?.length > 0 && (() => {
                      const v = vehiculosEmpresa.find(v => String(v.id) === String(p.vehiculo_id));
                      return v ? (
                        <span style={{ display:"inline-flex", alignItems:"center", gap:4 }}>
                          <span style={{ width:7, height:7, borderRadius:999, background:v.color, display:"inline-block" }}/>
                          {v.nombre || v.matricula}
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>
                {/* Creado por + vistos por */}
                <div style={{ display:"flex", alignItems:"center", gap:3, flexShrink:0 }}>
                  {p.creado_por_nombre && (
                    <div title={`Creado por ${p.creado_por_nombre}`}
                      style={{ width:26, height:26, borderRadius:999, background:"#6366f1",
                        color:"#fff", display:"grid", placeItems:"center", fontSize:11,
                        fontWeight:700, flexShrink:0, border:"2px solid var(--surface)" }}>
                      {p.creado_por_nombre[0].toUpperCase()}
                    </div>
                  )}
                  {(p.vistos_por || []).filter(v => v.id !== p.creado_por_id).slice(0, 3).map((v, i) => (
                    <div key={v.id} title={`Visto por ${v.nombre}`}
                      style={{ width:26, height:26, borderRadius:999, background:"#94a3b8",
                        color:"#fff", display:"grid", placeItems:"center", fontSize:11,
                        fontWeight:700, flexShrink:0, marginLeft:-6,
                        border:"2px solid var(--surface)" }}>
                      {(v.nombre || "?")[0].toUpperCase()}
                    </div>
                  ))}
                </div>
                <ChevronRight size={16} color={C.dim}/>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PLANTILLAS DE EXPORTACIÓN  (localStorage por almacén)
   ═══════════════════════════════════════════════════════════════════════════ */
function keyPlantillasExport(empresaId, almacenId) {
  return `lscale.export_tpl.${empresaId}.${almacenId}`;
}
function cargarPlantillasExport(empresaId, almacenId) {
  try { return JSON.parse(localStorage.getItem(keyPlantillasExport(empresaId, almacenId))) || []; }
  catch { return []; }
}
function guardarPlantillaExport(empresaId, almacenId, tpl) {
  const lista = cargarPlantillasExport(empresaId, almacenId);
  const idx = lista.findIndex(p => p.nombre === tpl.nombre);
  if (idx >= 0) lista[idx] = tpl; else lista.push(tpl);
  localStorage.setItem(keyPlantillasExport(empresaId, almacenId), JSON.stringify(lista));
}

// Columnas disponibles para exportar (fijas + roles dinámicos se añaden desde fuera)
const COLS_BASE = [
  { key:"categoria", label:"Categoría",  fija:false, defVisible:true  },
  { key:"nombre",    label:"Nombre",     fija:true,  defVisible:true  },
  { key:"cantidad",  label:"Cantidad",   fija:true,  defVisible:true  },
  { key:"unidad",    label:"Unidad",     fija:false, defVisible:false },
];

/* ─── Generar la configuración por defecto a partir de las líneas del pedido ─ */
// MARK: - cfgExportDefecto / lineasParaExportar / exportarExcelCfg / exportarPDFCfg
function cfgExportDefecto(lineas, rolesImport) {
  // Columnas: base + roles dinámicos
  const colsRoles = (rolesImport || []).map(r => ({
    key: r.key, label: r.label, fija: false, defVisible: true, color: r.color,
  }));
  const cols = [...COLS_BASE, ...colsRoles].map(c => ({ ...c, visible: c.defVisible }));

  // Alias de nombres: nombre_original → nombre_exportado
  const alias = {};
  for (const l of (lineas || [])) {
    if (l.nombre && !(l.nombre in alias)) alias[l.nombre] = "";
  }
  return { cols, alias };
}

/* ─── Aplicar alias y cols a las líneas para exportar ─────────────────────── */
function lineasParaExportar(lineas, cfg) {
  return (lineas || []).map(l => {
    const out = { ...l };
    out._nombreExport = cfg.alias[l.nombre] || l.nombre;
    return out;
  });
}

/* ─── Exportar a Excel con config ──────────────────────────────────────────── */
function exportarExcelCfg(pedido, almacenes, cfg) {
  const wb = XLSX.utils.book_new();
  const almNombre = almacenes.find(a => a.id === pedido.almacen_id)?.nombre || pedido.almacen_nombre || "—";

  // Hoja datos pedido
  const datosRows = [
    ["PEDIDO", pedido.codigo || `PED-${pedido.id}`],
    ["Cliente", pedido.nombre || ""], ["Destino", pedido.destino || ""],
    ["Contacto", pedido.contacto || ""], ["Referencia", pedido.referencia || ""],
    ["Almacén", almNombre], ["Fecha exp.", pedido.fecha_entrega || ""],
    ["Hora ida", pedido.hora_ida || ""], ["Fecha retorno", pedido.fecha_retorno || ""],
    ["Hora vuelta", pedido.hora_vuelta || ""], ["Pax", pedido.pax_adults || ""],
    ["Notas", pedido.notas || ""],
  ];
  const wsDatos = XLSX.utils.aoa_to_sheet(datosRows);
  wsDatos["!cols"] = [{ wch:18 }, { wch:40 }];
  XLSX.utils.book_append_sheet(wb, wsDatos, "Datos pedido");

  // Hoja materiales con cols visibles y alias
  const colsVis = cfg.cols.filter(c => c.visible);
  const header = colsVis.map(c => c.label);
  const lineasExp = lineasParaExportar(pedido.lineas, cfg);
  const filas = lineasExp.map(l =>
    colsVis.map(c => c.key === "nombre" ? l._nombreExport : (l[c.key] ?? ""))
  );
  const wsMat = XLSX.utils.aoa_to_sheet([header, ...filas]);
  wsMat["!cols"] = colsVis.map(c => ({ wch: c.key === "nombre" ? 36 : c.key === "categoria" ? 20 : 14 }));
  XLSX.utils.book_append_sheet(wb, wsMat, "Materiales");

  XLSX.writeFile(wb, `${pedido.codigo || `PED-${pedido.id}`}_${pedido.fecha_entrega || "sin-fecha"}.xlsx`);
}

/* ─── Exportar a PDF con config ────────────────────────────────────────────── */
function exportarPDFCfg(pedido, almacenes, cfg) {
  const almNombre = almacenes.find(a => a.id === pedido.almacen_id)?.nombre || pedido.almacen_nombre || "—";
  const colsVis = cfg.cols.filter(c => c.visible);
  const lineasExp = lineasParaExportar(pedido.lineas, cfg);

  // Agrupar por almacén → categoría
  const byAlm = {};
  for (const l of lineasExp) {
    const aid = String(l.almacen_id ?? pedido.almacen_id ?? "__sin__");
    if (!byAlm[aid]) byAlm[aid] = {};
    const cat = l.categoria || "(sin categoría)";
    if (!byAlm[aid][cat]) byAlm[aid][cat] = [];
    byAlm[aid][cat].push(l);
  }
  const multiAlm = Object.keys(byAlm).length > 1;
  const totalUds = lineasExp.reduce((s, l) => s + (Number(l.cantidad) || 0), 0);
  const ncols = colsVis.length;

  const thStyle = `background:#6366f1;color:#fff;padding:7px 10px;text-align:left;font-size:11px;letter-spacing:.5px;text-transform:uppercase;`;
  const thLast  = `${thStyle}text-align:right;`;

  const thead = `<tr>${colsVis.map((c, i) =>
    `<th style="${i === colsVis.length - 1 && c.key === "cantidad" ? thLast : thStyle}">${c.label}</th>`
  ).join("")}</tr>`;

  const lineasHTML = Object.entries(byAlm).map(([aid, cats]) => {
    const almN = almacenes.find(a => String(a.id) === aid)?.nombre || (aid === "__sin__" ? almNombre : `Almacén ${aid}`);
    const cabAlm = multiAlm
      ? `<tr style="background:#e0e7ff"><td colspan="${ncols}" style="padding:7px 10px;font-weight:800;font-size:13px;color:#3730a3">🏭 ${almN}</td></tr>`
      : "";
    return cabAlm + Object.entries(cats).map(([cat, items]) =>
      `<tr style="background:#f3f4f6"><td colspan="${ncols}" style="padding:5px 10px;font-size:11px;font-weight:700;color:#6b7280;letter-spacing:.8px;text-transform:uppercase">${cat}</td></tr>` +
      items.map(l =>
        `<tr>${colsVis.map((c, i) => {
          const val = c.key === "nombre" ? l._nombreExport : (l[c.key] ?? "");
          const isLast = i === colsVis.length - 1;
          return `<td style="padding:6px 10px;font-size:13px;${c.key === "cantidad" ? "font-weight:700;" : ""}${isLast && c.key === "cantidad" ? "text-align:right;" : ""}">${val}</td>`;
        }).join("")}</tr>`
      ).join("")
    ).join("");
  }).join("");

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>${pedido.codigo || `PED-${pedido.id}`}</title>
<style>
  @page{size:A4;margin:18mm 14mm}body{font-family:system-ui,sans-serif;color:#111;margin:0}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;border-bottom:3px solid #6366f1;padding-bottom:10px}
  .title{font-size:22px;font-weight:800;color:#6366f1}.sub{font-size:13px;color:#6b7280;margin-top:3px}
  .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 16px;background:#f9fafb;border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:12.5px}
  .meta strong{display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;color:#9ca3af;margin-bottom:1px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  tbody tr:nth-child(even){background:#f9fafb}td{border-bottom:1px solid #e5e7eb}
  .tot td{font-weight:800;font-size:13.5px;background:#ede9fe;border-top:2px solid #6366f1}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="hdr"><div>
  <div class="title">${pedido.codigo || `PED-${pedido.id}`}</div>
  <div class="sub">${pedido.nombre || ""}${pedido.referencia ? " · " + pedido.referencia : ""}</div>
</div><div style="text-align:right;font-size:12px;color:#6b7280">
  <div style="font-weight:700;color:#374151">${pedido.estado || ""}</div>
  <div>Impreso: ${new Date().toLocaleDateString("es-ES")}</div>
</div></div>
<div class="meta">
  ${pedido.destino      ? `<div><strong>Destino</strong>${pedido.destino}</div>` : ""}
  ${pedido.contacto     ? `<div><strong>Contacto</strong>${pedido.contacto}</div>` : ""}
  ${pedido.fecha_entrega? `<div><strong>Fecha expedición</strong>${pedido.fecha_entrega}${pedido.hora_ida?" · "+pedido.hora_ida:""}</div>` : ""}
  ${pedido.fecha_retorno? `<div><strong>Fecha retorno</strong>${pedido.fecha_retorno}${pedido.hora_vuelta?" · "+pedido.hora_vuelta:""}</div>` : ""}
  ${pedido.pax_adults   ? `<div><strong>Pax</strong>${pedido.pax_adults}</div>` : ""}
  <div><strong>Almacén</strong>${almNombre}</div>
  ${pedido.notas        ? `<div style="grid-column:1/-1"><strong>Notas</strong>${pedido.notas}</div>` : ""}
</div>
<table><thead>${thead}</thead><tbody>
  ${lineasHTML}
  <tr class="tot"><td style="padding:8px 10px" colspan="${ncols - 1}">TOTAL — ${lineasExp.length} líneas</td>
  <td style="padding:8px 10px;text-align:right">${totalUds}</td></tr>
</tbody></table></body></html>`;

  const win = window.open("", "_blank", "width=820,height=1000");
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL CONFIGURADOR DE EXPORTACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */
// MARK: - ExportConfigurador
function ExportConfigurador({ pedido, almacenes, empresaId, rolesImport, formato, onClose }) {
  const almacenId = pedido.almacen_id;
  const [plantillas, setPlantillas] = useState(() => cargarPlantillasExport(empresaId, almacenId));
  const [tplNombre, setTplNombre] = useState("");
  const [savedOk, setSavedOk] = useState(false);

  // cfg: { cols:[{key,label,fija,visible,color?}], alias:{nombre_orig: nombre_export} }
  const [cfg, setCfg] = useState(() => {
    const def = cfgExportDefecto(pedido.lineas, rolesImport);
    // Aplicar última plantilla si existe
    if (plantillas.length > 0) {
      const ultima = plantillas[plantillas.length - 1];
      return mergeConPlantilla(def, ultima.cfg);
    }
    return def;
  });

  function mergeConPlantilla(base, tplCfg) {
    if (!tplCfg) return base;
    // Cols: mantener orden de la plantilla; añadir cols nuevas al final
    const colsMap = Object.fromEntries(base.cols.map(c => [c.key, c]));
    const colsOrdenadas = (tplCfg.cols || [])
      .filter(c => colsMap[c.key])
      .map(c => ({ ...colsMap[c.key], visible: c.visible }));
    const clavesTpl = new Set((tplCfg.cols || []).map(c => c.key));
    const colsNuevas = base.cols.filter(c => !clavesTpl.has(c.key));
    // Alias: fusionar; las del pedido actual que no estén en plantilla quedan vacías
    const alias = { ...base.alias, ...(tplCfg.alias || {}) };
    return { cols: [...colsOrdenadas, ...colsNuevas], alias };
  }

  const aplicarPlantilla = (tpl) => {
    setCfg(p => mergeConPlantilla(cfgExportDefecto(pedido.lineas, rolesImport), tpl.cfg));
    setTplNombre(tpl.nombre);
  };

  const guardar = () => {
    if (!tplNombre.trim()) return;
    const tpl = { nombre: tplNombre.trim(), cfg: { cols: cfg.cols.map(c => ({ key:c.key, visible:c.visible })), alias: cfg.alias } };
    guardarPlantillaExport(empresaId, almacenId, tpl);
    setPlantillas(cargarPlantillasExport(empresaId, almacenId));
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2000);
  };

  const ejecutar = () => {
    if (formato === "pdf") exportarPDFCfg(pedido, almacenes, cfg);
    else exportarExcelCfg(pedido, almacenes, cfg);
    onClose();
  };

  // Mover columna en el orden
  const moverCol = (idx, dir) => setCfg(p => {
    const cols = [...p.cols];
    const j = idx + dir;
    if (j < 0 || j >= cols.length) return p;
    [cols[idx], cols[j]] = [cols[j], cols[idx]];
    return { ...p, cols };
  });

  const toggleCol = (key) => setCfg(p => ({
    ...p,
    cols: p.cols.map(c => c.key === key && !c.fija ? { ...c, visible: !c.visible } : c),
  }));

  const setAlias = (nombre, val) => setCfg(p => ({ ...p, alias: { ...p.alias, [nombre]: val } }));

  // Nombres únicos en el pedido
  const nombresUnicos = useMemo(() => {
    const set = new Set();
    return (pedido.lineas || []).filter(l => { const n = l.nombre; if (set.has(n)) return false; set.add(n); return true; }).map(l => l.nombre);
  }, [pedido.lineas]);

  const hayCambiosAlias = nombresUnicos.some(n => cfg.alias[n]);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", zIndex:700,
      display:"grid", placeItems:"center", padding:16 }}>
      <div style={{ background:C.surface, borderRadius:18, width:"100%", maxWidth:1200,
        maxHeight:"92vh", display:"flex", flexDirection:"column", boxShadow:"0 20px 60px rgba(0,0,0,.3)" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 20px",
          borderBottom:`1px solid ${C.line}`, flexShrink:0 }}>
          {formato === "pdf"
            ? <FileDown size={18} color="#ef4444"/>
            : <FileSpreadsheet size={18} color="#16a34a"/>}
          <div>
            <div style={{ fontSize:15, fontWeight:700 }}>
              Configurar exportación — <span style={{ color: formato === "pdf" ? "#ef4444" : "#16a34a" }}>
                {formato === "pdf" ? "PDF" : "Excel"}
              </span>
            </div>
            <div style={{ fontSize:12, color:C.sub }}>{pedido.codigo || `PED-${pedido.id}`} · {(pedido.lineas||[]).length} líneas</div>
          </div>

          {/* Selector de plantillas */}
          {plantillas.length > 0 && (
            <div style={{ marginLeft:12, display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontSize:12, color:C.sub }}>Plantilla:</span>
              <select onChange={e => { const t = plantillas.find(p => p.nombre === e.target.value); if (t) aplicarPlantilla(t); }}
                defaultValue=""
                style={{ padding:"5px 9px", border:`1px solid ${C.strong}`, borderRadius:8, fontSize:12.5,
                  fontFamily:"inherit", background:C.s2, color:C.ink, outline:"none", cursor:"pointer" }}>
                <option value="">— nueva —</option>
                {plantillas.map(p => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
              </select>
            </div>
          )}

          <button onClick={onClose} style={{ marginLeft:"auto", background:"none", border:"none", cursor:"pointer", color:C.sub }}>
            <X size={18}/>
          </button>
        </div>

        {/* Body: tres paneles */}
        <div style={{ flex:1, minHeight:0, display:"flex", gap:0, overflow:"hidden" }}>

          {/* Panel izquierdo: columnas */}
          <div style={{ width:190, flexShrink:0, borderRight:`1px solid ${C.line}`,
            display:"flex", flexDirection:"column", padding:"10px 12px", gap:5, overflowY:"auto" }}>
            <div style={{ fontSize:10.5, fontWeight:700, color:C.sub, letterSpacing:.5, marginBottom:2 }}>
              COLUMNAS
            </div>
            {cfg.cols.map((col, idx) => (
              <div key={col.key} style={{ display:"flex", alignItems:"center", gap:5,
                padding:"5px 7px", borderRadius:7,
                background: col.visible ? (col.color ? `${col.color}12` : C.brandSoft) : C.s2,
                border:`1px solid ${col.visible ? (col.color || C.brand) + "44" : C.line}`,
                opacity: col.visible ? 1 : 0.45, cursor: col.fija ? "default" : "pointer" }}
                onClick={() => !col.fija && toggleCol(col.key)}>
                <div style={{ width:14, height:14, borderRadius:3, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
                  background: col.visible ? (col.color || C.brand) : "transparent",
                  border: col.visible ? "none" : `1.5px solid ${C.line}` }}>
                  {col.visible && <Check size={10} color="#fff"/>}
                </div>
                <span style={{ flex:1, fontSize:12, fontWeight:600,
                  color: col.visible ? (col.color || C.ink) : C.dim,
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {col.label}
                  {col.fija && <span style={{ fontSize:9, color:C.dim, marginLeft:3 }}>*</span>}
                </span>
                <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                  <button onClick={e => { e.stopPropagation(); moverCol(idx, -1); }} disabled={idx === 0}
                    style={{ background:"none", border:"none", cursor: idx===0 ? "not-allowed" : "pointer",
                      color:C.sub, padding:"1px 2px", fontSize:8, opacity: idx===0 ? .25 : .7, lineHeight:1 }}>▲</button>
                  <button onClick={e => { e.stopPropagation(); moverCol(idx, 1); }} disabled={idx === cfg.cols.length-1}
                    style={{ background:"none", border:"none", cursor: idx===cfg.cols.length-1 ? "not-allowed" : "pointer",
                      color:C.sub, padding:"1px 2px", fontSize:8, opacity: idx===cfg.cols.length-1 ? .25 : .7, lineHeight:1 }}>▼</button>
                </div>
              </div>
            ))}
          </div>

          {/* Panel central: alias de nombres */}
          <div style={{ width:300, flexShrink:0, borderRight:`1px solid ${C.line}`,
            display:"flex", flexDirection:"column", minWidth:0 }}>
            <div style={{ padding:"8px 12px", borderBottom:`1px solid ${C.line}`, flexShrink:0,
              display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ fontSize:10.5, fontWeight:700, color:C.sub, letterSpacing:.5 }}>RENOMBRAR MATERIALES</div>
              {hayCambiosAlias && (
                <span style={{ fontSize:10, padding:"1px 7px", borderRadius:999,
                  background:C.brandSoft, color:C.brand, fontWeight:700, marginLeft:"auto" }}>
                  {nombresUnicos.filter(n => cfg.alias[n]).length} ✎
                </span>
              )}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr",
              padding:"5px 12px", borderBottom:`1px solid ${C.line}`,
              fontSize:9.5, fontWeight:700, color:C.dim, letterSpacing:.4, flexShrink:0, background:C.s2 }}>
              <div>ORIGINAL</div><div>PARA EXPORTAR</div>
            </div>
            <div style={{ flex:1, overflowY:"auto" }}>
              {nombresUnicos.map(nombre => (
                <div key={nombre} style={{ display:"grid", gridTemplateColumns:"1fr 1fr",
                  padding:"4px 12px", borderBottom:`1px solid ${C.line}`, alignItems:"center", gap:8 }}
                  onMouseEnter={e => e.currentTarget.style.background = C.s2}
                  onMouseLeave={e => e.currentTarget.style.background = ""}>
                  <div style={{ fontSize:12, color: cfg.alias[nombre] ? C.dim : C.ink,
                    textDecoration: cfg.alias[nombre] ? "line-through" : "none",
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {nombre}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <input value={cfg.alias[nombre] || ""}
                      onChange={e => setAlias(nombre, e.target.value)}
                      placeholder="← original"
                      style={{ flex:1, padding:"3px 7px",
                        border:`1px solid ${cfg.alias[nombre] ? C.brand : C.line}`,
                        borderRadius:6, fontSize:12, fontFamily:"inherit",
                        background:"transparent", color: cfg.alias[nombre] ? C.brand : C.ink,
                        outline:"none" }}/>
                    {cfg.alias[nombre] && (
                      <button onClick={() => setAlias(nombre, "")}
                        style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, padding:1, display:"flex" }}>
                        <X size={10}/>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Panel derecho: PREVIEW en vivo */}
          {(() => {
            const colsVis = cfg.cols.filter(c => c.visible);
            const lineasExp = lineasParaExportar(pedido.lineas, cfg);
            // Agrupar por categoría para la preview
            const bycat = {};
            for (const l of lineasExp) {
              const cat = l.categoria || "(sin categoría)";
              if (!bycat[cat]) bycat[cat] = [];
              bycat[cat].push(l);
            }
            const totalUds = lineasExp.reduce((s, l) => s + (Number(l.cantidad) || 0), 0);
            return (
              <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0, background:"#f8fafc" }}>
                <div style={{ padding:"8px 14px", borderBottom:`1px solid ${C.line}`, flexShrink:0,
                  display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ fontSize:10.5, fontWeight:700, color:C.sub, letterSpacing:.5 }}>PREVIEW</div>
                  <span style={{ fontSize:10.5, color:C.dim }}>— así quedará el documento</span>
                </div>
                <div style={{ flex:1, overflowY:"auto", padding:"10px 14px" }}>
                  {/* Mini cabecera del doc */}
                  <div style={{ marginBottom:10, paddingBottom:8, borderBottom:`2px solid #6366f1` }}>
                    <div style={{ fontSize:14, fontWeight:800, color:"#6366f1" }}>
                      {pedido.codigo || `PED-${pedido.id}`}
                    </div>
                    <div style={{ fontSize:11, color:C.sub }}>
                      {pedido.nombre || ""}{pedido.fecha_entrega ? ` · ${fmtFecha(pedido.fecha_entrega, formatoFecha)}` : ""}
                    </div>
                  </div>
                  {/* Tabla preview */}
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11.5 }}>
                      <thead>
                        <tr>
                          {colsVis.map((c, i) => (
                            <th key={c.key} style={{
                              padding:"5px 8px", background:"#6366f1", color:"#fff",
                              textAlign: c.key === "cantidad" ? "right" : "left",
                              fontSize:9.5, letterSpacing:.5, fontWeight:700,
                              whiteSpace:"nowrap",
                              borderRight: i < colsVis.length-1 ? "1px solid rgba(255,255,255,.2)" : "none" }}>
                              {c.label.toUpperCase()}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(bycat).map(([cat, items]) => (
                          <Fragment key={cat}>
                            <tr>
                              <td colSpan={colsVis.length} style={{
                                padding:"4px 8px", fontSize:9.5, fontWeight:700,
                                color:"#6b7280", letterSpacing:.8, textTransform:"uppercase",
                                background:"#f1f5f9", borderBottom:"1px solid #e2e8f0" }}>
                                {cat}
                              </td>
                            </tr>
                            {items.map((l, ri) => (
                              <tr key={ri} style={{ background: ri % 2 === 0 ? "#fff" : "#f8fafc" }}>
                                {colsVis.map((c, ci) => {
                                  const val = c.key === "nombre" ? l._nombreExport : (l[c.key] ?? "");
                                  const renamed = c.key === "nombre" && cfg.alias[l.nombre];
                                  return (
                                    <td key={c.key} style={{
                                      padding:"4px 8px",
                                      borderBottom:"1px solid #e2e8f0",
                                      borderRight: ci < colsVis.length-1 ? "1px solid #f1f5f9" : "none",
                                      textAlign: c.key === "cantidad" ? "right" : "left",
                                      fontWeight: c.key === "cantidad" ? 700 : 400,
                                      color: renamed ? C.brand : c.color || C.ink,
                                      maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                      {String(val)}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </Fragment>
                        ))}
                        <tr style={{ background:"#ede9fe", borderTop:"2px solid #6366f1" }}>
                          {colsVis.map((c, ci) => (
                            <td key={c.key} style={{ padding:"5px 8px", fontWeight: c.key==="cantidad" ? 800 : 700,
                              fontSize: c.key==="cantidad" ? 12 : 11,
                              textAlign: c.key==="cantidad" ? "right" : "left" }}>
                              {c.key === "nombre" ? `TOTAL — ${lineasExp.length} líneas` : c.key === "cantidad" ? totalUds : ""}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 20px",
          borderTop:`1px solid ${C.line}`, flexShrink:0, flexWrap:"wrap" }}>
          <Save size={13} color={C.dim}/>
          <input value={tplNombre} onChange={e => setTplNombre(e.target.value)}
            placeholder="Guardar como plantilla…"
            onKeyDown={e => e.key === "Enter" && guardar()}
            style={{ flex:"1 1 180px", maxWidth:260, padding:"6px 10px",
              border:`1px solid ${C.strong}`, borderRadius:8, fontSize:12.5,
              fontFamily:"inherit", background:C.s2, color:C.ink, outline:"none" }}/>
          <button onClick={guardar} disabled={!tplNombre.trim()}
            style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"6px 12px",
              borderRadius:8, border:"none", fontFamily:"inherit", fontSize:12.5, fontWeight:600, cursor: tplNombre.trim() ? "pointer" : "not-allowed",
              background: savedOk ? C.ok : tplNombre.trim() ? C.brand : C.s2,
              color: tplNombre.trim() ? "#fff" : C.dim }}>
            {savedOk ? <><Check size={13}/> ¡Guardada!</> : <><Save size={13}/> Guardar</>}
          </button>
          <div style={{ flex:1 }}/>
          <button onClick={onClose}
            style={{ padding:"8px 16px", borderRadius:999, border:`1px solid ${C.strong}`,
              background:C.s2, color:C.ink, fontWeight:600, fontSize:13.5, cursor:"pointer", fontFamily:"inherit" }}>
            Cancelar
          </button>
          <button onClick={ejecutar}
            style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"9px 20px",
              borderRadius:999, border:"none", fontFamily:"inherit", fontWeight:700, fontSize:13.5, cursor:"pointer",
              background: formato === "pdf" ? "#ef4444" : "#16a34a", color:"#fff" }}>
            {formato === "pdf" ? <FileDown size={15}/> : <FileSpreadsheet size={15}/>}
            Exportar {formato === "pdf" ? "PDF" : "Excel"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DETALLE / EDICIÓN DE PEDIDO
   ═══════════════════════════════════════════════════════════════════════════ */
// MARK: - DetallePedido
function DetallePedido({ pedido, almacenes, vehiculosEmpresa, onBack, onSave, onDelete, onCambiarVehiculo, onPlanning, onAgregarCesta, onComprobarStock, rolesImport, empresaId, formatoFecha = "DD/MM/YYYY", highlightedCategoria, sesion, materiales, pedidos, L }) {
  const [exportModal, setExportModal] = useState(null); // null | "pdf" | "excel"
  const [p, setP] = useState({ ...pedido });
  const [editando, setEditando] = useState(false);
  const [delConf, setDelConf]   = useState(false);
  const [addLinea, setAddLinea] = useState(null); // { categoria, nombre, cantidad }
  const [editLinea, setEditLinea] = useState(null); // { idx, ...linea }
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Scroll a categoría si se abre desde un link de chat con #categoria
  useEffect(() => {
    if (!highlightedCategoria) return;
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-categoria="${highlightedCategoria}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => clearTimeout(t);
  }, [highlightedCategoria]);

  const f = (k) => (v) => setP(prev => ({ ...prev, [k]: v }));

  // Agrupar líneas por almacén → por categoría
  const almTable = useMemo(() => {
    const byAlm = {};
    for (const l of (p.lineas || [])) {
      // líneas sin almacen_id caen en el almacén principal del pedido
      const aid = l.almacen_id ?? p.almacen_id ?? "__sin__";
      if (!byAlm[aid]) byAlm[aid] = {};
      const cat = l.categoria || "(sin categoría)";
      if (!byAlm[aid][cat]) byAlm[aid][cat] = [];
      byAlm[aid][cat].push(l);
    }
    // Ordenar: el almacén principal del pedido primero, luego el resto por id
    const ids = Object.keys(byAlm).sort((a, b) => {
      if (String(a) === String(p.almacen_id)) return -1;
      if (String(b) === String(p.almacen_id)) return 1;
      return String(a).localeCompare(String(b));
    });
    return ids.map(aid => ({
      almacen_id: aid,
      nombre: almacenes.find(a => String(a.id) === String(aid))?.nombre || (aid === "__sin__" ? "—" : `Almacén ${aid}`),
      cats: Object.entries(byAlm[aid])
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([categoria, items]) => ({ categoria, items })),
      total: Object.values(byAlm[aid]).flat().reduce((s, l) => s + (l.cantidad || 0), 0),
    }));
  }, [p.lineas, p.almacen_id, almacenes]);

  const multiAlm   = almTable.length > 1;
  const totalRefs  = (p.lineas || []).length;
  const totalUds   = (p.lineas || []).reduce((s, l) => s + (l.cantidad || 0), 0);
  const almNombre  = almacenes.find(a => a.id === p.almacen_id)?.nombre || p.almacen_nombre || "—";

  const guardar = () => { onSave(p); setEditando(false); };

  const eliminarLinea = (i) => setP(prev => ({ ...prev, lineas: prev.lineas.filter((_, j) => j !== i) }));

  const guardarLinea = (idx, linea) => {
    setP(prev => {
      const lineas = [...(prev.lineas || [])];
      const anterior = lineas[idx];
      const cantidadCambio = Number(linea.cantidad) !== Number(anterior.cantidad);
      const autor = sesion?.user?.email || sesion?.user?.id || "usuario";
      lineas[idx] = {
        ...anterior, ...linea,
        ...(cantidadCambio ? {
          _editado_por: autor,
          _editado_en: new Date().toISOString(),
          _cantidad_original: anterior._cantidad_original ?? anterior.cantidad,
        } : {}),
      };
      return { ...prev, lineas };
    });
    setEditLinea(null);
  };

  const confirmarAddLinea = () => {
    if (!addLinea?.nombre?.trim()) return;
    setP(prev => ({
      ...prev,
      lineas: [...(prev.lineas || []), {
        nombre: addLinea.nombre,
        categoria: addLinea.categoria || "(sin categoría)",
        cantidad: Number(addLinea.cantidad) || 1,
        unidad: "ud",
      }],
    }));
    setAddLinea(null);
  };

  const chip = CHIP_ESTADO[p.estado] || CHIP_ESTADO.reservado;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0 }}>

      {/* Toolbar */}
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 20px",
        borderBottom:`1px solid ${C.line}`, flexShrink:0, flexWrap:"wrap" }}>
        <Btn outline onClick={onBack} style={{ padding:"6px 14px", fontSize:13 }}>
          <ArrowLeft size={14}/>{L("Pedidos","Orders")}
        </Btn>
        <div style={{ flex:1 }}/>
        <span style={{ fontSize:12, color:C.sub }}>
          {totalRefs} {L("líneas","lines")} · {totalUds} {L("uds.","units")}
        </span>
        {/* Selector de vehículo principal */}
        {vehiculosEmpresa?.length > 0 && (
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            {(() => {
              const vSel = vehiculosEmpresa.find(v => String(v.id) === String(p.vehiculo_id));
              return vSel ? (
                <div style={{ width:10, height:10, borderRadius:999, background:vSel.color, flexShrink:0 }}/>
              ) : null;
            })()}
            <select
              value={p.vehiculo_id ?? ""}
              onChange={e => {
                const vid = e.target.value || null;
                const next = { ...p, vehiculo_id: vid };
                setP(next);
                onSave(next);
                onCambiarVehiculo?.(p.id, vid);
              }}
              style={{ padding:"5px 28px 5px 10px", border:`1px solid ${C.strong}`, borderRadius:999,
                fontSize:12.5, fontFamily:"inherit", background:C.s2, color:C.ink, outline:"none",
                cursor:"pointer", appearance:"auto", maxWidth:160 }}>
              <option value="">{L("Sin vehículo","No vehicle")}</option>
              {vehiculosEmpresa.map(v => (
                <option key={v.id} value={String(v.id)}>
                  {v.nombre || v.matricula || `VEH-${v.id}`}
                </option>
              ))}
            </select>
          </div>
        )}
        {/* Exportar */}
        <div style={{ display:"flex", gap:6 }}>
          <Btn outline onClick={() => setExportModal("pdf")} style={{ padding:"6px 14px", fontSize:13, gap:5 }}>
            <FileDown size={13} color="#ef4444"/>PDF
          </Btn>
          <Btn outline onClick={() => setExportModal("excel")} style={{ padding:"6px 14px", fontSize:13, gap:5 }}>
            <FileSpreadsheet size={13} color="#16a34a"/>Excel
          </Btn>
        </div>

        {!editando && (
          <Btn outline onClick={() => setEditando(true)} style={{ padding:"6px 14px", fontSize:13 }}>
            <Pencil size={13}/>{L("Editar","Edit")}
          </Btn>
        )}
        {editando && (
          <>
            <Btn outline onClick={() => { setP({ ...pedido }); setEditando(false); }} style={{ padding:"6px 14px", fontSize:13 }}>
              {L("Cancelar","Cancel")}
            </Btn>
            <Btn onClick={guardar} style={{ padding:"6px 14px", fontSize:13 }}>
              <Check size={13}/>{L("Guardar","Save")}
            </Btn>
          </>
        )}
        {p.estado !== "finalizado" && p.estado !== "cancelado" && (
          <Btn onClick={() => onPlanning?.(p)} color={C.brand} style={{ padding:"6px 14px", fontSize:13 }}>
            <ArrowRight size={13}/>{L("Pasar a Planning","Send to Planning")}
          </Btn>
        )}
        <Btn color={C.danger} onClick={() => setDelConf(true)} style={{ padding:"6px 14px", fontSize:13 }}>
          <Trash2 size={13}/>{L("Eliminar","Delete")}
        </Btn>
      </div>

      {/* Banner de conflicto de stock */}
      {!bannerDismissed && materiales && pedidos && (() => {
        const conflictos = conflictosPedido(p.id, pedidos, materiales);
        if (!conflictos.length) return null;
        return (
          <div style={{ background:"#fef2f2", borderBottom:`2px solid #fca5a5`, padding:"10px 20px",
            display:"flex", alignItems:"flex-start", gap:10, flexShrink:0 }}>
            <AlertTriangle size={18} color="#dc2626" style={{ flexShrink:0, marginTop:2 }}/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#dc2626", marginBottom:4 }}>
                Stock insuficiente para este pedido
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom: onAgregarCesta ? 8 : 0 }}>
                {conflictos.map((c, i) => (
                  <span key={i} style={{ fontSize:11.5, background:"#fee2e2", color:"#dc2626",
                    border:"1px solid #fca5a5", borderRadius:999, padding:"2px 10px", fontWeight:600 }}>
                    {c.nombre}: faltan <strong>{c.faltante}</strong> uds
                  </span>
                ))}
              </div>
              {onAgregarCesta && (
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <button onClick={() => {
                      const items = conflictos.map(c => ({
                        nombre:      c.nombre,
                        faltante:    c.faltante,
                        cantidad:    c.faltante,
                        material_id: c.material_id ?? null,
                      }));
                      onAgregarCesta(items);
                    }}
                    style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 12px",
                      borderRadius:999, border:"1.5px solid #dc2626", background:"transparent",
                      color:"#dc2626", fontWeight:700, fontSize:12, cursor:"pointer",
                      fontFamily:"inherit" }}>
                    🛒 Agregar a la cesta
                  </button>
                  <button onClick={() => onComprobarStock?.()}
                    style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 12px",
                      borderRadius:999, border:"1.5px solid #dc2626", background:"#dc2626",
                      color:"#fff", fontWeight:700, fontSize:12, cursor:"pointer",
                      fontFamily:"inherit" }}>
                    ✓ Comprobar
                  </button>
                </div>
              )}
            </div>
            <button onClick={() => setBannerDismissed(true)}
              style={{ background:"none", border:"none", cursor:"pointer", color:"#dc2626",
                padding:4, display:"flex", flexShrink:0 }}>
              <X size={16}/>
            </button>
          </div>
        );
      })()}

      {/* Cabecera del pedido */}
      <div style={{ padding:"14px 20px", background:C.brandSoft, borderBottom:`2px solid ${C.brand}`, flexShrink:0 }}>
        {editando ? (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
            <Field label="CÓDIGO"      value={p.codigo}       onChange={f("codigo")}/>
            <Field label="REFERENCIA"  value={p.referencia}   onChange={f("referencia")}/>
            <div style={{ gridColumn:"1 / -1" }}>
              <label style={{ fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.5, display:"block", marginBottom:6 }}>ESTADO</label>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {ESTADOS.map(s => {
                  const cfg = CHIP_ESTADO[s] || CHIP_ESTADO.reservado;
                  const sel = (p.estado || "reservado") === s;
                  return (
                    <button key={s} onClick={() => f("estado")(s)}
                      style={{ padding:"5px 14px", borderRadius:999, border: sel ? `2px solid ${cfg.ink}` : `2px solid transparent`,
                        background: sel ? cfg.bg : C.s2, color: sel ? cfg.ink : C.sub,
                        fontWeight: sel ? 700 : 500, fontSize:12.5, cursor:"pointer", fontFamily:"inherit",
                        textTransform:"capitalize" }}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
            <Field label="CLIENTE / NOMBRE" value={p.nombre}         onChange={f("nombre")} span/>
            <Field label="DESTINO"           value={p.destino}        onChange={f("destino")}/>
            <Field label="FECHA EXPEDICIÓN"  value={p.fecha_entrega}  onChange={f("fecha_entrega")} placeholder="YYYY-MM-DD"/>
            <Field label="FECHA RETORNO"     value={p.fecha_retorno}  onChange={f("fecha_retorno")} placeholder="YYYY-MM-DD"/>
            <Field label={L("HORA IDA","DEPARTURE TIME")}    value={p.hora_ida}    onChange={f("hora_ida")}    placeholder="HH:MM" type="time"/>
            <Field label={L("HORA VUELTA","RETURN TIME")}    value={p.hora_vuelta} onChange={f("hora_vuelta")} placeholder="HH:MM" type="time"/>
          </div>
        ) : (
          <>
            <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"baseline" }}>
              {p.codigo && <span style={{ fontSize:16, fontWeight:800, color:C.brand }}>{p.codigo}</span>}
              {p.referencia && <span style={{ fontSize:12.5, color:C.sub }}>{p.referencia}</span>}
              {p.nombre && <span style={{ fontSize:14.5, fontWeight:600, color:C.ink }}>{p.nombre}</span>}
            </div>
            {/* Estado chips — clicables para cambio rápido */}
            <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginTop:8 }}>
              {ESTADO_SEQ.map(s => {
                const cfg = CHIP_ESTADO[s];
                const sel = (p.estado || "reservado") === s;
                return (
                  <button key={s} onClick={() => { const next = { ...p, estado: s }; setP(next); onSave(next); }}
                    style={{ padding:"4px 12px", borderRadius:999,
                      border: sel ? `2px solid ${cfg.ink}` : `1.5px solid ${C.line}`,
                      background: sel ? cfg.bg : C.s2, color: sel ? cfg.ink : C.sub,
                      fontWeight: sel ? 700 : 500, fontSize:11.5, cursor:"pointer", fontFamily:"inherit",
                      textTransform:"capitalize" }}>
                    {s}
                  </button>
                );
              })}
              {/* cancelado se muestra solo si está en ese estado */}
              {p.estado === "cancelado" && (
                <span style={{ padding:"4px 12px", borderRadius:999, border:`2px solid ${CHIP_ESTADO.cancelado.ink}`,
                  background:CHIP_ESTADO.cancelado.bg, color:CHIP_ESTADO.cancelado.ink,
                  fontWeight:700, fontSize:11.5, textTransform:"capitalize" }}>cancelado</span>
              )}
            </div>
            <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginTop:6, fontSize:12.5, color:C.sub }}>
              {p.destino   && <span>📍 {p.destino}</span>}
              {p.contacto  && <span>👤 {p.contacto}</span>}
              {p.fecha_entrega && <span>📅 {L("Exp.","Disp.")}: <strong style={{ color:C.ink }}>{fmtFecha(p.fecha_entrega, formatoFecha)}</strong></span>}
              {p.hora_ida     && <span>🚚 {L("Ida","Out")}: <strong style={{ color:C.ink }}>{p.hora_ida}</strong></span>}
              {p.fecha_retorno && <span>↩ <strong style={{ color:C.ink }}>{fmtFecha(p.fecha_retorno, formatoFecha)}</strong></span>}
              {p.hora_vuelta  && <span>🏠 {L("Vuelta","Back")}: <strong style={{ color:C.ink }}>{p.hora_vuelta}</strong></span>}
              <span>🏭 <strong style={{ color:C.ink }}>{almNombre}</strong></span>
              {p.vehiculo_id && vehiculosEmpresa?.length > 0 && (() => {
                const v = vehiculosEmpresa.find(v => String(v.id) === String(p.vehiculo_id));
                return v ? (
                  <span style={{ display:"inline-flex", alignItems:"center", gap:5 }}>
                    <span style={{ width:8, height:8, borderRadius:999, background:v.color, display:"inline-block" }}/>
                    <strong style={{ color:C.ink }}>{v.nombre || v.matricula}</strong>
                  </span>
                ) : null;
              })()}
            </div>
          </>
        )}
      </div>

      {/* Tabla de materiales */}
      <div style={{ flex:1, overflowY:"auto" }}>

        {/* Cabecera sticky */}
        {(() => {
          const rolesCols = (rolesImport || []).filter(r => r.tipo === "columna");
          const gtc = `220px 1fr${rolesCols.map(() => " minmax(80px,1fr)").join("")} 80px 44px`;
          return (
            <div style={{ display:"grid", gridTemplateColumns:gtc,
              position:"sticky", top:0, zIndex:10, background:C.surface,
              borderBottom:`1px solid ${C.line}`, padding:"0 20px" }}>
              <div style={{ padding:"9px 8px", fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.6 }}>{L("CATEGORÍA","CATEGORY")}</div>
              <div style={{ padding:"9px 8px", fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.6 }}>{L("NOMBRE / DETALLES","NAME / DETAILS")}</div>
              {rolesCols.map(r => (
                <div key={r.key} style={{ padding:"9px 8px", fontSize:11, fontWeight:700, color:r.color, letterSpacing:.6 }}>
                  {r.label.toUpperCase()}
                </div>
              ))}
              <div style={{ padding:"9px 8px", fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.6, textAlign:"right" }}>{L("CANT.","QTY")}</div>
              <div/>
            </div>
          );
        })()}

        {almTable.map((alm) => (
          <React.Fragment key={alm.almacen_id}>

            {/* Separador de almacén (solo si hay más de uno) */}
            {multiAlm && (
              <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 20px 8px",
                borderTop:`2px solid ${C.brand}`, background:C.brandSoft, marginTop:4 }}>
                <Warehouse size={14} color={C.brand}/>
                <span style={{ fontSize:12, fontWeight:800, color:C.brand, letterSpacing:.8, textTransform:"uppercase" }}>
                  {alm.nombre}
                </span>
                <span style={{ fontSize:11.5, color:C.sub, marginLeft:"auto" }}>
                  {alm.total} {L("uds.","units")}
                </span>
              </div>
            )}

            {alm.cats.map((cat) => (
              <React.Fragment key={cat.categoria}>
                {/* Cabecera de categoría */}
                <div data-categoria={cat.categoria}
                  style={{ display:"flex", alignItems:"center", padding:"6px 28px",
                  background: highlightedCategoria && cat.categoria.toLowerCase() === highlightedCategoria.toLowerCase() ? "var(--brand-soft)" : C.s2,
                  borderBottom:`1px solid ${C.line}`, borderTop:`1px solid ${C.line}` }}>
                  <span style={{ flex:1, fontSize:12, fontWeight:800, color:C.brand, letterSpacing:1, textTransform:"uppercase" }}>
                    {cat.categoria}
                  </span>
                  {editando && (
                    <button onClick={() => setAddLinea({ categoria: cat.categoria, almacen_id: alm.almacen_id === "__sin__" ? undefined : alm.almacen_id, nombre:"", cantidad:1 })}
                      style={{ background:"none", border:`1px solid ${C.brand}`, borderRadius:6, padding:"2px 8px",
                        fontSize:11.5, color:C.brand, cursor:"pointer", fontFamily:"inherit",
                        display:"flex", alignItems:"center", gap:4 }}>
                      <Plus size={11}/> {L("Añadir","Add")}
                    </button>
                  )}
                </div>

                {cat.items.map((item, i) => {
                  const globalIdx = (p.lineas || []).indexOf(item);
                  // Separar roles en "descripcion" (bajo el nombre) y "columna" (columna propia)
                  const rolesDesc = (rolesImport || []).filter(r => r.tipo === "descripcion" && item[r.key]);
                  const rolesCols = (rolesImport || []).filter(r => r.tipo === "columna" && item[r.key]);
                  return (
                    <div key={i} style={{
                      display:"grid",
                      gridTemplateColumns:`220px 1fr${rolesCols.map(() => " minmax(80px,1fr)").join("")} 80px 44px`,
                      padding:"0 20px", borderBottom:`1px solid ${C.line}`, alignItems:"start",
                      background: item._editado_por ? "rgba(251,146,60,.10)" : "",
                      transition:"background .1s" }}
                      onMouseEnter={e => e.currentTarget.style.background = item._editado_por ? "rgba(251,146,60,.18)" : C.s2}
                      onMouseLeave={e => e.currentTarget.style.background = item._editado_por ? "rgba(251,146,60,.10)" : ""}>
                      <div style={{ padding:"9px 8px", fontSize:12, color:C.sub,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {item.categoria || ""}
                      </div>
                      <div style={{ padding:"9px 8px" }}>
                        <div style={{ fontSize:13.5, color:C.ink }}>{item.nombre}</div>
                        {item._editado_por && (
                          <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:3 }}>
                            <span style={{ fontSize:10.5, fontWeight:700, color:"#ea580c",
                              background:"rgba(251,146,60,.18)", borderRadius:4, padding:"1px 6px" }}>
                              ✏ {item._editado_por.split('@')[0]}
                              {item._cantidad_original != null && ` · antes: ${item._cantidad_original}`}
                            </span>
                          </div>
                        )}
                        {rolesDesc.length > 0 && (
                          <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginTop:3 }}>
                            {rolesDesc.map(r => (
                              <span key={r.key} style={{ fontSize:11, color:r.color, fontWeight:500 }}>
                                {r.label}: <strong>{item[r.key]}</strong>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {rolesCols.map(r => (
                        <div key={r.key} style={{ padding:"9px 8px", fontSize:12.5, color:r.color,
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {item[r.key] || ""}
                        </div>
                      ))}
                      <div style={{ padding:"9px 8px", fontSize:13.5, fontWeight:700, textAlign:"right",
                        color: item._editado_por ? "#ea580c" : C.ink }}>{item.cantidad}</div>
                      {editando && (
                        <div style={{ display:"flex", gap:2, padding:"9px 4px" }}>
                          <button onClick={() => setEditLinea({ idx: globalIdx, ...item })}
                            style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, padding:4, borderRadius:6, display:"flex" }}>
                            <Pencil size={13}/>
                          </button>
                          <button onClick={() => eliminarLinea(globalIdx)}
                            style={{ background:"none", border:"none", cursor:"pointer", color:C.danger, padding:4, borderRadius:6, display:"flex" }}>
                            <Trash2 size={13}/>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}

            {/* Subtotal por almacén (solo si hay más de uno) */}
            {multiAlm && (() => {
              const rolesCols = (rolesImport || []).filter(r => r.tipo === "columna");
              const gtcSub = `220px 1fr${rolesCols.map(() => " minmax(80px,1fr)").join("")} 80px 44px`;
              const colSpanNombre = 2 + rolesCols.length;
              return (
                <div style={{ display:"grid", gridTemplateColumns:gtcSub,
                  padding:"0 20px", borderTop:`1px solid ${C.line}`, background:C.brandSoft }}>
                  <div style={{ padding:"7px 8px", fontSize:11.5, fontWeight:700, color:C.brand, gridColumn:`1/${colSpanNombre + 1}` }}>
                    {alm.nombre} — {alm.cats.reduce((s, c) => s + c.items.length, 0)} {L("líneas","lines")}
                  </div>
                  <div style={{ padding:"7px 8px", fontSize:13, fontWeight:800, textAlign:"right", color:C.brand }}>
                    {alm.total}
                  </div>
                  <div/>
                </div>
              );
            })()}
          </React.Fragment>
        ))}

        {/* Botón añadir material (sin almacén específico) */}
        {editando && (
          <div style={{ padding:"12px 20px" }}>
            <button onClick={() => setAddLinea({ categoria:"", nombre:"", cantidad:1 })}
              style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"7px 14px",
                border:`1.5px dashed ${C.brand}`, borderRadius:9, background:"transparent",
                color:C.brand, cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600 }}>
              <Plus size={14}/> {L("Añadir material","Add material")}
            </button>
          </div>
        )}

        {/* Total global */}
        {(() => {
          const rolesCols = (rolesImport || []).filter(r => r.tipo === "columna");
          const gtcTotal = `220px 1fr${rolesCols.map(() => " minmax(80px,1fr)").join("")} 80px 44px`;
          const colSpanNombre = 2 + rolesCols.length;
          return (
            <div style={{ display:"grid", gridTemplateColumns:gtcTotal,
              padding:"0 20px", borderTop:`2px solid ${C.strong}`, background:C.surface, position:"sticky", bottom:0 }}>
              <div style={{ padding:"11px 8px", fontSize:12, fontWeight:700, color:C.ink, gridColumn:`1/${colSpanNombre + 1}` }}>
                TOTAL — {totalRefs} {L("líneas","lines")}
                {multiAlm && <span style={{ fontWeight:400, color:C.sub, marginLeft:8 }}>({almTable.length} {L("almacenes","warehouses")})</span>}
              </div>
              <div style={{ padding:"11px 8px", fontSize:14, fontWeight:800, textAlign:"right", color:C.brand }}>
                {totalUds}
              </div>
              <div/>
            </div>
          );
        })()}
      </div>

      {/* Modal exportación */}
      {exportModal && (
        <ExportConfigurador
          pedido={p}
          almacenes={almacenes}
          empresaId={empresaId}
          rolesImport={rolesImport}
          formato={exportModal}
          onClose={() => setExportModal(null)}
        />
      )}

      {/* Modal añadir/editar línea */}
      {(addLinea || editLinea) && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:500, display:"grid", placeItems:"center" }}
          onClick={() => { setAddLinea(null); setEditLinea(null); }}>
          <div style={{ background:C.surface, borderRadius:14, padding:22, width:"100%", maxWidth:380, boxShadow:"var(--shadow-lg)" }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom:14, fontSize:16 }}>
              {addLinea ? L("Añadir material","Add material") : L("Editar material","Edit material")}
            </h3>
            <div style={{ display:"grid", gap:12 }}>
              <Field label="CATEGORÍA" value={(addLinea || editLinea)?.categoria}
                onChange={v => addLinea ? setAddLinea(p => ({ ...p, categoria:v })) : setEditLinea(p => ({ ...p, categoria:v }))}/>
              <Field label="NOMBRE" value={(addLinea || editLinea)?.nombre}
                onChange={v => addLinea ? setAddLinea(p => ({ ...p, nombre:v })) : setEditLinea(p => ({ ...p, nombre:v }))}/>
              <Field label="CANTIDAD" type="number" value={(addLinea || editLinea)?.cantidad}
                onChange={v => addLinea ? setAddLinea(p => ({ ...p, cantidad:v })) : setEditLinea(p => ({ ...p, cantidad:v }))}/>
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:18 }}>
              <Btn outline onClick={() => { setAddLinea(null); setEditLinea(null); }}>{L("Cancelar","Cancel")}</Btn>
              <Btn onClick={() => {
                if (addLinea) confirmarAddLinea();
                else { guardarLinea(editLinea.idx, editLinea); }
              }}>
                <Check size={14}/>{L("Guardar","Save")}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar borrar pedido */}
      {delConf && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:500, display:"grid", placeItems:"center" }}
          onClick={() => setDelConf(false)}>
          <div style={{ background:C.surface, borderRadius:14, padding:24, maxWidth:340, width:"100%", margin:16, boxShadow:"var(--shadow-lg)" }}
            onClick={e => e.stopPropagation()}>
            <AlertTriangle size={28} color={C.danger} style={{ marginBottom:10 }}/>
            <h3 style={{ marginBottom:8 }}>{L("¿Eliminar pedido?","Delete order?")}</h3>
            <p style={{ color:C.sub, fontSize:13.5, marginBottom:20 }}>{L("Esta acción no se puede deshacer.","This action cannot be undone.")}</p>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <Btn outline onClick={() => setDelConf(false)}>{L("Cancelar","Cancel")}</Btn>
              <Btn color={C.danger} onClick={onDelete}>{L("Eliminar","Delete")}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL NOTIFICACIONES
   ═══════════════════════════════════════════════════════════════════════════ */
// MARK: - ModalNotificaciones
function ModalNotificaciones({ pedido, companyId, onClose }) {
  const [miembros,     setMiembros]     = useState([]);
  const [cargando,     setCargando]     = useState(true);
  const [seleccionados,setSeleccionados]= useState({});   // { email: true/false }
  const [externos,     setExternos]     = useState("");   // emails externos separados por coma
  const [enviando,     setEnviando]     = useState(false);
  const [enviado,      setEnviado]      = useState(false);

  useEffect(() => {
    cargarMiembrosEmpresa(companyId).then(lista => {
      setMiembros(lista);
      // Seleccionar todos por defecto
      const ini = {};
      lista.forEach(m => { ini[m.email] = true; });
      setSeleccionados(ini);
      setCargando(false);
    });
  }, [companyId]);

  const toggleMiembro = (email) =>
    setSeleccionados(p => ({ ...p, [email]: !p[email] }));

  const destinatarios = [
    ...miembros.filter(m => seleccionados[m.email]).map(m => m.email),
    ...externos.split(",").map(e => e.trim()).filter(e => e.includes("@")),
  ];

  const enviar = async () => {
    if (!destinatarios.length) { onClose(); return; }
    setEnviando(true);
    await enviarNotificacionPedido(pedido, destinatarios);
    setEnviando(false);
    setEnviado(true);
    setTimeout(onClose, 1200);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", zIndex:700,
      display:"grid", placeItems:"center", padding:16 }}>
      <div style={{ background:C.surface, borderRadius:16, width:"100%", maxWidth:480,
        boxShadow:"var(--shadow-lg)", display:"flex", flexDirection:"column" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.line}`,
          display:"flex", alignItems:"center", gap:10 }}>
          <Bell size={18} color={C.brand}/>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:15 }}>Notificar pedido</div>
            <div style={{ fontSize:12, color:C.sub, marginTop:1 }}>
              {pedido.codigo || `PED-${pedido.id}`} · {pedido.nombre || ""}
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, display:"flex" }}>
            <X size={18}/>
          </button>
        </div>

        {/* Cuerpo */}
        <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:14 }}>

          {/* Miembros de la empresa */}
          <div>
            <div style={{ fontSize:11.5, fontWeight:700, color:C.sub, letterSpacing:.5, marginBottom:8 }}>
              MIEMBROS DE LA ORGANIZACIÓN
            </div>
            {cargando ? (
              <div style={{ display:"flex", alignItems:"center", gap:8, color:C.sub, fontSize:13 }}>
                <Loader size={14} className="spin"/> Cargando…
              </div>
            ) : miembros.length === 0 ? (
              <div style={{ fontSize:13, color:C.dim }}>Sin miembros encontrados.</div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {miembros.map(m => (
                  <label key={m.email} style={{ display:"flex", alignItems:"center", gap:10,
                    padding:"8px 12px", borderRadius:10, cursor:"pointer",
                    background: seleccionados[m.email] ? C.brandSoft : C.s2,
                    border: `1px solid ${seleccionados[m.email] ? C.brand + "44" : C.line}`,
                    transition:"background .12s" }}>
                    <input type="checkbox" checked={!!seleccionados[m.email]}
                      onChange={() => toggleMiembro(m.email)}
                      style={{ width:15, height:15, accentColor:C.brand, cursor:"pointer" }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13.5, fontWeight:600, color:C.ink,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {m.email}
                      </div>
                    </div>
                    {seleccionados[m.email] && <Check size={14} color={C.brand}/>}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Externos */}
          <div>
            <div style={{ fontSize:11.5, fontWeight:700, color:C.sub, letterSpacing:.5, marginBottom:6 }}>
              EMAILS EXTERNOS (separados por coma)
            </div>
            <input
              value={externos}
              onChange={e => setExternos(e.target.value)}
              placeholder="cliente@empresa.com, proveedor@ejemplo.com…"
              style={{ width:"100%", padding:"9px 12px", border:`1px solid ${C.strong}`,
                borderRadius:10, fontSize:13.5, fontFamily:"inherit",
                background:C.s2, color:C.ink, outline:"none",
                boxSizing:"border-box" }}
            />
          </div>

          {/* Resumen destinatarios */}
          {destinatarios.length > 0 && (
            <div style={{ fontSize:12, color:C.sub, background:C.s2, borderRadius:8,
              padding:"8px 12px", lineHeight:1.6 }}>
              Se notificará a {destinatarios.length} {destinatarios.length === 1 ? "persona" : "personas"}:
              {" "}<span style={{ color:C.ink }}>{destinatarios.join(", ")}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:"12px 20px", borderTop:`1px solid ${C.line}`,
          display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onClose}
            style={{ padding:"8px 16px", borderRadius:999, border:`1px solid ${C.strong}`,
              background:"none", color:C.sub, fontWeight:600, fontSize:13.5,
              cursor:"pointer", fontFamily:"inherit",
              display:"flex", alignItems:"center", gap:6 }}>
            <BellOff size={14}/> No notificar
          </button>
          <button onClick={enviar} disabled={enviando || enviado}
            style={{ padding:"8px 18px", borderRadius:999, border:"none",
              background: enviado ? C.ok : C.brand, color:"#fff",
              fontWeight:700, fontSize:13.5, cursor:"pointer", fontFamily:"inherit",
              display:"flex", alignItems:"center", gap:6,
              opacity: (enviando || enviado) ? 0.85 : 1 }}>
            {enviado
              ? <><Check size={14}/> Enviado</>
              : enviando
              ? <><Loader size={14} className="spin"/> Enviando…</>
              : <><Bell size={14}/> Enviar notificación</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */
// MARK: - TabPedidos [export default]
export default function TabPedidos({ almacenes, empresa, modo, pedidos, setPedidos, materiales, setMateriales, vehiculosEmpresa, setTramos, rolesImport = [], formatoFecha = "DD/MM/YYYY", sesion, onRegistrarVisto, onPlanning, onNotificarStock, onAgregarCesta, guardarPlantillaConf, cargarPlantillasConf, highlightedPedidoId, highlightedCategoria, puedeEditar }) {
  const L = useL();
  const fileRef = useRef(null);

  const [importingAlm, setImportingAlm] = useState(null);
  const [parsed,       setParsed]       = useState(null);
  const [expForm,      setExpForm]       = useState({});
  const [wizardTab,    setWizardTab]     = useState("exp");
  const [saving,       setSaving]        = useState(false);
  const [errMsg,       setErrMsg]        = useState(null);
  const [pedidoSel,    setPedidoSel]     = useState(null);
  // "nuevo" | "adjuntar" | null (sin decidir aún)
  const [modoImport,   setModoImport]   = useState(null);
  // id del pedido al que adjuntar (si modoImport === "adjuntar")
  const [adjuntarA,    setAdjuntarA]    = useState(null);
  // { file, almacen } — cuando está abierto el ExcelConfigurador
  const [configurador, setConfigurador] = useState(null);
  // { pedido } — modal de notificaciones post-confirmación
  const [notifModal,   setNotifModal]   = useState(null);

  // Auto-abrir pedido cuando llega desde un link de chat
  useEffect(() => {
    if (!highlightedPedidoId || !pedidos) return;
    const p = pedidos.find(p => p.id === highlightedPedidoId);
    if (p) { setPedidoSel(p); onRegistrarVisto?.(p.id); }
  }, [highlightedPedidoId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Auto-crear materiales en almacén desde pedido ─────────────────────── */
  const autoCrearMateriales = (lineas, almacenId) => {
    if (!setMateriales) return 0;
    const nuevos = [];
    for (const l of (lineas || [])) {
      const nom = (l.nombre || "").toLowerCase().trim();
      if (!nom) continue;
      const existe = (materiales || []).some(m =>
        (m.nombre || "").toLowerCase().trim() === nom && m.almacen_id === almacenId
      );
      if (!existe) {
        nuevos.push({
          id: `m_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
          emp: empresa?.id,
          nombre: l.nombre,
          categoria: l.categoria || null,
          almacen_id: almacenId,
          stock_actual: 0, stock_minimo: 0,
          unidad: "ud", estado: "activo",
          referencia: null, descripcion: null,
          ubicacion: null, proveedor: null, precio_coste: null, notas: null,
        });
      }
    }
    if (nuevos.length) setMateriales(p => [...p, ...nuevos]);
    return nuevos.length;
  };

  /* ── Trigger file input ────────────────────────────────────────────────── */
  const triggerImport = (alm) => {
    setImportingAlm(alm);
    setErrMsg(null);
    fileRef.current.value = "";
    fileRef.current.click();
  };

  /* ── Parse file → abrir configurador ───────────────────────────────────── */
  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !importingAlm) return;
    setConfigurador({ file, almacen: importingAlm });
    setImportingAlm(null);
  };

  /* ── Resultado del configurador ─────────────────────────────────────────── */
  // Convierte fecha del Excel (en el formato configurado por la empresa) a YYYY-MM-DD
  const normFechaInput = (s) => {
    if (!s) return s;
    const str = String(s).trim();
    // Si ya viene como YYYY-MM-DD, dejarlo
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const m = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
    if (!m) return str;
    const [, p1, p2, p3] = m;
    const y = p3.length === 2 ? "20" + p3 : p3;
    // MM/DD/YYYY → p1=mes, p2=dia
    if (formatoFecha === "MM/DD/YYYY") {
      return `${y}-${p1.padStart(2,"0")}-${p2.padStart(2,"0")}`;
    }
    // DD/MM/YYYY y DD-MM-YYYY (por defecto) → p1=dia, p2=mes
    return `${y}-${p2.padStart(2,"0")}-${p1.padStart(2,"0")}`;
  };

  const onConfiguradorConfirm = ({ expedicion, materiales }) => {
    setParsed({ expedicion, materiales, almacen: configurador.almacen });
    setExpForm({
      ...expedicion,
      fecha_entrega: normFechaInput(expedicion.fecha_entrega),
      fecha_retorno: normFechaInput(expedicion.fecha_retorno),
      fecha_carga:   normFechaInput(expedicion.fecha_carga),
    });
    setWizardTab("exp");
    setModoImport(null);
    setAdjuntarA(null);
    setConfigurador(null);
    setErrMsg(null);
  };

  const updateMaterial = (idx, field, value) =>
    setParsed(p => ({ ...p, materiales: p.materiales.map((m, i) => i === idx ? { ...m, [field]: value } : m) }));

  /* ── Confirmar importación ──────────────────────────────────────────────── */
  const confirmar = async () => {
    if (!parsed) return;
    setSaving(true);

    const nuevasLineas = parsed.materiales.map(m => {
      const linea = {
        almacen_id:      parsed.almacen.id,
        timing:          m.timing,
        categoria:       m.categoria,
        nombre:          m.nombre_custom || m.nombre,
        nombre_original: m.nombre,
        cantidad:        m.cantidad,
      };
      // Copiar todos los campos de roles opcionales dinámicamente
      for (const rol of (rolesImport || [])) {
        if (m[rol.key] !== undefined && m[rol.key] !== "") linea[rol.key] = m[rol.key];
      }
      return linea;
    });

    // ── Adjuntar a pedido existente ──────────────────────────────────────
    if (modoImport === "adjuntar" && adjuntarA) {
      const pedidoBase = pedidos.find(p => p.id === adjuntarA);
      if (!pedidoBase) { setErrMsg("Pedido no encontrado."); setSaving(false); return; }
      const pedidoActualizado = {
        ...pedidoBase,
        lineas: [...(pedidoBase.lineas || []), ...nuevasLineas],
      };
      if (modo !== "demo") {
        try {
          const guardado = await guardarPedido(pedidoActualizado, empresa?.id);
          setPedidos(p => p.map(x => x.id === guardado.id ? guardado : x));
          autoCrearMateriales(nuevasLineas, parsed.almacen.id);
          setSaving(false);
          setParsed(null);
          setPedidoSel(guardado);
        } catch (err) { setErrMsg(`Error guardando: ${err.message}`); setSaving(false); }
      } else {
        setPedidos(p => p.map(x => x.id === pedidoBase.id ? pedidoActualizado : x));
        autoCrearMateriales(nuevasLineas, parsed.almacen.id);
        setSaving(false);
        setParsed(null);
        setPedidoSel(pedidoActualizado);
      }
      return;
    }

    // ── Pedido nuevo ─────────────────────────────────────────────────────
    // Reutiliza normFechaInput (definida arriba) que ya respeta formatoFecha
    const normFecha = normFechaInput;
    const vehiculoDefault = vehiculosEmpresa?.[0] ?? null;
    const pedido = {
      ...expForm,
      codigo:         expForm.codigo?.trim() || siguienteCodigo(pedidos),
      fecha_entrega:  normFecha(expForm.fecha_entrega),
      fecha_retorno:  normFecha(expForm.fecha_retorno),
      almacen_id:     parsed.almacen.id,
      almacen_nombre: parsed.almacen.nombre,
      estado:         "reservado",
      fecha_pedido:   new Date().toISOString().slice(0, 10),
      vehiculo_id:    vehiculoDefault ? String(vehiculoDefault.id) : null,
      lineas:         nuevasLineas,
      creado_por_id:     sesion?.user?.id ?? null,
      creado_por_nombre: sesion?.user?.email ? sesion.user.email.split("@")[0].split(".")[0] : null,
      vistos_por:        [],
    };
    let nuevo;
    if (modo === "demo") {
      nuevo = { ...pedido, id: Date.now(), emp: empresa?.id, _tipo:"pedido" };
      setPedidos(p => [nuevo, ...p]);
    } else {
      try {
        nuevo = await guardarPedido(pedido, empresa?.id);
        setPedidos(p => [nuevo, ...p]);
      } catch (err) {
        setErrMsg(`Error guardando: ${err.message}`);
        setSaving(false);
        return;
      }
    }
    autoCrearMateriales(pedido.lineas, pedido.almacen_id);
    setSaving(false);
    setParsed(null);
    setPedidoSel(nuevo);
    // Abrir modal de notificaciones solo en modo supabase
    if (modo === "supabase" && empresa?.id) {
      setNotifModal({ pedido: nuevo, companyId: empresa.id });
    }
  };

  /* ── Guardar cambios de pedido existente ─────────────────────────────── */
  const guardarPedidoEdit = (p) => {
    const normF = (s) => {
      if (!s) return s;
      const m = String(s).trim().match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
      if (!m) return s;
      const [, d, mo, y] = m;
      return `${y.length === 2 ? "20" + y : y}-${mo.padStart(2,"0")}-${d.padStart(2,"0")}`;
    };
    const pNorm = { ...p, fecha_entrega: normF(p.fecha_entrega), fecha_retorno: normF(p.fecha_retorno) };
    setPedidos(prev => prev.map(x => x.id === pNorm.id ? pNorm : x));
    setPedidoSel(pNorm);
    // Notificar solo si hay líneas de material (reserva de stock)
    if (onNotificarStock && (pNorm.lineas || []).length > 0) {
      onNotificarStock(pNorm, materiales, "pedido");
    }
  };

  /* ── Cambiar vehículo asignado → propagar a tramos de expediciones ──── */
  const cambiarVehiculoPedido = (pedidoId, nuevoVehId) => {
    if (!setTramos) return;
    setTramos(prev => prev.map(t =>
      String(t.pedido_id) === String(pedidoId)
        ? { ...t, vehiculo_id: nuevoVehId }
        : t
    ));
  };

  /* ── Eliminar pedido ─────────────────────────────────────────────────── */
  const eliminarPedido = async () => {
    if (!pedidoSel) return;
    if (modo !== "demo") {
      try { await borrarPedido(pedidoSel.id); } catch (e) { console.error(e); return; }
    }
    setPedidos(prev => prev.filter(p => p.id !== pedidoSel.id));
    setPedidoSel(null);
  };

  /* ── Agrupar materiales para el wizard ──────────────────────────────── */
  const grouped = useMemo(() => {
    if (!parsed?.materiales) return [];
    const out = [];
    let lastTiming = null, lastCat = null;
    parsed.materiales.forEach((m, idx) => {
      if (m.timing !== lastTiming) { lastTiming = m.timing; out.push({ type:"timing", label:m.timing }); lastCat = null; }
      if (m.categoria !== lastCat) { lastCat = m.categoria; out.push({ type:"categoria", label:m.categoria }); }
      out.push({ type:"item", item:m, idx });
    });
    return out;
  }, [parsed?.materiales]);

  const nMat          = parsed?.materiales.length ?? 0;
  const nConNombreAlt = parsed?.materiales.filter(m => m.nombre_custom).length ?? 0;

  /* ── Vista detalle ──────────────────────────────────────────────────── */
  if (pedidoSel) {
    return (
      <DetallePedido
        pedido={pedidoSel}
        almacenes={almacenes}
        vehiculosEmpresa={vehiculosEmpresa || []}
        onBack={() => setPedidoSel(null)}
        onSave={guardarPedidoEdit}
        onDelete={eliminarPedido}
        onCambiarVehiculo={cambiarVehiculoPedido}
        onPlanning={onPlanning}
        onAgregarCesta={onAgregarCesta}
        onComprobarStock={modo === "supabase" && setMateriales ? async () => {
          try { const mats = await recargarMateriales(); setMateriales(mats); } catch (e) { console.warn("recargarMateriales:", e); }
        } : undefined}
        rolesImport={rolesImport}
        empresaId={empresa?.id}
        formatoFecha={formatoFecha}
        highlightedCategoria={highlightedCategoria}
        sesion={sesion}
        materiales={materiales}
        pedidos={pedidos}
        L={L}/>
    );
  }

  /* ── Vista lista + wizard de importación ────────────────────────────── */
  return (
    <div style={{ height:"100%", minHeight:0, display:"flex", flexDirection:"column" }}>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.ods,.csv" style={{ display:"none" }} onChange={onFileChange}/>

      <ListaPedidos
        pedidos={pedidos || []}
        almacenes={almacenes}
        vehiculosEmpresa={vehiculosEmpresa || []}
        onSelect={p => { setPedidoSel(p); onRegistrarVisto?.(p.id); }}
        onImport={triggerImport}
        formatoFecha={formatoFecha}
        highlightedPedidoId={highlightedPedidoId}
        L={L}/>

      {errMsg && (
        <div style={{ margin:"0 20px 12px", padding:"10px 14px", borderRadius:10,
          background:C.dangerSoft, color:C.danger, fontSize:13, display:"flex", gap:8 }}>
          <AlertTriangle size={16}/>{errMsg}
        </div>
      )}

      {/* ExcelConfigurador */}
      {configurador && (
        <ExcelConfigurador
          file={configurador.file}
          almacen={configurador.almacen}
          empresaId={empresa?.id}
          onConfirm={onConfiguradorConfirm}
          onCancel={() => setConfigurador(null)}
          rolesImport={rolesImport}
          guardarPlantillaConf={guardarPlantillaConf}
          cargarPlantillasConf={cargarPlantillasConf}
        />
      )}

      {/* BLOQUE OBSOLETO — placeholder para mantener estructura JSX */}
      {false && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:500,
          display:"grid", placeItems:"center", padding:16 }}
          onClick={() => { setErrMsg(null); }}>
          <div style={{ background:C.surface, borderRadius:18, width:"100%", maxWidth:960,
            maxHeight:"92vh", display:"flex", flexDirection:"column", boxShadow:"var(--shadow-lg)" }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start",
              padding:"16px 22px", borderBottom:`1px solid ${C.line}`, flexShrink:0 }}>
              <div>
                <div style={{ fontSize:16, fontWeight:700 }}>
                  {L("Seleccionar columnas","Select columns")} — <span style={{ color:C.brand }}>{colStep.almacen.nombre}</span>
                </div>
                <div style={{ fontSize:12.5, color:C.sub, marginTop:3 }}>
                  {L("Haz clic en la cabecera de cada columna para asignar su rol.","Click a column header to assign its role.")}
                </div>
              </div>
              <button onClick={() => { setColStep(null); setErrMsg(null); }}
                style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, padding:4 }}>
                <X size={18}/>
              </button>
            </div>

            {/* Leyenda de roles */}
            <div style={{ display:"flex", gap:10, padding:"10px 22px", borderBottom:`1px solid ${C.line}`,
              flexShrink:0, flexWrap:"wrap", alignItems:"center" }}>
              {[
                { key:"colNombre",    label:L("Nombre","Name"),         color:"#3b82f6", req:true  },
                { key:"colCantidad",  label:L("Cantidad","Qty"),        color:"#16a34a", req:true  },
                { key:"colGrupo",     label:L("Grupo","Group"),         color:"#f59e0b", req:false },
                { key:"colCategoria", label:L("Categoría","Category"),  color:"#8b5cf6", req:false },
              ].map(({ key, label, color, req }) => {
                const asignado = colStep.columnas.find(c => c.idx === colStep.colMapping[key]);
                return (
                  <div key={key} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12.5 }}>
                    <div style={{ width:10, height:10, borderRadius:3, background:color, flexShrink:0 }}/>
                    <span style={{ fontWeight:600, color }}>{label}</span>
                    {req && <span style={{ color:C.danger, fontSize:10 }}>*</span>}
                    {asignado
                      ? <span style={{ color:C.ink }}>→ <strong>{asignado.label || `Col ${asignado.idx}`}</strong></span>
                      : <span style={{ color:C.dim }}>{L("sin asignar","unassigned")}</span>}
                    {asignado && (
                      <button onClick={() => setColStep(p => ({ ...p, colMapping: { ...p.colMapping, [key]: -1 } }))}
                        style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, padding:0, display:"flex" }}>
                        <X size={11}/>
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Separador */}
              <div style={{ width:1, height:20, background:C.line, margin:"0 4px" }}/>

              {/* Separador decimal */}
              <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12.5 }}>
                <span style={{ color:C.sub, fontWeight:600 }}>{L("Decimal","Decimal")}</span>
                {[{ val:",", label:"1.000,50 (coma)" }, { val:".", label:"1,000.50 (punto)" }].map(({ val, label }) => (
                  <button key={val} onClick={() => setColStep(p => ({ ...p, decimalSep: val }))}
                    style={{ padding:"3px 10px", borderRadius:6, border:`1.5px solid ${colStep.decimalSep === val ? C.brand : C.strong}`,
                      background: colStep.decimalSep === val ? C.brandSoft : "transparent",
                      color: colStep.decimalSep === val ? C.brand : C.sub,
                      fontWeight: colStep.decimalSep === val ? 700 : 400,
                      cursor:"pointer", fontFamily:"inherit", fontSize:12 }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tabla preview — cabecera clicable */}
            <div style={{ flex:1, overflowY:"auto", overflowX:"auto" }}>
              <table style={{ borderCollapse:"collapse", fontSize:12.5, width:"100%", tableLayout:"auto" }}>
                <thead>
                  <tr>
                    {colStep.columnas.map(({ idx, label }) => {
                      // Determinar si esta columna tiene un rol asignado
                      const roles = [
                        { key:"colNombre",    color:"#3b82f6", short:L("NOM","NAM") },
                        { key:"colCantidad",  color:"#16a34a", short:L("CANT","QTY") },
                        { key:"colGrupo",     color:"#f59e0b", short:L("GRP","GRP") },
                        { key:"colCategoria", color:"#8b5cf6", short:L("CAT","CAT") },
                      ];
                      const rolActivo = roles.find(r => colStep.colMapping[r.key] === idx);
                      return (
                        <th key={idx}
                          onClick={() => {
                            // Ciclar: sin rol → Nombre → Cantidad → Grupo → Categoría → sin rol
                            const orden = ["colNombre","colCantidad","colGrupo","colCategoria"];
                            const actual = roles.find(r => colStep.colMapping[r.key] === idx);
                            if (actual) {
                              // quitar el rol actual
                              setColStep(p => ({ ...p, colMapping: { ...p.colMapping, [actual.key]: -1 } }));
                            } else {
                              // asignar al primer rol libre en orden
                              const libre = orden.find(k => colStep.colMapping[k] < 0);
                              if (libre) setColStep(p => ({ ...p, colMapping: { ...p.colMapping, [libre]: idx } }));
                            }
                          }}
                          style={{
                            padding:"8px 10px", textAlign:"left", cursor:"pointer", userSelect:"none",
                            whiteSpace:"nowrap", position:"sticky", top:0, zIndex:5,
                            background: rolActivo ? rolActivo.color : C.s2,
                            color: rolActivo ? "#fff" : C.ink,
                            borderBottom:`2px solid ${rolActivo ? rolActivo.color : C.strong}`,
                            borderRight:`1px solid ${C.line}`,
                            fontSize:11, fontWeight:700, letterSpacing:.4,
                          }}>
                          {rolActivo && <span style={{ marginRight:4, fontSize:9, background:"rgba(255,255,255,.25)", borderRadius:3, padding:"1px 4px" }}>{rolActivo.short}</span>}
                          {label || `(${idx})`}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {colStep.previewRows.map((row, ri) => (
                    <tr key={ri} style={{ borderBottom:`1px solid ${C.line}` }}
                      onMouseEnter={e => e.currentTarget.style.background = C.s2}
                      onMouseLeave={e => e.currentTarget.style.background = ""}>
                      {colStep.columnas.map(({ idx }, ci) => {
                        const roles = [
                          { key:"colNombre",    color:"#3b82f6" },
                          { key:"colCantidad",  color:"#16a34a" },
                          { key:"colGrupo",     color:"#f59e0b" },
                          { key:"colCategoria", color:"#8b5cf6" },
                        ];
                        const rolActivo = roles.find(r => colStep.colMapping[r.key] === idx);
                        return (
                          <td key={ci} style={{
                            padding:"6px 10px", borderRight:`1px solid ${C.line}`,
                            background: rolActivo ? `${rolActivo.color}18` : "transparent",
                            color: rolActivo ? rolActivo.color : C.ink, fontWeight: rolActivo ? 600 : 400,
                            maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                          }}>
                            {row[ci] || ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
              padding:"14px 22px", borderTop:`1px solid ${C.line}`, flexShrink:0, gap:10 }}>
              {errMsg && (
                <div style={{ fontSize:12.5, color:C.danger, display:"flex", alignItems:"center", gap:6 }}>
                  <AlertTriangle size={14}/>{errMsg}
                </div>
              )}
              {!errMsg && (
                <div style={{ fontSize:12, color:C.sub }}>
                  {L("* Nombre y Cantidad son obligatorios. Haz clic en las cabeceras para asignar.",
                     "* Name and Quantity are required. Click headers to assign.")}
                </div>
              )}
              <div style={{ display:"flex", gap:10, flexShrink:0 }}>
                <Btn outline onClick={() => { setColStep(null); setErrMsg(null); }}>{L("Cancelar","Cancel")}</Btn>
                <Btn onClick={confirmarColumnas}
                  disabled={colStep.colMapping.colNombre < 0 || colStep.colMapping.colCantidad < 0}>
                  <Check size={14}/>{L("Continuar","Continue")}
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Wizard modal de importación */}
      {parsed && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:500,
          display:"grid", placeItems:"center", padding:16 }}>
          <div style={{ background:C.surface, borderRadius:18, width:"100%", maxWidth:820,
            maxHeight:"92vh", display:"flex", flexDirection:"column", boxShadow:"var(--shadow-lg)" }}
            onClick={e => e.stopPropagation()}>

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start",
              padding:"16px 22px", borderBottom:`1px solid ${C.line}`, flexShrink:0 }}>
              <div>
                <div style={{ fontSize:16, fontWeight:700 }}>
                  {L("Importar materiales","Import materials")} — <span style={{ color:C.brand }}>{parsed.almacen.nombre}</span>
                </div>
                <div style={{ fontSize:12.5, color:C.sub, marginTop:3 }}>
                  {nMat} {L("materiales detectados","materials detected")}
                  {nConNombreAlt > 0 && ` · ${nConNombreAlt} ${L("con nombre alternativo","with alt name")}`}
                </div>
              </div>
              <button onClick={() => { setParsed(null); setModoImport(null); setAdjuntarA(null); }} style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, padding:4 }}>
                <X size={18}/>
              </button>
            </div>

            {/* Paso 0: ¿Pedido nuevo o adjuntar? */}
            {modoImport === null ? (
              <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", padding:"28px 32px", gap:16 }}>
                <p style={{ fontSize:14, color:C.sub, marginBottom:6 }}>
                  {L("¿Qué quieres hacer con estos materiales?","What do you want to do with these materials?")}
                </p>
                <button onClick={() => setModoImport("nuevo")}
                  style={{ padding:"16px 20px", borderRadius:12, border:`1.5px solid ${C.brand}`,
                    background:C.brandSoft, color:C.brand, cursor:"pointer", fontFamily:"inherit",
                    fontSize:14, fontWeight:600, textAlign:"left", display:"flex", alignItems:"center", gap:12 }}>
                  <Plus size={18}/>
                  <div>
                    <div>{L("Crear pedido nuevo","Create new order")}</div>
                    <div style={{ fontSize:12, fontWeight:400, color:C.sub, marginTop:2 }}>
                      {L("Se crea un pedido independiente para este almacén.","Creates a standalone order for this warehouse.")}
                    </div>
                  </div>
                </button>
                {pedidos.length > 0 && (
                  <button onClick={() => setModoImport("adjuntar")}
                    style={{ padding:"16px 20px", borderRadius:12, border:`1.5px solid ${C.strong}`,
                      background:C.s2, color:C.ink, cursor:"pointer", fontFamily:"inherit",
                      fontSize:14, fontWeight:600, textAlign:"left", display:"flex", alignItems:"center", gap:12 }}>
                    <FileSpreadsheet size={18}/>
                    <div>
                      <div>{L("Adjuntar a pedido existente","Attach to existing order")}</div>
                      <div style={{ fontSize:12, fontWeight:400, color:C.sub, marginTop:2 }}>
                        {L("Añade estos materiales a un pedido ya creado (mismo evento, otro almacén).","Add these materials to an existing order (same event, different warehouse).")}
                      </div>
                    </div>
                  </button>
                )}
              </div>
            ) : modoImport === "adjuntar" && !adjuntarA ? (
              // Paso 0b: seleccionar pedido
              <div style={{ flex:1, overflowY:"auto", padding:"18px 22px" }}>
                <p style={{ fontSize:13, color:C.sub, marginBottom:14 }}>
                  {L("Selecciona el pedido al que añadir los materiales de","Select the order to add materials from")} <strong>{parsed.almacen.nombre}</strong>:
                </p>
                {[...pedidos].sort((a,b) => (b.fecha_entrega||"").localeCompare(a.fecha_entrega||"")).map(p => (
                  <div key={p.id} onClick={() => setAdjuntarA(p.id)}
                    style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 14px",
                      borderRadius:10, border:`1.5px solid ${C.line}`, marginBottom:8,
                      cursor:"pointer", background:C.surface, transition:"border-color .1s" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = C.brand}
                    onMouseLeave={e => e.currentTarget.style.borderColor = C.line}>
                    <ClipboardList size={16} color={C.brand}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:13.5 }}>{p.codigo || `PED-${p.id}`} — {p.nombre || "—"}</div>
                      <div style={{ fontSize:12, color:C.sub, marginTop:2 }}>
                        {p.fecha_entrega && `📅 ${p.fecha_entrega}`}
                        {p.destino && ` · 📍 ${p.destino}`}
                        {` · ${(p.lineas||[]).length} ${L("líneas","lines")}`}
                      </div>
                    </div>
                    <ChevronRight size={15} color={C.dim}/>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div style={{ display:"flex", borderBottom:`1px solid ${C.line}`, flexShrink:0, padding:"0 22px" }}>
                  {[["exp", L("Expedición","Expedition")], ["mat", `${L("Materiales","Materials")} (${nMat})`]].map(([id, lbl]) => (
                    <button key={id} onClick={() => setWizardTab(id)}
                      style={{ padding:"10px 16px", border:"none",
                        borderBottom: wizardTab === id ? `2.5px solid ${C.brand}` : "2.5px solid transparent",
                        background:"transparent", fontFamily:"inherit",
                        fontWeight: wizardTab === id ? 600 : 400, fontSize:13.5,
                        cursor:"pointer", color: wizardTab === id ? C.brand : C.sub, marginBottom:-1 }}>
                      {lbl}
                    </button>
                  ))}
                  {modoImport === "adjuntar" && adjuntarA && (
                    <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", fontSize:12, color:C.brand, gap:6, padding:"0 4px" }}>
                      <Check size={13}/>
                      {L("Adjuntando a","Attaching to")} <strong>{pedidos.find(p=>p.id===adjuntarA)?.codigo || `PED-${adjuntarA}`}</strong>
                      <button onClick={() => setAdjuntarA(null)}
                        style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, padding:2, display:"flex", marginLeft:4 }}>
                        <X size={12}/>
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ flex:1, overflowY:"auto", padding:"18px 22px" }}>
                  {wizardTab === "exp" && modoImport === "nuevo" && <ExpedicionForm form={expForm} setForm={setExpForm} nextCodigo={siguienteCodigo(pedidos)} L={L}/>}
                  {wizardTab === "exp" && modoImport === "adjuntar" && (
                    <div style={{ padding:"12px 0", color:C.sub, fontSize:13.5 }}>
                      {L("Los datos de expedición ya están en el pedido seleccionado. Solo se añadirán las líneas de materiales.",
                         "Expedition data is already in the selected order. Only material lines will be added.")}
                    </div>
                  )}
                  {wizardTab === "mat" && <MaterialesList grouped={grouped} updateMaterial={updateMaterial} L={L}/>}
                </div>

                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                  padding:"14px 22px", borderTop:`1px solid ${C.line}`, flexShrink:0, gap:10 }}>
                  <div style={{ fontSize:12, color:C.sub }}>
                    {nConNombreAlt > 0
                      ? L(`${nConNombreAlt} nombres serán sustituidos al confirmar.`,`${nConNombreAlt} names will be replaced on confirm.`)
                      : L("Los nombres originales del Excel se usarán tal cual.","Original Excel names will be used as-is.")}
                  </div>
                  <div style={{ display:"flex", gap:10 }}>
                    <Btn outline onClick={() => setParsed(null)}>{L("Cancelar","Cancel")}</Btn>
                    <Btn onClick={confirmar} disabled={saving}>
                      {saving ? <Loader size={14} className="spin"/> : <Check size={14}/>}
                      {L(`Confirmar (${nMat})`,`Confirm (${nMat})`)}
                    </Btn>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal notificaciones post-confirmación */}
      {notifModal && (
        <ModalNotificaciones
          pedido={notifModal.pedido}
          companyId={notifModal.companyId}
          onClose={() => setNotifModal(null)}
        />
      )}
    </div>
  );
}
