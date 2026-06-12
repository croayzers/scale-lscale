import React, { useState, useEffect } from "react";
import { Settings, Plus, Trash2, Check, Shield } from "lucide-react";
import { C, Badge, Btn } from "./lib/ui.jsx";

const COLORES_ROLES = ["#0891b2","#be185d","#65a30d","#7c3aed","#f59e0b","#ef4444","#10b981","#8b5cf6","#f97316","#06b6d4"];

export default function TabConfig({ empresa, modo, almacenes, guardarAlmacenes, vehiculosEmpresa, guardarVehiculos, rolesImport, guardarRoles, formatoFecha = "DD/MM/YYYY", guardarFormatoFecha, isAdmin = true, L }) {
  const [alms, setAlms] = useState(almacenes);
  const [vehs, setVehs] = useState(vehiculosEmpresa || []);
  const [roles, setRoles] = useState(rolesImport || []);
  const [saved,  setSaved]  = useState(false);
  const [savedV, setSavedV] = useState(false);
  const [savedR, setSavedR] = useState(false);
  const [errA,   setErrA]   = useState(null);
  const [errV,   setErrV]   = useState(null);
  const [errR,   setErrR]   = useState(null);

  // Sincronizar estado local cuando los props cambian (ej: cargarPrefs resuelve después de montar)
  useEffect(() => { setAlms(almacenes); }, [almacenes]);
  useEffect(() => { setVehs(vehiculosEmpresa || []); }, [vehiculosEmpresa]);
  useEffect(() => { setRoles(rolesImport || []); }, [rolesImport]);

  const addRol = () => setRoles(p => [...p, {
    key: `col_custom_${Date.now()}`, label: "",
    color: COLORES_ROLES[p.length % COLORES_ROLES.length], req: false, tipo: "columna",
  }]);
  const removeRol = (key) => setRoles(p => p.filter(r => r.key !== key));
  const updateRol = (key, field, value) => setRoles(p => p.map(r => r.key === key ? { ...r, [field]: value } : r));
  const guardarR = async () => {
    setErrR(null);
    try { await guardarRoles(roles); setSavedR(true); setTimeout(() => setSavedR(false), 2000); }
    catch (e) { setErrR(e?.message || "Error al guardar"); }
  };

  const addAlm = () => setAlms(p => [...p, { id: Date.now(), nombre: `Almacén ${p.length + 1}`, startRow: 6, parser: "hoja1hoja2" }]);
  const removeAlm = (id) => { if (alms.length > 1) setAlms(p => p.filter(a => a.id !== id)); };
  const updateAlm = (id, field, value) => setAlms(p => p.map(a => a.id === id ? { ...a, [field]: value } : a));
  const guardar = async () => {
    setErrA(null);
    try { await guardarAlmacenes(alms); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch (e) { setErrA(e?.message || "Error al guardar"); }
  };

  const addVeh = () => setVehs(p => [...p, { id: Date.now(), nombre:"", dni:"", modelo:"", tipo:"Furgoneta", matricula:"", color:"#3b82f6" }]);
  const removeVeh = (id) => setVehs(p => p.filter(v => v.id !== id));
  const updateVeh = (id, field, value) => setVehs(p => p.map(v => v.id === id ? { ...v, [field]: value } : v));
  const guardarV = async () => {
    setErrV(null);
    try { await guardarVehiculos(vehs); setSavedV(true); setTimeout(() => setSavedV(false), 2000); }
    catch (e) { setErrV(e?.message || "Error al guardar"); }
  };

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
          <div style={{ padding:"12px 18px", display:"flex", justifyContent:"flex-end", alignItems:"center", gap:10 }}>
            {errA && <span style={{ fontSize:12, color:C.danger }}>{errA}</span>}
            <Btn onClick={guardar} color={saved ? C.ok : C.brand}>
              <Check size={14}/>
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

        <div style={{ padding:"8px 0" }}>
          {roles.length === 0 && (
            <div style={{ padding:"16px 18px", fontSize:13, color:C.sub, textAlign:"center" }}>
              Sin roles adicionales. Pulsa «Añadir rol» para crear uno.
            </div>
          )}
          {roles.map((rol, i) => (
            <div key={rol.key} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 18px",
              borderBottom: i < roles.length - 1 ? `1px solid ${C.line}` : "none", flexWrap:"wrap" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                <div style={{ width:20, height:20, borderRadius:5, background:rol.color, border:`1px solid ${C.strong}` }}/>
                <input type="color" value={rol.color} onChange={e => updateRol(rol.key, "color", e.target.value)}
                  style={{ width:26, height:26, padding:0, border:"none", background:"none", cursor:"pointer" }}/>
              </div>
              <input value={rol.label} onChange={e => updateRol(rol.key, "label", e.target.value)}
                placeholder="Nombre del rol (ej. Referencia interna)"
                style={{ flex:"1 1 160px", minWidth:140, padding:"6px 10px",
                  border:`1.5px solid ${rol.label ? C.strong : C.danger + "88"}`,
                  borderRadius:8, fontSize:13, fontFamily:"inherit", background:C.s2, color:C.ink, outline:"none" }}/>
              <div style={{ display:"flex", gap:0, borderRadius:8, overflow:"hidden", border:`1px solid ${C.strong}`, flexShrink:0 }}>
                {[
                  { val:"columna",     label:"Columna" },
                  { val:"descripcion", label:"Descripción" },
                ].map(({ val, label }) => (
                  <button key={val} onClick={() => updateRol(rol.key, "tipo", val)}
                    style={{ padding:"5px 12px", border:"none", fontFamily:"inherit", fontSize:12, cursor:"pointer",
                      background: rol.tipo === val ? rol.color : C.s2,
                      color: rol.tipo === val ? "#fff" : C.sub,
                      fontWeight: rol.tipo === val ? 700 : 400, transition:"background .12s" }}>
                    {label}
                  </button>
                ))}
              </div>
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
          <div style={{ padding:"12px 18px", display:"flex", justifyContent:"flex-end", alignItems:"center", gap:10 }}>
            {errR && <span style={{ fontSize:12, color:C.danger }}>{errR}</span>}
            <Btn onClick={guardarR} color={savedR ? C.ok : C.brand}>
              <Check size={14}/>
              {savedR ? "¡Guardado!" : "Guardar roles"}
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
        {isAdmin && <div style={{ padding:"12px 18px", display:"flex", justifyContent:"flex-end", alignItems:"center", gap:10 }}>
          {errV && <span style={{ fontSize:12, color:C.danger }}>{errV}</span>}
          <Btn onClick={guardarV} color={savedV ? C.ok : C.brand}>
            <Check size={14}/>
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
