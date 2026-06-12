// MARK: - Constantes (ROLES_DEFECTO, DEFAULT_VEHICULOS_EMPRESA, TABS)
// MARK: - AvisoPortal
// MARK: - SinConfig
// MARK: - App [export default]
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  CalendarDays, RotateCcw, Warehouse, Settings,
  Sun, Moon, Globe, Loader, ArrowRight,
  Building2, ShoppingBag, ClipboardList, Bell,
} from "lucide-react";
import { LangContext, IDIOMAS } from "./lib/i18n.js";
import { sb, supabaseConfigurado } from "./lib/supabase.js";
import {
  cargarDatos, crearConfigInicial, cargarPrefs, guardarPrefs, guardarPedido, guardarTramos, registrarVistoPor, cargarMiembros,
} from "./lib/data.js";
import { C, Badge, Btn } from "./lib/ui.jsx";
import Login from "./Login.jsx";
import TabAlmacen from "./TabAlmacen.jsx";
import TabPedidos from "./TabPedidos.jsx";
import TabPlanning from "./TabPlanning.jsx";
import TabRetorno from "./TabRetorno.jsx";
import TabConfig from "./TabConfig.jsx";
import TabInventario from "./TabInventario.jsx";
import TabSimulacro from "./TabSimulacro.jsx";
import ChatFloat from "./ChatFloat.jsx";
import { Package, Shield, ClipboardCheck, FlaskConical } from "lucide-react";
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

