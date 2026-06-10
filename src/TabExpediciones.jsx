import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Truck, ChevronLeft, ChevronRight, Package, Plus, X, Check, Trash2 } from "lucide-react";
import { useL } from "./lib/i18n.js";
import { TIPOS, DEFAULT_DURS } from "./lib/expedicionesConst.js";

/* ─── Layout ────────────────────────────────────────────────────────────────── */
const HORA_INICIO = 6;
const HORA_FIN    = 26;
const HORA_GRIS   = 21;
const H_PX        = 64;
const AXIS_W      = 52;
const HEADER_H    = 108;
const LANE_W      = 130;
const SNAP        = 0.25;  // 15 min
const DRAG_THRESH = 5;

const TIPOS_INICIO = ["salir_almacen","llevar_evento","descargar_evento"];
const TIPOS_FINAL  = ["recoger_evento","regresar_almacen","descargar_almacen"];

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
const snp = (h) => Math.round(h / SNAP) * SNAP;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const toHM = (h) => {
  const hh = Math.floor(h) % 24, mm = Math.round((h % 1) * 60);
  return `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
};
const hoyMas = (n) => {
  const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const fmtFecha = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
const uid = () => `t${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const hhmm2dec = (s) => { if (!s) return null; const [hh, mm] = s.split(":").map(Number); return hh + (mm || 0) / 60; };

/* Construye tramos con grupo_id. grupoId identifica el bloque (inicio o final) dentro del vehículo+pedido. */
function buildGrupo(vehiculoId, pedidoId, tiposList, horaInicio, durs, grupoId) {
  let h = horaInicio;
  const vid = String(vehiculoId);
  const pid = String(pedidoId);
  return tiposList.map((tipo) => {
    const dur = durs[tipo] ?? DEFAULT_DURS[tipo];
    const t = { id: uid(), vehiculo_id: vid, pedido_id: pid, tipo, hora_inicio: snp(h), hora_fin: snp(h + dur), grupo_id: grupoId };
    h += dur;
    return t;
  });
}

/* ─── Demo ───────────────────────────────────────────────────────────────────── */
const DEMO_VEHICULOS = [
  { id:"vh1", matricula:"1234 ABC", tipo:"Furgoneta", color:"#3b82f6" },
  { id:"vh2", matricula:"5678 XYZ", tipo:"Camión",    color:"#f59e0b" },
];
const buildDemoTramos = () => [
  ...buildGrupo("vh1", 1, TIPOS_INICIO, 13.0, DEFAULT_DURS, "g_vh1_1_ini"),
  ...buildGrupo("vh1", 2, TIPOS_INICIO, 15.5, DEFAULT_DURS, "g_vh1_2_ini"),
  ...buildGrupo("vh1", 2, TIPOS_FINAL,  17.5, DEFAULT_DURS, "g_vh1_2_fin"),
  ...buildGrupo("vh2", 1, TIPOS_INICIO, 14.0, DEFAULT_DURS, "g_vh2_1_ini"),
  ...buildGrupo("vh2", 1, TIPOS_FINAL,  16.0, DEFAULT_DURS, "g_vh2_1_fin"),
];

/* ─── TramoCard ──────────────────────────────────────────────────────────────── */
function TramoCard({ tramo, laneIdx, numLanes, isDragging, isGroupDrag, onMD, onResizeMD, vehColor }) {
  const cfg    = TIPOS[tramo.tipo] || {};
  const vc     = vehColor || cfg.color;
  const top    = (tramo.hora_inicio - HORA_INICIO) * H_PX;
  const height = Math.max((tramo.hora_fin - tramo.hora_inicio) * H_PX, 18);
  const tall   = height >= 42;
  const pct    = 100 / numLanes;
  const active = isDragging || isGroupDrag;

  return (
    <div onMouseDown={onMD}
      style={{
        position:"absolute",
        left: `calc(${laneIdx * pct}% + 3px)`,
        width: `calc(${pct}% - 6px)`,
        top, height,
        borderRadius:6,
        background: active ? vc : `${vc}28`,
        border: `1.5px solid ${vc}88`,
        borderLeft: `4px solid ${vc}`,
        color: active ? "#fff" : vc,
        display:"flex", flexDirection:"column", justifyContent:"center",
        padding:"2px 6px",
        fontSize:10.5, overflow:"hidden",
        cursor: active ? "grabbing" : "grab",
        boxShadow: active ? "0 4px 16px rgba(0,0,0,.25)" : "0 1px 3px rgba(0,0,0,.10)",
        zIndex: active ? 30 : laneIdx + 5,
        userSelect:"none",
        transition: active ? "none" : "box-shadow .12s",
        opacity: isGroupDrag && !isDragging ? 0.75 : 1,
      }}>
      <div style={{ fontWeight:700, lineHeight:1.2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
        {cfg.short || cfg.label}
      </div>
      {tall && (
        <div style={{ fontSize:9.5, opacity:.8 }}>
          {toHM(tramo.hora_inicio)}–{toHM(tramo.hora_fin)}
        </div>
      )}
      {/* Resize handle */}
      <div onMouseDown={onResizeMD}
        style={{ position:"absolute", bottom:0, left:0, right:0, height:7,
          cursor:"s-resize", background:`${vc}50`, borderRadius:"0 0 6px 6px" }}/>
    </div>
  );
}

/* ─── EventoCol ──────────────────────────────────────────────────────────────── */
function EventoCol({ pedido, tramosEvento, vehiculos, selected, onSelect, onCtxMenu, onTramoDn, onResizeDn, dragId, grupoActivo, L }) {
  const vehIds = [...new Set(tramosEvento.map(t => t.vehiculo_id))];
  const numLanes = Math.max(1, vehIds.length);
  const colW = Math.max(LANE_W + 20, numLanes * LANE_W);
  const hours = Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => HORA_INICIO + i);
  const vehById = Object.fromEntries(vehiculos.map(v => [String(v.id), v]));

  return (
    <div style={{ width:colW, flexShrink:0, borderLeft:"1px solid var(--border)" }}>

      {/* Cabecera sticky */}
      <div style={{ height:HEADER_H, padding:"8px 10px", borderBottom:"1px solid var(--border)",
        position:"sticky", top:0, zIndex:10, background:"var(--surface)",
        display:"flex", flexDirection:"column", gap:4 }}>

        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <button onClick={onSelect}
            style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
              background: selected ? "var(--brand)" : "var(--surface)",
              color: selected ? "#fff" : "var(--text)",
              border:`1px solid ${selected ? "var(--brand)" : "var(--border-strong)"}`,
              borderRadius:999, padding:"5px 12px", fontSize:13, fontWeight:600,
              fontFamily:"inherit", cursor:"pointer", textAlign:"left" }}>
            {pedido.codigo || `PED-${pedido.id}`}
          </button>
          <div style={{ fontSize:12, color:"var(--text-2)", background:"var(--surface-2)", borderRadius:999, padding:"3px 10px", fontWeight:600, flexShrink:0 }}>
            {vehIds.length}
          </div>
        </div>

        <div style={{ display:"flex", gap:4, flexWrap:"wrap", overflow:"hidden", maxHeight:22 }}>
          {vehIds.slice(0, 4).map(vid => {
            const v = vehById[vid];
            return v ? (
              <span key={vid} style={{ fontSize:10.5, background:`${v.color}22`, color:v.color,
                borderRadius:999, padding:"2px 7px", fontWeight:600, whiteSpace:"nowrap",
                border:`1px solid ${v.color}55` }}>
                {v.matricula}
              </span>
            ) : null;
          })}
          {vehIds.length > 4 && <span style={{ fontSize:10.5, color:"var(--text-3)" }}>+{vehIds.length - 4}</span>}
        </div>

        <div style={{ fontSize:11, color:"var(--text-3)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {pedido.nombre || "—"}{pedido.destino ? ` · ${pedido.destino}` : ""}
        </div>
        {(pedido.hora_ida || pedido.hora_vuelta) && (
          <div style={{ display:"flex", gap:8, fontSize:10.5, fontWeight:700 }}>
            {pedido.hora_ida    && <span style={{ color:"var(--brand)" }}>🚚 {pedido.hora_ida}</span>}
            {pedido.hora_vuelta && <span style={{ color:"var(--text-2)" }}>🏠 {pedido.hora_vuelta}</span>}
          </div>
        )}
      </div>

      {/* Grid */}
      <div style={{ position:"relative", height:(HORA_FIN - HORA_INICIO) * H_PX }}
        onContextMenu={e => onCtxMenu(e, pedido.id)}>

        {hours.map(h => (
          <div key={h} style={{ position:"absolute", left:0, right:0, top:(h - HORA_INICIO) * H_PX, height:H_PX,
            background: h >= HORA_GRIS ? "var(--surface-2)" : "transparent",
            borderBottom:"1px solid var(--border)" }}/>
        ))}

        {vehIds.slice(1).map((_, i) => (
          <div key={i} style={{ position:"absolute", top:0, bottom:0,
            left:`${((i + 1) / numLanes) * 100}%`, width:1, background:"var(--border)", zIndex:3 }}/>
        ))}

        {tramosEvento.length === 0 && (
          <div style={{ position:"absolute", top:"40%", left:0, right:0, transform:"translateY(-50%)",
            display:"flex", flexDirection:"column", alignItems:"center", gap:4,
            color:"var(--text-3)", fontSize:12.5, pointerEvents:"none", textAlign:"center" }}>
            <span>{L("Sin vehículos","No vehicles")}</span>
            <span style={{ fontSize:11 }}>{L("clic derecho para añadir","right-click to add")}</span>
          </div>
        )}

        {tramosEvento.map(t => {
          const laneIdx = vehIds.indexOf(t.vehiculo_id);
          return (
            <TramoCard key={t.id} tramo={t}
              laneIdx={Math.max(0, laneIdx)} numLanes={numLanes}
              isDragging={dragId === t.id}
              isGroupDrag={grupoActivo && grupoActivo !== t.id && t.grupo_id && t.grupo_id === tramosEvento.find(x => x.id === dragId)?.grupo_id}
              vehColor={vehById[t.vehiculo_id]?.color}
              onMD={e => { if (e.button === 0) onTramoDn(e, t.id); }}
              onResizeMD={e => { e.stopPropagation(); if (e.button === 0) onResizeDn(e, t.id); }}/>
          );
        })}

        {vehIds.map((vid, i) => {
          const v = vehById[vid];
          if (!v) return null;
          return (
            <div key={vid} style={{ position:"absolute", top:4, zIndex:4, pointerEvents:"none",
              left:`calc(${(i / numLanes) * 100}% + 4px)`, fontSize:9.5,
              color:v.color, fontWeight:700, letterSpacing:.3,
              background:`${v.color}15`, borderRadius:4, padding:"1px 5px",
              maxWidth:LANE_W - 10, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {v.matricula}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Modal: añadir vehículo (grupos) ───────────────────────────────────────── */
const COLORS = ["#3b82f6","#f59e0b","#10b981","#ef4444","#8b5cf6","#f97316","#06b6d4","#ec4899"];

const GRUPO_OPTS = [
  { id:"ambos",  label:"Turno completo",  desc:"Inicio + Final del evento",              tipos_ini:TIPOS_INICIO, tipos_fin:TIPOS_FINAL  },
  { id:"inicio", label:"Solo Inicio",     desc:"Llevar material al evento",              tipos_ini:TIPOS_INICIO, tipos_fin:null         },
  { id:"final",  label:"Solo Final",      desc:"Recoger material del evento",            tipos_ini:null,         tipos_fin:TIPOS_FINAL  },
];

function DurRow({ tipo, dur, onChange }) {
  const cfg = TIPOS[tipo] || {};
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 9px",
      background:cfg.bg, borderRadius:7, border:`1px solid ${cfg.color}30` }}>
      <div style={{ width:8, height:8, borderRadius:999, background:cfg.color, flexShrink:0 }}/>
      <span style={{ fontSize:12, fontWeight:600, color:cfg.color, flex:1 }}>{cfg.label}</span>
      <input type="number" min={0.25} step={0.25} value={dur}
        onChange={e => onChange(Math.max(0.25, parseFloat(e.target.value) || 0.25))}
        style={{ width:60, padding:"3px 6px", border:`1px solid ${cfg.color}60`, borderRadius:6,
          fontSize:12, fontFamily:"inherit", background:"white", color:"#111", outline:"none",
          textAlign:"right" }}/>
      <span style={{ fontSize:11, color:cfg.color, fontWeight:600, minWidth:32 }}>
        {((dur) * 60).toFixed(0)} min
      </span>
    </div>
  );
}

function AddModal({ pedidoId, pedidoLabel, vehiculos, tramos, horaCtx, horaVueltaCtx, onConfirm, onClose, L }) {
  const [sel,    setSel]    = useState(vehiculos.length ? "existing" : "new");
  const [vehId,  setVehId]  = useState(vehiculos[0]?.id || "");
  const [mat,    setMat]    = useState("");
  const [tipo,   setTipo]   = useState("Furgoneta");
  const [color,  setColor]  = useState("#3b82f6");
  const [grupo,  setGrupo]  = useState("ambos");

  // Duraciones editables por tramo
  const [dursIni, setDursIni] = useState(() =>
    Object.fromEntries(TIPOS_INICIO.map(t => [t, DEFAULT_DURS[t]]))
  );
  const [dursFin, setDursFin] = useState(() =>
    Object.fromEntries(TIPOS_FINAL.map(t => [t, DEFAULT_DURS[t]]))
  );

  // Hora de inicio para cada bloque
  const [horaIni, setHoraIni] = useState(horaCtx ?? 13);
  const [horaFin, setHoraFin] = useState(() => {
    if (horaVueltaCtx != null) return horaVueltaCtx;
    // Si solo hay hora de inicio, sugiere inicio + duración total del bloque inicio
    const totalIni = TIPOS_INICIO.reduce((s, t) => s + DEFAULT_DURS[t], 0);
    return (horaCtx ?? 13) + totalIni;
  });

  const selVehId = sel === "existing" ? vehId : null;
  const lastT = useMemo(() =>
    selVehId ? [...tramos].filter(t => t.vehiculo_id === selVehId).sort((a, b) => b.hora_fin - a.hora_fin)[0] : null,
    [selVehId, tramos]
  );

  const opt = GRUPO_OPTS.find(o => o.id === grupo) || GRUPO_OPTS[0];

  // Vista previa calculada
  const previewIni = useMemo(() => {
    if (!opt.tipos_ini) return [];
    let h = horaIni;
    return opt.tipos_ini.map(t => {
      const dur = dursIni[t];
      const r = { tipo: t, hi: h, hf: h + dur };
      h += dur;
      return r;
    });
  }, [opt, horaIni, dursIni]);

  const previewFin = useMemo(() => {
    if (!opt.tipos_fin) return [];
    let h = horaFin;
    return opt.tipos_fin.map(t => {
      const dur = dursFin[t];
      const r = { tipo: t, hi: h, hf: h + dur };
      h += dur;
      return r;
    });
  }, [opt, horaFin, dursFin]);

  const confirm = () => {
    const vid = sel === "existing" ? vehId : `vh${Date.now()}`;
    const newVeh = sel === "new" ? { id: vid, matricula: mat, tipo, color } : null;
    const nuevosTramos = [];
    if (opt.tipos_ini) {
      const gid = `g_${vid}_${pedidoId}_ini_${Date.now()}`;
      nuevosTramos.push(...buildGrupo(vid, pedidoId, opt.tipos_ini, horaIni, dursIni, gid));
    }
    if (opt.tipos_fin) {
      const gid = `g_${vid}_${pedidoId}_fin_${Date.now()}`;
      nuevosTramos.push(...buildGrupo(vid, pedidoId, opt.tipos_fin, horaFin, dursFin, gid));
    }
    onConfirm({ vehiculoId: vid, newVeh, tramos: nuevosTramos });
  };

  const Lbl = ({ children }) => (
    <label style={{ fontSize:11, fontWeight:700, color:"var(--text-2)", letterSpacing:.5, display:"block", marginBottom:5 }}>
      {children}
    </label>
  );
  const Inp = ({ value, onChange, ...p }) => (
    <input value={value} onChange={e => onChange(e.target.value)} {...p}
      style={{ width:"100%", padding:"8px 10px", border:"1px solid var(--border-strong)", borderRadius:9,
        fontSize:13.5, fontFamily:"inherit", background:"var(--surface-2)", color:"var(--text)", outline:"none" }}/>
  );
  const HoraInput = ({ label, value, onChange }) => (
    <div>
      <Lbl>{label}</Lbl>
      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        <input type="time" value={toHM(value)}
          onChange={e => { const [hh, mm] = e.target.value.split(":").map(Number); onChange(hh + (mm||0)/60); }}
          style={{ padding:"7px 10px", border:"1px solid var(--border-strong)", borderRadius:9,
            fontSize:13.5, fontFamily:"inherit", background:"var(--surface-2)", color:"var(--text)", outline:"none" }}/>
        <span style={{ fontSize:13, fontWeight:700, color:"var(--brand)" }}>{toHM(value)}</span>
      </div>
    </div>
  );

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:1000, display:"grid", placeItems:"center", padding:16 }}
      onClick={onClose}>
      <div style={{ background:"var(--surface)", borderRadius:16, boxShadow:"var(--shadow-lg)", padding:24,
        width:"100%", maxWidth:500, maxHeight:"92vh", overflowY:"auto" }}
        onClick={e => e.stopPropagation()}>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700 }}>{L("Añadir vehículo","Add vehicle")}</div>
            <div style={{ fontSize:12, color:"var(--brand)", fontWeight:600 }}>{pedidoLabel}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-2)", display:"flex" }}><X size={18}/></button>
        </div>

        {/* Vehículo existente / nuevo */}
        <div style={{ display:"flex", borderRadius:10, overflow:"hidden", border:"1px solid var(--border-strong)", marginBottom:14 }}>
          {[["existing", L("Existente","Existing")], ["new", L("Nuevo","New")]].map(([id, lbl]) => (
            <button key={id} onClick={() => setSel(id)}
              style={{ flex:1, padding:"8px 10px", fontSize:13, fontWeight: sel===id ? 700 : 400,
                background: sel===id ? "var(--brand)" : "transparent", color: sel===id ? "#fff" : "var(--text-2)",
                border:"none", cursor:"pointer", fontFamily:"inherit" }}>
              {lbl}
            </button>
          ))}
        </div>

        {sel === "existing" && (
          <div style={{ marginBottom:14 }}>
            <Lbl>VEHÍCULO</Lbl>
            <select value={vehId} onChange={e => setVehId(e.target.value)}
              style={{ width:"100%", padding:"9px 10px", border:"1px solid var(--border-strong)", borderRadius:9,
                fontSize:13.5, fontFamily:"inherit", background:"var(--surface-2)", color:"var(--text)", outline:"none" }}>
              {vehiculos.map(v => <option key={v.id} value={v.id}>{v.nombre ? `${v.nombre} · ` : ""}{v.matricula} ({v.tipo})</option>)}
            </select>
            {lastT && (
              <div style={{ fontSize:11.5, color:"var(--text-2)", marginTop:5, padding:"5px 8px",
                background:`${TIPOS[lastT.tipo]?.bg}`, borderRadius:7, border:`1px solid ${TIPOS[lastT.tipo]?.color}30` }}>
                {L("Último tramo","Last segment")}: <strong>{TIPOS[lastT.tipo]?.label}</strong> {L("hasta","until")} <strong>{toHM(lastT.hora_fin)}</strong>
              </div>
            )}
          </div>
        )}

        {sel === "new" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
            <div style={{ gridColumn:"1/-1" }}><Lbl>MATRÍCULA</Lbl><Inp value={mat} onChange={setMat} placeholder="1234 ABC"/></div>
            <div><Lbl>TIPO</Lbl><Inp value={tipo} onChange={setTipo} placeholder="Furgoneta, Camión…"/></div>
            <div>
              <Lbl>COLOR</Lbl>
              <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                {COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)}
                    style={{ width:24, height:24, borderRadius:6, background:c, cursor:"pointer", padding:0,
                      border:`2.5px solid ${color===c ? "var(--text)" : "transparent"}` }}/>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tipo de turno */}
        <div style={{ marginBottom:16 }}>
          <Lbl>{L("TIPO DE TURNO","SHIFT TYPE")}</Lbl>
          <div style={{ display:"flex", gap:6 }}>
            {GRUPO_OPTS.map(opt => (
              <button key={opt.id} onClick={() => setGrupo(opt.id)}
                style={{ flex:1, padding:"8px 10px", borderRadius:9, cursor:"pointer", fontFamily:"inherit", textAlign:"center",
                  border:`1.5px solid ${grupo===opt.id ? "var(--brand)" : "var(--border-strong)"}`,
                  background: grupo===opt.id ? "var(--brand-soft)" : "transparent",
                  color: grupo===opt.id ? "var(--brand)" : "var(--text)" }}>
                <div style={{ fontSize:12.5, fontWeight: grupo===opt.id ? 700 : 400 }}>{opt.label}</div>
                <div style={{ fontSize:10.5, color:"var(--text-2)", marginTop:2 }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Bloque INICIO */}
        {opt.tipos_ini && (
          <div style={{ marginBottom:14, padding:12, borderRadius:10,
            border:"1.5px solid #2563eb44", background:"#dbeafe22" }}>
            <div style={{ fontSize:12, fontWeight:800, color:"#2563eb", marginBottom:8, letterSpacing:.5 }}>
              🚚 {L("GRUPO INICIO — llevar al evento","START GROUP — take to event")}
            </div>
            <HoraInput label={L("HORA DE SALIDA DEL ALMACÉN","DEPARTURE FROM WAREHOUSE")} value={horaIni} onChange={setHoraIni}/>
            <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:4 }}>
              {TIPOS_INICIO.map(t => (
                <DurRow key={t} tipo={t} dur={dursIni[t]}
                  onChange={v => setDursIni(p => ({ ...p, [t]: v }))}/>
              ))}
            </div>
            {/* Preview inline */}
            <div style={{ marginTop:6, fontSize:11, color:"#2563eb", fontWeight:600 }}>
              {toHM(previewIni[0]?.hi ?? horaIni)} → {toHM(previewIni[previewIni.length-1]?.hf ?? horaIni)}
              <span style={{ fontWeight:400, color:"var(--text-2)", marginLeft:6 }}>
                ({((previewIni.reduce((s,r) => s + r.hf - r.hi, 0)) * 60).toFixed(0)} min total)
              </span>
            </div>
          </div>
        )}

        {/* Bloque FINAL */}
        {opt.tipos_fin && (
          <div style={{ marginBottom:14, padding:12, borderRadius:10,
            border:"1.5px solid #d9770644", background:"#fef3c722" }}>
            <div style={{ fontSize:12, fontWeight:800, color:"#d97706", marginBottom:8, letterSpacing:.5 }}>
              🏠 {L("GRUPO FINAL — recoger del evento","END GROUP — collect from event")}
            </div>
            <HoraInput label={L("HORA DE INICIO DE RECOGIDA","COLLECTION START TIME")} value={horaFin} onChange={setHoraFin}/>
            <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:4 }}>
              {TIPOS_FINAL.map(t => (
                <DurRow key={t} tipo={t} dur={dursFin[t]}
                  onChange={v => setDursFin(p => ({ ...p, [t]: v }))}/>
              ))}
            </div>
            <div style={{ marginTop:6, fontSize:11, color:"#d97706", fontWeight:600 }}>
              {toHM(previewFin[0]?.hi ?? horaFin)} → {toHM(previewFin[previewFin.length-1]?.hf ?? horaFin)}
              <span style={{ fontWeight:400, color:"var(--text-2)", marginLeft:6 }}>
                ({((previewFin.reduce((s,r) => s + r.hf - r.hi, 0)) * 60).toFixed(0)} min total)
              </span>
            </div>
          </div>
        )}

        <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
          <button onClick={onClose}
            style={{ padding:"9px 18px", borderRadius:999, border:"1px solid var(--border-strong)",
              background:"var(--surface-2)", color:"var(--text)", fontWeight:600, fontSize:13.5,
              cursor:"pointer", fontFamily:"inherit" }}>
            {L("Cancelar","Cancel")}
          </button>
          <button onClick={confirm}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 18px", borderRadius:999,
              background:"var(--brand)", color:"#fff", border:"none", fontWeight:600,
              fontSize:13.5, cursor:"pointer", fontFamily:"inherit" }}>
            <Check size={14}/>{L("Añadir","Add")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal: editar tramo ────────────────────────────────────────────────────── */
function EditTramoModal({ tramo, veh, pedidoLabel, onSave, onDelete, onClose, L }) {
  const [form, setForm] = useState({ ...tramo });
  const f = k => v => setForm(p => ({ ...p, [k]: v }));
  const cfg = TIPOS[form.tipo] || {};

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:1000, display:"grid", placeItems:"center", padding:16 }}
      onClick={onClose}>
      <div style={{ background:"var(--surface)", borderRadius:16, boxShadow:"var(--shadow-lg)", padding:24, width:"100%", maxWidth:380, maxHeight:"92vh", overflowY:"auto" }}
        onClick={e => e.stopPropagation()}>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700 }}>{L("Editar tramo","Edit segment")}</div>
            <div style={{ fontSize:11.5, color:"var(--text-2)" }}>{veh?.matricula} · {pedidoLabel}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-2)", display:"flex" }}><X size={18}/></button>
        </div>

        <div style={{ padding:"8px 12px", background:cfg.bg, borderRadius:8, border:`1px solid ${cfg.color}40`,
          marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:10, height:10, borderRadius:3, background:cfg.color }}/>
          <span style={{ fontSize:13, fontWeight:700, color:cfg.color }}>{cfg.label}</span>
          <span style={{ fontSize:12, color:"var(--text-2)", marginLeft:"auto" }}>
            {toHM(form.hora_inicio)} – {toHM(form.hora_fin)} · {((form.hora_fin - form.hora_inicio)*60).toFixed(0)} min
          </span>
        </div>

        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:11, fontWeight:700, color:"var(--text-2)", letterSpacing:.5, display:"block", marginBottom:5 }}>TIPO</label>
          <select value={form.tipo} onChange={e => f("tipo")(e.target.value)}
            style={{ width:"100%", padding:"8px 10px", border:"1px solid var(--border-strong)", borderRadius:9,
              fontSize:13.5, fontFamily:"inherit", background:"var(--surface-2)", color:"var(--text)", outline:"none" }}>
            {Object.entries(TIPOS).map(([id, c]) => <option key={id} value={id}>{c.label}</option>)}
          </select>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:18 }}>
          {[["INICIO","hora_inicio"],["FIN","hora_fin"]].map(([lbl, fk]) => (
            <div key={fk}>
              <label style={{ fontSize:11, fontWeight:700, color:"var(--text-2)", letterSpacing:.5, display:"block", marginBottom:5 }}>{lbl}</label>
              <input type="number" step={0.25} value={form[fk]}
                onChange={e => f(fk)(Number(e.target.value))}
                style={{ width:"100%", padding:"8px 10px", border:"1px solid var(--border-strong)", borderRadius:9,
                  fontSize:13.5, fontFamily:"inherit", background:"var(--surface-2)", color:"var(--text)", outline:"none" }}/>
              <div style={{ fontSize:11, color:"var(--brand)", marginTop:3, fontWeight:600 }}>{toHM(form[fk])}</div>
            </div>
          ))}
        </div>

        <div style={{ display:"flex", justifyContent:"space-between", gap:10 }}>
          <button onClick={() => onDelete(tramo.id)}
            style={{ display:"flex", alignItems:"center", gap:5, padding:"8px 14px", borderRadius:999,
              background:"var(--danger-soft)", color:"var(--danger)", border:"none",
              fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
            <Trash2 size={13}/>{L("Eliminar","Delete")}
          </button>
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
              <Check size={14}/>{L("Guardar","Save")}
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
export default function TabExpediciones({ pedidos, expediciones, vehiculosEmpresa, tramos: tramosProps, setTramos: setTramosProps, vehiculos: vehiculosProps, setVehiculos: setVehiculosProps, L: Lprop }) {
  const Lhook = useL();
  const L = Lprop || Lhook;

  const [fecha,      setFecha]      = useState(() => hoyMas(3));
  const [selId,      setSelId]      = useState(null);

  // Si el padre nos pasa tramos/vehiculos los usamos (estado elevado para compartir con Planning).
  // En caso contrario usamos estado local (compatibilidad retroactiva).
  const [tramosLocal,    setTramosLocal]    = useState(() => vehiculosEmpresa?.length ? [] : buildDemoTramos());
  const [vehiculosLocal, setVehiculosLocal] = useState(() => vehiculosEmpresa?.length ? vehiculosEmpresa : DEMO_VEHICULOS);
  const tramos     = tramosProps    ?? tramosLocal;
  const setTramos  = setTramosProps ?? setTramosLocal;
  const vehiculos  = vehiculosProps ?? vehiculosLocal;
  const setVehiculos = setVehiculosProps ?? setVehiculosLocal;
  const [dragId,     setDragId]     = useState(null);
  const [grupoActivo,setGrupoActivo]= useState(null); // grupo_id del tramo arrastrado
  const [addModal,   setAddModal]   = useState(null);
  const [editModal,  setEditModal]  = useState(null);
  const [ctxMenu,    setCtxMenu]    = useState(null);

  const dragRef    = useRef(null);
  const tramosRef  = useRef(tramos);
  const vehRef     = useRef(vehiculos);
  const pedidosRef = useRef(pedidos || []);
  useEffect(() => { tramosRef.current  = tramos; },    [tramos]);
  useEffect(() => { vehRef.current     = vehiculos; }, [vehiculos]);
  useEffect(() => { pedidosRef.current = pedidos || []; }, [pedidos]);

  const adjustDate = (d) => {
    const dt = new Date(fecha); dt.setDate(dt.getDate() + d);
    setFecha(dt.toISOString().slice(0, 10));
  };

  const eventosDia = useMemo(() =>
    (pedidos || []).filter(p => p.fecha_entrega === fecha || p.fecha_retorno === fecha),
    [pedidos, fecha]
  );

  /* ── Global drag — mueve el grupo entero ─────────────────────────────── */
  useEffect(() => {
    const onMove = (e) => {
      const dr = dragRef.current;
      if (!dr) return;
      const dy = e.clientY - dr.startY;
      if (Math.abs(dy) > DRAG_THRESH) dr.hasMoved = true;
      const dh = dy / H_PX;

      setTramos(prev => {
        if (dr.type === "move" && dr.grupoId) {
          // Calcular el offset real del tramo arrastrado para mover el grupo entero
          const dragged = dr.groupSnaps.find(s => s.id === dr.id);
          if (!dragged) return prev;
          const niDragged = snp(clamp(dragged.startHI + dh, HORA_INICIO, HORA_FIN - dr.dur));
          const delta = niDragged - dragged.startHI;
          return prev.map(t => {
            if (t.grupo_id !== dr.grupoId) return t;
            const snap = dr.groupSnaps.find(s => s.id === t.id);
            if (!snap) return t;
            return { ...t, hora_inicio: snp(snap.startHI + delta), hora_fin: snp(snap.startHF + delta) };
          });
        }
        if (dr.type === "resize") {
          // Resize elástico: alarga el tramo resizado y empuja los siguientes del grupo en orden
          return prev.map((t, _i, arr) => {
            if (t.id === dr.id) {
              const nf = snp(clamp(dr.startHF + dh, dr.startHI + 0.25, HORA_FIN));
              return { ...t, hora_fin: nf };
            }
            // ¿Es un tramo posterior del mismo grupo?
            if (dr.grupoId && t.grupo_id === dr.grupoId) {
              const snap = dr.groupSnaps.find(s => s.id === t.id);
              if (!snap) return t;
              // Solo empujamos los que están DESPUÉS del resizado en el orden original
              if (snap.order <= dr.order) return t;
              // El tramo resizado tiene nueva hora_fin; recalcular en cascada
              // Buscamos cuánto creció el tramo resizado
              const nfDragged = snp(clamp(dr.startHF + dh, dr.startHI + 0.25, HORA_FIN));
              const growthTotal = nfDragged - dr.startHF;
              return { ...t, hora_inicio: snp(snap.startHI + growthTotal), hora_fin: snp(snap.startHF + growthTotal) };
            }
            return t;
          });
        }
        // Move sin grupo_id (tramo suelto)
        return prev.map(t => {
          if (t.id !== dr.id) return t;
          const ni = snp(clamp(dr.startHI + dh, HORA_INICIO, HORA_FIN - dr.dur));
          return { ...t, hora_inicio: ni, hora_fin: ni + dr.dur };
        });
      });
    };

    const onUp = () => {
      const dr = dragRef.current;
      if (dr && !dr.hasMoved) {
        const t = tramosRef.current.find(x => x.id === dr.id);
        if (t) {
          const v = vehRef.current.find(v => v.id === t.vehiculo_id);
          const p = pedidosRef.current.find(p => p.id === t.pedido_id);
          const lbl = p?.codigo || `PED-${p?.id}`;
          setTimeout(() => setEditModal({ tramo: t, veh: v, pedidoLabel: lbl }), 0);
        }
      }
      dragRef.current = null;
      setDragId(null);
      setGrupoActivo(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [ctxMenu]);

  const startTramoDn = useCallback((e, id) => {
    e.preventDefault();
    const t = tramosRef.current.find(x => x.id === id);
    if (!t) return;
    const grupoId = t.grupo_id || null;
    // Guardar snapshot de todo el grupo para el movimiento coordinado
    const groupSnaps = grupoId
      ? tramosRef.current
          .filter(x => x.grupo_id === grupoId)
          .sort((a, b) => a.hora_inicio - b.hora_inicio)
          .map((x, i) => ({ id: x.id, startHI: x.hora_inicio, startHF: x.hora_fin, order: i }))
      : [{ id, startHI: t.hora_inicio, startHF: t.hora_fin, order: 0 }];
    dragRef.current = { id, type:"move", startY:e.clientY, startHI:t.hora_inicio, startHF:t.hora_fin, dur:t.hora_fin - t.hora_inicio, hasMoved:false, grupoId, groupSnaps };
    setDragId(id);
    if (grupoId) setGrupoActivo(grupoId);
  }, []);

  const startResizeDn = useCallback((e, id) => {
    e.preventDefault();
    const t = tramosRef.current.find(x => x.id === id);
    if (!t) return;
    const grupoId = t.grupo_id || null;
    const groupSnaps = grupoId
      ? tramosRef.current
          .filter(x => x.grupo_id === grupoId)
          .sort((a, b) => a.hora_inicio - b.hora_inicio)
          .map((x, i) => ({ id: x.id, startHI: x.hora_inicio, startHF: x.hora_fin, order: i }))
      : [];
    const myOrder = groupSnaps.findIndex(s => s.id === id);
    dragRef.current = { id, type:"resize", startY:e.clientY, startHI:t.hora_inicio, startHF:t.hora_fin, dur:t.hora_fin - t.hora_inicio, hasMoved:false, grupoId, groupSnaps, order: myOrder };
    setDragId(id);
    if (grupoId) setGrupoActivo(grupoId);
  }, []);

  const onCtxMenu = (e, pedidoId) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const hora = snp(clamp(HORA_INICIO + (e.clientY - rect.top) / H_PX, HORA_INICIO, HORA_FIN - 1));
    setCtxMenu({ x: e.clientX, y: e.clientY, pedidoId, hora });
  };

  const openAddModal = () => {
    if (!ctxMenu) return;
    const p = (pedidos || []).find(p => p.id === ctxMenu.pedidoId);
    const horaIda    = p?.hora_ida    ? hhmm2dec(p.hora_ida)    : null;
    const horaVuelta = p?.hora_vuelta ? hhmm2dec(p.hora_vuelta) : null;
    setAddModal({
      pedidoId:      String(ctxMenu.pedidoId),
      pedidoLabel:   p?.codigo || `PED-${ctxMenu.pedidoId}`,
      horaIni:       horaIda    ?? ctxMenu.hora,
      horaVuelta:    horaVuelta,
    });
    setCtxMenu(null);
  };

  const onAddConfirm = ({ vehiculoId, newVeh, tramos: newT }) => {
    setTramos(p => [...p, ...newT]);
    setAddModal(null);
  };

  const hours = Array.from({ length: HORA_FIN - HORA_INICIO + 1 }, (_, i) => HORA_INICIO + i);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0 }}>

      {/* Toolbar */}
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 16px",
        borderBottom:"1px solid var(--border)", flexShrink:0, flexWrap:"wrap" }}>

        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
          <button onClick={() => adjustDate(-1)}
            style={{ background:"none", border:"1px solid var(--border-strong)", borderRadius:8,
              padding:6, cursor:"pointer", color:"var(--text-2)", display:"flex" }}>
            <ChevronLeft size={15}/>
          </button>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            style={{ padding:"7px 10px", border:"1px solid var(--border-strong)", borderRadius:9,
              fontSize:13.5, fontFamily:"inherit", background:"var(--surface-2)", color:"var(--text)", outline:"none" }}/>
          <button onClick={() => adjustDate(1)}
            style={{ background:"none", border:"1px solid var(--border-strong)", borderRadius:8,
              padding:6, cursor:"pointer", color:"var(--text-2)", display:"flex" }}>
            <ChevronRight size={15}/>
          </button>
        </div>

        <span style={{ fontSize:12.5, color:"var(--text-2)" }}>
          {fmtFecha(fecha)} — {eventosDia.length} {L("evento(s)","event(s)")}
        </span>

        {/* Leyenda */}
        <div style={{ display:"flex", gap:8, marginLeft:"auto", flexWrap:"wrap" }}>
          {Object.entries(TIPOS).map(([id, cfg]) => (
            <div key={id} style={{ display:"flex", alignItems:"center", gap:4, fontSize:10.5 }}>
              <div style={{ width:8, height:8, borderRadius:2, background:cfg.color, flexShrink:0 }}/>
              <span style={{ color:"var(--text-2)" }}>{cfg.short}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div style={{ flex:1, overflow:"auto", cursor: dragId ? "grabbing" : "auto" }}>
        <div style={{ display:"flex" }}>

          {/* Eje Y */}
          <div style={{ width:AXIS_W, flexShrink:0, position:"sticky", left:0, zIndex:20,
            background:"var(--surface)", borderRight:"1px solid var(--border)" }}>
            <div style={{ height:HEADER_H, borderBottom:"1px solid var(--border)",
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Truck size={16} color="var(--text-3)"/>
            </div>
            {hours.map(h => (
              <div key={h} style={{ height:H_PX, display:"flex", alignItems:"flex-start",
                justifyContent:"flex-end", paddingRight:8, paddingTop:4,
                fontSize:11, color:"var(--text-3)", borderBottom:"1px solid var(--border)",
                background: h >= HORA_GRIS ? "var(--surface-2)" : "var(--surface)" }}>
                {`${String(h % 24).padStart(2,"0")}:00`}
              </div>
            ))}
          </div>

          {/* Columnas de eventos */}
          {eventosDia.length === 0 ? (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center",
              flexDirection:"column", gap:12, color:"var(--text-2)", padding:40 }}>
              <Package size={36} color="var(--border)"/>
              <div style={{ fontSize:14, fontWeight:500 }}>
                {L("Sin expediciones para esta fecha","No shipments for this date")}
              </div>
              <div style={{ fontSize:12.5, color:"var(--text-3)" }}>
                {L("Navega a otro día con las flechas","Navigate to another day")}
              </div>
            </div>
          ) : eventosDia.map(p => (
            <EventoCol key={p.id}
              pedido={p}
              tramosEvento={tramos.filter(t => String(t.pedido_id) === String(p.id))}
              vehiculos={vehiculosEmpresa || []}
              selected={selId === p.id}
              onSelect={() => setSelId(prev => prev === p.id ? null : p.id)}
              onCtxMenu={onCtxMenu}
              onTramoDn={startTramoDn}
              onResizeDn={startResizeDn}
              dragId={dragId}
              grupoActivo={grupoActivo}
              L={L}/>
          ))}
        </div>
      </div>

      {/* Menú contextual */}
      {ctxMenu && (
        <div style={{ position:"fixed", top:ctxMenu.y, left:ctxMenu.x, zIndex:600,
          background:"var(--surface)", border:"1px solid var(--border-strong)",
          borderRadius:10, boxShadow:"var(--shadow-lg)", padding:"4px 0", minWidth:190 }}
          onClick={e => e.stopPropagation()}>
          <button onClick={openAddModal}
            style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"9px 14px",
              background:"none", border:"none", cursor:"pointer", color:"var(--text)",
              fontSize:13.5, fontFamily:"inherit", textAlign:"left" }}>
            <Plus size={14}/>{L("Añadir vehículo","Add vehicle")}
          </button>
          <div style={{ height:1, background:"var(--border)", margin:"2px 0" }}/>
          <button onClick={() => setCtxMenu(null)}
            style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"9px 14px",
              background:"none", border:"none", cursor:"pointer", color:"var(--text-2)",
              fontSize:13, fontFamily:"inherit", textAlign:"left" }}>
            {L("Cancelar","Cancel")}
          </button>
        </div>
      )}

      {/* Modal: añadir */}
      {addModal && (
        <AddModal
          pedidoId={addModal.pedidoId}
          pedidoLabel={addModal.pedidoLabel}
          vehiculos={vehiculosEmpresa || []}
          tramos={tramos}
          horaCtx={addModal.horaIni}
          horaVueltaCtx={addModal.horaVuelta}
          onConfirm={onAddConfirm}
          onClose={() => setAddModal(null)}
          L={L}/>
      )}

      {/* Modal: editar tramo */}
      {editModal && (
        <EditTramoModal
          tramo={editModal.tramo}
          veh={editModal.veh}
          pedidoLabel={editModal.pedidoLabel}
          onSave={form => { setTramos(p => p.map(t => t.id === form.id ? form : t)); setEditModal(null); }}
          onDelete={id => { setTramos(p => p.filter(t => t.id !== id)); setEditModal(null); }}
          onClose={() => setEditModal(null)}
          L={L}/>
      )}
    </div>
  );
}
