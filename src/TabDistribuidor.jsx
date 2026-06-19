import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Search, Upload, X, Check, Building2, Edit2, Save, Info } from "lucide-react";
import * as XLSX from "xlsx";
import { C, Btn } from "./lib/ui.jsx";

const KEY_PROVS      = (cid) => `lscale.dist_provs.${cid}`;
const KEY_FILAS      = (cid) => `lscale.dist_filas.${cid}`;
const KEY_PLANTILLAS = (cid) => `lscale.dist_plantillas.${cid}`;

function uid() { return `d_${Date.now()}_${Math.random().toString(36).slice(2,7)}`; }
function norm(s) {
  return (s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/\s+/g," ").trim();
}

const COLORES_PROV = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#ec4899"];

// Roles disponibles en el wizard — extensibles
const ROLES_WIZARD = [
  { key:"nombre",    label:"Nombre",      color:"#0e7490", req:true  },
  { key:"ref",       label:"Referencia",  color:"#7c3aed", req:false },
  { key:"stock",     label:"Stock",       color:"#16a34a", req:false },
  { key:"coste",     label:"Coste",       color:"#d97706", req:false },
  { key:"descuento", label:"% Descuento", color:"#ef4444", req:false },
];

// Datos por fila/proveedor: { nombre, ref, stock, coste, descuento }
// filas: [{ id, alias, proveedores: { provId: { nombre, ref, stock, coste, descuento } } }]
// plantillas: [{ provId, headerRow, colMap: { nombre: idx, ref: idx, ... } }]

