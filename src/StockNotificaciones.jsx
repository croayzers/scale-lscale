// Sistema de notificaciones de stock: toasts al reservar/retornar materiales
// + panel de alertas de stock bajo mínimo con botón de silenciar por material.
import React, { useEffect, useRef } from "react";
import { X, AlertTriangle, Package, RotateCcw, ShoppingBag, BellOff } from "lucide-react";
import { C } from "./lib/ui.jsx";

/* ─── Toast individual ───────────────────────────────────────────────────── */
function Toast({ notif, onDismiss }) {
  const timerRef = useRef(null);

  useEffect(() => {
    // Auto-dismiss después de 12 s
    timerRef.current = setTimeout(() => onDismiss(notif.id), 12000);
    return () => clearTimeout(timerRef.current);
  }, [notif.id, onDismiss]);

  const esRetorno = notif.tipo === "retorno";
  const accentColor = esRetorno ? "var(--ok)" : "var(--brand)";
  const accentSoft  = esRetorno ? "var(--ok-soft)" : "var(--brand-soft)";
  const Icon = esRetorno ? RotateCcw : ShoppingBag;

  // Agrupar lineas por categoría
  const porCategoria = {};
  for (const l of (notif.lineas || [])) {
    const cat = l.categoria || "(sin categoría)";
    if (!porCategoria[cat]) porCategoria[cat] = [];
    porCategoria[cat].push(l);
  }
  const cats = Object.entries(porCategoria);

  return (
    <div style={{
      background: "var(--surface)",
      borderRadius: 14,
      boxShadow: "0 8px 32px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.10)",
      border: `1.5px solid ${accentColor}44`,
      overflow: "hidden",
      maxWidth: 380,
      width: "100%",
      animation: "slideInRight .25s ease",
    }}>
      {/* Barra de color superior */}
      <div style={{ height: 3, background: accentColor }}/>

      <div style={{ padding: "12px 14px 14px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
          <div style={{ background: accentSoft, color: accentColor, borderRadius: 8, padding: 7,
            flexShrink: 0, display: "flex" }}>
            <Icon size={15}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>
              {esRetorno ? "Retorno registrado" : "Pedido reservado"}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 2,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {notif.codigo}{notif.nombre ? ` · ${notif.nombre}` : ""}
            </div>
          </div>
          <button onClick={() => onDismiss(notif.id)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)",
              padding: 3, display: "flex", flexShrink: 0, borderRadius: 6,
              transition: "color .12s" }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--text-3)"}>
            <X size={15}/>
          </button>
        </div>

        {/* Líneas por categoría */}
        {cats.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {cats.map(([cat, lineas]) => {
              const totalUds = lineas.reduce((s, l) => s + (Number(l.cantidad) || 0), 0);
              return (
                <div key={cat} style={{ background: "var(--surface-2)", borderRadius: 8,
                  padding: "6px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", flex: 1,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {cat}
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: accentColor,
                    background: accentSoft, borderRadius: 999, padding: "1px 8px", flexShrink: 0 }}>
                    {esRetorno ? "+" : "−"}{totalUds} {lineas[0]?.unidad || "ud"}
                  </span>
                  <span style={{ fontSize: 10.5, color: "var(--text-3)", flexShrink: 0 }}>
                    {lineas.length} ref.
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Alertas de stock bajo incluidas en esta notificación */}
        {notif.bajosMinimo?.length > 0 && (
          <div style={{ marginTop: 10, background: "#fef2f2", border: "1px solid #fca5a5",
            borderRadius: 8, padding: "8px 10px", display: "flex", gap: 8, alignItems: "flex-start" }}>
            <AlertTriangle size={14} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "#dc2626", marginBottom: 4 }}>
                Stock bajo mínimo
              </div>
              {notif.bajosMinimo.map((m, i) => (
                <div key={i} style={{ fontSize: 11, color: "#b91c1c",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.nombre}: {m.stock_actual} / mín. {m.stock_minimo} {m.unidad}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Contenedor de toasts ───────────────────────────────────────────────── */
export function ToastContainer({ notificaciones, onDismiss }) {
  if (!notificaciones.length) return null;
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 900,
      display: "flex", flexDirection: "column-reverse", gap: 10,
      maxWidth: 400, width: "calc(100vw - 48px)",
      pointerEvents: "none",
    }}>
      {notificaciones.map(n => (
        <div key={n.id} style={{ pointerEvents: "all" }}>
          <Toast notif={n} onDismiss={onDismiss}/>
        </div>
      ))}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(40px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* ─── Panel de alertas permanentes (stock bajo mínimo) ───────────────────── */
// silenciados: Set de material ids que el usuario ha ignorado
export function PanelAlertasStock({ materiales, silenciados, onSilenciar }) {
  const alertas = materiales.filter(m =>
    m.stock_minimo > 0 &&
    m.stock_actual < m.stock_minimo &&
    !silenciados.has(String(m.id))
  );
  if (!alertas.length) return null;

  return (
    <div style={{
      background: "#fef2f2",
      borderBottom: "2px solid #fca5a5",
      padding: "10px 20px",
      flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <AlertTriangle size={15} color="#dc2626"/>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", flex: 1 }}>
          {alertas.length} material{alertas.length !== 1 ? "es" : ""} por debajo del stock mínimo
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 180, overflowY: "auto" }}>
        {alertas.map(m => (
          <div key={m.id} style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "#fee2e2", borderRadius: 8, padding: "6px 10px",
            border: "1px solid #fca5a5",
          }}>
            <Package size={13} color="#dc2626" style={{ flexShrink: 0 }}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#991b1b",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                display: "block" }}>
                {m.nombre}
              </span>
              <span style={{ fontSize: 11, color: "#b91c1c" }}>
                {m.categoria && `${m.categoria} · `}
                Stock: <strong>{m.stock_actual}</strong> / mín. <strong>{m.stock_minimo}</strong> {m.unidad}
                {m.ubicacion ? ` · ${m.ubicacion}` : ""}
              </span>
            </div>
            <button
              onClick={() => onSilenciar(String(m.id))}
              title="Silenciar esta advertencia"
              style={{
                background: "none", border: "1px solid #fca5a5", cursor: "pointer",
                color: "#dc2626", borderRadius: 6, padding: "3px 8px", fontSize: 11,
                fontFamily: "inherit", fontWeight: 600, flexShrink: 0,
                display: "flex", alignItems: "center", gap: 4,
              }}>
              <BellOff size={11}/> Silenciar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Utilidad: construir objeto de notificación ─────────────────────────── */
// matSnapshot: snapshot de materiales DESPUÉS de aplicar la operación (retorno ya sumó, pedido no resta)
// Para pedido: bajosMinimo = materiales que estarían bajo mínimo si se descontara el pedido (aviso preventivo)
// Para retorno: matSnapshot ya tiene el stock actualizado → comparar directamente con stock_minimo
export function crearNotificacion(pedido, matSnapshot, tipo = "pedido") {
  const lineas = (pedido.lineas || []).filter(l => (Number(l.cantidad) || 0) > 0);

  const bajosMinimo = lineas
    .map(l => {
      const mat = matSnapshot.find(m =>
        (l.material_id && m.id === l.material_id) ||
        m.nombre?.trim().toLowerCase() === l.nombre?.trim().toLowerCase()
      );
      if (!mat) return null;

      let stockMostrar;
      if (tipo === "retorno") {
        // El stock ya fue incrementado en matSnapshot — comparar directamente
        stockMostrar = Number(mat.stock_actual) || 0;
      } else {
        // Pedido: stock no se descuenta aún, simular el descuento para aviso preventivo
        stockMostrar = (Number(mat.stock_actual) || 0) - (Number(l.cantidad) || 0);
      }

      if (mat.stock_minimo > 0 && stockMostrar < mat.stock_minimo) {
        return { nombre: mat.nombre, stock_actual: Math.max(0, stockMostrar), stock_minimo: mat.stock_minimo, unidad: mat.unidad || "ud" };
      }
      return null;
    })
    .filter(Boolean);

  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    tipo,
    codigo: pedido.codigo || `PED-${pedido.id}`,
    nombre: pedido.nombre || "",
    lineas,
    bajosMinimo,
    ts: Date.now(),
  };
}
