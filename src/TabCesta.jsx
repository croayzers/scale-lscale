// MARK: - TabCesta — Cesta de compra para reposición de almacén
import React, { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { ShoppingCart, Trash2, Plus, Minus, Download, Check, Loader, Package, ChevronDown, ChevronRight, AlertTriangle, FileText, Warehouse } from "lucide-react";
import { actualizarMaterial } from "./lib/data.js";
import { registrarCompra } from "./lib/dataRecuentos.js";

const C = {
  bg:"var(--bg)", surface:"var(--surface)", s2:"var(--surface-2)",
  line:"var(--border)", strong:"var(--border-strong)",
  ink:"var(--text)", sub:"var(--text-2)", dim:"var(--text-3)",
  brand:"var(--brand)", brandSoft:"var(--brand-soft)",
  ok:"var(--ok)", okSoft:"var(--ok-soft)",
  warn:"var(--warn)", warnSoft:"var(--warn-soft)",
  danger:"var(--danger)", dangerSoft:"var(--danger-soft)",
};

// Columnas por defecto para el exportador
const COLS_DEFECTO = [
  { key:"referencia", label:"Referencia", activa:true  },
  { key:"nombre",     label:"Nombre",     activa:true  },
  { key:"cantidad",   label:"Cantidad",   activa:true  },
  { key:"unidad",     label:"Unidad",     activa:true  },
  { key:"proveedor",  label:"Proveedor",  activa:false },
  { key:"precio_coste", label:"Precio coste", activa:false },
  { key:"notas",      label:"Notas",      activa:false },
];

const LS_COLS_KEY = "lscale.cesta.columnas";

function cargarCols() {
  try { return JSON.parse(localStorage.getItem(LS_COLS_KEY)) || COLS_DEFECTO; }
  catch { return COLS_DEFECTO; }
}

function guardarCols(cols) {
  localStorage.setItem(LS_COLS_KEY, JSON.stringify(cols));
}

/* ─── Constructor de columnas para export ─────────────────────────────────── */
function ConstructorColumnas({ cols, onChange }) {
  const toggle = (k) => {
    const next = cols.map(c => c.key === k ? { ...c, activa: !c.activa } : c);
    onChange(next);
  };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:12 }}>
      <div style={{ fontSize:11, fontWeight:700, color:C.sub, textTransform:"uppercase", letterSpacing:0.5, marginBottom:4 }}>
        Columnas del Excel
      </div>
      {cols.map(c => {
        const activa = c.activa;
        return (
          <button key={c.key} onClick={() => toggle(c.key)}
            style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px",
              borderRadius:7, border:`1px solid ${activa ? C.brand : C.line}`,
              background: activa ? C.brandSoft : "transparent",
              color: activa ? C.brand : C.sub,
              fontSize:12.5, cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
            <div style={{ width:13, height:13, borderRadius:3, border:`2px solid ${activa ? C.brand : C.strong}`,
              background: activa ? C.brand : "transparent", flexShrink:0,
              display:"grid", placeItems:"center" }}>
              {activa && <span style={{ color:"#fff", fontSize:8, fontWeight:900 }}>✓</span>}
            </div>
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─── TabCesta ────────────────────────────────────────────────────────────── */
export default function TabCesta({ cesta, setCesta, materiales, setMateriales, almacenes = [], modo, empresa, sesion, colsIniciales, onGuardarCols, onNotificarEvento, L }) {
  const [comprando, setComprando] = useState(false);
  const [comprado,  setComprado]  = useState(false);
  const [cols,      setCols]      = useState(() => colsIniciales || cargarCols());
  const [mostrarConstructor, setMostrarConstructor] = useState(false);
  const [colapsados, setColapsados] = useState(() => new Set());  // ids de almacén colapsados
  const [avisoAlmacen, setAvisoAlmacen] = useState(null);

  const toggleGrupo = (aid) => setColapsados(prev => {
    const next = new Set(prev);
    const key = aid == null ? "__null__" : aid;
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });
  const estaColapsado = (aid) => colapsados.has(aid == null ? "__null__" : aid);

  // Sincronizar columnas cuando llegan desde Supabase (cambio de empresa/carga)
  React.useEffect(() => {
    if (Array.isArray(colsIniciales) && colsIniciales.length) setCols(colsIniciales);
  }, [colsIniciales]);

  const persistirCols = (next) => {
    setCols(next);
    if (typeof onGuardarCols === "function") onGuardarCols(next);
    else guardarCols(next);
  };

  const total = cesta.reduce((s, i) => s + i.cantidad, 0);

  const matchItem = (i, item) =>
    item.material_id != null ? i.material_id === item.material_id : i.nombre === item.nombre;

  // Encuentra el material exacto de un item de cesta: por id, luego por
  // almacén + nombre, y por último por nombre global (fallback).
  const buscarMaterial = (item) => {
    const nom = item.nombre?.trim().toLowerCase();
    return materiales.find(m =>
      (item.material_id != null && m.id === item.material_id) ||
      ((m.almacen_id ?? null) === (item.almacen_id ?? null) &&
       m.nombre?.trim().toLowerCase() === nom)
    ) || materiales.find(m => m.nombre?.trim().toLowerCase() === nom);
  };

  const setCantidad = (item, v) => {
    const n = Math.max(0, Number(v) || 0);
    if (n === 0) {
      setCesta(prev => prev.filter(i => !matchItem(i, item)));
    } else {
      setCesta(prev => prev.map(i => matchItem(i, item) ? { ...i, cantidad: n } : i));
    }
  };

  const eliminar = (item) => setCesta(prev => prev.filter(i => !matchItem(i, item)));

  // Asigna el almacén a un item (desde el selector inline del grupo "Sin almacén").
  const asignarAlmacen = (item, almacenId) => {
    const aid = almacenId === "" ? null : Number(almacenId);
    setCesta(prev => prev.map(i => matchItem(i, item) ? { ...i, almacen_id: aid } : i));
  };

  // Resuelve el nombre del almacén de un item.
  const nombreAlmacen = (almacenId) =>
    almacenes.find(a => a.id === almacenId)?.nombre || null;

  // Items sin almacén asignado → bloquean la compra.
  const sinAlmacen = cesta.filter(i => (i.almacen_id ?? null) == null);

  // Agrupa la cesta por almacén. Grupo null = "Sin almacén".
  const grupos = (() => {
    const map = new Map();
    for (const item of cesta) {
      const aid = item.almacen_id ?? null;
      if (!map.has(aid)) map.set(aid, []);
      map.get(aid).push(item);
    }
    // Orden: almacenes con nombre primero (por nombre), "Sin almacén" al final.
    return [...map.entries()]
      .map(([aid, items]) => ({ aid, nombre: aid == null ? "Sin almacén" : (nombreAlmacen(aid) || `Almacén ${aid}`), items }))
      .sort((a, b) => (a.aid == null ? 1 : b.aid == null ? -1 : a.nombre.localeCompare(b.nombre)));
  })();

  const comprar = async () => {
    if (!cesta.length) return;
    if (sinAlmacen.length) {
      setAvisoAlmacen(`Asigna almacén a ${sinAlmacen.length} material${sinAlmacen.length === 1 ? "" : "es"} antes de comprar.`);
      setTimeout(() => setAvisoAlmacen(null), 4000);
      return;
    }
    setComprando(true);
    try {
      const updates = [];
      for (const item of cesta) {
        const mat = buscarMaterial(item);
        if (!mat) continue;
        const nuevoStock = (Number(mat.stock_actual) || 0) + Number(item.cantidad);
        if (modo === "supabase") {
          const actualizado = await actualizarMaterial(mat.id, { stock_actual: nuevoStock });
          updates.push(actualizado);
        } else {
          updates.push({ ...mat, stock_actual: nuevoStock });
        }
      }
      if (updates.length) {
        setMateriales(prev => prev.map(m => {
          const u = updates.find(u => u.id === m.id);
          return u ? { ...m, stock_actual: u.stock_actual } : m;
        }));
      }

      // Registrar la compra en el historial (con almacén + coste por línea)
      try {
        const userEmail = sesion?.user?.email || null;
        const itemsCompra = cesta.map(item => {
          const mat = buscarMaterial(item);
          const aid = item.almacen_id ?? mat?.almacen_id ?? null;
          return {
            nombre:       item.nombre,
            cantidad:     item.cantidad,
            unidad:       mat?.unidad || "ud",
            material_id:  mat?.id ?? item.material_id ?? null,
            almacen_id:   aid,
            almacen_nombre: nombreAlmacen(aid),
            precio_coste: mat?.precio_coste ?? null,
          };
        });
        await registrarCompra(itemsCompra, empresa?.id, userEmail, modo);
        const nArt = itemsCompra.length;
        onNotificarEvento?.("compra", "Nueva compra registrada", `${nArt} artículo${nArt === 1 ? "" : "s"}`, null);
      } catch (e) {
        console.warn("[TabCesta] registrarCompra:", e);
      }

      setCesta([]);
      setComprado(true);
      setTimeout(() => setComprado(false), 2500);
    } catch (e) {
      console.error("[TabCesta] comprar:", e);
    } finally {
      setComprando(false);
    }
  };

  // Filas para export (agrupadas por almacén), con columna Almacén siempre.
  const filasExport = () => grupos.flatMap(g => g.items.map(item => {
    const mat = buscarMaterial(item) || {};
    return { item, mat, almacen: g.nombre };
  }));

  const exportarExcel = () => {
    const colsActivas = cols.filter(c => c.activa);
    const header = ["Almacén", ...colsActivas.map(c => c.label)];
    const rows = filasExport().map(({ item, mat, almacen }) => [
      almacen,
      ...colsActivas.map(c => {
        if (c.key === "cantidad") return item.cantidad;
        if (c.key === "nombre")   return item.nombre;
        return mat[c.key] ?? "";
      }),
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cesta de compra");
    XLSX.writeFile(wb, `cesta_compra_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const exportarPDF = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const fecha = new Date().toLocaleDateString("es-ES");
    doc.setFontSize(16); doc.text("Cesta de compra", 14, 18);
    doc.setFontSize(10); doc.setTextColor(120);
    doc.text(`${fecha} · ${cesta.length} artículos · ${total} uds`, 14, 25);
    doc.setTextColor(0);

    let y = 36;
    const colsActivas = cols.filter(c => c.activa);
    for (const g of grupos) {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(12); doc.setFont(undefined, "bold");
      const sub = g.items.reduce((s, i) => s + i.cantidad, 0);
      doc.text(`${g.nombre}  (${sub} uds)`, 14, y); y += 7;
      doc.setFont(undefined, "normal"); doc.setFontSize(10);
      for (const item of g.items) {
        if (y > 280) { doc.addPage(); y = 20; }
        const mat = buscarMaterial(item) || {};
        const ref = mat.referencia ? ` [${mat.referencia}]` : "";
        doc.text(`• ${item.nombre}${ref} — ${item.cantidad} ${mat.unidad || "ud"}`, 18, y);
        y += 6;
      }
      y += 4;
    }
    doc.save(`cesta_compra_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  if (comprado) {
    return (
      <div style={{ flex:1, display:"grid", placeItems:"center", background:C.bg }}>
        <div style={{ textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
          <div style={{ width:56, height:56, borderRadius:999, background:C.okSoft,
            display:"grid", placeItems:"center" }}>
            <Check size={28} color={C.ok}/>
          </div>
          <div style={{ fontSize:17, fontWeight:700, color:C.ok }}>¡Compra registrada!</div>
          <div style={{ fontSize:13, color:C.sub }}>Stock actualizado en el almacén.</div>
        </div>
      </div>
    );
  }

  if (!cesta.length) {
    return (
      <div style={{ flex:1, display:"grid", placeItems:"center", background:C.bg }}>
        <div style={{ textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", gap:12, color:C.dim }}>
          <ShoppingCart size={40} strokeWidth={1.3}/>
          <div style={{ fontSize:15, fontWeight:600 }}>La cesta está vacía</div>
          <div style={{ fontSize:13 }}>
            Usa el botón <strong>"Agregar a la cesta"</strong> en el banner de stock insuficiente de un pedido.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:C.bg, overflow:"hidden" }}>

      {/* Header */}
      <div style={{ padding:"14px 20px", background:C.surface, borderBottom:`1px solid ${C.line}`,
        display:"flex", alignItems:"center", gap:10, flexShrink:0, flexWrap:"wrap" }}>
        <ShoppingCart size={16} color={C.brand}/>
        <span style={{ fontWeight:700, fontSize:15 }}>Cesta de compra</span>
        <span style={{ fontSize:12, background:C.brandSoft, color:C.brand,
          padding:"2px 8px", borderRadius:999, fontWeight:600 }}>
          {cesta.length} {cesta.length === 1 ? "artículo" : "artículos"} · {total} uds · {grupos.length} almacén{grupos.length === 1 ? "" : "es"}
        </span>
        {sinAlmacen.length > 0 && (
          <span style={{ fontSize:12, background:C.warnSoft, color:C.warn,
            padding:"2px 8px", borderRadius:999, fontWeight:600, display:"flex", alignItems:"center", gap:4 }}>
            <AlertTriangle size={12}/> {sinAlmacen.length} sin almacén
          </span>
        )}
      </div>

      {/* Aviso de almacén faltante al comprar */}
      {avisoAlmacen && (
        <div style={{ padding:"10px 20px", background:C.warnSoft, color:C.warn,
          fontSize:13, fontWeight:600, display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          <AlertTriangle size={15}/> {avisoAlmacen}
        </div>
      )}

      {/* Grupos por almacén (colapsables) */}
      <div style={{ flex:1, overflowY:"auto", padding:20, display:"flex", flexDirection:"column", gap:14 }}>
        {grupos.map(g => {
          const colapsado = estaColapsado(g.aid);
          const subUds = g.items.reduce((s, i) => s + i.cantidad, 0);
          const sinAlm = g.aid == null;
          return (
            <div key={g.aid == null ? "null" : g.aid}
              style={{ border:`1px solid ${sinAlm ? C.warn : C.line}`, borderRadius:12, overflow:"hidden",
                background: C.surface }}>
              {/* Cabecera de grupo */}
              <button onClick={() => toggleGrupo(g.aid)}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"11px 14px",
                  background: sinAlm ? C.warnSoft : C.s2, border:"none", cursor:"pointer",
                  fontFamily:"inherit", textAlign:"left" }}>
                {colapsado ? <ChevronRight size={16} color={C.sub}/> : <ChevronDown size={16} color={C.sub}/>}
                {sinAlm ? <AlertTriangle size={15} color={C.warn}/> : <Warehouse size={15} color={C.brand}/>}
                <span style={{ fontWeight:700, fontSize:14, color: sinAlm ? C.warn : C.ink }}>{g.nombre}</span>
                <span style={{ fontSize:11.5, color:C.sub }}>
                  {g.items.length} {g.items.length === 1 ? "material" : "materiales"} · {subUds} uds
                </span>
              </button>

              {/* Filas del grupo */}
              {!colapsado && (
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <tbody>
                    {g.items.map((item, idx) => {
                      const mat = buscarMaterial(item) || {};
                      const ubicacion = item.ubicacion ?? mat.ubicacion ?? null;
                      const pedidoRef = item.pedido_codigo || item.pedido || null;
                      return (
                        <tr key={item.nombre + idx}
                          style={{ borderTop:`1px solid ${C.line}`, background: idx % 2 === 0 ? C.surface : C.bg }}>
                          <td style={{ padding:"10px 12px", fontSize:13.5, color:C.ink, fontWeight:600 }}>
                            {item.nombre}
                            <div style={{ display:"flex", gap:6, alignItems:"center", marginTop:2, flexWrap:"wrap" }}>
                              {mat.referencia && <span style={{ fontSize:11, color:C.dim, fontWeight:400 }}>{mat.referencia}</span>}
                              {ubicacion && <span style={{ fontSize:11, color:C.sub }}>· {ubicacion}</span>}
                              {pedidoRef && (
                                <span style={{ fontSize:10.5, background:C.brandSoft, color:C.brand,
                                  padding:"1px 6px", borderRadius:999, fontWeight:700 }}>→ {pedidoRef}</span>
                              )}
                            </div>
                          </td>

                          {/* Selector de almacén SOLO en el grupo "Sin almacén" */}
                          {sinAlm && (
                            <td style={{ padding:"10px 12px" }}>
                              <select value="" onChange={e => asignarAlmacen(item, e.target.value)}
                                style={{ padding:"6px 8px", borderRadius:7, border:`1px solid ${C.warn}`,
                                  background:C.surface, color:C.ink, fontSize:12.5, fontFamily:"inherit",
                                  outline:"none", cursor:"pointer" }}>
                                <option value="">Elegir almacén…</option>
                                {almacenes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                              </select>
                            </td>
                          )}

                          {item.faltante > 0 && (
                            <td style={{ padding:"10px 12px" }}>
                              <span style={{ fontSize:12, background:C.dangerSoft, color:C.danger,
                                padding:"2px 8px", borderRadius:999, fontWeight:600 }}>
                                falta {item.faltante}
                              </span>
                            </td>
                          )}

                          <td style={{ padding:"10px 12px" }}>
                            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
                              <button onClick={() => setCantidad(item, item.cantidad - 1)} style={ICON_BTN}><Minus size={12}/></button>
                              <input type="number" min={1} value={item.cantidad}
                                onChange={e => setCantidad(item, e.target.value)}
                                style={{ width:60, textAlign:"center", padding:"5px 6px",
                                  border:`1px solid ${C.strong}`, borderRadius:7, fontSize:13.5,
                                  fontFamily:"inherit", background:C.s2, color:C.ink, outline:"none" }}/>
                              <button onClick={() => setCantidad(item, item.cantidad + 1)} style={ICON_BTN}><Plus size={12}/></button>
                            </div>
                          </td>

                          <td style={{ padding:"10px 12px", textAlign:"right" }}>
                            <button onClick={() => eliminar(item)}
                              style={{ background:"none", border:"none", cursor:"pointer", color:C.danger, padding:4 }}>
                              <Trash2 size={14}/>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer con acciones */}
      <div style={{ padding:"14px 20px", background:C.surface, borderTop:`1px solid ${C.line}`,
        display:"flex", alignItems:"center", gap:10, flexShrink:0, flexWrap:"wrap" }}>

        {/* Constructor de columnas */}
        <div style={{ position:"relative" }}>
          <button onClick={() => setMostrarConstructor(v => !v)}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px",
              borderRadius:8, border:`1px solid ${C.strong}`, background:C.s2,
              color:C.ink, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
            <Download size={13}/>Configurar Excel
          </button>
          {mostrarConstructor && (
            <div style={{ position:"absolute", bottom:"100%", left:0, marginBottom:6,
              background:C.surface, border:`1px solid ${C.line}`, borderRadius:10,
              boxShadow:"0 4px 20px #0003", padding:14, minWidth:200, zIndex:50 }}>
              <ConstructorColumnas cols={cols} onChange={persistirCols}/>
            </div>
          )}
        </div>

        <button onClick={exportarExcel}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px",
            borderRadius:8, border:"none", background:"#16a34a", color:"#fff",
            fontWeight:600, fontSize:13, cursor:"pointer" }}>
          <Download size={13}/>Excel
        </button>

        <button onClick={exportarPDF}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px",
            borderRadius:8, border:"none", background:"#dc2626", color:"#fff",
            fontWeight:600, fontSize:13, cursor:"pointer" }}>
          <FileText size={13}/>PDF
        </button>

        <div style={{ flex:1 }}/>

        <button onClick={() => setCesta([])}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px",
            borderRadius:8, border:`1px solid ${C.danger}`, background:"transparent",
            color:C.danger, fontWeight:600, fontSize:13, cursor:"pointer" }}>
          <Trash2 size={13}/>Vaciar
        </button>

        <button onClick={comprar} disabled={comprando || !cesta.length || sinAlmacen.length > 0}
          title={sinAlmacen.length > 0 ? "Asigna almacén a todos los materiales" : ""}
          style={{ display:"flex", alignItems:"center", gap:7, padding:"10px 22px",
            borderRadius:999, border:"none",
            background: (sinAlmacen.length > 0) ? C.strong : C.ok, color:"#fff",
            fontWeight:700, fontSize:14,
            cursor: (comprando || sinAlmacen.length > 0) ? "not-allowed" : "pointer",
            opacity: comprando ? 0.7 : 1 }}>
          {comprando ? <Loader size={14} className="spin"/> : <Package size={14}/>}
          {comprando ? "Comprando…" : "Comprar — actualizar stock"}
        </button>
      </div>
    </div>
  );
}

const ICON_BTN = {
  width:26, height:26, borderRadius:6, border:`1px solid var(--border-strong)`,
  background:"var(--surface-2)", color:"var(--text)", cursor:"pointer",
  display:"flex", alignItems:"center", justifyContent:"center",
};
