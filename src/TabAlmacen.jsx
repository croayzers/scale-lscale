// MARK: - UbicacionesModal
// MARK: - TabAlmacen
import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Search, Columns3, MapPin, Upload, Download, FileDown,
  Plus, Pencil, Trash2, X, Check, Loader, AlertTriangle, Combine, ImageIcon, SlidersHorizontal, ClipboardCheck, ShoppingCart, Cloud,
} from "lucide-react";
import { C, Badge, Btn, ModalField, Help } from "./lib/ui.jsx";
import { crearMaterial, upsertMaterialesLote, actualizarMaterial, borrarMaterial, borrarMaterialesLote, subirImagenMaterial, borrarImagenMaterial } from "./lib/data.js";
import { sb } from "./lib/supabase.js";
import AlmacenConfigurador from "./AlmacenConfigurador.jsx";
import PanelTrazabilidad from "./PanelTrazabilidad.jsx";
import { nivelMaterial, caps } from "./lib/gestion.js";
import { OrigenDatosPanel } from "@scale/shared/connectors";

// Decodifica el base64 devuelto por /api/sharepoint/files/content a un File
// real, para reusar AlmacenConfigurador (FileReader.readAsArrayBuffer) sin
// tocar su parser — igual que si el usuario hubiera subido el archivo local.
function base64AFile(base64, filename) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: "application/octet-stream" });
}

