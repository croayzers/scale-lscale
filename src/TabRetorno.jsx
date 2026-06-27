import React, { useState, useMemo } from "react";
import { RotateCcw, ArrowRight, Check, Loader, X, Package } from "lucide-react";
import { C, Btn } from "./lib/ui.jsx";
import { actualizarMaterial, registrarRetorno } from "./lib/data.js";
import { cantidadPropiaRetornable, cantidadSubalquilada, limitarRetornoAlmacen } from "./lib/retornos.js";
import { nivelMaterial, caps } from "./lib/gestion.js";

const CHIP_ESTADO = {
  reservado:  { bg:"#f1f5f9", ink:"#64748b" },
  confirmado: { bg:"#dcfce7", ink:"#16a34a" },
  retorno:    { bg:"#fef3c7", ink:"#d97706" },
  finalizado: { bg:"#dbeafe", ink:"#2563eb" },
  cancelado:  { bg:"#fee2e2", ink:"#dc2626" },
};

// Estado de recepción de cada línea al volver (ERP — migración 016).
const ESTADOS_RECEPCION = [
  { id:"Apto",       label:"Apto",       bg:C.okSoft,   ink:C.ok,   merma:false },
  { id:"Cuarentena", label:"Cuarentena", bg:"#fef9c3",  ink:"#ca8a04", merma:false },
  { id:"Roto",       label:"Roto",       bg:C.warnSoft, ink:C.warn, merma:true },
  { id:"Perdido",    label:"Perdido",    bg:"#fee2e2",  ink:"#dc2626", merma:true },
];
const RESPONSABLES = ["Cliente","Proveedor","Almacen"];

