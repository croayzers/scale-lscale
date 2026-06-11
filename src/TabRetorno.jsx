import React, { useState } from "react";
import { RotateCcw, ArrowRight, Check, Loader } from "lucide-react";
import { C, Btn } from "./lib/ui.jsx";

const CHIP_ESTADO = {
  borrador:   { bg:"#f1f5f9", ink:"#64748b" },
  confirmado: { bg:"#dcfce7", ink:"#16a34a" },
  planificado:{ bg:"#dbeafe", ink:"#2563eb" },
  en_ruta:    { bg:"#fef3c7", ink:"#d97706" },
  entregado:  { bg:"#dcfce7", ink:"#16a34a" },
  cancelado:  { bg:"#fee2e2", ink:"#dc2626" },
};

export default function TabRetorno({ pedidos = [], setPedidos, vehiculosEmpresa = [], onSavePedido, formatoFecha = "DD/MM/YYYY", L }) {
  const [filtro, setFiltro] = useState("activos");
  const [saving, setSaving] = useState(null);

  const visibles = pedidos.filter(p => {
    if (filtro === "activos")    return p.estado === "planificado" || p.estado === "en_ruta";
    if (filtro === "entregados") return p.estado === "entregado";
    return p.estado !== "cancelado" && p.estado !== "borrador";
  }).sort((a, b) => (b.fecha_entrega || "").localeCompare(a.fecha_entrega || ""));

  const vehById = Object.fromEntries((vehiculosEmpresa || []).map(v => [String(v.id), v]));

  const cambiarEstado = async (pedido, nuevoEstado) => {
    setSaving(pedido.id);
    const hoy = new Date().toISOString().slice(0, 10);
    const updated = {
      ...pedido,
      estado: nuevoEstado,
      ...(nuevoEstado === "en_ruta" && !pedido.fecha_entrega ? { fecha_entrega: hoy } : {}),
      ...(nuevoEstado === "entregado" && !pedido.fecha_retorno ? { fecha_retorno: hoy } : {}),
    };
    setPedidos(prev => prev.map(p => p.id === updated.id ? updated : p));
    await onSavePedido?.(updated);
    setSaving(null);
  };

  const fmtF = iso => { if (!iso) return "—"; const [y,m,d] = iso.split("-"); return formatoFecha === "MM/DD/YYYY" ? `${m}/${d}/${y}` : formatoFecha === "DD-MM-YYYY" ? `${d}-${m}-${y}` : `${d}/${m}/${y}`; };

  const FILTROS = [
    { id:"activos",    label: L("En curso","In progress") },
    { id:"entregados", label: L("Entregados","Delivered") },
    { id:"todos",      label: L("Todos","All") },
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
            const chip = CHIP_ESTADO[p.estado] || CHIP_ESTADO.borrador;
            const veh  = vehById[String(p.vehiculo_id)] || null;
            const isSaving = saving === p.id;
            return (
              <div key={p.id} style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:14,
                padding:"14px 18px", display:"flex", gap:14, alignItems:"center", flexWrap:"wrap" }}>
                <span style={{ padding:"3px 10px", borderRadius:999, background:chip.bg, color:chip.ink,
                  fontSize:11.5, fontWeight:700, flexShrink:0 }}>{p.estado}</span>

                <div style={{ flex:1, minWidth:160 }}>
                  <div style={{ fontWeight:700, fontSize:14.5 }}>{p.codigo || `PED-${p.id}`}</div>
                  <div style={{ color:C.sub, fontSize:12.5, marginTop:2 }}>
                    {p.nombre && <span>{p.nombre}</span>}
                    {p.destino && <span> · 📍{p.destino}</span>}
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
                  {p.estado === "planificado" && (
                    <Btn onClick={() => cambiarEstado(p, "en_ruta")} disabled={isSaving}
                      color="#d97706" style={{ fontSize:12, padding:"6px 12px" }}>
                      {isSaving ? <Loader size={13}/> : <ArrowRight size={13}/>}
                      {L("Salida","Depart")}
                    </Btn>
                  )}
                  {p.estado === "en_ruta" && (
                    <Btn onClick={() => cambiarEstado(p, "entregado")} disabled={isSaving}
                      color={C.ok} style={{ fontSize:12, padding:"6px 12px" }}>
                      {isSaving ? <Loader size={13}/> : <RotateCcw size={13}/>}
                      {L("Registrar retorno","Log return")}
                    </Btn>
                  )}
                  {p.estado === "entregado" && (
                    <span style={{ fontSize:12, color:C.ok, fontWeight:600, display:"flex", alignItems:"center", gap:4 }}>
                      <Check size={13}/>{L("Cerrado","Closed")}
                    </span>
                  )}
                  {(p.estado === "en_ruta" || p.estado === "entregado") && (
                    <Btn onClick={() => cambiarEstado(p, "planificado")} disabled={isSaving} outline
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
    </div>
  );
}
