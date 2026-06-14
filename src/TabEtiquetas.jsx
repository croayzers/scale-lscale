// MARK: - TabEtiquetas — Creador de etiquetas A4/A3 para palés de almacén
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Tag, Printer, Save, Trash2, Plus, FileText, RotateCcw } from "lucide-react";

const C = {
  bg:"var(--bg)", surface:"var(--surface)", s2:"var(--surface-2)",
  line:"var(--border)", strong:"var(--border-strong)",
  ink:"var(--text)", sub:"var(--text-2)", dim:"var(--text-3)",
  brand:"var(--brand)", brandSoft:"var(--brand-soft)",
  ok:"var(--ok)", okSoft:"var(--ok-soft)",
  warn:"var(--warn)", warnSoft:"var(--warn-soft)",
  danger:"var(--danger)", dangerSoft:"var(--danger-soft)",
};

const TAMAÑOS = [
  { id:"A4v", label:"A4 Vertical",   w:210, h:297 },
  { id:"A4h", label:"A4 Horizontal", w:297, h:210 },
  { id:"A3v", label:"A3 Vertical",   w:297, h:420 },
  { id:"A3h", label:"A3 Horizontal", w:420, h:297 },
];

const CAMPOS_PEDIDO = [
  { key:"codigo",        label:"Código pedido" },
  { key:"nombre",        label:"Cliente / Evento" },
  { key:"fecha_entrega", label:"Fecha entrega" },
  { key:"hora_ida",      label:"Hora ida" },
  { key:"hora_vuelta",   label:"Hora vuelta" },
  { key:"destino",       label:"Destino / Transportista" },
  { key:"contacto",      label:"Contacto" },
  { key:"notas",         label:"Notas" },
];

const CONFIG_DEFECTO = {
  tamaño: "A4v",
  campos: ["codigo","nombre","fecha_entrega","hora_ida","destino"],
  titulo: "ETIQUETA ALMACÉN",
  mostrarLogo: false,
  mostrarLineas: false,
  fontSize: 18,
};

const LS_KEY = "lscale.etiquetas.plantillas";

function cargarPlantillas() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; }
}
function guardarPlantillas(list) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

/* ─── Componente preview de la etiqueta ──────────────────────────────────── */
function PreviewEtiqueta({ config, pedido }) {
  const tam = TAMAÑOS.find(t => t.id === config.tamaño) || TAMAÑOS[0];
  // Escala visual: que la etiqueta llene bien el panel. Menor divisor = más grande.
  const escala = tam.w > 250 ? 0.62 : 0.78; // A3 vs A4

  const campos = config.campos
    .map(k => CAMPOS_PEDIDO.find(c => c.key === k))
    .filter(Boolean);

  const val = (k) => {
    if (!pedido) return "—";
    return pedido[k] ?? "—";
  };

  const previewW = tam.w / escala;
  const previewH = tam.h / escala;
  const fs = Math.max(8, (config.fontSize || 18) / escala);

  return (
    <div style={{
      width: previewW, height: previewH, flexShrink:0,
      border:`2px solid ${C.strong}`, borderRadius:8,
      background:"#fff", padding: 16 / escala * 0.9,
      display:"flex", flexDirection:"column", gap: 10 / escala,
      overflow:"hidden", boxShadow:"0 2px 12px #0002",
      fontFamily:"'Helvetica Neue', Arial, sans-serif",
    }}>
      {/* Título */}
      <div style={{
        fontSize: fs * 0.9, fontWeight:800, textTransform:"uppercase",
        letterSpacing:"0.08em", color:"#111", borderBottom:"2px solid #111",
        paddingBottom: 6 / escala, marginBottom: 4 / escala,
      }}>
        {config.titulo || "ETIQUETA ALMACÉN"}
      </div>

      {/* Campos */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", gap: 8 / escala, overflow:"hidden" }}>
        {campos.map(campo => (
          <div key={campo.key} style={{ display:"flex", flexDirection:"column", gap:1 }}>
            <span style={{ fontSize: fs * 0.55, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:"0.06em" }}>
              {campo.label}
            </span>
            <span style={{ fontSize: fs * 0.85, fontWeight:600, color:"#111", lineHeight:1.2,
              whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
              {val(campo.key)}
            </span>
          </div>
        ))}
      </div>

      {/* Líneas de material */}
      {config.mostrarLineas && pedido?.lineas?.length > 0 && (
        <div style={{ borderTop:"1px solid #ccc", paddingTop: 6 / escala }}>
          <div style={{ fontSize: fs * 0.55, fontWeight:700, color:"#888", textTransform:"uppercase", marginBottom: 3 / escala }}>
            MATERIAL
          </div>
          {pedido.lineas.slice(0, 6).map((l, i) => (
            <div key={i} style={{ fontSize: fs * 0.7, color:"#333", display:"flex", justifyContent:"space-between" }}>
              <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"70%" }}>{l.nombre}</span>
              <span style={{ fontWeight:700 }}>{l.cantidad} {l.unidad || "ud"}</span>
            </div>
          ))}
          {pedido.lineas.length > 6 && (
            <div style={{ fontSize: fs * 0.6, color:"#888" }}>+{pedido.lineas.length - 6} más…</div>
          )}
        </div>
      )}

      {/* Footer: código de barras simulado */}
      <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginTop:"auto" }}>
        <div style={{ display:"flex", gap:1.5 }}>
          {Array.from({length: 22}).map((_, i) => (
            <div key={i} style={{ width: i % 3 === 0 ? 2 : 1, height: i % 5 === 0 ? 20 / escala : 14 / escala, background:"#222" }}/>
          ))}
        </div>
        <span style={{ fontSize: fs * 0.55, color:"#888" }}>{pedido?.codigo || "—"}</span>
      </div>
    </div>
  );
}

