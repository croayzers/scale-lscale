import React, { useState, useEffect, useMemo } from "react";
import { Euro, Loader, AlertTriangle, Package, RefreshCw } from "lucide-react";
import { C, Btn } from "./lib/ui.jsx";
import {
  cargarCargosMerma, cargarDeudasProveedor,
  actualizarEstadoCargo, actualizarEstadoDeuda,
} from "./lib/data.js";

/* ───────────────────────────────────────────────────────────────────────────
   TabFinanzas — registro contable interno de mermas:
   · cargos_merma   → lo que se factura al cliente por roturas/pérdidas.
   · deudas_proveedor → lo que se debe al proveedor por material alquilado dañado.
   Lo escriben los disparadores de retorno (trigger en BD); aquí solo se listan
   y se cambia su estado.
   ─────────────────────────────────────────────────────────────────────────── */

const EST_CARGO = {
  pendiente: ["Pendiente", "#fef9c3", "#ca8a04"],
  facturado: ["Facturado", "#dbeafe", "#2563eb"],
  cobrado:   ["Cobrado",   C.okSoft,  C.ok],
  anulado:   ["Anulado",   "#f1f5f9", "#64748b"],
};
const EST_DEUDA = {
  pendiente: ["Pendiente", "#fef9c3", "#ca8a04"],
  pagado:    ["Pagado",    C.okSoft,  C.ok],
  anulado:   ["Anulado",   "#f1f5f9", "#64748b"],
};
const FLUJO_CARGO = { pendiente:"facturado", facturado:"cobrado" };
const FLUJO_DEUDA = { pendiente:"pagado" };

export default function TabFinanzas({ empresa, modo, materiales = [], proveedores = [], L }) {
  const companyId = empresa?.id;
  const esDemo = modo !== "supabase" || !companyId;

  const [vista, setVista]   = useState("cargos");   // cargos | deudas
  const [cargos, setCargos] = useState([]);
  const [deudas, setDeudas] = useState([]);
  const [cargando, setCargando] = useState(true);

  const matById = useMemo(() => Object.fromEntries((materiales || []).map(m => [m.id, m])), [materiales]);
  const provById = useMemo(() => Object.fromEntries((proveedores || []).map(p => [p.id, p])), [proveedores]);

  const recargar = async () => {
    if (esDemo) { setCargando(false); return; }
    setCargando(true);
    try {
      const [c, d] = await Promise.all([
        cargarCargosMerma(companyId),
        cargarDeudasProveedor(companyId),
      ]);
      setCargos(c || []); setDeudas(d || []);
    } finally { setCargando(false); }
  };

  useEffect(() => { recargar(); /* eslint-disable-next-line */ }, [companyId, modo]);

  const avanzarCargo = async (row) => {
    const next = FLUJO_CARGO[row.estado];
    if (!next) return;
    setCargos(prev => prev.map(c => c.id === row.id ? { ...c, estado: next } : c));
    try { await actualizarEstadoCargo(row.id, next); } catch (e) { console.error(e); recargar(); }
  };
  const avanzarDeuda = async (row) => {
    const next = FLUJO_DEUDA[row.estado];
    if (!next) return;
    setDeudas(prev => prev.map(d => d.id === row.id ? { ...d, estado: next } : d));
    try { await actualizarEstadoDeuda(row.id, next); } catch (e) { console.error(e); recargar(); }
  };

  const totalCargosPend = cargos.filter(c => c.estado === "pendiente").reduce((s, c) => s + (Number(c.importe) || 0), 0);
  const totalDeudasPend = deudas.filter(d => d.estado === "pendiente").reduce((s, d) => s + (Number(d.importe) || 0), 0);

  const fmt = n => `${(Number(n) || 0).toFixed(2)} €`;
  const fmtFecha = iso => iso ? new Date(iso).toLocaleDateString("es-ES") : "—";

  return (
    <div style={{ padding:"16px 20px", maxWidth:920, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18 }}>
        <div style={{ background:C.brandSoft, color:C.brand, borderRadius:12, padding:10 }}><Euro size={22}/></div>
        <div style={{ flex:1 }}>
          <h2 style={{ fontSize:18, margin:0 }}>{L("Finanzas — Mermas","Finance — Losses")}</h2>
          <p style={{ color:C.sub, fontSize:13, margin:0 }}>
            {L("Cargos al cliente y deudas con proveedores por material roto o perdido.","Client charges and supplier debts for broken or lost items.")}
          </p>
        </div>
        <button onClick={recargar} title={L("Recargar","Reload")}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:9,
            border:`1px solid ${C.line}`, background:C.s2, color:C.sub, cursor:"pointer", fontFamily:"inherit", fontSize:12.5 }}>
          <RefreshCw size={14}/>{L("Recargar","Reload")}
        </button>
      </div>

      {/* Toggle + totales */}
      <div style={{ display:"flex", gap:8, marginBottom:14, alignItems:"center", flexWrap:"wrap" }}>
        {[["cargos", L("Cargos a cliente","Client charges"), totalCargosPend],
          ["deudas", L("Deudas a proveedor","Supplier debts"), totalDeudasPend]].map(([id, lbl, tot]) => (
          <button key={id} onClick={() => setVista(id)}
            style={{ padding:"7px 16px", borderRadius:999, border:`1.5px solid ${vista === id ? C.brand : C.line}`,
              background: vista === id ? C.brandSoft : C.s2, color: vista === id ? C.brand : C.sub,
              fontWeight: vista === id ? 700 : 500, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
            {lbl}
            <span style={{ marginLeft:8, fontSize:11.5, fontWeight:800,
              color: tot > 0 ? C.warn : C.dim }}>{fmt(tot)} {L("pend.","pend.")}</span>
          </button>
        ))}
      </div>

      {esDemo ? (
        <div style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:14, padding:40, textAlign:"center", color:C.sub, fontSize:13.5 }}>
          {L("Las finanzas de mermas requieren estar conectado (no disponible en modo demo).","Loss finance requires being signed in (not available in demo mode).")}
        </div>
      ) : cargando ? (
        <div style={{ padding:40, textAlign:"center" }}><Loader size={20} className="spin"/></div>
      ) : (
        <Lista
          filas={vista === "cargos" ? cargos : deudas}
          tipo={vista}
          matById={matById} provById={provById}
          estMap={vista === "cargos" ? EST_CARGO : EST_DEUDA}
          flujoMap={vista === "cargos" ? FLUJO_CARGO : FLUJO_DEUDA}
          onAvanzar={vista === "cargos" ? avanzarCargo : avanzarDeuda}
          fmt={fmt} fmtFecha={fmtFecha} L={L}/>
      )}
    </div>
  );
}

