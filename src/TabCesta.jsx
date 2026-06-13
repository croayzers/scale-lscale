// MARK: - TabCesta — Cesta de compra para reposición de almacén
import React, { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { ShoppingCart, Trash2, Plus, Minus, Download, Check, Loader, Package } from "lucide-react";
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
    onChange(next); guardarCols(next);
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
export default function TabCesta({ cesta, setCesta, materiales, setMateriales, almacenes = [], modo, empresa, sesion, L }) {
  const [comprando, setComprando] = useState(false);
  const [comprado,  setComprado]  = useState(false);
  const [cols,      setCols]      = useState(cargarCols);
  const [mostrarConstructor, setMostrarConstructor] = useState(false);

  const total = cesta.reduce((s, i) => s + i.cantidad, 0);

  const matchItem = (i, item) =>
    item.material_id != null ? i.material_id === item.material_id : i.nombre === item.nombre;

  const setCantidad = (item, v) => {
    const n = Math.max(0, Number(v) || 0);
    if (n === 0) {
      setCesta(prev => prev.filter(i => !matchItem(i, item)));
    } else {
      setCesta(prev => prev.map(i => matchItem(i, item) ? { ...i, cantidad: n } : i));
    }
  };

  const eliminar = (item) => setCesta(prev => prev.filter(i => !matchItem(i, item)));

  const comprar = async () => {
    if (!cesta.length) return;
    setComprando(true);
    try {
      const updates = [];
      for (const item of cesta) {
        const mat = materiales.find(m =>
          (item.material_id != null && m.id === item.material_id) ||
          m.nombre?.trim().toLowerCase() === item.nombre?.trim().toLowerCase()
        );
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

      // Registrar la compra en el historial
      try {
        const userEmail = sesion?.user?.email || null;
        const itemsCompra = cesta.map(item => {
          const mat = materiales.find(m =>
            (item.material_id != null && m.id === item.material_id) ||
            m.nombre?.trim().toLowerCase() === item.nombre?.trim().toLowerCase()
          );
          return {
            nombre:      item.nombre,
            cantidad:    item.cantidad,
            unidad:      mat?.unidad || "ud",
            material_id: mat?.id ?? item.material_id ?? null,
          };
        });
        await registrarCompra(itemsCompra, empresa?.id, userEmail, modo);
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

  const exportarExcel = () => {
    const colsActivas = cols.filter(c => c.activa);
    const header = colsActivas.map(c => c.label);
    const rows = cesta.map(item => {
      const mat = materiales.find(m =>
        (item.material_id != null && m.id === item.material_id) ||
        m.nombre?.trim().toLowerCase() === item.nombre?.trim().toLowerCase()
      ) || {};
      return colsActivas.map(c => {
        if (c.key === "cantidad") return item.cantidad;
        if (c.key === "nombre")   return item.nombre;
        return mat[c.key] ?? "";
      });
    });

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cesta de compra");
    XLSX.writeFile(wb, `cesta_compra_${new Date().toISOString().slice(0,10)}.xlsx`);
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
        display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
        <ShoppingCart size={16} color={C.brand}/>
        <span style={{ fontWeight:700, fontSize:15 }}>Cesta de compra</span>
        <span style={{ fontSize:12, color:C.sub, background:C.brandSoft, color:C.brand,
          padding:"2px 8px", borderRadius:999, fontWeight:600 }}>
          {cesta.length} {cesta.length === 1 ? "artículo" : "artículos"} · {total} uds
        </span>
      </div>

      {/* Tabla */}
      <div style={{ flex:1, overflowY:"auto", padding:20 }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:C.s2 }}>
              {["Material","Almacén / Ubicación","Faltante","Cantidad a pedir","Proveedor",""].map((h, i) => (
                <th key={i} style={{ padding:"8px 12px", textAlign: i === 3 ? "center" : "left",
                  fontSize:11, fontWeight:700, color:C.sub, textTransform:"uppercase",
                  letterSpacing:0.4, borderBottom:`1px solid ${C.line}` }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cesta.map((item, idx) => {
              const mat = materiales.find(m =>
                (item.material_id != null && m.id === item.material_id) ||
                m.nombre?.trim().toLowerCase() === item.nombre?.trim().toLowerCase()
              ) || {};
              const almacenId = item.almacen_id ?? mat.almacen_id ?? null;
              const almacen   = almacenes.find(a => a.id === almacenId);
              const ubicacion = item.ubicacion ?? mat.ubicacion ?? null;
              return (
                <tr key={item.nombre + idx}
                  style={{ borderBottom:`1px solid ${C.line}`, background: idx % 2 === 0 ? C.surface : C.bg }}>

                  <td style={{ padding:"10px 12px", fontSize:13.5, color:C.ink, fontWeight:600 }}>
                    {item.nombre}
                    {mat.referencia && (
                      <div style={{ fontSize:11, color:C.dim, fontWeight:400 }}>{mat.referencia}</div>
                    )}
                  </td>

                  <td style={{ padding:"10px 12px" }}>
                    <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                      {almacen ? (
                        <span style={{ fontSize:12, background:C.brandSoft, color:C.brand,
                          padding:"2px 7px", borderRadius:999, fontWeight:600, width:"fit-content" }}>
                          {almacen.nombre}
                        </span>
                      ) : (
                        <span style={{ fontSize:12, color:C.dim }}>—</span>
                      )}
                      {ubicacion && (
                        <span style={{ fontSize:11, color:C.sub }}>{ubicacion}</span>
                      )}
                    </div>
                  </td>

                  <td style={{ padding:"10px 12px" }}>
                    <span style={{ fontSize:12.5, background:C.dangerSoft, color:C.danger,
                      padding:"2px 8px", borderRadius:999, fontWeight:600 }}>
                      -{item.faltante} uds
                    </span>
                  </td>

                  <td style={{ padding:"10px 12px" }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
                      <button onClick={() => setCantidad(item, item.cantidad - 1)}
                        style={ICON_BTN}>
                        <Minus size={12}/>
                      </button>
                      <input type="number" min={1} value={item.cantidad}
                        onChange={e => setCantidad(item, e.target.value)}
                        style={{ width:60, textAlign:"center", padding:"5px 6px",
                          border:`1px solid ${C.strong}`, borderRadius:7, fontSize:13.5,
                          fontFamily:"inherit", background:C.s2, color:C.ink, outline:"none" }}/>
                      <button onClick={() => setCantidad(item, item.cantidad + 1)}
                        style={ICON_BTN}>
                        <Plus size={12}/>
                      </button>
                    </div>
                  </td>

                  <td style={{ padding:"10px 12px", fontSize:12.5, color:C.sub }}>
                    {mat.proveedor || "—"}
                  </td>

                  <td style={{ padding:"10px 12px" }}>
                    <button onClick={() => eliminar(item)}
                      style={{ background:"none", border:"none", cursor:"pointer",
                        color:C.danger, padding:4, display:"flex" }}>
                      <Trash2 size={14}/>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
              <ConstructorColumnas cols={cols} onChange={setCols}/>
            </div>
          )}
        </div>

        <button onClick={exportarExcel}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px",
            borderRadius:8, border:"none", background:"#16a34a", color:"#fff",
            fontWeight:600, fontSize:13, cursor:"pointer" }}>
          <Download size={13}/>Exportar Excel
        </button>

        <div style={{ flex:1 }}/>

        <button onClick={() => setCesta([])}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px",
            borderRadius:8, border:`1px solid ${C.danger}`, background:"transparent",
            color:C.danger, fontWeight:600, fontSize:13, cursor:"pointer" }}>
          <Trash2 size={13}/>Vaciar
        </button>

        <button onClick={comprar} disabled={comprando || !cesta.length}
          style={{ display:"flex", alignItems:"center", gap:7, padding:"10px 22px",
            borderRadius:999, border:"none", background:C.ok, color:"#fff",
            fontWeight:700, fontSize:14, cursor:"pointer",
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
