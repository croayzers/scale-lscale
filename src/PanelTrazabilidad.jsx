import React, { useState, useEffect } from "react";
import { Plus, Loader, Package, Hash, Boxes } from "lucide-react";
import { C, Btn } from "./lib/ui.jsx";
import {
  cargarLotes, crearLote, cargarSeries, crearSeries,
} from "./lib/data.js";

/* ───────────────────────────────────────────────────────────────────────────
   PanelTrazabilidad — alta y listado de lotes (FIFO/PMP) o unidades serie,
   según material.tipo_trazabilidad. Se monta dentro del modal de material de
   TabAlmacen cuando el material ya existe y hay Supabase.
   ─────────────────────────────────────────────────────────────────────────── */
export default function PanelTrazabilidad({ material, companyId, L }) {
  const tipo = material?.tipo_trazabilidad || "Consumible_PMP";
  const esSerie = tipo === "Serializado";

  const [filas, setFilas]   = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // Form de alta
  const [lote, setLote]   = useState({ coste_unitario:"", cantidad_inicial:"", codigo_lote:"", factura_ref:"" });
  const [series, setSeries] = useState({ numeros:"", coste:"" });

  const recargar = async () => {
    setCargando(true);
    try {
      const data = esSerie ? await cargarSeries(material.id) : await cargarLotes(material.id);
      setFilas(data || []);
    } finally { setCargando(false); }
  };

  useEffect(() => { recargar(); /* eslint-disable-next-line */ }, [material?.id, tipo]);

  const addLote = async () => {
    const cant = Number(lote.cantidad_inicial) || 0;
    if (cant <= 0) return;
    setGuardando(true);
    try {
      await crearLote({
        material_id: material.id,
        coste_unitario: Number(lote.coste_unitario) || 0,
        cantidad_inicial: cant,
        codigo_lote: lote.codigo_lote || null,
        factura_ref: lote.factura_ref || null,
      }, companyId);
      setLote({ coste_unitario:"", cantidad_inicial:"", codigo_lote:"", factura_ref:"" });
      await recargar();
    } catch (e) { console.error("crearLote", e?.message); }
    finally { setGuardando(false); }
  };

  const addSeries = async () => {
    const nums = (series.numeros || "").split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    if (!nums.length) return;
    setGuardando(true);
    try {
      await crearSeries(material.id, nums, companyId, series.coste !== "" ? Number(series.coste) : null);
      setSeries({ numeros:"", coste:"" });
      await recargar();
    } catch (e) { console.error("crearSeries", e?.message); }
    finally { setGuardando(false); }
  };

  const inp = {
    width:"100%", padding:"7px 9px", border:`1px solid ${C.strong}`, borderRadius:8,
    fontSize:13, fontFamily:"inherit", background:C.s2, color:C.ink, outline:"none",
  };
  const lbl = { fontSize:10.5, fontWeight:700, color:C.sub, letterSpacing:.4, display:"block", marginBottom:3 };

  const totalLotes = filas.reduce((s, f) => s + (Number(f.cantidad_restante) || 0), 0);
  const seriesDisp = filas.filter(f => f.estado === "disponible").length;

  const EST_SERIE = {
    disponible:["Disponible", C.okSoft, C.ok], en_uso:["En uso","#e0e7ff","#4f46e5"],
    cuarentena:["Cuarentena","#fef9c3","#ca8a04"], roto:["Roto", C.warnSoft, C.warn],
    perdido:["Perdido","#fee2e2","#dc2626"], baja:["Baja","#f1f5f9","#64748b"],
  };

  return (
    <div style={{ gridColumn:"1 / -1", borderTop:`1px solid ${C.line}`, paddingTop:14, marginTop:4 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
        {esSerie ? <Hash size={15} color={C.brand}/> : <Boxes size={15} color={C.brand}/>}
        <label style={{ fontSize:11.5, fontWeight:700, color:"var(--text-2)", letterSpacing:.5 }}>
          {esSerie ? L("UNIDADES SERIALIZADAS","SERIALIZED UNITS") : L("LOTES (entradas de stock)","BATCHES (stock entries)")}
        </label>
        <span style={{ marginLeft:"auto", fontSize:11.5, color:C.sub }}>
          {esSerie
            ? `${seriesDisp} ${L("disponibles","available")} / ${filas.length} ${L("uds","units")}`
            : `${L("Stock por lotes","Batch stock")}: ${totalLotes}`}
        </span>
      </div>

      {/* Form de alta */}
      {esSerie ? (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 120px auto", gap:8, alignItems:"end", marginBottom:10 }}>
          <div>
            <label style={lbl}>{L("Nº de serie (uno por línea o separados por coma)","Serial nº (one per line or comma-separated)")}</label>
            <textarea value={series.numeros} onChange={e => setSeries(p => ({ ...p, numeros:e.target.value }))}
              rows={2} placeholder="SN-001, SN-002…" style={{ ...inp, resize:"vertical" }}/>
          </div>
          <div>
            <label style={lbl}>{L("Coste/ud (€)","Cost/unit (€)")}</label>
            <input type="number" value={series.coste} onChange={e => setSeries(p => ({ ...p, coste:e.target.value }))}
              placeholder="0.00" style={inp}/>
          </div>
          <Btn onClick={addSeries} disabled={guardando || !series.numeros.trim()}>
            {guardando ? <Loader size={13} className="spin"/> : <Plus size={13}/>}{L("Añadir","Add")}
          </Btn>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"100px 110px 1fr 1fr auto", gap:8, alignItems:"end", marginBottom:10 }}>
          <div>
            <label style={lbl}>{L("Cantidad","Quantity")}</label>
            <input type="number" value={lote.cantidad_inicial} onChange={e => setLote(p => ({ ...p, cantidad_inicial:e.target.value }))}
              placeholder="0" style={inp}/>
          </div>
          <div>
            <label style={lbl}>{L("Coste/ud (€)","Cost/unit (€)")}</label>
            <input type="number" value={lote.coste_unitario} onChange={e => setLote(p => ({ ...p, coste_unitario:e.target.value }))}
              placeholder="0.00" style={inp}/>
          </div>
          <div>
            <label style={lbl}>{L("Cód. lote","Batch code")}</label>
            <input value={lote.codigo_lote} onChange={e => setLote(p => ({ ...p, codigo_lote:e.target.value }))}
              placeholder={L("opcional","optional")} style={inp}/>
          </div>
          <div>
            <label style={lbl}>{L("Factura ref.","Invoice ref.")}</label>
            <input value={lote.factura_ref} onChange={e => setLote(p => ({ ...p, factura_ref:e.target.value }))}
              placeholder={L("opcional","optional")} style={inp}/>
          </div>
          <Btn onClick={addLote} disabled={guardando || !(Number(lote.cantidad_inicial) > 0)}>
            {guardando ? <Loader size={13} className="spin"/> : <Plus size={13}/>}{L("Añadir","Add")}
          </Btn>
        </div>
      )}

      {/* Listado */}
      {cargando ? (
        <div style={{ padding:16, textAlign:"center", color:C.sub, fontSize:12.5 }}>
          <Loader size={16} className="spin"/>
        </div>
      ) : filas.length === 0 ? (
        <div style={{ padding:16, textAlign:"center", color:C.dim, fontSize:12.5 }}>
          <Package size={22} color={C.line} style={{ marginBottom:6 }}/>
          <div>{esSerie ? L("Sin unidades dadas de alta.","No units registered.") : L("Sin lotes. Añade una entrada de stock.","No batches. Add a stock entry.")}</div>
        </div>
      ) : (
        <div style={{ border:`1px solid ${C.line}`, borderRadius:9, overflow:"hidden", maxHeight:180, overflowY:"auto" }}>
          {filas.map(f => esSerie ? (
            <div key={f.id} style={{ display:"grid", gridTemplateColumns:"1fr auto auto", gap:8, alignItems:"center",
              padding:"6px 10px", borderBottom:`1px solid ${C.line}`, fontSize:12.5 }}>
              <span style={{ fontWeight:600, color:C.ink }}>{f.numero_serie}</span>
              <span style={{ color:C.sub }}>{f.coste_adquisicion != null ? `${Number(f.coste_adquisicion).toFixed(2)} €` : "—"}</span>
              {(() => { const [t,bg,ink] = EST_SERIE[f.estado] || EST_SERIE.disponible;
                return <span style={{ fontSize:10, fontWeight:700, color:ink, background:bg, borderRadius:999, padding:"1px 8px" }}>{t}</span>; })()}
            </div>
          ) : (
            <div key={f.id} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, alignItems:"center",
              padding:"6px 10px", borderBottom:`1px solid ${C.line}`, fontSize:12.5 }}>
              <span style={{ color:C.sub }}>{f.codigo_lote || `#${f.id}`}</span>
              <span style={{ color:C.ink }}>{new Date(f.fecha_entrada).toLocaleDateString("es-ES")}</span>
              <span style={{ color:C.sub }}>{Number(f.coste_unitario).toFixed(2)} €/ud</span>
              <span style={{ textAlign:"right", fontWeight:700, color: Number(f.cantidad_restante) > 0 ? C.ok : C.dim }}>
                {Number(f.cantidad_restante)}/{Number(f.cantidad_inicial)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
