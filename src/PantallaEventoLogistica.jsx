// Pantalla de disponibilidad de stock para pedidos de evento.
// Se muestra solo para pedidos tipo_pedido === 'evento' y tipo_origen === 'almacen'.
import React, { useState, useMemo } from 'react';
import { analizarDisponibilidadEvento, calcularMargenPedido, construirLineasSubalquiler } from './lib/stockEventos.js';

const fmt = (n, dec = 2) => n != null ? Number(n).toFixed(dec) : '—';

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
  const [enviando, setEnviando] = useState(false);

  const analisis = useMemo(() => analizarDisponibilidadEvento({
    lineas:      pedido.lineas || [],
    materiales,
    reservas,
    proveedores,
    correlaciones,
    proveedor_items,
    fechaInicio: pedido.fecha_evento_inicio,
    fechaFin:    pedido.fecha_evento_fin,
    pedidoId:    pedido.id,
  }), [pedido, materiales, reservas, proveedores, correlaciones, proveedor_items]);

  const hayFaltante = analisis.some(i => i.faltante > 0);
  const { costeTotal, margenPct } = calcularMargenPedido(analisis, pedido.pvp_total ?? null);

  async function handleConfirmar(conSubalquiler) {
    setEnviando(true);
    const lineas = conSubalquiler ? construirLineasSubalquiler(analisis, 'mixto') : [];
    await onGuardarSubalquiler?.(lineas);
    setEnviando(false);
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:500, overflowY:'auto', display:'flex', alignItems:'flex-start', justifyContent:'center', background:'rgba(0,0,0,.5)', padding:'24px 0' }}>
      <div style={{ background:'var(--surface)', borderRadius:16, boxShadow:'var(--shadow-lg)', width:'100%', maxWidth:820, margin:'auto 16px', maxHeight:'none', display:'flex', flexDirection:'column' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--border)' }}>
          <div>
            <div style={{ fontWeight:700, fontSize:16 }}>Disponibilidad — {pedido.nombre}</div>
            <div style={{ fontSize:12.5, color:'var(--text-2)', marginTop:2 }}>
              {pedido.fecha_evento_inicio} → {pedido.fecha_evento_fin}
              {pedido.lineas?.length ? ` · ${pedido.lineas.length} materiales` : ''}
            </div>
          </div>
          <button onClick={onCerrar} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-2)', fontSize:22, lineHeight:1 }}>×</button>
        </div>

        {/* Alerta escasez */}
        {hayFaltante && (
          <div style={{ margin:'14px 20px 0', padding:'10px 14px', background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:10, fontSize:13, color:'#92400e', fontWeight:500 }}>
            ⚠ Hay materiales sin stock suficiente para estas fechas — se generará una orden de subalquiler para lo que falta.
          </div>
        )}

        {/* Tabla de análisis */}
        <div style={{ margin:'16px 20px 0', overflowX:'auto' }}>
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
                  <tr key={i} style={{ borderBottom:'1px solid var(--border)', background: item.faltante > 0 ? '#fef2f2' : 'transparent' }}>
                    <td style={{ padding:'8px 12px 8px 0', fontWeight:500 }}>{item.linea.nombre || item.material?.nombre || '?'}</td>
                    <td style={{ padding:'8px 12px 8px 0', textAlign:'right' }}>{item.linea.cantidad}</td>
                    <td style={{ padding:'8px 12px 8px 0', textAlign:'right', fontWeight:600, color: item.disponible < (Number(item.linea.cantidad) || 0) ? 'var(--danger)' : 'var(--ok)' }}>
                      {item.disponible}
                    </td>
                    <td style={{ padding:'8px 12px 8px 0', textAlign:'right', fontWeight:700, color:'var(--danger)' }}>
                      {item.faltante > 0 ? item.faltante : '—'}
                    </td>
                    <td style={{ padding:'8px 12px 8px 0' }}>
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        {bloqueProp && (
                          <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11.5, background:'#dcfce7', color:'#166534', borderRadius:999, padding:'2px 8px' }}>
                            {bloqueProp.cantidad} ud propio
                            {bloqueProp.coste_unitario_diario > 0 && ` · ${fmt(bloqueProp.coste_unitario_diario, 4)}€/ud/día`}
                          </span>
                        )}
                        {bloqueSub && item.faltante > 0 && (
                          <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11.5, background:'#fef3c7', color:'#92400e', borderRadius:999, padding:'2px 8px' }}>
                            {bloqueSub.cantidad} ud subalquiler
                            {bloqueSub.proveedor_nombre && ` · ${bloqueSub.proveedor_nombre}`}
                            {bloqueSub.coste_unitario != null && ` · ${fmt(bloqueSub.coste_unitario)}€/ud`}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding:'8px 0', textAlign:'right', fontWeight:600, color:'var(--text)' }}>
                      {costeItem > 0 ? `${fmt(costeItem)}€` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {costeTotal > 0 && (
              <tfoot>
                <tr style={{ borderTop:'2px solid var(--border)' }}>
                  <td colSpan={5} style={{ paddingTop:8, textAlign:'right', color:'var(--text-2)' }}>Coste Total Estimado:</td>
                  <td style={{ paddingTop:8, textAlign:'right', fontWeight:700 }}>{fmt(costeTotal)}€</td>
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

        {/* Acciones */}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:10, padding:'16px 20px', borderTop:'1px solid var(--border)', marginTop:16 }}>
          <button onClick={onCerrar} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text)', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
            Cancelar
          </button>
          {hayFaltante ? (
            <button onClick={() => handleConfirmar(true)} disabled={enviando}
              style={{ padding:'8px 18px', borderRadius:8, border:'none', background: enviando ? '#93c5fd' : 'var(--brand)', color:'#fff', fontSize:13, fontWeight:700, cursor: enviando ? 'default' : 'pointer', fontFamily:'inherit' }}>
              {enviando ? 'Guardando…' : 'Confirmar con subalquiler'}
            </button>
          ) : (
            <button onClick={() => handleConfirmar(false)} disabled={enviando}
              style={{ padding:'8px 18px', borderRadius:8, border:'none', background: enviando ? '#86efac' : 'var(--ok)', color:'#fff', fontSize:13, fontWeight:700, cursor: enviando ? 'default' : 'pointer', fontFamily:'inherit' }}>
              {enviando ? 'Guardando…' : 'Stock suficiente — Confirmar reserva'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
