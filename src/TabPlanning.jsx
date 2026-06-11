/* ═══════════════════════════════════════════════════════════════════════════
   TabPlanning — Calendario de horas continuo, izquierda→derecha
   Canvas: 3 días (ayer · hoy · mañana). Scroll automático a hora_ida - 5h.
   Todos los pedidos en esos 3 días aparecen como filas.
   ═══════════════════════════════════════════════════════════════════════════ */
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, Package, Truck, Check, X, Trash2, ClipboardList,
} from "lucide-react";
import { useL } from "./lib/i18n.js";
import { TIPOS, DEFAULT_DURS } from "./lib/expedicionesConst.js";
import { fmtFecha } from "./lib/fechas.js";

/* ─── Layout ─────────────────────────────────────────────────────────────── */
const W_PX      = 80;     // px por hora
const ROW_H     = 68;     // altura de cada fila pedido
const LABEL_W   = 176;    // columna izquierda fija
const AXIS_H    = 40;     // eje de horas sticky
const SNAP      = 0.25;
const DRAG_THRESH = 4;

// Canvas: 3 días completos = 72 horas
// Hora 0 = medianoche del día anterior al seleccionado
const DIAS_CANVAS = 3;
const H_TOTAL     = DIAS_CANVAS * 24;   // 72
const H_OFFSET    = 0;                  // hora 0 del canvas = 00:00 día anterior

const TIPOS_INICIO = ["salir_almacen","llevar_evento","descargar_evento","regresar_almacen"];
const TIPOS_FINAL  = ["llevar_evento","recoger_evento","regresar_almacen","descargar_almacen"];

