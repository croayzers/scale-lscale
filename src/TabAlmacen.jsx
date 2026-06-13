// MARK: - UbicacionesModal
// MARK: - TabAlmacen
import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Search, Columns3, MapPin, Upload, Download, FileDown,
  Plus, Pencil, Trash2, X, Check, Loader, AlertTriangle,
} from "lucide-react";
import { C, Badge, Btn, ModalField } from "./lib/ui.jsx";
import { crearMaterial, actualizarMaterial, borrarMaterial } from "./lib/data.js";
import AlmacenConfigurador from "./AlmacenConfigurador.jsx";

const TODAS_COLS = [
  { id: "referencia",   label: "REFERENCIA",   fija: false, def: true  },
  { id: "nombre",       label: "NOMBRE",        fija: true,  def: true  },
  { id: "categoria",    label: "CATEGORÍA",     fija: false, def: true  },
  { id: "unidad",       label: "UNIDAD",        fija: false, def: true  },
  { id: "stock_actual", label: "STOCK",         fija: false, def: true  },
  { id: "stock_minimo", label: "MÍN.",          fija: false, def: false },
  { id: "ubicacion",    label: "UBICACIÓN",     fija: false, def: true  },
  { id: "estado",       label: "ESTADO",        fija: false, def: true  },
  { id: "proveedor",    label: "PROVEEDOR",     fija: false, def: false },
  { id: "precio_coste", label: "COSTE",         fija: false, def: false },
  { id: "notas",        label: "NOTAS",         fija: false, def: false },
];

const ESTADOS_MATERIAL = ["activo", "agotado", "descatalogado"];
const ESTADO_COLOR = {
  activo:        { bg: "var(--ok-soft)",   ink: "var(--ok)"     },
  agotado:       { bg: "var(--warn-soft)", ink: "var(--warn)"   },
  descatalogado: { bg: "var(--danger-soft)",ink: "var(--danger)"},
};
const ESTADO_LABEL = { activo: "Activo", agotado: "Agotado", descatalogado: "Descatalogado" };

