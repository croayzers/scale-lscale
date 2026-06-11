import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  Package, CalendarDays, RotateCcw, Warehouse, Settings,
  Sun, Moon, Globe, Plus, Pencil, Trash2, Search, Columns3,
  X, Check, Loader, AlertTriangle, ArrowRight,
  Building2, ShoppingBag, ClipboardList, MapPin, Shield,
  Upload, Download, FileDown,
} from "lucide-react";
import { LangContext, useL, useLang, IDIOMAS } from "./lib/i18n.js";
import { sb, supabaseConfigurado } from "./lib/supabase.js";
import {
  cargarDatos, crearMaterial, actualizarMaterial, borrarMaterial,
  recargarMateriales, crearConfigInicial, cargarPrefs, guardarPrefs, guardarPedido, guardarTramos,
} from "./lib/data.js";
import Login from "./Login.jsx";
import TabPlanning from "./TabPlanning.jsx";
import TabPedidos from "./TabPedidos.jsx";

/* ─── Paleta de colores centralizada ─────────────────────────────────────── */
const C = {
  bg: "var(--bg)", surface: "var(--surface)", s2: "var(--surface-2)",
  line: "var(--border)", strong: "var(--border-strong)",
  ink: "var(--text)", sub: "var(--text-2)", dim: "var(--text-3)",
  brand: "var(--brand)", brandSoft: "var(--brand-soft)",
  ok: "var(--ok)", okSoft: "var(--ok-soft)",
  warn: "var(--warn)", warnSoft: "var(--warn-soft)",
  danger: "var(--danger)", dangerSoft: "var(--danger-soft)",
};

/* ─── Columnas del almacén ────────────────────────────────────────────────── */
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
const DEFAULT_ALMACENES = [
  { id: 1, nombre: "Almacén 1", startRow: 6 },
  { id: 2, nombre: "Almacén 2", startRow: 6 },
  { id: 3, nombre: "Almacén 3", startRow: 6 },
];

// Roles de importación por defecto (los fijos no se editan, los editables sí)
export const ROLES_DEFECTO = [
  { key:"colComentario",  label:"Comentario",      color:"#0891b2", req:false, tipo:"descripcion" },
  { key:"colCentroCoste", label:"Centro de coste",  color:"#be185d", req:false, tipo:"columna"     },
  { key:"colPeso",        label:"Peso",             color:"#65a30d", req:false, tipo:"columna"     },
  { key:"colIdProducto",  label:"ID Producto",      color:"#7c3aed", req:false, tipo:"columna"     },
];

const DEFAULT_VEHICULOS_EMPRESA = [
  { id: 1, nombre: "Conductor 1", dni: "", modelo: "Mercedes Sprinter", tipo: "Furgoneta", matricula: "1234 ABC", color: "#3b82f6" },
  { id: 2, nombre: "Conductor 2", dni: "", modelo: "Iveco Daily",       tipo: "Furgoneta", matricula: "5678 XYZ", color: "#f59e0b" },
  { id: 3, nombre: "Conductor 3", dni: "", modelo: "Renault Master",    tipo: "Camión",    matricula: "9012 DEF", color: "#10b981" },
];

const TABS = [
  { id: "almacen",   label: "Almacén",        Icon: Warehouse     },
  { id: "pedido",    label: "Pedidos",         Icon: ClipboardList },
  { id: "planning",  label: "Planning",        Icon: CalendarDays  },
  { id: "retorno",   label: "Retorno/Cierre",  Icon: RotateCcw     },
  { id: "config",    label: "Config",          Icon: Settings      },
];

/* ─── Utilidades UI ────────────────────────────────────────────────────────── */
function Badge({ children, color = C.brandSoft, ink = C.brand, size = 11 }) {
  return <span style={{ display:"inline-block", padding:"2px 8px", borderRadius:999, background:color, color:ink, fontSize:size, fontWeight:600, whiteSpace:"nowrap" }}>{children}</span>;
}

function Btn({ children, onClick, disabled, color = C.brand, textColor = "#fff", outline = false, style: s = {}, ...rest }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:999, border: outline ? `1px solid ${C.strong}` : "none",
        background: outline ? C.s2 : color, color: outline ? C.ink : textColor, fontWeight:600, fontSize:13.5, cursor:"pointer", opacity: disabled ? 0.5 : 1, fontFamily:"inherit", ...s }}
      {...rest}>
      {children}
    </button>
  );
}

/* ─── AvisoPortal ─────────────────────────────────────────────────────────── */
function AvisoPortal({ tipo, L }) {
  const PORTAL_URL = import.meta.env?.VITE_PORTAL_URL || "http://localhost:3000";
  const esSinAcceso = tipo === "sin_acceso";
  const esContratar = tipo === "no_contratado";
  const Icon = esSinAcceso ? Shield : esContratar ? ShoppingBag : Building2;
  const titulo = esSinAcceso
    ? L("Sin acceso a L-Scale","No access to L-Scale")
    : esContratar ? L("L-Scale no está contratado","L-Scale is not active") : L("Crea tu empresa en Scale","Create your company in Scale");
  const texto  = esSinAcceso
    ? L("No tienes permiso para acceder a L-Scale. Contacta con el administrador de tu empresa.","You don't have permission to access L-Scale. Contact your company administrator.")
    : esContratar
    ? L("Tu empresa aún no tiene L-Scale. Contrátalo desde el portal Scale.","Your company doesn't have L-Scale yet. Get it from the Scale portal.")
    : L("Tu cuenta todavía no tiene empresa. Créala en el portal Scale.","Your account has no company yet. Create it in the Scale portal.");
  const cta    = esSinAcceso ? L("Volver al portal","Back to portal") : esContratar ? L("Contratar en el portal","Get it in the portal") : L("Ir al portal Scale","Go to the Scale portal");
  const destino = esSinAcceso ? PORTAL_URL : esContratar ? `${PORTAL_URL}/apps` : `${PORTAL_URL}/onboarding`;
  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"grid", placeItems:"center", padding:24, fontFamily:"var(--font-body)" }}>
      <div style={{ maxWidth:420, background:C.surface, border:`1px solid ${C.line}`, borderRadius:16, boxShadow:"var(--shadow-lg)", padding:30, textAlign:"center" }}>
        <div style={{ width:52, height:52, borderRadius:13, background:C.brandSoft, color:C.brand, display:"grid", placeItems:"center", margin:"0 auto 16px" }}><Icon size={26}/></div>
        <h1 style={{ fontSize:20, marginBottom:8 }}>{titulo}</h1>
        <p style={{ fontSize:14, color:C.sub, lineHeight:1.5, marginBottom:22 }}>{texto}</p>
        <a href={destino} style={{ display:"inline-flex", alignItems:"center", gap:8, background:C.brand, color:"#fff", padding:"12px 20px", borderRadius:999, fontWeight:600, fontSize:14.5, textDecoration:"none" }}>
          {cta} <ArrowRight size={17}/>
        </a>
      </div>
    </div>
  );
}

