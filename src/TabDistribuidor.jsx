import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Plus, Trash2, Search, Upload, X, Check, Building2, Edit2, Save, Package, ArrowRight, Loader, RefreshCw, Star, Download, ShoppingBag } from "lucide-react";
import * as XLSX from "xlsx";
import { C, Btn, Help } from "./lib/ui.jsx";
import {
  cargarProveedores, crearProveedor, actualizarProveedor, borrarProveedor,
  cargarCorrelacionesDeProveedor, guardarCorrelacion, borrarCorrelacion,
  cargarItemsDeProveedor, reemplazarItemsProveedor, borrarItemsDeProveedor,
  cargarProveedorPrincipal, guardarProveedorPrincipal,
  guardarCorrelacionesLote,
} from "./lib/data.js";

function norm(s) {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
const COLORES_PROV = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#ec4899"];

// Roles asignables del Excel del proveedor (espejo de columnas del almacén).
// `nombre` es obligatorio; el resto son los campos que ESE proveedor aporta.
const ROLES_WIZARD = [
  { key:"nombre",    label:"Nombre",      color:"#0e7490", req:true  },
  { key:"categoria", label:"Categoría",   color:"#2563eb", req:false },
  { key:"referencia",label:"Referencia",  color:"#7c3aed", req:false },
  { key:"coste",     label:"Coste",       color:"#d97706", req:false },
  { key:"descuento", label:"% Descuento", color:"#ef4444", req:false },
];
// Campos guardados como columna propia de proveedor_items; lo demás iría a datos jsonb.
const COLUMNAS_ITEM = new Set(["nombre","categoria","referencia","coste","descuento"]);

// Datos opcionales del proveedor (van en proveedores.datos jsonb). Se usan como
// destinatario en la cabecera del PDF/Excel de pedido a proveedor (en la Cesta).
const DATOS_PROV = [
  { key:"cif",       label:"CIF / NIF",   ph:"B12345678" },
  { key:"persona",   label:"Persona contacto", ph:"Nombre y apellidos" },
  { key:"telefono",  label:"Teléfono",    ph:"600 000 000" },
  { key:"email",     label:"Email",       ph:"pedidos@proveedor.com" },
  { key:"direccion", label:"Dirección",   ph:"Calle, nº, CP, ciudad" },
  { key:"web",       label:"Web",         ph:"www.proveedor.com" },
];

// ── Constantes del wizard de importación de correlaciones ────────
const MAT_ROLES = [
  { key:"mat_id",         label:"ID",          color:"#64748b", req:false },
  { key:"mat_nombre",     label:"Nombre",       color:"#0e7490", req:true  },
  { key:"mat_referencia", label:"Referencia",   color:"#7c3aed", req:false },
  { key:"mat_categoria",  label:"Categoría",    color:"#2563eb", req:false },
  { key:"mat_ubicacion",  label:"Localización", color:"#059669", req:false },
];
const PROV_SUBROLES = [
  { sub:"nombre",     label:"Nombre"     },
  { sub:"referencia", label:"Referencia" },
  { sub:"coste",      label:"Coste"      },
  { sub:"descuento",  label:"% Desc."    },
];
function parseNumCorr(v) {
  if (v===""||v==null) return null;
  const n = Number(String(v).replace(",",".").replace(/[€$%\s]/g,""));
  return isNaN(n) ? null : n;
}
function encontrarMaterial(fila, colMap, materiales) {
  const str = key => colMap[key]!=null ? String(fila[colMap[key]]??"").trim() : "";
  const idV=str("mat_id"), refV=str("mat_referencia"), nomV=str("mat_nombre");
  if (idV) { const n=Number(idV); if (n>0) { const m=materiales.find(m=>m.id===n); if (m) return m; } }
  if (refV) { const m=materiales.find(m=>m.referencia&&norm(m.referencia)===norm(refV)); if (m) return m; }
  if (nomV) { const q=norm(nomV); const m=materiales.find(m=>norm(m.nombre)===q); if (m) return m; }
  return null;
}

// ══════════════════════════════════════════════════════════════════
// PanelProveedores — lista de empresas suministradoras (Supabase)
// ══════════════════════════════════════════════════════════════════
function PanelProveedores({ proveedores, itemsByProv, principalId, onMarcarPrincipal, onCrear, onEditar, onBorrar, onImportar }) {
  const [nuevo, setNuevo] = useState({ nombre:"", contacto:"" });
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [busy, setBusy] = useState(false);

  async function agregar() {
    if (!nuevo.nombre.trim() || busy) return;
    setBusy(true);
    const color = COLORES_PROV[proveedores.length % COLORES_PROV.length];
    try { await onCrear({ nombre:nuevo.nombre.trim(), contacto:nuevo.contacto.trim(), color }); setNuevo({ nombre:"", contacto:"" }); }
    finally { setBusy(false); }
  }
  async function guardarEdit(id) { await onEditar(id, editData); setEditId(null); }

  return (
    <div style={{ maxWidth:760, margin:"0 auto", padding:24 }}>
      <h3 style={{ fontSize:18, color:C.ink, marginBottom:4 }}>Proveedores</h3>
      <p style={{ fontSize:13, color:C.sub, marginBottom:20 }}>
        Empresas que te suministran material. Crea cada proveedor e importa su catálogo; luego correlacionas tus materiales con los suyos.
      </p>
      <div style={{ display:"flex", gap:8, marginBottom:20, alignItems:"flex-end" }}>
        <div style={{ flex:2 }}>
          <label style={{ fontSize:11, color:C.sub, display:"block", marginBottom:3 }}>Nombre *</label>
          <input value={nuevo.nombre} onChange={e=>setNuevo(n=>({...n,nombre:e.target.value}))}
            onKeyDown={e=>e.key==="Enter"&&agregar()} placeholder="Ej: Eurocatering, Carrefour Pro…"
            style={{ width:"100%", padding:"8px 10px", border:`1px solid ${C.strong}`, borderRadius:8, fontSize:13.5, fontFamily:"inherit", background:C.bg, color:C.ink }}/>
        </div>
        <div style={{ flex:1.5 }}>
          <label style={{ fontSize:11, color:C.sub, display:"block", marginBottom:3 }}>Contacto / Email</label>
          <input value={nuevo.contacto} onChange={e=>setNuevo(n=>({...n,contacto:e.target.value}))}
            onKeyDown={e=>e.key==="Enter"&&agregar()} placeholder="email o teléfono"
            style={{ width:"100%", padding:"8px 10px", border:`1px solid ${C.strong}`, borderRadius:8, fontSize:13.5, fontFamily:"inherit", background:C.bg, color:C.ink }}/>
        </div>
        <Btn onClick={agregar} disabled={!nuevo.nombre.trim()||busy}><Plus size={14}/> Añadir</Btn>
      </div>
      {proveedores.length===0 ? (
        <div style={{ textAlign:"center", padding:"40px 24px", color:C.sub, border:`1px dashed ${C.line}`, borderRadius:10 }}>
          <Building2 size={32} style={{ opacity:.3, marginBottom:10 }}/>
          <p style={{ fontSize:14 }}>Sin proveedores. Añade el primero arriba.</p>
        </div>
      ) : (
        <div style={{ overflowX:"auto", border:`1px solid ${C.line}`, borderRadius:10 }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead>
            <tr style={{ background:C.s2, borderBottom:`1px solid ${C.line}` }}>
              {[
                { l:"", w:"34px" },
                { l:"Proveedor", h:"Nombre del proveedor. La estrella ★ marca el proveedor principal, cuyo coste se usa por defecto al importar pedidos." },
                { l:"Contacto", h:"Email o teléfono de contacto rápido que escribiste al crear el proveedor." },
                { l:"CIF / NIF" },
                { l:"Teléfono" },
                { l:"Email", h:"Email al que se dirigen los pedidos a proveedor (aparece en la cabecera del PDF/Excel)." },
                { l:"Persona" },
                { l:"Catálogo", h:"Nº de ítems importados del catálogo de este proveedor. Necesario para correlacionar tus materiales.", a:"center" },
                { l:"", w:"160px", a:"right" },
              ].map((c,i) => (
                <th key={i} style={{ textAlign: c.a||"left", padding:"9px 10px", fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.4, textTransform:"uppercase", whiteSpace:"nowrap", width:c.w }}>
                  <span style={{ display:"inline-flex", alignItems:"center" }}>{c.l}{c.h ? <Help text={c.h} pos="below"/> : null}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
          {proveedores.map(p => {
            const nItems = (itemsByProv[p.id]||[]).length;
            const dp = p.datos || {};
            if (editId===p.id) {
              return (
                <tr key={p.id} style={{ borderBottom:`1px solid ${C.line}`, borderLeft:`4px solid ${p.color||C.brand}` }}>
                  <td colSpan={9} style={{ padding:"12px 14px", background:C.s2 }}>
                    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <input value={editData.nombre||""} onChange={e=>setEditData(prev=>({...prev,nombre:e.target.value}))} placeholder="Nombre *"
                          style={{ flex:2, padding:"6px 8px", border:`1px solid ${C.strong}`, borderRadius:7, fontSize:13.5, fontFamily:"inherit", background:C.bg, color:C.ink }}/>
                        <input value={editData.contacto||""} onChange={e=>setEditData(prev=>({...prev,contacto:e.target.value}))} placeholder="Contacto / email"
                          style={{ flex:1.5, padding:"6px 8px", border:`1px solid ${C.strong}`, borderRadius:7, fontSize:13, fontFamily:"inherit", background:C.bg, color:C.ink }}/>
                        <Btn onClick={()=>guardarEdit(p.id)}><Save size={13}/> Guardar</Btn>
                        <button onClick={()=>setEditId(null)} style={{ background:"none", border:"none", color:C.dim, cursor:"pointer", padding:4, display:"flex" }}><X size={13}/></button>
                      </div>
                      <div style={{ fontSize:11, fontWeight:700, color:C.sub, textTransform:"uppercase", letterSpacing:.5 }}>
                        Datos del proveedor (opcional) — se usan en la cabecera del PDF/Excel de pedido
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                        {DATOS_PROV.map(({ key, label, ph }) => (
                          <div key={key}>
                            <label style={{ fontSize:10.5, color:C.dim, display:"block", marginBottom:2 }}>{label}</label>
                            <input value={editData.datos?.[key] || ""}
                              onChange={e=>setEditData(prev=>({ ...prev, datos:{ ...(prev.datos||{}), [key]: e.target.value } }))}
                              placeholder={ph}
                              style={{ width:"100%", padding:"6px 8px", border:`1px solid ${C.strong}`, borderRadius:7, fontSize:12.5, fontFamily:"inherit", background:C.bg, color:C.ink, boxSizing:"border-box" }}/>
                          </div>
                        ))}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            }
            const cell = { padding:"9px 10px", color:C.ink, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:220 };
            const dimc = { ...cell, color:C.dim };
            return (
              <tr key={p.id} style={{ borderBottom:`1px solid ${C.line}`, borderLeft:`4px solid ${p.color||C.brand}` }}
                onMouseEnter={e=>e.currentTarget.style.background=C.s2}
                onMouseLeave={e=>e.currentTarget.style.background=""}>
                <td style={{ padding:"9px 6px 9px 10px", textAlign:"center" }}>
                  <button onClick={()=>onMarcarPrincipal?.(p.id)}
                    title={principalId===p.id ? "Proveedor principal (coste por defecto del pedido). Clic para quitar." : "Marcar como principal (su coste será el por defecto al importar pedidos)"}
                    style={{ background:"none", border:"none", cursor:"pointer", padding:2, display:"flex", color: principalId===p.id ? "#f59e0b" : C.dim }}
                    onMouseEnter={e=>{ if(principalId!==p.id) e.currentTarget.style.color="#f59e0b"; }}
                    onMouseLeave={e=>{ if(principalId!==p.id) e.currentTarget.style.color=C.dim; }}>
                    <Star size={15} fill={principalId===p.id ? "#f59e0b" : "none"}/>
                  </button>
                </td>
                <td style={{ ...cell, fontWeight:600 }}>
                  {p.nombre}
                  {principalId===p.id && (
                    <span style={{ marginLeft:8, fontSize:10, fontWeight:700, color:"#b45309", background:"#fff7ed", borderRadius:999, padding:"2px 8px", letterSpacing:.3 }}>PRINCIPAL</span>
                  )}
                </td>
                <td style={p.contacto?cell:dimc}>{p.contacto||"\u2014"}</td>
                <td style={dp.cif?cell:dimc}>{dp.cif||"\u2014"}</td>
                <td style={dp.telefono?cell:dimc}>{dp.telefono||"\u2014"}</td>
                <td style={dp.email?cell:dimc}>{dp.email||"\u2014"}</td>
                <td style={dp.persona?cell:dimc}>{dp.persona||"\u2014"}</td>
                <td style={{ padding:"9px 10px", textAlign:"center", color:nItems?C.sub:C.dim, whiteSpace:"nowrap" }}>
                  <span style={{ display:"inline-flex", alignItems:"center", gap:4 }}><Package size={12}/> {nItems||"\u2014"}</span>
                </td>
                <td style={{ padding:"9px 10px", textAlign:"right", whiteSpace:"nowrap" }}>
                  <span style={{ display:"inline-flex", alignItems:"center", gap:6, justifyContent:"flex-end" }}>
                    <Btn outline onClick={()=>onImportar(p.id)} style={{ padding:"4px 10px", fontSize:12 }}><Upload size={12}/> {nItems?"Reimportar":"Importar"}</Btn>
                    <button onClick={()=>{ setEditId(p.id); setEditData({nombre:p.nombre,contacto:p.contacto||"",datos:p.datos||{}}); }}
                      title="Editar datos" style={{ background:"none", border:"none", color:C.dim, cursor:"pointer", padding:4, display:"flex" }}
                      onMouseEnter={e=>e.currentTarget.style.color=C.ink} onMouseLeave={e=>e.currentTarget.style.color=C.dim}><Edit2 size={13}/></button>
                    <button onClick={()=>onBorrar(p)}
                      style={{ background:"none", border:"none", color:C.dim, cursor:"pointer", padding:4, display:"flex" }}
                      onMouseEnter={e=>e.currentTarget.style.color=C.danger} onMouseLeave={e=>e.currentTarget.style.color=C.dim}><Trash2 size={13}/></button>
                  </span>
                </td>
              </tr>
            );
          })}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// CorrelacionClic — flujo: clic en MI material → clic en el ítem
// equivalente de cada proveedor → Guardar.
// ══════════════════════════════════════════════════════════════════
function CorrelacionClic({ materiales, proveedores, itemsByProv, cor, onGuardarMaterial, onAbrirProveedores }) {
  const [matSel, setMatSel] = useState(null);
  const [pending, setPending] = useState({});       // { [provId]: itemId|null }
  const [saved, setSaved] = useState({});           // copia para detectar cambios
  const [buscarMat, setBuscarMat] = useState("");
  const [buscarItem, setBuscarItem] = useState({}); // { [provId]: texto }
  const [guardando, setGuardando] = useState(false);

  // Mapa item_id → material_id (para avisar si un ítem ya está usado por otro material).
  const itemUsadoPor = useMemo(() => {
    const m = {};
    for (const mid in cor) for (const pid in cor[mid]) {
      const c = cor[mid][pid];
      if (c?.proveedor_item_id) m[c.proveedor_item_id] = Number(mid);
    }
    return m;
  }, [cor]);
  const matNombre = useMemo(() => Object.fromEntries(materiales.map(m => [m.id, m.nombre])), [materiales]);

  // Inicializa la selección al elegir un material (desde las correlaciones guardadas).
  function seleccionarMaterial(mid) {
    const row = cor[mid] || {};
    const init = {};
    proveedores.forEach(p => {
      const c = row[p.id];
      if (!c) { init[p.id] = null; return; }
      if (c.proveedor_item_id) { init[p.id] = c.proveedor_item_id; return; }
      // Correlación antigua sin item_id: casa por nombre.
      const it = (itemsByProv[p.id]||[]).find(x => norm(x.nombre) === norm(c.nombre_proveedor));
      init[p.id] = it?.id ?? null;
    });
    setMatSel(mid); setPending(init); setSaved(init); setBuscarItem({});
  }

  function toggleItem(provId, itemId) {
    setPending(prev => ({ ...prev, [provId]: prev[provId] === itemId ? null : itemId }));
  }

  const dirty = JSON.stringify(pending) !== JSON.stringify(saved);

  async function guardar() {
    if (!matSel || guardando) return;
    setGuardando(true);
    const seleccion = {};
    proveedores.forEach(p => {
      const itemId = pending[p.id];
      seleccion[p.id] = itemId ? (itemsByProv[p.id]||[]).find(x => x.id === itemId) || null : null;
    });
    try { await onGuardarMaterial(matSel, seleccion); setSaved(pending); }
    catch(e) { alert("No se pudo guardar: " + (e?.message||e)); }
    finally { setGuardando(false); }
  }

  const matsFiltrados = buscarMat.trim()
    ? materiales.filter(m => norm(m.nombre).includes(norm(buscarMat)))
    : materiales;

  if (proveedores.length === 0) {
    return (
      <div style={{ flex:1, display:"grid", placeItems:"center", padding:24 }}>
        <div style={{ textAlign:"center", color:C.sub, maxWidth:380 }}>
          <Building2 size={36} style={{ opacity:.3, marginBottom:12 }}/>
          <p style={{ fontSize:15, marginBottom:6 }}>Aún no hay proveedores</p>
          <p style={{ fontSize:13, marginBottom:14 }}>Crea tus proveedores e importa su catálogo para empezar a correlacionar.</p>
          <Btn onClick={onAbrirProveedores}><Building2 size={14}/> Ir a Proveedores</Btn>
        </div>
      </div>
    );
  }
  if (materiales.length === 0) {
    return (
      <div style={{ flex:1, display:"grid", placeItems:"center", padding:24 }}>
        <div style={{ textAlign:"center", color:C.sub, maxWidth:380 }}>
          <Package size={36} style={{ opacity:.3, marginBottom:12 }}/>
          <p style={{ fontSize:15, marginBottom:6 }}>No tienes materiales</p>
          <p style={{ fontSize:13 }}>Crea o importa tu catálogo en <strong>Almacén</strong> primero. Esos serán los nombres que verás en tu inventario.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
      {/* ── Columna izquierda: MIS materiales ── */}
      <div style={{ width:300, minWidth:300, borderRight:`1px solid ${C.line}`, display:"flex", flexDirection:"column", background:C.surface }}>
        <div style={{ padding:"14px 14px 10px" }}>
          <h3 style={{ fontSize:15, color:C.ink, marginBottom:8 }}>1 · Tu material</h3>
          <div style={{ position:"relative" }}>
            <Search size={14} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:C.dim }}/>
            <input value={buscarMat} onChange={e=>setBuscarMat(e.target.value)} placeholder="Buscar material…"
              style={{ width:"100%", padding:"7px 10px 7px 30px", border:`1px solid ${C.strong}`, borderRadius:8, fontSize:13, fontFamily:"inherit", background:C.bg, color:C.ink }}/>
          </div>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"0 8px 12px" }}>
          {matsFiltrados.map(m => {
            const nCor = Object.keys(cor[m.id]||{}).length;
            const activo = matSel === m.id;
            return (
              <button key={m.id} onClick={()=>seleccionarMaterial(m.id)}
                style={{ width:"100%", textAlign:"left", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, padding:"9px 10px", marginBottom:3, borderRadius:8, border:`1px solid ${activo?C.brand:"transparent"}`, background:activo?C.s2:"transparent", cursor:"pointer", fontFamily:"inherit" }}>
                <span style={{ fontSize:13.5, fontWeight:activo?700:500, color:C.ink, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.nombre}</span>
                <span style={{ flexShrink:0, fontSize:11, fontWeight:700, color: nCor?"#fff":C.dim, background: nCor?C.ok:"transparent", border: nCor?"none":`1px solid ${C.line}`, borderRadius:999, padding:"1px 7px", minWidth:22, textAlign:"center" }}>
                  {nCor}/{proveedores.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Derecha: catálogo de cada proveedor ── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {!matSel ? (
          <div style={{ flex:1, display:"grid", placeItems:"center", color:C.sub }}>
            <div style={{ textAlign:"center" }}>
              <ArrowRight size={28} style={{ opacity:.3, marginBottom:10 }}/>
              <p style={{ fontSize:14 }}>Selecciona un material de la izquierda para correlacionarlo.</p>
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding:"14px 18px 10px", borderBottom:`1px solid ${C.line}` }}>
              <h3 style={{ fontSize:15, color:C.ink }}>2 · Elige el equivalente en cada proveedor para <span style={{ color:C.brand }}>{matNombre[matSel]}</span></h3>
              <p style={{ fontSize:12.5, color:C.sub, marginTop:2 }}>Clic en un ítem para enlazarlo; clic de nuevo para quitarlo. Luego pulsa Guardar.</p>
            </div>
            <div style={{ flex:1, overflow:"auto", display:"flex", gap:12, padding:16, alignItems:"flex-start" }}>
              {proveedores.map(p => {
                const items = itemsByProv[p.id] || [];
                const q = norm(buscarItem[p.id]||"");
                const sel = pending[p.id];
                const vis = (q ? items.filter(it => norm(it.nombre).includes(q) || norm(it.referencia||"").includes(q)) : items)
                  .slice()
                  .sort((a, b) => (b.id === sel ? 1 : 0) - (a.id === sel ? 1 : 0));
                return (
                  <div key={p.id} style={{ width:312, minWidth:312, display:"flex", flexDirection:"column", maxHeight:"100%", border:`1px solid ${C.line}`, borderRadius:12, overflow:"hidden", background:C.surface }}>
                    <div style={{ padding:"9px 12px", background:p.color||C.brand, color:"#fff", fontSize:13, fontWeight:700, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.nombre}</span>
                      <span style={{ fontSize:11, opacity:.85 }}>{items.length}</span>
                    </div>
                    {items.length === 0 ? (
                      <div style={{ padding:"18px 12px", textAlign:"center", color:C.dim, fontSize:12 }}>
                        Sin catálogo importado.
                      </div>
                    ) : (
                      <>
                        <div style={{ padding:"8px 8px 6px" }}>
                          <input value={buscarItem[p.id]||""} onChange={e=>setBuscarItem(b=>({...b,[p.id]:e.target.value}))} placeholder="Buscar…"
                            style={{ width:"100%", padding:"5px 8px", border:`1px solid ${C.strong}`, borderRadius:7, fontSize:12, fontFamily:"inherit", background:C.bg, color:C.ink }}/>
                        </div>
                        <div style={{ flex:1, overflowY:"auto", padding:"0 6px 8px" }}>
                          {vis.map(it => {
                            const activo = sel === it.id;
                            const usadoOtro = itemUsadoPor[it.id] && itemUsadoPor[it.id] !== matSel;
                            return (
                              <button key={it.id} onClick={()=>toggleItem(p.id, it.id)}
                                title={usadoOtro ? `Ya enlazado a: ${matNombre[itemUsadoPor[it.id]]||"otro material"}` : ""}
                                style={{ width:"100%", textAlign:"left", display:"flex", alignItems:"center", gap:7, padding:"7px 8px", marginBottom:3, borderRadius:7, border:`1px solid ${activo?(p.color||C.brand):C.line}`, background:activo?`${p.color||C.brand}1a`:"transparent", cursor:"pointer", fontFamily:"inherit", opacity: usadoOtro&&!activo?.55:1 }}>
                                <span style={{ flexShrink:0, width:16, height:16, borderRadius:5, border:`1.5px solid ${activo?(p.color||C.brand):C.strong}`, background:activo?(p.color||C.brand):"transparent", display:"grid", placeItems:"center" }}>
                                  {activo && <Check size={11} color="#fff"/>}
                                </span>
                                <span style={{ minWidth:0 }}>
                                  <span style={{ display:"block", fontSize:12.5, color:C.ink, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{it.nombre}</span>
                                  {(it.referencia || it.coste!=null) && (
                                    <span style={{ display:"block", fontSize:10.5, color:C.dim, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                      {it.referencia||""}{it.referencia&&it.coste!=null?" · ":""}{it.coste!=null?`${it.coste} €`:""}
                                    </span>
                                  )}
                                </span>
                              </button>
                            );
                          })}
                          {vis.length===0 && <p style={{ fontSize:11.5, color:C.dim, textAlign:"center", padding:"10px 0" }}>Sin resultados.</p>}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ padding:"12px 18px", borderTop:`1px solid ${C.line}`, display:"flex", justifyContent:"flex-end", gap:8, alignItems:"center", background:C.surface }}>
              {dirty && <span style={{ fontSize:12.5, color:C.sub, marginRight:"auto" }}>Cambios sin guardar</span>}
              <Btn onClick={guardar} disabled={!dirty||guardando}>{guardando?"Guardando…":<><Save size={14}/> Guardar correlación</>}</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// WizardImportCatalogo — importa el Excel del proveedor y guarda TODO
// su catálogo en proveedor_items (no exige que case con tus materiales).
// ══════════════════════════════════════════════════════════════════
function WizardImportCatalogo({ proveedores, provIdInicial, onGuardarCatalogo, onGuardarPlantilla, onCerrar }) {
  const [paso, setPaso] = useState(0);
  const [provId, setProvId] = useState(Number(provIdInicial || proveedores[0]?.id || 0) || "");
  const [hojas, setHojas] = useState([]);
  const [hojaIdx, setHojaIdx] = useState(0);
  const [datos, setDatos] = useState([]);
  const [headerRow, setHeaderRow] = useState(0);
  const [colMap, setColMap] = useState({});
  const [activeRole, setActiveRole] = useState("nombre");
  const [guardarPl, setGuardarPl] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState(null);

  // Pre-carga la plantilla guardada del proveedor (mapeo reusable).
  useEffect(() => {
    const pl = proveedores.find(p => Number(p.id) === Number(provId))?.plantilla;
    if (pl?.colMap) { setColMap(pl.colMap); if (pl.headerRow != null) setHeaderRow(pl.headerRow); }
    else { setColMap({}); }
  }, [provId, proveedores]);

  const prov = proveedores.find(p=>Number(p.id)===Number(provId));

  function leerArchivo(file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type:"array" });
        const sheets = wb.SheetNames.map(name => ({ name, data: XLSX.utils.sheet_to_json(wb.Sheets[name], { header:1, defval:"" }) }));
        setHojas(sheets); setHojaIdx(0); setDatos(sheets[0]?.data||[]); setPaso(1);
      } catch(e) { alert("Error leyendo el archivo: "+e.message); }
    };
    reader.readAsArrayBuffer(file);
  }
  function onHojaChange(idx) { setHojaIdx(idx); setDatos(hojas[idx]?.data||[]); setColMap({}); setActiveRole("nombre"); }
  function asignarCol(colIdx) {
    const rev = Object.entries(colMap).find(([,v])=>v===colIdx);
    if (rev) { const [r]=rev; setColMap(m=>{const n={...m};delete n[r];return n;}); return; }
    setColMap(m=>({...m,[activeRole]:colIdx}));
    const next = ROLES_WIZARD.map(r=>r.key).find(k=>k!==activeRole && colMap[k]==null);
    if (next) setActiveRole(next);
  }
  function rolDeCol(colIdx) { return Object.entries(colMap).find(([,v])=>v===colIdx)?.[0]||null; }

  const headers = datos[headerRow] || [];
  const preview = datos.slice(headerRow+1, headerRow+6);
  const filasValidas = colMap.nombre!=null
    ? datos.slice(headerRow+1).filter(r => String(r[colMap.nombre]??"").trim()).length
    : 0;

  async function ejecutar() {
    if (colMap.nombre==null || guardando) return;
    setGuardando(true);
    const rows = datos.slice(headerRow+1).filter(r=>r.some(c=>String(c).trim()));
    const items = rows.map(r=>{
      const it = { datos:{} };
      ROLES_WIZARD.forEach(rol=>{
        if (colMap[rol.key]==null) return;
        const v = String(r[colMap[rol.key]]??"").trim();
        if (!v) return;
        if (COLUMNAS_ITEM.has(rol.key)) it[rol.key] = v; else it.datos[rol.key] = v;
      });
      return it;
    }).filter(it => (it.nombre||"").trim());
    try {
      await onGuardarCatalogo(provId, items);
      if (guardarPl && onGuardarPlantilla) await onGuardarPlantilla(provId, { colMap, headerRow });
      setResultado({ guardados: items.length }); setPaso(2);
    } catch(e) { alert("Error al guardar: "+(e?.message||e)); }
    finally { setGuardando(false); }
  }

  const PASOS = ["Archivo","Columnas","Completado"];
  const colByKey = Object.fromEntries(ROLES_WIZARD.map(r=>[r.key,r.color]));

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"grid", placeItems:"center", zIndex:300 }}>
      <div style={{ background:C.surface, borderRadius:18, width:"min(820px,96vw)", maxHeight:"92vh", display:"flex", flexDirection:"column", boxShadow:"var(--shadow-lg)", overflow:"hidden" }}>
        <div style={{ padding:"18px 24px", borderBottom:`1px solid ${C.line}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <h3 style={{ fontSize:17, color:C.ink, marginBottom:5 }}>Importar catálogo del proveedor</h3>
            <div style={{ display:"flex", alignItems:"center" }}>
              {PASOS.map((s,i)=>(
                <React.Fragment key={s}>
                  <span style={{ fontSize:12, fontWeight:i===paso?700:400, color:i<paso?C.ok:i===paso?C.brand:C.dim, display:"flex", alignItems:"center", gap:3 }}>{i<paso&&<Check size={11}/>}{s}</span>
                  {i<PASOS.length-1&&<span style={{ fontSize:12, color:C.dim, margin:"0 6px" }}>›</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
          <button onClick={onCerrar} style={{ background:"none", border:"none", color:C.dim, cursor:"pointer", padding:6, display:"flex" }}><X size={18}/></button>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:24 }}>
          {paso===0 && (
            <div style={{ maxWidth:480 }}>
              <div style={{ marginBottom:20 }}>
                <label style={{ fontSize:12, color:C.sub, display:"block", marginBottom:5 }}>Proveedor *</label>
                <select value={provId} onChange={e=>setProvId(Number(e.target.value))}
                  style={{ width:"100%", padding:"9px 10px", border:`1px solid ${C.strong}`, borderRadius:8, fontSize:14, fontFamily:"inherit", background:C.bg, color:C.ink }}>
                  {proveedores.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <label style={{ fontSize:12, color:C.sub, display:"block", marginBottom:5 }}>Archivo Excel del proveedor *</label>
              <FileDrop onFile={leerArchivo}/>
              <p style={{ fontSize:12, color:C.sub, marginTop:10 }}>Se guardará el catálogo completo del proveedor. Reimportar reemplaza su catálogo anterior.</p>
            </div>
          )}
          {paso===1 && (
            <PasoColumnas {...{ hojas, hojaIdx, onHoja:onHojaChange, headerRow, setHeaderRow, headers, preview, rolDeCol, onAsignar:asignarCol, colMap, activeRole, setActiveRole, prov, colByKey }}/>
          )}
          {paso===2 && (
            <div style={{ textAlign:"center", padding:"32px 24px" }}>
              <div style={{ width:56, height:56, borderRadius:999, background:C.okSoft, color:C.ok, display:"grid", placeItems:"center", margin:"0 auto 16px" }}><Check size={28}/></div>
              <h3 style={{ fontSize:18, color:C.ink, marginBottom:8 }}>Catálogo importado</h3>
              <p style={{ fontSize:14, color:C.sub }}>
                <strong style={{ color:C.ok }}>{resultado?.guardados} ítems</strong> guardados para <span style={{ color:prov?.color }}>{prov?.nombre}</span>.<br/>
                Ya puedes correlacionarlos con tus materiales.
              </p>
            </div>
          )}
        </div>

        <div style={{ padding:"14px 24px", borderTop:`1px solid ${C.line}`, display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
          <div>{paso===1 && <Btn outline onClick={()=>setPaso(0)}>← Volver</Btn>}</div>
          <div>
            {paso===0 && <span style={{ fontSize:12.5, color:C.sub }}>Selecciona proveedor y sube su Excel</span>}
            {paso===1 && <Btn onClick={ejecutar} disabled={colMap.nombre==null||guardando}>{guardando?"Guardando…":`Importar ${filasValidas} ítems`}</Btn>}
            {paso===2 && <Btn onClick={onCerrar}>Cerrar</Btn>}
          </div>
        </div>
        {paso===1 && (
          <div style={{ padding:"0 24px 14px", marginTop:-8 }}>
            <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:12.5, color:C.ink }}>
              <input type="checkbox" checked={guardarPl} onChange={e=>setGuardarPl(e.target.checked)} style={{ cursor:"pointer" }}/>
              Guardar plantilla de columnas de <strong>{prov?.nombre}</strong> (pre-asigna estas columnas la próxima vez).
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

function FileDrop({ onFile }) {
  const ref = useRef();
  return (
    <>
      <div onClick={()=>ref.current?.click()}
        style={{ border:`2px dashed ${C.strong}`, borderRadius:12, padding:"32px 24px", textAlign:"center", cursor:"pointer", color:C.sub }}
        onMouseEnter={e=>e.currentTarget.style.borderColor=C.brand} onMouseLeave={e=>e.currentTarget.style.borderColor=C.strong}
        onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault(); const f=e.dataTransfer.files[0]; if(f)onFile(f);}}>
        <Upload size={28} style={{ opacity:.4, marginBottom:10 }}/>
        <p style={{ fontSize:14, marginBottom:4 }}>Arrastra aquí o haz clic para seleccionar</p>
        <p style={{ fontSize:12 }}>.xlsx · .xls · .csv</p>
      </div>
      <input ref={ref} type="file" accept=".xlsx,.xls,.csv" style={{ display:"none" }} onChange={e=>{if(e.target.files[0])onFile(e.target.files[0]);}}/>
    </>
  );
}

function PasoColumnas({ hojas, hojaIdx, onHoja, headerRow, setHeaderRow, headers, preview, rolDeCol, onAsignar, colMap, activeRole, setActiveRole, prov, colByKey }) {
  return (
    <div>
      <div style={{ display:"flex", gap:12, marginBottom:16, flexWrap:"wrap", alignItems:"flex-end" }}>
        {hojas.length>1 && (
          <div>
            <label style={{ fontSize:12, color:C.sub, display:"block", marginBottom:4 }}>Hoja</label>
            <select value={hojaIdx} onChange={e=>onHoja(+e.target.value)} style={{ padding:"7px 10px", border:`1px solid ${C.strong}`, borderRadius:8, fontSize:13.5, fontFamily:"inherit", background:C.bg, color:C.ink }}>
              {hojas.map((h,i)=><option key={i} value={i}>{h.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label style={{ fontSize:12, color:C.sub, display:"block", marginBottom:4 }}>Fila cabecera (nº)</label>
          <input type="number" min={1} max={20} value={headerRow+1} onChange={e=>setHeaderRow(Math.max(0,+e.target.value-1))}
            style={{ width:70, padding:"7px 10px", border:`1px solid ${C.strong}`, borderRadius:8, fontSize:13.5, fontFamily:"inherit", background:C.bg, color:C.ink, textAlign:"center" }}/>
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, flexWrap:"wrap" }}>
        <span style={{ fontSize:12.5, color:C.sub }}>Asignar columna como:</span>
        {ROLES_WIZARD.map(r=>{
          const asignada = colMap[r.key]!=null; const activo = activeRole===r.key;
          return (
            <button key={r.key} onClick={()=>setActiveRole(r.key)}
              style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius:999, border:`1.5px solid ${asignada?r.color:activo?r.color:C.strong}`, background:activo?r.color:asignada?`${r.color}20`:"transparent", color:activo?"#fff":asignada?r.color:C.sub, fontSize:12, fontWeight:activo||asignada?700:400, cursor:"pointer", fontFamily:"inherit" }}>
              {asignada&&<Check size={10}/>}{r.label}{r.req?" *":""}
            </button>
          );
        })}
      </div>
      <p style={{ fontSize:12, color:C.sub, marginBottom:8 }}>Haz clic en una cabecera para asignarla al rol seleccionado. Clic en una asignada para quitarla.</p>
      {headers.length===0 ? (
        <p style={{ color:C.dim, fontSize:13 }}>Sin datos. Ajusta la fila de cabecera.</p>
      ) : (
        <div style={{ overflowX:"auto", borderRadius:10, border:`1px solid ${C.line}` }}>
          <table style={{ borderCollapse:"collapse", width:"100%" }}>
            <thead>
              <tr>
                {headers.map((h,i)=>{ const rol=rolDeCol(i); const color=rol?colByKey[rol]:null;
                  return (<th key={i} onClick={()=>onAsignar(i)} style={{ padding:"10px 12px", textAlign:"left", fontSize:13, fontWeight:600, background:color||C.s2, color:color?"#fff":C.ink, border:`1px solid ${C.line}`, cursor:"pointer", userSelect:"none", whiteSpace:"nowrap" }}>
                    {rol&&<span style={{ fontSize:10, marginRight:4 }}>{ROLES_WIZARD.find(r=>r.key===rol)?.label} </span>}{String(h||"(vacío)")}
                  </th>);
                })}
              </tr>
            </thead>
            <tbody>
              {preview.map((row,ri)=>(
                <tr key={ri} style={{ background:ri%2===0?C.bg:C.surface }}>
                  {headers.map((_,ci)=>{ const rol=rolDeCol(ci); const color=rol?colByKey[rol]:null;
                    return (<td key={ci} style={{ padding:"7px 12px", fontSize:12.5, color:C.ink, border:`1px solid ${C.line}`, background:color?`${color}15`:"inherit" }}>{String(row[ci]??"")}</td>);
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// WizardImportCorrelacion — genera correlaciones multi-proveedor
// desde un Excel: una fila por material + columnas por proveedor.
// ══════════════════════════════════════════════════════════════════
function WizardImportCorrelacion({ proveedores: init, materiales, cid, onCrearProv, onCerrar, onTerminar }) {
  const [paso, setPaso] = useState(0);
  const [provs, setProvs] = useState(init);
  const [nuevo, setNuevo] = useState({ nombre:"", contacto:"" });
  const [busyCrear, setBusyCrear] = useState(false);
  const [hojas, setHojas] = useState([]);
  const [hojaIdx, setHojaIdx] = useState(0);
  const [datos, setDatos] = useState([]);
  const [headerRow, setHeaderRow] = useState(0);
  const [colMap, setColMap] = useState({});
  const [activeRole, setActiveRole] = useState("mat_nombre");
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const roles = useMemo(() => [
    ...MAT_ROLES,
    ...provs.flatMap(p => PROV_SUBROLES.map(sr => ({
      key:`p_${p.id}_${sr.sub}`, label:`${p.nombre}: ${sr.label}`,
      color:p.color||"#f59e0b", prov:p, sub:sr.sub, req:false,
    })))
  ], [provs]);
  const colByKey = useMemo(() => Object.fromEntries(roles.map(r=>[r.key,r.color])), [roles]);

  async function agregarProv() {
    if (!nuevo.nombre.trim()||busyCrear) return;
    setBusyCrear(true);
    const color = COLORES_PROV[provs.length % COLORES_PROV.length];
    try {
      const creado = await onCrearProv({ nombre:nuevo.nombre.trim(), contacto:nuevo.contacto.trim(), color });
      if (creado) setProvs(ps=>[...ps,creado]);
      setNuevo({ nombre:"", contacto:"" });
    } finally { setBusyCrear(false); }
  }

  function leerArchivo(file) {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const wb = XLSX.read(ev.target.result, { type:"array" });
        const sheets = wb.SheetNames.map(name=>({ name, data:XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:""}) }));
        setHojas(sheets); setHojaIdx(0); setDatos(sheets[0]?.data||[]);
      } catch(e) { alert("Error leyendo el archivo: "+e.message); }
    };
    reader.readAsArrayBuffer(file);
  }
  function onHojaChange(idx) { setHojaIdx(idx); setDatos(hojas[idx]?.data||[]); setColMap({}); setActiveRole("mat_nombre"); }
  function asignarCol(colIdx) {
    const rev = Object.entries(colMap).find(([,v])=>v===colIdx);
    if (rev) { const [r]=rev; setColMap(m=>{const n={...m};delete n[r];return n;}); return; }
    setColMap(m=>({...m,[activeRole]:colIdx}));
    const next = roles.find(r=>r.key!==activeRole&&colMap[r.key]==null);
    if (next) setActiveRole(next.key);
  }
  function rolDeCol(colIdx) { return Object.entries(colMap).find(([,v])=>v===colIdx)?.[0]||null; }

  const headers = datos[headerRow]||[];
  const preview = datos.slice(headerRow+1, headerRow+6);
  const tieneMatId  = colMap.mat_id!=null||colMap.mat_referencia!=null||colMap.mat_nombre!=null;
  const tieneAlgunProv = provs.some(p=>colMap[`p_${p.id}_nombre`]!=null);

  async function ejecutar() {
    if (!tieneMatId||!tieneAlgunProv||guardando) return;
    setGuardando(true);
    try {
      const filas = datos.slice(headerRow+1).filter(r=>r.some(c=>String(c).trim()));
      const byProv = {}; let sinMaterial = 0;
      for (const fila of filas) {
        const mat = encontrarMaterial(fila, colMap, materiales);
        if (!mat) { sinMaterial++; continue; }
        for (const p of provs) {
          const nomCol = colMap[`p_${p.id}_nombre`];
          if (nomCol==null) continue;
          const nombreProv = String(fila[nomCol]||"").trim();
          if (!nombreProv) continue;
          const refCol=colMap[`p_${p.id}_referencia`], costeCol=colMap[`p_${p.id}_coste`], descCol=colMap[`p_${p.id}_descuento`];
          (byProv[p.id]||=[]).push({
            material_id:mat.id, nombre_proveedor:nombreProv,
            referencia: refCol!=null ? String(fila[refCol]||"").trim()||null : null,
            coste:      costeCol!=null ? parseNumCorr(fila[costeCol]) : null,
            descuento:  descCol!=null  ? parseNumCorr(fila[descCol])  : null,
            datos:{},
          });
        }
      }
      let creadas = 0;
      for (const [provId, items] of Object.entries(byProv)) {
        await guardarCorrelacionesLote(Number(provId), items, cid);
        creadas += items.length;
      }
      setResultado({ creadas, sinMaterial, total:filas.length });
      setPaso(2);
      onTerminar?.();
    } catch(e) { alert("Error al importar: "+(e?.message||e)); }
    finally { setGuardando(false); }
  }

  const PASOS_LABEL = ["Proveedores","Columnas","Completado"];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"grid", placeItems:"center", zIndex:300 }}>
      <div style={{ background:C.surface, borderRadius:18, width:"min(880px,96vw)", maxHeight:"92vh", display:"flex", flexDirection:"column", boxShadow:"var(--shadow-lg)", overflow:"hidden" }}>

        {/* ── Cabecera ── */}
        <div style={{ padding:"18px 24px", borderBottom:`1px solid ${C.line}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <h3 style={{ fontSize:17, color:C.ink, marginBottom:5 }}>Importar Correlaciones desde Excel</h3>
            <div style={{ display:"flex", alignItems:"center" }}>
              {PASOS_LABEL.map((s,i)=>(
                <React.Fragment key={s}>
                  <span style={{ fontSize:12, fontWeight:i===paso?700:400, color:i<paso?C.ok:i===paso?C.brand:C.dim, display:"flex", alignItems:"center", gap:3 }}>{i<paso&&<Check size={11}/>}{s}</span>
                  {i<PASOS_LABEL.length-1&&<span style={{ fontSize:12, color:C.dim, margin:"0 6px" }}>›</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
          <button onClick={onCerrar} style={{ background:"none", border:"none", color:C.dim, cursor:"pointer", padding:6, display:"flex" }}><X size={18}/></button>
        </div>

        {/* ── Cuerpo ── */}
        <div style={{ flex:1, overflowY:"auto", padding:24 }}>

          {/* Paso 0: Proveedores */}
          {paso===0 && (
            <div style={{ maxWidth:600 }}>
              <p style={{ fontSize:13.5, color:C.sub, marginBottom:20 }}>
                Revisa que todos los proveedores que aparecen en tu Excel están creados. El Excel debe tener una columna <strong>Nombre</strong> por proveedor (y opcionalmente Referencia, Coste, % Descuento).
              </p>
              {provs.length===0 ? (
                <div style={{ textAlign:"center", padding:"28px", color:C.sub, border:`1px dashed ${C.line}`, borderRadius:10, marginBottom:20 }}>
                  <Building2 size={28} style={{ opacity:.3, marginBottom:8 }}/>
                  <p style={{ fontSize:13 }}>Sin proveedores. Añade al menos uno.</p>
                </div>
              ) : (
                <div style={{ border:`1px solid ${C.line}`, borderRadius:10, overflow:"hidden", marginBottom:20 }}>
                  {provs.map((p,i)=>(
                    <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderBottom:i<provs.length-1?`1px solid ${C.line}`:"none" }}>
                      <div style={{ width:10, height:10, borderRadius:"50%", background:p.color||C.brand, flexShrink:0 }}/>
                      <span style={{ fontWeight:600, color:C.ink, flex:1 }}>{p.nombre}</span>
                      {p.contacto&&<span style={{ fontSize:12, color:C.sub }}>{p.contacto}</span>}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
                <div style={{ flex:2 }}>
                  <label style={{ fontSize:11, color:C.sub, display:"block", marginBottom:3 }}>Nombre *</label>
                  <input value={nuevo.nombre} onChange={e=>setNuevo(n=>({...n,nombre:e.target.value}))}
                    onKeyDown={e=>e.key==="Enter"&&agregarProv()} placeholder="Nuevo proveedor…"
                    style={{ width:"100%", padding:"8px 10px", border:`1px solid ${C.strong}`, borderRadius:8, fontSize:13.5, fontFamily:"inherit", background:C.bg, color:C.ink }}/>
                </div>
                <div style={{ flex:1.5 }}>
                  <label style={{ fontSize:11, color:C.sub, display:"block", marginBottom:3 }}>Contacto</label>
                  <input value={nuevo.contacto} onChange={e=>setNuevo(n=>({...n,contacto:e.target.value}))}
                    onKeyDown={e=>e.key==="Enter"&&agregarProv()} placeholder="email o teléfono"
                    style={{ width:"100%", padding:"8px 10px", border:`1px solid ${C.strong}`, borderRadius:8, fontSize:13.5, fontFamily:"inherit", background:C.bg, color:C.ink }}/>
                </div>
                <Btn onClick={agregarProv} disabled={!nuevo.nombre.trim()||busyCrear}><Plus size={14}/> Añadir</Btn>
              </div>
            </div>
          )}

          {/* Paso 1: Columnas */}
          {paso===1 && (
            <div>
              {datos.length===0 ? (
                <div style={{ maxWidth:500 }}>
                  <p style={{ fontSize:13.5, color:C.sub, marginBottom:16 }}>
                    Sube un Excel donde cada fila sea un material con columnas para identificarlo (ID/Nombre/Referencia)
                    y columnas con el nombre, coste y referencia de cada proveedor.
                  </p>
                  <FileDrop onFile={leerArchivo}/>
                  <p style={{ fontSize:12, color:C.dim, marginTop:10 }}>
                    Ejemplo de columnas: <em>ID · Nombre · Ref · Categ. · Ubic. · Prov.A nombre · Prov.A coste · Prov.B nombre · Prov.B coste…</em>
                  </p>
                </div>
              ) : (
                <div>
                  <div style={{ display:"flex", gap:12, marginBottom:16, flexWrap:"wrap", alignItems:"flex-end" }}>
                    {hojas.length>1 && (
                      <div>
                        <label style={{ fontSize:12, color:C.sub, display:"block", marginBottom:4 }}>Hoja</label>
                        <select value={hojaIdx} onChange={e=>onHojaChange(+e.target.value)}
                          style={{ padding:"7px 10px", border:`1px solid ${C.strong}`, borderRadius:8, fontSize:13.5, fontFamily:"inherit", background:C.bg, color:C.ink }}>
                          {hojas.map((h,i)=><option key={i} value={i}>{h.name}</option>)}
                        </select>
                      </div>
                    )}
                    <div>
                      <label style={{ fontSize:12, color:C.sub, display:"block", marginBottom:4 }}>Fila cabecera</label>
                      <input type="number" min={1} max={20} value={headerRow+1} onChange={e=>setHeaderRow(Math.max(0,+e.target.value-1))}
                        style={{ width:70, padding:"7px 10px", border:`1px solid ${C.strong}`, borderRadius:8, fontSize:13.5, fontFamily:"inherit", background:C.bg, color:C.ink, textAlign:"center" }}/>
                    </div>
                    <button onClick={()=>{ setDatos([]); setColMap({}); }}
                      style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 12px", border:`1px solid ${C.strong}`, borderRadius:8, background:"transparent", color:C.sub, fontSize:12.5, cursor:"pointer", fontFamily:"inherit" }}>
                      <Upload size={13}/> Cambiar archivo
                    </button>
                  </div>

                  {/* Roles del material */}
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.5, textTransform:"uppercase", marginBottom:6 }}>Columnas del material (para identificarlo)</div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      {MAT_ROLES.map(r=>{ const asignada=colMap[r.key]!=null; const activo=activeRole===r.key; return (
                        <button key={r.key} onClick={()=>setActiveRole(r.key)}
                          style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius:999, border:`1.5px solid ${asignada?r.color:activo?r.color:C.strong}`, background:activo?r.color:asignada?`${r.color}20`:"transparent", color:activo?"#fff":asignada?r.color:C.sub, fontSize:12, fontWeight:activo||asignada?700:400, cursor:"pointer", fontFamily:"inherit" }}>
                          {asignada&&<Check size={10}/>}{r.label}{r.req?" *":""}
                        </button>
                      ); })}
                    </div>
                  </div>

                  {/* Roles por proveedor */}
                  {provs.map(p=>(
                    <div key={p.id} style={{ marginBottom:10 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:p.color||C.sub, letterSpacing:.5, textTransform:"uppercase", marginBottom:6, display:"flex", alignItems:"center", gap:6 }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", background:p.color||C.brand }}/>
                        {p.nombre}
                      </div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {PROV_SUBROLES.map(sr=>{ const key=`p_${p.id}_${sr.sub}`; const asignada=colMap[key]!=null; const activo=activeRole===key; const c=p.color||"#f59e0b"; return (
                          <button key={key} onClick={()=>setActiveRole(key)}
                            style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius:999, border:`1.5px solid ${asignada?c:activo?c:C.strong}`, background:activo?c:asignada?`${c}20`:"transparent", color:activo?"#fff":asignada?c:C.sub, fontSize:12, fontWeight:activo||asignada?700:400, cursor:"pointer", fontFamily:"inherit" }}>
                            {asignada&&<Check size={10}/>}{sr.label}{sr.sub==="nombre"?" *":""}
                          </button>
                        ); })}
                      </div>
                    </div>
                  ))}

                  <p style={{ fontSize:12, color:C.sub, margin:"8px 0" }}>Haz clic en una cabecera para asignarla al rol seleccionado. Clic en una ya asignada para quitarla.</p>

                  {headers.length===0 ? (
                    <p style={{ color:C.dim, fontSize:13 }}>Sin datos. Ajusta la fila de cabecera.</p>
                  ) : (
                    <div style={{ overflowX:"auto", borderRadius:10, border:`1px solid ${C.line}` }}>
                      <table style={{ borderCollapse:"collapse", width:"100%" }}>
                        <thead><tr>
                          {headers.map((h,i)=>{ const rol=rolDeCol(i); const color=rol?colByKey[rol]:null; return (
                            <th key={i} onClick={()=>asignarCol(i)} style={{ padding:"10px 12px", textAlign:"left", fontSize:13, fontWeight:600, background:color||C.s2, color:color?"#fff":C.ink, border:`1px solid ${C.line}`, cursor:"pointer", userSelect:"none", whiteSpace:"nowrap" }}>
                              {rol&&<span style={{ fontSize:10, marginRight:4 }}>{roles.find(r=>r.key===rol)?.label} </span>}{String(h||"(vacío)")}
                            </th>
                          ); })}
                        </tr></thead>
                        <tbody>
                          {preview.map((row,ri)=>(
                            <tr key={ri} style={{ background:ri%2===0?C.bg:C.surface }}>
                              {headers.map((_,ci)=>{ const rol=rolDeCol(ci); const color=rol?colByKey[rol]:null; return (
                                <td key={ci} style={{ padding:"7px 12px", fontSize:12.5, color:C.ink, border:`1px solid ${C.line}`, background:color?`${color}15`:"inherit" }}>{String(row[ci]??"")}</td>
                              ); })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Paso 2: Completado */}
          {paso===2 && (
            <div style={{ textAlign:"center", padding:"32px 24px" }}>
              <div style={{ width:56, height:56, borderRadius:999, background:C.okSoft||"#dcfce7", color:C.ok||"#16a34a", display:"grid", placeItems:"center", margin:"0 auto 16px" }}><Check size={28}/></div>
              <h3 style={{ fontSize:18, color:C.ink, marginBottom:8 }}>Correlaciones importadas</h3>
              <p style={{ fontSize:14, color:C.sub }}>
                <strong style={{ color:C.ok||"#16a34a" }}>{resultado?.creadas} correlaciones</strong> creadas o actualizadas.
                {resultado?.sinMaterial>0 && <><br/><strong style={{ color:"#f59e0b" }}>{resultado.sinMaterial} filas</strong> ignoradas (material no encontrado).</>}
                <br/>Ya puedes verlas en la pestaña <strong>Correlación</strong>.
              </p>
            </div>
          )}
        </div>

        {/* ── Pie ── */}
        <div style={{ padding:"14px 24px", borderTop:`1px solid ${C.line}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>{paso===1 && <Btn outline onClick={()=>setPaso(0)}>← Volver</Btn>}</div>
          <div style={{ display:"flex", gap:8 }}>
            {paso===0 && <Btn onClick={()=>setPaso(1)} disabled={provs.length===0}>Siguiente →</Btn>}
            {paso===1 && datos.length>0 && (
              <Btn onClick={ejecutar} disabled={!tieneMatId||!tieneAlgunProv||guardando}>
                {guardando?<><Loader size={13} className="spin"/> Importando…</>:"Importar correlaciones"}
              </Btn>
            )}
            {paso===2 && <Btn onClick={onCerrar}>Cerrar</Btn>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// FichaProveedor — ficha detallada de un proveedor con selector
// ══════════════════════════════════════════════════════════════════
function FichaProveedor({ proveedores, itemsByProv, cor, pedidos = [], onEditarProv, onImportar }) {
  const [provSelId, setProvSelId] = useState(() => proveedores[0]?.id ?? "");
  const [editando,  setEditando]  = useState(false);
  const [editData,  setEditData]  = useState({});
  const [saving,    setSaving]    = useState(false);
  const [seccion,   setSeccion]   = useState("catalogo");
  const [buscar,    setBuscar]    = useState("");

  const prov  = proveedores.find(p => String(p.id) === String(provSelId));
  const dp    = prov?.datos || {};
  const items = prov ? (itemsByProv[prov.id] || []) : [];
  const margen = dp.margen_subalquiler != null ? Number(dp.margen_subalquiler) : null;

  const midsCorrelados = useMemo(() => prov
    ? Object.keys(cor).filter(mid => cor[mid]?.[prov.id])
    : [], [prov, cor]);

  const pedidosRel = useMemo(() => {
    if (!prov) return [];
    return pedidos.filter(p =>
      (p.lineas || []).some(l =>
        String(l._proveedor_id) === String(prov.id) ||
        (l.material_id && cor[l.material_id]?.[prov.id])
      )
    );
  }, [prov, pedidos, cor]);

  const itemsFiltrados = useMemo(() => {
    const q = norm(buscar);
    return q ? items.filter(it => norm(it.nombre).includes(q) || norm(it.referencia || "").includes(q)) : items;
  }, [items, buscar]);

  function descargarExcel() {
    if (!prov || !items.length) return;
    const filas = items.map(it => ({
      Nombre: it.nombre || "",
      "Categoría": it.categoria || "",
      Referencia: it.referencia || "",
      "Coste (€)": it.coste != null ? Number(it.coste) : "",
      "Descuento %": it.descuento != null ? Number(it.descuento) : "",
      ...(margen != null && it.coste != null ? { [`Precio +${margen}% (€)`]: (Number(it.coste) * (1 + margen / 100)).toFixed(2) } : {}),
    }));
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Catálogo");
    XLSX.writeFile(wb, `catalogo_${(prov.nombre || "proveedor").replace(/\s+/g, "_")}.xlsx`);
  }

  function iniciarEdicion() {
    setEditData({ nombre: prov.nombre, contacto: prov.contacto || "", datos: { ...dp } });
    setEditando(true);
  }

  async function guardar() {
    setSaving(true);
    try { await onEditarProv(prov.id, editData); setEditando(false); }
    catch (e) { alert("Error guardando: " + (e?.message || e)); }
    finally { setSaving(false); }
  }

  if (proveedores.length === 0) {
    return (
      <div style={{ flex:1, display:"grid", placeItems:"center", color:C.sub }}>
        <div style={{ textAlign:"center", maxWidth:340 }}>
          <Building2 size={36} style={{ opacity:.3, marginBottom:12 }}/>
          <p style={{ fontSize:14 }}>Sin proveedores. Crea uno primero en la pestaña <strong>Proveedores</strong>.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex:1, overflowY:"auto", padding:"20px 28px" }}>

      {/* ── Selector de proveedor ── */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24, flexWrap:"wrap" }}>
        <label style={{ fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.5, whiteSpace:"nowrap" }}>PROVEEDOR</label>
        <select value={provSelId} onChange={e => { setProvSelId(e.target.value); setEditando(false); setBuscar(""); }}
          style={{ flex:"1 1 220px", maxWidth:320, padding:"9px 12px", border:`1px solid ${C.strong}`, borderRadius:10, fontSize:15, fontFamily:"inherit", background:C.s2, color:C.ink, fontWeight:600, cursor:"pointer" }}>
          {proveedores.map(p => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
        {prov && !editando && (
          <>
            <button onClick={iniciarEdicion}
              style={{ display:"flex", alignItems:"center", gap:5, padding:"8px 14px", borderRadius:9, border:`1px solid ${C.strong}`, background:"transparent", color:C.ink, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
              <Edit2 size={13}/> Editar datos
            </button>
            <button onClick={() => onImportar(prov.id)}
              style={{ display:"flex", alignItems:"center", gap:5, padding:"8px 14px", borderRadius:9, border:`1px solid ${C.brand}`, background:C.brandSoft, color:C.brand, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
              <Upload size={13}/> {items.length ? "Reimportar" : "Importar"} catálogo
            </button>
          </>
        )}
      </div>

      {prov && (
        <div style={{ display:"grid", gridTemplateColumns:"280px 1fr", gap:20, alignItems:"start" }}>

          {/* ── Columna izquierda: ficha ── */}
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

            {/* Card info / edición */}
            <div style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:14, padding:"18px 20px", borderLeft:`4px solid ${prov.color || C.brand}` }}>
              {editando ? (
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  <div style={{ fontWeight:700, fontSize:13.5, color:C.ink, marginBottom:2 }}>Editar proveedor</div>
                  <div>
                    <label style={{ fontSize:10.5, color:C.dim, display:"block", marginBottom:3 }}>Nombre *</label>
                    <input value={editData.nombre || ""} onChange={e => setEditData(d => ({ ...d, nombre:e.target.value }))}
                      style={{ width:"100%", padding:"7px 9px", border:`1px solid ${C.strong}`, borderRadius:8, fontSize:13.5, fontFamily:"inherit", background:C.bg, color:C.ink, boxSizing:"border-box" }}/>
                  </div>
                  {/* Margen subalquiler */}
                  <div>
                    <label style={{ fontSize:10.5, color:C.dim, display:"block", marginBottom:3 }}>Margen de subalquiler (%)</label>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <input type="number" min={0} max={999} step={0.5}
                        value={editData.datos?.margen_subalquiler ?? ""}
                        placeholder="0"
                        onChange={e => setEditData(d => ({ ...d, datos:{ ...(d.datos||{}), margen_subalquiler: e.target.value === "" ? null : Number(e.target.value) } }))}
                        style={{ width:72, padding:"7px 9px", border:`1px solid ${C.strong}`, borderRadius:8, fontSize:14, fontFamily:"inherit", background:C.bg, color:C.ink, textAlign:"right" }}/>
                      <span style={{ fontSize:14, color:C.sub, fontWeight:600 }}>%</span>
                    </div>
                    <div style={{ fontSize:10.5, color:C.dim, marginTop:3 }}>
                      Ej: coste 10€ + 20% → precio realquiler 12€
                    </div>
                  </div>
                  {DATOS_PROV.map(({ key, label, ph }) => (
                    <div key={key}>
                      <label style={{ fontSize:10.5, color:C.dim, display:"block", marginBottom:3 }}>{label}</label>
                      <input value={editData.datos?.[key] || ""}
                        onChange={e => setEditData(d => ({ ...d, datos:{ ...(d.datos||{}), [key]: e.target.value } }))}
                        placeholder={ph}
                        style={{ width:"100%", padding:"7px 9px", border:`1px solid ${C.strong}`, borderRadius:8, fontSize:12.5, fontFamily:"inherit", background:C.bg, color:C.ink, boxSizing:"border-box" }}/>
                    </div>
                  ))}
                  <div style={{ display:"flex", gap:8, marginTop:6, justifyContent:"flex-end" }}>
                    <button onClick={() => setEditando(false)}
                      style={{ padding:"6px 14px", borderRadius:8, border:`1px solid ${C.strong}`, background:"transparent", color:C.sub, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                      Cancelar
                    </button>
                    <button onClick={guardar} disabled={saving || !editData.nombre?.trim()}
                      style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 14px", borderRadius:8, border:"none",
                        background: saving ? "#93c5fd" : C.brand, color:"#fff", fontSize:13, fontWeight:700,
                        cursor: saving ? "default" : "pointer", fontFamily:"inherit" }}>
                      {saving ? <Loader size={13} className="spin"/> : <Save size={13}/>} Guardar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize:17, fontWeight:800, color:C.ink, marginBottom:12 }}>{prov.nombre}</div>

                  {/* Margen badge */}
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, padding:"10px 14px", background:"#f0fdf4", borderRadius:10, border:"1px solid #bbf7d0" }}>
                    <span style={{ fontSize:26, fontWeight:900, color:"#16a34a", minWidth:50 }}>
                      {margen != null ? `${margen}%` : "—"}
                    </span>
                    <div>
                      <div style={{ fontSize:10.5, fontWeight:700, color:"#16a34a", letterSpacing:.5, textTransform:"uppercase" }}>
                        Margen subalquiler
                      </div>
                      {margen != null && items.length > 0 && items[0]?.coste != null && (
                        <div style={{ fontSize:11, color:"#16a34a", marginTop:1, opacity:.8 }}>
                          {Number(items[0].coste).toFixed(2)}€ → {(Number(items[0].coste) * (1 + margen / 100)).toFixed(2)}€
                        </div>
                      )}
                      {margen == null && (
                        <div style={{ fontSize:11, color:C.dim, marginTop:1 }}>Sin margen configurado</div>
                      )}
                    </div>
                  </div>

                  {/* Datos de contacto */}
                  <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                    {[
                      { l:"Contacto",  v:prov.contacto },
                      { l:"CIF",       v:dp.cif        },
                      { l:"Teléfono",  v:dp.telefono   },
                      { l:"Email",     v:dp.email      },
                      { l:"Persona",   v:dp.persona    },
                      { l:"Dirección", v:dp.direccion  },
                      { l:"Web",       v:dp.web        },
                    ].filter(f => f.v).map(f => (
                      <div key={f.l} style={{ display:"flex", gap:8, fontSize:12.5 }}>
                        <span style={{ color:C.sub, fontWeight:600, minWidth:68, flexShrink:0 }}>{f.l}</span>
                        <span style={{ color:C.ink, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.v}</span>
                      </div>
                    ))}
                    {!prov.contacto && !dp.cif && !dp.email && !dp.telefono && (
                      <div style={{ fontSize:11.5, color:C.dim, fontStyle:"italic" }}>Sin datos de contacto.</div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Stats */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {[
                { label:"Ítems catálogo",  val:items.length,            color:C.brand   },
                { label:"Correlaciones",   val:midsCorrelados.length,   color:"#8b5cf6" },
                { label:"Pedidos relac.",  val:pedidosRel.length,       color:"#f59e0b" },
              ].map(s => (
                <div key={s.label} style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:10, padding:"10px 12px" }}>
                  <div style={{ fontSize:20, fontWeight:800, color:s.color, lineHeight:1 }}>{s.val}</div>
                  <div style={{ fontSize:10.5, color:C.sub, marginTop:3, fontWeight:600, textTransform:"uppercase", letterSpacing:.4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Columna derecha: catálogo / historial ── */}
          <div>
            {/* Toggle catálogo / historial */}
            <div style={{ display:"flex", gap:0, marginBottom:14, border:`1px solid ${C.line}`, borderRadius:10, overflow:"hidden", width:"fit-content" }}>
              {[["catalogo", `Catálogo (${items.length})`], ["compras", `Historial (${pedidosRel.length})`]].map(([id, lbl]) => (
                <button key={id} onClick={() => setSeccion(id)}
                  style={{ padding:"8px 18px", border:"none", fontSize:13, fontWeight:seccion===id?700:400,
                    cursor:"pointer", fontFamily:"inherit",
                    background:seccion===id ? C.brand : C.s2,
                    color:seccion===id ? "#fff" : C.sub }}>
                  {lbl}
                </button>
              ))}
            </div>

            {/* ── Catálogo ── */}
            {seccion === "catalogo" && (
              <div>
                <div style={{ display:"flex", gap:8, marginBottom:10, alignItems:"center" }}>
                  <div style={{ position:"relative", flex:1 }}>
                    <Search size={13} style={{ position:"absolute", left:9, top:"50%", transform:"translateY(-50%)", color:C.dim }}/>
                    <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar en catálogo…"
                      style={{ width:"100%", padding:"7px 10px 7px 28px", border:`1px solid ${C.strong}`, borderRadius:8, fontSize:13, fontFamily:"inherit", background:C.bg, color:C.ink, boxSizing:"border-box" }}/>
                  </div>
                  <button onClick={descargarExcel} disabled={!items.length}
                    style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:8, border:"none",
                      background: items.length ? "#16a34a" : C.s2, color: items.length ? "#fff" : C.dim,
                      fontSize:13, fontWeight:600, cursor: items.length ? "pointer" : "not-allowed", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                    <Download size={13}/> Descargar Excel
                  </button>
                </div>

                {items.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"40px 20px", color:C.sub, border:`1px dashed ${C.line}`, borderRadius:12 }}>
                    <Package size={28} style={{ opacity:.3, marginBottom:8 }}/>
                    <p style={{ fontSize:13 }}>Sin catálogo importado todavía.</p>
                    <p style={{ fontSize:12, marginTop:4, color:C.dim }}>Usa el botón "Importar catálogo" para cargar su Excel.</p>
                  </div>
                ) : (
                  <div style={{ border:`1px solid ${C.line}`, borderRadius:12, overflow:"hidden" }}>
                    <div style={{ maxHeight:460, overflowY:"auto" }}>
                      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12.5 }}>
                        <thead style={{ position:"sticky", top:0, zIndex:1 }}>
                          <tr style={{ background:C.s2, borderBottom:`1px solid ${C.line}` }}>
                            {["Nombre","Categoría","Referencia","Coste",
                              ...(margen != null ? [`Precio +${margen}%`] : []),
                              "Dcto."].map((h, i) => (
                              <th key={i} style={{ padding:"8px 10px", textAlign: i>=3?"right":"left",
                                fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.4, textTransform:"uppercase", whiteSpace:"nowrap" }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {itemsFiltrados.map((it, i) => (
                            <tr key={it.id ?? i} style={{ borderBottom:`1px solid ${C.line}` }}
                              onMouseEnter={e => e.currentTarget.style.background = C.s2}
                              onMouseLeave={e => e.currentTarget.style.background = ""}>
                              <td style={{ padding:"7px 10px", color:C.ink, fontWeight:500, maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{it.nombre}</td>
                              <td style={{ padding:"7px 10px", color:C.sub, maxWidth:110, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{it.categoria || "—"}</td>
                              <td style={{ padding:"7px 10px", color:C.sub, fontFamily:"monospace", fontSize:11.5 }}>{it.referencia || "—"}</td>
                              <td style={{ padding:"7px 10px", textAlign:"right", fontWeight:600, color:"#b45309", whiteSpace:"nowrap" }}>
                                {it.coste != null ? `${Number(it.coste).toFixed(2)} €` : "—"}
                              </td>
                              {margen != null && (
                                <td style={{ padding:"7px 10px", textAlign:"right", fontWeight:700, color:"#16a34a", whiteSpace:"nowrap" }}>
                                  {it.coste != null ? `${(Number(it.coste) * (1 + margen / 100)).toFixed(2)} €` : "—"}
                                </td>
                              )}
                              <td style={{ padding:"7px 10px", textAlign:"right", color:C.sub }}>
                                {it.descuento != null ? `${it.descuento}%` : "—"}
                              </td>
                            </tr>
                          ))}
                          {itemsFiltrados.length === 0 && (
                            <tr><td colSpan={8} style={{ padding:"18px", textAlign:"center", color:C.dim, fontSize:12 }}>Sin resultados para "{buscar}"</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ padding:"8px 12px", borderTop:`1px solid ${C.line}`, background:C.s2, fontSize:11.5, color:C.sub, display:"flex", justifyContent:"space-between" }}>
                      <span>{itemsFiltrados.length} de {items.length} ítems</span>
                      {buscar && <button onClick={() => setBuscar("")} style={{ background:"none", border:"none", cursor:"pointer", color:C.brand, fontSize:11.5, fontFamily:"inherit" }}>✕ Limpiar</button>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Historial de compras / pedidos ── */}
            {seccion === "compras" && (
              <div>
                {pedidosRel.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"40px 20px", color:C.sub, border:`1px dashed ${C.line}`, borderRadius:12 }}>
                    <ShoppingBag size={28} style={{ opacity:.3, marginBottom:8 }}/>
                    <p style={{ fontSize:13 }}>Sin pedidos relacionados con este proveedor.</p>
                    <p style={{ fontSize:12, marginTop:4, color:C.dim }}>
                      Aparecerán aquí los pedidos cuyas líneas incluyan materiales correlacionados con este proveedor o subalquilados a través de él.
                    </p>
                  </div>
                ) : (
                  <div style={{ border:`1px solid ${C.line}`, borderRadius:12, overflow:"hidden" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                      <thead>
                        <tr style={{ background:C.s2, borderBottom:`1px solid ${C.line}` }}>
                          {["Código","Cliente / Nombre","Fecha entrega","Estado","Líneas"].map((h, i) => (
                            <th key={i} style={{ padding:"8px 10px", textAlign:"left", fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.4, textTransform:"uppercase" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pedidosRel.map(p => (
                          <tr key={p.id} style={{ borderBottom:`1px solid ${C.line}` }}
                            onMouseEnter={e => e.currentTarget.style.background = C.s2}
                            onMouseLeave={e => e.currentTarget.style.background = ""}>
                            <td style={{ padding:"8px 10px", fontWeight:700, color:C.brand }}>{p.codigo || `#${p.id}`}</td>
                            <td style={{ padding:"8px 10px", color:C.ink, maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.nombre || "—"}</td>
                            <td style={{ padding:"8px 10px", color:C.sub, whiteSpace:"nowrap" }}>{p.fecha_entrega || p.fecha_pedido || "—"}</td>
                            <td style={{ padding:"8px 10px" }}>
                              <span style={{ fontSize:11, fontWeight:700, borderRadius:999, padding:"2px 8px",
                                background: p.estado==="confirmado" ? "#dcfce7" : p.estado==="entregado" ? "#dbeafe" : C.s2,
                                color: p.estado==="confirmado" ? "#16a34a" : p.estado==="entregado" ? "#2563eb" : C.sub,
                                textTransform:"capitalize" }}>
                                {p.estado || "—"}
                              </span>
                            </td>
                            <td style={{ padding:"8px 10px", color:C.sub }}>{(p.lineas||[]).length}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TabDistribuidor (Proveedores) — export default
// ══════════════════════════════════════════════════════════════════
export default function TabDistribuidor({ empresa, materiales = [], modo, pedidos = [] }) {
  const cid = empresa?.id ?? empresa?.company_id ?? empresa?.companyId;
  const esSupabase = modo === "supabase" && !!cid && cid !== "demo" && cid !== "local";

  const [proveedores, setProveedores] = useState([]);
  const [itemsByProv, setItemsByProv] = useState({});   // { [provId]: items[] }
  // cor[material_id][proveedor_id] = { id, nombre_proveedor, referencia, coste, descuento, datos, proveedor_item_id }
  const [cor, setCor] = useState({});
  const [cargando, setCargando] = useState(esSupabase);
  const [subTab, setSubTab] = useState("correlacion");
  const [wizardProv, setWizardProv] = useState(null);   // id de proveedor a importar, o null
  const [wizardCorrelacion, setWizardCorrelacion] = useState(false);
  const [principalId, setPrincipalId] = useState(null); // proveedor cuyo coste es el por defecto

  const recargar = useCallback(async () => {
    if (!esSupabase) { setCargando(false); return; }
    setCargando(true);
    try {
      const provs = await cargarProveedores(cid);
      setProveedores(provs);
      setPrincipalId(await cargarProveedorPrincipal(cid));
      const mapa = {}, items = {};
      for (const p of provs) {
        const cs = await cargarCorrelacionesDeProveedor(p.id);
        cs.forEach(c => { (mapa[c.material_id] ||= {})[c.proveedor_id] = c; });
        items[p.id] = await cargarItemsDeProveedor(p.id);
      }
      setCor(mapa); setItemsByProv(items);
    } catch (e) { console.warn("[Proveedores] carga:", e?.message); }
    finally { setCargando(false); }
  }, [cid, esSupabase]);

  useEffect(() => { recargar(); }, [recargar]);

  // ── Proveedores CRUD ──
  async function onCrearProv(p) { if (!esSupabase) return; const nuevo = await crearProveedor(p, cid); setProveedores(ps=>[...ps,nuevo]); setItemsByProv(m=>({...m,[nuevo.id]:[]})); return nuevo; }
  async function onEditarProv(id, cambios) { if (!esSupabase) return; const upd = await actualizarProveedor(id, cambios); setProveedores(ps=>ps.map(p=>p.id===id?upd:p)); }
  // Marca/desmarca el proveedor principal (su coste = coste por defecto del pedido).
  async function onMarcarPrincipal(id) {
    if (!esSupabase) return;
    const nuevo = principalId === id ? null : id;
    setPrincipalId(nuevo);
    try { await guardarProveedorPrincipal(cid, nuevo); }
    catch (e) { console.warn("[principal]", e?.message); setPrincipalId(principalId); }
  }
  async function onBorrarProv(p) {
    if (!esSupabase) return;
    if (!confirm(`¿Eliminar el proveedor "${p.nombre}"? Se borrarán su catálogo y sus correlaciones.`)) return;
    await borrarProveedor(p.id);
    if (principalId === p.id) { setPrincipalId(null); guardarProveedorPrincipal(cid, null).catch(()=>{}); }
    setProveedores(ps=>ps.filter(x=>x.id!==p.id));
    setItemsByProv(m=>{ const n={...m}; delete n[p.id]; return n; });
    setCor(prev => { const n={}; for (const mid in prev){ const row={...prev[mid]}; delete row[p.id]; if(Object.keys(row).length) n[mid]=row; } return n; });
  }

  // ── Import del catálogo del proveedor (reemplaza el anterior) ──
  async function onGuardarCatalogo(proveedorId, items) {
    if (!esSupabase) throw new Error("No hay sesión activa. Recarga la página e inicia sesión.");
    const guardados = await reemplazarItemsProveedor(Number(proveedorId), items, cid);
    setItemsByProv(m => ({ ...m, [Number(proveedorId)]: guardados }));
  }
  async function onGuardarPlantilla(proveedorId, plantilla) {
    if (!esSupabase) return;
    try { const upd = await actualizarProveedor(proveedorId, { plantilla }); setProveedores(ps=>ps.map(p=>p.id===proveedorId?upd:p)); }
    catch (e) { console.warn("[plantilla]", e?.message); }
  }

  // ── Guardar correlación de UN material para todos los proveedores ──
  async function onGuardarMaterial(materialId, seleccion) {
    if (!esSupabase) return;
    const nuevoCor = { ...(cor[materialId] || {}) };
    for (const p of proveedores) {
      const item = seleccion[p.id];
      const actual = cor[materialId]?.[p.id];
      if (item) {
        const guardada = await guardarCorrelacion({
          material_id: materialId, proveedor_id: p.id, nombre_proveedor: item.nombre,
          referencia: item.referencia, coste: item.coste, descuento: item.descuento,
          datos: item.datos || {}, proveedor_item_id: item.id,
        }, cid);
        nuevoCor[p.id] = guardada;
      } else if (actual?.id) {
        await borrarCorrelacion(actual.id);
        delete nuevoCor[p.id];
      }
    }
    setCor(prev => {
      const n = { ...prev };
      if (Object.keys(nuevoCor).length) n[materialId] = nuevoCor; else delete n[materialId];
      return n;
    });
  }

  const nItemsTotal = Object.values(itemsByProv).reduce((s,a)=>s+(a?.length||0),0);
  const SUB_TABS = [
    { id:"correlacion", label:"Correlación" },
    { id:"proveedores", label:`Proveedores (${proveedores.length})` },
    { id:"ficha",       label:"Ficha" },
  ];

  if (!esSupabase) {
    return (
      <div style={{ padding:40, textAlign:"center", color:C.sub }}>
        <Building2 size={36} style={{ opacity:.3, marginBottom:12 }}/>
        <p style={{ fontSize:14 }}>La gestión de proveedores requiere estar conectado a la base de datos de la empresa.</p>
      </div>
    );
  }

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", fontFamily:"var(--font-body)" }}>
      <div style={{ display:"flex", borderBottom:`1px solid ${C.line}`, padding:"0 24px", background:C.surface, flexShrink:0, alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex" }}>
          {SUB_TABS.map(t=>(
            <button key={t.id} onClick={()=>setSubTab(t.id)}
              style={{ padding:"12px 18px", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13.5, fontWeight:subTab===t.id?700:400, color:subTab===t.id?C.brand:C.sub, borderBottom:subTab===t.id?`2px solid ${C.brand}`:"2px solid transparent", marginBottom:-1 }}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          {subTab==="correlacion" && (
            <Btn onClick={()=>setWizardCorrelacion(true)} style={{ fontSize:12, padding:"5px 12px" }}>
              <Upload size={13}/> Importar Correlación
            </Btn>
          )}
          <button onClick={recargar} title="Recargar" style={{ background:"none", border:"none", color:C.dim, cursor:"pointer", padding:6, display:"flex" }}><RefreshCw size={15}/></button>
        </div>
      </div>

      {cargando ? (
        <div style={{ flex:1, display:"grid", placeItems:"center", color:C.sub }}><Loader size={22} className="spin"/></div>
      ) : subTab==="correlacion" ? (
        <CorrelacionClic materiales={materiales} proveedores={proveedores} itemsByProv={itemsByProv} cor={cor}
          onGuardarMaterial={onGuardarMaterial} onAbrirProveedores={()=>setSubTab("proveedores")}/>
      ) : subTab==="ficha" ? (
        <FichaProveedor
          proveedores={proveedores} itemsByProv={itemsByProv} cor={cor} pedidos={pedidos}
          onEditarProv={onEditarProv} onImportar={(id)=>{ setWizardProv(id); setSubTab("proveedores"); }}/>
      ) : (
        <div style={{ flex:1, overflowY:"auto" }}>
          <PanelProveedores proveedores={proveedores} itemsByProv={itemsByProv}
            principalId={principalId} onMarcarPrincipal={onMarcarPrincipal}
            onCrear={onCrearProv} onEditar={onEditarProv} onBorrar={onBorrarProv}
            onImportar={(id)=>setWizardProv(id)}/>
        </div>
      )}

      {wizardProv != null && proveedores.length>0 && (
        <WizardImportCatalogo proveedores={proveedores} provIdInicial={wizardProv}
          onGuardarCatalogo={onGuardarCatalogo} onGuardarPlantilla={onGuardarPlantilla}
          onCerrar={()=>{ setWizardProv(null); recargar(); }}/>
      )}

      {wizardCorrelacion && (
        <WizardImportCorrelacion
          proveedores={proveedores} materiales={materiales} cid={cid}
          onCrearProv={onCrearProv}
          onCerrar={()=>setWizardCorrelacion(false)}
          onTerminar={()=>{ recargar(); }}/>
      )}
    </div>
  );
}
