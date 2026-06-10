import React, { useState, useRef, useMemo } from "react";
import {
  Upload, Loader, X, Check, AlertTriangle, Plus, Trash2,
  Warehouse, ArrowLeft, FileSpreadsheet,
} from "lucide-react";
import { useL } from "./lib/i18n.js";
import { parsearExcelPedido } from "./lib/parseExcelPedido.js";
import { guardarPedido } from "./lib/data.js";

/* ─── Paleta ──────────────────────────────────────────────────────────────── */
const C = {
  bg:"var(--bg)", surface:"var(--surface)", s2:"var(--surface-2)",
  line:"var(--border)", strong:"var(--border-strong)",
  ink:"var(--text)", sub:"var(--text-2)", dim:"var(--text-3)",
  brand:"var(--brand)", brandSoft:"var(--brand-soft)",
  ok:"var(--ok)", okSoft:"var(--ok-soft)",
  warn:"var(--warn)", warnSoft:"var(--warn-soft)",
  danger:"var(--danger)", dangerSoft:"var(--danger-soft)",
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function Btn({ children, onClick, disabled, color = C.brand, outline = false, style: s = {} }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"9px 16px",
        borderRadius:999, border: outline ? `1px solid ${C.strong}` : "none",
        background: outline ? C.s2 : color, color: outline ? C.ink : "#fff",
        fontWeight:600, fontSize:13.5, cursor:"pointer", opacity: disabled ? 0.5 : 1,
        fontFamily:"inherit", ...s }}>
      {children}
    </button>
  );
}

function Field({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <div>
      <label style={{ fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.5, display:"block", marginBottom:4 }}>{label}</label>
      <input type={type} value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width:"100%", padding:"8px 10px", border:`1px solid ${C.strong}`, borderRadius:9,
          fontSize:13.5, fontFamily:"inherit", background:C.s2, color:C.ink, outline:"none" }}/>
    </div>
  );
}

/* ─── Formulario de expedición ────────────────────────────────────────────── */
function ExpedicionForm({ form, setForm, L }) {
  const f = (k) => (v) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      <Field label={L("CÓDIGO EVENTO","EVENT CODE")}        value={form.codigo}         onChange={f("codigo")}/>
      <Field label={L("REFERENCIA PEDIDO","ORDER REF")}     value={form.referencia}     onChange={f("referencia")}/>
      <Field label={L("CLIENTE","CLIENT")}                  value={form.nombre}         onChange={f("nombre")} style={{ gridColumn:"1 / -1" }}/>
      <Field label={L("CONTACTO","CONTACT")}                value={form.contacto}       onChange={f("contacto")}/>
      <Field label={L("DESTINO / LLOC","DESTINATION")}      value={form.destino}        onChange={f("destino")}/>
      <Field label={L("FECHA EXPEDICIÓN","DISPATCH DATE")}  value={form.fecha_entrega}  onChange={f("fecha_entrega")} placeholder="YYYY-MM-DD"/>
      <Field label={L("FECHA RETORNO","RETURN DATE")}       value={form.fecha_retorno}  onChange={f("fecha_retorno")} placeholder="YYYY-MM-DD"/>
      <Field label={L("PAX ADULTS","PAX ADULTS")}           value={form.pax_adults ?? ""} onChange={f("pax_adults")} type="number"/>
      <Field label={L("PAX NENS","PAX KIDS")}               value={form.pax_nens   ?? ""} onChange={f("pax_nens")}   type="number"/>
      <div style={{ gridColumn:"1 / -1" }}>
        <label style={{ fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.5, display:"block", marginBottom:4 }}>NOTAS</label>
        <textarea value={form.notas || ""} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
          rows={2} placeholder={L("Instrucciones adicionales…","Additional instructions…")}
          style={{ width:"100%", padding:"8px 10px", border:`1px solid ${C.strong}`, borderRadius:9,
            fontSize:13.5, fontFamily:"inherit", background:C.s2, color:C.ink, outline:"none", resize:"vertical" }}/>
      </div>
    </div>
  );
}

