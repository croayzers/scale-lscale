// Pantalla dividida de logística de eventos.
// Se muestra dentro del detalle de un pedido cuando tipo_pedido === 'evento'.
import React, { useState } from 'react';
import { analizarDisponibilidadEvento, calcularMargenPedido, construirLineasSubalquiler } from './lib/stockEventos.js';

const fmt = (n, dec = 2) => n != null ? Number(n).toFixed(dec) : '—';

const OPCIONES = [
  {
    id: 'solo_almacen',
    label: 'Solo Almacén',
    desc: 'Todo sale del stock propio — no se involucran proveedores',
    color: 'var(--ok)',
  },
  {
    id: 'mixto',
    label: 'Mixto',
    desc: 'Agota el stock propio y subalquila solo lo que falta',
    color: 'var(--brand)',
  },
  {
    id: 'subalquiler_integro',
    label: 'Solo Proveedor',
    desc: 'Todo el material viene del proveedor — el almacén no se modifica',
    color: 'var(--warn)',
  },
  {
    id: 'retorno_express',
    label: 'Retorno Express',
    desc: 'Reutilizar material de un evento que termina justo antes — activa alerta',
    color: '#7c3aed',
  },
];

export default function PantallaEventoLogistica({
  pedido,
  materiales,
  reservas,
  proveedores,
  correlaciones,
  proveedor_items,
  onGuardarSubalquiler,
  onCerrar,
}) {
  const analisis = analizarDisponibilidadEvento({
    lineas:      pedido.lineas || [],
    materiales,
    reservas,
    proveedores,
    correlaciones,
    proveedor_items,
    fechaInicio: pedido.fecha_evento_inicio,
    fechaFin:    pedido.fecha_evento_fin,
    pedidoId:    pedido.id,
  });

  const hayFaltante = analisis.some(i => i.faltante > 0);
  const [opcion, setOpcion] = useState(hayFaltante ? 'mixto' : 'solo_almacen');
  const [enviando, setEnviando] = useState(false);

  const { costeTotal, margenPct } = calcularMargenPedido(analisis, pedido.pvp_total ?? null);

  async function handleEmitir() {
    setEnviando(true);
    const lineas = construirLineasSubalquiler(analisis, opcion);
    await onGuardarSubalquiler?.(lineas);
    setEnviando(false);
  }

  const esSoloProveedor = opcion === 'subalquiler_integro';

  return (
    <div style={{ position:'fixed', inset:0, zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,.5)' }}>
      <div style={{ background:'var(--surface)', borderRadius:16, boxShadow:'var(--shadow-lg)', width:'100%', maxWidth:940, margin:'0 16px', maxHeight:'90vh', overflowY:'auto' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--border)' }}>
          <div>
            <div style={{ fontWeight:700, fontSize:16 }}>Logística de Evento — {pedido.nombre}</div>
            <div style={{ fontSize:12.5, color:'var(--text-2)', marginTop:2 }}>
              {pedido.fecha_evento_inicio} → {pedido.fecha_evento_fin}
              {pedido.lineas?.length ? ` · ${pedido.lineas.length} materiales` : ''}
            </div>
          </div>
          <button onClick={onCerrar} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-2)', fontSize:22, lineHeight:1 }}>×</button>
        </div>

        {/* ── Paso 1: Tipo de suministro ── */}
        <div style={{ margin:'16px 20px 0', padding:'14px 16px', background:'var(--surface-2)', borderRadius:12, border:'1px solid var(--border)' }}>
          <div style={{ fontSize:11, fontWeight:800, color:'var(--text-2)', letterSpacing:.8, textTransform:'uppercase', marginBottom:10 }}>
            Paso 1 — ¿Cómo se suministra el material?
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {OPCIONES.map(op => (
              <button
                key={op.id}
                onClick={() => setOpcion(op.id)}
                style={{
                  flex:'1 1 160px', padding:'10px 12px', borderRadius:10, cursor:'pointer',
                  border: opcion === op.id ? `2px solid ${op.color}` : '2px solid var(--border)',
                  background: opcion === op.id ? `color-mix(in srgb, ${op.color} 12%, transparent)` : 'var(--surface)',
                  color: opcion === op.id ? op.color : 'var(--text-2)',
                  textAlign:'left', fontFamily:'inherit', transition:'all .15s',
                }}
              >
                <div style={{ fontWeight:700, fontSize:13 }}>{op.label}</div>
                <div style={{ fontSize:11.5, marginTop:3, opacity:.8, color:'var(--text-2)' }}>{op.desc}</div>
              </button>
            ))}
          </div>

          {/* Notas contextuales */}
          {esSoloProveedor && (
            <div style={{ marginTop:10, padding:'8px 12px', background:'#fef3c7', border:'1px solid #fcd34d', borderRadius:8, fontSize:12.5, color:'#92400e', fontWeight:600 }}>
              ⚠ El stock del almacén NO se modificará — todo el material se pedirá al proveedor.
            </div>
          )}
          {opcion === 'solo_almacen' && hayFaltante && (
            <div style={{ marginTop:10, padding:'8px 12px', background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:8, fontSize:12.5, color:'#dc2626', fontWeight:600 }}>
              ⚠ Hay materiales sin stock suficiente. Con esta opción el almacén se quedará en números negativos.
            </div>
          )}
        </div>

        {/* Alerta escasez — informativa cuando opción lo requiere */}
        {hayFaltante && !esSoloProveedor && opcion !== 'solo_almacen' && (
          <div style={{ margin:'12px 20px 0', padding:'10px 14px', background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:10, fontSize:13, color:'#92400e' }}>
            Hay materiales sin stock suficiente para estas fechas.
          </div>
        )}

        {/* ── Paso 2: Tabla de materiales ── */}
        <div style={{ margin:'16px 20px 0' }}>
          <div style={{ fontSize:11, fontWeight:800, color:'var(--text-2)', letterSpacing:.8, textTransform:'uppercase', marginBottom:8 }}>
            Paso 2 — Análisis de materiales
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', fontSize:13, borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--border)', color:'var(--text-2)', fontSize:11.5, textTransform:'uppercase', letterSpacing:.4 }}>
                  <th style={{ paddingBottom:8, paddingRight:12, textAlign:'left', fontWeight:600 }}>Material</th>
                  <th style={{ paddingBottom:8, paddingRight:12, textAlign:'right', fontWeight:600 }}>Solicitado</th>
                  <th style={{ paddingBottom:8, paddingRight:12, textAlign:'right', fontWeight:600 }}>Disponible</th>
                  <th style={{ paddingBottom:8, paddingRight:12, textAlign:'right', fontWeight:600 }}>Faltante</th>
                  <th style={{ paddingBottom:8, paddingRight:12, textAlign:'left', fontWeight:600 }}>Cobertura</th>
                  <th style={{ paddingBottom:8, textAlign:'right', fontWeight:600 }}>Coste Est.</th>
                </tr>
              </thead>
              <tbody>
                {analisis.map((item, i) => {
                  const bloqueProp = item.bloques.find(b => b.tipo === 'propio');
                  const bloqueSub  = item.bloques.find(b => b.tipo === 'subalquiler');
                  const costeItem  = item.bloques.reduce((s, b) => s + (b.coste_total ?? 0), 0);

                  return (
                    <tr key={i} style={{ borderBottom:'1px solid var(--border)', background: item.faltante > 0 && !esSoloProveedor ? '#fef2f2' : 'transparent' }}>
                      <td style={{ padding:'8px 12px 8px 0', fontWeight:500 }}>{item.linea.nombre || item.material?.nombre || '?'}</td>
                      <td style={{ padding:'8px 12px 8px 0', textAlign:'right' }}>{item.linea.cantidad}</td>
                      <td style={{ padding:'8px 12px 8px 0', textAlign:'right', fontWeight:600,
                        color: esSoloProveedor ? 'var(--text-2)' : item.disponible < (Number(item.linea.cantidad) || 0) ? 'var(--danger)' : 'var(--ok)' }}>
                        {esSoloProveedor ? '—' : item.disponible}
                      </td>
                      <td style={{ padding:'8px 12px 8px 0', textAlign:'right', fontWeight:700, color:'var(--danger)' }}>
                        {esSoloProveedor ? '—' : item.faltante > 0 ? item.faltante : '—'}
                      </td>
                      <td style={{ padding:'8px 12px 8px 0' }}>
                        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                          {bloqueProp && !esSoloProveedor && (
                            <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11.5, background:'#dcfce7', color:'#166534', borderRadius:999, padding:'2px 8px' }}>
                              {bloqueProp.cantidad} ud propio
                              {bloqueProp.coste_unitario_diario > 0 && ` · ${fmt(bloqueProp.coste_unitario_diario, 4)}€/ud/día`}
                            </span>
                          )}
                          {esSoloProveedor && (
                            <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11.5, background:'#fef3c7', color:'#92400e', borderRadius:999, padding:'2px 8px' }}>
                              {item.linea.cantidad} ud proveedor
                              {bloqueSub?.proveedor_nombre && ` · ${bloqueSub.proveedor_nombre}`}
                              {bloqueSub?.coste_unitario != null && ` · ${fmt(bloqueSub.coste_unitario)}€/ud`}
                            </span>
                          )}
                          {bloqueSub && item.faltante > 0 && !esSoloProveedor && (
                            <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11.5, background:'#fef3c7', color:'#92400e', borderRadius:999, padding:'2px 8px' }}>
                              {bloqueSub.cantidad} ud subalquiler
                              {bloqueSub.proveedor_nombre && ` · ${bloqueSub.proveedor_nombre}`}
                              {bloqueSub.coste_unitario != null && ` · ${fmt(bloqueSub.coste_unitario)}€/ud`}
                            </span>
                          )}
                          {opcion === 'retorno_express' && item.faltante > 0 && (
                            <span style={{ fontSize:11.5, color:'#7c3aed', fontWeight:600 }}>⚡ Alerta Retorno Express</span>
                          )}
                          {opcion === 'solo_almacen' && item.faltante > 0 && (
                            <span style={{ fontSize:11.5, color:'#dc2626', fontWeight:600 }}>⚠ Sin stock suficiente</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding:'8px 0', textAlign:'right', fontWeight:600, color:'var(--text)' }}>
                        {costeItem > 0 && !esSoloProveedor ? `${fmt(costeItem)}€` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {costeTotal > 0 && !esSoloProveedor && (
                <tfoot>
                  <tr style={{ borderTop:'2px solid var(--border)' }}>
                    <td colSpan={5} style={{ paddingTop:8, textAlign:'right', color:'var(--text-2)' }}>Coste Total Estimado:</td>
                    <td style={{ paddingTop:8, textAlign:'right', fontWeight:700, color:'var(--text)' }}>{fmt(costeTotal)}€</td>
                  </tr>
                  {margenPct != null && (
                    <tr>
                      <td colSpan={5} style={{ textAlign:'right', color:'var(--text-2)', fontSize:12.5 }}>Margen estimado:</td>
                      <td style={{ textAlign:'right', fontWeight:600, fontSize:12.5, color: margenPct >= 0 ? 'var(--ok)' : 'var(--danger)' }}>
                        {fmt(margenPct, 1)}%
                      </td>
                    </tr>
                  )}
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:10, padding:'16px 20px', borderTop:'1px solid var(--border)', marginTop:16 }}>
          <button onClick={onCerrar} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text)', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
            Cancelar
          </button>
          <button
            onClick={handleEmitir}
            disabled={enviando}
            style={{ padding:'8px 18px', borderRadius:8, border:'none',
              background: enviando ? '#93c5fd' : opcion === 'solo_almacen' ? 'var(--ok)' : 'var(--brand)',
              color:'#fff', fontSize:13, fontWeight:700,
              cursor: enviando ? 'default' : 'pointer', fontFamily:'inherit' }}
          >
            {enviando
              ? 'Guardando…'
              : opcion === 'solo_almacen'
              ? 'Confirmar (solo almacén)'
              : 'Emitir Orden de Suministro'}
          </button>
        </div>
      </div>
    </div>
  );
}