/* ─── Onboarding: activar L-Scale ─────────────────────────────────────────── */
function SinConfig({ empresa, onDone, L }) {
  const [busy, setBusy] = useState(false);
  const activar = async () => {
    setBusy(true);
    try { await crearConfigInicial(empresa.id); onDone(); }
    catch (e) { console.error(e); setBusy(false); }
  };
  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"grid", placeItems:"center", padding:24, fontFamily:"var(--font-body)" }}>
      <div style={{ maxWidth:440, background:C.surface, border:`1px solid ${C.line}`, borderRadius:16, boxShadow:"var(--shadow-lg)", padding:30, textAlign:"center" }}>
        <div style={{ width:52, height:52, borderRadius:13, background:C.brandSoft, color:C.brand, display:"grid", placeItems:"center", margin:"0 auto 16px" }}><Warehouse size={26}/></div>
        <h1 style={{ fontSize:20, marginBottom:8 }}>{L("Configura L-Scale","Set up L-Scale")}</h1>
        <p style={{ fontSize:14, color:C.sub, lineHeight:1.5, marginBottom:22 }}>
          {L(`Activa L-Scale para ${empresa.nombre} para empezar a gestionar tu almacén.`,
             `Activate L-Scale for ${empresa.nombre} to start managing your warehouse.`)}
        </p>
        <Btn onClick={activar} disabled={busy} style={{ fontSize:15, padding:"13px 24px" }}>
          {busy ? <Loader size={16} className="spin"/> : <Package size={16}/>}
          {L("Activar L-Scale","Activate L-Scale")}
        </Btn>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL UBICACIONES POR CATEGORÍA
   ═══════════════════════════════════════════════════════════════════════════ */
