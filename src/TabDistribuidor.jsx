import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Plus, Trash2, Search, Upload, X, Check, Building2, Edit2, Save, Info, Loader } from "lucide-react";
import * as XLSX from "xlsx";
import { C, Btn } from "./lib/ui.jsx";
import {
  cargarProveedores, crearProveedor, actualizarProveedor, borrarProveedor,
  cargarCorrelacionesDeProveedor, guardarCorrelacion, guardarCorrelacionesLote, borrarCorrelacion,
} from "./lib/data.js";

function norm(s) {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
const COLORES_PROV = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#ec4899"];

// Roles asignables del Excel del proveedor (espejo de columnas del almacén).
// `nombre` es obligatorio; el resto son los campos que ESE proveedor aporta.
// Cada proveedor usa los que quiera (su plantilla); se guardan en correlaciones.datos.
const ROLES_WIZARD = [
  { key:"nombre",    label:"Nombre",      color:"#0e7490", req:true,  base:true },
  { key:"categoria", label:"Categoría",   color:"#2563eb", req:false, base:false },
  { key:"referencia",label:"Referencia",  color:"#7c3aed", req:false, base:true  },
  { key:"coste",     label:"Coste",       color:"#d97706", req:false, base:true  },
  { key:"descuento", label:"% Descuento", color:"#ef4444", req:false, base:true  },
];
// `base:true` = columna propia de la tabla correlaciones (referencia/coste/descuento);
// `base:false` = va a correlaciones.datos (jsonb): categoria y futuros campos.

// ══════════════════════════════════════════════════════════════════
// PanelProveedores — lista de empresas suministradoras (Supabase)
// ══════════════════════════════════════════════════════════════════
function PanelProveedores({ proveedores, onCrear, onEditar, onBorrar }) {
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
    <div style={{ maxWidth:700, margin:"0 auto", padding:24 }}>
      <h3 style={{ fontSize:18, color:C.ink, marginBottom:4 }}>Proveedores</h3>
      <p style={{ fontSize:13, color:C.sub, marginBottom:20 }}>
        Empresas que te suministran material. Cada una aparece como columna en la tabla de correlación, con su forma de nombrar cada material.
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
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {proveedores.map(p => (
            <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, background:C.surface, border:`1px solid ${C.line}`, borderRadius:10, padding:"10px 14px", borderLeft:`4px solid ${p.color||C.brand}` }}>
              {editId===p.id ? (
                <>
                  <input value={editData.nombre||""} onChange={e=>setEditData(d=>({...d,nombre:e.target.value}))}
                    style={{ flex:2, padding:"6px 8px", border:`1px solid ${C.strong}`, borderRadius:7, fontSize:13.5, fontFamily:"inherit", background:C.bg, color:C.ink }}/>
                  <input value={editData.contacto||""} onChange={e=>setEditData(d=>({...d,contacto:e.target.value}))}
                    style={{ flex:1.5, padding:"6px 8px", border:`1px solid ${C.strong}`, borderRadius:7, fontSize:13, fontFamily:"inherit", background:C.bg, color:C.ink }}/>
                  <Btn onClick={()=>guardarEdit(p.id)}><Save size={13}/> Guardar</Btn>
                  <button onClick={()=>setEditId(null)} style={{ background:"none", border:"none", color:C.dim, cursor:"pointer", padding:4, display:"flex" }}><X size={13}/></button>
                </>
              ) : (
                <>
                  <span style={{ flex:2, fontSize:14, fontWeight:600, color:C.ink }}>{p.nombre}</span>
                  <span style={{ flex:1.5, fontSize:12.5, color:C.sub }}>{p.contacto||"—"}</span>
                  <button onClick={()=>{ setEditId(p.id); setEditData({nombre:p.nombre,contacto:p.contacto||""}); }}
                    style={{ background:"none", border:"none", color:C.dim, cursor:"pointer", padding:4, display:"flex" }}
                    onMouseEnter={e=>e.currentTarget.style.color=C.ink} onMouseLeave={e=>e.currentTarget.style.color=C.dim}><Edit2 size={13}/></button>
                  <button onClick={()=>onBorrar(p)}
                    style={{ background:"none", border:"none", color:C.dim, cursor:"pointer", padding:4, display:"flex" }}
                    onMouseEnter={e=>e.currentTarget.style.color=C.danger} onMouseLeave={e=>e.currentTarget.style.color=C.dim}><Trash2 size={13}/></button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// EditableCell — celda inline editable (nombre del material para ese proveedor)
// ══════════════════════════════════════════════════════════════════
function EditableCell({ value, placeholder, active, onActivate, onCommit }) {
  const [val, setVal] = useState(value);
  const ref = useRef();
  useEffect(() => { setVal(value); }, [value, active]);
  useEffect(() => { if (active && ref.current) ref.current.select(); }, [active]);
  if (active) {
    return (
      <input ref={ref} value={val} autoFocus
        onChange={e=>setVal(e.target.value)} onBlur={()=>onCommit(val)}
        onKeyDown={e=>{ if(e.key==="Enter") onCommit(val); if(e.key==="Escape") onCommit(value); }}
        placeholder={placeholder}
        style={{ width:"100%", padding:"5px 6px", border:`1px solid ${C.brand}`, borderRadius:6, fontSize:13, fontFamily:"inherit", background:C.bg, color:C.ink, outline:"none" }}/>
    );
  }
  return (
    <div onClick={onActivate}
      style={{ padding:"5px 6px", fontSize:13, color:value?C.ink:C.dim, cursor:"text", borderRadius:6, border:"1px solid transparent", minHeight:28, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
      {value||placeholder}
    </div>
  );
}

// Tooltip con datos extra del proveedor (referencia/coste/descuento).
// Valor de un rol en una correlación: campos `base` están en columnas; el resto
// (categoria…) en correlacion.datos (jsonb).
function valorRol(cor, key) {
  const r = ROLES_WIZARD.find(x => x.key === key);
  if (!r) return null;
  return r.base ? cor?.[key] : cor?.datos?.[key];
}
function TooltipDatos({ cor }) {
  const [show, setShow] = useState(false);
  const extras = ROLES_WIZARD.filter(r => r.key!=="nombre").map(r => ({ r, v: valorRol(cor, r.key) }))
    .filter(({ v }) => v != null && v !== "");
  if (!extras.length) return null;
  return (
    <div style={{ position:"relative", display:"inline-flex", marginLeft:4 }}
      onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}>
      <Info size={11} color={C.dim} style={{ cursor:"default" }}/>
      {show && (
        <div style={{ position:"absolute", bottom:"calc(100% + 4px)", left:0, zIndex:50, background:C.surface, border:`1px solid ${C.line}`, borderRadius:8, padding:"8px 12px", boxShadow:"var(--shadow-lg)", minWidth:160, fontSize:12, color:C.ink, whiteSpace:"nowrap" }}>
          {extras.map(({ r, v })=>(
            <div key={r.key} style={{ display:"flex", justifyContent:"space-between", gap:12, padding:"2px 0" }}>
              <span style={{ color:C.sub }}>{r.label}</span><span style={{ fontWeight:600 }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TablaCorrelacion — filas = TUS materiales reales; columnas = proveedores.
// Cada celda = cómo llama ese proveedor a ese material (nombre_proveedor).
// `cor` es un mapa  cor[material_id][proveedor_id] = { nombre_proveedor, referencia, coste, descuento }
// ══════════════════════════════════════════════════════════════════
function TablaCorrelacion({ materiales, proveedores, cor, onCommitCelda, onImportar }) {
  const [buscar, setBuscar] = useState("");
  const [editCell, setEditCell] = useState(null);

  const filtrados = buscar.trim()
    ? materiales.filter(m => {
        const q = norm(buscar);
        if (norm(m.nombre).includes(q)) return true;
        const c = cor[m.id] || {};
        return Object.values(c).some(d => norm(d?.nombre_proveedor || "").includes(q));
      })
    : materiales;

  const MAT_W = 240, COL_W = 190;

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", padding:24 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12, flexWrap:"wrap", gap:8 }}>
        <div>
          <h3 style={{ fontSize:18, color:C.ink, marginBottom:3 }}>Correlación de materiales</h3>
          <p style={{ fontSize:13, color:C.sub }}>{materiales.length} materiales · {proveedores.length} proveedor{proveedores.length!==1?"es":""}. Escribe cómo llama cada proveedor a cada material.</p>
        </div>
        {proveedores.length>0 && materiales.length>0 && (
          <Btn onClick={onImportar}><Upload size={13}/> Importar Excel de proveedor</Btn>
        )}
      </div>

      <div style={{ position:"relative", marginBottom:12 }}>
        <Search size={14} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:C.dim }}/>
        <input value={buscar} onChange={e=>setBuscar(e.target.value)} placeholder="Buscar material o nombre en proveedor…"
          style={{ width:"100%", padding:"8px 12px 8px 30px", border:`1px solid ${C.strong}`, borderRadius:9, fontSize:13.5, fontFamily:"inherit", background:C.bg, color:C.ink }}/>
      </div>

      {proveedores.length===0 ? (
        <div style={{ textAlign:"center", padding:"48px 24px", color:C.sub, border:`1px dashed ${C.line}`, borderRadius:10 }}>
          <Building2 size={36} style={{ opacity:.3, marginBottom:12 }}/>
          <p style={{ fontSize:15, marginBottom:6 }}>Sin proveedores</p>
          <p style={{ fontSize:13 }}>Añade proveedores en la pestaña <strong>Proveedores</strong> para empezar a correlacionar.</p>
        </div>
      ) : materiales.length===0 ? (
        <div style={{ textAlign:"center", padding:"48px 24px", color:C.sub, border:`1px dashed ${C.line}`, borderRadius:10 }}>
          <p style={{ fontSize:14 }}>No tienes materiales en el almacén. Créalos en <strong>Almacén</strong> primero.</p>
        </div>
      ) : (
        <div style={{ flex:1, overflow:"auto", borderRadius:10, border:`1px solid ${C.line}` }}>
          <table style={{ borderCollapse:"collapse", minWidth:MAT_W+proveedores.length*COL_W }}>
            <thead>
              <tr style={{ background:C.s2 }}>
                <th style={{ position:"sticky", left:0, zIndex:3, background:C.s2, width:MAT_W, minWidth:MAT_W, padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:C.sub, letterSpacing:".06em", textTransform:"uppercase", borderBottom:`1px solid ${C.line}`, borderRight:`2px solid ${C.line}` }}>
                  Mi material
                </th>
                {proveedores.map(p=>(
                  <th key={p.id} style={{ width:COL_W, minWidth:COL_W, padding:"10px 14px", textAlign:"left", fontSize:12, fontWeight:700, color:"#fff", background:p.color||C.brand, borderBottom:`1px solid ${C.line}`, borderRight:`1px solid rgba(255,255,255,.2)`, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {p.nombre}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.length===0 && (
                <tr><td colSpan={proveedores.length+1} style={{ textAlign:"center", padding:"32px 24px", color:C.dim, fontSize:13 }}>Sin resultados para la búsqueda.</td></tr>
              )}
              {filtrados.map((m,idx)=>(
                <tr key={m.id} style={{ background:idx%2===0?C.bg:C.surface }}>
                  <td style={{ position:"sticky", left:0, zIndex:1, background:"inherit", padding:"8px 14px", borderBottom:`1px solid ${C.line}`, borderRight:`2px solid ${C.line}`, fontSize:13.5, fontWeight:600, color:C.ink }}>
                    {m.nombre}
                    {m.referencia && <span style={{ fontSize:11, color:C.dim, marginLeft:6 }}>{m.referencia}</span>}
                  </td>
                  {proveedores.map(p=>{
                    const datos = cor[m.id]?.[p.id];
                    const nombre = datos?.nombre_proveedor || "";
                    return (
                      <td key={p.id} style={{ padding:"4px 8px", borderBottom:`1px solid ${C.line}`, borderRight:`1px solid ${C.line}` }}>
                        <div style={{ display:"flex", alignItems:"center" }}>
                          <div style={{ flex:1 }}>
                            <EditableCell value={nombre} placeholder="—"
                              active={editCell?.mid===m.id && editCell?.pid===p.id}
                              onActivate={()=>setEditCell({mid:m.id,pid:p.id})}
                              onCommit={(v)=>{ setEditCell(null); if((v||"")!==nombre) onCommitCelda(m.id, p.id, v); }}/>
                          </div>
                          <TooltipDatos cor={datos}/>
                        </div>
                      </td>
                    );
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
// WizardImport — importa el Excel del proveedor y lo correlaciona con
// tus materiales por coincidencia de nombre (lo que no casa, se ignora;
// el usuario completa a mano lo que falte en la tabla).
// ══════════════════════════════════════════════════════════════════
function WizardImport({ proveedores, materiales, onGuardarLote, onGuardarPlantilla, onCerrar }) {
  const [paso, setPaso] = useState(0);
  const [provId, setProvId] = useState(proveedores[0]?.id || "");
  const [hojas, setHojas] = useState([]);
  const [hojaIdx, setHojaIdx] = useState(0);
  const [datos, setDatos] = useState([]);
  const [headerRow, setHeaderRow] = useState(0);
  const [colMap, setColMap] = useState({});
  const [activeRole, setActiveRole] = useState("nombre");
  const [guardarPl, setGuardarPl] = useState(true);

  // Pre-carga la plantilla guardada del proveedor (mapeo de columnas reusable).
  useEffect(() => {
    const pl = proveedores.find(p => String(p.id) === String(provId))?.plantilla;
    if (pl?.colMap) { setColMap(pl.colMap); if (pl.headerRow != null) setHeaderRow(pl.headerRow); }
    else { setColMap({}); }
  }, [provId, proveedores]);
  const [items, setItems] = useState([]);
  const [selec, setSelec] = useState([]);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const prov = proveedores.find(p=>p.id===provId);
  // Índice de materiales por nombre normalizado, para casar el Excel del proveedor.
  const matPorNombre = useMemo(() => {
    const m = new Map(); materiales.forEach(x => m.set(norm(x.nombre), x)); return m;
  }, [materiales]);

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

  function irARevision() {
    if (colMap.nombre==null) return;
    const rows = datos.slice(headerRow+1).filter(r=>r.some(c=>String(c).trim()));
    const parsed = rows.map(r=>{
      const obj = {};
      ROLES_WIZARD.forEach(rol=>{ if(colMap[rol.key]!=null) obj[rol.key]=String(r[colMap[rol.key]]??"").trim(); });
      return obj;
    }).filter(it=>it.nombre);
    // Casa cada nombre del proveedor con un material de la empresa (por nombre).
    const revisados = parsed.map(it=>{
      const mat = matPorNombre.get(norm(it.nombre));
      return { ...it, material_id: mat?.id || null, materialNombre: mat?.nombre || null };
    });
    setItems(revisados);
    // Por defecto, selecciona solo los que casan con un material.
    setSelec(revisados.map((it,i)=>it.material_id?i:null).filter(i=>i!=null));
    setPaso(2);
  }

  async function ejecutarImport() {
    setImportando(true);
    const num = (v) => v ? (Number(String(v).replace(",", ".")) || null) : null;
    const lote = selec.map(i=>items[i]).filter(it=>it.material_id).map(it=>{
      // Campos `base` -> columnas; campos `base:false` (categoria, …) -> datos jsonb.
      const datos = {};
      ROLES_WIZARD.forEach(r => { if (!r.base && r.key !== "nombre" && it[r.key]) datos[r.key] = it[r.key]; });
      return {
        material_id: it.material_id, nombre_proveedor: it.nombre,
        referencia: it.referencia || null, coste: num(it.coste), descuento: num(it.descuento),
        datos,
      };
    });
    try {
      await onGuardarLote(provId, lote);
      // Guarda la plantilla de mapeo del proveedor (reusable en próximos imports).
      if (guardarPl && onGuardarPlantilla) await onGuardarPlantilla(provId, { colMap, headerRow });
      setResultado({ guardados: lote.length, sinCasar: items.length - selec.length });
      setPaso(3);
    } catch(e) { alert("Error al guardar: "+(e?.message||e)); }
    finally { setImportando(false); }
  }

  const PASOS = ["Archivo","Columnas","Revisión","Completado"];
  const colByKey = Object.fromEntries(ROLES_WIZARD.map(r=>[r.key,r.color]));

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"grid", placeItems:"center", zIndex:300 }}>
      <div style={{ background:C.surface, borderRadius:18, width:"min(820px,96vw)", maxHeight:"92vh", display:"flex", flexDirection:"column", boxShadow:"var(--shadow-lg)", overflow:"hidden" }}>
        <div style={{ padding:"18px 24px", borderBottom:`1px solid ${C.line}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <h3 style={{ fontSize:17, color:C.ink, marginBottom:5 }}>Importar Excel del proveedor</h3>
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
              <p style={{ fontSize:12, color:C.sub, marginTop:10 }}>Casaremos cada fila con tus materiales por el nombre. Lo que no case, lo completas a mano en la tabla.</p>
            </div>
          )}
          {paso===1 && (
            <PasoColumnas {...{ hojas, hojaIdx, onHoja:onHojaChange, headerRow, setHeaderRow, headers, preview, rolDeCol, onAsignar:asignarCol, colMap, activeRole, setActiveRole, prov, colByKey }}/>
          )}
          {paso===2 && (
            <PasoRevision {...{ items, selec, onToggle:(i)=>setSelec(s=>s.includes(i)?s.filter(x=>x!==i):[...s,i]), prov, guardarPl, setGuardarPl, colMap }}/>
          )}
          {paso===3 && <PasoCompletado resultado={resultado}/>}
        </div>

        <div style={{ padding:"14px 24px", borderTop:`1px solid ${C.line}`, display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
          <div>
            {paso===1 && <Btn outline onClick={()=>setPaso(0)}>← Volver</Btn>}
            {paso===2 && <Btn outline onClick={()=>setPaso(1)}>← Volver</Btn>}
          </div>
          <div>
            {paso===0 && <span style={{ fontSize:12.5, color:C.sub }}>Selecciona proveedor y sube su Excel</span>}
            {paso===1 && <Btn onClick={irARevision} disabled={colMap.nombre==null}>Ver revisión →</Btn>}
            {paso===2 && <Btn onClick={ejecutarImport} disabled={importando||selec.length===0}>{importando?"Guardando…":`Guardar ${selec.length} correlación${selec.length===1?"":"es"}`}</Btn>}
            {paso===3 && <Btn onClick={onCerrar}>Cerrar</Btn>}
          </div>
        </div>
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

function PasoRevision({ items, selec, onToggle, prov, guardarPl, setGuardarPl, colMap }) {
  const casan = items.filter(it=>it.material_id).length;
  const camposAsignados = ROLES_WIZARD.filter(r => colMap?.[r.key] != null);
  return (
    <div>
      <p style={{ fontSize:14, color:C.ink, fontWeight:600, marginBottom:3 }}>{items.length} filas en el Excel para <span style={{ color:prov?.color }}>{prov?.nombre}</span></p>
      <p style={{ fontSize:12.5, color:C.sub, marginBottom:8 }}>
        <span style={{ color:C.ok }}>{casan} casan</span> con un material tuyo. <span style={{ color:C.dim }}>{items.length-casan} sin coincidencia</span> (se ignoran; complétalas a mano luego).
      </p>
      {/* Campos del proveedor que se guardarán */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
        {camposAsignados.map(r => (
          <span key={r.key} style={{ fontSize:11, fontWeight:600, color:"#fff", background:r.color, borderRadius:999, padding:"2px 9px" }}>{r.label}</span>
        ))}
      </div>
      <div style={{ maxHeight:320, overflowY:"auto", borderRadius:10, border:`1px solid ${C.line}` }}>
        <table style={{ borderCollapse:"collapse", width:"100%" }}>
          <thead>
            <tr style={{ background:C.s2, position:"sticky", top:0, zIndex:1 }}>
              <th style={{ width:36, padding:"9px 10px", borderBottom:`1px solid ${C.line}` }}/>
              <th style={{ padding:"9px 12px", textAlign:"left", fontSize:11, fontWeight:700, color:C.sub, textTransform:"uppercase", borderBottom:`1px solid ${C.line}` }}>Nombre proveedor</th>
              <th style={{ padding:"9px 12px", textAlign:"left", fontSize:11, fontWeight:700, color:C.sub, textTransform:"uppercase", borderBottom:`1px solid ${C.line}` }}>↔ Tu material</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it,i)=>{
              const checked = selec.includes(i); const casa = !!it.material_id;
              return (
                <tr key={i} style={{ background:checked?(i%2===0?C.bg:C.surface):"transparent", opacity:casa?(checked?1:.5):.35 }}>
                  <td style={{ padding:"7px 10px", textAlign:"center", borderBottom:`1px solid ${C.line}` }}>
                    <input type="checkbox" checked={checked} disabled={!casa} onChange={()=>onToggle(i)} style={{ cursor:casa?"pointer":"not-allowed" }}/>
                  </td>
                  <td style={{ padding:"7px 12px", fontSize:13, color:C.ink, borderBottom:`1px solid ${C.line}` }}>{it.nombre}</td>
                  <td style={{ padding:"7px 12px", fontSize:13, borderBottom:`1px solid ${C.line}`, color:casa?C.ok:C.dim }}>
                    {casa ? it.materialNombre : "sin coincidencia"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <label style={{ display:"flex", alignItems:"center", gap:8, marginTop:14, cursor:"pointer", fontSize:13, color:C.ink }}>
        <input type="checkbox" checked={guardarPl} onChange={e=>setGuardarPl(e.target.checked)} style={{ cursor:"pointer" }}/>
        Guardar plantilla de columnas de <strong>{prov?.nombre}</strong> (la próxima importación pre-asignará estas columnas).
      </label>
    </div>
  );
}

function PasoCompletado({ resultado }) {
  return (
    <div style={{ textAlign:"center", padding:"32px 24px" }}>
      <div style={{ width:56, height:56, borderRadius:999, background:C.okSoft, color:C.ok, display:"grid", placeItems:"center", margin:"0 auto 16px" }}><Check size={28}/></div>
      <h3 style={{ fontSize:18, color:C.ink, marginBottom:8 }}>Importación completada</h3>
      {resultado && (
        <p style={{ fontSize:14, color:C.sub, lineHeight:1.7 }}>
          <strong style={{ color:C.ok }}>{resultado.guardados} correlaciones</strong> guardadas.
          {resultado.sinCasar>0 && <><br/><span style={{ color:C.dim }}>{resultado.sinCasar} sin coincidencia (complétalas en la tabla).</span></>}
        </p>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TabDistribuidor (Proveedores) — export default
// ══════════════════════════════════════════════════════════════════
export default function TabDistribuidor({ empresa, materiales = [] }) {
  const cid = empresa?.id;
  const esSupabase = !!cid && cid !== "demo" && cid !== "local";

  const [proveedores, setProveedores] = useState([]);
  // cor[material_id][proveedor_id] = { id, nombre_proveedor, referencia, coste, descuento }
  const [cor, setCor] = useState({});
  const [cargando, setCargando] = useState(esSupabase);
  const [subTab, setSubTab] = useState("correlacion");
  const [wizard, setWizard] = useState(false);

  // Carga inicial: proveedores + sus correlaciones (selectiva por proveedor).
  const recargar = useCallback(async () => {
    if (!esSupabase) { setCargando(false); return; }
    setCargando(true);
    try {
      const provs = await cargarProveedores(cid);
      setProveedores(provs);
      const mapa = {};
      // Carga las correlaciones de cada proveedor (consultas indexadas, baratas).
      for (const p of provs) {
        const cs = await cargarCorrelacionesDeProveedor(p.id);
        cs.forEach(c => { (mapa[c.material_id] ||= {})[c.proveedor_id] = c; });
      }
      setCor(mapa);
    } catch (e) { console.warn("[Proveedores] carga:", e?.message); }
    finally { setCargando(false); }
  }, [cid, esSupabase]);

  useEffect(() => { recargar(); }, [recargar]);

  // ── Proveedores CRUD ──
  async function onCrearProv(p) { if (!esSupabase) return; const nuevo = await crearProveedor(p, cid); setProveedores(ps=>[...ps,nuevo]); }
  async function onEditarProv(id, cambios) { if (!esSupabase) return; const upd = await actualizarProveedor(id, cambios); setProveedores(ps=>ps.map(p=>p.id===id?upd:p)); }
  async function onBorrarProv(p) {
    if (!esSupabase) return;
    if (!confirm(`¿Eliminar el proveedor "${p.nombre}"? Se borrarán sus correlaciones.`)) return;
    await borrarProveedor(p.id);
    setProveedores(ps=>ps.filter(x=>x.id!==p.id));
    setCor(prev => { const n={}; for (const mid in prev){ const row={...prev[mid]}; delete row[p.id]; if(Object.keys(row).length) n[mid]=row; } return n; });
  }

  // ── Editar celda de correlación (upsert o borrar) ──
  async function onCommitCelda(materialId, proveedorId, valor) {
    if (!esSupabase) return;
    const v = (valor||"").trim();
    const actual = cor[materialId]?.[proveedorId];
    try {
      if (!v) { // vaciar = borrar correlación
        if (actual?.id) await borrarCorrelacion(actual.id);
        setCor(prev => { const n={...prev}; if(n[materialId]){ const row={...n[materialId]}; delete row[proveedorId]; n[materialId]=row; } return n; });
        return;
      }
      const guardada = await guardarCorrelacion({ material_id:materialId, proveedor_id:proveedorId, nombre_proveedor:v, referencia:actual?.referencia, coste:actual?.coste, descuento:actual?.descuento }, cid);
      setCor(prev => ({ ...prev, [materialId]: { ...(prev[materialId]||{}), [proveedorId]: guardada } }));
    } catch (e) { alert("No se pudo guardar: "+(e?.message||e)); }
  }

  // ── Import en lote ──
  async function onGuardarLote(proveedorId, lote) {
    if (!esSupabase) return;
    const guardadas = await guardarCorrelacionesLote(proveedorId, lote, cid);
    setCor(prev => { const n={...prev}; guardadas.forEach(c=>{ n[c.material_id]={ ...(n[c.material_id]||{}), [c.proveedor_id]:c }; }); return n; });
  }
  // Guarda la plantilla de mapeo de columnas del proveedor (reusable).
  async function onGuardarPlantilla(proveedorId, plantilla) {
    if (!esSupabase) return;
    try { const upd = await actualizarProveedor(proveedorId, { plantilla }); setProveedores(ps=>ps.map(p=>p.id===proveedorId?upd:p)); }
    catch (e) { console.warn("[plantilla]", e?.message); }
  }

  const SUB_TABS = [
    { id:"correlacion", label:"Correlación" },
    { id:"proveedores", label:`Proveedores (${proveedores.length})` },
  ];

  if (!esSupabase) {
    return (
      <div style={{ padding:40, textAlign:"center", color:C.sub }}>
        <Building2 size={36} style={{ opacity:.3, marginBottom:12 }}/>
        <p style={{ fontSize:14 }}>La gestión de proveedores requiere estar conectado a tu empresa (Supabase).</p>
      </div>
    );
  }

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", fontFamily:"var(--font-body)" }}>
      <div style={{ display:"flex", borderBottom:`1px solid ${C.line}`, padding:"0 24px", background:C.surface, flexShrink:0 }}>
        {SUB_TABS.map(t=>(
          <button key={t.id} onClick={()=>setSubTab(t.id)}
            style={{ padding:"12px 18px", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13.5, fontWeight:subTab===t.id?700:400, color:subTab===t.id?C.brand:C.sub, borderBottom:subTab===t.id?`2px solid ${C.brand}`:"2px solid transparent", marginBottom:-1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {cargando ? (
        <div style={{ flex:1, display:"grid", placeItems:"center", color:C.sub }}><Loader size={22} className="spin"/></div>
      ) : subTab==="correlacion" ? (
        <TablaCorrelacion materiales={materiales} proveedores={proveedores} cor={cor}
          onCommitCelda={onCommitCelda} onImportar={()=>setWizard(true)}/>
      ) : (
        <div style={{ flex:1, overflowY:"auto" }}>
          <PanelProveedores proveedores={proveedores} onCrear={onCrearProv} onEditar={onEditarProv} onBorrar={onBorrarProv}/>
        </div>
      )}

      {wizard && proveedores.length>0 && (
        <WizardImport proveedores={proveedores} materiales={materiales}
          onGuardarLote={onGuardarLote} onGuardarPlantilla={onGuardarPlantilla} onCerrar={()=>setWizard(false)}/>
      )}
    </div>
  );
}
