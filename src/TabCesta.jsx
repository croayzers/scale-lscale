// MARK: - TabCesta — Cesta de compra para reposición de almacén
import React, { useState, useCallback, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { ShoppingCart, Trash2, Plus, Minus, Download, Check, Loader, Package, ChevronDown, ChevronRight, AlertTriangle, FileText, Warehouse, Building2, X, Eye, PackagePlus, ArrowDownToLine, Search, Layers, ClipboardList, History } from "lucide-react";
import { actualizarMaterial, cargarProveedores, cargarCorrelacionesDeMateriales } from "./lib/data.js";
import { registrarCompra } from "./lib/dataRecuentos.js";

// Precio efectivo de una correlación: coste con el descuento (%) aplicado si lo hay.
function precioEfectivo(corr) {
  if (!corr || corr.coste == null) return null;
  const base = Number(corr.coste);
  if (isNaN(base)) return null;
  const desc = Number(corr.descuento) || 0;
  return desc > 0 ? base * (1 - desc / 100) : base;
}
const fmtEur = n => n == null ? "—" : `${Number(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

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
export default function TabCesta({ cesta, setCesta, materiales, setMateriales, almacenes = [], modo, empresa, sesion, colsIniciales, onGuardarCols, onNotificarEvento, onIrProveedores, onIrHistorial, pedidoInicial = null, onCestaMontada, L }) {
  const [comprando, setComprando] = useState(false);
  const [comprado,  setComprado]  = useState(false);
  const [modalCostes, setModalCostes]   = useState(false);  // pedir coste antes de comprar
  const [costesManual, setCostesManual] = useState({});     // key(item) -> string
  const [cols,      setCols]      = useState(() => colsIniciales || cargarCols());
  const [mostrarConstructor, setMostrarConstructor] = useState(false);
  const [colapsados, setColapsados] = useState(() => new Set());
  const [avisoAlmacen, setAvisoAlmacen] = useState(null);
  const [vistaGrupo, setVistaGrupo] = useState("almacen"); // "almacen" | "pedido"
  const [modalSelPedido, setModalSelPedido] = useState(null); // null | "pdf" | "excel"

  // Cuando se llega desde un pedido, cambiar a vista pedido y expandir ese grupo.
  useEffect(() => {
    if (!pedidoInicial) return;
    setVistaGrupo("pedido");
    // Asegurar que el grupo está expandido (no colapsado).
    setColapsados(prev => {
      const next = new Set(prev);
      next.delete(String(pedidoInicial));
      return next;
    });
    onCestaMontada?.();
  }, [pedidoInicial]); // eslint-disable-line

  // ── Modal añadir material ──────────────────────────────────────────────────
  const [modalAnyadir, setModalAnyadir] = useState(false);   // paso 1: elegir flujo
  const [modalFlujo,   setModalFlujo]   = useState(null);    // "cesta" | "entrada"
  const [busqueda,     setBusqueda]     = useState("");
  const [matSel,       setMatSel]       = useState(null);    // material elegido
  const [cantAnyadir,  setCantAnyadir]  = useState(1);
  const [almAnyadir,   setAlmAnyadir]   = useState("");
  const [guardandoEntrada, setGuardandoEntrada] = useState(false);
  const [sinProveedor, setSinProveedor] = useState(false);   // aviso proveedor tras entrada

  // ── Pedido a proveedor ──────────────────────────────────────────────────
  const [proveedores, setProveedores] = useState([]);
  const [provDefecto, setProvDefecto] = useState("");      // proveedor por defecto (primero) — id o "" (ninguno)
  const [provPorMat,  setProvPorMat]  = useState({});      // material_id -> proveedor_id (override por línea)
  const [corrPorMat,  setCorrPorMat]  = useState({});      // material_id -> { [proveedor_id]: correlacion }
  const [showPreview, setShowPreview] = useState(false);

  // Resuelve el material_id efectivo: del item si existe, o por nombre+almacén en el catálogo.
  // Necesario para items añadidos desde pedidos sin material_id enlazado.
  const resolveMatId = useCallback((item) => {
    if (item.material_id != null) return item.material_id;
    const nom = (item.nombre || "").trim().toLowerCase();
    return (
      materiales.find(m =>
        (m.almacen_id ?? null) === (item.almacen_id ?? null) &&
        (m.nombre || "").trim().toLowerCase() === nom
      )?.id ??
      materiales.find(m => (m.nombre || "").trim().toLowerCase() === nom)?.id ??
      null
    );
  }, [materiales]);

  // Carga proveedores + correlaciones de los materiales de la cesta (carga selectiva).
  useEffect(() => {
    let vivo = true;
    (async () => {
      if (modo !== "supabase" || !empresa?.id) { setProveedores([]); setCorrPorMat({}); return; }
      try {
        const provs = await cargarProveedores(empresa.id);
        if (!vivo) return;
        setProveedores(provs);
        // Proveedor por defecto = el primero (solo si aún no hay uno elegido).
        setProvDefecto(prev => prev || (provs[0] ? String(provs[0].id) : ""));
        const ids = [...new Set(cesta.map(i => resolveMatId(i)).filter(Boolean))];
        const corr = await cargarCorrelacionesDeMateriales(ids);
        if (!vivo) return;
        const map = {};
        for (const c of corr) {
          const mid = String(c.material_id);
          const pid = String(c.proveedor_id);
          if (!map[mid]) map[mid] = {};
          map[mid][pid] = c;
        }
        setCorrPorMat(map);
      } catch (e) { console.warn("[TabCesta] cargar proveedores/correlaciones:", e?.message); }
    })();
    return () => { vivo = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, empresa?.id, cesta.map(i => i.material_id).join(","), resolveMatId]);

  // Proveedor efectivo de un item: su override, o el por defecto.
  const provDeItem = useCallback((item) =>
    provPorMat[resolveMatId(item)] ?? provDefecto,
  [provPorMat, provDefecto, resolveMatId]);

  const provObj = id => proveedores.find(p => String(p.id) === String(id)) || null;
  const proveedorActivo = provObj(provDefecto);
  const hayProveedor = !!provDefecto && proveedores.length > 0;

  // Correlación de un item para SU proveedor efectivo (nombre proveedor, ref, precio).
  const corrDe = useCallback((item) => {
    const pid = provDeItem(item);
    if (!pid || item.material_id == null) return null;
    return corrPorMat[item.material_id]?.[pid] || null;
  }, [provDeItem, corrPorMat]);

  const toggleGrupo = (key) => setColapsados(prev => {
    const next = new Set(prev);
    const k = String(key == null ? "__null__" : key);
    next.has(k) ? next.delete(k) : next.add(k);
    return next;
  });
  const estaColapsado = (key) => colapsados.has(String(key == null ? "__null__" : key));

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

  // Agrupa la cesta por pedido_codigo. Grupo null = "Sin pedido".
  const gruposPedido = (() => {
    const map = new Map();
    for (const item of cesta) {
      const cod = item.pedido_codigo ?? null;
      if (!map.has(cod)) map.set(cod, []);
      map.get(cod).push(item);
    }
    return [...map.entries()]
      .map(([cod, items]) => ({ cod, nombre: cod == null ? "Sin pedido" : `Pedido ${cod}`, items }))
      .sort((a, b) => (a.cod == null ? 1 : b.cod == null ? -1 : String(a.cod).localeCompare(String(b.cod))));
  })();

  // Pedidos únicos con items en la cesta (para selector de export)
  const pedidosEnCesta = gruposPedido.filter(g => g.cod != null);
  const hayVariosPedidos = pedidosEnCesta.length > 1;

  // Clave única por item para el mapa de costes manuales.
  const keyItem = (item) => item.material_id != null ? `id_${item.material_id}` : `n_${item.nombre}`;

  // Antes de comprar, detecta items sin precio y pide el coste si faltan.
  const iniciarCompra = () => {
    if (!cesta.length) return;
    if (sinAlmacen.length) {
      setAvisoAlmacen(`Asigna almacén a ${sinAlmacen.length} material${sinAlmacen.length === 1 ? "" : "es"} antes de comprar.`);
      setTimeout(() => setAvisoAlmacen(null), 4000);
      return;
    }
    const sinCoste = cesta.filter(item => {
      const mat = buscarMaterial(item);
      return !(Number(mat?.precio_coste) > 0);
    });
    if (sinCoste.length > 0) {
      const init = {};
      for (const item of sinCoste) init[keyItem(item)] = "";
      setCostesManual(init);
      setModalCostes(true);
    } else {
      comprar({});
    }
  };

  const comprar = async (costesExtra = {}) => {
    if (!cesta.length) return;
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
          const costeManual = costesExtra[keyItem(item)];
          const precio_coste = costeManual !== undefined && costeManual !== ""
            ? Number(costeManual)
            : (mat?.precio_coste ?? null);
          return {
            nombre:       item.nombre,
            cantidad:     item.cantidad,
            unidad:       mat?.unidad || "ud",
            material_id:  mat?.id ?? item.material_id ?? null,
            almacen_id:   aid,
            almacen_nombre: nombreAlmacen(aid),
            precio_coste,
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
      setModalCostes(false);
    }
  };

  // Filas para export (agrupadas por almacén), con columna Almacén siempre.
  const filasExport = () => grupos.flatMap(g => g.items.map(item => {
    const mat = buscarMaterial(item) || {};
    return { item, mat, almacen: g.nombre };
  }));

  // ── Pedido a proveedor: líneas traducidas (incluye el proveedor efectivo por línea) ──
  const lineasPedidoProveedor = useMemo(() => {
    if (!hayProveedor) return [];
    return cesta.map(item => {
      const mat   = buscarMaterial(item) || {};
      const pid   = provDeItem(item);
      const mid   = resolveMatId(item);
      const corr  = (pid && mid != null) ? (corrPorMat[String(mid)]?.[String(pid)] || null) : null;
      const precio = precioEfectivo(corr);
      const cant  = Number(item.cantidad) || 0;
      return {
        proveedorId: pid,
        nombreInterno: item.nombre,
        nombreProveedor: corr?.nombre_proveedor || item.nombre,
        referencia: corr?.referencia || mat.referencia || "",
        unidad: mat.unidad || "ud",
        cantidad: cant,
        precio,
        descuento: corr?.descuento || 0,
        importe: precio != null ? precio * cant : null,
        tieneCorr: !!corr,
      };
    });
  }, [cesta, hayProveedor, provDeItem, resolveMatId, corrPorMat, materiales]);

  // Agrupa las líneas por proveedor efectivo (para el documento: una sección por proveedor).
  const gruposProveedor = useMemo(() => {
    const map = new Map();
    for (const l of lineasPedidoProveedor) {
      if (!map.has(l.proveedorId)) map.set(l.proveedorId, []);
      map.get(l.proveedorId).push(l);
    }
    return [...map.entries()].map(([pid, lineas]) => ({
      proveedor: provObj(pid),
      lineas,
      total: lineas.reduce((s, l) => s + (l.importe || 0), 0),
    }));
  }, [lineasPedidoProveedor, proveedores]);

  const totalPedidoProveedor = useMemo(
    () => lineasPedidoProveedor.reduce((s, l) => s + (l.importe || 0), 0),
    [lineasPedidoProveedor]
  );

  // HTML profesional del pedido (una sección por proveedor efectivo).
  // gpsParam: opcional; si no se pasa usa gruposProveedor (todos los items).
  const pedidoProveedorHTMLDe = (gpsParam, paraImprimir = false) => {
    const gps = gpsParam ?? gruposProveedor;
    return pedidoProveedorHTML(paraImprimir, gps);
  };
  const pedidoProveedorHTML = (paraImprimir = false, gpsOverride = null) => {
    const gpsUsar = gpsOverride ?? gruposProveedor;
    const fecha = new Date().toLocaleDateString("es-ES", { day:"2-digit", month:"long", year:"numeric" });
    const esc = s => String(s ?? "").replace(/[&<>]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;" }[c]));

    // Bloque "datos de empresa" (reutilizado para emisor y destinatario).
    const bloqueEmpresa = ({ etiqueta, nombre, logo, lineas, color }) => `
      <div style="flex:1;min-width:0">
        <div style="font-size:10px;font-weight:700;color:#999;letter-spacing:.6px;text-transform:uppercase;margin-bottom:5px">${etiqueta}</div>
        <div style="display:flex;gap:10px;align-items:flex-start">
          ${logo ? `<img src="${logo}" style="width:46px;height:46px;object-fit:contain;border-radius:8px;flex-shrink:0"/>` : ""}
          <div style="min-width:0">
            <div style="font-size:16px;font-weight:800;color:${color || "#1a1a1a"};line-height:1.2">${esc(nombre || "—")}</div>
            <div style="font-size:11px;color:#666;line-height:1.5;margin-top:3px">${lineas.filter(Boolean).map(esc).join("<br/>")}</div>
          </div>
        </div>
      </div>`;

    const datosTu = [
      empresa?.cif ? `CIF: ${empresa.cif}` : "",
      empresa?.phone || "",
      empresa?.billing_email || "",
      empresa?.website || "",
    ];

    const seccionProveedor = (g) => {
      const brand = g.proveedor?.color || "#f97316";
      const hayPrecios = g.lineas.some(l => l.precio != null);
      const d = g.proveedor?.datos || {};
      const datosProv = [
        d.cif ? `CIF: ${d.cif}` : "",
        d.persona || "",
        d.telefono || (g.proveedor?.contacto && /\d/.test(g.proveedor.contacto) ? g.proveedor.contacto : ""),
        d.email || (g.proveedor?.contacto && g.proveedor.contacto.includes("@") ? g.proveedor.contacto : ""),
        d.direccion || "",
        d.web || "",
      ];
      const filas = g.lineas.map((l, i) => `
        <tr style="border-bottom:1px solid #eee;${i % 2 ? "background:#fafafa" : ""}">
          <td style="padding:8px 10px;font-size:12px">
            <div style="font-weight:700;color:#1a1a1a">${esc(l.nombreProveedor)}</div>
            ${l.nombreInterno !== l.nombreProveedor ? `<div style="font-size:10.5px;color:#999">Tu material: ${esc(l.nombreInterno)}</div>` : ""}
            ${!l.tieneCorr ? `<div style="font-size:10px;color:#d97706">⚠ sin correlación</div>` : ""}
          </td>
          <td style="padding:8px 10px;font-size:12px;color:#555">${esc(l.referencia) || "—"}</td>
          <td style="padding:8px 10px;font-size:12px;text-align:right;font-weight:600">${l.cantidad} ${esc(l.unidad)}</td>
          ${hayPrecios ? `<td style="padding:8px 10px;font-size:12px;text-align:right;color:#555">${l.precio != null ? fmtEur(l.precio) : "—"}${l.descuento > 0 ? `<span style="color:#999;font-size:10px"> −${l.descuento}%</span>` : ""}</td>` : ""}
          ${hayPrecios ? `<td style="padding:8px 10px;font-size:12px;text-align:right;font-weight:700">${l.importe != null ? fmtEur(l.importe) : "—"}</td>` : ""}
        </tr>`).join("");
      const uds = g.lineas.reduce((s, l) => s + l.cantidad, 0);
      return `
        <div style="page-break-inside:avoid;margin-bottom:26px">
          <!-- Cabecera de dos columnas: emisor / destinatario -->
          <div style="display:flex;gap:24px;border-bottom:3px solid ${brand};padding-bottom:14px;margin-bottom:14px">
            ${bloqueEmpresa({ etiqueta:"De", nombre: empresa?.nombre || "Mi empresa", logo: empresa?.logo_url, lineas: datosTu, color:"#1a1a1a" })}
            ${bloqueEmpresa({ etiqueta:"Para (proveedor)", nombre: g.proveedor?.nombre, lineas: datosProv, color: brand })}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="font-size:18px;font-weight:800;color:${brand};letter-spacing:.5px">PEDIDO</div>
            <div style="font-size:11px;color:#666">Fecha: <strong>${fecha}</strong></div>
          </div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
            <thead>
              <tr style="background:${brand}">
                <th style="padding:9px 10px;text-align:left;font-size:11px;color:#fff;letter-spacing:.3px">ARTÍCULO</th>
                <th style="padding:9px 10px;text-align:left;font-size:11px;color:#fff">REFERENCIA</th>
                <th style="padding:9px 10px;text-align:right;font-size:11px;color:#fff">CANTIDAD</th>
                ${hayPrecios ? `<th style="padding:9px 10px;text-align:right;font-size:11px;color:#fff">PRECIO</th>` : ""}
                ${hayPrecios ? `<th style="padding:9px 10px;text-align:right;font-size:11px;color:#fff">IMPORTE</th>` : ""}
              </tr>
            </thead>
            <tbody>${filas}</tbody>
            ${hayPrecios ? `
            <tfoot><tr style="border-top:2px solid ${brand}">
              <td colspan="4" style="padding:10px;text-align:right;font-size:13px;font-weight:700">TOTAL (sin IVA)</td>
              <td style="padding:10px;text-align:right;font-size:15px;font-weight:800;color:${brand}">${fmtEur(g.total)}</td>
            </tr></tfoot>` : ""}
          </table>
          <div style="margin-top:6px;font-size:11px;color:#888">${g.lineas.length} líneas · ${uds} uds${!hayPrecios ? ` · <span style="color:#d97706">sin precios (completa las correlaciones)</span>` : ""}</div>
        </div>`;
    };

    return `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;max-width:780px;margin:0 auto;padding:${paraImprimir ? "0" : "8px"}">
        ${gpsUsar.map(seccionProveedor).join('<div style="page-break-after:always"></div>')}
      </div>`;
  };

  // filtroPedido: null = todos | string/number = solo ese pedido_codigo
  const cestaFiltrada = (filtroPedido) =>
    filtroPedido == null ? cesta : cesta.filter(i => String(i.pedido_codigo ?? "") === String(filtroPedido));

  // lineas y grupos de proveedor para un subconjunto de la cesta
  const lineasProveedorDe = useCallback((itemsFiltro) => {
    if (!hayProveedor) return [];
    return itemsFiltro.map(item => {
      const mat   = buscarMaterial(item) || {};
      const pid   = provDeItem(item);
      const mid   = resolveMatId(item);
      const corr  = (pid && mid != null) ? (corrPorMat[String(mid)]?.[String(pid)] || null) : null;
      const precio = precioEfectivo(corr);
      const cant  = Number(item.cantidad) || 0;
      return {
        proveedorId: pid, nombreInterno: item.nombre,
        nombreProveedor: corr?.nombre_proveedor || item.nombre,
        referencia: corr?.referencia || mat.referencia || "",
        unidad: mat.unidad || "ud", cantidad: cant,
        precio, descuento: corr?.descuento || 0,
        importe: precio != null ? precio * cant : null,
        tieneCorr: !!corr,
      };
    });
  }, [hayProveedor, provDeItem, resolveMatId, corrPorMat, materiales]); // eslint-disable-line

  const gruposProveedorDe = (lineas) => {
    const map = new Map();
    for (const l of lineas) {
      if (!map.has(l.proveedorId)) map.set(l.proveedorId, []);
      map.get(l.proveedorId).push(l);
    }
    return [...map.entries()].map(([pid, ls]) => ({
      proveedor: provObj(pid), lineas: ls,
      total: ls.reduce((s, l) => s + (l.importe || 0), 0),
    }));
  };

  const exportarPedidoProveedorPDF = (filtroPedido = null) => {
    const items = cestaFiltrada(filtroPedido);
    const lineas = lineasProveedorDe(items);
    const gps = gruposProveedorDe(lineas);
    const titulo = filtroPedido != null ? `Pedido ${filtroPedido} a proveedores` : "Pedido a proveedores";
    const htmlBody = pedidoProveedorHTMLDe(gps, false);
    const win = window.open("", "_blank", "width=820,height=1000");
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>${titulo}</title>
      <style>@page{size:A4;margin:16mm 14mm}@media print{button{display:none}}</style>
      </head><body>${pedidoProveedorHTMLDe(gps, true)}
      <div style="text-align:center;margin-top:20px">
        <button onclick="window.print()" style="padding:9px 22px;background:${proveedorActivo?.color || "#f97316"};color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-family:Arial">Imprimir / Guardar PDF</button>
      </div></body></html>`);
    win.document.close();
  };

  const exportarPedidoProveedorExcel = (filtroPedido = null) => {
    const items = cestaFiltrada(filtroPedido);
    const lineas = lineasProveedorDe(items);
    const gps = gruposProveedorDe(lineas);
    const hayPrecios = lineas.some(l => l.precio != null);
    const wb = XLSX.utils.book_new();
    const usados = new Set();
    for (const g of gps) {
      const d = g.proveedor?.datos || {};
      const rows = [
        ["PEDIDO", "", "", "", `Fecha: ${new Date().toLocaleDateString("es-ES")}`],
        [],
        ["DE (emisor)", "", "", "PARA (proveedor)"],
        [empresa?.nombre || "", "", "", g.proveedor?.nombre || ""],
        [empresa?.cif ? `CIF: ${empresa.cif}` : "", "", "", d.cif ? `CIF: ${d.cif}` : ""],
        [empresa?.phone || "", "", "", d.telefono || ""],
        [empresa?.billing_email || "", "", "", d.email || ""],
        [empresa?.website || "", "", "", d.direccion || ""],
        [],
        ["Artículo (proveedor)", "Tu material", "Referencia", "Cantidad", "Unidad",
          ...(hayPrecios ? ["Precio", "Dto %", "Importe"] : [])],
      ];
      for (const l of g.lineas) {
        rows.push([
          l.nombreProveedor, l.nombreInterno, l.referencia, l.cantidad, l.unidad,
          ...(hayPrecios ? [l.precio ?? "", l.descuento || 0, l.importe ?? ""] : []),
        ]);
      }
      if (hayPrecios) rows.push([], ["", "", "", "", "", "", "TOTAL (sin IVA)", g.total]);
      const ws = XLSX.utils.aoa_to_sheet(rows);
      // Nombre de hoja válido y único (máx 31 chars, sin caracteres prohibidos).
      let nombre = (g.proveedor?.nombre || "Proveedor").replace(/[\\/?*[\]:]/g, " ").slice(0, 28);
      let n = nombre; let i = 2;
      while (usados.has(n)) { n = `${nombre.slice(0,26)} ${i++}`; }
      usados.add(n);
      XLSX.utils.book_append_sheet(wb, ws, n);
    }
    if (!wb.SheetNames.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Sin líneas"]]), "Pedido");
    XLSX.writeFile(wb, `pedido_proveedores_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

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

  // Materiales filtrados por búsqueda para el modal
  const materialesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return materiales.slice(0, 60);
    return materiales.filter(m =>
      (m.nombre || "").toLowerCase().includes(q) ||
      (m.referencia || "").toLowerCase().includes(q) ||
      (m.categoria || "").toLowerCase().includes(q)
    ).slice(0, 60);
  }, [materiales, busqueda]);

  const cerrarModal = () => {
    setModalAnyadir(false); setModalFlujo(null);
    setBusqueda(""); setMatSel(null); setCantAnyadir(1); setAlmAnyadir(""); setSinProveedor(false);
  };

  const confirmarAnyadir = async () => {
    if (!matSel) return;
    const almId = almAnyadir === "" ? null : Number(almAnyadir);
    if (modalFlujo === "cesta") {
      setCesta(prev => {
        const existe = prev.find(i => i.material_id === matSel.id && (i.almacen_id ?? null) === almId);
        if (existe) return prev.map(i =>
          i === existe ? { ...i, cantidad: (Number(i.cantidad) || 0) + Number(cantAnyadir) } : i
        );
        return [...prev, { material_id: matSel.id, nombre: matSel.nombre, cantidad: Number(cantAnyadir), almacen_id: almId }];
      });
      cerrarModal();
    } else {
      // Entrada directa de stock
      setGuardandoEntrada(true);
      try {
        const nuevoStock = (Number(matSel.stock_actual) || 0) + Number(cantAnyadir);
        await actualizarMaterial(matSel.id, { stock_actual: nuevoStock });
        setMateriales(prev => prev.map(m => m.id === matSel.id ? { ...m, stock_actual: nuevoStock } : m));
        const userEmail = sesion?.user?.email || null;
        await registrarCompra([{
          material_id: matSel.id, nombre: matSel.nombre,
          cantidad: Number(cantAnyadir), unidad: matSel.unidad || "ud",
          almacen_id: almId, almacen_nombre: almacenes.find(a => a.id === almId)?.nombre || null,
          precio_coste: matSel.precio_coste ?? null,
        }], empresa?.id, userEmail, modo);
        // ¿Tiene proveedor?
        const tieneProv = !!(matSel.proveedor || matSel.proveedor_id);
        if (!tieneProv) { setSinProveedor(true); }
        else { cerrarModal(); }
      } catch (e) { console.error("[TabCesta] entrada directa:", e); }
      finally { setGuardandoEntrada(false); }
    }
  };

  // ── Modal añadir material (JSX reutilizado en pantalla vacía y con items) ──
  const ModalAnyadirMaterial = modalAnyadir && (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", zIndex:900,
      display:"grid", placeItems:"center", padding:16 }} onClick={cerrarModal}>
      <div style={{ background:C.surface, borderRadius:16, width:"100%", maxWidth:480,
        boxShadow:"0 20px 60px #0004", display:"flex", flexDirection:"column" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${C.line}`,
          display:"flex", alignItems:"center", gap:10 }}>
          <PackagePlus size={17} color={C.brand}/>
          <span style={{ fontWeight:700, fontSize:15, flex:1 }}>Añadir material</span>
          <button onClick={cerrarModal} style={{ background:"none", border:"none", cursor:"pointer", color:C.sub }}><X size={17}/></button>
        </div>

        <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:14 }}>

          {/* Paso 1: elegir flujo */}
          {!modalFlujo && !sinProveedor && (
            <>
              <p style={{ fontSize:13, color:C.sub, margin:0 }}>¿Qué quieres hacer?</p>
              {[
                { val:"cesta", Icon:ShoppingCart, label:"Añadir a la cesta",
                  desc:"Planifica la compra. El stock se actualiza cuando pulses «Comprar»." },
                { val:"entrada", Icon:ArrowDownToLine, label:"Registrar entrada de stock",
                  desc:"Ya tienes el material en mano. El stock sube ahora y queda en el historial de compras." },
              ].map(({ val, Icon, label, desc }) => (
                <button key={val} onClick={() => setModalFlujo(val)}
                  style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"12px 16px",
                    borderRadius:10, border:`1.5px solid ${C.line}`, background:C.s2,
                    cursor:"pointer", fontFamily:"inherit", textAlign:"left",
                    transition:"border-color .15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.brand}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.line}>
                  <div style={{ width:36, height:36, borderRadius:8, background:C.brandSoft,
                    display:"grid", placeItems:"center", flexShrink:0 }}>
                    <Icon size={17} color={C.brand}/>
                  </div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:13.5, color:C.ink, marginBottom:3 }}>{label}</div>
                    <div style={{ fontSize:12, color:C.sub, lineHeight:1.5 }}>{desc}</div>
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Aviso sin proveedor tras entrada directa */}
          {sinProveedor && (
            <div style={{ display:"flex", flexDirection:"column", gap:14, alignItems:"center", textAlign:"center", padding:"8px 0" }}>
              <div style={{ width:48, height:48, borderRadius:999, background:C.warnSoft, display:"grid", placeItems:"center" }}>
                <AlertTriangle size={22} color={C.warn}/>
              </div>
              <div style={{ fontSize:14, fontWeight:700, color:C.ink }}>Stock actualizado</div>
              <div style={{ fontSize:13, color:C.sub, lineHeight:1.6 }}>
                <strong>{matSel?.nombre}</strong> no tiene proveedor asignado.<br/>
                ¿Quieres correlacionarlo con un proveedor ahora?
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={cerrarModal}
                  style={{ padding:"8px 18px", borderRadius:8, border:`1px solid ${C.strong}`,
                    background:"transparent", color:C.sub, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                  Ahora no
                </button>
                <button onClick={() => { cerrarModal(); onIrProveedores?.(); }}
                  style={{ padding:"8px 18px", borderRadius:8, border:"none",
                    background:C.brand, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                  Ir a Proveedores
                </button>
              </div>
            </div>
          )}

          {/* Paso 2: elegir material + cantidad + almacén */}
          {modalFlujo && !sinProveedor && (
            <>
              <div style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 12px",
                borderRadius:8, background:C.s2, border:`1px solid ${C.line}` }}>
                <Search size={14} color={C.dim}/>
                <input autoFocus value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar material…"
                  style={{ flex:1, border:"none", background:"transparent", outline:"none",
                    fontSize:13.5, color:C.ink, fontFamily:"inherit" }}/>
              </div>

              <div style={{ maxHeight:200, overflowY:"auto", border:`1px solid ${C.line}`,
                borderRadius:8, background:C.bg }}>
                {materialesFiltrados.length === 0
                  ? <div style={{ padding:"20px", textAlign:"center", fontSize:13, color:C.dim }}>Sin resultados</div>
                  : materialesFiltrados.map(m => (
                    <button key={m.id} onClick={() => { setMatSel(m); setAlmAnyadir(String(m.almacen_id ?? "")); }}
                      style={{ width:"100%", display:"flex", alignItems:"center", gap:10,
                        padding:"9px 14px", border:"none", borderBottom:`1px solid ${C.line}`,
                        background: matSel?.id === m.id ? C.brandSoft : "transparent",
                        color: matSel?.id === m.id ? C.brand : C.ink,
                        cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
                      <Package size={14} color={matSel?.id === m.id ? C.brand : C.dim}/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{m.nombre}</div>
                        <div style={{ fontSize:11, color:C.sub }}>{m.categoria || "—"} · stock: {m.stock_actual ?? 0}</div>
                      </div>
                      {matSel?.id === m.id && <Check size={14} color={C.brand}/>}
                    </button>
                  ))
                }
              </div>

              {matSel && (
                <div style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
                  <div style={{ flex:1 }}>
                    <label style={{ fontSize:11.5, fontWeight:600, color:C.sub, display:"block", marginBottom:4 }}>CANTIDAD</label>
                    <input type="number" min={1} value={cantAnyadir}
                      onChange={e => setCantAnyadir(Math.max(1, Number(e.target.value)))}
                      style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${C.strong}`,
                        background:C.s2, color:C.ink, fontSize:14, fontFamily:"inherit", outline:"none" }}/>
                  </div>
                  {almacenes.length > 1 && (
                    <div style={{ flex:2 }}>
                      <label style={{ fontSize:11.5, fontWeight:600, color:C.sub, display:"block", marginBottom:4 }}>ALMACÉN</label>
                      <select value={almAnyadir} onChange={e => setAlmAnyadir(e.target.value)}
                        style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${C.strong}`,
                          background:C.s2, color:C.ink, fontSize:13, fontFamily:"inherit", outline:"none", cursor:"pointer" }}>
                        <option value="">Sin almacén</option>
                        {almacenes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:4 }}>
                <button onClick={() => setModalFlujo(null)}
                  style={{ padding:"8px 16px", borderRadius:8, border:`1px solid ${C.strong}`,
                    background:"transparent", color:C.sub, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                  Atrás
                </button>
                <button onClick={confirmarAnyadir} disabled={!matSel || guardandoEntrada}
                  style={{ padding:"8px 20px", borderRadius:8, border:"none",
                    background: matSel ? C.ok : C.strong, color:"#fff",
                    fontWeight:700, fontSize:13, cursor: matSel ? "pointer" : "not-allowed", fontFamily:"inherit",
                    display:"flex", alignItems:"center", gap:6 }}>
                  {guardandoEntrada ? <Loader size={13} className="spin"/> : <Check size={13}/>}
                  {modalFlujo === "cesta" ? "Añadir a cesta" : "Registrar entrada"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

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
            Añade materiales desde el <strong>Almacén</strong> (botón 🛒 en cada fila)
            o desde el banner de stock insuficiente de un pedido.
          </div>
          <button onClick={() => setModalAnyadir(true)}
            style={{ marginTop:8, display:"flex", alignItems:"center", gap:6, padding:"9px 20px",
              borderRadius:999, border:"none", background:C.brand, color:"#fff",
              fontWeight:700, fontSize:13.5, cursor:"pointer", fontFamily:"inherit" }}>
            <Plus size={15}/>Añadir material
          </button>
        </div>
        {ModalAnyadirMaterial}
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", flex:1, minHeight:0, background:C.bg }}>

      {/* Header */}
      <div style={{ padding:"14px 20px", background:C.surface, borderBottom:`1px solid ${C.line}`,
        display:"flex", alignItems:"center", gap:10, flexShrink:0, flexWrap:"wrap" }}>
        <ShoppingCart size={16} color={C.brand}/>
        <span style={{ fontWeight:700, fontSize:15 }}>Cesta de compra</span>
        <span style={{ fontSize:12, background:C.brandSoft, color:C.brand,
          padding:"2px 8px", borderRadius:999, fontWeight:600 }}>
          {cesta.length} {cesta.length === 1 ? "artículo" : "artículos"} · {total} uds · {grupos.length} almacén{grupos.length === 1 ? "" : "es"}
          {pedidosEnCesta.length > 0 && ` · ${pedidosEnCesta.length} pedido${pedidosEnCesta.length === 1 ? "" : "s"}`}
        </span>
        {/* Toggle agrupación: por almacén o por pedido */}
        {pedidosEnCesta.length > 0 && (
          <div style={{ display:"flex", borderRadius:8, border:`1px solid ${C.strong}`, overflow:"hidden" }}>
            {[
              { val:"almacen", Icon:Warehouse, label:"Por almacén" },
              { val:"pedido",  Icon:ClipboardList, label:"Por pedido" },
            ].map(({ val, Icon, label }) => (
              <button key={val} onClick={() => setVistaGrupo(val)}
                style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 10px", border:"none",
                  background: vistaGrupo === val ? C.brand : C.s2,
                  color: vistaGrupo === val ? "#fff" : C.sub,
                  fontWeight:600, fontSize:11.5, cursor:"pointer", fontFamily:"inherit" }}>
                <Icon size={12}/>{label}
              </button>
            ))}
          </div>
        )}
        {sinAlmacen.length > 0 && (
          <span style={{ fontSize:12, background:C.warnSoft, color:C.warn,
            padding:"2px 8px", borderRadius:999, fontWeight:600, display:"flex", alignItems:"center", gap:4 }}>
            <AlertTriangle size={12}/> {sinAlmacen.length} sin almacén
          </span>
        )}

        {/* Bloque derecho de la cabecera: botón Compras + selector de proveedor */}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:10 }}>
          {onIrHistorial && (
            <button onClick={onIrHistorial} title={L("Ver el historial de todas las compras","See the purchase history")}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:999,
                border:`1.5px solid ${C.strong}`, background:C.s2, color:C.ink,
                fontWeight:600, fontSize:12.5, cursor:"pointer", fontFamily:"inherit" }}>
              <History size={14} color={C.brand}/>{L("Compras","Purchases")}
            </button>
          )}
          {proveedores.length > 0 && (
            <div style={{ display:"flex", alignItems:"center", gap:6 }}
              title="Proveedor por defecto · puedes cambiarlo por material en cada fila">
              <Building2 size={14} color={C.brand}/>
              <span style={{ fontSize:11.5, color:C.sub, fontWeight:600 }}>Proveedor:</span>
              <select value={provDefecto} onChange={e => { setProvDefecto(e.target.value); setProvPorMat({}); }}
                style={{ padding:"6px 10px", borderRadius:999, fontSize:12.5, fontFamily:"inherit",
                  border:`1.5px solid ${provDefecto ? C.brand : C.strong}`,
                  background: provDefecto ? C.brandSoft : C.s2, color: provDefecto ? C.brand : C.ink,
                  cursor:"pointer", outline:"none" }}>
                <option value="">Ninguno</option>
                {proveedores.map(p => <option key={p.id} value={String(p.id)}>{p.nombre}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Barra de acciones (arriba) */}
      <div style={{ padding:"10px 20px", background:C.surface, borderBottom:`1px solid ${C.line}`,
        display:"flex", alignItems:"center", gap:10, flexShrink:0, flexWrap:"wrap" }}>
        {hayProveedor && (
          <>
            <button onClick={() => setShowPreview(true)}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:8,
                border:"none", background: proveedorActivo?.color || C.brand, color:"#fff",
                fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
              <Eye size={14}/>Vista previa pedido
            </button>
            <button onClick={() => hayVariosPedidos ? setModalSelPedido("pdf") : exportarPedidoProveedorPDF()}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 12px", borderRadius:8,
                border:`1px solid ${C.strong}`, background:C.s2, color:C.ink,
                fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
              <FileText size={13} color="#dc2626"/>PDF
            </button>
            <button onClick={() => hayVariosPedidos ? setModalSelPedido("excel") : exportarPedidoProveedorExcel()}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 12px", borderRadius:8,
                border:`1px solid ${C.strong}`, background:C.s2, color:C.ink,
                fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
              <Download size={13} color="#16a34a"/>Excel
            </button>
            <div style={{ width:1, height:24, background:C.line, margin:"0 4px" }}/>
          </>
        )}

        <button onClick={exportarExcel}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 12px",
            borderRadius:8, border:`1px solid ${C.strong}`, background:C.s2, color:C.ink,
            fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
          <Download size={13} color="#16a34a"/>Excel almacén
        </button>
        <button onClick={exportarPDF}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 12px",
            borderRadius:8, border:`1px solid ${C.strong}`, background:C.s2, color:C.ink,
            fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
          <FileText size={13} color="#dc2626"/>PDF almacén
        </button>

        <button onClick={() => setModalAnyadir(true)}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px",
            borderRadius:8, border:"none", background:C.brand, color:"#fff",
            fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
          <Plus size={14}/>Añadir material
        </button>

        <div style={{ flex:1 }}/>
        {/* El acceso a Compras/Historial está en la cabecera (junto al selector de proveedor). */}

        <button onClick={() => setCesta([])}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px",
            borderRadius:8, border:`1px solid ${C.danger}`, background:"transparent",
            color:C.danger, fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
          <Trash2 size={13}/>Vaciar
        </button>
        <button onClick={iniciarCompra} disabled={comprando || !cesta.length || sinAlmacen.length > 0}
          title={sinAlmacen.length > 0 ? "Asigna almacén a todos los materiales" : ""}
          style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 20px",
            borderRadius:999, border:"none", fontFamily:"inherit",
            background: (sinAlmacen.length > 0) ? C.strong : C.ok, color:"#fff",
            fontWeight:700, fontSize:13.5,
            cursor: (comprando || sinAlmacen.length > 0) ? "not-allowed" : "pointer",
            opacity: comprando ? 0.7 : 1 }}>
          {comprando ? <Loader size={14} className="spin"/> : <Package size={14}/>}
          {comprando ? "Comprando…" : "Comprar — actualizar stock"}
        </button>
      </div>

      {/* Aviso de almacén faltante al comprar */}
      {avisoAlmacen && (
        <div style={{ padding:"10px 20px", background:C.warnSoft, color:C.warn,
          fontSize:13, fontWeight:600, display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          <AlertTriangle size={15}/> {avisoAlmacen}
        </div>
      )}

      {/* Grupos: por almacén o por pedido (colapsables) */}
      <div style={{ flex:1, minHeight:0, overflowY:"auto", padding:20, display:"flex", flexDirection:"column", gap:14 }}>
        {(vistaGrupo === "pedido" ? gruposPedido : grupos).map(g => {
          const gKey  = vistaGrupo === "pedido" ? (g.cod ?? "__null__") : (g.aid ?? "__null__");
          const colapsado = colapsados.has(String(gKey));
          const subUds = g.items.reduce((s, i) => s + i.cantidad, 0);
          const sinAlm = vistaGrupo === "almacen" && g.aid == null;
          const sinPed = vistaGrupo === "pedido"  && g.cod == null;
          const esAlerta = sinAlm || sinPed;
          const toggleKey = vistaGrupo === "pedido" ? g.cod : g.aid;
          return (
            <div key={String(gKey)}
              style={{ border:`1px solid ${esAlerta ? C.warn : C.line}`, borderRadius:12, overflow:"hidden",
                background: C.surface, flexShrink:0 }}>
              {/* Cabecera de grupo */}
              <button onClick={() => toggleGrupo(toggleKey)}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"11px 14px",
                  background: esAlerta ? C.warnSoft : C.s2, border:"none", cursor:"pointer",
                  fontFamily:"inherit", textAlign:"left" }}>
                {colapsado ? <ChevronRight size={16} color={C.sub}/> : <ChevronDown size={16} color={C.sub}/>}
                {sinAlm ? <AlertTriangle size={15} color={C.warn}/>
                  : vistaGrupo === "pedido"
                    ? <ClipboardList size={15} color={sinPed ? C.warn : C.brand}/>
                    : <Warehouse size={15} color={C.brand}/>}
                <span style={{ fontWeight:700, fontSize:14, color: esAlerta ? C.warn : C.ink }}>{g.nombre}</span>
                <span style={{ fontSize:11.5, color:C.sub }}>
                  {g.items.length} {g.items.length === 1 ? "material" : "materiales"} · {subUds} uds
                </span>
                {vistaGrupo === "pedido" && hayProveedor && g.cod != null && (
                  <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
                    <button onClick={e => { e.stopPropagation(); exportarPedidoProveedorPDF(g.cod); }}
                      style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 10px",
                        borderRadius:6, border:`1px solid ${C.strong}`, background:C.surface,
                        color:"#dc2626", fontWeight:600, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
                      <FileText size={11}/>PDF
                    </button>
                    <button onClick={e => { e.stopPropagation(); exportarPedidoProveedorExcel(g.cod); }}
                      style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 10px",
                        borderRadius:6, border:`1px solid ${C.strong}`, background:C.surface,
                        color:"#16a34a", fontWeight:600, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
                      <Download size={11}/>Excel
                    </button>
                  </div>
                )}
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

                          {/* Proveedor por línea: selector (override) + nombre/ref/precio de ese proveedor */}
                          {hayProveedor && (() => {
                            const mid  = resolveMatId(item);
                            const pid  = provDeItem(item);
                            const prov = provObj(pid);
                            const corr = (pid && mid != null) ? (corrPorMat[String(mid)]?.[String(pid)] || null) : null;
                            const precio = precioEfectivo(corr);
                            return (
                              <td style={{ padding:"10px 12px", minWidth:230 }}>
                                {/* Mini-selector de proveedor para este material */}
                                <select value={pid || ""}
                                  onChange={e => { if (mid != null) setProvPorMat(prev => ({ ...prev, [String(mid)]: e.target.value || "" })); }}
                                  disabled={mid == null}
                                  style={{ marginBottom:4, padding:"3px 8px", borderRadius:999, fontSize:11,
                                    fontFamily:"inherit", cursor:"pointer", outline:"none",
                                    border:`1.5px solid ${prov ? (prov.color || C.brand) + "88" : C.line}`,
                                    background: prov ? (prov.color || C.brand) + "18" : C.s2,
                                    color: prov ? (prov.color || C.brand) : C.sub, maxWidth:170 }}>
                                  <option value="">Sin proveedor</option>
                                  {proveedores.map(p => <option key={p.id} value={String(p.id)}>{p.nombre}</option>)}
                                </select>
                                {corr ? (
                                  <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                                    <span style={{ fontSize:13, fontWeight:700, color: prov?.color || C.brand }}>
                                      {corr.nombre_proveedor || item.nombre}
                                    </span>
                                    <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                                      {corr.referencia && (
                                        <span style={{ fontSize:11, color:C.sub }}>Ref: <strong style={{ color:C.ink }}>{corr.referencia}</strong></span>
                                      )}
                                      {precio != null && (
                                        <span style={{ fontSize:11.5, fontWeight:700, color:C.ok }}>
                                          {fmtEur(precio)}/{mat.unidad || "ud"}
                                          {corr.descuento > 0 && <span style={{ color:C.dim, fontWeight:400 }}> (−{corr.descuento}%)</span>}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ) : pid ? (
                                  <span style={{ fontSize:11.5, color:C.warn, fontStyle:"italic" }}>Sin correlación con este proveedor</span>
                                ) : null}
                              </td>
                            );
                          })()}

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

      {ModalAnyadirMaterial}

      {/* Modal: pedir coste de items sin precio antes de comprar */}
      {modalCostes && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", zIndex:900,
          display:"grid", placeItems:"center", padding:16 }} onClick={() => setModalCostes(false)}>
          <div style={{ background:C.surface, borderRadius:16, width:"100%", maxWidth:440,
            boxShadow:"0 20px 60px #0004" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding:"14px 20px", borderBottom:`1px solid ${C.line}`,
              display:"flex", alignItems:"center", gap:10 }}>
              <Package size={17} color={C.brand}/>
              <span style={{ fontWeight:700, fontSize:15, flex:1 }}>Coste de compra</span>
              <button onClick={() => setModalCostes(false)}
                style={{ background:"none", border:"none", cursor:"pointer", color:C.sub }}><X size={17}/></button>
            </div>
            <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:12 }}>
              <p style={{ fontSize:13, color:C.sub, margin:0 }}>
                Indica el coste por unidad de los artículos sin precio asignado. Solo se usa para registrar esta compra.
              </p>
              {cesta.filter(item => !(Number(buscarMaterial(item)?.precio_coste) > 0)).map((item, idx) => (
                <div key={idx} style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ flex:1, fontSize:13.5, fontWeight:600, color:C.ink, minWidth:0,
                    whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {item.nombre}
                    <span style={{ fontSize:11, color:C.dim, fontWeight:400, marginLeft:6 }}>× {item.cantidad}</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
                    <input type="number" min={0} step={0.01} placeholder="0,00"
                      value={costesManual[keyItem(item)] ?? ""}
                      onChange={e => setCostesManual(prev => ({ ...prev, [keyItem(item)]: e.target.value }))}
                      style={{ width:90, padding:"7px 10px", borderRadius:8,
                        border:`1px solid ${C.strong}`, background:C.s2,
                        color:C.ink, fontSize:14, fontFamily:"inherit", outline:"none",
                        textAlign:"right" }}/>
                    <span style={{ fontSize:13, color:C.sub }}>€/ud</span>
                  </div>
                </div>
              ))}
              <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:4 }}>
                <button onClick={() => setModalCostes(false)}
                  style={{ padding:"8px 16px", borderRadius:8, border:`1px solid ${C.strong}`,
                    background:"transparent", color:C.sub, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                  Cancelar
                </button>
                <button onClick={() => comprar(costesManual)} disabled={comprando}
                  style={{ padding:"8px 20px", borderRadius:8, border:"none",
                    background:C.ok, color:"#fff", fontWeight:700, fontSize:13,
                    cursor:"pointer", fontFamily:"inherit",
                    display:"flex", alignItems:"center", gap:6 }}>
                  {comprando ? <Loader size={13} className="spin"/> : <Package size={13}/>}
                  Confirmar compra
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal selector de pedido para export PDF/Excel */}
      {modalSelPedido && hayVariosPedidos && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", zIndex:900,
          display:"grid", placeItems:"center", padding:16 }} onClick={() => setModalSelPedido(null)}>
          <div style={{ background:C.surface, borderRadius:16, width:"100%", maxWidth:420,
            boxShadow:"0 20px 60px #0004" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding:"14px 20px", borderBottom:`1px solid ${C.line}`,
              display:"flex", alignItems:"center", gap:10 }}>
              {modalSelPedido === "pdf" ? <FileText size={17} color="#dc2626"/> : <Download size={17} color="#16a34a"/>}
              <span style={{ fontWeight:700, fontSize:15, flex:1 }}>
                {modalSelPedido === "pdf" ? "Exportar PDF" : "Exportar Excel"} — ¿qué pedido?
              </span>
              <button onClick={() => setModalSelPedido(null)}
                style={{ background:"none", border:"none", cursor:"pointer", color:C.sub }}><X size={17}/></button>
            </div>
            <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:8 }}>
              <p style={{ fontSize:13, color:C.sub, margin:"0 0 4px" }}>
                La cesta tiene materiales de varios pedidos. Elige qué incluir:
              </p>
              <button onClick={() => {
                  modalSelPedido === "pdf" ? exportarPedidoProveedorPDF() : exportarPedidoProveedorExcel();
                  setModalSelPedido(null);
                }}
                style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderRadius:10,
                  border:`1.5px solid ${C.brand}`, background:C.brandSoft, cursor:"pointer",
                  fontFamily:"inherit", textAlign:"left" }}>
                <Layers size={15} color={C.brand}/>
                <div>
                  <div style={{ fontWeight:700, fontSize:13, color:C.brand }}>Todos los pedidos</div>
                  <div style={{ fontSize:11.5, color:C.sub }}>Un documento con todos los materiales</div>
                </div>
              </button>
              {pedidosEnCesta.map(gp => (
                <button key={gp.cod} onClick={() => {
                    modalSelPedido === "pdf" ? exportarPedidoProveedorPDF(gp.cod) : exportarPedidoProveedorExcel(gp.cod);
                    setModalSelPedido(null);
                  }}
                  style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderRadius:10,
                    border:`1px solid ${C.line}`, background:C.s2, cursor:"pointer",
                    fontFamily:"inherit", textAlign:"left" }}>
                  <ClipboardList size={15} color={C.sub}/>
                  <div>
                    <div style={{ fontWeight:700, fontSize:13, color:C.ink }}>{gp.nombre}</div>
                    <div style={{ fontSize:11.5, color:C.sub }}>
                      {gp.items.length} material{gp.items.length === 1 ? "" : "es"} · {gp.items.reduce((s, i) => s + i.cantidad, 0)} uds
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal vista previa del pedido al proveedor */}
      {showPreview && hayProveedor && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:800,
          display:"grid", placeItems:"center", padding:16 }} onClick={() => setShowPreview(false)}>
          <div style={{ background:C.surface, borderRadius:16, width:"100%", maxWidth:860,
            maxHeight:"92vh", display:"flex", flexDirection:"column", boxShadow:"0 20px 60px rgba(0,0,0,.3)" }}
            onClick={e => e.stopPropagation()}>
            {/* Header del modal */}
            <div style={{ padding:"12px 18px", borderBottom:`1px solid ${C.line}`,
              display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
              <Eye size={17} color={C.brand}/>
              <div style={{ flex:1, fontWeight:700, fontSize:15 }}>
                Vista previa · {gruposProveedor.length > 1
                  ? `Pedido a ${gruposProveedor.length} proveedores`
                  : `Pedido a ${proveedorActivo?.nombre || gruposProveedor[0]?.proveedor?.nombre || "proveedor"}`}
              </div>
              <button onClick={exportarPedidoProveedorExcel}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:8,
                  border:`1px solid ${C.strong}`, background:C.s2, color:C.ink,
                  fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                <Download size={13} color="#16a34a"/>Excel
              </button>
              <button onClick={exportarPedidoProveedorPDF}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:8,
                  border:"none", background: proveedorActivo?.color || C.brand, color:"#fff",
                  fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                <FileText size={13}/>Imprimir / PDF
              </button>
              <button onClick={() => setShowPreview(false)}
                style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, padding:4, display:"flex" }}>
                <X size={17}/>
              </button>
            </div>
            {/* Cuerpo: documento en blanco como en papel */}
            <div style={{ flex:1, overflowY:"auto", padding:24, background:"#e9eaec" }}>
              <div style={{ background:"#fff", borderRadius:8, padding:"28px 32px",
                boxShadow:"0 2px 16px rgba(0,0,0,.12)" }}
                dangerouslySetInnerHTML={{ __html: pedidoProveedorHTML(false) }}/>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ICON_BTN = {
  width:26, height:26, borderRadius:6, border:`1px solid var(--border-strong)`,
  background:"var(--surface-2)", color:"var(--text)", cursor:"pointer",
  display:"flex", alignItems:"center", justifyContent:"center",
};
