// MARK: - C (paleta)
// MARK: - Badge
// MARK: - Btn
// MARK: - ModalField
// MARK: - Help
import React, { useState } from "react";

export const C = {
  bg: "var(--bg)", surface: "var(--surface)", s2: "var(--surface-2)",
  line: "var(--border)", strong: "var(--border-strong)",
  ink: "var(--text)", sub: "var(--text-2)", dim: "var(--text-3)",
  brand: "var(--brand)", brandSoft: "var(--brand-soft)",
  ok: "var(--ok)", okSoft: "var(--ok-soft)",
  warn: "var(--warn)", warnSoft: "var(--warn-soft)",
  danger: "var(--danger)", dangerSoft: "var(--danger-soft)",
};

// MARK: - Help
// Pequeño icono "?" con tooltip al pasar el ratón. Reutilizable en cabeceras
// de tabla, etiquetas de formulario, etc. Sin dependencias externas.
export function Help({ text, size = 14, align = "center", pos = "above" }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const left = align === "left" ? "0" : align === "right" ? "auto" : "50%";
  const right = align === "right" ? "0" : "auto";
  const tx = align === "center" ? "translateX(-50%)" : "none";
  return (
    <span style={{ position:"relative", display:"inline-flex", verticalAlign:"middle", marginLeft:4 }}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center",
        width:size, height:size, borderRadius:"50%", border:`1px solid ${C.strong}`,
        color:C.sub, fontSize:size*0.72, fontWeight:700, lineHeight:1, cursor:"help",
        background:C.surface, fontFamily:"inherit", userSelect:"none" }}>?</span>
      {open && (
        <span role="tooltip" style={{ position:"absolute", ...(pos === "below" ? { top:"calc(100% + 6px)" } : { bottom:"calc(100% + 6px)" }), left, right,
          transform:tx, zIndex:1000, width:"max-content", maxWidth:260, textAlign:"left",
          background:"var(--text)", color:"var(--surface)", padding:"7px 10px", borderRadius:8,
          fontSize:11.5, fontWeight:500, lineHeight:1.4, letterSpacing:0, textTransform:"none",
          boxShadow:"0 8px 24px rgba(0,0,0,.22)", pointerEvents:"none", whiteSpace:"normal" }}>
          {text}
        </span>
      )}
    </span>
  );
}

// MARK: - Badge
export function Badge({ children, color = C.brandSoft, ink = C.brand, size = 11 }) {
  return (
    <span style={{ display:"inline-block", padding:"2px 8px", borderRadius:999,
      background:color, color:ink, fontSize:size, fontWeight:600, whiteSpace:"nowrap" }}>
      {children}
    </span>
  );
}

// MARK: - Btn
export function Btn({ children, onClick, disabled, color = C.brand, textColor = "#fff", outline = false, style: s = {}, ...rest }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:999,
        border: outline ? `1px solid ${C.strong}` : "none",
        background: outline ? C.s2 : color, color: outline ? C.ink : textColor,
        fontWeight:600, fontSize:13.5, cursor:"pointer", opacity: disabled ? 0.5 : 1, fontFamily:"inherit", ...s }}
      {...rest}>
      {children}
    </button>
  );
}

// MARK: - ModalField
export function ModalField({ label, value, onChange, type = "text", placeholder = "", readOnly = false, help = "", style: s = {} }) {
  return (
    <div style={s}>
      <label style={{ fontSize:11.5, fontWeight:600, color:"var(--text-2)", letterSpacing:.5, display:"flex", alignItems:"center", marginBottom:5 }}>
        {label}{help ? <Help text={help} align="left"/> : null}
      </label>
      <input type={type} value={value ?? ""} readOnly={readOnly}
        onChange={(e) => !readOnly && onChange && onChange(e.target.value)} placeholder={placeholder}
        style={{ width:"100%", padding:"9px 11px", border:`1px solid var(--border-strong)`, borderRadius:10,
          fontSize:13.5, fontFamily:"inherit", color:"var(--text)", outline:"none",
          background: readOnly ? "var(--bg)" : "var(--surface-2)", cursor: readOnly ? "default" : "text" }}/>
    </div>
  );
}