/* ─── Modal de retorno ────────────────────────────────────────────────────── */
function RetornoModal({ pedido, materiales, onConfirm, onCancel, saving }) {
  // Agrupar lineas por categoría, pre-rellenar con cantidad del pedido
  const lineas = pedido.lineas || [];

  const [cantidades, setCantidades] = useState(() => {
    const init = {};
    lineas.forEach((l, i) => { init[i] = String(cantidadPropiaRetornable(l)); });
    return init;
  });

  // Estado de recepción + responsable de merma por línea (ERP).
  const [recepcion, setRecepcion] = useState(() => {
    const init = {};
    lineas.forEach((_, i) => { init[i] = { estado: "Apto", responsable: null }; });
    return init;
  });
  const setRec = (idx, patch) => setRecepcion(p => ({ ...p, [idx]: { ...p[idx], ...patch } }));
  const esMerma = (idx) => ESTADOS_RECEPCION.find(e => e.id === (recepcion[idx]?.estado))?.merma;

  const categorias = useMemo(() => {
    const cats = {};
    lineas.forEach((l, i) => {
      const cat = l.categoria || "(sin categoría)";
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push({ ...l, _idx: i });
    });
    return cats;
  }, [lineas]);

  const totalLineas   = lineas.length;
  const totalRetorno  = Object.values(cantidades).reduce((s, v) => s + (Number(v) || 0), 0);
  const totalPedido   = lineas.reduce((s, l) => s + (Number(l.cantidad) || 0), 0);
  const totalPropio   = lineas.reduce((s, l) => s + cantidadPropiaRetornable(l), 0);
  const totalProveedor= lineas.reduce((s, l) => s + cantidadSubalquilada(l), 0);

  const setTodos = () => {
    const next = {};
    lineas.forEach((l, i) => { next[i] = String(cantidadPropiaRetornable(l)); });
    setCantidades(next);
  };
  const setNada = () => {
    const next = {};
    lineas.forEach((_, i) => { next[i] = "0"; });
    setCantidades(next);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:600,
      display:"grid", placeItems:"center", padding:16 }} onClick={onCancel}>
      <div style={{ background:C.surface, borderRadius:18, width:"100%", maxWidth:640,
        maxHeight:"90vh", display:"flex", flexDirection:"column",
        boxShadow:"var(--shadow-lg)" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:"18px 22px 14px", borderBottom:`1px solid ${C.line}`,
          display:"flex", alignItems:"flex-start", gap:12, flexShrink:0 }}>
          <div style={{ background:"var(--warn-soft)", color:"var(--warn)",
            borderRadius:10, padding:8, flexShrink:0 }}>
            <RotateCcw size={18}/>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:15 }}>
              Registrar retorno — {pedido.codigo || `PED-${pedido.id}`}
            </div>
            <div style={{ fontSize:12.5, color:C.sub, marginTop:2 }}>
              {pedido.nombre}{pedido.destino ? ` · ${pedido.destino}` : ""}
            </div>
          </div>
          <button onClick={onCancel}
            style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, padding:4, display:"flex" }}>
            <X size={18}/>
          </button>
        </div>

        {/* Controles rápidos */}
        <div style={{ padding:"10px 22px", borderBottom:`1px solid ${C.line}`,
          display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          <span style={{ fontSize:12, color:C.sub, flex:1 }}>
            {totalLineas} líneas · retorno: <strong style={{ color: totalRetorno === totalPropio ? C.ok : C.warn }}>
              {totalRetorno} / {totalPropio} uds propias
            </strong>
            {totalProveedor > 0 && (
              <span style={{ marginLeft:6, color:C.warn }}>
                · {totalProveedor} uds proveedor no vuelven al almacén
              </span>
            )}
          </span>
          <button onClick={setTodos}
            style={{ padding:"4px 12px", borderRadius:999, border:`1px solid ${C.ok}`,
              background:C.okSoft, color:C.ok, fontSize:12, fontWeight:600,
              cursor:"pointer", fontFamily:"inherit" }}>
            ✓ Todo vuelve
          </button>
          <button onClick={setNada}
            style={{ padding:"4px 12px", borderRadius:999, border:`1px solid ${C.line}`,
              background:C.s2, color:C.sub, fontSize:12,
              cursor:"pointer", fontFamily:"inherit" }}>
            Todo a 0
          </button>
        </div>

        {/* Lista de líneas */}
        <div style={{ flex:1, overflowY:"auto", padding:"8px 22px 16px" }}>
          {Object.entries(categorias).map(([cat, items]) => (
            <div key={cat} style={{ marginTop:14 }}>
              <div style={{ fontSize:10.5, fontWeight:700, color:C.sub, letterSpacing:.6,
                textTransform:"uppercase", marginBottom:6, paddingBottom:4,
                borderBottom:`1px solid ${C.line}` }}>
                {cat}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                {items.map(linea => {
                  const idx = linea._idx;
                  const val = cantidades[idx] ?? "";
                  const orig = Number(linea.cantidad) || 0;
                  const propio = cantidadPropiaRetornable(linea);
                  const sub = cantidadSubalquilada(linea);
                  const cur  = Number(val) || 0;
                  const diff = cur - propio;
                  const rec = recepcion[idx] || { estado:"Apto", responsable:null };
                  const merma = esMerma(idx);
                  return (
                    <div key={idx} style={{ display:"flex", flexDirection:"column", gap:6,
                      padding:"6px 8px", borderRadius:8,
                      background: cur === 0 ? C.s2 : "transparent",
                      borderLeft: merma ? `3px solid ${C.warn}` : "3px solid transparent" }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr auto auto",
                      gap:10, alignItems:"center" }}>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, color: cur === 0 ? C.dim : C.ink,
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                          textDecoration: cur === 0 ? "line-through" : "none" }}>
                          {linea.nombre}
                        </div>
                        {linea.referencia && (
                          <div style={{ fontSize:10.5, color:C.dim }}>{linea.referencia}</div>
                        )}
                        {sub > 0 && (
                          <div style={{ fontSize:10.5, color:C.warn, marginTop:2 }}>
                            Proveedor: {sub} uds · no se suman al almacén
                          </div>
                        )}
                      </div>
                      {/* Cantidad original */}
                      <div style={{ fontSize:11.5, color:C.sub, whiteSpace:"nowrap", textAlign:"right" }}>
                        pedido: <strong style={{ color:C.ink }}>{orig}</strong>
                        {sub > 0 && <div>propio: <strong style={{ color:C.ink }}>{propio}</strong></div>}
                      </div>
                      {/* Input retorno */}
                      <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                        <button onClick={() => setCantidades(p => ({ ...p, [idx]: String(Math.max(0, (Number(p[idx])||0) - 1)) }))}
                          style={{ width:22, height:22, borderRadius:6, border:`1px solid ${C.strong}`,
                            background:C.s2, cursor:"pointer", fontSize:14, lineHeight:1,
                            display:"flex", alignItems:"center", justifyContent:"center", color:C.ink, fontFamily:"inherit" }}>
                          −
                        </button>
                        <input
                          type="number" min={0} max={propio}
                          value={val}
                          disabled={propio === 0}
                          onChange={e => setCantidades(p => ({ ...p, [idx]: String(limitarRetornoAlmacen(linea, e.target.value)) }))}
                          onFocus={e => e.target.select()}
                          style={{ width:52, padding:"4px 6px", border:`1.5px solid ${
                            diff < 0 ? C.warn : diff > 0 ? C.ok : C.strong
                          }`, borderRadius:7, fontSize:13, fontWeight:700,
                            fontFamily:"inherit", textAlign:"center", outline:"none",
                            background: diff < 0 ? C.warnSoft : diff > 0 ? C.okSoft : C.s2,
                            color: diff < 0 ? C.warn : diff > 0 ? C.ok : C.ink,
                            opacity: propio === 0 ? 0.55 : 1 }}/>
                        <button onClick={() => setCantidades(p => ({ ...p, [idx]: String(Math.min(propio, (Number(p[idx])||0) + 1)) }))}
                          disabled={propio === 0}
                          style={{ width:22, height:22, borderRadius:6, border:`1px solid ${C.strong}`,
                            background:C.s2, cursor: propio === 0 ? "not-allowed" : "pointer", fontSize:14, lineHeight:1,
                            display:"flex", alignItems:"center", justifyContent:"center", color:C.ink, fontFamily:"inherit" }}>
                          +
                        </button>
                        {/* Indicador diferencia */}
                        {diff !== 0 && (
                          <span style={{ fontSize:10, fontWeight:700, minWidth:28, textAlign:"center",
                            color: diff < 0 ? C.warn : C.ok }}>
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Renglón ERP: estado de recepción + responsable de merma */}
                    <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                      <span style={{ fontSize:10, color:C.dim, marginRight:2 }}>Estado:</span>
                      {ESTADOS_RECEPCION.map(es => (
                        <button key={es.id} type="button"
                          onClick={() => setRec(idx, { estado: es.id, responsable: es.merma ? (rec.responsable || "Cliente") : null })}
                          style={{ padding:"2px 9px", borderRadius:999, cursor:"pointer", fontFamily:"inherit",
                            fontSize:11, fontWeight: rec.estado === es.id ? 700 : 500,
                            border:`1.5px solid ${rec.estado === es.id ? es.ink : C.line}`,
                            background: rec.estado === es.id ? es.bg : C.s2,
                            color: rec.estado === es.id ? es.ink : C.sub }}>
                          {es.label}
                        </button>
                      ))}
                      {merma && (
                        <span style={{ display:"flex", alignItems:"center", gap:5, marginLeft:4 }}>
                          <span style={{ fontSize:10, color:C.dim }}>Responsable:</span>
                          <select value={rec.responsable || "Cliente"}
                            onChange={e => setRec(idx, { responsable: e.target.value })}
                            style={{ fontSize:11, padding:"2px 6px", borderRadius:7,
                              border:`1.5px solid ${C.warn}`, background:C.warnSoft, color:C.warn,
                              fontFamily:"inherit", fontWeight:600, cursor:"pointer" }}>
                            {RESPONSABLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </span>
                      )}
                    </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {lineas.length === 0 && (
            <div style={{ padding:32, textAlign:"center", color:C.sub, fontSize:13 }}>
              <Package size={28} color={C.line} style={{ marginBottom:8 }}/>
              <p style={{ margin:0 }}>Este pedido no tiene líneas de material.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:"12px 22px", borderTop:`1px solid ${C.line}`, flexShrink:0,
          display:"flex", justifyContent:"flex-end", gap:10 }}>
          <Btn outline onClick={onCancel}>Cancelar</Btn>
          <Btn color={C.ok} disabled={saving}
            onClick={() => onConfirm(cantidades, recepcion)}>
            {saving ? <Loader size={13} className="spin"/> : <RotateCcw size={13}/>}
            Confirmar retorno
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ─── TabRetorno ──────────────────────────────────────────────────────────── */
export default function TabRetorno({ pedidos = [], setPedidos, vehiculosEmpresa = [],
    materiales = [], setMateriales, modo = "demo", empresa,
    gestion = { nivel: "operativo", categorias: {} },
    onSavePedido, onNotificarStock, onNotificarEvento, formatoFecha = "DD/MM/YYYY", L }) {
  const [filtro,       setFiltro]      = useState("activos");
  const [saving,       setSaving]      = useState(null);
  const [retornoModal, setRetornoModal]= useState(null); // pedido a registrar

  const visibles = pedidos.filter(p => {
    if (filtro === "activos")     return p.estado === "confirmado" || p.estado === "retorno";
    if (filtro === "finalizados") return p.estado === "finalizado";
    return p.estado !== "cancelado" && p.estado !== "reservado";
  }).sort((a, b) => (b.fecha_entrega || "").localeCompare(a.fecha_entrega || ""));

  const vehById = Object.fromEntries((vehiculosEmpresa || []).map(v => [String(v.id), v]));

  const cambiarEstado = async (pedido, nuevoEstado) => {
    setSaving(pedido.id);
    const hoy = new Date().toISOString().slice(0, 10);
    const updated = {
      ...pedido,
      estado: nuevoEstado,
      ...(nuevoEstado === "retorno"    && !pedido.fecha_entrega ? { fecha_entrega: hoy } : {}),
      ...(nuevoEstado === "finalizado" && !pedido.fecha_retorno ? { fecha_retorno: hoy } : {}),
    };
    setPedidos(prev => prev.map(p => p.id === updated.id ? updated : p));
    await onSavePedido?.(updated);
    setSaving(null);
  };

  /* ── Confirmar retorno con cantidades ──────────────────────────────────── */
  const confirmarRetorno = async (pedido, cantidades, recepcion = {}) => {
    setSaving(pedido.id);
    const hoy = new Date().toISOString().slice(0, 10);
    const lineas = pedido.lineas || [];

    // Guardar cantidades + estado de recepción de retorno en el pedido
    const lineasConRetorno = lineas.map((l, i) => ({
      ...l,
      _retorno: limitarRetornoAlmacen(l, cantidades[i]),
      _retorno_proveedor: cantidadSubalquilada(l),
      _estado_recepcion: recepcion[i]?.estado || "Apto",
      _responsable_merma: recepcion[i]?.responsable || null,
    }));

    // Registrar retornos en la tabla real (ERP): cada línea Roto/Perdido dispara
    // el trigger financiero (cargos_merma / deudas_proveedor + evento).
    const companyId = empresa?.id ?? empresa?.company_id;
    if (modo === "supabase" && companyId) {
      for (let i = 0; i < lineas.length; i++) {
        const l = lineas[i];
        const rec = recepcion[i] || { estado: "Apto" };
        // Solo materializamos retornos con estado relevante (merma) o cantidad propia retornada.
        const esMerma = rec.estado === "Roto" || rec.estado === "Perdido";
        const cantRet = limitarRetornoAlmacen(l, cantidades[i]);
        if (!esMerma && cantRet === 0 && rec.estado === "Apto") continue;
        // Estadio 2: solo se registra en BD (cargos/deudas) si el material tiene finanzas.
        // En gestión operativa, la merma se guarda como estado en el pedido (jsonb) pero
        // NO genera cargos/deudas — el estado ya queda en lineasConRetorno.
        const matRet = (materiales || []).find(m => m.id === l.material_id);
        if (!caps(nivelMaterial(gestion, matRet || { categoria: l.categoria })).finanzas) continue;
        const origenCoste = (l.proveedor_id || l._origen_logistico === "subalquiler" || l.tipo_origen === "subalquiler")
          ? "Alquiler_Proveedor" : "Almacen_Propio";
        try {
          await registrarRetorno({
            pedido_id: pedido.id,
            linea_pedido_id: l.linea_pedido_id ?? null,
            material_id: l.material_id ?? null,
            cantidad: esMerma ? (Number(l.cantidad) || cantRet) : cantRet,
            estado_recepcion: rec.estado,
            responsable_merma: esMerma ? (rec.responsable || "Cliente") : null,
            origen_coste: origenCoste,
            proveedor_id: l.proveedor_id ?? null,
          }, companyId);
        } catch (e) { console.error("registrarRetorno:", e?.message); }
      }
    }

    // Actualizar stock de materiales
    const nuevosMateriales = [...materiales];
    for (let i = 0; i < lineas.length; i++) {
      const linea = lineas[i];
      const estadoRec = recepcion[i]?.estado || "Apto";
      // Roto/Perdido NO vuelve al stock (es merma). Cuarentena tampoco hasta revisar.
      if (estadoRec !== "Apto") continue;
      const cantRet = limitarRetornoAlmacen(linea, cantidades[i]);
      if (cantRet === 0) continue;

      // Buscar material por id o por nombre normalizado
      const matIdx = nuevosMateriales.findIndex(m =>
        (linea.material_id && m.id === linea.material_id) ||
        m.nombre?.trim().toLowerCase() === linea.nombre?.trim().toLowerCase()
      );
      if (matIdx === -1) continue;

      const mat = nuevosMateriales[matIdx];
      const nuevoStock = (Number(mat.stock_actual) || 0) + cantRet;
      nuevosMateriales[matIdx] = { ...mat, stock_actual: nuevoStock };

      if (modo === "supabase") {
        try { await actualizarMaterial(mat.id, { stock_actual: nuevoStock }); }
        catch (e) { console.error("Error actualizando stock:", e); }
      }
    }
    setMateriales(nuevosMateriales);

    // Finalizar pedido
    const updated = {
      ...pedido,
      estado: "finalizado",
      fecha_retorno: pedido.fecha_retorno || hoy,
      lineas: lineasConRetorno,
    };
    setPedidos(prev => prev.map(p => p.id === updated.id ? updated : p));
    await onSavePedido?.(updated);

    // Notificar retorno de materiales al almacén
    if (onNotificarStock) {
      onNotificarStock(updated, nuevosMateriales, "retorno");
    }
    // Notificación in-app a la empresa (campanita cross-app)
    const codigoPed = updated.codigo || updated.referencia || "";
    onNotificarEvento?.("retorno", "Retorno registrado", updated.nombre || codigoPed, codigoPed);

    setSaving(null);
    setRetornoModal(null);
  };

  const fmtF = iso => { if (!iso) return "—"; const [y,m,d] = iso.split("-"); return formatoFecha === "MM/DD/YYYY" ? `${m}/${d}/${y}` : formatoFecha === "DD-MM-YYYY" ? `${d}-${m}-${y}` : `${d}/${m}/${y}`; };

  const FILTROS = [
    { id:"activos",     label: L("En curso","In progress") },
    { id:"finalizados", label: L("Finalizados","Finalized") },
    { id:"todos",       label: L("Todos","All") },
  ];

  return (
    <div style={{ padding:"16px 20px", maxWidth:900, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <div style={{ background:"var(--warn-soft)", color:"var(--warn)", borderRadius:12, padding:10 }}><RotateCcw size={22}/></div>
        <div style={{ flex:1 }}>
          <h2 style={{ fontSize:18, margin:0 }}>{L("Retorno / Cierre","Return / Close")}</h2>
          <p style={{ color:C.sub, fontSize:13, margin:0 }}>{L("Seguimiento de pedidos en ruta y registro de retornos.","Track dispatched orders and log returns.")}</p>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {FILTROS.map(ft => (
            <button key={ft.id} onClick={() => setFiltro(ft.id)}
              style={{ padding:"6px 14px", borderRadius:999, border:`1.5px solid ${filtro === ft.id ? C.brand : C.line}`,
                background: filtro === ft.id ? C.brandSoft : C.s2, color: filtro === ft.id ? C.brand : C.sub,
                fontWeight: filtro === ft.id ? 700 : 400, fontSize:12.5, cursor:"pointer", fontFamily:"inherit" }}>
              {ft.label}
            </button>
          ))}
        </div>
      </div>

      {visibles.length === 0 ? (
        <div style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:14, padding:40, textAlign:"center" }}>
          <Check size={30} color={C.ok} style={{ marginBottom:10 }}/>
          <p style={{ color:C.sub, fontSize:14, margin:0 }}>
            {filtro === "activos"
              ? L("No hay pedidos en ruta — todo al día.","No orders in transit — all clear.")
              : L("Sin pedidos en este filtro.","No orders match this filter.")}
          </p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {visibles.map(p => {
            const chip     = CHIP_ESTADO[p.estado] || CHIP_ESTADO.reservado;
            const veh      = vehById[String(p.vehiculo_id)] || null;
            const isSaving = saving === p.id;
            const nLineas  = (p.lineas || []).length;
            return (
              <div key={p.id} style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:14,
                padding:"14px 18px", display:"flex", gap:14, alignItems:"center", flexWrap:"wrap" }}>
                <span style={{ padding:"3px 10px", borderRadius:999, background:chip.bg, color:chip.ink,
                  fontSize:11.5, fontWeight:700, flexShrink:0, textTransform:"capitalize" }}>{p.estado}</span>

                <div style={{ flex:1, minWidth:160 }}>
                  <div style={{ fontWeight:700, fontSize:14.5 }}>{p.codigo || `PED-${p.id}`}</div>
                  <div style={{ color:C.sub, fontSize:12.5, marginTop:2 }}>
                    {p.nombre && <span>{p.nombre}</span>}
                    {p.destino && <span> · 📍{p.destino}</span>}
                    {nLineas > 0 && (
                      <span style={{ marginLeft:6, fontSize:11, background:C.s2,
                        border:`1px solid ${C.line}`, borderRadius:999, padding:"1px 7px", color:C.sub }}>
                        {nLineas} líneas
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ fontSize:12, color:C.sub, minWidth:120 }}>
                  {p.fecha_entrega && <div>📅 {L("Salida","Out")}: <strong style={{ color:C.ink }}>{fmtF(p.fecha_entrega)}{p.hora_ida ? ` ${p.hora_ida}` : ""}</strong></div>}
                  {p.fecha_retorno && <div>🏠 {L("Retorno","Return")}: <strong style={{ color:C.ink }}>{fmtF(p.fecha_retorno)}{p.hora_vuelta ? ` ${p.hora_vuelta}` : ""}</strong></div>}
                </div>

                {veh && (
                  <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px",
                    borderRadius:8, background:`${veh.color}18`, border:`1px solid ${veh.color}44`,
                    fontSize:12.5, color:veh.color, fontWeight:600, flexShrink:0 }}>
                    🚐 {veh.nombre}{veh.matricula ? ` · ${veh.matricula}` : ""}
                  </div>
                )}

                <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                  {p.estado === "confirmado" && (
                    <Btn onClick={() => cambiarEstado(p, "retorno")} disabled={isSaving}
                      color="#d97706" style={{ fontSize:12, padding:"6px 12px" }}>
                      {isSaving ? <Loader size={13}/> : <ArrowRight size={13}/>}
                      {L("Salida","Depart")}
                    </Btn>
                  )}
                  {p.estado === "retorno" && (
                    <Btn onClick={() => setRetornoModal(p)} disabled={isSaving}
                      color={C.ok} style={{ fontSize:12, padding:"6px 12px" }}>
                      <RotateCcw size={13}/>
                      {L("Registrar retorno","Log return")}
                    </Btn>
                  )}
                  {p.estado === "finalizado" && (
                    <div style={{ display:"flex", flexDirection:"column", gap:2, alignItems:"flex-end" }}>
                      <span style={{ fontSize:12, color:C.ok, fontWeight:600, display:"flex", alignItems:"center", gap:4 }}>
                        <Check size={13}/>{L("Finalizado","Finalized")}
                      </span>
                      {(p.lineas||[]).some(l => l._retorno != null) && (
                        <span style={{ fontSize:10.5, color:C.sub }}>
                          {(p.lineas||[]).reduce((s,l) => s + (l._retorno||0), 0)} uds retornadas
                        </span>
                      )}
                    </div>
                  )}
                  {(p.estado === "retorno" || p.estado === "finalizado") && (
                    <Btn onClick={() => cambiarEstado(p, "confirmado")} disabled={isSaving} outline
                      style={{ fontSize:12, padding:"6px 12px" }}>
                      ↩ {L("Revertir","Undo")}
                    </Btn>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {retornoModal && (
        <RetornoModal
          pedido={retornoModal}
          materiales={materiales}
          saving={saving === retornoModal.id}
          onConfirm={cantidades => confirmarRetorno(retornoModal, cantidades)}
          onCancel={() => setRetornoModal(null)}
        />
      )}
    </div>
  );
}