// ══════════════════════════════════════════════════════════════════
// PanelProveedores
// ══════════════════════════════════════════════════════════════════
function PanelProveedores({ proveedores, setProveedores }) {
  const [nuevo,    setNuevo]   = useState({ nombre:"", contacto:"" });
  const [editId,   setEditId]  = useState(null);
  const [editData, setEditData]= useState({});

  function agregar() {
    if (!nuevo.nombre.trim()) return;
    const colorIdx = proveedores.length % COLORES_PROV.length;
    setProveedores(ps => [...ps, {
      id:uid(), nombre:nuevo.nombre.trim(), contacto:nuevo.contacto.trim(), color:COLORES_PROV[colorIdx],
    }]);
    setNuevo({ nombre:"", contacto:"" });
  }

  function guardarEdit(id) {
    setProveedores(ps => ps.map(p => p.id===id ? {...p,...editData} : p));
    setEditId(null);
  }

  function eliminar(id) {
    if (!confirm("¿Eliminar proveedor? Se perderán sus datos en la tabla de correlación.")) return;
    setProveedores(ps => ps.filter(p => p.id!==id));
  }

  return (
    <div style={{ maxWidth:700, margin:"0 auto", padding:24 }}>
      <h3 style={{ fontSize:18, color:C.ink, marginBottom:4 }}>Proveedores / Distribuidores</h3>
      <p style={{ fontSize:13, color:C.sub, marginBottom:20 }}>
        Empresas que suministran material. Cada una aparece como columna en la tabla de correlación.
      </p>

      <div style={{ display:"flex", gap:8, marginBottom:20, alignItems:"flex-end" }}>
        <div style={{ flex:2 }}>
          <label style={{ fontSize:11, color:C.sub, display:"block", marginBottom:3 }}>Nombre *</label>
          <input value={nuevo.nombre} onChange={e=>setNuevo(n=>({...n,nombre:e.target.value}))}
            onKeyDown={e=>e.key==="Enter"&&agregar()} placeholder="Ej: Eurocatering, Carrefour Pro…"
            style={{ width:"100%", padding:"8px 10px", border:`1px solid ${C.strong}`, borderRadius:8,
              fontSize:13.5, fontFamily:"inherit", background:C.bg, color:C.ink }}/>
        </div>
        <div style={{ flex:1.5 }}>
          <label style={{ fontSize:11, color:C.sub, display:"block", marginBottom:3 }}>Contacto / Email</label>
          <input value={nuevo.contacto} onChange={e=>setNuevo(n=>({...n,contacto:e.target.value}))}
            onKeyDown={e=>e.key==="Enter"&&agregar()} placeholder="email o teléfono"
            style={{ width:"100%", padding:"8px 10px", border:`1px solid ${C.strong}`, borderRadius:8,
              fontSize:13.5, fontFamily:"inherit", background:C.bg, color:C.ink }}/>
        </div>
        <Btn onClick={agregar} disabled={!nuevo.nombre.trim()}><Plus size={14}/> Añadir</Btn>
      </div>

      {proveedores.length === 0 ? (
        <div style={{ textAlign:"center", padding:"40px 24px", color:C.sub,
          border:`1px dashed ${C.line}`, borderRadius:10 }}>
          <Building2 size={32} style={{ opacity:.3, marginBottom:10 }}/>
          <p style={{ fontSize:14 }}>Sin proveedores. Añade el primero arriba.</p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {proveedores.map(p => (
            <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10,
              background:C.surface, border:`1px solid ${C.line}`, borderRadius:10, padding:"10px 14px",
              borderLeft:`4px solid ${p.color}` }}>
              {editId===p.id ? (
                <>
                  <input value={editData.nombre||""} onChange={e=>setEditData(d=>({...d,nombre:e.target.value}))}
                    style={{ flex:2, padding:"6px 8px", border:`1px solid ${C.strong}`, borderRadius:7,
                      fontSize:13.5, fontFamily:"inherit", background:C.bg, color:C.ink }}/>
                  <input value={editData.contacto||""} onChange={e=>setEditData(d=>({...d,contacto:e.target.value}))}
                    style={{ flex:1.5, padding:"6px 8px", border:`1px solid ${C.strong}`, borderRadius:7,
                      fontSize:13, fontFamily:"inherit", background:C.bg, color:C.ink }}/>
                  <Btn onClick={()=>guardarEdit(p.id)}><Save size={13}/> Guardar</Btn>
                  <button onClick={()=>setEditId(null)}
                    style={{ background:"none", border:"none", color:C.dim, cursor:"pointer", padding:4, display:"flex" }}>
                    <X size={13}/>
                  </button>
                </>
              ) : (
                <>
                  <span style={{ flex:2, fontSize:14, fontWeight:600, color:C.ink }}>{p.nombre}</span>
                  <span style={{ flex:1.5, fontSize:12.5, color:C.sub }}>{p.contacto||"—"}</span>
                  <button onClick={()=>{ setEditId(p.id); setEditData({nombre:p.nombre,contacto:p.contacto}); }}
                    style={{ background:"none", border:"none", color:C.dim, cursor:"pointer", padding:4, display:"flex" }}
                    onMouseEnter={e=>e.currentTarget.style.color=C.ink}
                    onMouseLeave={e=>e.currentTarget.style.color=C.dim}>
                    <Edit2 size={13}/>
                  </button>
                  <button onClick={()=>eliminar(p.id)}
                    style={{ background:"none", border:"none", color:C.dim, cursor:"pointer", padding:4, display:"flex" }}
                    onMouseEnter={e=>e.currentTarget.style.color=C.danger}
                    onMouseLeave={e=>e.currentTarget.style.color=C.dim}>
                    <Trash2 size={13}/>
                  </button>
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
// EditableCell
// ══════════════════════════════════════════════════════════════════
function EditableCell({ value, placeholder, bold, active, onActivate, onDeactivate, onChange }) {
  const ref = useRef();
  useEffect(() => { if (active && ref.current) ref.current.select(); }, [active]);
  if (active) {
    return (
      <input ref={ref} value={value} autoFocus
        onChange={e=>onChange(e.target.value)} onBlur={onDeactivate}
        onKeyDown={e=>{ if(e.key==="Enter"||e.key==="Escape") onDeactivate(); }}
        placeholder={placeholder}
        style={{ width:"100%", padding:"5px 6px", border:`1px solid ${C.brand}`, borderRadius:6,
          fontSize:13, fontFamily:"inherit", fontWeight:bold?600:400,
          background:C.bg, color:C.ink, outline:"none" }}/>
    );
  }
  return (
    <div onClick={onActivate}
      style={{ padding:"5px 6px", fontSize:13, color:value?C.ink:C.dim,
        fontWeight:bold&&value?600:400, cursor:"text", borderRadius:6,
        border:"1px solid transparent", minHeight:28,
        whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
      {value||placeholder}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Tooltip de datos extra del proveedor
// ══════════════════════════════════════════════════════════════════
function TooltipDatos({ datos }) {
  const [show, setShow] = useState(false);
  const extras = ROLES_WIZARD.filter(r => r.key!=="nombre" && datos?.[r.key]);
  if (!extras.length) return null;
  return (
    <div style={{ position:"relative", display:"inline-flex", marginLeft:4 }}
      onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}>
      <Info size={11} color={C.dim} style={{ cursor:"default" }}/>
      {show && (
        <div style={{ position:"absolute", bottom:"calc(100% + 4px)", left:0, zIndex:50,
          background:C.surface, border:`1px solid ${C.line}`, borderRadius:8, padding:"8px 12px",
          boxShadow:"var(--shadow-lg)", minWidth:160, fontSize:12, color:C.ink, whiteSpace:"nowrap" }}>
          {extras.map(r => (
            <div key={r.key} style={{ display:"flex", justifyContent:"space-between", gap:12, padding:"2px 0" }}>
              <span style={{ color:C.sub }}>{r.label}</span>
              <span style={{ fontWeight:600 }}>{datos[r.key]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TablaCorrelacion
// ══════════════════════════════════════════════════════════════════
function TablaCorrelacion({ filas, setFilas, proveedores, onImportar }) {
  const [buscar,   setBuscar]   = useState("");
  const [editCell, setEditCell] = useState(null);

  function actualizarAlias(filaId, valor) {
    setFilas(fs => fs.map(f => f.id===filaId ? {...f, alias:valor} : f));
  }

  function actualizarNombreProv(filaId, provId, valor) {
    setFilas(fs => fs.map(f => {
      if (f.id!==filaId) return f;
      const datosPrev = f.proveedores?.[provId] || {};
      return { ...f, proveedores:{ ...f.proveedores, [provId]:{ ...datosPrev, nombre:valor } } };
    }));
  }

  function agregarFila() {
    setFilas(fs => [...fs, { id:uid(), alias:"", proveedores:{} }]);
  }

  function eliminarFila(id) {
    setFilas(fs => fs.filter(f => f.id!==id));
  }

  const filtradas = buscar.trim()
    ? filas.filter(f => {
        const q = norm(buscar);
        return norm(f.alias).includes(q) ||
          Object.values(f.proveedores||{}).some(d =>
            norm(typeof d==="string"?d:d?.nombre||"").includes(q)
          );
      })
    : filas;

  const ALIAS_W = 220;
  const COL_W   = 190;

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", padding:24 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        marginBottom:12, flexWrap:"wrap", gap:8 }}>
        <div>
          <h3 style={{ fontSize:18, color:C.ink, marginBottom:3 }}>Correlación de materiales</h3>
          <p style={{ fontSize:13, color:C.sub }}>
            {filas.length} alias · {proveedores.length} proveedor{proveedores.length!==1?"es":""}
          </p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <Btn outline onClick={agregarFila}><Plus size={13}/> Nueva fila</Btn>
          {proveedores.length>0 && (
            <Btn onClick={onImportar}><Upload size={13}/> Importar Excel</Btn>
          )}
        </div>
      </div>

      <div style={{ position:"relative", marginBottom:12 }}>
        <Search size={14} style={{ position:"absolute", left:10, top:"50%",
          transform:"translateY(-50%)", color:C.dim }}/>
        <input value={buscar} onChange={e=>setBuscar(e.target.value)}
          placeholder="Buscar alias o nombre en proveedor…"
          style={{ width:"100%", padding:"8px 12px 8px 30px", border:`1px solid ${C.strong}`,
            borderRadius:9, fontSize:13.5, fontFamily:"inherit", background:C.bg, color:C.ink }}/>
      </div>

      {proveedores.length===0 ? (
        <div style={{ textAlign:"center", padding:"48px 24px", color:C.sub,
          border:`1px dashed ${C.line}`, borderRadius:10 }}>
          <Building2 size={36} style={{ opacity:.3, marginBottom:12 }}/>
          <p style={{ fontSize:15, marginBottom:6 }}>Sin proveedores</p>
          <p style={{ fontSize:13 }}>Añade proveedores en la pestaña <strong>Proveedores</strong>.</p>
        </div>
      ) : (
        <div style={{ flex:1, overflow:"auto", borderRadius:10, border:`1px solid ${C.line}` }}>
          <table style={{ borderCollapse:"collapse", minWidth:ALIAS_W+44+proveedores.length*COL_W }}>
            <thead>
              <tr style={{ background:C.s2 }}>
                <th style={{ position:"sticky", left:0, zIndex:3, background:C.s2,
                  width:ALIAS_W, minWidth:ALIAS_W, padding:"10px 14px", textAlign:"left",
                  fontSize:11, fontWeight:700, color:C.sub, letterSpacing:".06em",
                  textTransform:"uppercase", borderBottom:`1px solid ${C.line}`,
                  borderRight:`2px solid ${C.line}` }}>
                  Alias (nombre interno)
                </th>
                {proveedores.map(p => (
                  <th key={p.id}
                    style={{ width:COL_W, minWidth:COL_W, padding:"10px 14px", textAlign:"left",
                      fontSize:12, fontWeight:700, color:"#fff", background:p.color,
                      borderBottom:`1px solid ${C.line}`,
                      borderRight:`1px solid rgba(255,255,255,.2)`,
                      whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {p.nombre}
                  </th>
                ))}
                <th style={{ width:44, minWidth:44, background:C.s2, borderBottom:`1px solid ${C.line}` }}/>
              </tr>
            </thead>
            <tbody>
              {filtradas.length===0 && (
                <tr><td colSpan={proveedores.length+2}
                  style={{ textAlign:"center", padding:"32px 24px", color:C.dim, fontSize:13 }}>
                  {filas.length===0
                    ? "Sin filas. Añade una nueva fila o importa desde Excel."
                    : "Sin resultados para la búsqueda."}
                </td></tr>
              )}
              {filtradas.map((fila,idx) => (
                <tr key={fila.id}
                  style={{ background:idx%2===0?C.bg:C.surface }}
                  onMouseEnter={e=>e.currentTarget.style.background=C.brandSoft}
                  onMouseLeave={e=>e.currentTarget.style.background=idx%2===0?C.bg:C.surface}>
                  <td style={{ position:"sticky", left:0, zIndex:1, background:"inherit",
                    padding:"4px 8px", borderBottom:`1px solid ${C.line}`,
                    borderRight:`2px solid ${C.line}` }}>
                    <EditableCell value={fila.alias} placeholder="Nombre interno…" bold
                      active={editCell?.filaId===fila.id && editCell?.campo==="alias"}
                      onActivate={()=>setEditCell({filaId:fila.id,campo:"alias"})}
                      onDeactivate={()=>setEditCell(null)}
                      onChange={v=>actualizarAlias(fila.id,v)}/>
                  </td>
                  {proveedores.map(p => {
                    const datos = fila.proveedores?.[p.id];
                    const nombre = typeof datos==="string" ? datos : datos?.nombre || "";
                    return (
                      <td key={p.id} style={{ padding:"4px 8px", borderBottom:`1px solid ${C.line}`,
                        borderRight:`1px solid ${C.line}` }}>
                        <div style={{ display:"flex", alignItems:"center" }}>
                          <div style={{ flex:1 }}>
                            <EditableCell value={nombre} placeholder="—"
                              active={editCell?.filaId===fila.id && editCell?.campo===p.id}
                              onActivate={()=>setEditCell({filaId:fila.id,campo:p.id})}
                              onDeactivate={()=>setEditCell(null)}
                              onChange={v=>actualizarNombreProv(fila.id,p.id,v)}/>
                          </div>
                          <TooltipDatos datos={typeof datos==="object"?datos:null}/>
                        </div>
                      </td>
                    );
                  })}
                  <td style={{ padding:"4px 6px", borderBottom:`1px solid ${C.line}`, textAlign:"center" }}>
                    <button onClick={()=>eliminarFila(fila.id)}
                      style={{ background:"none", border:"none", color:C.dim, cursor:"pointer", padding:3, display:"flex" }}
                      onMouseEnter={e=>e.currentTarget.style.color=C.danger}
                      onMouseLeave={e=>e.currentTarget.style.color=C.dim}>
                      <Trash2 size={12}/>
                    </button>
                  </td>
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
// Wizard de Importación
// ══════════════════════════════════════════════════════════════════
function WizardImport({ proveedores, filas, setFilas, plantillas, setPlantillas, onCerrar }) {
  const [paso,       setPaso]      = useState(0);
  const [provId,     setProvId]    = useState(proveedores[0]?.id||"");
  const [hojas,      setHojas]     = useState([]);
  const [hojaIdx,    setHojaIdx]   = useState(0);
  const [datos,      setDatos]     = useState([]);
  const [headerRow,  setHeaderRow] = useState(0);
  // colMap: { nombre: idx|null, ref: idx|null, stock: idx|null, coste: idx|null, descuento: idx|null }
  const [colMap,     setColMap]    = useState({});
  const [activeRole, setActiveRole]= useState("nombre"); // rol que se asignará en el próximo clic
  const [items,      setItems]     = useState([]);
  const [selec,      setSelec]     = useState([]);
  const [importando, setImportando]= useState(false);
  const [resultado,  setResultado] = useState(null);
  const [guardarPl,  setGuardarPl] = useState(true);

  const prov            = proveedores.find(p=>p.id===provId);
  const plantillaExiste = plantillas.find(pl=>pl.provId===provId);

  useEffect(() => {
    const pl = plantillas.find(p=>p.provId===provId);
    if (pl) {
      setHeaderRow(pl.headerRow??0);
      setColMap(pl.colMap??{});
    } else {
      setHeaderRow(0); setColMap({});
    }
    setActiveRole("nombre");
  }, [provId]);

  function leerArchivo(file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type:"array" });
        const sheets = wb.SheetNames.map(name => ({
          name, data:XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:""}),
        }));
        setHojas(sheets); setHojaIdx(0);
        setDatos(sheets[0]?.data||[]);
        setPaso(1);
      } catch(e) { alert("Error leyendo el archivo: "+e.message); }
    };
    reader.readAsArrayBuffer(file);
  }

  function onHojaChange(idx) {
    setHojaIdx(idx); setDatos(hojas[idx]?.data||[]);
    setColMap({}); setActiveRole("nombre");
  }

  function asignarCol(colIdx) {
    // Si la columna ya tiene un rol, quitar ese rol
    const rolesRev = Object.entries(colMap).find(([,v])=>v===colIdx);
    if (rolesRev) {
      const [rolExistente] = rolesRev;
      setColMap(m=>{ const n={...m}; delete n[rolExistente]; return n; });
      return;
    }
    // Si el rol activo ya tiene columna, solo reasigna
    setColMap(m=>({ ...m, [activeRole]: colIdx }));
    // Avanzar al siguiente rol no asignado
    const ordered = ROLES_WIZARD.map(r=>r.key);
    const nextFree = ordered.find(k=>k!==activeRole && colMap[k]==null);
    if (nextFree) setActiveRole(nextFree);
  }

  function rolDeCol(colIdx) {
    return Object.entries(colMap).find(([,v])=>v===colIdx)?.[0]||null;
  }

  const headers = datos[headerRow]||[];
  const preview = datos.slice(headerRow+1, headerRow+6);

  function irARevision() {
    if (colMap.nombre==null) return;
    const rows = datos.slice(headerRow+1).filter(r=>r.some(c=>String(c).trim()));
    const parsed = rows.map(r => {
      const obj = {};
      ROLES_WIZARD.forEach(rol => {
        if (colMap[rol.key]!=null) obj[rol.key]=String(r[colMap[rol.key]]??"").trim();
      });
      return obj;
    }).filter(it=>it.nombre);

    const revisados = parsed.map(it => {
      const n = norm(it.nombre);
      const idx = filas.findIndex(f =>
        norm(f.alias)===n ||
        Object.values(f.proveedores||{}).some(d=>
          norm(typeof d==="string"?d:d?.nombre||"")===n
        )
      );
      return { ...it, tipo:idx>=0?"actualiza":"nuevo", filaIdx:idx };
    });

    setItems(revisados);
    setSelec(revisados.map((_,i)=>i));
    setPaso(2);
  }

  function toggleSelec(i) { setSelec(s=>s.includes(i)?s.filter(x=>x!==i):[...s,i]); }

  async function ejecutarImport() {
    setImportando(true);
    let nuevos=0, actualizados=0;
    const next=[...filas];

    for (const i of selec) {
      const it = items[i];
      const datosGuardar = {};
      ROLES_WIZARD.forEach(r=>{ if(it[r.key]) datosGuardar[r.key]=it[r.key]; });

      if (it.tipo==="actualiza" && it.filaIdx>=0) {
        const prev = next[it.filaIdx].proveedores?.[provId]||{};
        next[it.filaIdx]={ ...next[it.filaIdx],
          proveedores:{ ...next[it.filaIdx].proveedores,
            [provId]: typeof prev==="string"
              ? { nombre:prev, ...datosGuardar }
              : { ...prev, ...datosGuardar }
          }
        };
        actualizados++;
      } else {
        next.push({ id:uid(), alias:"", proveedores:{ [provId]:datosGuardar } });
        nuevos++;
      }
    }

    setFilas(next);

    if (guardarPl) {
      const pl = { provId, headerRow, colMap };
      setPlantillas(ps => {
        const idx=ps.findIndex(p=>p.provId===provId);
        if(idx>=0){ const n=[...ps]; n[idx]=pl; return n; }
        return [...ps,pl];
      });
    }

    setResultado({ nuevos, actualizados });
    setImportando(false);
    setPaso(3);
  }

  const PASOS=["Archivo","Columnas","Revisión","Completado"];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)",
      display:"grid", placeItems:"center", zIndex:300 }}>
      <div style={{ background:C.surface, borderRadius:18, width:"min(820px,96vw)",
        maxHeight:"92vh", display:"flex", flexDirection:"column",
        boxShadow:"var(--shadow-lg)", overflow:"hidden" }}>

        {/* Cabecera */}
        <div style={{ padding:"18px 24px", borderBottom:`1px solid ${C.line}`,
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <h3 style={{ fontSize:17, color:C.ink, marginBottom:5 }}>Importar materiales del proveedor</h3>
            <div style={{ display:"flex", alignItems:"center", gap:0 }}>
              {PASOS.map((s,i)=>(
                <React.Fragment key={s}>
                  <span style={{ fontSize:12, fontWeight:i===paso?700:400,
                    color:i<paso?C.ok:i===paso?C.brand:C.dim,
                    display:"flex", alignItems:"center", gap:3 }}>
                    {i<paso&&<Check size={11}/>}{s}
                  </span>
                  {i<PASOS.length-1&&<span style={{fontSize:12,color:C.dim,margin:"0 6px"}}>›</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
          <button onClick={onCerrar}
            style={{ background:"none", border:"none", color:C.dim, cursor:"pointer", padding:6, display:"flex" }}>
            <X size={18}/>
          </button>
        </div>

        {/* Cuerpo */}
        <div style={{ flex:1, overflowY:"auto", padding:24 }}>
          {paso===0 && <PasoArchivo proveedores={proveedores} provId={provId} setProvId={setProvId}
            plantillaExiste={plantillaExiste} onFile={leerArchivo}/>}
          {paso===1 && <PasoColumnas hojas={hojas} hojaIdx={hojaIdx} onHoja={onHojaChange}
            headerRow={headerRow} setHeaderRow={setHeaderRow}
            headers={headers} preview={preview}
            rolDeCol={rolDeCol} onAsignar={asignarCol}
            colMap={colMap} activeRole={activeRole} setActiveRole={setActiveRole}
            prov={prov} plantillaExiste={plantillaExiste}/>}
          {paso===2 && <PasoRevision items={items} selec={selec} onToggle={toggleSelec}
            onToggleAll={()=>selec.length===items.length?setSelec([]):setSelec(items.map((_,i)=>i))}
            prov={prov} guardarPl={guardarPl} setGuardarPl={setGuardarPl}
            plantillaExiste={plantillaExiste}/>}
          {paso===3 && <PasoCompletado resultado={resultado}/>}
        </div>

        {/* Footer */}
        <div style={{ padding:"14px 24px", borderTop:`1px solid ${C.line}`,
          display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
          <div>
            {paso===1&&<Btn outline onClick={()=>setPaso(0)}>← Volver</Btn>}
            {paso===2&&<Btn outline onClick={()=>setPaso(1)}>← Volver</Btn>}
          </div>
          <div>
            {paso===0&&<span style={{fontSize:12.5,color:C.sub}}>Selecciona proveedor y sube su Excel</span>}
            {paso===1&&(
              <Btn onClick={irARevision} disabled={colMap.nombre==null}>
                Ver revisión ({datos.slice(headerRow+1).filter(r=>r.some(c=>String(c).trim())).length} filas) →
              </Btn>
            )}
            {paso===2&&(
              <Btn onClick={ejecutarImport} disabled={importando||selec.length===0}>
                {importando?"Importando…":`Importar ${selec.length} ítem${selec.length===1?"":"s"}`}
              </Btn>
            )}
            {paso===3&&<Btn onClick={onCerrar}>Cerrar</Btn>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Paso 0 ─────────────────────────────────────────────────────
function PasoArchivo({ proveedores, provId, setProvId, plantillaExiste, onFile }) {
  const inputRef = useRef();
  return (
    <div style={{ maxWidth:480 }}>
      <div style={{ marginBottom:20 }}>
        <label style={{ fontSize:12, color:C.sub, display:"block", marginBottom:5 }}>Proveedor *</label>
        <select value={provId} onChange={e=>setProvId(e.target.value)}
          style={{ width:"100%", padding:"9px 10px", border:`1px solid ${C.strong}`, borderRadius:8,
            fontSize:14, fontFamily:"inherit", background:C.bg, color:C.ink }}>
          {proveedores.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        {plantillaExiste&&(
          <p style={{ fontSize:12, color:C.ok, marginTop:6 }}>
            ✓ Plantilla guardada — las columnas se pre-asignarán en el paso siguiente.
          </p>
        )}
      </div>
      <label style={{ fontSize:12, color:C.sub, display:"block", marginBottom:5 }}>Archivo Excel *</label>
      <div onClick={()=>inputRef.current?.click()}
        style={{ border:`2px dashed ${C.strong}`, borderRadius:12, padding:"32px 24px",
          textAlign:"center", cursor:"pointer", color:C.sub, transition:"border-color .15s" }}
        onMouseEnter={e=>e.currentTarget.style.borderColor=C.brand}
        onMouseLeave={e=>e.currentTarget.style.borderColor=C.strong}
        onDragOver={e=>e.preventDefault()}
        onDrop={e=>{ e.preventDefault(); const f=e.dataTransfer.files[0]; if(f) onFile(f); }}>
        <Upload size={28} style={{ opacity:.4, marginBottom:10 }}/>
        <p style={{ fontSize:14, marginBottom:4 }}>Arrastra aquí o haz clic para seleccionar</p>
        <p style={{ fontSize:12 }}>.xlsx · .xls · .csv</p>
      </div>
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:"none" }}
        onChange={e=>{ if(e.target.files[0]) onFile(e.target.files[0]); }}/>
    </div>
  );
}

// ── Paso 1 ─────────────────────────────────────────────────────
function PasoColumnas({ hojas, hojaIdx, onHoja, headerRow, setHeaderRow,
  headers, preview, rolDeCol, onAsignar, colMap, activeRole, setActiveRole,
  prov, plantillaExiste }) {

  const coloresByKey = Object.fromEntries(ROLES_WIZARD.map(r=>[r.key,r.color]));

  return (
    <div>
      <div style={{ display:"flex", gap:12, marginBottom:16, flexWrap:"wrap", alignItems:"flex-end" }}>
        {hojas.length>1&&(
          <div>
            <label style={{ fontSize:12, color:C.sub, display:"block", marginBottom:4 }}>Hoja</label>
            <select value={hojaIdx} onChange={e=>onHoja(+e.target.value)}
              style={{ padding:"7px 10px", border:`1px solid ${C.strong}`, borderRadius:8,
                fontSize:13.5, fontFamily:"inherit", background:C.bg, color:C.ink }}>
              {hojas.map((h,i)=><option key={i} value={i}>{h.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label style={{ fontSize:12, color:C.sub, display:"block", marginBottom:4 }}>Fila cabecera (nº)</label>
          <input type="number" min={1} max={20} value={headerRow+1}
            onChange={e=>setHeaderRow(Math.max(0,+e.target.value-1))}
            style={{ width:70, padding:"7px 10px", border:`1px solid ${C.strong}`, borderRadius:8,
              fontSize:13.5, fontFamily:"inherit", background:C.bg, color:C.ink, textAlign:"center" }}/>
        </div>
      </div>

      {plantillaExiste&&(
        <div style={{ background:C.okSoft, border:`1px solid ${C.ok}33`, borderRadius:8,
          padding:"8px 12px", marginBottom:12, fontSize:12.5, color:C.ok }}>
          Plantilla de <strong>{prov?.nombre}</strong> aplicada. Ajusta si el formato ha cambiado.
        </div>
      )}

      {/* Selector de rol activo */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, flexWrap:"wrap" }}>
        <span style={{ fontSize:12.5, color:C.sub }}>Asignar columna como:</span>
        {ROLES_WIZARD.map(r => {
          const asignada = colMap[r.key]!=null;
          const activo   = activeRole===r.key;
          return (
            <button key={r.key} onClick={()=>setActiveRole(r.key)}
              style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius:999,
                border:`1.5px solid ${asignada?r.color:activo?r.color:C.strong}`,
                background:activo?r.color:asignada?`${r.color}20`:"transparent",
                color:activo?"#fff":asignada?r.color:C.sub,
                fontSize:12, fontWeight:activo||asignada?700:400, cursor:"pointer", fontFamily:"inherit",
                transition:"all .1s" }}>
              {asignada&&<Check size={10}/>}
              {r.label}{r.req?" *":""}
            </button>
          );
        })}
      </div>
      <p style={{ fontSize:12, color:C.sub, marginBottom:8 }}>
        Haz clic en una cabecera de la tabla para asignarla al rol seleccionado (resaltado arriba).
        Vuelve a hacer clic en una columna ya asignada para quitarle el rol.
      </p>

      {headers.length===0 ? (
        <p style={{ color:C.dim, fontSize:13 }}>Sin datos. Ajusta la fila de cabecera.</p>
      ) : (
        <div style={{ overflowX:"auto", borderRadius:10, border:`1px solid ${C.line}` }}>
          <table style={{ borderCollapse:"collapse", width:"100%" }}>
            <thead>
              <tr>
                {headers.map((h,i)=>{
                  const rol = rolDeCol(i);
                  const color = rol?coloresByKey[rol]:null;
                  return (
                    <th key={i} onClick={()=>onAsignar(i)}
                      style={{ padding:"10px 12px", textAlign:"left", fontSize:13, fontWeight:600,
                        background:color||C.s2, color:color?"#fff":C.ink,
                        border:`1px solid ${C.line}`, cursor:"pointer", userSelect:"none",
                        whiteSpace:"nowrap", transition:"background .1s" }}>
                      {rol&&<span style={{fontSize:10,marginRight:4,opacity:.9}}>
                        {ROLES_WIZARD.find(r=>r.key===rol)?.label}{" "}
                      </span>}
                      {String(h||"(vacío)")}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {preview.map((row,ri)=>(
                <tr key={ri} style={{ background:ri%2===0?C.bg:C.surface }}>
                  {headers.map((_,ci)=>{
                    const rol=rolDeCol(ci);
                    const color=rol?coloresByKey[rol]:null;
                    return (
                      <td key={ci} style={{ padding:"7px 12px", fontSize:12.5, color:C.ink,
                        border:`1px solid ${C.line}`,
                        background:color?`${color}15`:"inherit" }}>
                        {String(row[ci]??"")}
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

// ── Paso 2 ─────────────────────────────────────────────────────
function PasoRevision({ items, selec, onToggle, onToggleAll, prov, guardarPl, setGuardarPl, plantillaExiste }) {
  const rolesPresentes = ROLES_WIZARD.filter(r => items.some(it=>it[r.key]));
  const nuevos    = items.filter(it=>it.tipo==="nuevo").length;
  const actualiza = items.filter(it=>it.tipo==="actualiza").length;

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
        <div>
          <p style={{ fontSize:14, color:C.ink, fontWeight:600, marginBottom:3 }}>
            {items.length} ítems detectados para{" "}
            <span style={{ color:prov?.color }}>{prov?.nombre}</span>
          </p>
          <p style={{ fontSize:12.5, color:C.sub }}>
            {nuevos>0&&<span style={{color:C.brand,marginRight:12}}>+ {nuevos} nuevas filas</span>}
            {actualiza>0&&<span style={{color:C.ok}}>↻ {actualiza} actualizaciones</span>}
          </p>
        </div>
        <button onClick={onToggleAll}
          style={{ fontSize:12, color:C.brand, background:"none", border:"none",
            cursor:"pointer", fontFamily:"inherit" }}>
          {selec.length===items.length?"Desmarcar todo":"Marcar todo"}
        </button>
      </div>

      <div style={{ maxHeight:300, overflowY:"auto", borderRadius:10, border:`1px solid ${C.line}` }}>
        <table style={{ borderCollapse:"collapse", width:"100%" }}>
          <thead>
            <tr style={{ background:C.s2, position:"sticky", top:0, zIndex:1 }}>
              <th style={{ width:36, padding:"9px 10px", borderBottom:`1px solid ${C.line}` }}/>
              {rolesPresentes.map(r=>(
                <th key={r.key} style={{ padding:"9px 12px", textAlign:"left",
                  fontSize:11, fontWeight:700, color:C.sub, letterSpacing:".06em",
                  textTransform:"uppercase", borderBottom:`1px solid ${C.line}` }}>
                  {r.label}
                </th>
              ))}
              <th style={{ padding:"9px 12px", textAlign:"center", fontSize:11, fontWeight:700,
                color:C.sub, letterSpacing:".06em", textTransform:"uppercase",
                borderBottom:`1px solid ${C.line}` }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it,i)=>{
              const checked=selec.includes(i);
              return (
                <tr key={i} style={{ background:checked?(i%2===0?C.bg:C.surface):"transparent", opacity:checked?1:.4 }}>
                  <td style={{ padding:"7px 10px", textAlign:"center", borderBottom:`1px solid ${C.line}` }}>
                    <input type="checkbox" checked={checked} onChange={()=>onToggle(i)} style={{ cursor:"pointer" }}/>
                  </td>
                  {rolesPresentes.map(r=>(
                    <td key={r.key} style={{ padding:"7px 12px", fontSize:13, color:C.ink, borderBottom:`1px solid ${C.line}` }}>
                      {it[r.key]||"—"}
                    </td>
                  ))}
                  <td style={{ padding:"7px 12px", textAlign:"center", borderBottom:`1px solid ${C.line}` }}>
                    {it.tipo==="nuevo"
                      ? <span style={{fontSize:11,fontWeight:700,color:C.brand,background:C.brandSoft,padding:"2px 8px",borderRadius:999}}>+ Nueva fila</span>
                      : <span style={{fontSize:11,fontWeight:700,color:C.ok,background:C.okSoft,padding:"2px 8px",borderRadius:999}}>↻ Actualiza</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <label style={{ display:"flex", alignItems:"center", gap:8, marginTop:16,
        cursor:"pointer", fontSize:13.5, color:C.ink }}>
        <input type="checkbox" checked={guardarPl} onChange={e=>setGuardarPl(e.target.checked)} style={{ cursor:"pointer" }}/>
        {plantillaExiste
          ?`Actualizar plantilla de columnas para "${prov?.nombre}"`
          :`Guardar plantilla de columnas para "${prov?.nombre}"`}
      </label>
      <p style={{ fontSize:12, color:C.sub, marginTop:4, marginLeft:24 }}>
        La próxima importación de este proveedor pre-asignará las columnas automáticamente.
      </p>
    </div>
  );
}

// ── Paso 3 ─────────────────────────────────────────────────────
function PasoCompletado({ resultado }) {
  return (
    <div style={{ textAlign:"center", padding:"32px 24px" }}>
      <div style={{ width:56, height:56, borderRadius:999, background:C.okSoft, color:C.ok,
        display:"grid", placeItems:"center", margin:"0 auto 16px" }}>
        <Check size={28}/>
      </div>
      <h3 style={{ fontSize:18, color:C.ink, marginBottom:8 }}>Importación completada</h3>
      {resultado&&(
        <p style={{ fontSize:14, color:C.sub, lineHeight:1.7 }}>
          {resultado.nuevos>0&&(
            <><strong style={{color:C.brand}}>{resultado.nuevos} nuevas filas</strong> añadidas a la correlación.<br/></>
          )}
          {resultado.actualizados>0&&(
            <><strong style={{color:C.ok}}>{resultado.actualizados} filas actualizadas</strong> con los datos del proveedor.</>
          )}
        </p>
      )}
      <p style={{ fontSize:13, color:C.dim, marginTop:10 }}>
        Puedes editar los alias directamente en la tabla de correlación.
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TabDistribuidor — export default
// ══════════════════════════════════════════════════════════════════
export default function TabDistribuidor({ empresa }) {
  const cid = empresa?.id||"local";

  const [proveedores, setProveedoresRaw] = useState(()=>{
    try { return JSON.parse(localStorage.getItem(KEY_PROVS(cid)))||[]; } catch { return []; }
  });
  const [filas, setFilasRaw] = useState(()=>{
    try { return JSON.parse(localStorage.getItem(KEY_FILAS(cid)))||[]; } catch { return []; }
  });
  const [plantillas, setPlantillasRaw] = useState(()=>{
    try { return JSON.parse(localStorage.getItem(KEY_PLANTILLAS(cid)))||[]; } catch { return []; }
  });
  const [subTab, setSubTab] = useState("correlacion");
  const [wizard, setWizard] = useState(false);

  function setProveedores(fn) {
    setProveedoresRaw(ps=>{ const n=typeof fn==="function"?fn(ps):fn; localStorage.setItem(KEY_PROVS(cid),JSON.stringify(n)); return n; });
  }
  function setFilas(fn) {
    setFilasRaw(fs=>{ const n=typeof fn==="function"?fn(fs):fn; localStorage.setItem(KEY_FILAS(cid),JSON.stringify(n)); return n; });
  }
  function setPlantillas(fn) {
    setPlantillasRaw(ps=>{ const n=typeof fn==="function"?fn(ps):fn; localStorage.setItem(KEY_PLANTILLAS(cid),JSON.stringify(n)); return n; });
  }

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", fontFamily:"var(--font-body)" }}>
      {/* Sub-tabs */}
      <div style={{ display:"flex", borderBottom:`1px solid ${C.line}`,
        padding:"0 24px", background:C.surface, flexShrink:0 }}>
        {[
          { id:"correlacion", label:"Correlación" },
          { id:"proveedores", label:`Proveedores (${proveedores.length})` },
        ].map(t=>(
          <button key={t.id} onClick={()=>setSubTab(t.id)}
            style={{ padding:"12px 18px", background:"none", border:"none", cursor:"pointer",
              fontFamily:"inherit", fontSize:13.5, fontWeight:subTab===t.id?700:400,
              color:subTab===t.id?C.brand:C.sub,
              borderBottom:subTab===t.id?`2px solid ${C.brand}`:"2px solid transparent",
              marginBottom:-1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {subTab==="correlacion"&&(
        <TablaCorrelacion filas={filas} setFilas={setFilas}
          proveedores={proveedores} onImportar={()=>setWizard(true)}/>
      )}
      {subTab==="proveedores"&&(
        <div style={{ flex:1, overflowY:"auto" }}>
          <PanelProveedores proveedores={proveedores} setProveedores={setProveedores}/>
        </div>
      )}

      {wizard&&proveedores.length>0&&(
        <WizardImport proveedores={proveedores} filas={filas} setFilas={setFilas}
          plantillas={plantillas} setPlantillas={setPlantillas}
          onCerrar={()=>setWizard(false)}/>
      )}
    </div>
  );
}