const TODAS_COLS = [
  { id: "imagen",       label: "IMG",           fija: false, def: false, w: "52px" },
  { id: "referencia",   label: "REFERENCIA",    fija: false, def: true  },
  { id: "nombre",       label: "NOMBRE",        fija: true,  def: true  },
  { id: "categoria",    label: "CATEGORÍA",     fija: false, def: true  },
  { id: "unidad",       label: "UNIDAD",        fija: false, def: true  },
  { id: "stock_actual", label: "STOCK",         fija: false, def: true, help: "Existencias actuales en este almacén. En verde si está por encima del mínimo; en ámbar si está al límite o por debajo." },
  { id: "stock_minimo", label: "MÍN.",          fija: false, def: false, help: "Nivel mínimo deseado. Cuando el stock baja de aquí, el material se marca con alerta ⚠." },
  { id: "valor_stock",  label: "VALOR STOCK",   fija: false, def: false, help: "Valor total del material en almacén = stock actual × coste unitario." },
  { id: "ubicacion",    label: "UBICACIÓN",     fija: false, def: true  },
  { id: "estado",       label: "ESTADO",        fija: false, def: true  },
  { id: "proveedor",             label: "PROVEEDOR",      fija: false, def: true  },
  { id: "referencia_proveedor", label: "REF. PROVEEDOR", fija: false, def: true  },
  { id: "sku_interno",          label: "SKU",            fija: false, def: false, help: "Código interno único e inmutable del material." },
  { id: "tipo_trazabilidad",    label: "CONTROL",        fija: false, def: false, help: "Cómo se valora la salida de stock: Consumible (precio medio), Por lotes (FIFO) o Serializado (nº de serie)." },
  { id: "precio_coste",         label: "COSTE",          fija: false, def: false, help: "Coste unitario de compra del material." },
  { id: "precio",               label: "PVP",            fija: false, def: false, help: "Precio de venta al público por unidad." },
  { id: "margen",               label: "MARGEN",         fija: false, def: false, help: "Margen sobre PVP = (PVP − coste) ÷ PVP. Se calcula a partir de Coste y PVP." },
  { id: "periodo_amortizacion", label: "RECUP. UD",     fija: false, def: false, help: "Unidades a vender para recuperar el coste (coste ÷ margen por unidad). No es el periodo de amortización del activo en días." },
  { id: "coste_amortizacion",   label: "MARGEN €/UD",   fija: false, def: false, help: "Beneficio por unidad vendida = PVP − coste." },
  { id: "coste_adquisicion",    label: "COSTE ADQ.",    fija: false, def: false, help: "Coste de adquisición del activo. Base para calcular la amortización diaria de alquiler." },
  { id: "periodo_amort_dias",   label: "AMORT. (DÍAS)", fija: false, def: false, help: "Periodo de amortización del activo en días (lo fija el financiero). Ej: 1825 = 5 años." },
  { id: "amort_diaria",         label: "AMORT. €/DÍA",  fija: false, def: false, help: "Coste imputado por día de alquiler en eventos = coste de adquisición ÷ días de amortización." },
  { id: "tipo_activo",          label: "TIPO",          fija: false, def: false, help: "Origen del activo: Propio (tuyo) o Subalquilado (de un proveedor)." },
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

function useCatsAbiertas() {
  const [cerradas, setCerradas] = useState(() => new Set());
  const toggle = (cat) => setCerradas(p => {
    const next = new Set(p);
    next.has(cat) ? next.delete(cat) : next.add(cat);
    return next;
  });
  // Si hay búsqueda activa, expandir todo automáticamente devolviendo set vacío
  return [cerradas, toggle];
}

function calcularIndicadoresMaterial(m) {
  const coste = m.precio_coste != null ? Number(m.precio_coste) : null;
  const precio = m.precio != null ? Number(m.precio) : null;
  const margen = (coste != null && precio != null && precio !== 0)
    ? Math.round(((precio - coste) / precio) * 10000) / 100
    : null;
  const periodo = (coste != null && precio != null && precio > coste)
    ? Math.round((coste / (precio - coste)) * 10) / 10
    : null;
  const costeAmort = (coste != null && precio != null && precio > coste)
    ? Math.round((precio - coste) * 100) / 100
    : null;
  return { margen, periodo, costeAmort };
}

// MARK: - TabAlmacen
export default function TabAlmacen({ materiales, setMateriales, empresa, modo, almacenes, silenciados, guardarPlantillaConf, cargarPlantillasConf, onInventario, onAgregarCesta, gestion = { nivel: "operativo", categorias: {} }, L }) {
  const EMP_ID = `lscale.cols.${empresa?.id}`;
  const defCols = TODAS_COLS.filter((c) => c.def).map((c) => c.id);
  const [colsVis, setColsVis]       = useState(() => { try { return JSON.parse(localStorage.getItem(EMP_ID)) || defCols; } catch { return defCols; } });
  const [showColCfg, setShowColCfg] = useState(false);
  const [busqueda, setBusqueda]     = useState("");
  const [editObj, setEditObj]       = useState(null);
  const [saving, setSaving]         = useState(false);
  const [delConf, setDelConf]       = useState(null);
  const [vaciarConf, setVaciarConf] = useState(false);
  const [vaciando,   setVaciando]   = useState(false);
  const [vaciarProgreso, setVaciarProgreso] = useState(0);
  const [almacenSel, setAlmacenSel] = useState(() => almacenes?.[0]?.id ?? 1);
  const [showUbicaciones, setShowUbicaciones] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [showOrigen, setShowOrigen] = useState(false); // modal de origen externo (SharePoint / Business Central)
  const [lightbox, setLightbox]     = useState(null); // URL a mostrar en grande
  const [addedId, setAddedId]       = useState(null); // id recién añadido a la cesta (feedback)
  const imgInputRef = useRef(null);

  // Añade un material a la cesta (1 ud, o el déficit si está bajo mínimo).
  const agregarMaterialCesta = (m) => {
    const deficit = Math.max(0, (Number(m.stock_minimo) || 0) - (Number(m.stock_actual) || 0));
    const cantidad = deficit > 0 ? deficit : 1;
    onAgregarCesta?.([{ material_id: m.id, nombre: m.nombre, cantidad, almacen_id: m.almacen_id ?? null }]);
    setAddedId(m.id);
    setTimeout(() => setAddedId(prev => prev === m.id ? null : prev), 1400);
  };
  const [catsCerradas, toggleCat]   = useCatsAbiertas();
  const [showFiltros, setShowFiltros] = useState(false);
  const [filtros, setFiltros]         = useState({ categoria:"", proveedor:"", estado:"" });
  const nFiltrosActivos = Object.values(filtros).filter(Boolean).length;

  // Columnas fijas al principio, luego las visibles en el orden guardado
  const colsFijas = TODAS_COLS.filter((c) => c.fija);
  const idsFijos = new Set(colsFijas.map((c) => c.id));
  const colsActivas = [
    ...colsFijas,
    ...colsVis.map((id) => TODAS_COLS.find((c) => c.id === id && !idsFijos.has(c.id))).filter(Boolean),
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

  const primerAlmacenId = almacenes?.[0]?.id ?? null;

  // Categorías y proveedores existentes (para autocompletar en el formulario).
  const categoriasExistentes = [...new Set(
    (materiales || []).map(m => (m.categoria || "").trim()).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));
  const proveedoresExistentes = [...new Set(
    (materiales || []).map(m => (m.proveedor || "").trim()).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  const filtrados = materiales.filter((m) => {
    if (m.almacen_id != null && m.almacen_id !== almacenSel) return false;
    if (m.almacen_id == null && almacenSel !== primerAlmacenId) return false;
    if (filtros.categoria && (m.categoria||"").trim() !== filtros.categoria) return false;
    if (filtros.proveedor && (m.proveedor||"").trim() !== filtros.proveedor) return false;
    if (filtros.estado   && (m.estado   ||"activo")   !== filtros.estado)    return false;
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return (m.nombre||"").toLowerCase().includes(q)
        || (m.referencia||"").toLowerCase().includes(q)
        || (m.categoria||"").toLowerCase().includes(q)
        || (m.ubicacion||"").toLowerCase().includes(q)
        || (m.proveedor||"").toLowerCase().includes(q)
        || (m.referencia_proveedor||"").toLowerCase().includes(q);
  });

  const blankMaterial = { referencia:"", nombre:"", descripcion:"", categoria:"", unidad:"ud", stock_actual:0, stock_minimo:0, ubicacion:"", estado:"activo", proveedor:"", referencia_proveedor:"", precio_coste:"", precio:"", notas:"", almacen_id: almacenSel, imagen_url: null, _imgFile: null, coste_adquisicion:"", margen:"", pvp:"", periodo_amortizacion_dias:"", tipo_activo:"propio", sku_interno:"", tipo_trazabilidad:"Consumible_PMP" };

  const guardarEdit = async () => {
    if (!editObj.nombre?.trim()) return;
    setSaving(true);
    try {
      let obj = { ...editObj };
      const urlAnterior = obj._originalImagenUrl;
      delete obj._originalImagenUrl;

      // Si hay imagen nueva, subirla
      if (obj._imgFile && modo !== "demo") {
        obj.imagen_url = await subirImagenMaterial(obj._imgFile, empresa.id);
      }
      delete obj._imgFile;

      // Borrar imagen anterior del bucket si cambió o fue eliminada
      if (urlAnterior && urlAnterior !== obj.imagen_url && modo !== "demo") {
        borrarImagenMaterial(urlAnterior).catch(() => {});
      }
      const esNuevo = !obj.id;
      if (modo === "demo") {
        if (esNuevo) {
          const nuevo = { ...obj, id: Date.now(), emp: empresa.id, stock_actual: Number(obj.stock_actual)||0, stock_minimo: Number(obj.stock_minimo)||0, precio_coste: obj.precio_coste !== "" ? Number(obj.precio_coste) : null, precio: obj.precio !== "" ? Number(obj.precio) : null, coste_adquisicion: obj.coste_adquisicion !== "" ? Number(obj.coste_adquisicion) : null, margen: obj.margen !== "" ? Number(obj.margen) : null, pvp: obj.pvp !== "" ? Number(obj.pvp) : null, periodo_amortizacion_dias: obj.periodo_amortizacion_dias !== "" ? Number(obj.periodo_amortizacion_dias) : null, tipo_activo: obj.tipo_activo ?? 'propio' };
          setMateriales((p) => [nuevo, ...p]);
        } else {
          setMateriales((p) => p.map((m) => m.id === obj.id ? { ...m, ...obj, stock_actual: Number(obj.stock_actual)||0, stock_minimo: Number(obj.stock_minimo)||0, precio: obj.precio !== "" ? Number(obj.precio) : null } : m));
        }
      } else {
        const fn = esNuevo ? crearMaterial : actualizarMaterial;
        const result = esNuevo ? await fn(obj, empresa.id) : await fn(obj.id, obj);
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

  // Materiales del almacén activo (mismo criterio que la tabla, sin filtros/búsqueda).
  const almacenNombreSel = almacenes?.find(a => a.id === almacenSel)?.nombre || L("almacén","warehouse");
  const materialesAlmacen = materiales.filter(m =>
    (m.almacen_id != null && m.almacen_id === almacenSel) ||
    (m.almacen_id == null && almacenSel === primerAlmacenId)
  );

  // Copia de seguridad (Excel) de TODO el almacén actual.
  const exportarCopiaAlmacen = () => {
    const cols = ["referencia","nombre","descripcion","categoria","unidad","stock_actual","stock_minimo","ubicacion","estado","proveedor","referencia_proveedor","precio_coste","precio","margen","pvp","coste_adquisicion","periodo_amortizacion_dias","tipo_activo","notas"];
    const rows = materialesAlmacen.map(m => Object.fromEntries(cols.map(k => [k, m[k] ?? ""])));
    const ws = XLSX.utils.json_to_sheet(rows, { header: cols });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (almacenNombreSel || "Almacen").slice(0, 31));
    const hoy = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `copia-${(almacenNombreSel || "almacen").replace(/\s+/g, "-")}-${hoy}.xlsx`);
  };

  // Vacía el almacén actual (borra todos sus materiales), con copia previa opcional.
  const vaciarAlmacen = async (conCopia) => {
    if (vaciando) return;
    if (conCopia) exportarCopiaAlmacen();
    setVaciando(true);
    setVaciarProgreso(0);
    const ids = materialesAlmacen.map(m => m.id);
    const LOTE = 50;
    try {
      if (modo !== "demo") {
        for (let i = 0; i < ids.length; i += LOTE) {
          await borrarMaterialesLote(ids.slice(i, i + LOTE));
          setVaciarProgreso(Math.min(100, Math.round(((i + LOTE) / ids.length) * 100)));
        }
      } else {
        setVaciarProgreso(100);
      }
      setMateriales(prev => prev.filter(m => !ids.includes(m.id)));
      setVaciarConf(false);
    } catch (e) {
      console.error("[vaciarAlmacen]", e);
      alert(L("Error al vaciar el almacén: ", "Error emptying warehouse: ") + (e?.message || e));
    }
    setVaciando(false);
    setVaciarProgreso(0);
  };

  // ── Unificar duplicados del almacén actual ──────────────────────────────────
  // Agrupa por nombre normalizado; suma stock al primero (conserva sus datos) y
  // elimina los demás. Solo afecta al almacén seleccionado.
  const [unificando, setUnificando] = useState(false);

  const gruposDuplicados = () => {
    const delAlmacen = materiales.filter(m =>
      (m.almacen_id ?? primerAlmacenId) === almacenSel
    );
    const porNombre = new Map();
    for (const m of delAlmacen) {
      const k = (m.nombre || "").trim().toLowerCase();
      if (!k) continue;
      if (!porNombre.has(k)) porNombre.set(k, []);
      porNombre.get(k).push(m);
    }
    return [...porNombre.values()].filter(g => g.length > 1);
  };

  const nDuplicados = () => gruposDuplicados().reduce((s, g) => s + (g.length - 1), 0);

  const unificarDuplicados = async () => {
    const grupos = gruposDuplicados();
    if (!grupos.length) return;
    const total = grupos.reduce((s, g) => s + (g.length - 1), 0);
    if (!window.confirm(`Se unificarán ${total} material(es) duplicado(s) en ${grupos.length} grupo(s). Los stocks se suman. ¿Continuar?`)) return;

    setUnificando(true);
    try {
      const idsBorrar = [];
      const actualizados = [];
      for (const grupo of grupos) {
        // Conservar el de mayor stock como "principal" (más probable el real)
        const orden = [...grupo].sort((a, b) => (Number(b.stock_actual)||0) - (Number(a.stock_actual)||0));
        const principal = orden[0];
        const sumaStock = grupo.reduce((s, m) => s + (Number(m.stock_actual) || 0), 0);
        actualizados.push({ id: principal.id, stock_actual: sumaStock });
        for (const m of grupo) if (m.id !== principal.id) idsBorrar.push(m.id);
      }

      if (modo !== "demo") {
        for (const a of actualizados) await actualizarMaterial(a.id, { stock_actual: a.stock_actual });
        for (const id of idsBorrar) await borrarMaterial(id);
      }

      setMateriales(prev => prev
        .map(m => {
          const u = actualizados.find(a => a.id === m.id);
          return u ? { ...m, stock_actual: u.stock_actual } : m;
        })
        .filter(m => !idsBorrar.includes(m.id))
      );
    } catch (e) {
      console.error("[unificarDuplicados]", e);
      alert("Error al unificar: " + (e?.message || e));
    } finally {
      setUnificando(false);
    }
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
        const { saved, inserted, updated } = await upsertMaterialesLote(nuevos, empresa.id);
        const updatedById = Object.fromEntries(saved.filter(m => m.id).map(m => [m.id, m]));
        setMateriales(prev => {
          const merged = prev.map(m => updatedById[m.id] || m);
          const existingIds = new Set(merged.map(m => m.id));
          const newOnes = saved.filter(m => !existingIds.has(m.id));
          return [...merged, ...newOnes];
        });
        alert(`Importación completada: ${inserted} nuevos, ${updated} actualizados.`);
      } catch (e) {
        console.error(e);
        alert(`Error importando materiales: ${e?.message || e}`);
      }
    }
  };

  const handleExportAlmExcel = () => {
    const cols = ["referencia","nombre","descripcion","categoria","unidad","stock_actual","stock_minimo","ubicacion","estado","proveedor","referencia_proveedor","precio_coste","notas"];
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
      case "imagen":
        return m.imagen_url
          ? <img src={m.imagen_url} alt={m.nombre}
              onClick={(e) => { e.stopPropagation(); setLightbox(m.imagen_url); }}
              style={{ width:40, height:40, objectFit:"cover", borderRadius:6,
                cursor:"zoom-in", border:`1px solid ${C.line}`, display:"block" }}/>
          : <div style={{ width:40, height:40, borderRadius:6, border:`1px dashed ${C.strong}`,
              display:"flex", alignItems:"center", justifyContent:"center", color:C.dim }}>
              <ImageIcon size={16}/>
            </div>;
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
      case "precio_coste": return m.precio_coste != null ? <span>{Number(m.precio_coste).toFixed(2)}€</span> : <span style={{ color:C.dim }}>—</span>;
      case "precio": return m.precio != null ? <span>{Number(m.precio).toFixed(2)}€</span> : <span style={{ color:C.dim }}>—</span>;
      case "margen": {
        const { margen } = calcularIndicadoresMaterial(m);
        return margen != null ? <span>{margen.toFixed(2)}%</span> : <span style={{ color:C.dim }}>—</span>;
      }
      case "periodo_amortizacion": {
        const { periodo } = calcularIndicadoresMaterial(m);
        return periodo != null ? <span>{periodo.toFixed(1)}</span> : <span style={{ color:C.dim }}>—</span>;
      }
      case "coste_amortizacion": {
        const { costeAmort } = calcularIndicadoresMaterial(m);
        return costeAmort != null ? <span>{costeAmort.toFixed(2)}€</span> : <span style={{ color:C.dim }}>—</span>;
      }
      case "valor_stock": {
        const v = (Number(m.stock_actual) || 0) * (m.precio_coste != null ? Number(m.precio_coste) : 0);
        return m.precio_coste != null ? <span style={{ fontWeight:600 }}>{v.toFixed(2)}€</span> : <span style={{ color:C.dim }}>—</span>;
      }
      case "coste_adquisicion": return m.coste_adquisicion != null ? <span>{Number(m.coste_adquisicion).toFixed(2)}€</span> : <span style={{ color:C.dim }}>—</span>;
      case "periodo_amort_dias": return m.periodo_amortizacion_dias != null ? <span>{m.periodo_amortizacion_dias} d</span> : <span style={{ color:C.dim }}>—</span>;
      case "amort_diaria": {
        const a = m.coste_amortizacion_diario != null
          ? Number(m.coste_amortizacion_diario)
          : (m.coste_adquisicion != null && Number(m.periodo_amortizacion_dias) > 0
              ? Number(m.coste_adquisicion) / Number(m.periodo_amortizacion_dias) : null);
        return a != null ? <span>{a.toFixed(4)}€</span> : <span style={{ color:C.dim }}>—</span>;
      }
      case "tipo_activo": {
        const t = m.tipo_activo || "propio";
        const sub = t === "subalquilado";
        return <Badge color={sub ? "var(--warn-soft)" : "var(--brand-soft)"} ink={sub ? "var(--warn)" : "var(--brand)"}>{sub ? "Subalq." : "Propio"}</Badge>;
      }
      case "tipo_trazabilidad": {
        const t = m.tipo_trazabilidad || "Consumible_PMP";
        const map = { Consumible_PMP:["PMP","var(--brand-soft)","var(--brand)"], Lotes_FIFO:["FIFO","#fef9c3","#ca8a04"], Serializado:["Serie","#e0e7ff","#4f46e5"] };
        const [lbl, bg, ink] = map[t] || map.Consumible_PMP;
        return <Badge color={bg} ink={ink}>{lbl}</Badge>;
      }
      default: return <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m[colId] || <span style={{ color:C.dim }}>—</span>}</span>;
    }
  };

  const gtc = `1.4fr ${colsActivas.filter((c) => c.id !== "nombre").map((c) => c.w || "1fr").join(" ")} auto 44px`;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0 }}>

      {almacenes && almacenes.length > 0 && (
        <div style={{ display:"flex", alignItems:"center", gap:2, padding:"8px 20px", borderBottom:`1px solid ${C.line}`, flexShrink:0, background:C.surface }}>
          {almacenes.map(a => (
            <button key={a.id} onClick={() => setAlmacenSel(a.id)}
              style={{ padding:"5px 16px", borderRadius:8, border:"none", fontFamily:"inherit",
                fontWeight: almacenSel === a.id ? 600 : 400, fontSize:13, cursor:"pointer",
                background: almacenSel === a.id ? C.brandSoft : "transparent",
                color: almacenSel === a.id ? C.brand : C.sub, transition:"background .12s" }}>
              {a.nombre}
            </button>
          ))}
          {onInventario && (
            <>
              <div style={{ width:1, height:22, background:C.line, margin:"0 10px 0 auto" }}/>
              <button onClick={onInventario} title={L("Inventario","Inventory")}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:8,
                  border:`1.5px solid ${C.brand}`, background:C.brandSoft, color:C.brand,
                  fontFamily:"inherit", fontWeight:600, fontSize:13, cursor:"pointer" }}>
                <ClipboardCheck size={15}/>{L("Inventario","Inventory")}
              </button>
            </>
          )}
        </div>
      )}

      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 20px", borderBottom:`1px solid ${C.line}`, flexShrink:0, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, flex:"1 1 200px", background:C.s2, border:`1px solid ${C.line}`, borderRadius:999, padding:"7px 13px" }}>
          <Search size={15} color={C.sub}/>
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder={L("Buscar material…","Search material…")} style={{ border:"none", outline:"none", background:"transparent", fontSize:13.5, color:C.ink, width:"100%", fontFamily:"inherit" }}/>
          {busqueda && <button onClick={() => setBusqueda("")} style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, padding:0, display:"flex" }}><X size={13}/></button>}
        </div>
        {/* Botón Filtros */}
        <div style={{ position:"relative" }}>
          <Btn outline onClick={() => setShowFiltros(v => !v)}
            style={{ padding:"8px 12px", borderColor: nFiltrosActivos ? C.brand : undefined, color: nFiltrosActivos ? C.brand : undefined }}>
            <SlidersHorizontal size={15}/>
            {L("Filtros","Filters")}
            {nFiltrosActivos > 0 && (
              <span style={{ background:C.brand, color:"#fff", borderRadius:999,
                fontSize:10, fontWeight:700, padding:"1px 6px", marginLeft:2 }}>
                {nFiltrosActivos}
              </span>
            )}
          </Btn>
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
        {nDuplicados() > 0 && (
          <Btn outline onClick={unificarDuplicados} disabled={unificando}
            style={{ padding:"8px 12px", borderColor:"var(--warn)", color:"var(--warn)" }}>
            {unificando ? <Loader size={15} className="spin"/> : <Combine size={15}/>}
            {L("Unificar","Merge")} ({nDuplicados()})
          </Btn>
        )}
        <Btn outline onClick={() => importRef.current?.click()} style={{ padding:"8px 12px" }}>
          <Upload size={15}/>{L("Importar Excel","Import Excel")}
        </Btn>
        <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:"none" }} onChange={handleImportAlm}/>
        {empresa?.id && modo === "supabase" && (
          <Btn outline onClick={() => setShowOrigen(true)} style={{ padding:"8px 12px" }}
            title={L("Conectar SharePoint o Business Central","Connect SharePoint or Business Central")}>
            <Cloud size={15}/>{L("Origen externo","External source")}
          </Btn>
        )}
        <div style={{ position:"relative", display:"flex", gap:4 }}>
          <Btn outline onClick={handleExportAlmExcel} style={{ padding:"8px 12px" }}><Download size={15}/>Excel</Btn>
          <Btn outline onClick={handleExportAlmPdf} style={{ padding:"8px 12px" }}><FileDown size={15}/>PDF</Btn>
        </div>
        <Btn outline onClick={() => setVaciarConf(true)} disabled={materialesAlmacen.length === 0}
          title={L("Vaciar el almacén (con copia de seguridad opcional)","Empty the warehouse (optional backup)")}
          style={{ padding:"8px 12px", borderColor:C.danger, color:C.danger }}>
          <Trash2 size={15}/>{L("Vaciar","Empty")}
        </Btn>
        <Btn onClick={() => setEditObj({ ...blankMaterial, _originalImagenUrl: null })}><Plus size={15}/>{L("Nuevo","New")}</Btn>
      </div>

      {/* Barra de filtros por columna */}
      {showFiltros && (
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 20px",
          borderBottom:`1px solid ${C.line}`, background:C.s2, flexShrink:0, flexWrap:"wrap" }}>
          {[
            { key:"categoria", label:L("Categoría","Category"),   opciones: categoriasExistentes },
            { key:"proveedor", label:L("Proveedor","Supplier"),   opciones: proveedoresExistentes },
            { key:"estado",    label:L("Estado","Status"),        opciones: ESTADOS_MATERIAL },
          ].map(({ key, label, opciones }) => (
            <div key={key} style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontSize:11, fontWeight:600, color:C.sub, letterSpacing:.3 }}>{label}:</span>
              <select value={filtros[key]} onChange={e => setFiltros(p => ({ ...p, [key]: e.target.value }))}
                style={{ padding:"5px 28px 5px 9px", border:`1px solid ${filtros[key] ? C.brand : C.strong}`,
                  borderRadius:8, fontSize:12.5, fontFamily:"inherit", outline:"none", cursor:"pointer",
                  background: filtros[key] ? C.brandSoft : C.surface, color: filtros[key] ? C.brand : C.ink,
                  fontWeight: filtros[key] ? 600 : 400 }}>
                <option value="">— {L("Todas","All")} —</option>
                {opciones.map(o => <option key={o} value={o}>{key === "estado" ? ESTADO_LABEL[o] || o : o}</option>)}
              </select>
            </div>
          ))}
          {nFiltrosActivos > 0 && (
            <button onClick={() => setFiltros({ categoria:"", proveedor:"", estado:"" })}
              style={{ background:"none", border:"none", cursor:"pointer", color:C.danger,
                fontSize:12, fontFamily:"inherit", display:"flex", alignItems:"center", gap:4, padding:"4px 6px" }}>
              <X size={12}/>{L("Limpiar","Clear")}
            </button>
          )}
          <span style={{ marginLeft:"auto", fontSize:11, color:C.dim }}>
            {filtrados.length} {L("material(es)","material(s)")}
          </span>
        </div>
      )}

      <div style={{ flex:1, overflow:"auto" }}>
        <div style={{ display:"grid", gridTemplateColumns:gtc, gap:0, position:"sticky", top:0, zIndex:10, background:C.surface, borderBottom:`1px solid ${C.line}`, padding:"0 20px" }}>
          {colsActivas.map((c) => (
            <div key={c.id} style={{ padding:"10px 8px", fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.6, display:"flex", alignItems:"center", overflow:"visible" }}>{c.label}{c.help ? <Help text={c.help} pos="below"/> : null}</div>
          ))}
          <div/><div/>
        </div>

        {filtrados.length === 0 && (
          <div style={{ padding:40, textAlign:"center", color:C.sub, fontSize:14 }}>
            {busqueda ? L("Sin resultados","No results") : L("Sin materiales. Pulsa «Nuevo» para añadir.","No materials yet. Press «New» to add one.")}
          </div>
        )}
        {(() => {
          // Agrupar por categoría manteniendo el orden de aparición
          const grupos = [];
          const idxCat = {};
          for (const m of filtrados) {
            const cat = m.categoria?.trim() || L("(sin categoría)","(no category)");
            if (idxCat[cat] === undefined) { idxCat[cat] = grupos.length; grupos.push({ cat, items: [] }); }
            grupos[idxCat[cat]].items.push(m);
          }
          // Cuando hay búsqueda activa, ignorar cerradas y mostrar todo
          const cerradasEfectivas = busqueda ? new Set() : catsCerradas;

          return grupos.map(({ cat, items }) => {
            const abierta = !cerradasEfectivas.has(cat);
            const nAlertas = items.filter(m => m.stock_minimo > 0 && m.stock_actual < m.stock_minimo && !silenciados?.has(String(m.id))).length;
            return (
              <div key={cat}>
                {/* Cabecera de categoría */}
                <div onClick={() => !busqueda && toggleCat(cat)}
                  style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 20px",
                    background:C.s2, borderBottom:`1px solid ${C.line}`,
                    cursor: busqueda ? "default" : "pointer", userSelect:"none",
                    position:"sticky", top:37, zIndex:5 }}>
                  <span style={{ fontSize:11, color:C.sub, transition:"transform .15s",
                    display:"inline-block", transform: abierta ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                  <span style={{ fontSize:12, fontWeight:700, color:C.ink, letterSpacing:.4, textTransform:"uppercase" }}>{cat}</span>
                  <span style={{ fontSize:11, color:C.dim, marginLeft:2 }}>({items.length})</span>
                  {nAlertas > 0 && (
                    <span style={{ fontSize:10, fontWeight:700, background:"#fee2e2", color:"#dc2626",
                      borderRadius:6, padding:"1px 6px", border:"1px solid #fca5a5", marginLeft:4 }}>
                      ⚠ {nAlertas}
                    </span>
                  )}
                </div>

                {/* Filas */}
                {abierta && items.map((m) => {
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
                        {onAgregarCesta && (
                          <button title={L("Agregar a la cesta","Add to cart")} onClick={() => agregarMaterialCesta(m)}
                            style={{ background: addedId === m.id ? C.brand : "none", border:"none", cursor:"pointer",
                              color: addedId === m.id ? "#fff" : C.brand, borderRadius:8, padding:5, display:"flex",
                              transition:"background .15s" }}>
                            {addedId === m.id ? <Check size={15}/> : <ShoppingCart size={15}/>}
                          </button>
                        )}
                        <button title={L("Editar","Edit")} onClick={() => setEditObj({ ...m, _imgFile: null, _originalImagenUrl: m.imagen_url ?? null })}
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
            );
          });
        })()}
      </div>

      {editObj && (() => {
        // Capacidades financieras según el nivel efectivo de la categoría del material.
        const capsMat = caps(nivelMaterial(gestion, editObj));
        return (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", display:"grid", placeItems:"center", zIndex:500, padding:16 }} onClick={() => setEditObj(null)}>
          <div style={{ background:C.surface, borderRadius:16, boxShadow:"var(--shadow-lg)", padding:24, width:"100%", maxWidth:580, maxHeight:"90vh", overflowY:"auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
              <h3 style={{ fontSize:17 }}>{editObj.id ? L("Editar material","Edit material") : L("Nuevo material","New material")}</h3>
              <button onClick={() => setEditObj(null)} style={{ background:"none", border:"none", cursor:"pointer", color:C.sub }}><X size={18}/></button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <ModalField label={L("Nombre *","Name *")} value={editObj.nombre} onChange={(v) => setEditObj((p) => ({ ...p, nombre:v }))} style={{ gridColumn:"1 / -1" }}/>
              <ModalField label="Referencia / SKU"   value={editObj.referencia}   onChange={(v) => setEditObj((p) => ({ ...p, referencia:v }))}/>
              <ComboField label={L("Categoría","Category")} value={editObj.categoria} opciones={categoriasExistentes}
                onChange={(v) => setEditObj((p) => ({ ...p, categoria:v }))} placeholder={L("Elegir o escribir…","Pick or type…")}/>
              <ModalField label={L("Unidad","Unit")}             value={editObj.unidad}      onChange={(v) => setEditObj((p) => ({ ...p, unidad:v }))} placeholder="ud, kg, L, m…"/>
              <ModalField label={L("Ubicación","Location")}      value={editObj.ubicacion}   onChange={(v) => setEditObj((p) => ({ ...p, ubicacion:v }))} placeholder="A-01, Pasillo 3…"/>
              <ModalField label="Stock actual" value={editObj.stock_actual} onChange={(v) => setEditObj((p) => ({ ...p, stock_actual:v }))} type="number"/>
              <ModalField label={L("Stock mínimo","Min stock")}  value={editObj.stock_minimo} onChange={(v) => setEditObj((p) => ({ ...p, stock_minimo:v }))} type="number"/>
              <ComboField label={L("Proveedor","Supplier")} value={editObj.proveedor} opciones={proveedoresExistentes}
                onChange={(v) => setEditObj((p) => ({ ...p, proveedor:v }))} placeholder={L("Elegir o escribir…","Pick or type…")}/>
              <ModalField label={L("Ref. Proveedor","Supplier Ref.")} value={editObj.referencia_proveedor}
                onChange={(v) => setEditObj((p) => ({ ...p, referencia_proveedor:v }))} placeholder="SKU, código proveedor…"/>
              {/* SKU interno inmutable (ERP). Si el material ya existe no se puede editar. */}
              <ModalField label={L("SKU Interno","Internal SKU")}
                help={L("Código único e inmutable del material. Se autogenera si lo dejas vacío al crear; no se puede cambiar después.","Unique immutable item code. Auto-generated if left empty on creation; cannot be changed afterwards.")}
                value={editObj.sku_interno || ""}
                onChange={editObj.id ? undefined : (v) => setEditObj((p) => ({ ...p, sku_interno:v }))}
                readOnly={Boolean(editObj.id && editObj.sku_interno)}
                style={editObj.id && editObj.sku_interno ? { opacity:0.75 } : undefined}
                placeholder={editObj.id ? "" : L("(automático si vacío)","(auto if empty)")}/>
              {/* Tipo de trazabilidad: define cómo valora salidas la app (FIFO/PMP/Serie).
                  Solo en gestión avanzada — el resto trabaja con stock simple. */}
              {capsMat.avanzado && (
              <div style={{ gridColumn:"1 / -1" }}>
                <label style={{ fontSize:11.5, fontWeight:600, color:"var(--text-2)", letterSpacing:.5 }}>
                  {L("CONTROL DE STOCK","STOCK CONTROL")}
                </label>
                <div style={{ display:"flex", gap:8, marginTop:6, flexWrap:"wrap" }}>
                  {[["Consumible_PMP", L("Consumible (precio medio)","Consumable (avg cost)")],
                    ["Lotes_FIFO",     L("Por lotes (FIFO)","By batches (FIFO)")],
                    ["Serializado",    L("Serializado (nº serie)","Serialized (serial nº)")]].map(([val, lbl]) => (
                    <button key={val} type="button"
                      onClick={() => setEditObj((p) => ({ ...p, tipo_trazabilidad: val }))}
                      style={{ padding:"5px 14px", borderRadius:999, fontFamily:"inherit", cursor:"pointer",
                        border: `1.5px solid ${(editObj.tipo_trazabilidad||"Consumible_PMP") === val ? "var(--brand)" : "var(--border-strong)"}`,
                        background: (editObj.tipo_trazabilidad||"Consumible_PMP") === val ? "var(--brand-soft)" : "transparent",
                        color: (editObj.tipo_trazabilidad||"Consumible_PMP") === val ? "var(--brand)" : "var(--text-2)",
                        fontWeight:600, fontSize:12.5 }}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              )}
              {/* Coste y PVP: visibles desde contabilidad básica. */}
              {capsMat.finanzas && (
                <ModalField label={L("Coste (€)","Cost (€)")}      value={editObj.precio_coste} onChange={(v) => setEditObj((p) => ({ ...p, precio_coste:v }))} type="number" placeholder="0.00"/>
              )}
              {capsMat.finanzas && (
                <ModalField label={L("PVP (€)","Sale price (€)")} value={editObj.precio} onChange={(v) => setEditObj((p) => ({ ...p, precio:v }))} type="number" placeholder="0.00"/>
              )}
              {capsMat.avanzado && (() => {
                const { margen, periodo, costeAmort } = calcularIndicadoresMaterial(editObj);
                return (
                  <>
                    <ModalField label={L("Margen (%)","Margin (%)")} value={margen != null ? margen.toFixed(2) : ""} readOnly={true} style={{ opacity:0.75 }}/>
                    <ModalField label={L("Periodo amortización","Amortization period")} value={periodo != null ? periodo.toFixed(1) : ""} readOnly={true} style={{ opacity:0.75 }}/>
                    <ModalField label={L("Coste amortización","Amortization cost")} value={costeAmort != null ? `${costeAmort.toFixed(2)} €` : ""} readOnly={true} style={{ opacity:0.75 }}/>
                  </>
                );
              })()}
              {/* Campos de inventario dinámico por fechas — solo gestión avanzada */}
              {capsMat.avanzado && (<>
              <div style={{ gridColumn:"1 / -1", borderTop:`1px solid var(--border)`, paddingTop:12, marginTop:4 }}>
                <label style={{ fontSize:11.5, fontWeight:700, color:"var(--text-2)", letterSpacing:.5 }}>{L("INVENTARIO DINÁMICO / AMORTIZACIÓN","DYNAMIC INVENTORY / AMORTIZATION")}</label>
              </div>
              <ModalField label={L("Coste Adquisición (€)","Acquisition Cost (€)")} help={L("Coste de compra del activo. Se divide entre los días de amortización para obtener el coste por día de alquiler.","Asset purchase cost. Divided by amortization days to get the daily rental cost.")} value={editObj.coste_adquisicion}
                onChange={(v) => {
                  const ca = v !== "" ? Number(v) : "";
                  const pvpV = editObj.pvp !== "" && editObj.pvp != null ? Number(editObj.pvp) : null;
                  const margenCalc = (ca !== "" && pvpV != null && pvpV > 0)
                    ? Math.round(((pvpV - ca) / ca) * 10000) / 100
                    : editObj.margen;
                  setEditObj((p) => ({ ...p, coste_adquisicion: v, margen: margenCalc != null && margenCalc !== editObj.margen ? String(margenCalc) : p.margen }));
                }}
                type="number" placeholder="0.00"/>
              <ModalField label={L("Margen % (activo)","Margin % (asset)")} value={editObj.margen}
                onChange={(v) => {
                  const m = v !== "" ? Number(v) : "";
                  const ca = editObj.coste_adquisicion !== "" && editObj.coste_adquisicion != null ? Number(editObj.coste_adquisicion) : null;
                  const pvpCalc = (m !== "" && ca != null) ? Math.round(ca * (1 + m / 100) * 100) / 100 : null;
                  setEditObj((p) => ({ ...p, margen: v, pvp: pvpCalc != null ? String(pvpCalc) : p.pvp }));
                }}
                type="number" placeholder="0.00"/>
              <ModalField label={L("PVP Activo (€)","Asset Sale Price (€)")} help={L("Precio de venta del activo si se vendiera (no es el alquiler). Sirve para calcular el margen del activo.","Sale price if the asset were sold (not the rental). Used to compute asset margin.")} value={editObj.pvp}
                onChange={(v) => {
                  const pv = v !== "" ? Number(v) : "";
                  const ca = editObj.coste_adquisicion !== "" && editObj.coste_adquisicion != null ? Number(editObj.coste_adquisicion) : null;
                  const margenCalc = (pv !== "" && ca != null && ca > 0) ? Math.round(((pv - ca) / ca) * 10000) / 100 : null;
                  setEditObj((p) => ({ ...p, pvp: v, margen: margenCalc != null ? String(margenCalc) : p.margen }));
                }}
                type="number" placeholder="0.00"/>
              <ModalField label={L("Amortización (días)","Amortization (days)")} help={L("Días en los que se amortiza el activo. Lo define el financiero. Ej: 1825 = 5 años.","Days over which the asset is amortized. Set by finance. E.g. 1825 = 5 years.")} value={editObj.periodo_amortizacion_dias}
                onChange={(v) => setEditObj((p) => ({ ...p, periodo_amortizacion_dias:v }))}
                type="number" placeholder="ej. 1825 = 5 años"/>
              {(() => {
                const ca = editObj.coste_adquisicion !== "" && editObj.coste_adquisicion != null ? Number(editObj.coste_adquisicion) : null;
                const per = editObj.periodo_amortizacion_dias !== "" && editObj.periodo_amortizacion_dias != null ? Number(editObj.periodo_amortizacion_dias) : null;
                const amortDiario = (ca != null && per != null && per > 0) ? ca / per : null;
                return (
                  <ModalField label={L("Amortización diaria (€)","Daily amortization (€)")} help={L("Coste imputado por día de alquiler en eventos. Calculado: coste adquisición ÷ días.","Cost charged per rental day in events. Computed: acquisition cost ÷ days.")}
                    value={amortDiario != null ? amortDiario.toFixed(4) : ""}
                    readOnly={true} style={{ opacity:0.75 }}/>
                );
              })()}
              <div style={{ gridColumn:"1 / -1" }}>
                <label style={{ fontSize:11.5, fontWeight:600, color:"var(--text-2)", letterSpacing:.5 }}>{L("TIPO ACTIVO","ASSET TYPE")}</label>
                <div style={{ display:"flex", gap:8, marginTop:6 }}>
                  {[["propio", L("Propio","Own")], ["subalquilado", L("Subalquilado","Subleased")]].map(([val, lbl]) => (
                    <button key={val} onClick={() => setEditObj((p) => ({ ...p, tipo_activo: val }))}
                      style={{ padding:"5px 14px", borderRadius:999, fontFamily:"inherit", cursor:"pointer",
                        border: `1.5px solid ${editObj.tipo_activo === val ? "var(--brand)" : "var(--border-strong)"}`,
                        background: editObj.tipo_activo === val ? "var(--brand-soft)" : "transparent",
                        color: editObj.tipo_activo === val ? "var(--brand)" : "var(--text-2)",
                        fontWeight:600, fontSize:12.5 }}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              </>)}
              {/* Imagen */}
              <div style={{ gridColumn:"1 / -1" }}>
                <label style={{ fontSize:11.5, fontWeight:600, color:C.sub, letterSpacing:.5 }}>IMAGEN</label>
                <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:6 }}>
                  {/* Preview / zona de subida */}
                  <div
                    onClick={() => imgInputRef.current?.click()}
                    style={{ width:80, height:80, borderRadius:10, flexShrink:0,
                      border: editObj.imagen_url || editObj._imgFile ? `1px solid ${C.line}` : `2px dashed ${C.strong}`,
                      overflow:"hidden", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                      background:C.s2, position:"relative" }}>
                    {editObj._imgFile
                      ? <img src={URL.createObjectURL(editObj._imgFile)} alt=""
                          style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                      : editObj.imagen_url
                        ? <img src={editObj.imagen_url} alt=""
                            style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                        : <ImageIcon size={24} color={C.dim}/>}
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    <Btn outline onClick={() => imgInputRef.current?.click()} style={{ fontSize:12, padding:"5px 12px" }}>
                      <Upload size={13}/>{editObj.imagen_url || editObj._imgFile ? L("Cambiar","Change") : L("Subir foto","Upload photo")}
                    </Btn>
                    {(editObj.imagen_url || editObj._imgFile) && (
                      <button
                        onClick={() => setEditObj(p => ({ ...p, imagen_url: null, _imgFile: null }))}
                        style={{ background:"none", border:"none", cursor:"pointer", color:C.danger,
                          fontSize:12, textAlign:"left", padding:0, fontFamily:"inherit" }}>
                        <X size={11} style={{ verticalAlign:"middle", marginRight:3 }}/>
                        {L("Quitar imagen","Remove image")}
                      </button>
                    )}
                    <span style={{ fontSize:11, color:C.dim }}>JPG, PNG, WebP · máx 5 MB</span>
                  </div>
                </div>
                <input ref={imgInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display:"none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setEditObj(p => ({ ...p, _imgFile: f, imagen_url: null }));
                    e.target.value = "";
                  }}/>
              </div>

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
              {/* Lotes (FIFO/PMP) o unidades serie — solo material existente + Supabase + gestión avanzada */}
              {editObj.id && modo === "supabase" && empresa?.id && capsMat.avanzado && (
                <PanelTrazabilidad material={editObj} companyId={empresa.id} L={L}/>
              )}
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
        );
      })()}

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

      {vaciarConf && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", display:"grid", placeItems:"center", zIndex:500 }} onClick={() => !vaciando && setVaciarConf(false)}>
          <div style={{ background:C.surface, borderRadius:14, padding:24, maxWidth:430, width:"100%", margin:16, boxShadow:"var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
            <AlertTriangle size={28} color={C.danger} style={{ marginBottom:10 }}/>
            <h3 style={{ marginBottom:8 }}>{L("¿Vaciar","Empty")} «{almacenNombreSel}»?</h3>
            <p style={{ color:C.sub, fontSize:13.5, marginBottom:8 }}>
              {L(`Se eliminarán los ${materialesAlmacen.length} materiales de este almacén. Esta acción no se puede deshacer.`, `${materialesAlmacen.length} materials in this warehouse will be deleted. This cannot be undone.`)}
            </p>
            <p style={{ color:C.ink, fontSize:13.5, marginBottom:20, fontWeight:600 }}>
              {L("¿Quieres descargar antes una copia de seguridad en Excel?", "Download an Excel backup first?")}
            </p>
            {vaciando ? (
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:C.sub, marginBottom:6 }}>
                  <span>{L("Eliminando materiales…","Deleting materials…")}</span>
                  <span style={{ fontWeight:600, color:C.ink }}>{vaciarProgreso}%</span>
                </div>
                <div style={{ background:C.border, borderRadius:99, overflow:"hidden", height:10 }}>
                  <div style={{ height:"100%", width:`${vaciarProgreso}%`, background:C.danger, borderRadius:99, transition:"width .25s ease" }}/>
                </div>
              </div>
            ) : (
              <div style={{ display:"flex", gap:10, justifyContent:"flex-end", flexWrap:"wrap" }}>
                <Btn outline onClick={() => setVaciarConf(false)}>{L("Cancelar","Cancel")}</Btn>
                <Btn outline onClick={() => vaciarAlmacen(false)}
                  style={{ borderColor:C.danger, color:C.danger }}>
                  {L("Vaciar sin copia","Empty without backup")}
                </Btn>
                <Btn color={C.danger} onClick={() => vaciarAlmacen(true)}>
                  <Download size={14}/>
                  {L("Descargar copia y vaciar","Download backup & empty")}
                </Btn>
              </div>
            )}
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

      {/* Lightbox */}
      {lightbox && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.85)", zIndex:900,
          display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
          onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)}
            style={{ position:"absolute", top:16, right:16, background:"rgba(255,255,255,.15)",
              border:"none", cursor:"pointer", color:"#fff", borderRadius:999, padding:8, display:"flex" }}>
            <X size={20}/>
          </button>
          <img src={lightbox} alt=""
            style={{ maxWidth:"100%", maxHeight:"90vh", borderRadius:12, objectFit:"contain",
              boxShadow:"0 20px 60px rgba(0,0,0,.5)" }}
            onClick={(e) => e.stopPropagation()}/>
        </div>
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

      {/* Modal de origen externo (SharePoint / Business Central) — opcional, oculto por defecto */}
      {showOrigen && empresa?.id && modo === "supabase" && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:700,
          display:"grid", placeItems:"center", padding:16 }} onClick={() => setShowOrigen(false)}>
          <div style={{ background:C.surface, borderRadius:16, width:"100%", maxWidth:900,
            maxHeight:"90vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,.3)", padding:18 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", alignItems:"center", marginBottom:12 }}>
              <span style={{ fontWeight:700, fontSize:15, flex:1 }}>{L("Origen externo de materiales","External materials source")}</span>
              <button onClick={() => setShowOrigen(false)}
                style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, padding:4, display:"flex" }}>
                <X size={18}/>
              </button>
            </div>
            <OrigenDatosPanel empId={empresa.id} companyId={empresa.id} L={L}
              titulo={L("Conecta la fuente de esta empresa","Connect this company's source")}
              fuentesDisponibles={[
                { id:"sharepoint-file", label:"Excel en SharePoint", labelEn:"Excel on SharePoint", desc:"Busca el archivo en tu SharePoint", descEn:"Find the file in your SharePoint", color:"#0078D4", ready:true },
                { id:"businesscentral", label:"Business Central", labelEn:"Business Central", desc:"Conecta tu Dynamics 365", descEn:"Connect your Dynamics 365", color:"#7A1F3D", ready:true },
              ]}
              getAccessToken={async () => { const { data } = await sb().auth.getSession(); return data?.session?.access_token || null; }}
              onSharePointFile={({ contentBase64, filename }) => { setImportFile(base64AFile(contentBase64, filename)); setShowOrigen(false); }}/>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── ComboField: input con autocompletar (datalist) ──────────────────────────
   Permite elegir de las opciones existentes o escribir una nueva. */
let _comboSeq = 0;
function ComboField({ label, value, onChange, opciones = [], placeholder, style }) {
  const listId = React.useMemo(() => `combo-${++_comboSeq}`, []);
  return (
    <div style={style}>
      <label style={{ fontSize:11.5, fontWeight:600, color:"var(--text-2)", letterSpacing:.5 }}>{label}</label>
      <input
        list={listId}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width:"100%", marginTop:6, padding:"9px 11px", border:"1px solid var(--border-strong)",
          borderRadius:10, fontSize:13.5, fontFamily:"inherit", background:"var(--surface-2)",
          color:"var(--text)", outline:"none", boxSizing:"border-box" }}
      />
      <datalist id={listId}>
        {opciones.map((o) => <option key={o} value={o} />)}
      </datalist>
    </div>
  );
}
