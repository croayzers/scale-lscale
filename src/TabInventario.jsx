// MARK: - TabInventario [export default]
// MARK: - BottomSheet (móvil input)
// MARK: - ModalNuevoRecuento
// MARK: - SubvistaRecuento
// MARK: - SubvistaHistorial
// MARK: - SubvistaAnalisis
import React, { useState, useEffect, useRef, useMemo } from "react";
import { ClipboardCheck, Plus, X, Check, AlertTriangle, ChevronRight,
  RotateCcw, TrendingDown, TrendingUp, Minus, Loader, Package,
  BarChart2, Clock, ChevronDown } from "lucide-react";
import {
  cargarSesiones, cargarLineasSesion, cargarHistorico,
  abrirRecuento, actualizarLinea, cerrarRecuento, cancelarRecuento,
  SESIONES_DEMO, LINEAS_DEMO,
} from "./lib/dataRecuentos.js";

// ── Paleta ─────────────────────────────────────────────────────────────────
const C = {
  bg:"var(--bg)", surface:"var(--surface)", s2:"var(--surface-2)",
  line:"var(--border)", strong:"var(--border-strong)",
  ink:"var(--text)", sub:"var(--text-2)", dim:"var(--text-3)",
  brand:"var(--brand)", brandSoft:"var(--brand-soft)",
  ok:"var(--ok)", okSoft:"var(--ok-soft)",
  warn:"var(--warn)", warnSoft:"var(--warn-soft)",
  danger:"var(--danger)", dangerSoft:"var(--danger-soft)",
};

// ── Helpers ─────────────────────────────────────────────────────────────────
function Btn({ children, onClick, disabled, color = C.brand, outline = false, small = false, style: s = {} }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display:"inline-flex", alignItems:"center", gap:6,
        padding: small ? "6px 12px" : "9px 16px",
        borderRadius:999, border: outline ? `1px solid ${C.strong}` : "none",
        background: outline ? C.s2 : color, color: outline ? C.ink : "#fff",
        fontWeight:600, fontSize: small ? 12.5 : 13.5, cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 1, fontFamily:"inherit", ...s }}>
      {children}
    </button>
  );
}

function Chip({ children, active, color = C.brand, colorSoft, onClick }) {
  return (
    <button onClick={onClick}
      style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"5px 12px",
        borderRadius:999, border:`1px solid ${active ? color : C.line}`,
        background: active ? (colorSoft || C.brandSoft) : C.s2,
        color: active ? color : C.sub,
        fontWeight:600, fontSize:12.5, cursor:"pointer", fontFamily:"inherit", transition:"all .12s" }}>
      {children}
    </button>
  );
}

function difColor(d) {
  if (d == null) return { bg:"transparent", ink:C.dim };
  if (d > 0)  return { bg:C.okSoft,     ink:C.ok     };
  if (d < 0)  return { bg:C.dangerSoft, ink:C.danger  };
  return       { bg:C.s2,          ink:C.sub    };
}

function difLabel(d) {
  if (d == null) return "—";
  if (d > 0) return `+${d}`;
  if (d < 0) return `${d}`;
  return "=";
}

function diasDesde(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "hoy";
  if (d === 1) return "ayer";
  return `hace ${d} días`;
}

