// MARK: - Constantes (ROLES_DEFECTO, DEFAULT_VEHICULOS_EMPRESA, TABS)
// MARK: - AvisoPortal
// MARK: - SinConfig
// MARK: - App [export default]
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  CalendarDays, RotateCcw, Warehouse, Settings,
  Sun, Moon, Globe, Loader, ArrowRight,
  Building2, ShoppingBag, ClipboardList, ChevronDown,
} from "lucide-react";
import { LangContext, IDIOMAS } from "./lib/i18n.js";
import { sb, supabaseConfigurado } from "./lib/supabase.js";
import {
  cargarDatos, crearConfigInicial, cargarPrefs, guardarPrefs, guardarPedido, guardarTramos, registrarVistoPor, cargarMiembros, marcarIASinTokens,
} from "./lib/data.js";
import { C, Badge, Btn } from "./lib/ui.jsx";
import TabAlmacen from "./TabAlmacen.jsx";
import TabPedidos from "./TabPedidos.jsx";
import TabPlanning from "./TabPlanning.jsx";
import TabRetorno from "./TabRetorno.jsx";
import TabConfig from "./TabConfig.jsx";
import TabInventario from "./TabInventario.jsx";
import TabFlota from "./TabFlota.jsx";
import TabEtiquetas from "./TabEtiquetas.jsx";
import TabCesta from "./TabCesta.jsx";
import TabDistribuidor from "./TabDistribuidor.jsx";
import { ChatBase, BellButton, PresenceAvatars, leerCmdDeUrl, crearNotificacion as crearNotifEvento, serializarToken } from "@scale/shared/chat";
import { cargarApps, crearResolveAppUrl } from "@scale/shared/registry";
import { Package, Shield, ClipboardCheck, Truck, Tag, ShoppingCart } from "lucide-react";
import AppLauncher from "./AppLauncher.jsx";
import { ToastContainer, PanelAlertasStock, crearNotificacion } from "./StockNotificaciones.jsx";

// MARK: - Constantes (ROLES_DEFECTO, DEFAULT_VEHICULOS_EMPRESA, TABS)
export const ROLES_DEFECTO = [
  { key:"colComentario",  label:"Comentario",      color:"#0891b2", req:false, tipo:"descripcion" },
  { key:"colCentroCoste", label:"Centro de coste",  color:"#be185d", req:false, tipo:"columna"     },
  { key:"colPeso",        label:"Peso",             color:"#65a30d", req:false, tipo:"columna"     },
  { key:"colIdProducto",  label:"ID Producto",      color:"#7c3aed", req:false, tipo:"columna"     },
];

const DEFAULT_ALMACENES = [
  { id: 1, nombre: "Almacén 1", startRow: 6 },
  { id: 2, nombre: "Almacén 2", startRow: 6 },
  { id: 3, nombre: "Almacén 3", startRow: 6 },
];

const DEFAULT_VEHICULOS_EMPRESA = [
  { id: 1, nombre: "Conductor 1", dni: "", modelo: "Mercedes Sprinter", tipo: "Furgoneta", matricula: "1234 ABC", color: "#3b82f6" },
  { id: 2, nombre: "Conductor 2", dni: "", modelo: "Iveco Daily",       tipo: "Furgoneta", matricula: "5678 XYZ", color: "#f59e0b" },
  { id: 3, nombre: "Conductor 3", dni: "", modelo: "Renault Master",    tipo: "Camión",    matricula: "9012 DEF", color: "#10b981" },
];

const NAV = [
  { id: "cesta", label: "Cesta", Icon: ShoppingCart },
  {
    label: "Gestión", Icon: Warehouse,
    items: [
      { id: "distribuidor", label: "Proveedores", Icon: Building2      },
      { id: "almacen",      label: "Almacén",      Icon: Warehouse      },
      // Inventario ya no va en la barra: es un botón dentro del header de Almacén.
    ],
  },
  {
    label: "Distribución", Icon: ClipboardList,
    items: [
      { id: "pedido",    label: "Pedidos",         Icon: ClipboardList },
      // Etiquetas ya no va en la barra: es un botón dentro del detalle de cada pedido.
      { id: "planning",  label: "Planning",        Icon: CalendarDays  },
      { id: "retorno",   label: "Retorno/Cierre",  Icon: RotateCcw     },
    ],
  },
  { id: "flota",  label: "Flota",          Icon: Truck    },
  // Configuración ya no va en la barra de pestañas: es la tuerca junto a la campana.
];