function UbicacionesModal({ materiales, setMateriales, empresaId, almacenId, almacenNombre, onClose }) {
  const KEY = `lscale.ubicaciones.${empresaId}.${almacenId}`;

  // Categorías únicas del almacén, sin vacíos, ordenadas
  const categorias = [...new Set(
    materiales
      .filter(m => m.almacen_id == null || m.almacen_id === almacenId)
      .map(m => (m.categoria || "").trim())
      .filter(Boolean)
  )].sort();

  const [mapa, setMapa] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  });
  const [aplicado, setAplicado] = useState(false);

  const set = (cat, val) => setMapa(p => ({ ...p, [cat]: val }));

  const guardar = () => {
    localStorage.setItem(KEY, JSON.stringify(mapa));
    // Aplicar a todos los materiales del almacén: si la categoría tiene ubicación asignada, actualizarla
    setMateriales(prev => prev.map(m => {
      if (m.almacen_id != null && m.almacen_id !== almacenId) return m;
      const cat = (m.categoria || "").trim();
      if (cat && mapa[cat] !== undefined && mapa[cat] !== "") {
        return { ...m, ubicacion: mapa[cat] };
      }
      return m;
    }));
    setAplicado(true);
    setTimeout(() => setAplicado(false), 2000);
  };

  const limpiar = () => {
    localStorage.removeItem(KEY);
    setMapa({});
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"grid",
      placeItems:"center", zIndex:600, padding:16 }} onClick={onClose}>
      <div style={{ background:C.surface, borderRadius:16, boxShadow:"0 20px 60px rgba(0,0,0,.25)",
        width:"100%", maxWidth:520, maxHeight:"85vh", display:"flex", flexDirection:"column" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.line}`, flexShrink:0,
          display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:700 }}>Ubicaciones por categoría</div>
            <div style={{ fontSize:12, color:C.sub, marginTop:2 }}>
              {almacenNombre} · plantilla de ubicaciones
            </div>
          </div>
          <button onClick={onClose}
            style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, display:"flex", padding:4 }}>
            <X size={18}/>
          </button>
        </div>

        {/* Instrucción */}
        <div style={{ padding:"10px 20px", fontSize:12, color:C.dim, borderBottom:`1px solid ${C.line}`,
          flexShrink:0, background:C.s2 }}>
          Escribe la ubicación para cada categoría. Al aplicar, todos los materiales de esa categoría
          en este almacén actualizarán su campo Ubicación.
        </div>

        {/* Lista de categorías */}
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

        {/* Footer */}
        <div style={{ padding:"12px 20px", borderTop:`1px solid ${C.line}`, flexShrink:0,
          display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={limpiar}
            style={{ background:"none", border:`1px solid ${C.strong}`, cursor:"pointer",
              color:C.sub, borderRadius:8, padding:"7px 14px", fontSize:13, fontFamily:"inherit" }}>
            Limpiar plantilla
          </button>
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

/* ═══════════════════════════════════════════════════════════════════════════
   TAB ALMACÉN
   ═══════════════════════════════════════════════════════════════════════════ */
function TabAlmacen({ materiales, setMateriales, empresa, modo, almacenes, L }) {
  const EMP_ID = `lscale.cols.${empresa?.id}`;
  const defCols = TODAS_COLS.filter((c) => c.def).map((c) => c.id);
  const [colsVis, setColsVis]       = useState(() => { try { return JSON.parse(localStorage.getItem(EMP_ID)) || defCols; } catch { return defCols; } });
  const [showColCfg, setShowColCfg] = useState(false);
  const [busqueda, setBusqueda]     = useState("");
  const [editObj, setEditObj]       = useState(null);   // null | material (editar) | {} (nuevo)
  const [saving, setSaving]         = useState(false);
  const [delConf, setDelConf]       = useState(null);   // id a borrar
  const [almacenSel, setAlmacenSel] = useState(() => almacenes?.[0]?.id ?? 1);
  const [showUbicaciones, setShowUbicaciones] = useState(false);

  const colsActivas = TODAS_COLS.filter((c) => c.fija || colsVis.includes(c.id));
  const toggleCol   = (id) => {
    const next = colsVis.includes(id) ? colsVis.filter((x) => x !== id) : [...colsVis, id];
    setColsVis(next); localStorage.setItem(EMP_ID, JSON.stringify(next));
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
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target.result);
      const wb = XLSX.read(data, { type: "uint8array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (!rows.length) return;
      // Mapeo flexible de columnas (case-insensitive)
      const map = { nombre:"nombre", name:"nombre", referencia:"referencia", ref:"referencia",
        descripcion:"descripcion", descripció:"descripcion", categoria:"categoria",
        "categoría":"categoria", unidad:"unidad", stock:"stock_actual", stock_actual:"stock_actual",
        stock_minimo:"stock_minimo", ubicacion:"ubicacion", "ubicación":"ubicacion",
        estado:"estado", proveedor:"proveedor", precio:"precio_coste", precio_coste:"precio_coste", notas:"notas" };
      const headers = Object.keys(rows[0]);
      const colMap = {};
      headers.forEach(h => { const k = map[h.toLowerCase().trim()]; if (k) colMap[h] = k; });
      const nuevos = rows.map(r => {
        const m = { ...blankMaterial };
        Object.entries(colMap).forEach(([h, k]) => { if (r[h] !== "") m[k] = r[h]; });
        m.stock_actual = Number(m.stock_actual) || 0;
        m.stock_minimo = Number(m.stock_minimo) || 0;
        m.id = Date.now() + Math.random();
        m.emp = empresa?.id;
        return m;
      }).filter(m => m.nombre);
      if (!nuevos.length) return;
      if (modo === "demo") {
        setMateriales(prev => [...prev, ...nuevos]);
      } else {
        Promise.all(nuevos.map(m => crearMaterial(m, empresa.id))).then(saved => {
          setMateriales(prev => [...prev, ...saved]);
        }).catch(console.error);
      }
    };
    reader.readAsArrayBuffer(file);
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

      {/* Selector de almacén */}
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

      {/* Barra de acciones */}
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 20px", borderBottom:`1px solid ${C.line}`, flexShrink:0, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, flex:"1 1 200px", background:C.s2, border:`1px solid ${C.line}`, borderRadius:999, padding:"7px 13px" }}>
          <Search size={15} color={C.sub}/>
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder={L("Buscar material…","Search material…")} style={{ border:"none", outline:"none", background:"transparent", fontSize:13.5, color:C.ink, width:"100%", fontFamily:"inherit" }}/>
          {busqueda && <button onClick={() => setBusqueda("")} style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, padding:0, display:"flex" }}><X size={13}/></button>}
        </div>
        <div style={{ position:"relative" }}>
          <Btn outline onClick={() => setShowColCfg((v) => !v)} style={{ padding:"8px 12px" }}><Columns3 size={15}/>{L("Columnas","Columns")}</Btn>
          {showColCfg && (
            <div style={{ position:"absolute", top:"calc(100% + 6px)", right:0, background:C.surface, border:`1px solid ${C.strong}`, borderRadius:12, boxShadow:"var(--shadow-lg)", padding:"10px 0", zIndex:200, minWidth:170 }}>
              {TODAS_COLS.filter((c) => !c.fija).map((c) => (
                <label key={c.id} style={{ display:"flex", alignItems:"center", gap:9, padding:"7px 14px", cursor:"pointer", fontSize:13 }}>
                  <input type="checkbox" checked={colsVis.includes(c.id)} onChange={() => toggleCol(c.id)} style={{ accentColor:C.brand }}/>
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
          <Btn outline onClick={handleExportAlmExcel} style={{ padding:"8px 12px" }}>
            <Download size={15}/>Excel
          </Btn>
          <Btn outline onClick={handleExportAlmPdf} style={{ padding:"8px 12px" }}>
            <FileDown size={15}/>PDF
          </Btn>
        </div>
        <Btn onClick={() => setEditObj({ ...blankMaterial })}><Plus size={15}/>{L("Nuevo","New")}</Btn>
      </div>

      {/* Tabla */}
      <div style={{ flex:1, overflow:"auto" }}>
        {/* Cabecera */}
        <div style={{ display:"grid", gridTemplateColumns:gtc, gap:0, position:"sticky", top:0, zIndex:10, background:C.surface, borderBottom:`1px solid ${C.line}`, padding:"0 20px" }}>
          {colsActivas.map((c) => (
            <div key={c.id} style={{ padding:"10px 8px", fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.6, overflow:"hidden" }}>{c.label}</div>
          ))}
          <div/>
          <div/>
        </div>

        {/* Filas */}
        {filtrados.length === 0 && (
          <div style={{ padding:40, textAlign:"center", color:C.sub, fontSize:14 }}>
            {busqueda ? L("Sin resultados","No results") : L("Sin materiales. Pulsa «Nuevo» para añadir.","No materials yet. Press «New» to add one.")}
          </div>
        )}
        {filtrados.map((m) => (
          <div key={m.id} style={{ display:"grid", gridTemplateColumns:gtc, gap:0, padding:"0 20px", borderBottom:`1px solid ${C.line}`, alignItems:"center", transition:"background .12s" }}
            onMouseEnter={(e) => e.currentTarget.style.background = C.s2}
            onMouseLeave={(e) => e.currentTarget.style.background = ""}>
            {colsActivas.map((c) => (
              <div key={c.id} style={{ padding:"10px 8px", fontSize:13.5, overflow:"hidden" }}>{renderCel(m, c.id)}</div>
            ))}
            {/* Botón stock bajo */}
            <div style={{ padding:"10px 4px" }}>
              {m.stock_actual <= m.stock_minimo && m.stock_minimo > 0 &&
                <span title={L("Stock bajo el mínimo","Stock below minimum")} style={{ fontSize:10, fontWeight:700, background:C.warnSoft, color:C.warn, borderRadius:6, padding:"2px 6px" }}>⚠</span>}
            </div>
            {/* Acciones */}
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
        ))}
      </div>

      {/* Modal editar / nuevo */}
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

      {/* Confirmar borrar */}
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

      {/* Modal ubicaciones por categoría */}
      {showUbicaciones && (
        <UbicacionesModal
          materiales={materiales}
          setMateriales={setMateriales}
          empresaId={empresa?.id}
          almacenId={almacenSel}
          almacenNombre={almacenes?.find(a => a.id === almacenSel)?.nombre || "Almacén"}
          onClose={() => setShowUbicaciones(false)}
        />
      )}
    </div>
  );
}

function ModalField({ label, value, onChange, type = "text", placeholder = "", style: s = {} }) {
  return (
    <div style={s}>
      <label style={{ fontSize:11.5, fontWeight:600, color:"var(--text-2)", letterSpacing:.5, display:"block", marginBottom:5 }}>{label}</label>
      <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ width:"100%", padding:"9px 11px", border:`1px solid var(--border-strong)`, borderRadius:10, fontSize:13.5, fontFamily:"inherit", background:"var(--surface-2)", color:"var(--text)", outline:"none" }}/>
    </div>
  );
}




/* ═══════════════════════════════════════════════════════════════════════════
   TAB RETORNO / CIERRE
   ═══════════════════════════════════════════════════════════════════════════ */
const CHIP_ESTADO = {
  borrador:   { bg:"#f1f5f9", ink:"#64748b" },
  confirmado: { bg:"#dcfce7", ink:"#16a34a" },
  planificado:{ bg:"#dbeafe", ink:"#2563eb" },
  en_ruta:    { bg:"#fef3c7", ink:"#d97706" },
  entregado:  { bg:"#dcfce7", ink:"#16a34a" },
  cancelado:  { bg:"#fee2e2", ink:"#dc2626" },
};

function TabRetorno({ pedidos = [], setPedidos, vehiculosEmpresa = [], onSavePedido, formatoFecha = "DD/MM/YYYY", L }) {
  const [filtro, setFiltro] = useState("activos"); // "activos" | "entregados" | "todos"
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
      {/* Header */}
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
                {/* Estado chip */}
                <span style={{ padding:"3px 10px", borderRadius:999, background:chip.bg, color:chip.ink,
                  fontSize:11.5, fontWeight:700, flexShrink:0 }}>{p.estado}</span>

                {/* Info */}
                <div style={{ flex:1, minWidth:160 }}>
                  <div style={{ fontWeight:700, fontSize:14.5 }}>{p.codigo || `PED-${p.id}`}</div>
                  <div style={{ color:C.sub, fontSize:12.5, marginTop:2 }}>
                    {p.nombre && <span>{p.nombre}</span>}
                    {p.destino && <span> · 📍{p.destino}</span>}
                  </div>
                </div>

                {/* Fechas */}
                <div style={{ fontSize:12, color:C.sub, minWidth:120 }}>
                  {p.fecha_entrega && <div>📅 {L("Salida","Out")}: <strong style={{ color:C.ink }}>{fmtF(p.fecha_entrega)}{p.hora_ida ? ` ${p.hora_ida}` : ""}</strong></div>}
                  {p.fecha_retorno && <div>🏠 {L("Retorno","Return")}: <strong style={{ color:C.ink }}>{fmtF(p.fecha_retorno)}{p.hora_vuelta ? ` ${p.hora_vuelta}` : ""}</strong></div>}
                </div>

                {/* Vehículo */}
                {veh && (
                  <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px",
                    borderRadius:8, background:`${veh.color}18`, border:`1px solid ${veh.color}44`,
                    fontSize:12.5, color:veh.color, fontWeight:600, flexShrink:0 }}>
                    🚐 {veh.nombre}{veh.matricula ? ` · ${veh.matricula}` : ""}
                  </div>
                )}

                {/* Acciones */}
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

/* ═══════════════════════════════════════════════════════════════════════════
   TAB CONFIG
   ═══════════════════════════════════════════════════════════════════════════ */
// Colores predefinidos para nuevos roles
const COLORES_ROLES = ["#0891b2","#be185d","#65a30d","#7c3aed","#f59e0b","#ef4444","#10b981","#8b5cf6","#f97316","#06b6d4"];

function TabConfig({ empresa, modo, almacenes, guardarAlmacenes, vehiculosEmpresa, guardarVehiculos, rolesImport, guardarRoles, formatoFecha = "DD/MM/YYYY", guardarFormatoFecha, isAdmin = true, L }) {
  const [alms, setAlms] = useState(almacenes);
  const [vehs, setVehs] = useState(vehiculosEmpresa || []);
  const [roles, setRoles] = useState(rolesImport || []);
  const [saved, setSaved] = useState(false);
  const [savedV, setSavedV] = useState(false);
  const [savedR, setSavedR] = useState(false);

  const addRol = () => setRoles(p => [...p, {
    key: `col_custom_${Date.now()}`,
    label: "",
    color: COLORES_ROLES[p.length % COLORES_ROLES.length],
    req: false,
    tipo: "columna",
  }]);
  const removeRol = (key) => setRoles(p => p.filter(r => r.key !== key));
  const updateRol = (key, field, value) => setRoles(p => p.map(r => r.key === key ? { ...r, [field]: value } : r));
  const guardarR = () => { guardarRoles(roles); setSavedR(true); setTimeout(() => setSavedR(false), 2000); };

  const addAlm = () => setAlms(p => [...p, { id: Date.now(), nombre: `Almacén ${p.length + 1}`, startRow: 6, parser: "hoja1hoja2" }]);
  const removeAlm = (id) => { if (alms.length > 1) setAlms(p => p.filter(a => a.id !== id)); };
  const updateAlm = (id, field, value) => setAlms(p => p.map(a => a.id === id ? { ...a, [field]: value } : a));
  const guardar = () => { guardarAlmacenes(alms); setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const addVeh = () => setVehs(p => [...p, { id: Date.now(), nombre:"", dni:"", modelo:"", tipo:"Furgoneta", matricula:"", color:"#3b82f6" }]);
  const removeVeh = (id) => setVehs(p => p.filter(v => v.id !== id));
  const updateVeh = (id, field, value) => setVehs(p => p.map(v => v.id === id ? { ...v, [field]: value } : v));
  const guardarV = () => { guardarVehiculos(vehs); setSavedV(true); setTimeout(() => setSavedV(false), 2000); };

  return (
    <div style={{ padding:28, maxWidth:580, overflowY:"auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
        <div style={{ background:C.brandSoft, color:C.brand, borderRadius:12, padding:10 }}><Settings size={22}/></div>
        <h2 style={{ fontSize:18 }}>{L("Configuración","Configuration")}</h2>
      </div>

      {!isAdmin && (
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderRadius:10, background:"rgba(99,102,241,0.08)", border:"1px solid rgba(99,102,241,0.2)", marginBottom:16, fontSize:13, color:"var(--brand)" }}>
          <Shield size={14}/>
          {L("Solo lectura. Solo un administrador puede modificar la configuración.","Read only. Only an administrator can modify the configuration.")}
        </div>
      )}

      {/* Info empresa */}
      <div style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:14, overflow:"hidden", marginBottom:20 }}>
        <div style={{ padding:"14px 18px", borderBottom:`1px solid ${C.line}` }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.6, marginBottom:4 }}>{L("EMPRESA","COMPANY")}</div>
          <div style={{ fontSize:16, fontWeight:600 }}>{empresa?.nombre || "—"}</div>
          <div style={{ fontSize:12, color:C.sub, marginTop:2 }}>ID: {empresa?.id}</div>
        </div>
        <div style={{ padding:"14px 18px", borderBottom:`1px solid ${C.line}` }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.6, marginBottom:4 }}>{L("MODO","MODE")}</div>
          <Badge color={modo === "demo" ? C.warnSoft : C.brandSoft} ink={modo === "demo" ? C.warn : C.brand}>
            {modo === "demo" ? L("Demo (sin Supabase)","Demo (no Supabase)") : "Supabase"}
          </Badge>
        </div>
        <div style={{ padding:"14px 18px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.6, marginBottom:4 }}>{L("APPS ACTIVAS","ACTIVE APPS")}</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {(empresa?.apps || []).map((a) => <Badge key={a}>{a}</Badge>)}
          </div>
        </div>
      </div>

      {/* Almacenes */}
      <div style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:14, overflow:"hidden", marginBottom:20 }}>
        <div style={{ padding:"14px 18px", borderBottom:`1px solid ${C.line}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.6, marginBottom:2 }}>{L("ALMACENES","WAREHOUSES")}</div>
            <div style={{ fontSize:12.5, color:C.sub }}>{L("Nombra los almacenes que usarás al importar pedidos.","Name the warehouses you'll use when importing orders.")}</div>
          </div>
          {isAdmin && <Btn onClick={addAlm} style={{ padding:"6px 12px", fontSize:12.5 }}><Plus size={14}/>{L("Añadir","Add")}</Btn>}
        </div>
        {alms.map((a, i) => (
          <div key={a.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 18px", borderBottom: i < alms.length - 1 ? `1px solid ${C.line}` : "none", flexWrap:"wrap" }}>
            <div style={{ width:26, height:26, borderRadius:7, background:C.brandSoft, color:C.brand, display:"grid", placeItems:"center", fontWeight:700, fontSize:12, flexShrink:0 }}>{i+1}</div>
            <input value={a.nombre} onChange={e => updateAlm(a.id, "nombre", e.target.value)} readOnly={!isAdmin}
              style={{ flex:1, minWidth:120, padding:"7px 10px", border:`1px solid ${C.strong}`, borderRadius:9, fontSize:13.5, fontFamily:"inherit", background:C.s2, color:C.ink, outline:"none" }}/>
            <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
              <label style={{ fontSize:11.5, color:C.sub, whiteSpace:"nowrap" }}>{L("Formato Excel","Excel format")}</label>
              <select value={a.parser || "hoja1hoja2"} onChange={e => updateAlm(a.id, "parser", e.target.value)} disabled={!isAdmin}
                style={{ padding:"6px 9px", border:`1px solid ${C.strong}`, borderRadius:9, fontSize:13, fontFamily:"inherit", background:C.s2, color:C.ink, outline:"none" }}>
                <option value="hoja1hoja2">{L("Hoja1 + Hoja2","Sheet1 + Sheet2")}</option>
                <option value="checklist">Checklist (1 hoja)</option>
              </select>
            </div>
            {(a.parser || "hoja1hoja2") === "hoja1hoja2" && (
              <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                <label style={{ fontSize:11.5, color:C.sub, whiteSpace:"nowrap" }}>{L("Fila inicio","Start row")}</label>
                <input type="number" min={1} max={50} value={a.startRow ?? 6} readOnly={!isAdmin}
                  onChange={e => updateAlm(a.id, "startRow", Math.max(1, Number(e.target.value) || 6))}
                  style={{ width:58, padding:"6px 8px", border:`1px solid ${C.strong}`, borderRadius:9, fontSize:13.5, fontFamily:"inherit", background:C.s2, color:C.ink, outline:"none", textAlign:"center" }}/>
              </div>
            )}
            {isAdmin && (
              <button onClick={() => removeAlm(a.id)} disabled={alms.length <= 1}
                style={{ background:"none", border:"none", cursor: alms.length <= 1 ? "not-allowed" : "pointer", color: alms.length <= 1 ? C.line : C.sub, padding:5, display:"flex", borderRadius:7 }}>
                <Trash2 size={15}/>
              </button>
            )}
          </div>
        ))}
        {isAdmin && (
          <div style={{ padding:"12px 18px", display:"flex", justifyContent:"flex-end" }}>
            <Btn onClick={guardar} color={saved ? C.ok : C.brand}>
              {saved ? <Check size={14}/> : <Check size={14}/>}
              {saved ? L("¡Guardado!","Saved!") : L("Guardar almacenes","Save warehouses")}
            </Btn>
          </div>
        )}
      </div>

      {/* Roles de importación */}
      <div style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:14, overflow:"hidden", marginBottom:20 }}>
        <div style={{ padding:"14px 18px", borderBottom:`1px solid ${C.line}`, display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.6, marginBottom:2 }}>ROLES DE IMPORTACIÓN</div>
            <div style={{ fontSize:12.5, color:C.sub, lineHeight:1.5 }}>
              Columnas adicionales que se pueden extraer del Excel al importar un pedido.<br/>
              <strong>Columna</strong>: aparece como columna independiente en el pedido. <strong>Descripción</strong>: aparece bajo el nombre del material.
            </div>
          </div>
          {isAdmin && <Btn onClick={addRol} style={{ padding:"6px 12px", fontSize:12.5, flexShrink:0, marginLeft:12 }}><Plus size={14}/>Añadir rol</Btn>}
        </div>

        {/* Roles fijos (informativos, no editables) */}
        <div style={{ padding:"10px 18px 6px", borderBottom:`1px solid ${C.line}` }}>
          <div style={{ fontSize:10.5, fontWeight:700, color:C.dim, letterSpacing:.5, marginBottom:8 }}>ROLES FIJOS (no editables)</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {[
              { label:"Nombre", color:"#3b82f6" },
              { label:"Cantidad", color:"#16a34a" },
              { label:"Grupo", color:"#f59e0b" },
              { label:"Categoría", color:"#8b5cf6" },
            ].map(r => (
              <div key={r.label} style={{ display:"flex", alignItems:"center", gap:5, padding:"3px 10px",
                borderRadius:7, border:`1px solid ${r.color}44`, background:`${r.color}10` }}>
                <div style={{ width:7, height:7, borderRadius:2, background:r.color }}/>
                <span style={{ fontSize:12, fontWeight:600, color:r.color }}>{r.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Roles editables */}
        <div style={{ padding:"8px 0" }}>
          {roles.length === 0 && (
            <div style={{ padding:"16px 18px", fontSize:13, color:C.sub, textAlign:"center" }}>
              Sin roles adicionales. Pulsa «Añadir rol» para crear uno.
            </div>
          )}
          {roles.map((rol, i) => (
            <div key={rol.key} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 18px",
              borderBottom: i < roles.length - 1 ? `1px solid ${C.line}` : "none", flexWrap:"wrap" }}>

              {/* Color picker */}
              <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                <div style={{ width:20, height:20, borderRadius:5, background:rol.color, border:`1px solid ${C.strong}` }}/>
                <input type="color" value={rol.color} onChange={e => updateRol(rol.key, "color", e.target.value)}
                  style={{ width:26, height:26, padding:0, border:"none", background:"none", cursor:"pointer" }}/>
              </div>

              {/* Nombre del rol */}
              <input value={rol.label} onChange={e => updateRol(rol.key, "label", e.target.value)}
                placeholder="Nombre del rol (ej. Referencia interna)"
                style={{ flex:"1 1 160px", minWidth:140, padding:"6px 10px",
                  border:`1.5px solid ${rol.label ? C.strong : C.danger + "88"}`,
                  borderRadius:8, fontSize:13, fontFamily:"inherit", background:C.s2, color:C.ink, outline:"none" }}/>

              {/* Tipo de visualización */}
              <div style={{ display:"flex", gap:0, borderRadius:8, overflow:"hidden", border:`1px solid ${C.strong}`, flexShrink:0 }}>
                {[
                  { val:"columna",     label:"Columna" },
                  { val:"descripcion", label:"Descripción" },
                ].map(({ val, label }) => (
                  <button key={val} onClick={() => updateRol(rol.key, "tipo", val)}
                    style={{ padding:"5px 12px", border:"none", fontFamily:"inherit", fontSize:12, cursor:"pointer",
                      background: rol.tipo === val ? rol.color : C.s2,
                      color: rol.tipo === val ? "#fff" : C.sub,
                      fontWeight: rol.tipo === val ? 700 : 400,
                      transition:"background .12s" }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Eliminar — solo admin */}
              {isAdmin && (
                <button onClick={() => removeRol(rol.key)}
                  style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, padding:5, borderRadius:7, flexShrink:0 }}>
                  <Trash2 size={15}/>
                </button>
              )}
            </div>
          ))}
        </div>

        {isAdmin && (
          <div style={{ padding:"12px 18px", display:"flex", justifyContent:"flex-end" }}>
            <Btn onClick={guardarR} color={savedR ? C.ok : C.brand}>
              {savedR ? <><Check size={14}/> ¡Guardado!</> : <><Check size={14}/> Guardar roles</>}
            </Btn>
          </div>
        )}
      </div>

      {/* Vehículos */}
      <div style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:14, overflow:"hidden", marginBottom:20 }}>
        <div style={{ padding:"14px 18px", borderBottom:`1px solid ${C.line}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.6, marginBottom:2 }}>{L("VEHÍCULOS / CONDUCTORES","VEHICLES / DRIVERS")}</div>
            <div style={{ fontSize:12.5, color:C.sub }}>{L("Vehículos disponibles para expediciones.","Vehicles available for expeditions.")}</div>
          </div>
          {isAdmin && <Btn onClick={addVeh} style={{ padding:"6px 12px", fontSize:12.5 }}><Plus size={14}/>{L("Añadir","Add")}</Btn>}
        </div>
        {vehs.map((v, i) => (
          <div key={v.id} style={{ padding:"12px 18px", borderBottom: i < vehs.length - 1 ? `1px solid ${C.line}` : "none" }}>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
              {/* Color chip */}
              <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                <div style={{ width:22, height:22, borderRadius:6, background:v.color, border:`1px solid ${C.strong}`, flexShrink:0 }}/>
                {isAdmin && <input type="color" value={v.color || "#3b82f6"} onChange={e => updateVeh(v.id, "color", e.target.value)}
                  style={{ width:28, height:28, padding:0, border:"none", background:"none", cursor:"pointer" }}/>}
              </div>
              <input value={v.nombre} onChange={e => updateVeh(v.id, "nombre", e.target.value)} readOnly={!isAdmin}
                placeholder={L("Nombre conductor","Driver name")}
                style={{ flex:"1 1 110px", minWidth:100, padding:"6px 9px", border:`1px solid ${C.strong}`, borderRadius:8, fontSize:13, fontFamily:"inherit", background:C.s2, color:C.ink, outline:"none" }}/>
              <input value={v.matricula} onChange={e => updateVeh(v.id, "matricula", e.target.value)} readOnly={!isAdmin}
                placeholder="Matrícula"
                style={{ flex:"1 1 90px", minWidth:80, padding:"6px 9px", border:`1px solid ${C.strong}`, borderRadius:8, fontSize:13, fontFamily:"inherit", background:C.s2, color:C.ink, outline:"none" }}/>
              <input value={v.modelo} onChange={e => updateVeh(v.id, "modelo", e.target.value)} readOnly={!isAdmin}
                placeholder="Modelo"
                style={{ flex:"1 1 110px", minWidth:100, padding:"6px 9px", border:`1px solid ${C.strong}`, borderRadius:8, fontSize:13, fontFamily:"inherit", background:C.s2, color:C.ink, outline:"none" }}/>
              <select value={v.tipo || "Furgoneta"} onChange={e => updateVeh(v.id, "tipo", e.target.value)} disabled={!isAdmin}
                style={{ flex:"0 0 100px", padding:"6px 9px", border:`1px solid ${C.strong}`, borderRadius:8, fontSize:13, fontFamily:"inherit", background:C.s2, color:C.ink, outline:"none" }}>
                <option>Furgoneta</option>
                <option>Camión</option>
                <option>Trailer</option>
                <option>Coche</option>
              </select>
              <input value={v.dni} onChange={e => updateVeh(v.id, "dni", e.target.value)} readOnly={!isAdmin}
                placeholder="DNI"
                style={{ flex:"0 0 90px", padding:"6px 9px", border:`1px solid ${C.strong}`, borderRadius:8, fontSize:13, fontFamily:"inherit", background:C.s2, color:C.ink, outline:"none" }}/>
              {isAdmin && (
                <button onClick={() => removeVeh(v.id)}
                  style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, padding:5, display:"flex", borderRadius:7, flexShrink:0 }}>
                  <Trash2 size={15}/>
                </button>
              )}
            </div>
          </div>
        ))}
        {vehs.length === 0 && (
          <div style={{ padding:"20px 18px", color:C.sub, fontSize:13.5, textAlign:"center" }}>
            {L("Sin vehículos. Pulsa «Añadir» para crear uno.","No vehicles. Click «Add» to create one.")}
          </div>
        )}
        {isAdmin && <div style={{ padding:"12px 18px", display:"flex", justifyContent:"flex-end" }}>
          <Btn onClick={guardarV} color={savedV ? C.ok : C.brand}>
            {savedV ? <Check size={14}/> : <Check size={14}/>}
            {savedV ? L("¡Guardado!","Saved!") : L("Guardar vehículos","Save vehicles")}
          </Btn>
        </div>}
      </div>

      {/* Formato de fecha */}
      <div style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:14, overflow:"hidden", marginBottom:20 }}>
        <div style={{ padding:"14px 18px", borderBottom:`1px solid ${C.line}` }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.6, marginBottom:2 }}>{L("FORMATO DE FECHA","DATE FORMAT")}</div>
          <div style={{ fontSize:12.5, color:C.sub }}>{L("Formato en que se muestran las fechas en toda la aplicación.","Format used to display dates throughout the app.")}</div>
        </div>
        {!isAdmin && (
          <div style={{ padding:"8px 16px", background:"var(--warn-soft)", borderBottom:`1px solid ${C.line}`, fontSize:12.5, color:"var(--warn)" }}>
            🔒 {L("Solo lectura — sin permisos de edición.","Read-only — no edit permissions.")}
          </div>
        )}
        <div style={{ padding:"16px 18px", display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
          {["DD/MM/YYYY","MM/DD/YYYY","DD-MM-YYYY"].map(fmt => (
            <button key={fmt} disabled={!isAdmin} onClick={() => isAdmin && guardarFormatoFecha?.(fmt)}
              style={{
                padding:"8px 18px", borderRadius:8, border:`2px solid ${formatoFecha === fmt ? C.brand : C.line}`,
                background: formatoFecha === fmt ? C.brandSoft : C.s2,
                color: formatoFecha === fmt ? C.brand : C.ink,
                fontWeight: formatoFecha === fmt ? 700 : 400,
                cursor: isAdmin ? "pointer" : "not-allowed", fontSize:14, fontFamily:"monospace",
              }}>
              {fmt}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background:"var(--warn-soft)", border:"1px solid var(--warn)", borderRadius:12, padding:"12px 16px", fontSize:13, color:"var(--warn)" }}>
        ⚠ {L("Recuerda ejecutar la migración SQL en Supabase (supabase/01_lscale.sql) antes de usar con datos reales.",
             "Remember to run the SQL migration in Supabase (supabase/01_lscale.sql) before using with real data.")}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   APP PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */
export default function App() {
  const [lang,  setLang]  = useState(() => localStorage.getItem("scale.lang")  || "es");
  const [tema,  setTema]  = useState(() => localStorage.getItem("scale.theme") || "light");
  const [tab,   setTab]   = useState("almacen");
  const [carga, setCarga] = useState(true);
  const [modo,  setModo]  = useState(null);
  const [empresa,       setEmpresa]       = useState(null);
  const [materiales,    setMateriales]    = useState([]);
  const [pedidos,       setPedidos]       = useState([]);
  const [expediciones,  setExpediciones]  = useState([]);
  const [sesion,        setSesion]        = useState(undefined);
  const [almacenes,         setAlmacenes]         = useState(DEFAULT_ALMACENES);
  const [vehiculosEmpresa,  setVehiculosEmpresa]  = useState(DEFAULT_VEHICULOS_EMPRESA);
  const [rolesImport,       setRolesImport]       = useState(ROLES_DEFECTO);
  const [tramosExp,         setTramosExp]         = useState([]);
  const [vehiculosExp,      setVehiculosExp]      = useState([]);
  const [myRol,             setMyRol]             = useState("owner"); // owner en demo/error
  const [formatoFecha,      setFormatoFecha]      = useState("DD/MM/YYYY");

  const tramosIniciales = useMemo(() => {
    const r = {};
    for (const e of expediciones) {
      if (e.pedido_id && Array.isArray(e.tramos)) r[String(e.pedido_id)] = e.tramos;
    }
    return r;
  }, [expediciones]);

  // Cargar preferencias de empresa (almacenes, vehículos, roles, formatoFecha)
  // En modo Supabase: desde empresa_config.datos_json. En demo: desde localStorage.
  useEffect(() => {
    if (!empresa?.id) return;
    if (modo === "supabase") {
      cargarPrefs(empresa.id).then(prefs => {
        if (!prefs) return;
        if (Array.isArray(prefs.almacenes) && prefs.almacenes.length) setAlmacenes(prefs.almacenes);
        if (Array.isArray(prefs.vehiculos) && prefs.vehiculos.length) setVehiculosEmpresa(prefs.vehiculos);
        if (Array.isArray(prefs.roles) && prefs.roles.length) setRolesImport(prefs.roles);
        if (prefs.formatoFecha) setFormatoFecha(prefs.formatoFecha);
      });
    } else {
      try {
        const savedAlm = JSON.parse(localStorage.getItem(`lscale.almacenes.${empresa.id}`));
        if (Array.isArray(savedAlm) && savedAlm.length) setAlmacenes(savedAlm);
      } catch {}
      try {
        const savedVeh = JSON.parse(localStorage.getItem(`lscale.vehiculos.${empresa.id}`));
        if (Array.isArray(savedVeh) && savedVeh.length) setVehiculosEmpresa(savedVeh);
      } catch {}
      try {
        const savedRoles = JSON.parse(localStorage.getItem(`lscale.roles.${empresa.id}`));
        if (Array.isArray(savedRoles) && savedRoles.length) setRolesImport(savedRoles);
      } catch {}
      try {
        const savedFmt = localStorage.getItem(`lscale.formatoFecha.${empresa.id}`);
        if (savedFmt) setFormatoFecha(savedFmt);
      } catch {}
    }
  }, [empresa?.id, modo]);

  const guardarAlmacenes = (list) => {
    setAlmacenes(list);
    if (!empresa?.id) return;
    if (modo === "supabase") guardarPrefs(empresa.id, { almacenes: list });
    else localStorage.setItem(`lscale.almacenes.${empresa.id}`, JSON.stringify(list));
  };

  const guardarVehiculos = (list) => {
    setVehiculosEmpresa(list);
    if (!empresa?.id) return;
    if (modo === "supabase") guardarPrefs(empresa.id, { vehiculos: list });
    else localStorage.setItem(`lscale.vehiculos.${empresa.id}`, JSON.stringify(list));
  };

  const guardarRoles = (list) => {
    setRolesImport(list);
    if (!empresa?.id) return;
    if (modo === "supabase") guardarPrefs(empresa.id, { roles: list });
    else localStorage.setItem(`lscale.roles.${empresa.id}`, JSON.stringify(list));
  };

  const guardarFormatoFecha = (fmt) => {
    setFormatoFecha(fmt);
    if (!empresa?.id) return;
    if (modo === "supabase") guardarPrefs(empresa.id, { formatoFecha: fmt });
    else localStorage.setItem(`lscale.formatoFecha.${empresa.id}`, fmt);
  };

  useEffect(() => { document.documentElement.setAttribute("data-theme", tema); }, [tema]);
  const toggleTema = () => {
    const next = tema === "dark" ? "light" : "dark";
    setTema(next); localStorage.setItem("scale.theme", next);
  };
  const cambiarLang = () => {
    const idx   = IDIOMAS.findIndex((x) => x.id === lang);
    const next  = IDIOMAS[(idx + 1) % IDIOMAS.length].id;
    setLang(next); localStorage.setItem("scale.lang", next);
  };

  // Auth
  useEffect(() => {
    if (!supabaseConfigurado) { setSesion(null); return; }
    sb().auth.getSession().then(({ data: { session } }) => setSesion(session));
    const { data: { subscription } } = sb().auth.onAuthStateChange((_ev, s) => setSesion(s));
    return () => subscription.unsubscribe();
  }, []);

  // Carga de datos
  const cargar = useCallback(async () => {
    setCarga(true);
    const res = await cargarDatos();
    setModo(res.modo);
    setEmpresa(res.empresas?.[0] || null);
    setMateriales(res.materiales || []);
    setPedidos(res.pedidos || []);
    setExpediciones(res.expediciones || []);
    setMyRol(res.rol ?? "owner");
    setCarga(false);
  }, []);

  useEffect(() => {
    if (sesion !== undefined) cargar();
  }, [sesion, cargar]);

  const L = (es, en, ca) => {
    if (lang === "ca") return ca ?? es;
    if (lang === "en") return en ?? es;
    return es;
  };

  // — Pantallas de guardián —
  if (carga || sesion === undefined) {
    return (
      <LangContext.Provider value={lang}>
        <div style={{ minHeight:"100vh", background:C.bg, display:"grid", placeItems:"center" }}>
          <Loader size={28} className="spin" color={C.brand}/>
        </div>
      </LangContext.Provider>
    );
  }
  if (supabaseConfigurado && (!sesion || modo === "sin_sesion")) {
    return <LangContext.Provider value={lang}><Login/></LangContext.Provider>;
  }
  if (modo === "sin_empresa") {
    return <LangContext.Provider value={lang}><AvisoPortal tipo="sin_empresa" L={L}/></LangContext.Provider>;
  }
  if (modo === "no_contratado") {
    return <LangContext.Provider value={lang}><AvisoPortal tipo="no_contratado" L={L}/></LangContext.Provider>;
  }
  if (modo === "sin_acceso") {
    return <LangContext.Provider value={lang}><AvisoPortal tipo="sin_acceso" L={L}/></LangContext.Provider>;
  }
  if (modo === "sin_config") {
    return <LangContext.Provider value={lang}><SinConfig empresa={empresa} onDone={cargar} L={L}/></LangContext.Provider>;
  }

  // — Shell principal —
  return (
    <LangContext.Provider value={lang}>
      <div style={{ height:"100vh", display:"flex", flexDirection:"column", background:C.bg, fontFamily:"var(--font-body)" }}>

        {/* Topbar */}
        <div style={{ height:52, background:C.surface, borderBottom:`1px solid ${C.line}`, display:"flex", alignItems:"center", padding:"0 16px", gap:8, flexShrink:0, zIndex:100 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginRight:8 }}>
            <div style={{ width:30, height:30, borderRadius:8, background:C.brand, color:"#fff", display:"grid", placeItems:"center", fontWeight:800, fontSize:15 }}>L</div>
            <span style={{ fontWeight:700, fontSize:15.5 }}>L-scale</span>
            {modo === "demo" && <Badge color={C.warnSoft} ink={C.warn} size={10}>DEMO</Badge>}
          </div>

          {/* Tabs */}
          <div style={{ display:"flex", gap:2, flex:1, overflowX:"auto" }}>
            {TABS.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:8, border:"none", fontWeight: tab === id ? 600 : 400, fontSize:13.5, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap",
                  background: tab === id ? C.brandSoft : "transparent", color: tab === id ? C.brand : C.sub, transition:"background .15s" }}>
                <Icon size={15}/>{label}
              </button>
            ))}
          </div>

          {/* Controles derecha */}
          <div style={{ display:"flex", gap:6, marginLeft:"auto" }}>
            <button onClick={cambiarLang} title={L("Cambiar idioma","Change language")} style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, padding:6, borderRadius:8, display:"flex" }}><Globe size={16}/></button>
            <button onClick={toggleTema} title={L("Cambiar tema","Toggle theme")} style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, padding:6, borderRadius:8, display:"flex" }}>
              {tema === "dark" ? <Sun size={16}/> : <Moon size={16}/>}
            </button>
            {supabaseConfigurado && (
              <button onClick={() => sb().auth.signOut()} title={L("Cerrar sesión","Sign out")} style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, padding:6, borderRadius:8, display:"flex", fontSize:12 }}>
                {L("Salir","Out")}
              </button>
            )}
          </div>
        </div>

        {/* Contenido */}
        <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column", minHeight:0 }}>
          {tab === "almacen"  && <TabAlmacen  materiales={materiales} setMateriales={setMateriales} empresa={empresa} modo={modo} almacenes={almacenes} L={L}/>}
          {tab === "pedido"   && <TabPedidos  almacenes={almacenes} empresa={empresa} modo={modo} pedidos={pedidos} setPedidos={setPedidos} materiales={materiales} setMateriales={setMateriales} vehiculosEmpresa={vehiculosEmpresa} setTramos={setTramosExp} rolesImport={rolesImport} formatoFecha={formatoFecha}/>}
          {tab === "planning" && <TabPlanning pedidos={pedidos} setPedidos={setPedidos} vehiculosEmpresa={vehiculosEmpresa} formatoFecha={formatoFecha} onSavePedido={async p => { if (modo === "supabase" && empresa?.id) await guardarPedido(p, empresa.id); }} tramosIniciales={tramosIniciales} onSaveTramos={async (pid, tramos) => { if (modo === "supabase" && empresa?.id) await guardarTramos(pid, tramos, empresa.id); }}/>}
          {tab === "retorno"  && <TabRetorno  pedidos={pedidos} setPedidos={setPedidos} vehiculosEmpresa={vehiculosEmpresa} formatoFecha={formatoFecha} onSavePedido={async p => { if (modo === "supabase" && empresa?.id) await guardarPedido(p, empresa.id); }} L={L}/>}
          {tab === "config"   && <TabConfig   empresa={empresa} modo={modo} almacenes={almacenes} guardarAlmacenes={guardarAlmacenes} vehiculosEmpresa={vehiculosEmpresa} guardarVehiculos={guardarVehiculos} rolesImport={rolesImport} guardarRoles={guardarRoles} formatoFecha={formatoFecha} guardarFormatoFecha={guardarFormatoFecha} isAdmin={myRol === "owner" || myRol === "admin"} L={L}/>}
        </div>
      </div>
    </LangContext.Provider>
  );
}
