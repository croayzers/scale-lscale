// MARK: - C (paleta)
// MARK: - Badge
// MARK: - Btn
// MARK: - ModalField
import React from "react";

export const C = {
  bg: "var(--bg)", surface: "var(--surface)", s2: "var(--surface-2)",
  line: "var(--border)", strong: "var(--border-strong)",
  ink: "var(--text)", sub: "var(--text-2)", dim: "var(--text-3)",
  brand: "var(--brand)", brandSoft: "var(--brand-soft)",
  ok: "var(--ok)", okSoft: "var(--ok-soft)",
  warn: "var(--warn)", warnSoft: "var(--warn-soft)",
  danger: "var(--danger)", dangerSoft: "var(--danger-soft)",
};

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
export function ModalField({ label, value, onChange, type = "text", placeholder = "", style: s = {} }) {
  return (
    <div style={s}>
      <label style={{ fontSize:11.5, fontWeight:600, color:"var(--text-2)", letterSpacing:.5, display:"block", marginBottom:5 }}>{label}</label>
      <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ width:"100%", padding:"9px 11px", border:`1px solid var(--border-strong)`, borderRadius:10,
          fontSize:13.5, fontFamily:"inherit", background:"var(--surface-2)", color:"var(--text)", outline:"none" }}/>
    </div>
  );
}