// MARK: - UbicacionesModal
function UbicacionesModal({ materiales, setMateriales, empresaId, almacenId, almacenNombre, onClose }) {
  const KEY = `lscale.ubicaciones.${empresaId}.${almacenId}`;

  const categorias = [...new Set(
    materiales
      .filter(m => m.almacen_id == null || m.almacen_id === almacenId)
      .map(m => (m.categoria || "").trim())
      .filter(Boolean)
  )].sort();

  const [mapa, setMapa] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY)) || {};
      // Rellenar con el nombre de la categoría si no hay valor guardado
      const base = {};
      categorias.forEach(cat => { base[cat] = saved[cat] ?? cat; });
      return base;
    } catch { return {}; }
  });
  const [aplicado, setAplicado] = useState(false);
  const [confLimpiar, setConfLimpiar] = useState(false);

  const set = (cat, val) => setMapa(p => ({ ...p, [cat]: val }));

  const guardar = () => {
    localStorage.setItem(KEY, JSON.stringify(mapa));
    setMateriales(prev => prev.map(m => {
      if (m.almacen_id != null && m.almacen_id !== almacenId) return m;
      const cat = (m.categoria || "").trim();
      if (cat && mapa[cat] !== undefined && mapa[cat] !== "") return { ...m, ubicacion: mapa[cat] };
      return m;
    }));
    setAplicado(true);
    setTimeout(() => setAplicado(false), 2000);
  };

  const limpiar = () => {
    localStorage.removeItem(KEY);
    const base = {};
    categorias.forEach(cat => { base[cat] = cat; });
    setMapa(base);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"grid",
      placeItems:"center", zIndex:600, padding:16 }} onClick={onClose}>
      <div style={{ background:C.surface, borderRadius:16, boxShadow:"0 20px 60px rgba(0,0,0,.25)",
        width:"100%", maxWidth:520, maxHeight:"85vh", display:"flex", flexDirection:"column" }}
        onClick={e => e.stopPropagation()}>

        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.line}`, flexShrink:0,
          display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:700 }}>Ubicaciones por categoría</div>
            <div style={{ fontSize:12, color:C.sub, marginTop:2 }}>{almacenNombre} · plantilla de ubicaciones</div>
          </div>
          <button onClick={onClose}
            style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, display:"flex", padding:4 }}>
            <X size={18}/>
          </button>
        </div>

        <div style={{ padding:"10px 20px", fontSize:12, color:C.dim, borderBottom:`1px solid ${C.line}`,
          flexShrink:0, background:C.s2 }}>
          Escribe la ubicación para cada categoría. Al aplicar, todos los materiales de esa categoría
          en este almacén actualizarán su campo Ubicación.
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"12px 20px", display:"flex", flexDirection:"column", gap:8 }}>
          {categorias.length === 0 && (
            <div style={{ color:C.dim, fontSize:13, textAlign:"center", padding:24 }}>
              No hay categorías en este almacén todavía.
            </div>
          )}
          {categorias.map(cat => (
            <div key={cat} style={{ display:"grid", gridTemplateColumns:"1fr 1fr", alignItems:"center", gap:10 }}>
              <div style={{ fontSize:13.5, fontWeight:600, color:C.ink,
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {cat}
              </div>
              <input
                value={mapa[cat] || ""}
                onChange={e => set(cat, e.target.value)}
                placeholder="ej. A-01, Pasillo 3…"
                style={{ padding:"6px 10px", border:`1px solid ${mapa[cat] ? C.brand : C.strong}`,
                  borderRadius:8, fontSize:13, fontFamily:"inherit",
                  background:"transparent", color:C.ink, outline:"none",
                  boxShadow: mapa[cat] ? `0 0 0 2px ${C.brandSoft}` : "none" }}/>
            </div>
          ))}
        </div>

        <div style={{ padding:"12px 20px", borderTop:`1px solid ${C.line}`, flexShrink:0,
          display:"flex", alignItems:"center", gap:8 }}>
          {confLimpiar ? (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:12.5, color:C.danger }}>¿Restablecer ubicaciones al nombre de cada categoría?</span>
              <button onClick={() => { limpiar(); setConfLimpiar(false); }}
                style={{ background:C.danger, border:"none", cursor:"pointer", color:"#fff",
                  borderRadius:8, padding:"5px 12px", fontSize:12.5, fontFamily:"inherit", fontWeight:600 }}>
                Sí, restablecer
              </button>
              <button onClick={() => setConfLimpiar(false)}
                style={{ background:"none", border:`1px solid ${C.strong}`, cursor:"pointer",
                  color:C.sub, borderRadius:8, padding:"5px 10px", fontSize:12.5, fontFamily:"inherit" }}>
                Cancelar
              </button>
            </div>
          ) : (
            <button onClick={() => setConfLimpiar(true)}
              style={{ background:"none", border:`1px solid ${C.strong}`, cursor:"pointer",
                color:C.sub, borderRadius:8, padding:"7px 14px", fontSize:13, fontFamily:"inherit" }}>
              Limpiar plantilla
            </button>
          )}
          <div style={{ flex:1 }}/>
          <button onClick={onClose}
            style={{ background:"none", border:`1px solid ${C.strong}`, cursor:"pointer",
              color:C.sub, borderRadius:8, padding:"7px 14px", fontSize:13, fontFamily:"inherit" }}>
            Cancelar
          </button>
          <button onClick={guardar}
            style={{ background: aplicado ? C.ok : C.brand, border:"none", cursor:"pointer",
              color:"#fff", borderRadius:8, padding:"7px 18px", fontSize:13,
              fontFamily:"inherit", fontWeight:700, transition:"background .2s" }}>
            {aplicado ? "✓ Aplicado" : "Guardar y aplicar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// MARK: - TabAlmacen
export default function TabAlmacen({ materiales, setMateriales, empresa, modo, almacenes, silenciados, guardarPlantillaConf, cargarPlantillasConf, L }) {
  const EMP_ID = `lscale.cols.${empresa?.id}`;
  const defCols = TODAS_COLS.filter((c) => c.def).map((c) => c.id);
  const [colsVis, setColsVis]       = useState(() => { try { return JSON.parse(localStorage.getItem(EMP_ID)) || defCols; } catch { return defCols; } });
  const [showColCfg, setShowColCfg] = useState(false);
  const [busqueda, setBusqueda]     = useState("");
  const [editObj, setEditObj]       = useState(null);
  const [saving, setSaving]         = useState(false);
  const [delConf, setDelConf]       = useState(null);
  const [almacenSel, setAlmacenSel] = useState(() => almacenes?.[0]?.id ?? 1);
  const [showUbicaciones, setShowUbicaciones] = useState(false);
  const [importFile, setImportFile] = useState(null);

  // Columnas fijas al principio, luego las visibles en el orden guardado
  const colsActivas = [
    ...TODAS_COLS.filter((c) => c.fija),
    ...colsVis.map((id) => TODAS_COLS.find((c) => c.id === id)).filter(Boolean),
  ];
  const toggleCol = (id) => {
    const next = colsVis.includes(id) ? colsVis.filter((x) => x !== id) : [...colsVis, id];
    setColsVis(next); localStorage.setItem(EMP_ID, JSON.stringify(next));
  };
  const dragCol = useRef(null);
  const moveCol = (fromId, toId) => {
    if (fromId === toId) return;
    const arr = [...colsVis];
    const fi = arr.indexOf(fromId); const ti = arr.indexOf(toId);
    if (fi < 0 || ti < 0) return;
    arr.splice(fi, 1); arr.splice(ti, 0, fromId);
    setColsVis(arr); localStorage.setItem(EMP_ID, JSON.stringify(arr));
  };

  const filtrados = materiales.filter((m) => {
    if (m.almacen_id != null && m.almacen_id !== almacenSel) return false;
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return (m.nombre||"").toLowerCase().includes(q)
        || (m.referencia||"").toLowerCase().includes(q)
        || (m.categoria||"").toLowerCase().includes(q)
        || (m.ubicacion||"").toLowerCase().includes(q)
        || (m.proveedor||"").toLowerCase().includes(q);
  });

  const blankMaterial = { referencia:"", nombre:"", descripcion:"", categoria:"", unidad:"ud", stock_actual:0, stock_minimo:0, ubicacion:"", estado:"activo", proveedor:"", precio_coste:"", notas:"", almacen_id: almacenSel };

  const guardarEdit = async () => {
    if (!editObj.nombre?.trim()) return;
    setSaving(true);
    try {
      const esNuevo = !editObj.id;
      if (modo === "demo") {
        if (esNuevo) {
          const nuevo = { ...editObj, id: Date.now(), emp: empresa.id, stock_actual: Number(editObj.stock_actual)||0, stock_minimo: Number(editObj.stock_minimo)||0, precio_coste: editObj.precio_coste !== "" ? Number(editObj.precio_coste) : null };
          setMateriales((p) => [nuevo, ...p]);
        } else {
          setMateriales((p) => p.map((m) => m.id === editObj.id ? { ...m, ...editObj, stock_actual: Number(editObj.stock_actual)||0, stock_minimo: Number(editObj.stock_minimo)||0 } : m));
        }
      } else {
        const fn = esNuevo ? crearMaterial : actualizarMaterial;
        const result = esNuevo ? await fn(editObj, empresa.id) : await fn(editObj.id, editObj);
        if (esNuevo) setMateriales((p) => [result, ...p]);
        else setMateriales((p) => p.map((m) => m.id === result.id ? result : m));
      }
      setEditObj(null);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const eliminar = async (id) => {
    if (modo !== "demo") try { await borrarMaterial(id); } catch (e) { console.error(e); return; }
    setMateriales((p) => p.filter((m) => m.id !== id));
    setDelConf(null);
  };

  const importRef = useRef(null);

  const handleImportAlm = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImportFile(file);
  };

  const handleConfirmImport = async (materiales) => {
    setImportFile(null);
    const almacen = almacenes?.find(a => a.id === almacenSel);
    const nuevos = materiales.map(m => ({
      ...blankMaterial, ...m,
      almacen_id: almacenSel,
      almacen_nombre: almacen?.nombre || "",
      stock_actual: Number(m.stock_actual) || 0,
      stock_minimo: Number(m.stock_minimo) || 0,
    })).filter(m => m.nombre?.trim());
    if (!nuevos.length) return;
    if (modo === "demo") {
      setMateriales(prev => [...prev, ...nuevos.map(m => ({ ...m, id: Date.now() + Math.random(), emp: empresa?.id }))]);
    } else {
      try {
        const saved = await Promise.all(nuevos.map(m => crearMaterial(m, empresa.id)));
        setMateriales(prev => [...prev, ...saved]);
      } catch (e) { console.error(e); }
    }
  };

  const handleExportAlmExcel = () => {
    const cols = ["referencia","nombre","descripcion","categoria","unidad","stock_actual","stock_minimo","ubicacion","estado","proveedor","precio_coste","notas"];
    const alm = almacenes?.find(a => a.id === almacenSel);
    const rows = filtrados.map(m => Object.fromEntries(cols.map(k => [k, m[k] ?? ""])));
    const ws = XLSX.utils.json_to_sheet(rows, { header: cols });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, alm?.nombre || "Almacén");
    XLSX.writeFile(wb, `${(alm?.nombre || "almacen").replace(/\s+/g,"-")}.xlsx`);
  };

  const handleExportAlmPdf = () => {
    const alm = almacenes?.find(a => a.id === almacenSel);
    const cols = colsActivas.filter(c => c.id !== "nombre");
    const thS = "padding:6px 10px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;letter-spacing:.6px;text-transform:uppercase;border-bottom:2px solid #e5e7eb";
    const tdS = "padding:6px 10px;font-size:13px;border-bottom:1px solid #f3f4f6";
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${alm?.nombre||"Almacén"}</title>
<style>@page{size:A4;margin:18mm 14mm}body{font-family:system-ui,sans-serif;color:#111;margin:0}
table{width:100%;border-collapse:collapse}tbody tr:nth-child(even){background:#f9fafb}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
<div style="margin-bottom:16px;border-bottom:3px solid #6366f1;padding-bottom:10px;display:flex;justify-content:space-between;align-items:flex-end">
  <div><div style="font-size:22px;font-weight:800;color:#6366f1">${alm?.nombre||"Almacén"}</div>
  <div style="font-size:12px;color:#6b7280">${empresa?.nombre||""} · ${filtrados.length} materiales · ${new Date().toLocaleDateString("es-ES")}</div></div></div>
<table><thead><tr><th style="${thS}">NOMBRE</th>${cols.map(c=>`<th style="${thS}">${c.label}</th>`).join("")}</tr></thead>
<tbody>${filtrados.map(m=>`<tr><td style="${tdS}">${m.nombre||""}</td>${cols.map(c=>`<td style="${tdS}">${m[c.id]??""}</td>`).join("")}</tr>`).join("")}
</tbody></table></body></html>`;
    const win = window.open("","_blank","width=820,height=1000");
    win.document.write(html); win.document.close(); setTimeout(()=>win.print(),400);
  };

  const renderCel = (m, colId) => {
    switch (colId) {
      case "stock_actual": {
        const bajo = m.stock_actual <= m.stock_minimo;
        return <span style={{ fontWeight:600, color: bajo ? C.warn : C.ok }}>{m.stock_actual}</span>;
      }
      case "stock_minimo": return <span style={{ color:C.sub }}>{m.stock_minimo}</span>;
      case "estado": {
        const es = m.estado || "activo";
        const col = ESTADO_COLOR[es] || ESTADO_COLOR.activo;
        return <Badge color={col.bg} ink={col.ink}>{ESTADO_LABEL[es] || es}</Badge>;
      }
      case "precio_coste": return m.precio_coste != null ? <span>{m.precio_coste}€</span> : <span style={{ color:C.dim }}>—</span>;
      default: return <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m[colId] || <span style={{ color:C.dim }}>—</span>}</span>;
    }
  };

  const gtc = `1.4fr ${colsActivas.filter((c) => c.id !== "nombre").map(() => "1fr").join(" ")} auto 44px`;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0 }}>

      {almacenes && almacenes.length > 0 && (
        <div style={{ display:"flex", gap:2, padding:"8px 20px", borderBottom:`1px solid ${C.line}`, flexShrink:0, background:C.surface }}>
          {almacenes.map(a => (
            <button key={a.id} onClick={() => setAlmacenSel(a.id)}
              style={{ padding:"5px 16px", borderRadius:8, border:"none", fontFamily:"inherit",
                fontWeight: almacenSel === a.id ? 600 : 400, fontSize:13, cursor:"pointer",
                background: almacenSel === a.id ? C.brandSoft : "transparent",
                color: almacenSel === a.id ? C.brand : C.sub, transition:"background .12s" }}>
              {a.nombre}
            </button>
          ))}
        </div>
      )}

      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 20px", borderBottom:`1px solid ${C.line}`, flexShrink:0, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, flex:"1 1 200px", background:C.s2, border:`1px solid ${C.line}`, borderRadius:999, padding:"7px 13px" }}>
          <Search size={15} color={C.sub}/>
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder={L("Buscar material…","Search material…")} style={{ border:"none", outline:"none", background:"transparent", fontSize:13.5, color:C.ink, width:"100%", fontFamily:"inherit" }}/>
          {busqueda && <button onClick={() => setBusqueda("")} style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, padding:0, display:"flex" }}><X size={13}/></button>}
        </div>
        <div style={{ position:"relative" }}>
          <Btn outline onClick={() => setShowColCfg((v) => !v)} style={{ padding:"8px 12px" }}><Columns3 size={15}/>{L("Columnas","Columns")}</Btn>
          {showColCfg && (
            <div style={{ position:"absolute", top:"calc(100% + 6px)", right:0, background:C.surface, border:`1px solid ${C.strong}`, borderRadius:12, boxShadow:"var(--shadow-lg)", padding:"10px 0", zIndex:200, minWidth:190 }}>
              <div style={{ fontSize:10.5, fontWeight:700, color:C.sub, letterSpacing:.5, padding:"0 14px 6px", textTransform:"uppercase" }}>Arrastrar para reordenar</div>
              {/* Primero las visibles en orden (arrastrables) */}
              {colsVis.map((id) => {
                const c = TODAS_COLS.find(x => x.id === id);
                if (!c) return null;
                return (
                  <div key={c.id}
                    draggable
                    onDragStart={() => { dragCol.current = c.id; }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => moveCol(dragCol.current, c.id)}
                    style={{ display:"flex", alignItems:"center", gap:9, padding:"7px 14px", cursor:"grab", fontSize:13, userSelect:"none" }}>
                    <span style={{ color:C.sub, fontSize:12, marginRight:2 }}>⠿</span>
                    <input type="checkbox" checked={true} onChange={() => toggleCol(c.id)} style={{ accentColor:C.brand }}/>
                    {c.label}
                  </div>
                );
              })}
              {/* Luego las no visibles (no arrastrables) */}
              {TODAS_COLS.filter((c) => !c.fija && !colsVis.includes(c.id)).map((c) => (
                <label key={c.id} style={{ display:"flex", alignItems:"center", gap:9, padding:"7px 14px", cursor:"pointer", fontSize:13, opacity:.55 }}>
                  <span style={{ fontSize:12, marginRight:2, visibility:"hidden" }}>⠿</span>
                  <input type="checkbox" checked={false} onChange={() => toggleCol(c.id)} style={{ accentColor:C.brand }}/>
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
        <Btn outline onClick={() => setShowUbicaciones(true)} style={{ padding:"8px 12px" }}>
          <MapPin size={15}/>{L("Ubicaciones","Locations")}
        </Btn>
        <Btn outline onClick={() => importRef.current?.click()} style={{ padding:"8px 12px" }}>
          <Upload size={15}/>{L("Importar","Import")}
        </Btn>
        <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:"none" }} onChange={handleImportAlm}/>
        <div style={{ position:"relative", display:"flex", gap:4 }}>
          <Btn outline onClick={handleExportAlmExcel} style={{ padding:"8px 12px" }}><Download size={15}/>Excel</Btn>
          <Btn outline onClick={handleExportAlmPdf} style={{ padding:"8px 12px" }}><FileDown size={15}/>PDF</Btn>
        </div>
        <Btn onClick={() => setEditObj({ ...blankMaterial })}><Plus size={15}/>{L("Nuevo","New")}</Btn>
      </div>

      <div style={{ flex:1, overflow:"auto" }}>
        <div style={{ display:"grid", gridTemplateColumns:gtc, gap:0, position:"sticky", top:0, zIndex:10, background:C.surface, borderBottom:`1px solid ${C.line}`, padding:"0 20px" }}>
          {colsActivas.map((c) => (
            <div key={c.id} style={{ padding:"10px 8px", fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.6, overflow:"hidden" }}>{c.label}</div>
          ))}
          <div/><div/>
        </div>

        {filtrados.length === 0 && (
          <div style={{ padding:40, textAlign:"center", color:C.sub, fontSize:14 }}>
            {busqueda ? L("Sin resultados","No results") : L("Sin materiales. Pulsa «Nuevo» para añadir.","No materials yet. Press «New» to add one.")}
          </div>
        )}
        {filtrados.map((m) => {
          const bajoPorDebajo = m.stock_minimo > 0 && m.stock_actual < m.stock_minimo;
          const alertaActiva  = bajoPorDebajo && !(silenciados?.has(String(m.id)));
          return (
            <div key={m.id}
              style={{ display:"grid", gridTemplateColumns:gtc, gap:0, padding:"0 20px",
                borderBottom: alertaActiva ? `1px solid #fca5a5` : `1px solid ${C.line}`,
                alignItems:"center", transition:"background .12s",
                background: alertaActiva ? "#fff5f5" : "" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = alertaActiva ? "#fee2e2" : C.s2; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = alertaActiva ? "#fff5f5" : ""; }}>
              {colsActivas.map((c) => (
                <div key={c.id} style={{ padding:"10px 8px", fontSize:13.5, overflow:"hidden" }}>
                  {renderCel(m, c.id)}
                </div>
              ))}
              <div style={{ padding:"10px 4px" }}>
                {alertaActiva &&
                  <span title={L("Stock bajo el mínimo","Stock below minimum")}
                    style={{ fontSize:10, fontWeight:700, background:"#fee2e2", color:"#dc2626",
                      borderRadius:6, padding:"2px 6px", border:"1px solid #fca5a5" }}>⚠</span>}
                {bajoPorDebajo && !alertaActiva &&
                  <span title={L("Advertencia silenciada","Warning silenced")}
                    style={{ fontSize:10, color:C.dim, borderRadius:6, padding:"2px 4px" }}>🔇</span>}
              </div>
              <div style={{ display:"flex", gap:4, padding:"10px 4px", justifyContent:"flex-end" }}>
                <button title={L("Editar","Edit")} onClick={() => setEditObj({ ...m })}
                  style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, borderRadius:8, padding:5, display:"flex" }}>
                  <Pencil size={15}/>
                </button>
                <button title={L("Eliminar","Delete")} onClick={() => setDelConf(m.id)}
                  style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, borderRadius:8, padding:5, display:"flex" }}>
                  <Trash2 size={15}/>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {editObj && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", display:"grid", placeItems:"center", zIndex:500, padding:16 }} onClick={() => setEditObj(null)}>
          <div style={{ background:C.surface, borderRadius:16, boxShadow:"var(--shadow-lg)", padding:24, width:"100%", maxWidth:580, maxHeight:"90vh", overflowY:"auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
              <h3 style={{ fontSize:17 }}>{editObj.id ? L("Editar material","Edit material") : L("Nuevo material","New material")}</h3>
              <button onClick={() => setEditObj(null)} style={{ background:"none", border:"none", cursor:"pointer", color:C.sub }}><X size={18}/></button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <ModalField label={L("Nombre *","Name *")} value={editObj.nombre} onChange={(v) => setEditObj((p) => ({ ...p, nombre:v }))} style={{ gridColumn:"1 / -1" }}/>
              <ModalField label="Referencia / SKU"   value={editObj.referencia}   onChange={(v) => setEditObj((p) => ({ ...p, referencia:v }))}/>
              <ModalField label={L("Categoría","Category")}      value={editObj.categoria}   onChange={(v) => setEditObj((p) => ({ ...p, categoria:v }))}/>
              <ModalField label={L("Unidad","Unit")}             value={editObj.unidad}      onChange={(v) => setEditObj((p) => ({ ...p, unidad:v }))} placeholder="ud, kg, L, m…"/>
              <ModalField label={L("Ubicación","Location")}      value={editObj.ubicacion}   onChange={(v) => setEditObj((p) => ({ ...p, ubicacion:v }))} placeholder="A-01, Pasillo 3…"/>
              <ModalField label="Stock actual" value={editObj.stock_actual} onChange={(v) => setEditObj((p) => ({ ...p, stock_actual:v }))} type="number"/>
              <ModalField label={L("Stock mínimo","Min stock")}  value={editObj.stock_minimo} onChange={(v) => setEditObj((p) => ({ ...p, stock_minimo:v }))} type="number"/>
              <ModalField label={L("Proveedor","Supplier")}      value={editObj.proveedor}   onChange={(v) => setEditObj((p) => ({ ...p, proveedor:v }))}/>
              <ModalField label={L("Coste (€)","Cost (€)")}      value={editObj.precio_coste} onChange={(v) => setEditObj((p) => ({ ...p, precio_coste:v }))} type="number" placeholder="0.00"/>
              <div style={{ gridColumn:"1 / -1" }}>
                <label style={{ fontSize:11.5, fontWeight:600, color:C.sub, letterSpacing:.5 }}>{L("ALMACÉN","WAREHOUSE")}</label>
                <div style={{ display:"flex", gap:8, marginTop:6, flexWrap:"wrap" }}>
                  {almacenes.map((a) => (
                    <button key={a.id} onClick={() => setEditObj((p) => ({ ...p, almacen_id: a.id }))}
                      style={{ padding:"5px 14px", borderRadius:999, border:`1.5px solid ${editObj.almacen_id === a.id ? C.brand : C.strong}`, background: editObj.almacen_id === a.id ? C.brandSoft : "transparent", color: editObj.almacen_id === a.id ? C.brand : C.sub, fontWeight:600, fontSize:12.5, cursor:"pointer", fontFamily:"inherit" }}>
                      {a.nombre}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ gridColumn:"1 / -1" }}>
                <label style={{ fontSize:11.5, fontWeight:600, color:C.sub, letterSpacing:.5 }}>{L("ESTADO","STATUS")}</label>
                <div style={{ display:"flex", gap:8, marginTop:6 }}>
                  {ESTADOS_MATERIAL.map((e) => (
                    <button key={e} onClick={() => setEditObj((p) => ({ ...p, estado:e }))}
                      style={{ padding:"5px 14px", borderRadius:999, border:`1.5px solid ${editObj.estado === e ? C.brand : C.strong}`, background: editObj.estado === e ? C.brandSoft : "transparent", color: editObj.estado === e ? C.brand : C.sub, fontWeight:600, fontSize:12.5, cursor:"pointer", fontFamily:"inherit" }}>
                      {ESTADO_LABEL[e]}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ gridColumn:"1 / -1" }}>
                <label style={{ fontSize:11.5, fontWeight:600, color:C.sub, letterSpacing:.5 }}>NOTAS</label>
                <textarea value={editObj.notas || ""} onChange={(e) => setEditObj((p) => ({ ...p, notas:e.target.value }))}
                  rows={2} style={{ width:"100%", marginTop:6, padding:"9px 11px", border:`1px solid ${C.strong}`, borderRadius:10, fontSize:13.5, fontFamily:"inherit", background:C.s2, color:C.ink, outline:"none", resize:"vertical" }}/>
              </div>
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:20 }}>
              <Btn outline onClick={() => setEditObj(null)}>{L("Cancelar","Cancel")}</Btn>
              <Btn onClick={guardarEdit} disabled={saving || !editObj.nombre?.trim()}>
                {saving ? <Loader size={14} className="spin"/> : <Check size={14}/>}
                {L("Guardar","Save")}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {delConf && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", display:"grid", placeItems:"center", zIndex:500 }} onClick={() => setDelConf(null)}>
          <div style={{ background:C.surface, borderRadius:14, padding:24, maxWidth:340, width:"100%", margin:16, boxShadow:"var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
            <AlertTriangle size={28} color={C.danger} style={{ marginBottom:10 }}/>
            <h3 style={{ marginBottom:8 }}>{L("¿Eliminar material?","Delete material?")}</h3>
            <p style={{ color:C.sub, fontSize:13.5, marginBottom:20 }}>{L("Esta acción no se puede deshacer.","This action cannot be undone.")}</p>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <Btn outline onClick={() => setDelConf(null)}>{L("Cancelar","Cancel")}</Btn>
              <Btn color={C.danger} onClick={() => eliminar(delConf)}>{L("Eliminar","Delete")}</Btn>
            </div>
          </div>
        </div>
      )}

      {showUbicaciones && (
        <UbicacionesModal
          materiales={materiales} setMateriales={setMateriales}
          empresaId={empresa?.id} almacenId={almacenSel}
          almacenNombre={almacenes?.find(a => a.id === almacenSel)?.nombre || "Almacén"}
          onClose={() => setShowUbicaciones(false)}
        />
      )}

      {importFile && (
        <AlmacenConfigurador
          file={importFile}
          almacen={almacenes?.find(a => a.id === almacenSel) || { id: almacenSel, nombre:"Almacén" }}
          empresaId={empresa?.id}
          onConfirm={handleConfirmImport}
          onCancel={() => setImportFile(null)}
          guardarPlantillaConf={guardarPlantillaConf ? (almId, pl) => guardarPlantillaConf(almId, pl) : undefined}
          cargarPlantillasConf={cargarPlantillasConf ? (almId) => cargarPlantillasConf(almId) : undefined}
        />
      )}
    </div>
  );
}