// ── BottomSheet (móvil) ───────────────────────────────────────────────────
// MARK: - BottomSheet (móvil input)
function BottomSheet({ linea, material, anteriorContada, onConfirm, onClose }) {
  const [val, setVal] = useState(linea.cantidad_contada != null ? String(linea.cantidad_contada) : "");
  const inputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  const numVal = val === "" ? null : Number(val);
  const dif    = numVal != null ? numVal - linea.cantidad_sistema : null;
  const dc     = difColor(dif);

  return (
    <div style={{ position:"fixed", inset:0, zIndex:900, display:"flex", flexDirection:"column", justifyContent:"flex-end" }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background:C.surface, borderRadius:"20px 20px 0 0", padding:"20px 20px 32px",
          boxShadow:"0 -8px 40px rgba(0,0,0,.18)", display:"flex", flexDirection:"column", gap:16 }}>

        {/* Handle */}
        <div style={{ width:40, height:4, borderRadius:2, background:C.strong, margin:"0 auto -8px" }}/>

        {/* Nombre material */}
        <div style={{ textAlign:"center" }}>
          <div style={{ fontWeight:700, fontSize:16, color:C.ink }}>{material?.nombre || "Material"}</div>
          {material?.referencia && <div style={{ fontSize:12, color:C.sub, marginTop:2 }}>{material.referencia}</div>}
          <div style={{ fontSize:12.5, color:C.sub, marginTop:4 }}>
            Stock sistema: <strong style={{ color:C.ink }}>{linea.cantidad_sistema} {material?.unidad || "ud"}</strong>
          </div>
        </div>

        {/* Input grande */}
        <div style={{ display:"flex", alignItems:"center", gap:12, justifyContent:"center" }}>
          <button onClick={() => setVal(v => String(Math.max(0, (Number(v) || 0) - 1)))}
            style={{ width:44, height:44, borderRadius:999, background:C.s2, border:`1px solid ${C.strong}`,
              fontSize:22, fontWeight:700, cursor:"pointer", color:C.ink, display:"flex", alignItems:"center", justifyContent:"center" }}>
            −
          </button>
          <input ref={inputRef} type="number" inputMode="numeric" value={val}
            onChange={e => setVal(e.target.value)}
            style={{ width:120, textAlign:"center", fontSize:"2rem", fontWeight:700, padding:"10px 8px",
              border:`2px solid ${C.strong}`, borderRadius:14, background:C.s2, color:C.ink,
              fontFamily:"inherit", outline:"none" }}/>
          <button onClick={() => setVal(v => String((Number(v) || 0) + 1))}
            style={{ width:44, height:44, borderRadius:999, background:C.s2, border:`1px solid ${C.strong}`,
              fontSize:22, fontWeight:700, cursor:"pointer", color:C.ink, display:"flex", alignItems:"center", justifyContent:"center" }}>
            +
          </button>
        </div>

        {/* Diferencia preview */}
        {dif !== null && (
          <div style={{ textAlign:"center", padding:"6px 16px", borderRadius:10,
            background:dc.bg, color:dc.ink, fontWeight:700, fontSize:14, margin:"0 auto" }}>
            {dif > 0 ? <TrendingUp size={14} style={{ verticalAlign:"middle", marginRight:4 }}/> : dif < 0 ? <TrendingDown size={14} style={{ verticalAlign:"middle", marginRight:4 }}/> : <Minus size={14} style={{ verticalAlign:"middle", marginRight:4 }}/>}
            Diferencia: {difLabel(dif)} {material?.unidad || "ud"}
          </div>
        )}

        {/* Botones acción */}
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {anteriorContada != null && (
            <button onClick={() => setVal(String(anteriorContada))}
              style={{ padding:"10px", borderRadius:12, border:`1px solid ${C.strong}`,
                background:C.s2, color:C.sub, fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"inherit",
                display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
              <RotateCcw size={14}/> Igual que anterior ({anteriorContada})
            </button>
          )}
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={onClose}
              style={{ flex:1, padding:"12px", borderRadius:12, border:`1px solid ${C.strong}`,
                background:"none", color:C.sub, fontWeight:600, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>
              Cancelar
            </button>
            <button onClick={() => onConfirm(numVal)}
              style={{ flex:2, padding:"12px", borderRadius:12, border:"none",
                background:C.brand, color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit",
                display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
              <Check size={16}/> Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal nuevo recuento ───────────────────────────────────────────────────
// MARK: - ModalNuevoRecuento
function ModalNuevoRecuento({ almacenes, materiales, onConfirm, onClose }) {
  const categorias = useMemo(() => [...new Set(materiales.map(m => m.categoria).filter(Boolean))].sort(), [materiales]);
  const [nombre,     setNombre]     = useState("");
  const [almacenId,  setAlmacenId]  = useState(null);
  const [catsFiltro, setCatsFiltro] = useState([]);
  const [notas,      setNotas]      = useState("");

  const toggleCat = (c) => setCatsFiltro(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);

  const nMats = useMemo(() => {
    let m = materiales.filter(x => x.estado !== "descatalogado");
    if (almacenId != null) m = m.filter(x => x.almacen_id === almacenId || x.almacen_id == null);
    if (catsFiltro.length) m = m.filter(x => catsFiltro.includes(x.categoria));
    return m.length;
  }, [materiales, almacenId, catsFiltro]);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:700,
      display:"grid", placeItems:"center", padding:16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background:C.surface, borderRadius:18, width:"100%", maxWidth:480,
          boxShadow:"var(--shadow-lg)", display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* Header */}
        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.line}`,
          display:"flex", alignItems:"center", gap:10 }}>
          <ClipboardCheck size={18} color={C.brand}/>
          <div style={{ flex:1, fontWeight:700, fontSize:15 }}>Nuevo recuento</div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, display:"flex" }}>
            <X size={18}/>
          </button>
        </div>

        {/* Cuerpo */}
        <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:14, overflowY:"auto", maxHeight:"60vh" }}>

          <div>
            <label style={{ fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.5, display:"block", marginBottom:4 }}>NOMBRE (opcional)</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder={`Recuento ${new Date().toLocaleDateString("es-ES")}`}
              style={{ width:"100%", padding:"8px 10px", border:`1px solid ${C.strong}`, borderRadius:9,
                fontSize:13.5, fontFamily:"inherit", background:C.s2, color:C.ink, outline:"none", boxSizing:"border-box" }}/>
          </div>

          <div>
            <label style={{ fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.5, display:"block", marginBottom:6 }}>ALMACÉN</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              <Chip active={almacenId == null} onClick={() => setAlmacenId(null)}>Todos</Chip>
              {almacenes.map(a => (
                <Chip key={a.id} active={almacenId === a.id} onClick={() => setAlmacenId(a.id)}>{a.nombre}</Chip>
              ))}
            </div>
          </div>

          {categorias.length > 0 && (
            <div>
              <label style={{ fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.5, display:"block", marginBottom:6 }}>CATEGORÍAS (vacío = todas)</label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {categorias.map(c => (
                  <Chip key={c} active={catsFiltro.includes(c)} onClick={() => toggleCat(c)}>{c}</Chip>
                ))}
              </div>
            </div>
          )}

          <div>
            <label style={{ fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.5, display:"block", marginBottom:4 }}>NOTAS</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
              placeholder="Observaciones del recuento…"
              style={{ width:"100%", padding:"8px 10px", border:`1px solid ${C.strong}`, borderRadius:9,
                fontSize:13.5, fontFamily:"inherit", background:C.s2, color:C.ink, outline:"none",
                resize:"vertical", boxSizing:"border-box" }}/>
          </div>

          <div style={{ fontSize:13, color:C.sub, padding:"8px 12px", background:C.s2, borderRadius:8 }}>
            Se incluirán <strong style={{ color:C.ink }}>{nMats} materiales</strong> en este recuento.
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:"12px 20px", borderTop:`1px solid ${C.line}`, display:"flex", gap:10, justifyContent:"flex-end" }}>
          <Btn outline onClick={onClose}>Cancelar</Btn>
          <Btn disabled={nMats === 0} onClick={() => onConfirm({ nombre, almacen_id: almacenId, notas, categoriasFiltro: catsFiltro })}>
            <ClipboardCheck size={15}/> Iniciar recuento
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ── Sub-vista Recuento activo ──────────────────────────────────────────────
// MARK: - SubvistaRecuento
function SubvistaRecuento({ sesionActiva, lineas, materiales, almacenes, modo, sesion: sesionUser,
  onNuevo, onActualizarLinea, onCerrar, onCancelar, historico }) {

  const [filtro,      setFiltro]      = useState("todos"); // todos | pendientes | diferencia
  const [bottomSheet, setBottomSheet] = useState(null);    // lineaId abierto en móvil
  const [inlineEdit,  setInlineEdit]  = useState(null);    // { id, val } para desktop
  const [cerrando,    setCerrando]    = useState(false);
  const [cancelConf,  setCancelConf]  = useState(false);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  // Líneas enriquecidas con datos del material
  const lineasRich = useMemo(() => lineas.map(l => ({
    ...l,
    material: materiales.find(m => m.id === l.material_id) || null,
  })), [lineas, materiales]);

  // Mapa: material_id → cantidad contada en el recuento ANTERIOR cerrado
  const anteriorMap = useMemo(() => {
    const { sesiones: ses, lineas: lins } = historico;
    // Sesiones cerradas ordenadas desc (más reciente primero), excluyendo la activa
    const cerradas = ses.filter(s => s.estado === "cerrada").sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at));
    if (!cerradas.length) return {};
    const ultima = cerradas[0];
    const map = {};
    lins.filter(l => l.sesion_id === ultima.id && l.cantidad_contada != null)
        .forEach(l => { map[l.material_id] = l.cantidad_contada; });
    return map;
  }, [historico]);

  const contadas   = lineasRich.filter(l => l.cantidad_contada != null).length;
  const total      = lineasRich.length;
  const pct        = total > 0 ? Math.round((contadas / total) * 100) : 0;
  const conDif     = lineasRich.filter(l => l.diferencia != null && l.diferencia !== 0).length;
  const pendientes = lineasRich.filter(l => l.cantidad_contada == null).length;

  const lineasFiltradas = useMemo(() => {
    if (filtro === "pendientes") return lineasRich.filter(l => l.cantidad_contada == null);
    if (filtro === "diferencia") return lineasRich.filter(l => l.diferencia != null && l.diferencia !== 0);
    return lineasRich;
  }, [lineasRich, filtro]);

  const handleConfirmLinea = async (lineaId, val) => {
    setBottomSheet(null);
    setInlineEdit(null);
    await onActualizarLinea(lineaId, val);
  };

  const handleCerrar = async () => {
    setCerrando(true);
    await onCerrar();
    setCerrando(false);
  };

  // ── Sin sesión activa ──────────────────────────────────────────────────
  if (!sesionActiva) {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
        flex:1, gap:20, padding:32, textAlign:"center" }}>
        <div style={{ width:72, height:72, borderRadius:999, background:C.brandSoft,
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          <ClipboardCheck size={32} color={C.brand}/>
        </div>
        <div>
          <div style={{ fontWeight:700, fontSize:18, color:C.ink }}>Sin recuento activo</div>
          <div style={{ fontSize:14, color:C.sub, marginTop:6, maxWidth:320 }}>
            Inicia un recuento para comparar el stock físico con el sistema.
          </div>
        </div>
        <Btn onClick={onNuevo} style={{ fontSize:14, padding:"11px 22px" }}>
          <Plus size={16}/> Nuevo recuento
        </Btn>
      </div>
    );
  }

  // ── Con sesión activa ──────────────────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0 }}>

      {/* Banner progreso */}
      <div style={{ padding:"12px 16px", background:C.surface, borderBottom:`1px solid ${C.line}`, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8, gap:8, flexWrap:"wrap" }}>
          <div>
            <span style={{ fontWeight:700, fontSize:14, color:C.ink }}>{sesionActiva.nombre}</span>
            {sesionActiva.almacen_id != null && (
              <span style={{ fontSize:12, color:C.sub, marginLeft:8 }}>
                · {almacenes.find(a => a.id === sesionActiva.almacen_id)?.nombre || "Almacén"}
              </span>
            )}
          </div>
          <span style={{ fontSize:13, fontWeight:700, color:C.brand }}>{contadas} / {total} — {pct}%</span>
        </div>
        {/* Barra */}
        <div style={{ height:8, borderRadius:4, background:C.s2, overflow:"hidden" }}>
          <div style={{ height:"100%", borderRadius:4, background:C.brand, width:`${pct}%`, transition:"width .3s" }}/>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ padding:"10px 16px", borderBottom:`1px solid ${C.line}`, display:"flex", gap:6, flexWrap:"wrap", flexShrink:0 }}>
        <Chip active={filtro === "todos"} onClick={() => setFiltro("todos")}>Todos ({total})</Chip>
        <Chip active={filtro === "pendientes"} color={C.warn} colorSoft={C.warnSoft}
          onClick={() => setFiltro("pendientes")}>
          ⏳ Pendientes ({pendientes})
        </Chip>
        <Chip active={filtro === "diferencia"} color={C.danger} colorSoft={C.dangerSoft}
          onClick={() => setFiltro("diferencia")}>
          ⚠ Con diferencia ({conDif})
        </Chip>
      </div>

      {/* Tabla */}
      <div style={{ flex:1, overflowY:"auto", minHeight:0 }}>
        {lineasFiltradas.length === 0 ? (
          <div style={{ padding:32, textAlign:"center", color:C.dim, fontSize:14 }}>
            {filtro === "pendientes" ? "¡Todo contado! 🎉" : "Sin resultados para este filtro."}
          </div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13.5 }}>
            <thead>
              <tr style={{ background:C.s2, position:"sticky", top:0, zIndex:1 }}>
                <th style={{ padding:"8px 12px", textAlign:"left", fontWeight:700, fontSize:11, color:C.sub, letterSpacing:.5 }}>MATERIAL</th>
                <th style={{ padding:"8px 10px", textAlign:"right", fontWeight:700, fontSize:11, color:C.sub, letterSpacing:.5, whiteSpace:"nowrap" }}>SISTEMA</th>
                <th style={{ padding:"8px 10px", textAlign:"right", fontWeight:700, fontSize:11, color:C.sub, letterSpacing:.5, whiteSpace:"nowrap" }}>CONTADO</th>
                <th style={{ padding:"8px 10px", textAlign:"center", fontWeight:700, fontSize:11, color:C.sub, letterSpacing:.5, whiteSpace:"nowrap" }}>DIF.</th>
                <th style={{ width:36 }}/>
              </tr>
            </thead>
            <tbody>
              {lineasFiltradas.map((l, i) => {
                const dc      = difColor(l.diferencia);
                const editing = inlineEdit?.id === l.id;
                const mat     = l.material;
                return (
                  <tr key={l.id}
                    style={{ background: i % 2 === 0 ? C.bg : C.surface, cursor:"pointer",
                      borderBottom:`1px solid ${C.line}` }}
                    onClick={() => {
                      if (isMobile) { setBottomSheet(l.id); }
                      else { setInlineEdit({ id: l.id, val: l.cantidad_contada != null ? String(l.cantidad_contada) : "" }); }
                    }}>
                    {/* Nombre + detalles */}
                    <td style={{ padding:"10px 12px", verticalAlign:"middle" }}>
                      <div style={{ fontWeight:600, color:C.ink, lineHeight:1.3 }}>{mat?.nombre || `#${l.material_id}`}</div>
                      <div style={{ fontSize:11.5, color:C.sub, marginTop:1 }}>
                        {[mat?.referencia, mat?.categoria, mat?.ubicacion].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    {/* Sistema */}
                    <td style={{ padding:"10px", textAlign:"right", color:C.sub, fontVariantNumeric:"tabular-nums", verticalAlign:"middle" }}>
                      {l.cantidad_sistema} {mat?.unidad || ""}
                    </td>
                    {/* Contado — inline edit en desktop */}
                    <td style={{ padding:"6px 10px", textAlign:"right", verticalAlign:"middle", minWidth:80 }}
                      onClick={e => { if (!isMobile) { e.stopPropagation(); setInlineEdit({ id: l.id, val: l.cantidad_contada != null ? String(l.cantidad_contada) : "" }); }}}>
                      {editing ? (
                        <input type="number" inputMode="numeric" autoFocus
                          value={inlineEdit.val}
                          onChange={e => setInlineEdit(p => ({ ...p, val: e.target.value }))}
                          onBlur={() => { const n = inlineEdit.val === "" ? null : Number(inlineEdit.val); handleConfirmLinea(l.id, n); }}
                          onKeyDown={e => { if (e.key === "Enter") { const n = inlineEdit.val === "" ? null : Number(inlineEdit.val); handleConfirmLinea(l.id, n); } if (e.key === "Escape") setInlineEdit(null); }}
                          style={{ width:70, textAlign:"right", padding:"4px 6px", border:`1px solid ${C.brand}`, borderRadius:6,
                            fontSize:13.5, fontFamily:"inherit", background:C.surface, color:C.ink, outline:"none" }}
                          onClick={e => e.stopPropagation()}/>
                      ) : (
                        l.cantidad_contada != null
                          ? <span style={{ fontWeight:700, color:C.ink, fontVariantNumeric:"tabular-nums" }}>{l.cantidad_contada} {mat?.unidad || ""}</span>
                          : <span style={{ fontSize:12, color:C.dim, fontStyle:"italic" }}>Pendiente</span>
                      )}
                    </td>
                    {/* Diferencia */}
                    <td style={{ padding:"6px 10px", textAlign:"center", verticalAlign:"middle" }}>
                      {l.diferencia != null ? (
                        <span style={{ display:"inline-flex", alignItems:"center", gap:3, padding:"3px 8px",
                          borderRadius:6, background:dc.bg, color:dc.ink, fontWeight:700, fontSize:12.5,
                          fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap" }}>
                          {l.diferencia > 0 ? <TrendingUp size={11}/> : l.diferencia < 0 ? <TrendingDown size={11}/> : <Minus size={11}/>}
                          {difLabel(l.diferencia)}
                        </span>
                      ) : <span style={{ color:C.dim, fontSize:12 }}>—</span>}
                    </td>
                    {/* Botón igual que anterior */}
                    <td style={{ padding:"0 8px", verticalAlign:"middle" }}
                      onClick={e => e.stopPropagation()}>
                      {anteriorMap[l.material_id] != null && (
                        <button title={`Igual que anterior (${anteriorMap[l.material_id]})`}
                          onClick={() => handleConfirmLinea(l.id, anteriorMap[l.material_id])}
                          style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, padding:4,
                            display:"flex", alignItems:"center" }}>
                          <RotateCcw size={13}/>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer sticky */}
      <div style={{ padding:"12px 16px", borderTop:`1px solid ${C.line}`, background:C.surface,
        display:"flex", gap:10, justifyContent:"flex-end", flexShrink:0, flexWrap:"wrap" }}>
        {cancelConf ? (
          <>
            <span style={{ fontSize:13, color:C.sub, alignSelf:"center" }}>¿Cancelar el recuento? Se perderán los datos.</span>
            <Btn outline onClick={() => setCancelConf(false)} small>No</Btn>
            <Btn color={C.danger} onClick={onCancelar} small>Sí, cancelar</Btn>
          </>
        ) : (
          <>
            <Btn outline color={C.danger} onClick={() => setCancelConf(true)}>
              <X size={14}/> Cancelar recuento
            </Btn>
            <Btn color={C.ok} disabled={cerrando} onClick={handleCerrar}>
              {cerrando ? <Loader size={14} className="spin"/> : <Check size={14}/>}
              {cerrando ? "Cerrando…" : `Cerrar recuento${pendientes > 0 ? ` (${pendientes} sin contar)` : ""}`}
            </Btn>
          </>
        )}
      </div>

      {/* Bottom Sheet móvil */}
      {bottomSheet != null && (() => {
        const l = lineasRich.find(x => x.id === bottomSheet);
        if (!l) return null;
        return (
          <BottomSheet
            linea={l}
            material={l.material}
            anteriorContada={anteriorMap[l.material_id] ?? null}
            onConfirm={val => handleConfirmLinea(l.id, val)}
            onClose={() => setBottomSheet(null)}
          />
        );
      })()}
    </div>
  );
}

// ── Sub-vista Historial ────────────────────────────────────────────────────
// MARK: - SubvistaHistorial
function SubvistaHistorial({ historico, materiales }) {
  const { sesiones, lineas } = historico;
  const cerradas = useMemo(() => [...sesiones].filter(s => s.estado === "cerrada")
    .sort((a, b) => new Date(a.closed_at) - new Date(b.closed_at)), [sesiones]);
  const [maxSes, setMaxSes] = useState(6);
  const visibles = cerradas.slice(-maxSes);

  // Mapa material_id → { sesion_id → { contada, diferencia } }
  const mapa = useMemo(() => {
    const m = {};
    lineas.forEach(l => {
      if (!m[l.material_id]) m[l.material_id] = {};
      m[l.material_id][l.sesion_id] = { contada: l.cantidad_contada, diferencia: l.diferencia };
    });
    return m;
  }, [lineas]);

  // Materiales que aparecen en al menos una sesión visible
  const matsEnHistorico = useMemo(() => {
    const ids = new Set(lineas.filter(l => visibles.some(s => s.id === l.sesion_id)).map(l => l.material_id));
    return materiales.filter(m => ids.has(m.id)).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
  }, [lineas, visibles, materiales]);

  if (!cerradas.length) {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
        flex:1, gap:16, padding:32, textAlign:"center" }}>
        <BarChart2 size={40} color={C.dim}/>
        <div style={{ color:C.sub, fontSize:14 }}>Aún no hay recuentos cerrados.<br/>Cuando cierres el primero aparecerá aquí el historial.</div>
      </div>
    );
  }

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", minHeight:0 }}>
      {/* Header */}
      <div style={{ padding:"10px 16px", borderBottom:`1px solid ${C.line}`, display:"flex", alignItems:"center", gap:10, flexShrink:0, flexWrap:"wrap" }}>
        <span style={{ fontSize:13.5, fontWeight:700, color:C.ink }}>Historial de recuentos</span>
        <span style={{ fontSize:12.5, color:C.sub }}>{cerradas.length} sesiones cerradas</span>
        {cerradas.length > 6 && (
          <select value={maxSes} onChange={e => setMaxSes(Number(e.target.value))}
            style={{ marginLeft:"auto", padding:"4px 8px", borderRadius:8, border:`1px solid ${C.strong}`,
              background:C.s2, color:C.ink, fontSize:12.5, fontFamily:"inherit" }}>
            {[4,6,8,12,cerradas.length].filter((v,i,a) => a.indexOf(v) === i).map(v => (
              <option key={v} value={v}>Últimas {v}</option>
            ))}
          </select>
        )}
      </div>

      {/* Tabla scroll horizontal */}
      <div style={{ flex:1, overflow:"auto", minHeight:0 }}>
        <table style={{ borderCollapse:"collapse", fontSize:13, whiteSpace:"nowrap" }}>
          <thead>
            <tr style={{ background:C.s2, position:"sticky", top:0, zIndex:2 }}>
              <th style={{ padding:"8px 14px", textAlign:"left", fontWeight:700, fontSize:11, color:C.sub,
                letterSpacing:.5, position:"sticky", left:0, background:C.s2, zIndex:3, minWidth:160, borderRight:`1px solid ${C.line}` }}>
                MATERIAL
              </th>
              {visibles.map((s, i) => (
                <React.Fragment key={s.id}>
                  <th style={{ padding:"6px 12px", textAlign:"center", fontWeight:700, fontSize:11, color:C.brand, background:C.s2, minWidth:80 }}>
                    {new Date(s.closed_at).toLocaleDateString("es-ES", { day:"2-digit", month:"2-digit" })}
                    <div style={{ fontWeight:400, color:C.sub, fontSize:10, letterSpacing:0 }}>{new Date(s.closed_at).getFullYear()}</div>
                  </th>
                  {i > 0 && (
                    <th style={{ padding:"6px 10px", textAlign:"center", fontWeight:700, fontSize:10, color:C.sub, background:C.s2, minWidth:60 }}>
                      DIF.
                    </th>
                  )}
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {matsEnHistorico.map((mat, ri) => (
              <tr key={mat.id} style={{ background: ri % 2 === 0 ? C.bg : C.surface, borderBottom:`1px solid ${C.line}` }}>
                <td style={{ padding:"8px 14px", fontWeight:600, color:C.ink, position:"sticky", left:0,
                  background: ri % 2 === 0 ? C.bg : C.surface, zIndex:1, borderRight:`1px solid ${C.line}` }}>
                  {mat.nombre}
                  {mat.referencia && <span style={{ fontSize:11, color:C.sub, marginLeft:6 }}>{mat.referencia}</span>}
                </td>
                {visibles.map((s, i) => {
                  const dato = mapa[mat.id]?.[s.id];
                  const dc   = difColor(dato?.diferencia);
                  return (
                    <React.Fragment key={s.id}>
                      <td style={{ padding:"8px 12px", textAlign:"right", fontVariantNumeric:"tabular-nums" }}>
                        {dato?.contada != null
                          ? <span style={{ fontWeight:600, color:C.ink }}>{dato.contada}</span>
                          : <span style={{ color:C.dim, fontSize:11 }}>—</span>}
                      </td>
                      {i > 0 && (
                        <td style={{ padding:"6px 10px", textAlign:"center" }}>
                          {dato?.diferencia != null ? (
                            <span style={{ display:"inline-block", padding:"2px 7px", borderRadius:6,
                              background:dc.bg, color:dc.ink, fontWeight:700, fontSize:12,
                              fontVariantNumeric:"tabular-nums" }}>
                              {difLabel(dato.diferencia)}
                            </span>
                          ) : <span style={{ color:C.dim }}>—</span>}
                        </td>
                      )}
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sub-vista Análisis ─────────────────────────────────────────────────────
// MARK: - SubvistaAnalisis
function SubvistaAnalisis({ historico, materiales }) {
  const { sesiones, lineas } = historico;
  const cerradas = sesiones.filter(s => s.estado === "cerrada");

  // Variación acumulada por material
  const variaciones = useMemo(() => {
    const mapa = {};
    lineas.forEach(l => {
      if (!mapa[l.material_id]) mapa[l.material_id] = 0;
      if (l.diferencia != null) mapa[l.material_id] += l.diferencia;
    });
    return Object.entries(mapa)
      .map(([mid, total]) => {
        const mat = materiales.find(m => m.id === Number(mid));
        return { material_id: Number(mid), mat, total };
      })
      .filter(v => v.total !== 0)
      .sort((a, b) => a.total - b.total); // más negativo primero
  }, [lineas, materiales]);

  const perdidas   = variaciones.filter(v => v.total < 0);
  const ganancias  = variaciones.filter(v => v.total > 0);
  const costeTotal = perdidas.reduce((s, v) => s + (Math.abs(v.total) * (v.mat?.precio_coste || 0)), 0);

  const maxAbs = Math.max(1, ...variaciones.map(v => Math.abs(v.total)));
  const ultimaFecha = cerradas.length ? new Date([...cerradas].sort((a,b) => new Date(b.closed_at) - new Date(a.closed_at))[0].closed_at) : null;

  if (!cerradas.length) {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
        flex:1, gap:16, padding:32, textAlign:"center" }}>
        <BarChart2 size={40} color={C.dim}/>
        <div style={{ color:C.sub, fontSize:14 }}>Sin datos para analizar aún.</div>
      </div>
    );
  }

  return (
    <div style={{ height:"100%", overflowY:"auto", padding:"16px", display:"flex", flexDirection:"column", gap:16 }}>

      {/* Cards resumen */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))", gap:12 }}>
        <div style={{ padding:"14px 16px", borderRadius:14, background:C.brandSoft, border:`1px solid ${C.brand}33` }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.brand, letterSpacing:.5, marginBottom:6 }}>RECUENTOS</div>
          <div style={{ fontSize:24, fontWeight:800, color:C.brand }}>{cerradas.length}</div>
          {ultimaFecha && <div style={{ fontSize:12, color:C.brand, opacity:.8, marginTop:2 }}>Último {diasDesde(ultimaFecha)}</div>}
        </div>
        <div style={{ padding:"14px 16px", borderRadius:14, background:C.dangerSoft, border:`1px solid ${C.danger}33` }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.danger, letterSpacing:.5, marginBottom:6 }}>MATERIALES CON PÉRDIDA</div>
          <div style={{ fontSize:24, fontWeight:800, color:C.danger }}>{perdidas.length}</div>
          <div style={{ fontSize:12, color:C.danger, opacity:.8, marginTop:2 }}>
            {perdidas.reduce((s,v) => s + Math.abs(v.total), 0)} uds. totales
          </div>
        </div>
        {costeTotal > 0 && (
          <div style={{ padding:"14px 16px", borderRadius:14, background:"#fff3e0", border:`1px solid ${C.warn}33` }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.warn, letterSpacing:.5, marginBottom:6 }}>COSTE ESTIMADO PÉRDIDAS</div>
            <div style={{ fontSize:24, fontWeight:800, color:C.warn }}>{costeTotal.toFixed(2)}€</div>
            <div style={{ fontSize:12, color:C.warn, opacity:.8, marginTop:2 }}>basado en precio coste</div>
          </div>
        )}
        {ganancias.length > 0 && (
          <div style={{ padding:"14px 16px", borderRadius:14, background:C.okSoft, border:`1px solid ${C.ok}33` }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.ok, letterSpacing:.5, marginBottom:6 }}>MATERIALES CON GANANCIA</div>
            <div style={{ fontSize:24, fontWeight:800, color:C.ok }}>{ganancias.length}</div>
            <div style={{ fontSize:12, color:C.ok, opacity:.8, marginTop:2 }}>
              +{ganancias.reduce((s,v) => s + v.total, 0)} uds. totales
            </div>
          </div>
        )}
      </div>

      {/* Ranking */}
      {variaciones.length > 0 && (
        <div style={{ background:C.surface, borderRadius:14, border:`1px solid ${C.line}`, overflow:"hidden" }}>
          <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.line}`, fontWeight:700, fontSize:14, color:C.ink }}>
            Variación acumulada por material
          </div>
          <div style={{ display:"flex", flexDirection:"column" }}>
            {variaciones.map((v, i) => {
              const dc   = difColor(v.total);
              const pct  = Math.abs(v.total) / maxAbs * 100;
              return (
                <div key={v.material_id}
                  style={{ padding:"10px 16px", borderBottom: i < variaciones.length - 1 ? `1px solid ${C.line}` : "none",
                    display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, color:C.ink, fontSize:13.5,
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {v.mat?.nombre || `Material #${v.material_id}`}
                    </div>
                    {v.mat?.referencia && <div style={{ fontSize:11.5, color:C.sub }}>{v.mat.referencia}</div>}
                  </div>
                  {/* Barra */}
                  <div style={{ width:120, height:8, borderRadius:4, background:C.s2, overflow:"hidden", flexShrink:0 }}>
                    <div style={{ height:"100%", borderRadius:4, background:dc.ink, width:`${pct}%`, transition:"width .3s" }}/>
                  </div>
                  {/* Valor */}
                  <span style={{ width:48, textAlign:"right", fontWeight:700, fontSize:13.5,
                    color:dc.ink, fontVariantNumeric:"tabular-nums", flexShrink:0 }}>
                    {difLabel(v.total)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────
// MARK: - TabInventario [export default]
export default function TabInventario({ materiales, setMateriales, empresa, modo, almacenes, sesion }) {
  const [subvista,      setSubvista]      = useState("recuento");
  const [sesiones,      setSesiones]      = useState([]);
  const [lineasActivas, setLineasActivas] = useState([]);
  const [historico,     setHistorico]     = useState({ sesiones: [], lineas: [] });
  const [cargando,      setCargando]      = useState(true);
  const [modalNuevo,    setModalNuevo]    = useState(false);
  const [errMsg,        setErrMsg]        = useState(null);

  const companyId  = empresa?.id;
  const userEmail  = sesion?.user?.email || null;

  // Sesión abierta (solo puede haber una)
  const sesionActiva = useMemo(() => sesiones.find(s => s.estado === "abierta") || null, [sesiones]);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      setCargando(true);
      try {
        const [ses, hist] = await Promise.all([
          cargarSesiones(companyId),
          cargarHistorico(companyId),
        ]);
        setSesiones(ses);
        setHistorico(hist);
        const abierta = ses.find(s => s.estado === "abierta");
        if (abierta) {
          const lineas = await cargarLineasSesion(abierta.id);
          setLineasActivas(lineas);
        }
      } catch (e) { setErrMsg(e.message); }
      finally     { setCargando(false); }
    })();
  }, [companyId]);

  const handleNuevo = async (params) => {
    setModalNuevo(false);
    setErrMsg(null);
    try {
      const { sesion: nueva, lineas } = await abrirRecuento(params, companyId, materiales, userEmail);
      setSesiones(p => [nueva, ...p]);
      setLineasActivas(lineas);
    } catch (e) { setErrMsg(e.message); }
  };

  const handleActualizarLinea = async (lineaId, val) => {
    await actualizarLinea(lineaId, val, userEmail, modo);
    setLineasActivas(p => p.map(l => l.id === lineaId
      ? { ...l, cantidad_contada: val, diferencia: val != null ? val - l.cantidad_sistema : null }
      : l
    ));
  };

  const handleCerrar = async () => {
    if (!sesionActiva) return;
    try {
      await cerrarRecuento(sesionActiva.id, lineasActivas, setMateriales, userEmail, modo);
      // Recargar historial
      const hist = await cargarHistorico(companyId);
      setHistorico(hist);
      setSesiones(p => p.map(s => s.id === sesionActiva.id ? { ...s, estado: "cerrada", closed_at: new Date().toISOString() } : s));
      setLineasActivas([]);
    } catch (e) { setErrMsg(e.message); }
  };

  const handleCancelar = async () => {
    if (!sesionActiva) return;
    try {
      await cancelarRecuento(sesionActiva.id, modo);
      setSesiones(p => p.map(s => s.id === sesionActiva.id ? { ...s, estado: "cancelada" } : s));
      setLineasActivas([]);
    } catch (e) { setErrMsg(e.message); }
  };

  if (cargando) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", flex:1, gap:10, color:C.sub }}>
        <Loader size={18} className="spin"/> Cargando inventario…
      </div>
    );
  }

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", minHeight:0 }}>

      {/* Segmented control */}
      <div style={{ display:"flex", gap:2, padding:"10px 16px 0", borderBottom:`1px solid ${C.line}`,
        background:C.surface, flexShrink:0 }}>
        {[
          { id:"recuento",  label:"Recuento",  icon:<ClipboardCheck size={14}/> },
          { id:"historial", label:"Historial", icon:<Clock size={14}/> },
          { id:"analisis",  label:"Análisis",  icon:<BarChart2 size={14}/> },
        ].map(tab => (
          <button key={tab.id} onClick={() => setSubvista(tab.id)}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", cursor:"pointer",
              background:"none", border:"none", fontFamily:"inherit", fontWeight:600, fontSize:13.5,
              color: subvista === tab.id ? C.brand : C.sub,
              borderBottom: subvista === tab.id ? `2px solid ${C.brand}` : "2px solid transparent",
              marginBottom:-1, transition:"color .12s" }}>
            {tab.icon} {tab.label}
            {tab.id === "recuento" && sesionActiva && (
              <span style={{ width:7, height:7, borderRadius:"50%", background:C.brand, display:"inline-block", marginLeft:2 }}/>
            )}
          </button>
        ))}

        {/* Botón nuevo (visible cuando no hay sesión activa y estamos en Recuento) */}
        {subvista === "recuento" && !sesionActiva && (
          <button onClick={() => setModalNuevo(true)}
            style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6, padding:"6px 14px",
              borderRadius:999, border:"none", background:C.brand, color:"#fff",
              fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit", marginBottom:4, alignSelf:"center" }}>
            <Plus size={13}/> Nuevo
          </button>
        )}
      </div>

      {/* Error */}
      {errMsg && (
        <div style={{ margin:"8px 16px 0", padding:"8px 12px", borderRadius:8,
          background:C.dangerSoft, color:C.danger, fontSize:13, display:"flex", gap:8, alignItems:"center" }}>
          <AlertTriangle size={14}/> {errMsg}
          <button onClick={() => setErrMsg(null)} style={{ marginLeft:"auto", background:"none", border:"none", cursor:"pointer", color:C.danger }}>
            <X size={14}/>
          </button>
        </div>
      )}

      {/* Contenido */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0 }}>
        {subvista === "recuento" && (
          <SubvistaRecuento
            sesionActiva={sesionActiva}
            lineas={lineasActivas}
            materiales={materiales}
            almacenes={almacenes}
            modo={modo}
            sesion={sesion}
            historico={historico}
            onNuevo={() => setModalNuevo(true)}
            onActualizarLinea={handleActualizarLinea}
            onCerrar={handleCerrar}
            onCancelar={handleCancelar}
          />
        )}
        {subvista === "historial" && (
          <SubvistaHistorial historico={historico} materiales={materiales}/>
        )}
        {subvista === "analisis" && (
          <SubvistaAnalisis historico={historico} materiales={materiales}/>
        )}
      </div>

      {/* Modal nuevo recuento */}
      {modalNuevo && (
        <ModalNuevoRecuento
          almacenes={almacenes}
          materiales={materiales}
          onConfirm={handleNuevo}
          onClose={() => setModalNuevo(false)}
        />
      )}
    </div>
  );
}
