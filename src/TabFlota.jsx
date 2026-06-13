// MARK: - TabFlota
// Vista del conductor: elige su vehículo, ve sus pedidos del día, exporta hoja de ruta, imprime credencial.
import React, { useState, useMemo, useRef } from "react";
import { Truck, FileDown, Printer, ChevronDown, MapPin, Clock,
  CalendarDays, Package, User, X, ArrowRight, CheckCircle2 } from "lucide-react";
import { C, Btn } from "./lib/ui.jsx";

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const ESTADOS_ACTIVOS = new Set(["reservado", "confirmado", "retorno", "finalizado"]);
const CHIP = {
  reservado:  { bg:"#f1f5f9", ink:"#64748b" },
  confirmado: { bg:"#dcfce7", ink:"#16a34a" },
  retorno:    { bg:"#fef3c7", ink:"#d97706" },
  finalizado: { bg:"#dbeafe", ink:"#2563eb" },
  cancelado:  { bg:"#fee2e2", ink:"#dc2626" },
};

function fmtFecha(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtHora(h) { return h || "—"; }

/* ─── Selector de conductor ──────────────────────────────────────────────── */
function SelectorConductor({ vehiculos, selId, onSel }) {
  const [open, setOpen] = useState(false);
  const sel = vehiculos.find(v => v.id === selId);

  return (
    <div style={{ position:"relative" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 16px",
          background:C.surface, border:`1.5px solid ${sel ? sel.color : C.line}`,
          borderRadius:12, cursor:"pointer", fontFamily:"inherit", minWidth:220,
          transition:"border-color .15s" }}>
        {sel ? (
          <>
            <div style={{ width:10, height:10, borderRadius:"50%", background:sel.color, flexShrink:0 }}/>
            <div style={{ flex:1, textAlign:"left" }}>
              <div style={{ fontWeight:700, fontSize:14, color:C.ink }}>{sel.nombre}</div>
              <div style={{ fontSize:11.5, color:C.sub }}>{sel.matricula} · {sel.modelo}</div>
            </div>
          </>
        ) : (
          <span style={{ fontSize:14, color:C.sub, flex:1, textAlign:"left" }}>Seleccionar conductor…</span>
        )}
        <ChevronDown size={15} color={C.sub}/>
      </button>

      {open && (
        <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, right:0,
          background:C.surface, border:`1px solid ${C.strong}`, borderRadius:12,
          boxShadow:"var(--shadow-lg)", zIndex:300, overflow:"hidden" }}>
          {vehiculos.map(v => (
            <button key={v.id}
              onClick={() => { onSel(v.id); setOpen(false); }}
              style={{ display:"flex", alignItems:"center", gap:10, width:"100%",
                padding:"10px 14px", background: v.id === selId ? C.s2 : "transparent",
                border:"none", cursor:"pointer", fontFamily:"inherit", textAlign:"left",
                transition:"background .1s" }}
              onMouseEnter={e => e.currentTarget.style.background = C.s2}
              onMouseLeave={e => e.currentTarget.style.background = v.id === selId ? C.s2 : "transparent"}>
              <div style={{ width:12, height:12, borderRadius:"50%", background:v.color, flexShrink:0 }}/>
              <div>
                <div style={{ fontWeight:600, fontSize:13.5, color:C.ink }}>{v.nombre}</div>
                <div style={{ fontSize:11.5, color:C.sub }}>{v.matricula} · {v.modelo}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Tarjeta de pedido ──────────────────────────────────────────────────── */
function TarjetaPedido({ pedido, veh }) {
  const [expand, setExpand] = useState(false);
  const chip = CHIP[pedido.estado] || CHIP.reservado;
  const nLineas = (pedido.lineas || []).length;
  const totalUds = (pedido.lineas || []).reduce((s, l) => s + (Number(l.cantidad) || 0), 0);

  return (
    <div style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:14,
      overflow:"hidden", transition:"box-shadow .15s" }}>
      {/* Franja color vehículo */}
      <div style={{ height:3, background: veh?.color || C.brand }}/>

      <div style={{ padding:"14px 16px" }}>
        {/* Cabecera */}
        <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:10 }}>
          <span style={{ padding:"3px 9px", borderRadius:999, background:chip.bg, color:chip.ink,
            fontSize:11, fontWeight:700, textTransform:"capitalize", flexShrink:0 }}>
            {pedido.estado}
          </span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:700, fontSize:15, color:C.ink }}>
              {pedido.codigo || `PED-${pedido.id}`}
            </div>
            {pedido.nombre && (
              <div style={{ fontSize:12.5, color:C.sub, marginTop:1,
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {pedido.nombre}
              </div>
            )}
          </div>
          <button onClick={() => setExpand(o => !o)}
            style={{ background:"none", border:"none", cursor:"pointer", color:C.sub, padding:2,
              display:"flex", transition:"transform .2s",
              transform: expand ? "rotate(180deg)" : "rotate(0deg)" }}>
            <ChevronDown size={16}/>
          </button>
        </div>

        {/* Datos clave */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(130px, 1fr))", gap:8 }}>
          {pedido.destino && (
            <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:12.5, color:C.sub }}>
              <MapPin size={13} color={C.brand}/> <span style={{ color:C.ink, fontWeight:600 }}>{pedido.destino}</span>
            </div>
          )}
          {pedido.fecha_entrega && (
            <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:12.5, color:C.sub }}>
              <CalendarDays size={13} color={C.brand}/>
              <span style={{ color:C.ink }}>{fmtFecha(pedido.fecha_entrega)}</span>
            </div>
          )}
          {pedido.hora_ida && (
            <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:12.5, color:C.sub }}>
              <Clock size={13} color="#f97316"/>
              <span>Salida: <strong style={{ color:C.ink }}>{fmtHora(pedido.hora_ida)}</strong></span>
            </div>
          )}
          {pedido.hora_vuelta && (
            <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:12.5, color:C.sub }}>
              <ArrowRight size={13} color={C.ok}/>
              <span>Retorno: <strong style={{ color:C.ink }}>{fmtHora(pedido.hora_vuelta)}</strong></span>
            </div>
          )}
          {nLineas > 0 && (
            <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:12.5, color:C.sub }}>
              <Package size={13} color={C.sub}/>
              <span>{nLineas} refs · {totalUds} uds</span>
            </div>
          )}
        </div>

        {/* Líneas expandidas */}
        {expand && (pedido.lineas || []).length > 0 && (
          <div style={{ marginTop:10, borderTop:`1px solid ${C.line}`, paddingTop:10 }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.sub, letterSpacing:.5,
              textTransform:"uppercase", marginBottom:6 }}>Material</div>
            <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
              {(pedido.lineas || []).map((l, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between",
                  fontSize:12.5, padding:"3px 0", borderBottom:`1px solid ${C.line}` }}>
                  <span style={{ color:C.ink }}>{l.nombre}</span>
                  <span style={{ color:C.sub, fontVariantNumeric:"tabular-nums" }}>
                    {l.cantidad} {l.unidad || "ud"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Credencial Preview (reutilizada en modal y en print) ──────────────── */
function CredencialCard({ veh, empresa, pedidoSel, colores, scale = 1 }) {
  const { fondo, acento, corneta } = colores;
  const s = n => n * scale;
  return (
    <div style={{
      width: s(323), height: s(204),          // 85.6mm × 54mm a 96dpi ≈ 323×204px
      background:"#fff", overflow:"hidden",
      display:"flex", flexDirection:"column",
      position:"relative", flexShrink:0,
      fontFamily:"Arial, sans-serif",
      borderRadius: s(6),
      boxShadow: scale === 1 ? "0 4px 20px rgba(0,0,0,.2)" : "none",
    }}>
      {/* Franja superior */}
      <div style={{ background:fondo, padding:`${s(9)}px ${s(13)}px`, position:"relative", flexShrink:0 }}>
        <div style={{ color:"#fff", fontWeight:800, fontSize:s(13), lineHeight:1.2 }}>
          {empresa?.nombre || "Empresa"}
        </div>
        {/* Triángulo esquina superior derecha */}
        <div style={{ position:"absolute", bottom:s(-11), right:s(-11), width:s(28), height:s(28),
          background:corneta, transform:"rotate(45deg)" }}/>
      </div>

      {/* Body */}
      <div style={{ flex:1, background:"#fff", padding:`${s(9)}px ${s(12)}px ${s(6)}px`,
        display:"flex", gap:s(8), alignItems:"flex-start" }}>
        {/* Logo */}
        <div style={{ width:s(50), height:s(50), borderRadius:"50%",
          border:`${s(2.5)}px solid ${acento}`,
          background:"#f5f5f5", overflow:"hidden", flexShrink:0,
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          {empresa?.logo_url
            ? <img src={empresa.logo_url} style={{ width:"100%", height:"100%", objectFit:"contain" }}/>
            : <span style={{ fontSize:s(8), color:"#aaa" }}>LOGO</span>}
        </div>
        {/* Datos */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:800, fontSize:s(13), color:"#1a1a1a", lineHeight:1.2,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {veh.nombre}
          </div>
          <div style={{ fontSize:s(8), color:fondo, fontWeight:700, letterSpacing:.4,
            textTransform:"uppercase", borderBottom:`${s(1.5)}px solid ${fondo}`,
            paddingBottom:s(2), marginBottom:s(4), marginTop:s(2) }}>
            Transportista
          </div>
          <div style={{ fontSize:s(9), color:"#333", marginBottom:s(2) }}>
            <strong>DNI:</strong> {veh.dni || <span style={{ color:"#ccc" }}>_______________</span>}
          </div>
          <div style={{ fontSize:s(9), color:"#333", marginBottom:s(2) }}>
            <strong>Matrícula:</strong> {veh.matricula || <span style={{ color:"#ccc" }}>___________</span>}
          </div>
          <div style={{ fontSize:s(9), color:"#333" }}>
            <strong>Modelo:</strong> {veh.modelo || <span style={{ color:"#ccc" }}>___________</span>}
          </div>
        </div>
      </div>

      {/* Pie evento */}
      <div style={{ background:"#f1f1f1", padding:`${s(4)}px ${s(12)}px`, textAlign:"center",
        fontSize:s(9), color:"#555", flexShrink:0, position:"relative" }}>
        {pedidoSel ? (pedidoSel.nombre || pedidoSel.codigo || `PED-${pedidoSel.id}`) : "Sin evento asignado"}
        {/* Triángulo esquina inferior derecha */}
        <div style={{ position:"absolute", bottom:0, right:0, width:s(20), height:s(20),
          background:fondo, clipPath:"polygon(100% 0, 100% 100%, 0 100%)" }}/>
      </div>
    </div>
  );
}

/* ─── Modal credencial PDF ───────────────────────────────────────────────── */
const PALETAS = [
  { nombre:"Rojo clásico", fondo:"#c0002a", acento:"#f59e0b", corneta:"#1a1a1a" },
  { nombre:"Azul marino",  fondo:"#1e3a5f", acento:"#f59e0b", corneta:"#c0002a" },
  { nombre:"Verde",        fondo:"#15803d", acento:"#fde047", corneta:"#1a1a1a" },
  { nombre:"Naranja",      fondo:"#c2410c", acento:"#fde047", corneta:"#1a1a1a" },
  { nombre:"Negro",        fondo:"#1a1a1a", acento:"#f59e0b", corneta:"#c0002a" },
  { nombre:"Morado",       fondo:"#6b21a8", acento:"#fde047", corneta:"#1a1a1a" },
];

function ModalCredencial({ veh, empresa, pedidosVeh, onClose }) {
  const [pedidoSel,  setPedidoSel]  = useState(pedidosVeh[0] || null);
  const [paletaIdx,  setPaletaIdx]  = useState(0);
  const [colores,    setColores]    = useState(PALETAS[0]);

  const usarPaleta = (idx) => {
    setPaletaIdx(idx);
    setColores(PALETAS[idx]);
  };

  const imprimir = () => {
    const { fondo, acento, corneta } = colores;
    const win = window.open("", "_blank", "width=500,height=400");
    const eventoTxt = pedidoSel
      ? (pedidoSel.nombre || pedidoSel.codigo || `PED-${pedidoSel.id}`)
      : "Sin evento asignado";
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>Credencial — ${veh.nombre}</title>
      <style>
        @page { size: 85.6mm 54mm; margin: 0; }
        * { box-sizing:border-box; margin:0; padding:0; }
        body { font-family:Arial,sans-serif; width:85.6mm; height:54mm; overflow:hidden; }
        .card { width:85.6mm; height:54mm; background:#fff; display:flex; flex-direction:column; position:relative; }
        .top { background:${fondo}; padding:3.2mm 4.5mm; position:relative; flex-shrink:0 }
        .top h1 { color:#fff; font-size:4.5mm; font-weight:800; margin:0; line-height:1.2 }
        .corner-tl { position:absolute; bottom:-3.5mm; right:-3.5mm; width:9mm; height:9mm; background:${corneta}; transform:rotate(45deg) }
        .body { flex:1; display:flex; gap:2.5mm; padding:3mm 4mm 2mm; }
        .logo { width:16mm; height:16mm; border-radius:50%; border:0.8mm solid ${acento}; background:#f5f5f5; overflow:hidden; flex-shrink:0; display:flex; align-items:center; justify-content:center }
        .logo img { width:100%; height:100%; object-fit:contain }
        .logo span { font-size:2.5mm; color:#aaa }
        .info { flex:1 }
        .nombre { font-size:4mm; font-weight:800; color:#1a1a1a; line-height:1.2 }
        .cargo { font-size:2.5mm; color:${fondo}; font-weight:700; letter-spacing:.3px; text-transform:uppercase; border-bottom:0.5mm solid ${fondo}; padding-bottom:0.7mm; margin:0.7mm 0 1.5mm }
        .fila { font-size:2.8mm; color:#333; margin-bottom:0.7mm }
        .fila strong { font-weight:700 }
        .pie { background:#f1f1f1; padding:1.3mm 4mm; text-align:center; font-size:2.8mm; color:#555; flex-shrink:0; position:relative }
        .corner-br { position:absolute; bottom:0; right:0; width:6mm; height:6mm; background:${fondo}; clip-path:polygon(100% 0,100% 100%,0 100%) }
        @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact } }
      </style></head><body>
      <div class="card">
        <div class="top"><h1>${empresa?.nombre || "Empresa"}</h1><div class="corner-tl"></div></div>
        <div class="body">
          <div class="logo">${empresa?.logo_url ? `<img src="${empresa.logo_url}"/>` : `<span>LOGO</span>`}</div>
          <div class="info">
            <div class="nombre">${veh.nombre}</div>
            <div class="cargo">Transportista</div>
            <div class="fila"><strong>DNI: </strong>${veh.dni || "_______________"}</div>
            <div class="fila"><strong>Matrícula: </strong>${veh.matricula || "___________"}</div>
            <div class="fila"><strong>Modelo: </strong>${veh.modelo || "___________"}</div>
          </div>
        </div>
        <div class="pie">${eventoTxt}<div class="corner-br"></div></div>
      </div>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", zIndex:700,
      display:"grid", placeItems:"center", padding:16 }} onClick={onClose}>
      <div style={{ background:C.surface, borderRadius:18, width:"100%", maxWidth:500,
        maxHeight:"90vh", display:"flex", flexDirection:"column",
        boxShadow:"var(--shadow-lg)" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:"14px 18px 12px", borderBottom:`1px solid ${C.line}`,
          display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          <Printer size={17} color={C.brand}/>
          <div style={{ flex:1, fontWeight:700, fontSize:15, color:C.ink }}>Credencial de conductor</div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer",
            color:C.sub, padding:4, display:"flex" }}><X size={16}/></button>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"14px 18px", display:"flex", flexDirection:"column", gap:14 }}>

          {/* Preview en vivo */}
          <div style={{ display:"flex", justifyContent:"center" }}>
            <CredencialCard veh={veh} empresa={empresa} pedidoSel={pedidoSel} colores={colores}/>
          </div>

          {/* Paletas de color */}
          <div>
            <div style={{ fontSize:12, fontWeight:600, color:C.sub, marginBottom:6 }}>Color de la credencial</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {PALETAS.map((p, i) => (
                <button key={i} onClick={() => usarPaleta(i)}
                  title={p.nombre}
                  style={{ width:28, height:28, borderRadius:"50%", border: i === paletaIdx
                    ? `3px solid ${C.ink}` : `2px solid transparent`,
                    background:p.fondo, cursor:"pointer", transition:"border .15s",
                    boxShadow: i === paletaIdx ? `0 0 0 2px ${C.surface}, 0 0 0 4px ${C.ink}` : "none" }}/>
              ))}
              {/* Color personalizado */}
              <label title="Color personalizado" style={{ width:28, height:28, borderRadius:"50%",
                border:`2px dashed ${C.strong}`, cursor:"pointer", display:"flex",
                alignItems:"center", justifyContent:"center", overflow:"hidden", position:"relative" }}>
                <span style={{ fontSize:16, color:C.sub }}>+</span>
                <input type="color" value={colores.fondo}
                  onChange={e => { setPaletaIdx(-1); setColores(c => ({ ...c, fondo:e.target.value })); }}
                  style={{ position:"absolute", opacity:0, width:"100%", height:"100%", cursor:"pointer" }}/>
              </label>
            </div>
          </div>

          {/* Color acento (anillo logo) */}
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.sub, flex:1 }}>Acento (anillo logo)</div>
            <input type="color" value={colores.acento}
              onChange={e => setColores(c => ({ ...c, acento:e.target.value }))}
              style={{ width:32, height:26, borderRadius:6, border:`1px solid ${C.line}`,
                cursor:"pointer", padding:2 }}/>
          </div>

          {/* Selector evento */}
          {pedidosVeh.length > 0 && (
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:C.sub, marginBottom:4 }}>Evento en credencial</div>
              <select value={pedidoSel?.id ?? ""}
                onChange={e => setPedidoSel(pedidosVeh.find(p => String(p.id) === e.target.value) || null)}
                style={{ width:"100%", padding:"8px 10px", borderRadius:8,
                  border:`1px solid ${C.strong}`, background:C.s2, fontSize:13,
                  fontFamily:"inherit", color:C.ink, outline:"none" }}>
                <option value="">Sin evento</option>
                {pedidosVeh.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.codigo || `PED-${p.id}`}{p.nombre ? ` · ${p.nombre}` : ""}{p.fecha_entrega ? ` (${fmtFecha(p.fecha_entrega)})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:"10px 18px 14px", borderTop:`1px solid ${C.line}`,
          display:"flex", justifyContent:"flex-end", gap:8, flexShrink:0 }}>
          <Btn outline onClick={onClose}>Cancelar</Btn>
          <Btn onClick={imprimir}>
            <Printer size={14}/> Imprimir / PDF
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ─── Exportar hoja de ruta ──────────────────────────────────────────────── */
function exportarHojaRutaPDF(veh, pedidos, empresa) {
  const fila = (label, val) => val
    ? `<tr><td style="padding:4px 8px;color:#555;font-size:11px;width:110px">${label}</td><td style="padding:4px 8px;font-size:11px;font-weight:600">${val}</td></tr>`
    : "";

  const tarjetas = pedidos.map(p => {
    const lineas = (p.lineas || []).map(l =>
      `<tr style="border-bottom:1px solid #f0f0f0">
        <td style="padding:3px 8px;font-size:11px">${l.nombre}</td>
        <td style="padding:3px 8px;font-size:11px;text-align:right;color:#555">${l.cantidad} ${l.unidad || "ud"}</td>
       </tr>`
    ).join("");
    return `
      <div style="page-break-inside:avoid;margin-bottom:20px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
        <div style="background:${veh.color};padding:8px 14px;display:flex;justify-content:space-between;align-items:center">
          <span style="color:#fff;font-weight:800;font-size:14px">${p.codigo || `PED-${p.id}`}</span>
          <span style="background:rgba(255,255,255,.25);color:#fff;padding:2px 8px;border-radius:999px;font-size:11px;text-transform:capitalize">${p.estado}</span>
        </div>
        <div style="padding:10px 14px">
          ${p.nombre ? `<div style="font-size:14px;font-weight:700;margin-bottom:8px">${p.nombre}</div>` : ""}
          <table style="width:100%;border-collapse:collapse">
            ${fila("Destino", p.destino)}
            ${fila("Fecha salida", p.fecha_entrega ? fmtFecha(p.fecha_entrega) + (p.hora_ida ? " · " + p.hora_ida : "") : "")}
            ${fila("Fecha retorno", p.fecha_retorno ? fmtFecha(p.fecha_retorno) + (p.hora_vuelta ? " · " + p.hora_vuelta : "") : "")}
          </table>
          ${lineas ? `
            <div style="margin-top:8px;border-top:1px solid #f0f0f0;padding-top:8px">
              <div style="font-size:10px;font-weight:700;color:#888;letter-spacing:.5px;margin-bottom:4px">MATERIAL</div>
              <table style="width:100%;border-collapse:collapse">${lineas}</table>
            </div>` : ""}
        </div>
      </div>`;
  }).join("");

  const win = window.open("", "_blank", "width=700,height=900");
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Hoja de ruta — ${veh.nombre}</title>
    <style>
      @page { size: A4; margin: 20mm 15mm; }
      body { font-family: Arial, sans-serif; color: #1a1a1a; }
      @media print { button { display:none } }
    </style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid ${veh.color}">
      <div>
        <div style="font-size:22px;font-weight:800;color:${veh.color}">${veh.nombre}</div>
        <div style="font-size:13px;color:#555;margin-top:2px">${veh.matricula} · ${veh.modelo}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:13px;font-weight:700">${empresa?.nombre || ""}</div>
        <div style="font-size:11px;color:#888">${pedidos.length} pedido${pedidos.length !== 1 ? "s" : ""}</div>
        <div style="font-size:11px;color:#888">${new Date().toLocaleDateString("es-ES")}</div>
      </div>
    </div>
    ${tarjetas || '<p style="color:#888;text-align:center;padding:40px">Sin pedidos asignados</p>'}
    <div style="margin-top:16px;text-align:center">
      <button onclick="window.print()" style="padding:8px 20px;background:${veh.color};color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-family:inherit">
        Imprimir / Guardar PDF
      </button>
    </div>
    </body></html>`);
  win.document.close();
}

function exportarHojaRutaExcel(veh, pedidos) {
  const rows = [
    ["Conductor", veh.nombre],
    ["Matrícula", veh.matricula],
    ["Modelo",    veh.modelo],
    [],
    ["CÓDIGO", "NOMBRE", "ESTADO", "DESTINO", "FECHA SALIDA", "HORA IDA", "FECHA RETORNO", "HORA VUELTA", "MATERIAL", "CANTIDAD", "UNIDAD"],
  ];
  pedidos.forEach(p => {
    if ((p.lineas || []).length === 0) {
      rows.push([p.codigo || `PED-${p.id}`, p.nombre || "", p.estado, p.destino || "",
        p.fecha_entrega || "", p.hora_ida || "", p.fecha_retorno || "", p.hora_vuelta || "", "", "", ""]);
    } else {
      (p.lineas || []).forEach((l, i) => {
        rows.push([
          i === 0 ? (p.codigo || `PED-${p.id}`) : "",
          i === 0 ? (p.nombre || "") : "",
          i === 0 ? p.estado : "",
          i === 0 ? (p.destino || "") : "",
          i === 0 ? (p.fecha_entrega || "") : "",
          i === 0 ? (p.hora_ida || "") : "",
          i === 0 ? (p.fecha_retorno || "") : "",
          i === 0 ? (p.hora_vuelta || "") : "",
          l.nombre, l.cantidad, l.unidad || "ud",
        ]);
      });
    }
  });

  // CSV fallback sin depender de xlsx aquí
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `HojaRuta_${veh.nombre}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

/* ─── TabFlota principal ─────────────────────────────────────────────────── */
export default function TabFlota({ pedidos = [], vehiculosEmpresa = [], empresa, formatoFecha = "DD/MM/YYYY", L }) {
  const [conductorId, setConductorId] = useState(null);
  const [filtro,      setFiltro]      = useState("hoy"); // hoy | semana | todos
  const [showCredencial, setShowCredencial] = useState(false);

  const veh = vehiculosEmpresa.find(v => v.id === conductorId) || null;

  const pedidosConductor = useMemo(() => {
    if (!conductorId) return [];
    return pedidos.filter(p =>
      String(p.vehiculo_id) === String(conductorId) && ESTADOS_ACTIVOS.has(p.estado)
    );
  }, [pedidos, conductorId]);

  const pedidosFiltrados = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    const lunesSemana = (() => {
      const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); return d.toISOString().slice(0, 10);
    })();
    const domingoSemana = (() => {
      const d = new Date(); d.setDate(d.getDate() - d.getDay() + 7); return d.toISOString().slice(0, 10);
    })();
    return pedidosConductor.filter(p => {
      const fecha = p.fecha_entrega || p.fecha_retorno || "";
      if (filtro === "hoy") return fecha === hoy;
      if (filtro === "semana") return fecha >= lunesSemana && fecha <= domingoSemana;
      return true;
    }).sort((a, b) => {
      const fa = a.fecha_entrega || a.fecha_retorno || "";
      const fb = b.fecha_entrega || b.fecha_retorno || "";
      if (fa !== fb) return fa.localeCompare(fb);
      return (a.hora_ida || "").localeCompare(b.hora_ida || "");
    });
  }, [pedidosConductor, filtro]);

  // Próxima salida del día
  const proximaSalida = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    const ahora = new Date().toTimeString().slice(0, 5);
    return pedidosConductor
      .filter(p => p.fecha_entrega === hoy && p.hora_ida && p.hora_ida > ahora)
      .sort((a, b) => a.hora_ida.localeCompare(b.hora_ida))[0] || null;
  }, [pedidosConductor]);

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* Header selección conductor */}
      <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.line}`, flexShrink:0,
        background:C.surface, display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
        <div style={{ background: veh ? `${veh.color}22` : C.brandSoft, color: veh ? veh.color : C.brand,
          borderRadius:12, padding:10, flexShrink:0 }}>
          <Truck size={22}/>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <h2 style={{ fontSize:18, margin:0, color:C.ink }}>Vista Conductor</h2>
          <p style={{ color:C.sub, fontSize:12.5, margin:0 }}>Selecciona tu vehículo para ver tus rutas</p>
        </div>
        <SelectorConductor vehiculos={vehiculosEmpresa} selId={conductorId} onSel={setConductorId}/>
      </div>

      {!conductorId ? (
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
          justifyContent:"center", gap:12, padding:32, textAlign:"center" }}>
          <Truck size={48} color={C.dim}/>
          <div style={{ fontSize:16, fontWeight:700, color:C.sub }}>Elige tu vehículo</div>
          <div style={{ fontSize:13, color:C.dim, maxWidth:280 }}>
            Selecciona arriba para ver tus pedidos, horarios y exportar tu hoja de ruta.
          </div>
        </div>
      ) : (
        <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>

          {/* Banner próxima salida */}
          {proximaSalida && (
            <div style={{ background: veh.color, padding:"10px 20px",
              display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
              <Clock size={16} color="#fff"/>
              <span style={{ color:"#fff", fontWeight:700, fontSize:13.5 }}>
                Próxima salida: {proximaSalida.hora_ida} · {proximaSalida.destino || proximaSalida.nombre || proximaSalida.codigo}
              </span>
            </div>
          )}

          {/* Barra acciones */}
          <div style={{ padding:"10px 20px", borderBottom:`1px solid ${C.line}`,
            display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", flexShrink:0 }}>
            {/* Filtros fecha */}
            {["hoy", "semana", "todos"].map(f => (
              <button key={f} onClick={() => setFiltro(f)}
                style={{ padding:"5px 12px", borderRadius:999, fontFamily:"inherit",
                  border:`1.5px solid ${filtro === f ? (veh?.color || C.brand) : C.line}`,
                  background: filtro === f ? `${veh?.color || C.brand}18` : C.s2,
                  color: filtro === f ? (veh?.color || C.brand) : C.sub,
                  fontWeight: filtro === f ? 700 : 400, fontSize:12.5, cursor:"pointer" }}>
                {f === "hoy" ? "Hoy" : f === "semana" ? "Esta semana" : "Todos"}
              </button>
            ))}
            <div style={{ flex:1 }}/>
            {/* Acciones */}
            <Btn outline onClick={() => exportarHojaRutaExcel(veh, pedidosFiltrados)}
              style={{ fontSize:12, padding:"6px 11px" }}>
              <FileDown size={13}/> Excel/CSV
            </Btn>
            <Btn outline onClick={() => exportarHojaRutaPDF(veh, pedidosFiltrados, empresa)}
              style={{ fontSize:12, padding:"6px 11px" }}>
              <FileDown size={13}/> PDF
            </Btn>
            <Btn onClick={() => setShowCredencial(true)}
              style={{ fontSize:12, padding:"6px 11px" }}>
              <Printer size={13}/> Credencial
            </Btn>
          </div>

          {/* Stats rápidas */}
          <div style={{ padding:"10px 20px", borderBottom:`1px solid ${C.line}`,
            display:"flex", gap:16, flexShrink:0, overflowX:"auto" }}>
            {[
              { label:"Total", val: pedidosConductor.length, color: veh.color },
              { label:"Confirmados", val: pedidosConductor.filter(p => p.estado === "confirmado").length, color: C.ok },
              { label:"En retorno", val: pedidosConductor.filter(p => p.estado === "retorno").length, color: C.warn },
              { label:"Finalizados", val: pedidosConductor.filter(p => p.estado === "finalizado").length, color: "#2563eb" },
            ].map(s => (
              <div key={s.label} style={{ display:"flex", alignItems:"baseline", gap:5, flexShrink:0 }}>
                <span style={{ fontSize:20, fontWeight:800, color:s.color, fontVariantNumeric:"tabular-nums" }}>{s.val}</span>
                <span style={{ fontSize:12, color:C.sub }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Lista pedidos */}
          <div style={{ flex:1, overflowY:"auto", padding:"12px 20px",
            display:"flex", flexDirection:"column", gap:10 }}>
            {pedidosFiltrados.length === 0 ? (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
                justifyContent:"center", flex:1, gap:10, padding:32, textAlign:"center" }}>
                <CheckCircle2 size={36} color={C.ok}/>
                <div style={{ color:C.sub, fontSize:14 }}>
                  {filtro === "hoy" ? "Sin pedidos para hoy" : "Sin pedidos en este período"}
                </div>
              </div>
            ) : (
              pedidosFiltrados.map(p => <TarjetaPedido key={p.id} pedido={p} veh={veh}/>)
            )}
          </div>
        </div>
      )}

      {showCredencial && veh && (
        <ModalCredencial
          veh={veh}
          empresa={empresa}
          pedidosVeh={pedidosConductor}
          onClose={() => setShowCredencial(false)}
        />
      )}
    </div>
  );
}