function Lista({ filas, tipo, matById, provById, estMap, flujoMap, onAvanzar, fmt, fmtFecha, L }) {
  if (!filas.length) {
    return (
      <div style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:14, padding:40, textAlign:"center" }}>
        <Package size={28} color={C.line} style={{ marginBottom:8 }}/>
        <p style={{ color:C.sub, fontSize:13.5, margin:0 }}>
          {L("Sin registros. Aparecen al marcar material como Roto o Perdido en Retorno.","No records. They appear when items are marked Broken or Lost in Returns.")}
        </p>
      </div>
    );
  }
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {filas.map(f => {
        const mat = matById[f.material_id];
        const prov = tipo === "deudas" ? provById[f.proveedor_id] : null;
        const [estLbl, estBg, estInk] = estMap[f.estado] || estMap.pendiente;
        const next = flujoMap[f.estado];
        return (
          <div key={f.id} style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:12,
            padding:"12px 16px", display:"flex", gap:14, alignItems:"center", flexWrap:"wrap" }}>
            <div style={{ background: f.concepto === "rotura" ? C.warnSoft : "#fee2e2",
              color: f.concepto === "rotura" ? C.warn : "#dc2626", borderRadius:9, padding:8, flexShrink:0 }}>
              <AlertTriangle size={16}/>
            </div>
            <div style={{ flex:1, minWidth:160 }}>
              <div style={{ fontWeight:700, fontSize:14 }}>
                {mat?.nombre || L("Material","Item")} · <span style={{ textTransform:"capitalize" }}>{f.concepto}</span>
              </div>
              <div style={{ color:C.sub, fontSize:12, marginTop:2 }}>
                {tipo === "deudas" && prov && <span>{prov.nombre} · </span>}
                {fmtFecha(f.created_at)}
              </div>
            </div>
            <div style={{ fontSize:15, fontWeight:800, color:"#b45309", minWidth:90, textAlign:"right" }}>
              {fmt(f.importe)}
            </div>
            <span style={{ fontSize:11, fontWeight:700, color:estInk, background:estBg,
              borderRadius:999, padding:"3px 11px", flexShrink:0 }}>{estLbl}</span>
            {next && (
              <Btn onClick={() => onAvanzar(f)} style={{ fontSize:12, padding:"6px 12px" }}>
                {tipo === "cargos"
                  ? (f.estado === "pendiente" ? L("Marcar facturado","Mark invoiced") : L("Marcar cobrado","Mark paid"))
                  : L("Marcar pagado","Mark paid")}
              </Btn>
            )}
          </div>
        );
      })}
    </div>
  );
}
