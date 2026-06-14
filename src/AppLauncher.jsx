import React, { useState, useRef, useEffect } from "react";
import { C } from "./lib/ui.jsx";
import { cargarApps, appUrl } from "./lib/appsRegistry.js";

const IS_DEV = typeof import.meta !== "undefined" && import.meta.env?.DEV;

const PORTAL_URL_DEFAULT = IS_DEV ? "http://localhost:3000" : "https://thescaleapps.com";

// Icono de 9 puntos estilo Google
function GridIcon({ size = 18, color = "currentColor" }) {
  const r = size * 0.11;
  const g = size * 0.36;
  const positions = [
    [g * 0, g * 0], [g * 1, g * 0], [g * 2, g * 0],
    [g * 0, g * 1], [g * 1, g * 1], [g * 2, g * 1],
    [g * 0, g * 2], [g * 1, g * 2], [g * 2, g * 2],
  ];
  const offset = (size - g * 2) / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      {positions.map(([x, y]) => (
        <circle key={`dot-${x}-${y}`} cx={offset + x} cy={offset + y} r={r} fill={color} />
      ))}
    </svg>
  );
}

export default function AppLauncher({ empresa, currentAppId = "lscale" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const portalUrl = import.meta.env?.VITE_PORTAL_URL || PORTAL_URL_DEFAULT;

  // Catálogo desde Supabase (apps_registry), filtrado por apps contratadas.
  const [catalogo, setCatalogo] = useState([]);
  useEffect(() => { cargarApps().then(setCatalogo); }, []);
  const appsActivas = empresa?.apps || [];
  const apps = catalogo.filter(a => appsActivas.includes(a.id));

  // Cerrar al click fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Botón grid */}
      <button
        onClick={() => setOpen(v => !v)}
        title="Cambiar de app"
        style={{
          border: "none", cursor: "pointer",
          padding: 6, borderRadius: 8, display: "flex",
          color: open ? C.brand : C.sub,
          background: open ? C.brandSoft : "none",
        }}
      >
        <GridIcon size={18} color="currentColor" />
      </button>

      {/* Popup */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          width: 240, background: C.surface,
          border: `1px solid ${C.line}`,
          borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,.18)",
          padding: "14px 12px 10px", zIndex: 999,
          display: "flex", flexDirection: "column", gap: 0,
        }}>
          {/* Header */}
          <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 12, paddingLeft: 4 }}>
            Scale Apps
          </div>

          {/* Grid de apps */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, marginBottom: 10 }}>
            {apps.map(app => {
              const isCurrent = app.id === currentAppId;
              const url = isCurrent ? null : appUrl(app);
              return (
                <a
                  key={app.id}
                  href={url || "#"}
                  target={isCurrent ? "_self" : "_blank"}
                  rel="noreferrer"
                  onClick={!url ? (e) => e.preventDefault() : undefined}
                  title={app.nombre}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                    padding: "10px 6px 8px", borderRadius: 12, textDecoration: "none",
                    background: isCurrent ? `${app.color}14` : "transparent",
                    border: isCurrent ? `1px solid ${app.color}33` : "1px solid transparent",
                    opacity: url || isCurrent ? 1 : 0.4,
                    cursor: url || isCurrent ? "pointer" : "default",
                    transition: "background .12s",
                  }}
                  onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = C.s2; }}
                  onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, fontSize: 20,
                    display: "grid", placeItems: "center",
                    background: `${app.color}18`,
                  }}>
                    {app.emoji}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? app.color : C.ink, textAlign: "center" }}>
                    {app.nombre}
                  </span>
                </a>
              );
            })}
          </div>

          {/* Divider + Portal */}
          <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 8 }}>
            <a
              href={portalUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                borderRadius: 10, textDecoration: "none", color: C.ink,
                transition: "background .12s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.s2}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div style={{ width: 32, height: 32, borderRadius: 9, background: C.brand, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 15, flexShrink: 0 }}>S</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Scale Portal</div>
                <div style={{ fontSize: 11, color: C.sub }}>Cuenta y administración</div>
              </div>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