/* ─── Lista de materiales con nombre editable ─────────────────────────────── */
function MaterialesList({ grouped, updateMaterial, L }) {
  if (!grouped.length) return (
    <p style={{ color:C.sub, textAlign:"center", padding:30 }}>
      {L("No se detectaron materiales en Hoja2.","No materials detected in Sheet2.")}
    </p>
  );
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 140px 56px", gap:"0 10px",
        padding:"6px 8px", borderBottom:`1px solid ${C.line}`,
        fontSize:10.5, fontWeight:700, color:C.dim, letterSpacing:.6, marginBottom:2 }}>
        <div>{L("NOMBRE ORIGINAL","ORIGINAL NAME")}</div>
        <div>{L("NOMBRE EN APP (opcional)","APP NAME (optional)")}</div>
        <div>COMENTARIO</div>
        <div style={{ textAlign:"right" }}>CANT.</div>
      </div>
      {grouped.map((row, i) => {
        if (row.type === "timing") return (
          <div key={i} style={{ marginTop:14, marginBottom:3, padding:"5px 8px",
            background:C.brandSoft, borderRadius:7,
            fontSize:12.5, fontWeight:800, color:C.brand, letterSpacing:.8 }}>
            {row.label || L("(sin timing)","(no timing)")}
          </div>
        );
        if (row.type === "categoria") return (
          <div key={i} style={{ fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.5,
            padding:"4px 8px 2px", marginTop:6, borderBottom:`1px solid ${C.line}` }}>
            {row.label || L("(sin categoría)","(no category)")}
          </div>
        );
        const { item, idx } = row;
        return (
          <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 140px 56px",
            gap:"0 10px", padding:"4px 8px", alignItems:"center", fontSize:13,
            borderBottom:`1px solid ${C.line}` }}
            onMouseEnter={e => e.currentTarget.style.background = C.s2}
            onMouseLeave={e => e.currentTarget.style.background = ""}>
            <div style={{ color: item.nombre_custom ? C.dim : C.ink,
              textDecoration: item.nombre_custom ? "line-through" : "none",
              fontSize: item.nombre_custom ? 12 : 13,
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {item.nombre}
            </div>
            <input value={item.nombre_custom} onChange={e => updateMaterial(idx, "nombre_custom", e.target.value)}
              placeholder={L("← usa el original","← keep original")}
              style={{ padding:"3px 7px", border:`1px solid ${item.nombre_custom ? C.brand : C.line}`,
                borderRadius:6, fontSize:12.5, fontFamily:"inherit", background:"transparent",
                color: item.nombre_custom ? C.brand : C.ink, outline:"none",
                boxShadow: item.nombre_custom ? `0 0 0 2px ${C.brandSoft}` : "none" }}/>
            <div style={{ fontSize:11.5, color:C.sub, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {item.comentario || ""}
            </div>
            <div style={{ textAlign:"right", fontWeight:600 }}>{item.cantidad}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TABLA DE PEDIDO CONFIRMADO (agrupada por categoría, cantidades sumadas)
   ═══════════════════════════════════════════════════════════════════════════ */
function PedidoTabla({ pedido, onNuevo, almacenes, L }) {

  // Agrupar por categoría, sumando cantidades de nombres repetidos
  const catTable = useMemo(() => {
    const cats = {};
    for (const l of (pedido.lineas || [])) {
      const cat    = l.categoria || "(sin categoría)";
      const nombre = l.nombre    || "—";
      if (!cats[cat]) cats[cat] = {};
      cats[cat][nombre] = (cats[cat][nombre] || 0) + (l.cantidad || 0);
    }
    return Object.entries(cats)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([categoria, items]) => ({
        categoria,
        items: Object.entries(items)
          .map(([nombre, cantidad]) => ({ nombre, cantidad }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre)),
      }));
  }, [pedido.lineas]);

  const totalRefs = catTable.reduce((s, c) => s + c.items.length, 0);
  const totalUds  = catTable.reduce((s, c) => s + c.items.reduce((a, i) => a + i.cantidad, 0), 0);
  const almNombre = almacenes.find(a => a.id === pedido.almacen_id)?.nombre || pedido.almacen_nombre || "—";

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0 }}>

      {/* Toolbar */}
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 20px",
        borderBottom:`1px solid ${C.line}`, flexShrink:0 }}>
        <Btn outline onClick={onNuevo} style={{ padding:"6px 14px", fontSize:13 }}>
          <ArrowLeft size={14}/>{L("Nuevo pedido","New order")}
        </Btn>
        <div style={{ flex:1 }}/>
        <span style={{ fontSize:12, color:C.sub }}>
          {totalRefs} {L("referencias","refs")} · {totalUds} {L("uds. totales","total units")}
        </span>
      </div>

      {/* Cabecera del pedido */}
      <div style={{ padding:"12px 20px", background:C.brandSoft, borderBottom:`2px solid ${C.brand}`, flexShrink:0 }}>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"baseline" }}>
          {pedido.codigo && (
            <span style={{ fontSize:16, fontWeight:800, color:C.brand, letterSpacing:.5 }}>{pedido.codigo}</span>
          )}
          {pedido.referencia && (
            <span style={{ fontSize:12.5, color:C.sub, fontWeight:500 }}>{pedido.referencia}</span>
          )}
          {pedido.nombre && (
            <span style={{ fontSize:14.5, fontWeight:600, color:C.ink }}>{pedido.nombre}</span>
          )}
        </div>
        <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginTop:6, fontSize:12.5, color:C.sub }}>
          {pedido.destino   && <span>📍 {pedido.destino}</span>}
          {pedido.contacto  && <span>👤 {pedido.contacto}</span>}
          {pedido.fecha_entrega && <span>📅 {L("Expedición","Dispatch")}: <strong style={{ color:C.ink }}>{pedido.fecha_entrega}</strong></span>}
          {pedido.fecha_retorno && <span>↩ {L("Retorno","Return")}: <strong style={{ color:C.ink }}>{pedido.fecha_retorno}</strong></span>}
          <span>🏭 <strong style={{ color:C.ink }}>{almNombre}</strong></span>
          {pedido.pax_adults && <span>👥 {pedido.pax_adults} pax</span>}
        </div>
      </div>

      {/* Tabla de materiales */}
      <div style={{ flex:1, overflowY:"auto" }}>

        {/* Cabecera sticky de columnas */}
        <div style={{ display:"grid", gridTemplateColumns:"220px 1fr 90px",
          position:"sticky", top:0, zIndex:10, background:C.surface,
          borderBottom:`1px solid ${C.line}`, padding:"0 20px" }}>
          <div style={{ padding:"9px 8px", fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.6 }}>
            {L("CATEGORÍA","CATEGORY")}
          </div>
          <div style={{ padding:"9px 8px", fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.6 }}>
            {L("NOMBRE","NAME")}
          </div>
          <div style={{ padding:"9px 8px", fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.6, textAlign:"right" }}>
            {L("CANTIDAD","QTY")}
          </div>
        </div>

        {/* Filas agrupadas por categoría */}
        {catTable.map((cat) => (
          <React.Fragment key={cat.categoria}>

            {/* Cabecera de categoría */}
            <div style={{ padding:"7px 28px", background:C.s2,
              borderBottom:`1px solid ${C.line}`, borderTop:`1px solid ${C.line}`,
              fontSize:12, fontWeight:800, color:C.brand, letterSpacing:1,
              textTransform:"uppercase" }}>
              {cat.categoria}
            </div>

            {/* Items de la categoría */}
            {cat.items.map((item, i) => (
              <div key={i} style={{ display:"grid", gridTemplateColumns:"220px 1fr 90px",
                padding:"0 20px", borderBottom:`1px solid ${C.line}`,
                transition:"background .1s" }}
                onMouseEnter={e => e.currentTarget.style.background = C.s2}
                onMouseLeave={e => e.currentTarget.style.background = ""}>
                <div style={{ padding:"9px 8px" }}/> {/* celda categoría vacía */}
                <div style={{ padding:"9px 8px", fontSize:13.5, color:C.ink }}>
                  {item.nombre}
                </div>
                <div style={{ padding:"9px 8px", fontSize:13.5, fontWeight:700,
                  textAlign:"right", color:C.ink }}>
                  {item.cantidad}
                </div>
              </div>
            ))}

            {/* Subtotal de la categoría */}
            <div style={{ display:"grid", gridTemplateColumns:"220px 1fr 90px",
              padding:"0 20px", background:C.s2 }}>
              <div style={{ padding:"5px 8px" }}/>
              <div style={{ padding:"5px 8px", fontSize:11.5, color:C.sub, fontStyle:"italic" }}>
                {cat.items.length} {L("ref.","ref.")}
              </div>
              <div style={{ padding:"5px 8px", fontSize:12, fontWeight:700,
                textAlign:"right", color:C.sub }}>
                {cat.items.reduce((s, i) => s + i.cantidad, 0)}
              </div>
            </div>

          </React.Fragment>
        ))}

        {/* Totales globales */}
        <div style={{ display:"grid", gridTemplateColumns:"220px 1fr 90px",
          padding:"0 20px", borderTop:`2px solid ${C.strong}`,
          background:C.surface, position:"sticky", bottom:0 }}>
          <div style={{ padding:"11px 8px", fontSize:12, fontWeight:700, color:C.ink, gridColumn:"1/3" }}>
            TOTAL — {totalRefs} {L("referencias","references")}
          </div>
          <div style={{ padding:"11px 8px", fontSize:14, fontWeight:800,
            textAlign:"right", color:C.brand }}>
            {totalUds}
          </div>
        </div>

      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */
export default function TabCargarPedido({ almacenes, empresa, modo, setPedidos }) {
  const L = useL();
  const fileRef = useRef(null);

  const [importingAlm, setImportingAlm] = useState(null);
  const [parsed,       setParsed]       = useState(null);
  const [expForm,      setExpForm]       = useState({});
  const [wizardTab,    setWizardTab]     = useState("exp");
  const [saving,       setSaving]        = useState(false);
  const [errMsg,       setErrMsg]        = useState(null);
  const [pedidoActivo, setPedidoActivo]  = useState(null); // pedido confirmado → vista tabla

  /* ── Trigger file input ────────────────────────────────────────────── */
  const triggerImport = (alm) => {
    setImportingAlm(alm);
    setErrMsg(null);
    fileRef.current.value = "";
    fileRef.current.click();
  };

  /* ── Parse file ────────────────────────────────────────────────────── */
  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !importingAlm) return;
    try {
      const result = await parsearExcelPedido(file, importingAlm?.startRow || 6);
      setParsed({ ...result, almacen: importingAlm });
      setExpForm({ ...result.expedicion });
      setWizardTab("exp");
      setErrMsg(null);
    } catch (err) {
      setErrMsg(`Error leyendo el archivo: ${err.message}`);
    }
    setImportingAlm(null);
  };

  /* ── Edit material names ────────────────────────────────────────────── */
  const updateMaterial = (idx, field, value) =>
    setParsed(p => ({ ...p, materiales: p.materiales.map((m, i) => i === idx ? { ...m, [field]: value } : m) }));

  /* ── Confirm import ─────────────────────────────────────────────────── */
  const confirmar = async () => {
    if (!parsed) return;
    setSaving(true);
    // Normalizar fechas a YYYY-MM-DD independientemente de cómo las escribió el usuario
    const normFecha = (s) => {
      if (!s) return s;
      const m = String(s).trim().match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
      if (!m) return s;
      const [, d, mo, y] = m;
      return `${y.length === 2 ? "20" + y : y}-${mo.padStart(2,"0")}-${d.padStart(2,"0")}`;
    };
    const pedido = {
      ...expForm,
      fecha_entrega: normFecha(expForm.fecha_entrega),
      fecha_retorno: normFecha(expForm.fecha_retorno),
      almacen_id:     parsed.almacen.id,
      almacen_nombre: parsed.almacen.nombre,
      estado:         "confirmado",
      fecha_pedido:   new Date().toISOString().slice(0, 10),
      lineas: parsed.materiales.map(m => ({
        almacen_id:      parsed.almacen.id,
        timing:          m.timing,
        categoria:       m.categoria,
        nombre:          m.nombre_custom || m.nombre,
        nombre_original: m.nombre,
        comentario:      m.comentario,
        cantidad:        m.cantidad,
      })),
    };
    if (modo === "demo") {
      const nuevo = { ...pedido, id: Date.now(), emp: empresa?.id, _tipo:"pedido" };
      setPedidos(p => [nuevo, ...p]);
      setPedidoActivo(nuevo);
    } else {
      try {
        const saved = await guardarPedido(pedido, empresa?.id);
        setPedidos(p => [saved, ...p]);
        setPedidoActivo(saved);
      } catch (err) {
        setErrMsg(`Error guardando: ${err.message}`);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setParsed(null);
  };

  /* ── Agrupar materiales para el wizard ──────────────────────────────── */
  const grouped = useMemo(() => {
    if (!parsed?.materiales) return [];
    const out = [];
    let lastTiming = null, lastCat = null;
    parsed.materiales.forEach((m, idx) => {
      if (m.timing !== lastTiming) { lastTiming = m.timing; out.push({ type:"timing", label:m.timing }); lastCat = null; }
      if (m.categoria !== lastCat) { lastCat = m.categoria; out.push({ type:"categoria", label:m.categoria }); }
      out.push({ type:"item", item:m, idx });
    });
    return out;
  }, [parsed?.materiales]);

  const nMat          = parsed?.materiales.length ?? 0;
  const nConNombreAlt = parsed?.materiales.filter(m => m.nombre_custom).length ?? 0;

  /* ── Si hay pedido activo, mostrar tabla ────────────────────────────── */
  if (pedidoActivo) {
    return (
      <PedidoTabla
        pedido={pedidoActivo}
        onNuevo={() => setPedidoActivo(null)}
        almacenes={almacenes}
        L={L}
      />
    );
  }

  /* ── Vista principal: botones de importación ────────────────────────── */
  return (
    <div style={{ padding:"22px 26px", maxWidth:800 }}>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.ods,.csv" style={{ display:"none" }} onChange={onFileChange}/>

      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontSize:20, marginBottom:4 }}>{L("Cargar pedido","Load order")}</h2>
        <p style={{ color:C.sub, fontSize:13 }}>
          {L("Importa el listado de chequeo desde Excel (Hoja1 = expedición, Hoja2 = materiales).",
             "Import the checklist from Excel (Sheet1 = expedition, Sheet2 = materials).")}
        </p>
      </div>

      {/* Botones por almacén */}
      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
        {almacenes.map(alm => (
          <button key={alm.id} onClick={() => triggerImport(alm)}
            style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10,
              padding:"18px 24px", borderRadius:14, border:`2px dashed ${C.brand}`,
              background:C.brandSoft, color:C.brand, cursor:"pointer",
              fontFamily:"inherit", minWidth:160, transition:"opacity .15s" }}
            onMouseEnter={e => e.currentTarget.style.opacity = ".8"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
            <Warehouse size={28}/>
            <div>
              <div style={{ fontWeight:700, fontSize:14 }}>{alm.nombre}</div>
              <div style={{ fontSize:12, opacity:.75, marginTop:2 }}>
                <Upload size={11} style={{ verticalAlign:"middle" }}/> {L("Importar Excel","Import Excel")}
              </div>
            </div>
          </button>
        ))}
      </div>

      {errMsg && (
        <div style={{ marginTop:16, padding:"10px 14px", borderRadius:10,
          background:C.dangerSoft, color:C.danger, fontSize:13, display:"flex", gap:8 }}>
          <AlertTriangle size={16}/>{errMsg}
        </div>
      )}

      {/* ── Wizard modal ──────────────────────────────────────────────── */}
      {parsed && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:500,
          display:"grid", placeItems:"center", padding:16 }}
          onClick={() => setParsed(null)}>
          <div style={{ background:C.surface, borderRadius:18, width:"100%", maxWidth:820,
            maxHeight:"92vh", display:"flex", flexDirection:"column", boxShadow:"var(--shadow-lg)" }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start",
              padding:"16px 22px", borderBottom:`1px solid ${C.line}`, flexShrink:0 }}>
              <div>
                <div style={{ fontSize:16, fontWeight:700 }}>
                  {L("Importar materiales","Import materials")} — <span style={{ color:C.brand }}>{parsed.almacen.nombre}</span>
                </div>
                <div style={{ fontSize:12.5, color:C.sub, marginTop:3 }}>
                  {nMat} {L("materiales detectados","materials detected")}
                  {nConNombreAlt > 0 && ` · ${nConNombreAlt} ${L("con nombre alternativo","with alt name")}`}
                </div>
              </div>
              <button onClick={() => setParsed(null)} style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, padding:4 }}><X size={18}/></button>
            </div>

            {/* Tabs wizard */}
            <div style={{ display:"flex", borderBottom:`1px solid ${C.line}`, flexShrink:0, padding:"0 22px" }}>
              {[["exp", L("Expedición","Expedition")], ["mat", `${L("Materiales","Materials")} (${nMat})`]].map(([id, lbl]) => (
                <button key={id} onClick={() => setWizardTab(id)}
                  style={{ padding:"10px 16px", border:"none",
                    borderBottom: wizardTab === id ? `2.5px solid ${C.brand}` : "2.5px solid transparent",
                    background:"transparent", fontFamily:"inherit",
                    fontWeight: wizardTab === id ? 600 : 400, fontSize:13.5,
                    cursor:"pointer", color: wizardTab === id ? C.brand : C.sub, marginBottom:-1 }}>
                  {lbl}
                </button>
              ))}
            </div>

            {/* Content */}
            <div style={{ flex:1, overflowY:"auto", padding:"18px 22px" }}>
              {wizardTab === "exp" && <ExpedicionForm form={expForm} setForm={setExpForm} L={L}/>}
              {wizardTab === "mat" && <MaterialesList grouped={grouped} updateMaterial={updateMaterial} L={L}/>}
            </div>

            {/* Footer */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
              padding:"14px 22px", borderTop:`1px solid ${C.line}`, flexShrink:0, gap:10 }}>
              <div style={{ fontSize:12, color:C.sub }}>
                {nConNombreAlt > 0
                  ? L(`${nConNombreAlt} nombres serán sustituidos al confirmar.`,`${nConNombreAlt} names will be replaced on confirm.`)
                  : L("Los nombres originales del Excel se usarán tal cual.","Original Excel names will be used as-is.")}
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <Btn outline onClick={() => setParsed(null)}>{L("Cancelar","Cancel")}</Btn>
                <Btn onClick={confirmar} disabled={saving}>
                  {saving ? <Loader size={14} className="spin"/> : <Check size={14}/>}
                  {L(`Confirmar (${nMat})`,`Confirm (${nMat})`)}
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