const TABS = [
  { id: "almacen",    label: "Almacén",        Icon: Warehouse      },
  { id: "inventario", label: "Inventario",      Icon: ClipboardCheck },
  { id: "pedido",     label: "Pedidos",         Icon: ClipboardList  },
  { id: "planning",   label: "Planning",        Icon: CalendarDays   },
  { id: "retorno",    label: "Retorno/Cierre",  Icon: RotateCcw      },
  { id: "simulacro",  label: "Simulacro",       Icon: FlaskConical   },
  { id: "config",     label: "Config",          Icon: Settings       },
];

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
  const [formatoFecha,      setFormatoFecha]      = useState("DD/MM/YYYY");
  const [miembros,          setMiembros]          = useState([]);
  const [chatUnread,        setChatUnread]        = useState(0);
  const [highlightedPedido, setHighlightedPedido] = useState(null);
  const [toasts,       setToasts]       = useState([]);
  const [silenciados,  setSilenciados]  = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("lscale.silenciados") || "[]")); }
    catch { return new Set(); }
  });
  const chatRef = useRef();

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

  // Cargar plantillas desde Supabase al iniciar (hidrata localStorage)
  useEffect(() => {
    if (modo !== "supabase" || !empresa?.id) return;
    // Las prefs ya fueron cargadas en cargarDatos(); extraer plantillas de prefs y
    // sincronizar localStorage para que los configuradores las lean al abrir.
    const sincronizar = async () => {
      try {
        const { cargarPrefs: _cp } = await import("./lib/data.js");
        const prefs = await _cp(empresa.id);
        if (!prefs) return;
        for (const [k, v] of Object.entries(prefs)) {
          if (k.startsWith("plantillas_") && Array.isArray(v)) {
            // k = plantillas_pedconf_1  o  plantillas_almconf_1
            const parts = k.split("_"); // ['plantillas', tipo, almacenId]
            const tipo = parts[1]; const almId = parts[2];
            const lsKey = `lscale.${tipo}.${empresa.id}.${almId}`;
            localStorage.setItem(lsKey, JSON.stringify(v));
          }
        }
      } catch (e) { console.warn("[L-Scale] sincronizar plantillas:", e?.message); }
    };
    sincronizar();
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
    // Aplicar prefs ya cargadas (evita segundo round-trip a Supabase)
    if (res.prefs) {
      if (Array.isArray(res.prefs.almacenes) && res.prefs.almacenes.length) setAlmacenes(res.prefs.almacenes);
      if (Array.isArray(res.prefs.vehiculos) && res.prefs.vehiculos.length) setVehiculosEmpresa(res.prefs.vehiculos);
      if (Array.isArray(res.prefs.roles)     && res.prefs.roles.length)     setRolesImport(res.prefs.roles);
      if (res.prefs.formatoFecha) setFormatoFecha(res.prefs.formatoFecha);
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
    return <LangContext.Provider value={lang}><Login/></LangContext.Provider>;
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
            <div style={{ width:30, height:30, borderRadius:8, background:C.brand, color:"#fff", display:"grid", placeItems:"center", fontWeight:800, fontSize:15 }}>L</div>
            <span style={{ fontWeight:700, fontSize:15.5 }}>L-scale</span>
            {modo === "demo" && <Badge color={C.warnSoft} ink={C.warn} size={10}>DEMO</Badge>}
          </div>

          <div style={{ display:"flex", gap:2, flex:1, overflowX:"auto" }}>
            {TABS.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:8, border:"none",
                  fontWeight: tab === id ? 600 : 400, fontSize:13.5, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap",
                  background: tab === id ? C.brandSoft : "transparent", color: tab === id ? C.brand : C.sub, transition:"background .15s" }}>
                <Icon size={15}/>{label}
              </button>
            ))}
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:6, marginLeft:"auto" }}>
            {/* Campana de mensajes */}
            {supabaseConfigurado && empresa?.id && (
              <button onClick={() => chatRef.current?.openPanel()}
                title={L("Mensajes","Messages")}
                style={{ position:"relative", background:"none", border:"none", cursor:"pointer", color:C.sub, padding:6, borderRadius:8, display:"flex" }}>
                <Bell size={16}/>
                {chatUnread > 0 && (
                  <span style={{
                    position:"absolute", top:2, right:2,
                    minWidth:15, height:15, borderRadius:999,
                    background:"#ef4444", color:"#fff",
                    fontSize:9, fontWeight:800,
                    display:"grid", placeItems:"center", padding:"0 3px",
                    lineHeight:1,
                  }}>{chatUnread > 9 ? "9+" : chatUnread}</span>
                )}
              </button>
            )}
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
            guardarPlantillaConf={(almId, pl) => guardarPlantillaConf("almconf", almId, pl)}
            cargarPlantillasConf={(almId) => cargarPlantillasConf("almconf", almId)} L={L}/>}
          {tab === "pedido"   && <TabPedidos  almacenes={almacenes} empresa={empresa} modo={modo} pedidos={pedidos} setPedidos={setPedidos} materiales={materiales} setMateriales={setMateriales} vehiculosEmpresa={vehiculosEmpresa} rolesImport={rolesImport} formatoFecha={formatoFecha} sesion={sesion} highlightedPedidoId={highlightedPedido?.id ?? highlightedPedido}
            highlightedCategoria={highlightedPedido?.categoria ?? null}
            onPlanning={() => setTab("planning")}
            onNotificarStock={notificarStock}
            guardarPlantillaConf={(almId, pl) => guardarPlantillaConf("pedconf", almId, pl)}
            cargarPlantillasConf={(almId) => cargarPlantillasConf("pedconf", almId)}
            onRegistrarVisto={async (pid) => {
              if (modo === "supabase" && sesion?.user) {
                const nombre = sesion.user.email.split("@")[0].split(".")[0];
                await registrarVistoPor(pid, sesion.user.id, nombre);
              }
            }}/>}
          {tab === "planning" && <TabPlanning pedidos={pedidos} setPedidos={setPedidos} vehiculosEmpresa={vehiculosEmpresa} formatoFecha={formatoFecha}
            materiales={materiales} almacenes={almacenes}
            onSavePedido={async p => { if (modo === "supabase" && empresa?.id) await guardarPedido(p, empresa.id); }}
            tramosIniciales={tramosIniciales}
            onSaveTramos={async (pid, tramos) => { if (modo === "supabase" && empresa?.id) await guardarTramos(pid, tramos, empresa.id); }}/>}
          {tab === "inventario" && <TabInventario materiales={materiales} setMateriales={setMateriales} empresa={empresa} modo={modo} almacenes={almacenes} sesion={sesion} L={L}/>}
          {tab === "retorno"  && <TabRetorno  pedidos={pedidos} setPedidos={setPedidos} vehiculosEmpresa={vehiculosEmpresa} formatoFecha={formatoFecha}
            materiales={materiales} setMateriales={setMateriales} modo={modo} empresa={empresa}
            onNotificarStock={notificarStock}
            onSavePedido={async p => { if (modo === "supabase" && empresa?.id) await guardarPedido(p, empresa.id); }} L={L}/>}
          {tab === "simulacro" && <TabSimulacro pedidos={pedidos} materiales={materiales} setPedidos={setPedidos} setMateriales={setMateriales} L={L}/>}
          {tab === "config"   && <TabConfig   empresa={empresa} modo={modo} almacenes={almacenes} guardarAlmacenes={guardarAlmacenes} vehiculosEmpresa={vehiculosEmpresa} guardarVehiculos={guardarVehiculos} rolesImport={rolesImport} guardarRoles={guardarRoles} formatoFecha={formatoFecha} guardarFormatoFecha={guardarFormatoFecha} isAdmin={myRol === "owner" || myRol === "admin"} miembros={miembros} onEnviarMensaje={(user) => chatRef.current?.openConversation(user)} L={L}/>}
        </div>

        {/* Chat flotante */}
        {supabaseConfigurado && empresa?.id && sesion?.user && (
          <ChatFloat
            ref={chatRef}
            empresa={empresa}
            miembros={miembros}
            currentUser={sesion.user}
            onUnreadChange={setChatUnread}
            pedidos={pedidos}
            materiales={materiales}
            onPedidoRef={handlePedidoRef}
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