/* ─── Panel de impresión real (abre ventana nativa del navegador) ─────────── */
function imprimirEtiqueta(config, pedido) {
  const tam = TAMAÑOS.find(t => t.id === config.tamaño) || TAMAÑOS[0];
  const campos = config.campos
    .map(k => CAMPOS_PEDIDO.find(c => c.key === k))
    .filter(Boolean);

  const val = (k) => (pedido && pedido[k]) ? pedido[k] : "—";
  const fs = config.fontSize || 18;

  const lineasHtml = (config.mostrarLineas && pedido?.lineas?.length > 0)
    ? `<div class="lineas">
        <div class="campo-label">MATERIAL</div>
        ${pedido.lineas.map(l => `<div class="linea-row"><span>${l.nombre}</span><span>${l.cantidad} ${l.unidad || "ud"}</span></div>`).join("")}
       </div>`
    : "";

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  @page { size: ${tam.w}mm ${tam.h}mm; margin: 12mm; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Helvetica Neue',Arial,sans-serif; color:#111; }
  .titulo { font-size:${fs * 1.1}px; font-weight:800; text-transform:uppercase;
    letter-spacing:0.08em; border-bottom:2.5px solid #111; padding-bottom:8px; margin-bottom:14px; }
  .campo { margin-bottom:12px; }
  .campo-label { font-size:${fs * 0.6}px; font-weight:700; color:#888; text-transform:uppercase;
    letter-spacing:0.06em; margin-bottom:2px; }
  .campo-val { font-size:${fs}px; font-weight:600; }
  .lineas { border-top:1px solid #ccc; margin-top:16px; padding-top:10px; }
  .linea-row { display:flex; justify-content:space-between; font-size:${fs * 0.75}px; margin-top:4px; }
  .barcode { display:flex; align-items:flex-end; gap:2px; margin-top:auto; padding-top:16px; }
  .bar { background:#222; }
  .codigo { font-size:${fs * 0.6}px; color:#888; margin-left:auto; }
  .footer { display:flex; justify-content:space-between; align-items:flex-end; position:absolute;
    bottom:12mm; left:12mm; right:12mm; }
  body { position:relative; min-height:calc(${tam.h}mm - 24mm); display:flex; flex-direction:column; }
  .campos { flex:1; }
</style></head><body>
  <div class="titulo">${config.titulo || "ETIQUETA ALMACÉN"}</div>
  <div class="campos">
    ${campos.map(c => `<div class="campo"><div class="campo-label">${c.label}</div><div class="campo-val">${val(c.key)}</div></div>`).join("")}
  </div>
  ${lineasHtml}
  <div class="footer">
    <div class="barcode">
      ${Array.from({length:22}).map((_, i) => `<div class="bar" style="width:${i%3===0?2:1}px;height:${i%5===0?20:14}px"></div>`).join("")}
    </div>
    <span class="codigo">${pedido?.codigo || "—"}</span>
  </div>
</body></html>`;

  const win = window.open("", "_blank", "width=800,height=600");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.print(); };
}

/* ─── TabEtiquetas principal ─────────────────────────────────────────────── */
export default function TabEtiquetas({ pedidos = [], plantillas: plantillasProp, onGuardarPlantillas, L }) {
  const [config, setConfig]       = useState({ ...CONFIG_DEFECTO });
  const [pedidoId, setPedidoId]   = useState(null);
  // Las plantillas vienen del padre (Supabase, compartidas por la organización).
  // Fallback a localStorage si se usa el componente sin esas props.
  const controlado = typeof onGuardarPlantillas === "function";
  const [plantillasLocal, setPlantillasLocal] = useState(cargarPlantillas);
  const plantillas = controlado ? (plantillasProp || []) : plantillasLocal;
  const [nombrePlant, setNombrePlant] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado]   = useState(false);

  const persistir = (lista) => {
    if (controlado) onGuardarPlantillas(lista);
    else { guardarPlantillas(lista); setPlantillasLocal(lista); }
  };

  const pedido = pedidos.find(p => String(p.id) === String(pedidoId)) || null;

  const set = (k) => (v) => setConfig(prev => ({ ...prev, [k]: v }));

  // Al elegir un pedido, el título de la etiqueta pasa a ser el nombre del pedido
  // (salvo que el usuario ya lo haya personalizado a algo distinto del defecto).
  const elegirPedido = (id) => {
    setPedidoId(id || null);
    const p = pedidos.find(x => String(x.id) === String(id));
    if (p) {
      const nombrePedido = p.nombre || p.codigo || `Pedido ${p.id}`;
      setConfig(prev => {
        const esDefecto = !prev.titulo || prev.titulo === CONFIG_DEFECTO.titulo
          || pedidos.some(x => x.nombre === prev.titulo || x.codigo === prev.titulo);
        return esDefecto ? { ...prev, titulo: nombrePedido } : prev;
      });
    }
  };

  const toggleCampo = (k) => {
    setConfig(prev => {
      const arr = prev.campos.includes(k)
        ? prev.campos.filter(c => c !== k)
        : [...prev.campos, k];
      return { ...prev, campos: arr };
    });
  };

  const aplicarPlantilla = (p) => {
    setConfig({ ...CONFIG_DEFECTO, ...p.config });
    setNombrePlant(p.nombre);
  };

  const guardarPlantilla = () => {
    if (!nombrePlant.trim()) return;
    const nueva = { nombre: nombrePlant.trim(), config: { ...config } };
    const lista = plantillas.filter(p => p.nombre !== nueva.nombre);
    lista.unshift(nueva);
    persistir(lista);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 1800);
  };

  const borrarPlantilla = (nombre) => {
    const lista = plantillas.filter(p => p.nombre !== nombre);
    persistir(lista);
  };

  return (
    <div style={{ display:"flex", height:"100%", overflow:"hidden", background:C.bg }}>

      {/* ── Panel izquierdo: configurador ── */}
      <div style={{ width:340, flexShrink:0, borderRight:`1px solid ${C.line}`,
        overflowY:"auto", display:"flex", flexDirection:"column", background:C.surface }}>

        {/* Header */}
        <div style={{ padding:"14px 18px", borderBottom:`1px solid ${C.line}`, display:"flex", alignItems:"center", gap:8 }}>
          <Tag size={16} color={C.brand}/>
          <span style={{ fontWeight:700, fontSize:15, color:C.ink }}>Etiquetas de almacén</span>
        </div>

        <div style={{ padding:"14px 18px", display:"flex", flexDirection:"column", gap:18, flex:1 }}>

          {/* Pedido */}
          <div>
            <Label>Pedido</Label>
            <select value={pedidoId ?? ""} onChange={e => elegirPedido(e.target.value)}
              style={INPUT_STYLE}>
              <option value="">— Sin pedido (preview vacío) —</option>
              {pedidos.map(p => (
                <option key={p.id} value={String(p.id)}>
                  {p.codigo ? `${p.codigo} · ` : ""}{p.nombre || `Pedido ${p.id}`}
                </option>
              ))}
            </select>
          </div>

          {/* Tamaño */}
          <div>
            <Label>Tamaño y orientación</Label>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
              {TAMAÑOS.map(t => (
                <button key={t.id}
                  onClick={() => set("tamaño")(t.id)}
                  style={{ padding:"8px 10px", borderRadius:8, border:`1.5px solid ${config.tamaño === t.id ? C.brand : C.line}`,
                    background: config.tamaño === t.id ? C.brandSoft : C.s2,
                    color: config.tamaño === t.id ? C.brand : C.ink,
                    fontWeight: config.tamaño === t.id ? 700 : 400,
                    fontSize:12.5, cursor:"pointer", fontFamily:"inherit" }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Título */}
          <div>
            <Label>Título de la etiqueta</Label>
            <input value={config.titulo} onChange={e => set("titulo")(e.target.value)}
              placeholder="ETIQUETA ALMACÉN"
              style={INPUT_STYLE}/>
          </div>

          {/* Campos */}
          <div>
            <Label>Campos visibles</Label>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {CAMPOS_PEDIDO.map(c => {
                const activo = config.campos.includes(c.key);
                return (
                  <button key={c.key} onClick={() => toggleCampo(c.key)}
                    style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px",
                      borderRadius:8, border:`1px solid ${activo ? C.brand : C.line}`,
                      background: activo ? C.brandSoft : "transparent",
                      color: activo ? C.brand : C.sub,
                      fontSize:13, cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
                    <div style={{ width:14, height:14, borderRadius:4, border:`2px solid ${activo ? C.brand : C.strong}`,
                      background: activo ? C.brand : "transparent", flexShrink:0,
                      display:"grid", placeItems:"center" }}>
                      {activo && <span style={{ color:"#fff", fontSize:9, fontWeight:900 }}>✓</span>}
                    </div>
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Opciones extra */}
          <div>
            <Label>Opciones</Label>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {[
                { key:"mostrarLineas", label:"Mostrar líneas de material" },
              ].map(({ key, label }) => {
                const activo = !!config[key];
                return (
                  <button key={key} onClick={() => set(key)(!activo)}
                    style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px",
                      borderRadius:8, border:`1px solid ${activo ? C.brand : C.line}`,
                      background: activo ? C.brandSoft : "transparent",
                      color: activo ? C.brand : C.sub,
                      fontSize:13, cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
                    <div style={{ width:14, height:14, borderRadius:4, border:`2px solid ${activo ? C.brand : C.strong}`,
                      background: activo ? C.brand : "transparent", flexShrink:0,
                      display:"grid", placeItems:"center" }}>
                      {activo && <span style={{ color:"#fff", fontSize:9, fontWeight:900 }}>✓</span>}
                    </div>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tamaño de fuente — hasta x3 (18 → 54) */}
          <div>
            <Label>Tamaño de texto ({config.fontSize}px · x{(config.fontSize / 18).toFixed(1)})</Label>
            <input type="range" min={12} max={54} step={1}
              value={config.fontSize}
              onChange={e => set("fontSize")(Number(e.target.value))}
              style={{ width:"100%" }}/>
          </div>

          {/* Guardar plantilla */}
          <div style={{ borderTop:`1px solid ${C.line}`, paddingTop:14 }}>
            <Label>Plantillas</Label>
            {plantillas.length > 0 && (
              <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:10 }}>
                {plantillas.map(p => (
                  <div key={p.nombre} style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <button onClick={() => aplicarPlantilla(p)}
                      style={{ flex:1, textAlign:"left", padding:"6px 10px", borderRadius:7,
                        border:`1px solid ${C.line}`, background:C.s2, color:C.ink,
                        fontSize:12.5, cursor:"pointer", fontFamily:"inherit" }}>
                      {p.nombre}
                    </button>
                    <button onClick={() => borrarPlantilla(p.nombre)}
                      style={{ background:"none", border:"none", cursor:"pointer", color:C.danger, padding:4, display:"flex" }}>
                      <Trash2 size={13}/>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display:"flex", gap:6 }}>
              <input value={nombrePlant} onChange={e => setNombrePlant(e.target.value)}
                placeholder="Nombre de plantilla"
                onKeyDown={e => { if (e.key === "Enter") guardarPlantilla(); }}
                style={{ ...INPUT_STYLE, flex:1, marginBottom:0 }}/>
              <button onClick={guardarPlantilla}
                style={{ padding:"8px 12px", borderRadius:8, border:"none",
                  background: guardado ? C.ok : C.brand, color:"#fff",
                  fontWeight:600, fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", gap:5, flexShrink:0 }}>
                <Save size={13}/>{guardado ? "¡Listo!" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Panel derecho: preview + botón imprimir ── */}
      <div style={{ flex:1, overflow:"auto", display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"flex-start", padding:32, gap:24, background:C.bg }}>

        <div style={{ display:"flex", alignItems:"center", gap:12, alignSelf:"stretch", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:13, color:C.sub }}>
              {TAMAÑOS.find(t => t.id === config.tamaño)?.label} · {config.campos.length} campos activos
            </div>
          </div>
          <button onClick={() => imprimirEtiqueta(config, pedido)}
            style={{ display:"flex", alignItems:"center", gap:7, padding:"10px 20px",
              borderRadius:999, border:"none", background:C.brand, color:"#fff",
              fontWeight:700, fontSize:14, cursor:"pointer" }}>
            <Printer size={15}/>Imprimir
          </button>
        </div>

        <PreviewEtiqueta config={config} pedido={pedido}/>

        <div style={{ fontSize:12, color:C.dim }}>
          Vista previa — el resultado real se abrirá en el diálogo de impresión del navegador.
        </div>
      </div>
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize:11, fontWeight:700, color:C.sub, letterSpacing:0.5,
    textTransform:"uppercase", marginBottom:6 }}>{children}</div>;
}

const INPUT_STYLE = {
  width:"100%", padding:"8px 10px", border:`1px solid var(--border-strong)`,
  borderRadius:9, fontSize:13.5, fontFamily:"inherit",
  background:"var(--surface-2)", color:"var(--text)", outline:"none",
};
