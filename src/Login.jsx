import React, { useState } from "react";
import { ArrowRight, Loader, LogIn } from "lucide-react";
import { sb } from "./lib/supabase.js";
import { useL } from "./lib/i18n.js";

const C = { ink: "var(--text)", sub: "var(--text-2)", line: "var(--border)", card: "var(--surface)", s2: "var(--surface-2)", strong: "var(--border-strong)", brand: "var(--brand)" };
const PORTAL_URL = import.meta.env?.VITE_PORTAL_URL || "http://localhost:3000";

export default function Login() {
  const L = useL();
  const [email, setEmail] = useState("");
  const [pass, setPass]   = useState("");
  const [busy, setBusy]   = useState(false);
  const [msg, setMsg]     = useState(null);

  const entrar = async () => {
    if (!email || !pass) return;
    setBusy(true); setMsg(null);
    const { error } = await sb().auth.signInWithPassword({ email, password: pass });
    setBusy(false);
    if (error) setMsg({ t: "err", m: error.message });
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "grid", placeItems: "center", padding: 24, fontFamily: "var(--font-body)", color: C.ink }}>
      <div style={{ width: "100%", maxWidth: 380, background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, boxShadow: "var(--shadow-lg)", padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, justifyContent: "center", marginBottom: 16 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: C.brand, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 18 }}>L</div>
          <div><div style={{ fontWeight: 700, fontSize: 18, lineHeight: 1 }}>L-scale</div><div style={{ fontSize: 12, color: C.sub }}>Logistic Scale</div></div>
        </div>

        <p style={{ fontSize: 13, color: C.sub, textAlign: "center", marginBottom: 18 }}>
          {L("Tu cuenta es la misma para todas las apps Scale. Si aún no la tienes, créala en el portal Scale.",
             "Your account is the same across all Scale apps. If you don't have one yet, create it in the Scale portal.")}
        </p>

        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" style={inp} />
        <input value={pass}  onChange={(e) => setPass(e.target.value)}  onKeyDown={(e) => e.key === "Enter" && entrar()} type="password" placeholder={L("Contraseña","Password")} style={{ ...inp, marginTop: 10 }} />

        <button onClick={entrar} disabled={busy} style={{ ...btn, background: C.brand, color: "#fff", marginTop: 14 }}>
          {busy ? <Loader size={16} className="spin" /> : <LogIn size={16} />}
          {L("Entrar", "Sign in")}
        </button>

        <a href={`${PORTAL_URL}/login`} style={{ ...btn, marginTop: 10, background: C.s2, color: C.ink, border: `1px solid ${C.strong}`, textDecoration: "none" }}>
          <ArrowRight size={16} />
          {L("Crear cuenta en Scale", "Create account in Scale")}
        </a>

        {msg && <div style={{ marginTop: 14, padding: "9px 12px", borderRadius: 9, fontSize: 12.5, background: "var(--danger-soft)", color: "var(--danger)" }}>{msg.m}</div>}
      </div>
    </div>
  );
}

const inp = { width: "100%", padding: "11px 13px", border: "1px solid var(--border-strong)", borderRadius: 10, fontSize: 14.5, fontFamily: "inherit", outline: "none", background: "var(--surface)", color: "var(--text)" };
const btn = { width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: 999, border: "none", fontSize: 14.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