/* ─── Utilidades ──────────────────────────────────────────────────────────── */
const snp    = h  => Math.round(h / SNAP) * SNAP;
const clamp  = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const uid    = () => `t${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
const toHM   = h  => { const hh = Math.floor(((h % 24) + 24) % 24), mm = Math.round((h % 1 + (h % 1 < 0 ? 1 : 0)) * 60) % 60; return `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`; };
const dec2hm = s  => { if (!s) return null; const [hh, mm] = s.split(":").map(Number); return hh + (mm || 0) / 60; };
const hoyMas = n  => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10); };
// fmtD se redefine dentro del componente con el formato configurado
const isoPlus = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10); };

// Convierte hora-decimal-canvas a px X
const hToX = h => h * W_PX;

// Dado un pedido y la fecha-ancla del canvas (día anterior),
// devuelve la hora decimal dentro del canvas (0–72) para la IDA (fecha_entrega)
const pedidoHoraCanvas = (pedido, anchorIso) => {
  const fechaPed = pedido.fecha_entrega || pedido.fecha_retorno || "";
  const d0 = new Date(anchorIso + "T00:00:00");
  const dp = new Date(fechaPed + "T00:00:00");
  return Math.round((dp - d0) / 86400000) * 24;
};

// Offset para la VUELTA: usa fecha_retorno si es distinta de fecha_entrega
const vueltaCanvas = (pedido, anchorIso) => {
  const fechaVuelta = pedido.fecha_retorno || pedido.fecha_entrega || "";
  const d0 = new Date(anchorIso + "T00:00:00");
  const dv = new Date(fechaVuelta + "T00:00:00");
  return Math.round((dv - d0) / 86400000) * 24;
};

/* ─── calcularTramos ─────────────────────────────────────────────────────── */
function calcularTramos(pedido, vehiculoId, offsetH, offsetVuelta) {
  if (!vehiculoId) return [];
  const vid = String(vehiculoId);
  const pid = String(pedido.id);
  const horaIda    = dec2hm(pedido.hora_ida);
  const horaVuelta = dec2hm(pedido.hora_vuelta);
  const effVuelta  = offsetVuelta ?? offsetH;
  const result = [];

  if (horaIda != null) {
    const durAntes = ["salir_almacen","llevar_evento"].reduce((s,t) => s + DEFAULT_DURS[t], 0);
    let h = snp(offsetH + horaIda - durAntes);
    const gid = `g_${vid}_${pid}_ini`;
    for (const tipo of TIPOS_INICIO) {
      const dur = DEFAULT_DURS[tipo];
      result.push({ id:uid(), vehiculo_id:vid, pedido_id:pid, tipo,
        hora_inicio:snp(h), hora_fin:snp(h+dur), grupo_id:gid });
      h = snp(h + dur);
    }
  }

  if (horaVuelta != null) {
    const durAntes = DEFAULT_DURS["llevar_evento"];
    let h = snp(effVuelta + horaVuelta - durAntes);
    const gid = `g_${vid}_${pid}_fin`;
    for (const tipo of TIPOS_FINAL) {
      const dur = DEFAULT_DURS[tipo];
      result.push({ id:uid(), vehiculo_id:vid, pedido_id:pid, tipo,
        hora_inicio:snp(h), hora_fin:snp(h+dur), grupo_id:gid });
      h = snp(h + dur);
    }
  }

  return result;
}

/* ─── TramoBar ────────────────────────────────────────────────────────────── */
function TramoBar({ tramo, isDragging, isGroupDrag, vehColor, onMD, onResizeMD }) {
  const cfg   = TIPOS[tramo.tipo] || {};
  const vc    = vehColor || cfg.color;
  const left  = hToX(tramo.hora_inicio);
  const width = Math.max((tramo.hora_fin - tramo.hora_inicio) * W_PX, 6);
  const wide  = width >= 56;

  return (
    <div data-tramo="1" onMouseDown={onMD}
      style={{ position:"absolute", top:6, height:ROW_H - 12,
        left, width, boxSizing:"border-box",
        borderRadius:6, background:`${vc}28`,
        border:`1.5px solid ${vc}88`, borderTop:`4px solid ${vc}`,
        opacity: isGroupDrag ? 0.55 : isDragging ? 0.85 : 1,
        cursor:"grab", userSelect:"none", zIndex: isDragging ? 20 : 4,
        boxShadow: isDragging ? `0 2px 12px ${vc}44` : "none",
        overflow:"hidden", transition: isDragging ? "none" : "opacity .1s" }}>
      <div style={{ padding:"2px 4px", height:"100%", display:"flex",
        flexDirection:"column", justifyContent:"center" }}>
        {wide && <>
          <div style={{ fontSize:9, fontWeight:800, color:vc, letterSpacing:.2,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {cfg.short || cfg.label}
          </div>
          <div style={{ fontSize:8, color:vc, opacity:.7, whiteSpace:"nowrap" }}>
            {toHM(tramo.hora_inicio)}–{toHM(tramo.hora_fin)}
          </div>
        </>}
      </div>
      <div onMouseDown={onResizeMD}
        style={{ position:"absolute", top:0, right:0, bottom:0, width:6,
          cursor:"ew-resize", background:`${vc}55`, borderRadius:"0 4px 4px 0" }}/>
    </div>
  );
}

/* ─── PedidoRow ──────────────────────────────────────────────────────────── */
function PedidoRow({ pedido, tramos, offsetH, vehById, vehiculosEmpresa,
    dragId, grupoActivo, onTramoDn, onResizeDn, onGridClick, onCambiarVehiculo,
    totalW, anchorIso, L }) {

  const horaIda    = dec2hm(pedido.hora_ida);
  const horaVuelta = dec2hm(pedido.hora_vuelta);
  const vehSel     = vehById[String(pedido.vehiculo_id)] || null;
  const CHIP = { confirmado:"#16a34a", borrador:"#94a3b8", planificado:"#2563eb",
                 en_ruta:"#d97706", entregado:"#16a34a", cancelado:"#dc2626" };
  const chipColor = CHIP[pedido.estado] || CHIP.borrador;
  const offsetV = vueltaCanvas(pedido, anchorIso);
  const vueltaDiasExtra = (offsetV - offsetH) / 24; // 0=mismo día, 1=+1 día, etc.

  // Franja del evento en el canvas
  const xIda    = horaIda    != null ? hToX(offsetH + horaIda)   : null;
  const xVuelta = horaVuelta != null ? hToX(offsetV + horaVuelta) : null;

  return (
    <div style={{ display:"flex", borderBottom:"1px solid var(--border)", height:ROW_H,
      background:"var(--surface)" }}>

      {/* Etiqueta fija */}
      <div style={{ width:LABEL_W, flexShrink:0, padding:"5px 8px",
        borderRight:"1px solid var(--border)", position:"sticky", left:0, zIndex:8,
        background:"var(--surface)", display:"flex", flexDirection:"column",
        justifyContent:"center", gap:2 }}>

        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
          <ClipboardList size={11} color="var(--brand)"/>
          <span style={{ fontSize:11.5, fontWeight:700, color:"var(--text)",
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>
            {pedido.codigo || `PED-${pedido.id}`}
          </span>
          <span style={{ fontSize:8, padding:"1px 4px", borderRadius:999,
            background:`${chipColor}18`, color:chipColor, fontWeight:700, flexShrink:0 }}>
            {pedido.estado}
          </span>
        </div>

        <div style={{ fontSize:10, color:"var(--text-2)",
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {pedido.nombre || "—"}
        </div>

        <div style={{ display:"flex", gap:3, alignItems:"center", flexWrap:"wrap" }}>
          {horaIda != null && (
            <span style={{ fontSize:8.5, fontWeight:700, color:"#2563eb",
              background:"#dbeafe", borderRadius:4, padding:"0 4px", flexShrink:0 }}>
              🚚 {pedido.hora_ida}
            </span>
          )}
          {horaVuelta != null && (
            <span style={{ fontSize:8.5, fontWeight:700, color:"#d97706",
              background:"#fef3c7", borderRadius:4, padding:"0 4px", flexShrink:0 }}>
              🏠 {pedido.hora_vuelta}{vueltaDiasExtra > 0 ? ` +${vueltaDiasExtra}d` : ""}
            </span>
          )}
          <select value={String(pedido.vehiculo_id ?? "")}
            onChange={e => onCambiarVehiculo?.(pedido.id, e.target.value || null)}
            style={{ fontSize:8.5, fontWeight:700, borderRadius:999, padding:"0 3px",
              border:`1.5px solid ${vehSel ? vehSel.color+"88" : "var(--border)"}`,
              background: vehSel ? `${vehSel.color}18` : "var(--surface-2)",
              color: vehSel ? vehSel.color : "var(--text-2)",
              fontFamily:"inherit", cursor:"pointer", outline:"none", maxWidth:100 }}>
            <option value="">{L("Sin vehículo","No vehicle")}</option>
            {(vehiculosEmpresa || []).map(v => (
              <option key={v.id} value={String(v.id)}>{v.matricula || v.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ position:"relative", width:totalW, flexShrink:0, overflow:"visible" }}
        onClick={e => {
          if (e.target !== e.currentTarget) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const h = snp((e.clientX - rect.left) / W_PX);
          onGridClick?.(clamp(h, 0, H_TOTAL - 1));
        }}>

        {/* Bloque evento */}
        {xIda != null && xVuelta != null && (
          <div style={{ position:"absolute", top:4, bottom:4,
            left:xIda, width:Math.max(xVuelta - xIda, 3),
            background:"rgba(22,163,74,.07)", border:"1px solid rgba(22,163,74,.2)",
            borderRadius:4, pointerEvents:"none", zIndex:1 }}/>
        )}

        {/* Marcadores hora */}
        {xIda != null && (
          <div style={{ position:"absolute", top:0, bottom:0, left:xIda,
            width:2, background:"#2563eb66", zIndex:3, pointerEvents:"none" }}>
            <span style={{ position:"absolute", top:2, left:3, fontSize:8,
              color:"#2563eb", fontWeight:700, background:"var(--surface)",
              padding:"0 2px", borderRadius:2, whiteSpace:"nowrap" }}>
              {pedido.hora_ida}
            </span>
          </div>
        )}
        {xVuelta != null && (
          <div style={{ position:"absolute", top:0, bottom:0, left:xVuelta,
            width:2, background:"#d9770666", zIndex:3, pointerEvents:"none" }}>
            <span style={{ position:"absolute", top:2, left:3, fontSize:8,
              color:"#d97706", fontWeight:700, background:"var(--surface)",
              padding:"0 2px", borderRadius:2, whiteSpace:"nowrap" }}>
              {pedido.hora_vuelta}
            </span>
          </div>
        )}

        {/* Tramos */}
        {tramos.map(t => (
          <TramoBar key={t.id} tramo={t}
            isDragging={dragId === t.id}
            isGroupDrag={!!(grupoActivo && t.grupo_id === grupoActivo && dragId !== t.id)}
            vehColor={vehById[t.vehiculo_id]?.color}
            onMD={e => { if (e.button === 0) onTramoDn(e, t.id); }}
            onResizeMD={e => { e.stopPropagation(); if (e.button === 0) onResizeDn(e, t.id); }}/>
        ))}

        {tramos.length === 0 && (
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center",
            justifyContent:"center", gap:5, color:"var(--text-3)", pointerEvents:"none" }}>
            <Truck size={12} color="var(--border)"/>
            <span style={{ fontSize:10 }}>{L("Sin tramos","No segments")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── PedidoEditModal ────────────────────────────────────────────────────── */
function PedidoEditModal({ pedido, onSave, onClose, vehiculosEmpresa = [], L }) {
  const [form, setForm] = useState({ ...pedido });
  const f = k => v => setForm(p => ({ ...p, [k]: v }));
  const inp = (label, key, type = "text", ph = "") => (
    <div>
      <label style={{ fontSize:11, fontWeight:700, color:"var(--text-2)", letterSpacing:.5, display:"block", marginBottom:4 }}>{label}</label>
      <input type={type} value={form[key] ?? ""} onChange={e => f(key)(e.target.value)} placeholder={ph}
        style={{ width:"100%", padding:"8px 10px", border:"1px solid var(--border-strong)", borderRadius:9,
          fontSize:13.5, fontFamily:"inherit", background:"var(--surface-2)", color:"var(--text)", outline:"none", boxSizing:"border-box" }}/>
    </div>
  );
  const sel = (label, key, options) => (
    <div>
      <label style={{ fontSize:11, fontWeight:700, color:"var(--text-2)", letterSpacing:.5, display:"block", marginBottom:4 }}>{label}</label>
      <select value={form[key] ?? ""} onChange={e => f(key)(e.target.value || null)}
        style={{ width:"100%", padding:"8px 10px", border:"1px solid var(--border-strong)", borderRadius:9,
          fontSize:13.5, fontFamily:"inherit", background:"var(--surface-2)", color:"var(--text)", outline:"none" }}>
        {options}
      </select>
    </div>
  );
  const ESTADOS = ["borrador","confirmado","planificado","en_ruta","entregado","cancelado"];
  const vehSel = vehiculosEmpresa.find(v => String(v.id) === String(form.vehiculo_id));
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:1000,
      display:"grid", placeItems:"center", padding:16 }} onClick={onClose}>
      <div style={{ background:"var(--surface)", borderRadius:16, boxShadow:"var(--shadow-lg)",
        width:"100%", maxWidth:520, padding:24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <div style={{ fontWeight:800, fontSize:16 }}>{L("Editar pedido","Edit order")}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-2)", display:"flex" }}><X size={18}/></button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {inp(L("CÓDIGO","CODE"), "codigo")}
          {sel("ESTADO", "estado", ESTADOS.map(s => <option key={s}>{s}</option>))}
          <div style={{ gridColumn:"1/-1" }}>{inp(L("CLIENTE","CLIENT"), "nombre")}</div>
          {inp(L("FECHA EXPEDICIÓN","DISPATCH DATE"), "fecha_entrega", "date")}
          {inp(L("FECHA RETORNO","RETURN DATE"), "fecha_retorno", "date")}
          {inp(L("HORA IDA","DEPARTURE TIME"), "hora_ida", "time")}
          {inp(L("HORA VUELTA","RETURN TIME"), "hora_vuelta", "time")}
          {inp(L("DESTINO","DESTINATION"), "destino")}
          {inp("PAX", "pax_adults", "number")}
          {vehiculosEmpresa.length > 0 && sel(L("VEHÍCULO","VEHICLE"), "vehiculo_id", [
            <option key="" value="">{L("Sin vehículo","No vehicle")}</option>,
            ...vehiculosEmpresa.map(v => (
              <option key={v.id} value={String(v.id)}>{v.nombre || v.modelo || `Veh. ${v.id}`}</option>
            ))
          ])}
        </div>
        {vehSel && (
          <div style={{ marginTop:10, padding:"6px 10px", borderRadius:8, background:`${vehSel.color}18`,
            border:`1px solid ${vehSel.color}44`, fontSize:12.5, color:vehSel.color, fontWeight:600 }}>
            🚐 {vehSel.nombre}{vehSel.matricula ? ` · ${vehSel.matricula}` : ""}
          </div>
        )}
        <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:18 }}>
          <button onClick={onClose} style={{ padding:"9px 18px", borderRadius:999, border:"1px solid var(--border-strong)", background:"var(--surface-2)", color:"var(--text)", fontSize:13.5, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
            {L("Cancelar","Cancel")}
          </button>
          <button onClick={() => onSave(form)} style={{ padding:"9px 18px", borderRadius:999, border:"none", background:"var(--brand)", color:"#fff", fontSize:13.5, fontWeight:600, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:6 }}>
            <Check size={15}/>{L("Guardar","Save")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── TramoModal ─────────────────────────────────────────────────────────── */
function TramoModal({ tramo, veh, pedidoLabel, isNew, onSave, onDelete, onClose, L }) {
  const [form, setForm] = useState({ ...tramo });
  const f   = k => v => setForm(p => ({ ...p, [k]: v }));
  const cfg = TIPOS[form.tipo] || {};
  const dur = ((form.hora_fin - form.hora_inicio) * 60).toFixed(0);

  // Convierte hora canvas (puede ser >24 o negativa) a HH:MM del reloj
  const canvasToTime = h => toHM(h);
  const timeToCanvas = (timeStr, baseCanvas) => {
    const [hh, mm] = timeStr.split(":").map(Number);
    const local = hh + (mm || 0) / 60;
    // Mantener el día del canvas (baseCanvas // 24) más la hora local
    const dia = Math.floor(baseCanvas / 24);
    return dia * 24 + local;
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:1000,
      display:"grid", placeItems:"center", padding:16 }} onClick={onClose}>
      <div style={{ background:"var(--surface)", borderRadius:16, boxShadow:"var(--shadow-lg)",
        padding:24, width:"100%", maxWidth:380, maxHeight:"92vh", overflowY:"auto" }}
        onClick={e => e.stopPropagation()}>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700 }}>
              {isNew ? L("Nuevo tramo","New segment") : L("Editar tramo","Edit segment")}
            </div>
            <div style={{ fontSize:11.5, color:"var(--text-2)" }}>
              {veh?.matricula || veh?.nombre || "—"} · {pedidoLabel}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-2)", display:"flex" }}>
            <X size={18}/>
          </button>
        </div>

        {/* Tipo */}
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:11, fontWeight:700, color:"var(--text-2)", letterSpacing:.5,
            display:"block", marginBottom:6 }}>{L("TIPO","TYPE")}</label>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            {Object.entries(TIPOS).map(([key, t]) => (
              <button key={key} onClick={() => f("tipo")(key)}
                style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 11px",
                  borderRadius:9, border:`1.5px solid ${form.tipo === key ? t.color : "var(--border)"}`,
                  background: form.tipo === key ? t.bg : "var(--surface-2)",
                  cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
                <div style={{ width:9, height:9, borderRadius:3, background:t.color, flexShrink:0 }}/>
                <span style={{ fontSize:12.5, fontWeight: form.tipo === key ? 700 : 400,
                  color: form.tipo === key ? t.color : "var(--text)" }}>{t.label}</span>
                <span style={{ fontSize:10.5, color:"var(--text-3)", marginLeft:"auto" }}>
                  {t.grupo === "inicio" ? "🚚 IDA" : "🏠 VUELTA"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Horas */}
        <div style={{ padding:"8px 12px", background:cfg.bg, borderRadius:8,
          border:`1px solid ${cfg.color}40`, marginBottom:12,
          display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:10, height:10, borderRadius:3, background:cfg.color, flexShrink:0 }}/>
          <span style={{ fontSize:12.5, fontWeight:700, color:cfg.color }}>{cfg.label}</span>
          <span style={{ fontSize:11.5, color:"var(--text-2)", marginLeft:"auto" }}>
            {canvasToTime(form.hora_inicio)} – {canvasToTime(form.hora_fin)} · {dur} min
          </span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:18 }}>
          {[["INICIO","hora_inicio"],["FIN","hora_fin"]].map(([lbl, fk]) => (
            <div key={fk}>
              <label style={{ fontSize:11, fontWeight:700, color:"var(--text-2)", letterSpacing:.5,
                display:"block", marginBottom:4 }}>{lbl}</label>
              <input type="time" value={canvasToTime(form[fk])}
                onChange={e => f(fk)(timeToCanvas(e.target.value, form[fk]))}
                style={{ width:"100%", padding:"8px 10px", border:"1px solid var(--border-strong)",
                  borderRadius:9, fontSize:13.5, fontFamily:"inherit",
                  background:"var(--surface-2)", color:"var(--text)", outline:"none" }}/>
              <div style={{ fontSize:11, color:"var(--brand)", marginTop:3, fontWeight:600 }}>
                {canvasToTime(form[fk])}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display:"flex", justifyContent:"space-between", gap:10 }}>
          {!isNew ? (
            <button onClick={() => onDelete(tramo.id)}
              style={{ display:"flex", alignItems:"center", gap:5, padding:"8px 14px", borderRadius:999,
                background:"var(--danger-soft)", color:"var(--danger)", border:"none",
                fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
              <Trash2 size={13}/>{L("Eliminar","Delete")}
            </button>
          ) : <div/>}
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={onClose}
              style={{ padding:"8px 16px", borderRadius:999, border:"1px solid var(--border-strong)",
                background:"var(--surface-2)", color:"var(--text)", fontWeight:600, fontSize:13,
                cursor:"pointer", fontFamily:"inherit" }}>
              {L("Cancelar","Cancel")}
            </button>
            <button onClick={() => onSave(form)}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:999,
                background:"var(--brand)", color:"#fff", border:"none", fontWeight:600,
                fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
              <Check size={14}/>{isNew ? L("Añadir","Add") : L("Guardar","Save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */
export default function TabPlanning({ pedidos, setPedidos, vehiculosEmpresa, formatoFecha = "DD/MM/YYYY", onSavePedido, onSaveTramos, tramosIniciales }) {
  const L = useL();
  const fmtD = iso => fmtFecha(iso, formatoFecha);

  const [fecha,          setFecha]          = useState(() => hoyMas(0));
  const [tramoModal,     setTramoModal]     = useState(null);
  const [tramosOverride, setTramosOverride] = useState(() => tramosIniciales ?? {});
  const [pedidoEdit,     setPedidoEdit]     = useState(null);

  const dragRef    = useRef(null);
  const tramosRef  = useRef({});
  const pedidosRef = useRef(pedidos || []);
  const scrollRef  = useRef(null);   // ref al contenedor scroll
  const panRef     = useRef(null);   // estado del pan-to-scroll
  const [dragId,      setDragId]      = useState(null);
  const [grupoActivo, setGrupoActivo] = useState(null);
  const [isPanning,   setIsPanning]   = useState(false);

  useEffect(() => { pedidosRef.current = pedidos || []; }, [pedidos]);

  // Sync tramosIniciales when loaded async (first non-empty value wins)
  useEffect(() => {
    if (tramosIniciales && Object.keys(tramosIniciales).length > 0) {
      setTramosOverride(prev => Object.keys(prev).length === 0 ? tramosIniciales : prev);
    }
  }, [tramosIniciales]);

  /* ── Fecha ancla del canvas = día anterior al seleccionado ─────────────── */
  const anchorIso = useMemo(() => isoPlus(fecha, -1), [fecha]);

  // Fechas visibles en el canvas
  const fechasCanvas = useMemo(() =>
    [0,1,2].map(i => isoPlus(anchorIso, i)),
    [anchorIso]
  );

  /* ── Pedidos en el canvas (los 3 días) ─────────────────────────────────── */
  const eventosDia = useMemo(() =>
    (pedidos || []).filter(p =>
      fechasCanvas.includes(p.fecha_entrega) || fechasCanvas.includes(p.fecha_retorno)
    ).sort((a, b) => {
      // Ordenar: primero por fecha, luego por hora_ida
      const fa = a.fecha_entrega || a.fecha_retorno || "";
      const fb = b.fecha_entrega || b.fecha_retorno || "";
      if (fa !== fb) return fa < fb ? -1 : 1;
      return (dec2hm(a.hora_ida) ?? 99) - (dec2hm(b.hora_ida) ?? 99);
    }),
    [pedidos, fechasCanvas]
  );

  /* ── Mapa vehículos ─────────────────────────────────────────────────────── */
  const vehById = useMemo(() => Object.fromEntries(
    (vehiculosEmpresa || []).map(v => [String(v.id), v])
  ), [vehiculosEmpresa]);

  /* ── Offset canvas para cada pedido ────────────────────────────────────── */
  const offsetForPedido = useCallback((p) =>
    pedidoHoraCanvas(p, anchorIso),
    [anchorIso]
  );

  /* ── Tramos por pedido ──────────────────────────────────────────────────── */
  const tramosDelDia = useMemo(() => {
    const out = {};
    for (const p of eventosDia) {
      const pid = String(p.id);
      const off = offsetForPedido(p);
      const offV = vueltaCanvas(p, anchorIso);
      out[pid] = tramosOverride[pid]
        ?? (p.vehiculo_id ? calcularTramos(p, p.vehiculo_id, off, offV) : []);
    }
    return out;
  }, [eventosDia, tramosOverride, offsetForPedido, anchorIso]);

  useEffect(() => { tramosRef.current = tramosDelDia; }, [tramosDelDia]);

  /* ── Auto-scroll: llevar hora_ida_min - 5h a la vista ──────────────────── */
  useEffect(() => {
    if (!scrollRef.current) return;
    // Buscar el mínimo hora_ida de los pedidos del día seleccionado
    const pedidosDia = eventosDia.filter(p =>
      p.fecha_entrega === fecha || p.fecha_retorno === fecha
    );
    let scrollH = 24; // default: medianoche del día seleccionado (offset 24h del canvas)
    if (pedidosDia.length > 0) {
      const minHora = pedidosDia.reduce((min, p) => {
        const hi = dec2hm(p.hora_ida) ?? dec2hm(p.hora_vuelta) ?? 12;
        const off = offsetForPedido(p);
        return Math.min(min, off + hi);
      }, Infinity);
      if (isFinite(minHora)) scrollH = minHora;
    }
    const targetX = Math.max(0, hToX(scrollH - 5));
    scrollRef.current.scrollLeft = targetX;
  }, [fecha, eventosDia, offsetForPedido]);

  /* ── setTramos helper ───────────────────────────────────────────────────── */
  const setTramosForPedido = useCallback((pid, updater) => {
    setTramosOverride(prev => {
      const cur  = prev[pid] || tramosRef.current[pid] || [];
      const next = typeof updater === "function" ? updater(cur) : updater;
      return { ...prev, [pid]: next };
    });
  }, []);

  /* ── Drag global horizontal ─────────────────────────────────────────────── */
  useEffect(() => {
    let rafId = null;
    const onMove = e => {
      const dr = dragRef.current;
      if (!dr) return;
      const clientX = e.clientX;
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const dr2 = dragRef.current;
        if (!dr2) return;
        const dx = clientX - dr2.startX;
        if (Math.abs(dx) > DRAG_THRESH) dr2.hasMoved = true;
        const dh = dx / W_PX;

        setTramosForPedido(dr2.pedidoId, prev => {
          if (dr2.type === "resize") {
            return prev.map(t => {
              if (t.id === dr2.id) {
                const nf = snp(clamp(dr2.startHF + dh, dr2.startHI + SNAP, H_TOTAL));
                return { ...t, hora_fin: nf };
              }
              if (dr2.grupoId && t.grupo_id === dr2.grupoId) {
                const snap = dr2.groupSnaps.find(s => s.id === t.id);
                if (!snap || snap.order <= dr2.order) return t;
                const growth = snp(clamp(dr2.startHF + dh, dr2.startHI + SNAP, H_TOTAL)) - dr2.startHF;
                return { ...t, hora_inicio: snp(snap.startHI + growth), hora_fin: snp(snap.startHF + growth) };
              }
              return t;
            });
          }
          // move
          if (dr2.grupoId) {
            const dragged = dr2.groupSnaps.find(s => s.id === dr2.id);
            if (!dragged) return prev;
            const ni    = snp(clamp(dragged.startHI + dh, 0, H_TOTAL - dr2.dur));
            const delta = ni - dragged.startHI;
            return prev.map(t => {
              if (t.grupo_id !== dr2.grupoId) return t;
              const snap = dr2.groupSnaps.find(s => s.id === t.id);
              if (!snap) return t;
              return { ...t, hora_inicio: snp(snap.startHI + delta), hora_fin: snp(snap.startHF + delta) };
            });
          }
          return prev.map(t => {
            if (t.id !== dr2.id) return t;
            const ni = snp(clamp(dr2.startHI + dh, 0, H_TOTAL - dr2.dur));
            return { ...t, hora_inicio: ni, hora_fin: ni + dr2.dur };
          });
        });
      });
    };

    const onUp = () => {
      const dr = dragRef.current;
      if (dr && !dr.hasMoved) {
        const tramos = tramosRef.current[dr.pedidoId] || [];
        const t = tramos.find(x => x.id === dr.id);
        if (t) {
          const v = vehById[t.vehiculo_id];
          const p = pedidosRef.current.find(x => String(x.id) === dr.pedidoId);
          setTimeout(() => setTramoModal({
            tramo:t, pedidoId:dr.pedidoId, veh:v,
            pedidoLabel: p?.codigo || `PED-${dr.pedidoId}`, isNew:false,
          }), 0);
        }
      } else if (dr?.hasMoved && onSaveTramos) {
        const pid = dr.pedidoId;
        const tramos = tramosRef.current[pid] || [];
        onSaveTramos(pid, tramos);
      }
      dragRef.current = null;
      setDragId(null);
      setGrupoActivo(null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [setTramosForPedido, vehById]);

  /* ── Pan-to-scroll (click+drag en zona vacía del canvas) ───────────────── */
  const onScrollAreaMD = useCallback((e) => {
    // Solo botón izquierdo, y solo si no hay un tramo siendo arrastrado
    if (e.button !== 0 || dragRef.current) return;
    // Si el clic fue sobre un tramo (grab cursor) no activar pan
    if (e.target.closest && e.target.closest("[data-tramo]")) return;
    panRef.current = { startX: e.clientX, startY: e.clientY, scrollLeft: scrollRef.current.scrollLeft, scrollTop: scrollRef.current.scrollTop };
    setIsPanning(true);
    e.preventDefault();

    const onMove = (ev) => {
      if (!panRef.current) return;
      const dx = ev.clientX - panRef.current.startX;
      const dy = ev.clientY - panRef.current.startY;
      scrollRef.current.scrollLeft = panRef.current.scrollLeft - dx;
      scrollRef.current.scrollTop  = panRef.current.scrollTop  - dy;
    };
    const onUp = () => {
      panRef.current = null;
      setIsPanning(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  }, []);

  const buildSnaps = (pedidoId, grupoId) =>
    (tramosRef.current[pedidoId] || [])
      .filter(x => x.grupo_id === grupoId)
      .sort((a,b) => a.hora_inicio - b.hora_inicio)
      .map((x,i) => ({ id:x.id, startHI:x.hora_inicio, startHF:x.hora_fin, order:i }));

  const startTramoDn = useCallback((e, id) => {
    e.preventDefault();
    let t = null, pedidoId = null;
    for (const [pid, ts] of Object.entries(tramosRef.current)) {
      const found = ts.find(x => x.id === id);
      if (found) { t = found; pedidoId = pid; break; }
    }
    if (!t) return;
    const grupoId    = t.grupo_id || null;
    const groupSnaps = grupoId ? buildSnaps(pedidoId, grupoId)
      : [{ id, startHI:t.hora_inicio, startHF:t.hora_fin, order:0 }];
    dragRef.current = { id, pedidoId, type:"move", startX:e.clientX,
      startHI:t.hora_inicio, startHF:t.hora_fin, dur:t.hora_fin - t.hora_inicio,
      hasMoved:false, grupoId, groupSnaps };
    setDragId(id);
    if (grupoId) setGrupoActivo(grupoId);
  }, []);

  const startResizeDn = useCallback((e, id) => {
    e.preventDefault();
    let t = null, pedidoId = null;
    for (const [pid, ts] of Object.entries(tramosRef.current)) {
      const found = ts.find(x => x.id === id);
      if (found) { t = found; pedidoId = pid; break; }
    }
    if (!t) return;
    const grupoId    = t.grupo_id || null;
    const groupSnaps = grupoId ? buildSnaps(pedidoId, grupoId) : [];
    const myOrder    = groupSnaps.findIndex(s => s.id === id);
    dragRef.current = { id, pedidoId, type:"resize", startX:e.clientX,
      startHI:t.hora_inicio, startHF:t.hora_fin, dur:t.hora_fin - t.hora_inicio,
      hasMoved:false, grupoId, groupSnaps, order:myOrder };
    setDragId(id);
    if (grupoId) setGrupoActivo(grupoId);
  }, []);

  /* ── Guardar / eliminar ─────────────────────────────────────────────────── */
  const onSaveTramo = form => {
    const pid = tramoModal.pedidoId;
    const cur = tramosRef.current[pid] || [];
    const next = tramoModal.isNew
      ? [...cur, { ...form, id:uid() }]
      : cur.map(t => t.id === form.id ? { ...t, ...form } : t);
    setTramosForPedido(pid, next);
    onSaveTramos?.(pid, next);
    setTramoModal(null);
  };
  const onDeleteTramo = id => {
    const pid = tramoModal.pedidoId;
    const next = (tramosRef.current[pid] || []).filter(t => t.id !== id);
    setTramosForPedido(pid, next);
    onSaveTramos?.(pid, next);
    setTramoModal(null);
  };

  /* ── Click en zona vacía ────────────────────────────────────────────────── */
  const onGridClick = useCallback((pedidoId, hCanvas) => {
    const p = pedidosRef.current.find(x => String(x.id) === pedidoId);
    if (!p) return;
    const v  = vehById[String(p.vehiculo_id)] || vehiculosEmpresa?.[0];
    const hi = clamp(hCanvas, 0, H_TOTAL - 1);
    setTramoModal({
      isNew:true, pedidoId,
      veh:v, pedidoLabel: p.codigo || `PED-${pedidoId}`,
      tramo:{ id:uid(), vehiculo_id: v ? String(v.id) : "",
        pedido_id:pedidoId, tipo:"llevar_evento",
        hora_inicio:hi, hora_fin:clamp(hi+1, 0, H_TOTAL), grupo_id:null },
    });
  }, [vehById, vehiculosEmpresa]);

  /* ── Cambiar vehículo ───────────────────────────────────────────────────── */
  const onCambiarVehiculo = useCallback((pedidoId, nuevoVehId) => {
    const pid = String(pedidoId);
    setPedidos?.(prev => {
      const next = prev.map(p => String(p.id) === pid ? { ...p, vehiculo_id:nuevoVehId } : p);
      const updated = next.find(p => String(p.id) === pid);
      if (updated) onSavePedido?.(updated);
      return next;
    });
    setTramosOverride(prev => { const n = { ...prev }; delete n[pid]; return n; });
  }, [setPedidos, onSavePedido]);

  const resetPedido = pid => {
    setTramosOverride(prev => { const n = { ...prev }; delete n[pid]; return n; });
  };

  /* ── Eje de horas ───────────────────────────────────────────────────────── */
  const totalW = H_TOTAL * W_PX;  // 72 * 80 = 5760 px

  const ticks = useMemo(() => {
    const t = [];
    for (let h = 0; h < H_TOTAL; h += 0.5) t.push(h);
    return t;
  }, []);
  const ticksHoraEntera = useMemo(() => ticks.filter(h => h % 1 === 0), [ticks]);

  // Franjas de días para el fondo
  const dayBands = fechasCanvas.map((iso, i) => ({
    iso, x: i * 24 * W_PX, w: 24 * W_PX,
    isTarget: iso === fecha,
  }));

  /* ── Render ─────────────────────────────────────────────────────────────── */
  const navegar = d => {
    const dt = new Date(fecha); dt.setDate(dt.getDate() + d);
    setFecha(dt.toISOString().slice(0,10));
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0,
      fontFamily:"var(--font-body)", cursor: dragId ? "grabbing" : "auto" }}>

      {/* Toolbar */}
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 16px",
        borderBottom:"1px solid var(--border)", flexShrink:0, background:"var(--surface)",
        flexWrap:"wrap" }}>
        <button onClick={() => navegar(-1)}
          style={{ background:"none", border:"1px solid var(--border-strong)", borderRadius:8,
            padding:6, cursor:"pointer", color:"var(--text-2)", display:"flex" }}>
          <ChevronLeft size={15}/>
        </button>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
          style={{ padding:"7px 10px", border:"1px solid var(--border-strong)", borderRadius:9,
            fontSize:13.5, fontFamily:"inherit", background:"var(--surface-2)", color:"var(--text)", outline:"none" }}/>
        <button onClick={() => navegar(1)}
          style={{ background:"none", border:"1px solid var(--border-strong)", borderRadius:8,
            padding:6, cursor:"pointer", color:"var(--text-2)", display:"flex" }}>
          <ChevronRight size={15}/>
        </button>
        <span style={{ fontSize:12, color:"var(--text-2)" }}>
          {fmtD(anchorIso)} → {fmtD(fechasCanvas[2])} · {eventosDia.length} {L("evento(s)","event(s)")}
        </span>

        {/* Leyenda tipos */}
        <div style={{ display:"flex", gap:5, marginLeft:"auto", flexWrap:"wrap", alignItems:"center" }}>
          {Object.entries(TIPOS).map(([key, t]) => (
            <span key={key} style={{ fontSize:8.5, fontWeight:700, background:`${t.color}20`,
              color:t.color, borderRadius:4, padding:"1px 5px", border:`1px solid ${t.color}33` }}>
              {t.short}
            </span>
          ))}
        </div>
      </div>

      {/* Scroll horizontal */}
      <div ref={scrollRef} onMouseDown={onScrollAreaMD}
        style={{ flex:1, overflowX:"auto", overflowY:"auto", minHeight:0,
          cursor: isPanning ? "grabbing" : dragId ? "grabbing" : "grab",
          userSelect:"none" }}>
        <div style={{ display:"flex", minWidth: LABEL_W + totalW, position:"relative" }}>

          {/* Columna de etiquetas sticky-left */}
          <div style={{ width:LABEL_W, flexShrink:0, position:"sticky", left:0, zIndex:15,
            background:"var(--surface)", borderRight:"1px solid var(--border)" }}>
            {/* Esquina vacía bajo el eje */}
            <div style={{ height:AXIS_H, borderBottom:"2px solid var(--border)",
              display:"flex", alignItems:"center", paddingLeft:10 }}>
              <span style={{ fontSize:10.5, fontWeight:700, color:"var(--text-3)" }}>
                {L("Pedido","Order")}
              </span>
            </div>
            {/* Labels pedidos */}
            {eventosDia.map(p => {
              const pid        = String(p.id);
              const isOverride = !!tramosOverride[pid];
              const vehSel     = vehById[String(p.vehiculo_id)] || null;
              const CHIP = { confirmado:"#16a34a", borrador:"#94a3b8", planificado:"#2563eb",
                             en_ruta:"#d97706", entregado:"#16a34a", cancelado:"#dc2626" };
              const chipColor = CHIP[p.estado] || CHIP.borrador;
              const horaIda    = dec2hm(p.hora_ida);
              const horaVuelta = dec2hm(p.hora_vuelta);
              const labelOffV  = vueltaCanvas(p, anchorIso);
              const labelExtraD = (labelOffV - offsetForPedido(p)) / 24;

              return (
                <div key={pid} onClick={() => setPedidoEdit(p)}
                  title={L("Clic para editar","Click to edit")}
                  style={{ height:ROW_H, padding:"5px 8px", cursor:"pointer",
                  borderBottom:"1px solid var(--border)", display:"flex",
                  flexDirection:"column", justifyContent:"center", gap:2,
                  background: p.fecha_entrega === fecha || p.fecha_retorno === fecha
                    ? "var(--surface)" : "var(--surface-2)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <ClipboardList size={10} color="var(--brand)"/>
                    <span style={{ fontSize:11, fontWeight:700, color:"var(--text)",
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>
                      {p.codigo || `PED-${p.id}`}
                    </span>
                    <span style={{ fontSize:7.5, padding:"1px 4px", borderRadius:999,
                      background:`${chipColor}18`, color:chipColor, fontWeight:700, flexShrink:0 }}>
                      {p.estado}
                    </span>
                    {isOverride && (
                      <button onClick={() => resetPedido(pid)}
                        title={L("Recalcular","Recalculate")}
                        style={{ background:"var(--warn-soft)", color:"var(--warn)",
                          border:"none", borderRadius:4, padding:"0 4px", fontSize:8,
                          fontWeight:700, cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>
                        ↺
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize:9.5, color:"var(--text-2)",
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {p.nombre || "—"}
                  </div>
                  <div style={{ display:"flex", gap:3, alignItems:"center", flexWrap:"wrap" }}>
                    {horaIda != null && (
                      <span style={{ fontSize:8, fontWeight:700, color:"#2563eb",
                        background:"#dbeafe", borderRadius:3, padding:"0 3px", flexShrink:0 }}>
                        🚚 {p.hora_ida}
                      </span>
                    )}
                    {horaVuelta != null && (
                      <span style={{ fontSize:8, fontWeight:700, color:"#d97706",
                        background:"#fef3c7", borderRadius:3, padding:"0 3px", flexShrink:0 }}>
                        🏠 {p.hora_vuelta}{labelExtraD > 0 ? ` +${labelExtraD}d` : ""}
                      </span>
                    )}
                    <select value={String(p.vehiculo_id ?? "")}
                      onChange={e => onCambiarVehiculo(p.id, e.target.value || null)}
                      style={{ fontSize:8, fontWeight:700, borderRadius:999, padding:"0 3px",
                        border:`1.5px solid ${vehSel ? vehSel.color+"77" : "var(--border)"}`,
                        background: vehSel ? `${vehSel.color}15` : "var(--surface-2)",
                        color: vehSel ? vehSel.color : "var(--text-2)",
                        fontFamily:"inherit", cursor:"pointer", outline:"none", maxWidth:90 }}>
                      <option value="">{L("Sin vehículo","No vehicle")}</option>
                      {(vehiculosEmpresa || []).map(v => (
                        <option key={v.id} value={String(v.id)}>{v.matricula || v.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Canvas derecho: eje + filas */}
          <div style={{ position:"relative", flexShrink:0, width:totalW }}>

            {/* Franjas de días (fondo) */}
            <div style={{ position:"absolute", top:0, left:0, right:0, bottom:0, zIndex:0, pointerEvents:"none" }}>
              {dayBands.map(band => (
                <div key={band.iso} style={{ position:"absolute", top:0, bottom:0,
                  left:band.x, width:band.w,
                  background: band.isTarget
                    ? "transparent"
                    : "rgba(0,0,0,.025)" }}/>
              ))}
            </div>

            {/* Eje de horas sticky-top */}
            <div style={{ position:"sticky", top:0, zIndex:12, height:AXIS_H,
              background:"var(--surface)", borderBottom:"2px solid var(--border)" }}>
              {/* Etiquetas de días */}
              {dayBands.map(band => (
                <div key={band.iso} style={{ position:"absolute", top:0, height:AXIS_H,
                  left:band.x, width:band.w,
                  borderLeft: band.x > 0 ? "2px solid var(--border-strong)" : "none",
                  display:"flex", alignItems:"flex-start", paddingTop:2, paddingLeft:4,
                  boxSizing:"border-box" }}>
                  <span style={{ fontSize:9.5, fontWeight:800,
                    color: band.isTarget ? "var(--brand)" : "var(--text-3)",
                    background: band.isTarget ? "var(--brand-soft)" : "transparent",
                    borderRadius:4, padding:"0 4px" }}>
                    {fmtD(band.iso)}{band.isTarget ? " ★" : ""}
                  </span>
                </div>
              ))}
              {/* Ticks de hora */}
              {ticks.map(h => {
                const isHour = Math.abs(h % 1) < 0.01;
                return (
                  <div key={h} style={{ position:"absolute", bottom:0,
                    left: hToX(h), display:"flex", flexDirection:"column",
                    alignItems:"flex-start", pointerEvents:"none" }}>
                    <div style={{ width:1,
                      height: isHour ? 14 : 7,
                      background: isHour ? "var(--border-strong)" : "var(--border)" }}/>
                    {isHour && (
                      <span style={{ fontSize:9, fontWeight:600, color:"var(--text-2)",
                        position:"absolute", bottom:16, left:2, whiteSpace:"nowrap" }}>
                        {toHM(h)}
                      </span>
                    )}
                  </div>
                );
              })}
              {/* Líneas verticales de hora en el eje */}
              {ticksHoraEntera.map(h => (
                <div key={`vl-${h}`} style={{ position:"absolute", top:AXIS_H, bottom:0,
                  left:hToX(h), width:1, background:"var(--border)", pointerEvents:"none" }}/>
              ))}
            </div>

            {/* Líneas verticales sobre las filas */}
            <div style={{ position:"absolute", top:AXIS_H, left:0, right:0,
              bottom:0, zIndex:0, pointerEvents:"none" }}>
              {ticksHoraEntera.map(h => (
                <div key={h} style={{ position:"absolute", top:0, bottom:0, left:hToX(h),
                  width:1,
                  background: (h % 24 === 0 && h > 0)
                    ? "var(--border-strong)"
                    : "var(--border)" }}/>
              ))}
            </div>

            {/* Filas de pedidos */}
            {eventosDia.length === 0 ? (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
                flexDirection:"column", gap:12, color:"var(--text-2)", padding:60,
                height:200 }}>
                <Package size={36} color="var(--border)"/>
                <div style={{ fontSize:14, fontWeight:500 }}>
                  {L("Sin eventos en este rango","No events in this range")}
                </div>
              </div>
            ) : (
              eventosDia.map(p => {
                const pid = String(p.id);
                const off  = offsetForPedido(p);
                const offV = vueltaCanvas(p, anchorIso);
                const extraDias = (offV - off) / 24;
                return (
                  <div key={pid} style={{ height:ROW_H, position:"relative",
                    borderBottom:"1px solid var(--border)",
                    background: p.fecha_entrega === fecha || p.fecha_retorno === fecha
                      ? "transparent" : "rgba(0,0,0,.015)" }}
                    onClick={e => {
                      if (e.target !== e.currentTarget) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const h = snp((e.clientX - rect.left) / W_PX);
                      onGridClick(pid, h);
                    }}>

                    {/* Bloque evento (usa offV para vuelta) */}
                    {(() => {
                      const hi = dec2hm(p.hora_ida);
                      const hv = dec2hm(p.hora_vuelta);
                      if (hi == null || hv == null) return null;
                      const x1 = hToX(off + hi), x2 = hToX(offV + hv);
                      return (
                        <div style={{ position:"absolute", top:4, bottom:4,
                          left:x1, width:Math.max(x2-x1, 3),
                          background:"rgba(22,163,74,.07)",
                          border:"1px solid rgba(22,163,74,.2)",
                          borderRadius:4, pointerEvents:"none", zIndex:1 }}/>
                      );
                    })()}

                    {/* Marcadores */}
                    {dec2hm(p.hora_ida) != null && (
                      <div style={{ position:"absolute", top:0, bottom:0,
                        left:hToX(off + dec2hm(p.hora_ida)),
                        width:2, background:"#2563eb55", zIndex:3, pointerEvents:"none" }}>
                        <span style={{ position:"absolute", top:2, left:3, fontSize:7.5,
                          color:"#2563eb", fontWeight:700, background:"var(--surface)",
                          padding:"0 2px", borderRadius:2, whiteSpace:"nowrap" }}>
                          {p.hora_ida}
                        </span>
                      </div>
                    )}
                    {dec2hm(p.hora_vuelta) != null && (
                      <div style={{ position:"absolute", top:0, bottom:0,
                        left:hToX(offV + dec2hm(p.hora_vuelta)),
                        width:2, background:"#d9770655", zIndex:3, pointerEvents:"none" }}>
                        <span style={{ position:"absolute", top:2, left:3, fontSize:7.5,
                          color:"#d97706", fontWeight:700, background:"var(--surface)",
                          padding:"0 2px", borderRadius:2, whiteSpace:"nowrap" }}>
                          {p.hora_vuelta}{extraDias > 0 ? ` +${extraDias}d` : ""}
                        </span>
                      </div>
                    )}

                    {/* Tramos */}
                    {(tramosDelDia[pid] || []).map(t => (
                      <TramoBar key={t.id} tramo={t}
                        isDragging={dragId === t.id}
                        isGroupDrag={!!(grupoActivo && t.grupo_id === grupoActivo && dragId !== t.id)}
                        vehColor={vehById[t.vehiculo_id]?.color}
                        onMD={e => { if (e.button === 0) startTramoDn(e, t.id); }}
                        onResizeMD={e => { e.stopPropagation(); if (e.button === 0) startResizeDn(e, t.id); }}/>
                    ))}

                    {(tramosDelDia[pid] || []).length === 0 && (
                      <div style={{ position:"absolute", inset:0, display:"flex",
                        alignItems:"center", justifyContent:"center", gap:5,
                        color:"var(--text-3)", pointerEvents:"none" }}>
                        <Truck size={11} color="var(--border)"/>
                        <span style={{ fontSize:9.5 }}>{L("Sin tramos","No segments")}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modal tramo */}
      {tramoModal && (
        <TramoModal
          tramo={tramoModal.tramo} veh={tramoModal.veh}
          pedidoLabel={tramoModal.pedidoLabel}
          isNew={tramoModal.isNew}
          onSave={onSaveTramo} onDelete={onDeleteTramo}
          onClose={() => setTramoModal(null)} L={L}/>
      )}

      {/* Modal edición pedido */}
      {pedidoEdit && (
        <PedidoEditModal
          pedido={pedidoEdit}
          vehiculosEmpresa={vehiculosEmpresa || []}
          onSave={p => {
            setPedidos(prev => prev.map(x => x.id === p.id ? p : x));
            onSavePedido?.(p);
            setPedidoEdit(null);
          }}
          onClose={() => setPedidoEdit(null)} L={L}/>
      )}
    </div>
  );
}