// Lista plana de pestañas derivada de NAV (aplana los grupos con `items`).
// El topbar la usa para renderizar todas las pestañas en línea.
const TABS = NAV.flatMap(n => n.items ? n.items : [n]);

// MARK: - AvisoPortal
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

// MARK: - SinConfig
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
   APP PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */
// MARK: - App [export default]
export default function App() {
  const [lang,  setLang]  = useState(() => localStorage.getItem("scale.lang")  || "es");
  const [tema,  setTema]  = useState(() => localStorage.getItem("scale.theme") || "light");
  const [tab,   setTab]   = useState("almacen");
  const [planningFecha, setPlanningFecha] = useState(null);
  const [etiquetaPedido, setEtiquetaPedido] = useState(null); // pedido preseleccionado al abrir Etiquetas desde un pedido
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
  const [myRol,             setMyRol]             = useState("owner");
  const [nivelApp,          setNivelApp]          = useState(null); // ver | editar | admin | null (sin restricción)
  const [formatoFecha,      setFormatoFecha]      = useState("DD/MM/YYYY");
  const [miembros,          setMiembros]          = useState([]);
  const [chatUnread,        setChatUnread]        = useState(0);
  const [highlightedPedido, setHighlightedPedido] = useState(null);
  const [cesta,        setCesta]        = useState([]);
  const [toasts,       setToasts]       = useState([]);
  const [silenciados,  setSilenciados]  = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("lscale.silenciados") || "[]")); }
    catch { return new Set(); }
  });
  const chatRef = useRef();
  const [resolveAppUrl, setResolveAppUrl] = useState(() => () => null);

  const agregarACesta = useCallback((items) => {
    // Resuelve el almacén de un item: si ya trae almacen_id lo respeta; si no,
    // y el material existe en un único almacén, lo autoasigna. Si no se puede
    // determinar, queda null y TabCesta lo pedirá con un selector inline.
    const resolverAlmacen = (item) => {
      if (item.almacen_id != null) return item;
      const nom = (item.nombre || "").trim().toLowerCase();
      const candidatos = materiales.filter(m =>
        (item.material_id != null && m.id === item.material_id) ||
        (m.nombre || "").trim().toLowerCase() === nom
      );
      const almacenesUnicos = [...new Set(candidatos.map(m => m.almacen_id).filter(a => a != null))];
      if (almacenesUnicos.length === 1) {
        const mat = candidatos.find(m => m.almacen_id === almacenesUnicos[0]);
        return { ...item, almacen_id: almacenesUnicos[0], material_id: item.material_id ?? mat?.id ?? null };
      }
      return item;
    };

    setCesta(prev => {
      const next = [...prev];
      for (const raw of items) {
        const item = resolverAlmacen(raw);
        // Dedup por material_id; si no hay, por (almacen_id + nombre)
        const idx = next.findIndex(i =>
          item.material_id != null
            ? i.material_id === item.material_id
            : (i.nombre === item.nombre && (i.almacen_id ?? null) === (item.almacen_id ?? null))
        );
        if (idx >= 0) {
          next[idx] = {
            ...next[idx],
            cantidad: next[idx].cantidad + item.cantidad,
            faltante: (next[idx].faltante || 0) + (item.faltante || 0),
          };
        } else {
          next.push(item);
        }
      }
      return next;
    });
  }, [materiales]);

  const notificarStock = useCallback((pedido, matSnapshot, tipo = "pedido") => {
    const n = crearNotificacion(pedido, matSnapshot, tipo);
    setToasts(prev => [...prev.slice(-4), n]); // max 5 toasts
  }, []);

  const silenciarAlerta = useCallback((matId) => {
    setSilenciados(prev => {
      const next = new Set(prev);
      next.add(String(matId));
      localStorage.setItem("lscale.silenciados", JSON.stringify([...next]));
      return next;
    });
  }, []);

  const handlePedidoRef = useCallback((codigo, categoria) => {
    // codigo puede ser "OA_00200", categoria puede ser "Cristalería" o null
    const p = pedidos.find(p => (p.codigo || p.referencia || "").toUpperCase() === codigo.toUpperCase());
    setTab("pedido");
    if (p) {
      setHighlightedPedido({ id: p.id, categoria: categoria || null });
      setTimeout(() => setHighlightedPedido(null), 8000);
    }
  }, [pedidos]);

  // Comandos del chat propios de L-Scale: /pedido y #categoría
  const comandosChat = useMemo(() => [
    {
      tipo: "pedido", trigger: "/",
      sugerencias: (q) => (pedidos || [])
        .filter(p => {
          const cod = (p.codigo || p.referencia || "").toUpperCase();
          return q ? cod.startsWith(q.toUpperCase()) : !!cod;
        })
        .slice(0, 5)
        .map(p => ({ valor: p.codigo || p.referencia, label: p.codigo || p.referencia, sub: p.nombre || p.destino || "—" })),
      ejecutar: (codigo) => handlePedidoRef(codigo, null),
    },
    {
      tipo: "categoria", trigger: "#",
      sugerencias: (q) => [...new Set((materiales || []).map(m => (m.categoria || "").trim()).filter(Boolean))]
        .filter(c => c.toLowerCase().includes(q.toLowerCase()))
        .sort().slice(0, 8)
        .map(c => ({ valor: c, label: c })),
      ejecutar: () => setTab("almacen"),
    },
  ], [pedidos, materiales, handlePedidoRef]);

  // Deep-link de entrada: si vengo de otra app con ?cmd=, ejecutar el comando
  useEffect(() => {
    if (!pedidos.length && !materiales.length) return;  // esperar a tener datos
    const cmd = leerCmdDeUrl();
    if (!cmd) return;
    const c = comandosChat.find(x => x.trigger === cmd.trigger);
    c?.ejecutar?.(cmd.valor);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidos.length, materiales.length]);

  // Cargar catálogo de apps para resolver deep-links cross-app
  useEffect(() => {
    cargarApps(sb()).then(apps => {
      setResolveAppUrl(() => crearResolveAppUrl(apps, { dev: import.meta.env?.DEV }));
    });
  }, []);

  // Notifica a la empresa un evento de L-Scale (pedido/compra/retorno creado).
  // Aparece en la campanita de todas las apps. tipo: 'pedido'|'compra'|'retorno'.
  const notificarEvento = useCallback((tipo, titulo, recursoLabel, codigo) => {
    if (modo !== "supabase" || !empresa?.id) return;
    const nombre = sesion?.user?.email?.split("@")[0]?.replace(/[._]/g, " ") || "Alguien";
    crearNotifEvento(sb(), {
      companyId: empresa.id,
      actorId: sesion?.user?.id ?? null,
      actorNombre: nombre,
      appId: "lscale",
      tipo,
      titulo,
      recursoLabel: recursoLabel || null,
      cmd: codigo ? `s.${String(codigo).trim().replace(/\s+/g, "~")}` : null,
    }).catch(() => {});
  }, [modo, empresa?.id, sesion?.user?.id, sesion?.user?.email]);

  // Evento de L-Scale pulsado en el feed de la campanita → abrir el pedido.
  const onEventoLocal = useCallback(({ valor, tipo }) => {
    if (tipo === "pedido" || tipo === "compra" || tipo === "retorno") {
      handlePedidoRef(valor, null);
    }
  }, [handlePedidoRef]);

  const tramosIniciales = useMemo(() => {
    const r = {};
    for (const e of expediciones) {
      if (e.pedido_id && Array.isArray(e.tramos)) r[String(e.pedido_id)] = e.tramos;
    }
    return r;
  }, [expediciones]);

  // Carga miembros de la empresa (para panel de empresa y chat)
  useEffect(() => {
    if (!empresa?.id || modo !== "supabase") return;
    cargarMiembros(empresa.id).then(setMiembros);
  }, [empresa?.id, modo]);

  // Prefs en modo supabase: ya se cargan en cargar() desde cargarDatos().
  // En modo demo/local: cargamos desde localStorage.
  useEffect(() => {
    if (!empresa?.id || modo === "supabase") return;
    try { const v = JSON.parse(localStorage.getItem(`lscale.almacenes.${empresa.id}`)); if (Array.isArray(v) && v.length) setAlmacenes(v); } catch {}
    try { const v = JSON.parse(localStorage.getItem(`lscale.vehiculos.${empresa.id}`)); if (Array.isArray(v) && v.length) setVehiculosEmpresa(v); } catch {}
    try { const v = JSON.parse(localStorage.getItem(`lscale.roles.${empresa.id}`)); if (Array.isArray(v) && v.length) setRolesImport(v); } catch {}
    try { const v = localStorage.getItem(`lscale.formatoFecha.${empresa.id}`); if (v) setFormatoFecha(v); } catch {}
  }, [empresa?.id, modo]);

  const guardarAlmacenes = async (list) => {
    setAlmacenes(list);
    if (!empresa?.id) return;
    if (modo === "supabase") await guardarPrefs(empresa.id, { almacenes: list });
    else localStorage.setItem(`lscale.almacenes.${empresa.id}`, JSON.stringify(list));
  };

  const guardarVehiculos = async (list) => {
    setVehiculosEmpresa(list);
    if (!empresa?.id) return;
    if (modo === "supabase") await guardarPrefs(empresa.id, { vehiculos: list });
    else localStorage.setItem(`lscale.vehiculos.${empresa.id}`, JSON.stringify(list));
  };

  const guardarRoles = async (list) => {
    setRolesImport(list);
    if (!empresa?.id) return;
    if (modo === "supabase") await guardarPrefs(empresa.id, { roles: list });
    else localStorage.setItem(`lscale.roles.${empresa.id}`, JSON.stringify(list));
  };

  const guardarFormatoFecha = async (fmt) => {
    setFormatoFecha(fmt);
    if (!empresa?.id) return;
    if (modo === "supabase") await guardarPrefs(empresa.id, { formatoFecha: fmt });
    else localStorage.setItem(`lscale.formatoFecha.${empresa.id}`, fmt);
  };

  // Plantillas de configurador de importación — se guardan en Supabase o localStorage
  const lsKeyPlant = (tipo, almacenId) => `lscale.${tipo}.${empresa?.id}.${almacenId}`;
  const cargarPlantillasConf = useCallback((tipo, almacenId) => {
    try { return JSON.parse(localStorage.getItem(lsKeyPlant(tipo, almacenId))) || []; }
    catch { return []; }
  }, [empresa?.id]);

  const guardarPlantillaConf = useCallback(async (tipo, almacenId, plantilla) => {
    const key   = lsKeyPlant(tipo, almacenId);
    const lista = (() => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } })();
    const idx   = lista.findIndex(p => p.nombre === plantilla.nombre);
    if (idx >= 0) lista[idx] = plantilla; else lista.push(plantilla);
    localStorage.setItem(key, JSON.stringify(lista));
    if (modo === "supabase" && empresa?.id) {
      const patchKey = `plantillas_${tipo}_${almacenId}`;
      try { await guardarPrefs(empresa.id, { [patchKey]: lista }); }
      catch (e) { console.warn("[L-Scale] guardarPlantillaConf supabase:", e?.message); }
    }
    return lista;
  }, [modo, empresa?.id]);

  // Plantillas de etiquetas — compartidas por toda la organización (Supabase)
  const [plantillasEtiquetas, setPlantillasEtiquetas] = useState([]);
  const guardarPlantillasEtiquetas = useCallback(async (lista) => {
    setPlantillasEtiquetas(lista);
    if (modo === "supabase" && empresa?.id) {
      try { await guardarPrefs(empresa.id, { plantillas_etiquetas: lista }); }
      catch (e) { console.warn("[L-Scale] guardarPlantillasEtiquetas:", e?.message); }
    } else {
      try { localStorage.setItem("lscale.etiquetas.plantillas", JSON.stringify(lista)); } catch {}
    }
  }, [modo, empresa?.id]);

  // Columnas del Excel de la cesta — compartidas por la organización (Supabase)
  const [cestaCols, setCestaCols] = useState(null);
  const guardarCestaCols = useCallback(async (cols) => {
    setCestaCols(cols);
    if (modo === "supabase" && empresa?.id) {
      try { await guardarPrefs(empresa.id, { cesta_columnas: cols }); }
      catch (e) { console.warn("[L-Scale] guardarCestaCols:", e?.message); }
    } else {
      try { localStorage.setItem("lscale.cesta.columnas", JSON.stringify(cols)); } catch {}
    }
  }, [modo, empresa?.id]);


  useEffect(() => { document.documentElement.setAttribute("data-theme", tema); }, [tema]);

  const toggleTema = () => {
    const next = tema === "dark" ? "light" : "dark";
    setTema(next); localStorage.setItem("scale.theme", next);
  };

  const cambiarLang = () => {
    const idx  = IDIOMAS.findIndex((x) => x.id === lang);
    const next = IDIOMAS[(idx + 1) % IDIOMAS.length].id;
    setLang(next); localStorage.setItem("scale.lang", next);
  };

  // Permisos derivados de rol + nivelApp
  // nivelApp null = sin restricción → mismos permisos que admin
  const esAdmin = myRol === "owner" || myRol === "admin";
  const puedeEditar = esAdmin || nivelApp === "editar" || nivelApp === "admin" || nivelApp === null;
  const puedeAdmin  = esAdmin || nivelApp === "admin"  || nivelApp === null;

  useEffect(() => {
    if (!supabaseConfigurado) { setSesion(null); return; }
    sb().auth.getSession().then(({ data: { session } }) => setSesion(session));
    const { data: { subscription } } = sb().auth.onAuthStateChange((_ev, s) => setSesion(s));
    return () => subscription.unsubscribe();
  }, []);

  const cargar = useCallback(async () => {
    setCarga(true);
    const res = await cargarDatos();
    setModo(res.modo);
    setEmpresa(res.empresas?.[0] || null);
    setMateriales(res.materiales || []);
    setPedidos(res.pedidos || []);
    setExpediciones(res.expediciones || []);
    setMyRol(res.rol ?? "owner");
    setNivelApp(res.nivelApp ?? null);
    // Aplicar prefs ya cargadas (evita segundo round-trip a Supabase)
    if (res.prefs) {
      if (Array.isArray(res.prefs.almacenes) && res.prefs.almacenes.length) setAlmacenes(res.prefs.almacenes);
      if (Array.isArray(res.prefs.vehiculos) && res.prefs.vehiculos.length) setVehiculosEmpresa(res.prefs.vehiculos);
      if (Array.isArray(res.prefs.roles)     && res.prefs.roles.length)     setRolesImport(res.prefs.roles);
      if (res.prefs.formatoFecha) setFormatoFecha(res.prefs.formatoFecha);
      // Plantillas de etiquetas (compartidas por la organización)
      if (Array.isArray(res.prefs.plantillas_etiquetas)) {
        setPlantillasEtiquetas(res.prefs.plantillas_etiquetas);
      } else {
        // Fallback: migrar plantillas previas que quedaron en localStorage
        try {
          const prev = JSON.parse(localStorage.getItem("lscale.etiquetas.plantillas"));
          if (Array.isArray(prev) && prev.length) setPlantillasEtiquetas(prev);
        } catch {}
      }
      // Columnas de la cesta (compartidas por la organización)
      if (Array.isArray(res.prefs.cesta_columnas)) {
        setCestaCols(res.prefs.cesta_columnas);
      } else {
        try {
          const prev = JSON.parse(localStorage.getItem("lscale.cesta.columnas"));
          if (Array.isArray(prev) && prev.length) setCestaCols(prev);
        } catch {}
      }
      // Hidratar plantillas en localStorage para que los configuradores las lean al abrir
      const empId = res.empresas?.[0]?.id;
      if (empId) {
        for (const [k, v] of Object.entries(res.prefs)) {
          if (k.startsWith("plantillas_") && Array.isArray(v)) {
            const parts = k.split("_"); // plantillas_pedconf_<almId> | plantillas_almconf_<almId> | plantillas_export_<almId>
            const tipo = parts[1]; const almId = parts.slice(2).join("_");
            // Plantillas de exportación usan la clave lscale.export_tpl.<emp>.<alm>
            const lsKey = tipo === "export"
              ? `lscale.export_tpl.${empId}.${almId}`
              : `lscale.${tipo}.${empId}.${almId}`;
            localStorage.setItem(lsKey, JSON.stringify(v));
          }
        }
      }
    }
    setCarga(false);
  }, []);

  useEffect(() => { if (sesion !== undefined) cargar(); }, [sesion, cargar]);

  const L = (es, en, ca) => {
    if (lang === "ca") return ca ?? es;
    if (lang === "en") return en ?? es;
    return es;
  };

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
    const PORTAL = import.meta.env?.VITE_PORTAL_URL || "http://localhost:3000";
    window.location.replace(`${PORTAL}/login?returnUrl=${encodeURIComponent(window.location.href)}`);
    return null;
  }
  if (modo === "sin_empresa")   return <LangContext.Provider value={lang}><AvisoPortal tipo="sin_empresa"   L={L}/></LangContext.Provider>;
  if (modo === "no_contratado") return <LangContext.Provider value={lang}><AvisoPortal tipo="no_contratado" L={L}/></LangContext.Provider>;
  if (modo === "sin_acceso")    return <LangContext.Provider value={lang}><AvisoPortal tipo="sin_acceso"    L={L}/></LangContext.Provider>;
  if (modo === "sin_config")    return <LangContext.Provider value={lang}><SinConfig empresa={empresa} onDone={cargar} L={L}/></LangContext.Provider>;

  return (
    <LangContext.Provider value={lang}>
      <div style={{ height:"100vh", display:"flex", flexDirection:"column", background:C.bg, fontFamily:"var(--font-body)" }}>

        {/* Topbar */}
        <div style={{ height:52, background:C.surface, borderBottom:`1px solid ${C.line}`, display:"flex", alignItems:"center", padding:"0 16px", gap:8, flexShrink:0, zIndex:100 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginRight:8 }}>
            <img src="/scale-iso.png" alt="SCALE" style={{ height:28, width:"auto", display:"block" }}/>
            <span style={{ fontWeight:700, fontSize:15.5 }}>L-scale</span>
            {modo === "demo" && <Badge color={C.warnSoft} ink={C.warn} size={10}>DEMO</Badge>}
          </div>

          <div style={{ display:"flex", gap:2, flex:1, overflowX:"auto" }}>
            {TABS.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:8, border:"none",
                  fontWeight: tab === id ? 600 : 400, fontSize:13.5, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap",
                  background: tab === id ? C.brandSoft : "transparent", color: tab === id ? C.brand : C.sub, transition:"background .15s",
                  position:"relative" }}>
                <Icon size={15}/>{label}
                {id === "cesta" && cesta.length > 0 && (
                  <span style={{ minWidth:16, height:16, borderRadius:999, background:"#ef4444", color:"#fff",
                    fontSize:9, fontWeight:800, display:"grid", placeItems:"center", padding:"0 4px", lineHeight:1 }}>
                    {cesta.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:6, marginLeft:"auto" }}>
            {/* Quién está conectado ahora (cross-app) + campana de mensajes */}
            {supabaseConfigurado && empresa?.id && sesion?.user && (
              <PresenceAvatars sb={sb()} companyId={empresa.id} currentUser={sesion.user} appId="lscale" />
            )}
            {supabaseConfigurado && empresa?.id && (
              <BellButton unread={chatUnread} onClick={() => chatRef.current?.openPanel()} title={L("Mensajes","Messages")} />
            )}
            <button onClick={() => setTab("config")} title={L("Configuración","Settings")}
              style={{ background: tab === "config" ? C.brandSoft : "none", border:"none", cursor:"pointer",
                color: tab === "config" ? C.brand : C.sub, padding:6, borderRadius:8, display:"flex" }}>
              <Settings size={16}/>
            </button>
            <AppLauncher empresa={empresa} currentAppId="lscale" />
            <button onClick={cambiarLang} title={L("Cambiar idioma","Change language")} style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, padding:6, borderRadius:8, display:"flex" }}><Globe size={16}/></button>
            <button onClick={toggleTema} title={L("Cambiar tema","Toggle theme")} style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, padding:6, borderRadius:8, display:"flex" }}>
              {tema === "dark" ? <Sun size={16}/> : <Moon size={16}/>}
            </button>
            {sesion?.user?.email && (() => {
              const email = sesion.user.email;
              const nombre = email.split("@")[0].split(".")[0];
              const inicial = nombre[0].toUpperCase();
              return (
                <div title={email} style={{ display:"flex", alignItems:"center", gap:7, padding:"3px 8px 3px 4px",
                  borderRadius:999, background:C.brandSoft, border:`1px solid ${C.brand}20` }}>
                  <div style={{ width:24, height:24, borderRadius:999, background:C.brand, color:"#fff",
                    display:"grid", placeItems:"center", fontSize:11, fontWeight:700, flexShrink:0 }}>
                    {inicial}
                  </div>
                  <span style={{ fontSize:12, color:C.brand, fontWeight:600, maxWidth:120,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {nombre}
                  </span>
                  {nivelApp && (
                    <span style={{ fontSize:9.5, fontWeight:700, padding:"1px 6px", borderRadius:999,
                      background: nivelApp === "ver" ? C.warnSoft : C.okSoft,
                      color: nivelApp === "ver" ? C.warn : C.ok,
                      textTransform:"uppercase", letterSpacing:"0.05em" }}>
                      {nivelApp}
                    </span>
                  )}
                </div>
              );
            })()}
            {supabaseConfigurado && (
              <button onClick={() => sb().auth.signOut()} title={L("Cerrar sesión","Sign out")} style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, padding:6, borderRadius:8, display:"flex", fontSize:12 }}>
                {L("Salir","Out")}
              </button>
            )}
          </div>
        </div>

        {/* Panel alertas stock bajo mínimo — visible en tab almacén */}
        {tab === "almacen" && (
          <PanelAlertasStock
            materiales={materiales}
            silenciados={silenciados}
            onSilenciar={silenciarAlerta}/>
        )}

        {/* Contenido */}
        <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column", minHeight:0 }}>
          {tab === "almacen"  && <TabAlmacen  materiales={materiales} setMateriales={setMateriales} empresa={empresa} modo={modo} almacenes={almacenes} silenciados={silenciados}
            puedeEditar={puedeEditar}
            onInventario={() => setTab("inventario")}
            guardarPlantillaConf={(almId, pl) => guardarPlantillaConf("almconf", almId, pl)}
            cargarPlantillasConf={(almId) => cargarPlantillasConf("almconf", almId)} L={L}/>}
          {tab === "pedido"   && <TabPedidos  almacenes={almacenes} empresa={empresa} modo={modo} pedidos={pedidos} setPedidos={setPedidos} materiales={materiales} setMateriales={setMateriales} vehiculosEmpresa={vehiculosEmpresa} rolesImport={rolesImport} formatoFecha={formatoFecha} sesion={sesion} highlightedPedidoId={highlightedPedido?.id ?? highlightedPedido}
            highlightedCategoria={highlightedPedido?.categoria ?? null}
            puedeEditar={puedeEditar}
            onPlanning={(p) => { setPlanningFecha(p?.fecha_entrega || null); setTab("planning"); }}
            onEtiquetas={(p) => { setEtiquetaPedido(p?.id ?? null); setTab("etiquetas"); }}
            onNotificarStock={notificarStock}
            onAgregarCesta={agregarACesta}
            guardarPlantillaConf={(almId, pl) => guardarPlantillaConf("pedconf", almId, pl)}
            cargarPlantillasConf={(almId) => cargarPlantillasConf("pedconf", almId)}
            onRegistrarVisto={async (pid) => {
              if (modo === "supabase" && sesion?.user) {
                const nombre = sesion.user.email.split("@")[0].split(".")[0];
                await registrarVistoPor(pid, sesion.user.id, nombre);
              }
            }}
            onNotificarEvento={notificarEvento}/>}
          {tab === "planning" && <TabPlanning pedidos={pedidos} setPedidos={setPedidos} vehiculosEmpresa={vehiculosEmpresa} formatoFecha={formatoFecha}
            materiales={materiales} almacenes={almacenes}
            puedeEditar={puedeEditar}
            initialFecha={planningFecha}
            onSavePedido={async p => { if (modo === "supabase" && empresa?.id) await guardarPedido(p, empresa.id); }}
            tramosIniciales={tramosIniciales}
            onSaveTramos={async (pid, tramos) => { if (modo === "supabase" && empresa?.id) await guardarTramos(pid, tramos, empresa.id); }}/>}
          {tab === "inventario" && <TabInventario materiales={materiales} setMateriales={setMateriales} empresa={empresa} modo={modo} almacenes={almacenes} sesion={sesion} pedidos={pedidos} puedeEditar={puedeEditar} onVolver={() => setTab("almacen")} L={L}/>}
          {tab === "retorno"  && <TabRetorno  pedidos={pedidos} setPedidos={setPedidos} vehiculosEmpresa={vehiculosEmpresa} formatoFecha={formatoFecha}
            materiales={materiales} setMateriales={setMateriales} modo={modo} empresa={empresa}
            puedeEditar={puedeEditar}
            onNotificarStock={notificarStock}
            onNotificarEvento={notificarEvento}
            onSavePedido={async p => { if (modo === "supabase" && empresa?.id) await guardarPedido(p, empresa.id); }} L={L}/>}
          {tab === "flota"     && <TabFlota pedidos={pedidos} vehiculosEmpresa={vehiculosEmpresa} empresa={empresa} formatoFecha={formatoFecha} L={L}/>}
          {tab === "etiquetas" && <TabEtiquetas pedidos={pedidos} plantillas={plantillasEtiquetas} onGuardarPlantillas={guardarPlantillasEtiquetas}
            pedidoInicial={etiquetaPedido}
            onVolver={() => { setEtiquetaPedido(null); setTab("pedido"); }} L={L}/>}
          {tab === "cesta"     && <TabCesta cesta={cesta} setCesta={setCesta} materiales={materiales} setMateriales={setMateriales} almacenes={almacenes} modo={modo} empresa={empresa} sesion={sesion} colsIniciales={cestaCols} onGuardarCols={guardarCestaCols} onNotificarEvento={notificarEvento} L={L}/>}
          {tab === "distribuidor" && <TabDistribuidor empresa={empresa} materiales={materiales}/>}
          {tab === "config"   && <TabConfig   empresa={empresa} modo={modo} almacenes={almacenes} guardarAlmacenes={guardarAlmacenes} vehiculosEmpresa={vehiculosEmpresa} guardarVehiculos={guardarVehiculos} rolesImport={rolesImport} guardarRoles={guardarRoles} formatoFecha={formatoFecha} guardarFormatoFecha={guardarFormatoFecha} isAdmin={puedeAdmin} miembros={miembros} onEnviarMensaje={(user) => chatRef.current?.openConversation(user)} portalUrl={import.meta.env?.VITE_PORTAL_URL || "http://localhost:3000"} L={L}/>}
        </div>

        {/* Chat flotante cross-app (paquete @scale/shared) */}
        {supabaseConfigurado && empresa?.id && sesion?.user && (
          <ChatBase
            ref={chatRef}
            sb={sb()}
            appId="lscale"
            empresa={empresa}
            currentUser={sesion.user}
            miembros={miembros}
            comandos={comandosChat}
            resolveAppUrl={resolveAppUrl}
            onUnreadChange={setChatUnread}
            onEventoLocal={onEventoLocal}
            ia={{
              enabled: empresa?.flags?.funciones?.asistenteIA_lscale !== false
                && !((empresa?.flags?.ai?.usuariosOff?.[sesion?.user?.id] || []).includes("*")),
              provider: empresa.aiProvider, keys: empresa.aiKeys || {}, orden: empresa?.flags?.ai?.orden,
              onFallback: ({ desde }) => { if (desde) marcarIASinTokens(empresa?.id, desde); },
              system: "Eres el asistente de L-Scale, app de logística de eventos (almacén, pedidos, expediciones, planning de vehículos). Conoces la actividad reciente del equipo. Ayuda al usuario respondiendo dudas sobre la app y la logística, y resumiendo lo que ha pasado. Responde en español, breve y claro.",
              prompts: [
                "Resume la actividad reciente de mi equipo",
                "¿Qué pedidos o eventos nuevos hay?",
                "¿Tengo mensajes pendientes importantes?",
              ],
            }}
          />
        )}

        {/* Toasts de stock */}
        <ToastContainer
          notificaciones={toasts}
          onDismiss={id => setToasts(prev => prev.filter(n => n.id !== id))}/>
      </div>
    </LangContext.Provider>
  );
}
