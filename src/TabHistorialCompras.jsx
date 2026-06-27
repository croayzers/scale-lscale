import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { History, Loader, ChevronRight, FileDown, FileSpreadsheet, X, Filter, Package } from "lucide-react";
import { C, Btn } from "./lib/ui.jsx";
import { cargarCompras } from "./lib/dataRecuentos.js";
import { cargarProveedores } from "./lib/data.js";
import {
  consultarCompras, totalizar, sumatorioPorMaterial, agruparComprasPorFecha,
} from "./lib/dataCompras.js";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const fFecha = (iso) => iso ? new Date(iso).toLocaleDateString("es-ES") : "—";
const eur = (n) => `${(Number(n) || 0).toFixed(2)} €`;

export default function TabHistorialCompras({ empresa, modo, almacenes = [], materiales = [], onVolver, L }) {
  const companyId = empresa?.id;
  const [compras, setCompras]   = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [abiertos, setAbiertos] = useState(new Set());
  const [pdfSel, setPdfSel]     = useState(null);   // compra para elegir formato de PDF

  // Filtros
  const [fMaterial, setFMaterial] = useState("");
  const [fAlmacen, setFAlmacen]   = useState("");   // "" = todos
  const [fProveedor, setFProveedor] = useState(""); // "" = todos
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");

  useEffect(() => {
    (async () => {
      setCargando(true);
      try {
        const [cs, ps] = await Promise.all([
          cargarCompras(companyId, modo),
          modo === "supabase" && companyId ? cargarProveedores(companyId).catch(() => []) : Promise.resolve([]),
        ]);
        setCompras(cs || []);
        setProveedores(ps || []);
      } finally { setCargando(false); }
    })();
  }, [companyId, modo]);

  const nombreAlmacen = (id) => almacenes.find(a => a.id === id)?.nombre || (id != null ? `Almacén ${id}` : "—");
  const nombreProveedor = (id) => proveedores.find(p => p.id === id)?.nombre || (id != null ? `Proveedor ${id}` : "—");

  // Filtro activo (objeto reutilizado por listado y exports)
  const filtro = useMemo(() => ({
    material:    fMaterial.trim() || undefined,
    almacen_id:  fAlmacen !== "" ? Number(fAlmacen) : undefined,
    proveedor_id: fProveedor !== "" ? Number(fProveedor) : undefined,
    desde:       fDesde || undefined,
    hasta:       fHasta || undefined,
  }), [fMaterial, fAlmacen, fProveedor, fDesde, fHasta]);

  const hayFiltro = fMaterial || fAlmacen !== "" || fProveedor !== "" || fDesde || fHasta;

  // Líneas filtradas (para el resumen y los exports)
  const lineasFiltradas = useMemo(() => consultarCompras(compras, filtro), [compras, filtro]);
  const tot = useMemo(() => totalizar(lineasFiltradas), [lineasFiltradas]);

  // Compras que tras el filtro conservan alguna línea (para la vista cronológica)
  const comprasVisibles = useMemo(() => {
    if (!hayFiltro) return compras;
    const idsCompra = new Set(lineasFiltradas.map(l => l.compra_id));
    return compras
      .filter(c => idsCompra.has(c.id))
      .map(c => ({ ...c, lineas: (c.lineas || []).filter(l => lineasFiltradas.some(lf => lf.compra_id === c.id && lf.id === l.id)) }));
  }, [compras, lineasFiltradas, hayFiltro]);

  const grupos = useMemo(() => agruparComprasPorFecha(comprasVisibles), [comprasVisibles]);

  const toggle = (k) => setAbiertos(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });

  // ── Export PDF de UNA compra (entera o por proveedor) ──
  const exportarCompraPDF = async (compra, proveedorId = null) => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    let lineas = compra.lineas || [];
    if (proveedorId != null) lineas = lineas.filter(l => l.proveedor_id === proveedorId);

    doc.setFontSize(16); doc.text(`Compra #${compra.id}`, 14, 18);
    doc.setFontSize(10); doc.setTextColor(120);
    doc.text(`${fFecha(compra.fecha)}${compra.creado_por ? ` · ${compra.creado_por}` : ""}`, 14, 25);
    if (proveedorId != null) doc.text(`Proveedor: ${nombreProveedor(proveedorId)}`, 14, 31);
    doc.setTextColor(0);

    let y = proveedorId != null ? 42 : 36;
    doc.setFontSize(9); doc.setFont(undefined, "bold");
    doc.text("Material", 14, y); doc.text("Almacén", 95, y); doc.text("Cant.", 140, y, { align:"right" });
    doc.text("Coste", 175, y, { align:"right" }); y += 2;
    doc.setLineWidth(0.2); doc.line(14, y, 195, y); y += 5;
    doc.setFont(undefined, "normal");

    let totalC = 0, totalQ = 0;
    for (const l of lineas) {
      if (y > 280) { doc.addPage(); y = 20; }
      const q = Number(l.cantidad) || 0;
      const importe = l.precio_coste != null ? q * Number(l.precio_coste) : null;
      totalQ += q; if (importe != null) totalC += importe;
      doc.text(String(l.nombre).slice(0, 45), 14, y);
      doc.text(nombreAlmacen(l.almacen_id).slice(0, 22), 95, y);
      doc.text(`${q} ${l.unidad || "ud"}`, 140, y, { align:"right" });
      doc.text(importe != null ? eur(importe) : "—", 175, y, { align:"right" });
      y += 6;
    }
    y += 2; doc.line(14, y, 195, y); y += 6;
    doc.setFont(undefined, "bold");
    doc.text(`Total: ${totalQ} uds`, 14, y);
    if (totalC > 0) doc.text(eur(totalC), 175, y, { align:"right" });

    const sufijo = proveedorId != null ? `_${nombreProveedor(proveedorId).replace(/\s+/g, "-")}` : "";
    doc.save(`compra_${compra.id}${sufijo}.pdf`);
    setPdfSel(null);
  };

  // ── Export Excel: sumatorio material × mes + hoja detalle (respeta el filtro) ──
  const exportarExcelSumatorio = () => {
    const { materiales: mats, periodos } = sumatorioPorMaterial(compras, filtro, "mes");
    const wb = XLSX.utils.book_new();

    // Hoja Resumen: una fila por material, columnas por mes + totales
    const headRes = ["Material", "Unidad", ...periodos.flatMap(p => [`${p} (uds)`, `${p} (€)`]), "TOTAL uds", "TOTAL €"];
    const rowsRes = mats.map(m => [
      m.nombre, m.unidad,
      ...periodos.flatMap(p => [m.periodos[p]?.cantidad ?? 0, Number((m.periodos[p]?.coste ?? 0).toFixed(2))]),
      m.total_cantidad, Number(m.total_coste.toFixed(2)),
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headRes, ...rowsRes]), "Resumen material x mes");

    // Hoja Detalle: todas las líneas filtradas
    const headDet = ["Fecha", "Compra", "Material", "Cantidad", "Unidad", "Almacén", "Proveedor", "Coste/ud", "Importe"];
    const rowsDet = lineasFiltradas
      .slice().sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      .map(l => {
        const q = Number(l.cantidad) || 0;
        return [
          fFecha(l.fecha), l.compra_id, l.nombre, q, l.unidad || "ud",
          nombreAlmacen(l.almacen_id), nombreProveedor(l.proveedor_id),
          l.precio_coste != null ? Number(l.precio_coste) : "",
          l.precio_coste != null ? Number((q * Number(l.precio_coste)).toFixed(2)) : "",
        ];
      });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headDet, ...rowsDet]), "Detalle");

    const rango = (fDesde || fHasta) ? `_${fDesde || "inicio"}_a_${fHasta || "hoy"}` : "";
    XLSX.writeFile(wb, `compras_sumatorio${rango}.xlsx`);
  };

  const inp = { padding:"7px 10px", border:`1px solid ${C.strong}`, borderRadius:8, fontSize:13, fontFamily:"inherit", background:C.s2, color:C.ink, outline:"none" };

  return (
    <div style={{ padding:"16px 20px", maxWidth:1000, margin:"0 auto" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
        <div style={{ background:C.brandSoft, color:C.brand, borderRadius:12, padding:10 }}><History size={22}/></div>
        <div style={{ flex:1 }}>
          <h2 style={{ fontSize:18, margin:0 }}>{L("Historial de compras","Purchase history")}</h2>
          <p style={{ color:C.sub, fontSize:13, margin:0 }}>{L("Cada compra registrada, filtrable por material, almacén, proveedor y fechas.","Every recorded purchase, filterable by item, warehouse, supplier and dates.")}</p>
        </div>
        {onVolver && <Btn outline onClick={onVolver}>{L("Volver","Back")}</Btn>}
      </div>

      {/* Filtros */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center", marginBottom:12,
        padding:"12px 14px", background:C.surface, border:`1px solid ${C.line}`, borderRadius:12 }}>
        <Filter size={15} color={C.sub}/>
        <input placeholder={L("Material…","Item…")} value={fMaterial} onChange={e => setFMaterial(e.target.value)} style={{ ...inp, minWidth:150 }}/>
        <select value={fAlmacen} onChange={e => setFAlmacen(e.target.value)} style={{ ...inp, cursor:"pointer" }}>
          <option value="">{L("Todos los almacenes","All warehouses")}</option>
          {almacenes.map(a => <option key={a.id} value={String(a.id)}>{a.nombre}</option>)}
        </select>
        <select value={fProveedor} onChange={e => setFProveedor(e.target.value)} style={{ ...inp, cursor:"pointer" }}>
          <option value="">{L("Todos los proveedores","All suppliers")}</option>
          {proveedores.map(p => <option key={p.id} value={String(p.id)}>{p.nombre}</option>)}
        </select>
        <label style={{ fontSize:12, color:C.sub }}>{L("Desde","From")}</label>
        <input type="date" value={fDesde} onChange={e => setFDesde(e.target.value)} style={inp}/>
        <label style={{ fontSize:12, color:C.sub }}>{L("Hasta","To")}</label>
        <input type="date" value={fHasta} onChange={e => setFHasta(e.target.value)} style={inp}/>
        {hayFiltro && (
          <button onClick={() => { setFMaterial(""); setFAlmacen(""); setFProveedor(""); setFDesde(""); setFHasta(""); }}
            style={{ ...inp, cursor:"pointer", color:C.danger, border:`1px solid ${C.line}` }}>{L("Limpiar","Clear")}</button>
        )}
      </div>

      {/* Resumen + export sumatorio */}
      <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:14, flexWrap:"wrap" }}>
        <div style={{ fontSize:13, color:C.sub }}>
          <strong style={{ color:C.ink }}>{tot.n_lineas}</strong> {L("líneas","lines")} · <strong style={{ color:C.ink }}>{tot.cantidad}</strong> uds
          {tot.coste > 0 && <> · <strong style={{ color:"#b45309" }}>{eur(tot.coste)}</strong></>}
        </div>
        <div style={{ flex:1 }}/>
        <Btn outline onClick={exportarExcelSumatorio} disabled={!lineasFiltradas.length}>
          <FileSpreadsheet size={14}/>{L("Excel (sumatorio)","Excel (summary)")}
        </Btn>
      </div>

      {cargando ? (
        <div style={{ padding:40, textAlign:"center" }}><Loader size={20} className="spin"/></div>
      ) : grupos.length === 0 ? (
        <div style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:14, padding:40, textAlign:"center" }}>
          <Package size={28} color={C.line} style={{ marginBottom:8 }}/>
          <p style={{ color:C.sub, fontSize:13.5, margin:0 }}>
            {hayFiltro ? L("Ninguna compra coincide con el filtro.","No purchases match the filter.")
                       : L("Aún no hay compras registradas.","No purchases recorded yet.")}
          </p>
        </div>
      ) : (
        <div style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:14, overflow:"hidden" }}>
          {grupos.map(({ anyo, meses }) => (
            <div key={anyo}>
              <button type="button" onClick={() => toggle(`y${anyo}`)} aria-expanded={abiertos.has(`y${anyo}`)}
                style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 16px", width:"100%",
                  background:C.s2, border:"none", borderBottom:`1px solid ${C.line}`, cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
                <ChevronRight size={14} color={C.brand} style={{ transform: abiertos.has(`y${anyo}`) ? "rotate(90deg)" : "none", transition:"transform .2s" }}/>
                <span style={{ fontWeight:800, fontSize:14 }}>{anyo === -1 ? L("Sin fecha","No date") : anyo}</span>
                <span style={{ fontSize:12, color:C.sub }}>{meses.reduce((s,m)=>s+m.items.length,0)} {L("compras","purchases")}</span>
              </button>
              {abiertos.has(`y${anyo}`) && meses.map(({ mes, items }) => {
                const key = `${anyo}-${mes}`;
                return (
                  <div key={key}>
                    <button type="button" onClick={() => toggle(key)} aria-expanded={abiertos.has(key)}
                      style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 28px", width:"100%",
                        background:C.bg, border:"none", borderBottom:`1px solid ${C.line}`, cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
                      <ChevronRight size={12} color={C.sub} style={{ transform: abiertos.has(key) ? "rotate(90deg)" : "none", transition:"transform .2s" }}/>
                      <span style={{ fontWeight:600, fontSize:13, color:C.sub }}>{mes === -1 ? L("Sin mes","No month") : MESES[mes]}</span>
                      <span style={{ fontSize:11.5, color:C.dim }}>{items.length} {L("compras","purchases")}</span>
                    </button>
                    {abiertos.has(key) && items.map(c => {
                      const provs = [...new Set((c.lineas || []).map(l => l.proveedor_id).filter(x => x != null))];
                      const subQ = (c.lineas || []).reduce((s, l) => s + (Number(l.cantidad) || 0), 0);
                      return (
                        <div key={c.id} style={{ padding:"10px 28px", borderBottom:`1px solid ${C.line}`, display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
                          <div style={{ flex:1, minWidth:200 }}>
                            <div style={{ fontWeight:600, fontSize:13.5 }}>
                              {L("Compra","Purchase")} #{c.id} · {fFecha(c.fecha)}
                            </div>
                            <div style={{ fontSize:12, color:C.sub, marginTop:2 }}>
                              {(c.lineas || []).length} {L("materiales","items")} · {subQ} uds
                              {c.almacenes && <span> · 📦 {c.almacenes}</span>}
                              {provs.length > 0 && <span> · 🏢 {provs.map(nombreProveedor).join(", ")}</span>}
                            </div>
                          </div>
                          <Btn outline onClick={() => setPdfSel(c)} style={{ fontSize:12, padding:"6px 12px" }}>
                            <FileDown size={13}/>PDF
                          </Btn>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Modal selector de formato PDF (compra entera / por proveedor) */}
      {pdfSel && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:600, display:"grid", placeItems:"center", padding:16 }} onClick={() => setPdfSel(null)}>
          <div style={{ background:C.surface, borderRadius:14, padding:22, width:"100%", maxWidth:380, boxShadow:"var(--shadow-lg)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <h3 style={{ fontSize:15, margin:0 }}>{L("Descargar PDF — Compra","Download PDF — Purchase")} #{pdfSel.id}</h3>
              <button onClick={() => setPdfSel(null)} style={{ background:"none", border:"none", cursor:"pointer", color:C.sub }}><X size={18}/></button>
            </div>
            <p style={{ fontSize:12.5, color:C.sub, marginBottom:14 }}>{L("Elige qué incluir en el PDF:","Choose what to include:")}</p>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <Btn onClick={() => exportarCompraPDF(pdfSel)}>
                <FileDown size={14}/>{L("Compra completa","Full purchase")}
              </Btn>
              {[...new Set((pdfSel.lineas || []).map(l => l.proveedor_id).filter(x => x != null))].map(pid => (
                <Btn key={pid} outline onClick={() => exportarCompraPDF(pdfSel, pid)}>
                  <FileDown size={14}/>{L("Solo","Only")} {nombreProveedor(pid)}
                </Btn>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
