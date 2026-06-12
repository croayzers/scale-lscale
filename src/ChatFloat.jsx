import React, { useState, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from "react";
import { X, Send, ArrowLeft, MessageCircle, Check, CheckCheck } from "lucide-react";
import { C } from "./lib/ui.jsx";
import { cargarTodosMensajes, enviarMensaje, marcarLeidos, suscribirMensajes } from "./lib/chat.js";

// Convierte email/user_id en iniciales para el avatar
function iniciales(nombre) {
  if (!nombre) return "?";
  const parts = nombre.trim().split(/[\s.@_]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return nombre[0].toUpperCase();
}

// Color de avatar determinista por user_id
const AVATAR_COLORS = ["#6366f1","#0891b2","#be185d","#65a30d","#f59e0b","#ef4444","#10b981","#8b5cf6"];
function avatarColor(userId) {
  if (!userId) return AVATAR_COLORS[0];
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) & 0x7fffffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function Avatar({ member, size = 32 }) {
  const bg = avatarColor(member?.user_id);
  const text = iniciales(member?.nombre || member?.email || "?");
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, color: "#fff",
      display: "grid", placeItems: "center",
      fontSize: size * 0.38, fontWeight: 700, flexShrink: 0,
    }}>{text}</div>
  );
}

// Vista: lista de miembros con último mensaje y no-leídos
function ListView({ otros, allMessages, myId, onSelect }) {
  function lastMsg(userId) {
    const msgs = allMessages.filter(m =>
      (m.from_user_id === myId && m.to_user_id === userId) ||
      (m.from_user_id === userId && m.to_user_id === myId)
    );
    return msgs[msgs.length - 1] ?? null;
  }
  function unreadFrom(userId) {
    return allMessages.filter(m => m.from_user_id === userId && m.to_user_id === myId && !m.is_read).length;
  }

  if (!otros.length) {
    return (
      <div style={{ flex: 1, display: "grid", placeItems: "center", color: C.sub, fontSize: 13 }}>
        Sin otros miembros en la empresa
      </div>
    );
  }

  // Ordenar por último mensaje (más reciente primero), luego por nombre
  const sorted = [...otros].sort((a, b) => {
    const la = lastMsg(a.user_id);
    const lb = lastMsg(b.user_id);
    if (la && lb) return new Date(lb.created_at) - new Date(la.created_at);
    if (la) return -1;
    if (lb) return 1;
    return (a.nombre || "").localeCompare(b.nombre || "");
  });

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      {sorted.map((m) => {
        const last  = lastMsg(m.user_id);
        const unread = unreadFrom(m.user_id);
        return (
          <button key={m.user_id} onClick={() => onSelect(m)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              width: "100%", padding: "11px 16px",
              border: "none", background: "none", cursor: "pointer",
              borderBottom: `1px solid ${C.line}`, textAlign: "left",
              transition: "background .1s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = C.s2}
            onMouseLeave={e => e.currentTarget.style.background = "none"}
          >
            <Avatar member={m} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13.5, fontWeight: unread ? 700 : 500, color: C.ink,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                  {m.nombre || m.email || "Usuario"}
                </span>
                {last && (
                  <span style={{ fontSize: 11, color: C.sub, flexShrink: 0, marginLeft: 6 }}>
                    {formatHora(last.created_at)}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: unread ? C.brand : C.sub, fontWeight: unread ? 600 : 400,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
                  {last
                    ? (last.from_user_id === myId ? "Tú: " : "") + last.message
                    : <span style={{ fontStyle: "italic" }}>Escribe un mensaje...</span>
                  }
                </span>
                {unread > 0 && (
                  <span style={{
                    minWidth: 18, height: 18, borderRadius: 999, background: C.brand,
                    color: "#fff", fontSize: 10.5, fontWeight: 700,
                    display: "grid", placeItems: "center", flexShrink: 0, padding: "0 5px",
                  }}>{unread}</span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// Renderiza texto con @menciones y /CODIGO [#categoria] como chips interactivos
function renderMsgText(text, miembros, onPedidoRef, esPropio) {
  // Captura /CODIGO opcionalmente seguido de espacio+#categoria
  const regex = /@[\w.]+|\/[A-Z0-9][A-Z0-9_-]*(?:\s+#[\w\sáéíóúüñÁÉÍÓÚÜÑ]+)?/g;
  const parts = [];
  let last = 0, m;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('@')) {
      const handle = tok.slice(1);
      const member = miembros.find(mb => mb.email?.split('@')[0] === handle);
      const color = member ? avatarColor(member.user_id) : '#6366f1';
      parts.push(
        <span key={m.index} style={{
          background: esPropio ? 'rgba(255,255,255,0.22)' : color + '1a',
          color: esPropio ? '#fff' : color,
          borderRadius: 4, padding: '1px 5px', fontWeight: 700, fontSize: 12,
        }}>{tok}</span>
      );
    } else {
      // Separar código de categoría: "/OA_00200 #Cristalería"
      const spaceIdx = tok.indexOf(' #');
      const codigo   = spaceIdx >= 0 ? tok.slice(1, spaceIdx) : tok.slice(1);
      const categoria = spaceIdx >= 0 ? tok.slice(spaceIdx + 2).trim() : null;
      const label    = categoria ? `/${codigo} #${categoria}` : `/${codigo}`;
      parts.push(
        <span key={m.index}
          onClick={e => { e.stopPropagation(); onPedidoRef?.(codigo, categoria); }}
          style={{
            background: esPropio ? 'rgba(255,255,255,0.22)' : 'rgba(99,102,241,0.13)',
            color: esPropio ? '#fff' : '#6366f1',
            borderRadius: 4, padding: '1px 6px', fontWeight: 700, fontSize: 12,
            cursor: 'pointer', textDecoration: 'underline dotted',
          }}>{label}</span>
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : text;
}

// Vista: conversación con un miembro
function ConvView({ partner, messages, myId, onBack, onSend, miembros, pedidos, onPedidoRef }) {
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState(null);
  const [ac, setAc]     = useState(null);  // { type, items, startIdx }
  const [acIdx, setAcIdx] = useState(0);
  const endRef = useRef(null);
  const taRef  = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const checkAc = (val, cursor) => {
    const before = val.slice(0, cursor);
    const mMention = before.match(/@([\w.]*)$/);
    if (mMention) {
      const q = mMention[1].toLowerCase();
      const items = (miembros || []).filter(m =>
        (m.email?.split('@')[0] || '').toLowerCase().includes(q) ||
        (m.nombre || '').toLowerCase().includes(q)
      ).slice(0, 5);
      if (items.length) { setAc({ type: 'mention', items, startIdx: cursor - mMention[0].length }); setAcIdx(0); return; }
    }
    const mPed = before.match(/\/([\w-]*)$/);
    if (mPed && pedidos?.length) {
      const q = mPed[1].toUpperCase();
      const items = pedidos.filter(p => {
        const cod = (p.codigo || p.referencia || '').toUpperCase();
        return q ? cod.startsWith(q) : !!cod;
      }).slice(0, 5);
      if (items.length) { setAc({ type: 'pedido', items, startIdx: cursor - mPed[0].length }); setAcIdx(0); return; }
    }
    const mCat = before.match(/#([\wáéíóúüñÁÉÍÓÚÜÑ ]*)$/);
    if (mCat) {
      const q = mCat[1].toLowerCase();
      const cats = [...new Set((materiales||[]).map(m => (m.categoria||'').trim()).filter(Boolean))].sort();
      const items = cats.filter(c => c.toLowerCase().includes(q)).slice(0, 8);
      if (items.length) { setAc({ type: 'categoria', items, startIdx: cursor - mCat[0].length }); setAcIdx(0); return; }
    }
    setAc(null);
  };

  const handleChange = (e) => { setTexto(e.target.value); checkAc(e.target.value, e.target.selectionStart); };

  const applyAc = (item) => {
    const cursor = taRef.current?.selectionStart ?? texto.length;
    const insert = ac.type === 'mention'
      ? `@${item.email?.split('@')[0] || item.nombre} `
      : ac.type === 'categoria'
        ? `#${item} `
        : `/${item.codigo || item.referencia} `;
    const newText = texto.slice(0, ac.startIdx) + insert + texto.slice(cursor);
    setTexto(newText);
    setAc(null);
    setTimeout(() => {
      const ta = taRef.current;
      if (ta) { ta.focus(); const p = ac.startIdx + insert.length; ta.setSelectionRange(p, p); }
    }, 0);
  };

  const onKey = (e) => {
    if (ac) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAcIdx(i => Math.min(i + 1, ac.items.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setAcIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applyAc(ac.items[acIdx]); return; }
      if (e.key === 'Escape') { setAc(null); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
  };

  const enviar = async (e) => {
    e?.preventDefault();
    const msg = texto.trim();
    if (!msg || sending) return;
    setTexto(""); setSendErr(null); setAc(null); setSending(true);
    try { await onSend(msg); }
    catch (err) { console.error("[chat] enviar error:", err); setTexto(msg); setSendErr(err?.message || "Error al enviar"); }
    finally { setSending(false); }
  };

  function groupDate(iso) {
    const d = new Date(iso), hoy = new Date();
    if (d.toDateString() === hoy.toDateString()) return "Hoy";
    const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
    if (d.toDateString() === ayer.toDateString()) return "Ayer";
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  }

  const groups = [];
  let lastDate = null;
  for (const msg of messages) {
    const dLabel = groupDate(msg.created_at);
    if (dLabel !== lastDate) { groups.push({ type: "date", label: dLabel }); lastDate = dLabel; }
    groups.push({ type: "msg", msg });
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Mini header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: C.sub, padding: 4, display: "flex", borderRadius: 6 }}>
          <ArrowLeft size={16} />
        </button>
        <Avatar member={partner} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {partner.nombre || partner.email || "Usuario"}
          </div>
          {partner.rol && <div style={{ fontSize: 11, color: C.sub, textTransform: "capitalize" }}>{partner.rol}</div>}
        </div>
      </div>

      {/* Mensajes */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: C.sub, fontSize: 12.5, marginTop: 32 }}>
            Empieza la conversación
          </div>
        )}
        {groups.map((g, i) => {
          if (g.type === "date") return (
            <div key={`d-${i}`} style={{ textAlign: "center", fontSize: 11, color: C.sub, margin: "8px 0 4px", letterSpacing: 0.3 }}>{g.label}</div>
          );
          const { msg } = g;
          const esPropio = msg.from_user_id === myId;
          return (
            <div key={msg.id || i} style={{ display: "flex", flexDirection: esPropio ? "row-reverse" : "row", alignItems: "flex-end", gap: 6 }}>
              {!esPropio && <Avatar member={partner} size={22} />}
              <div style={{ maxWidth: "72%", padding: "7px 11px", borderRadius: esPropio ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                background: esPropio ? C.brand : C.s2, color: esPropio ? "#fff" : C.ink,
                fontSize: 13, lineHeight: 1.45, wordBreak: "break-word" }}>
                <span>{renderMsgText(msg.message, miembros, onPedidoRef, esPropio)}</span>
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 3, marginTop: 2 }}>
                  <span style={{ fontSize: 10, opacity: 0.7 }}>{formatHora(msg.created_at)}</span>
                  {esPropio && (msg.is_read ? <CheckCheck size={11} style={{ opacity: 0.85 }} /> : <Check size={11} style={{ opacity: 0.6 }} />)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Autocomplete popup */}
      {ac && (
        <div style={{ borderTop: `1px solid ${C.line}`, background: C.surface, flexShrink: 0, maxHeight: 160, overflowY: "auto" }}>
          <div style={{ padding: "4px 10px 2px", fontSize: 10.5, fontWeight: 700, color: C.sub, letterSpacing: 0.5 }}>
            {ac.type === 'mention' ? '@ Mencionar usuario' : ac.type === 'categoria' ? '# Categoría' : '/ Referencia pedido'}
          </div>
          {ac.items.map((item, idx) => (
            <button key={idx} onMouseDown={e => { e.preventDefault(); applyAc(item); }}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 12px",
                border: "none", background: idx === acIdx ? C.brandSoft : "none", cursor: "pointer",
                fontFamily: "inherit", textAlign: "left" }}>
              {ac.type === 'mention' ? (
                <>
                  <Avatar member={item} size={22} />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: C.ink }}>{item.nombre || item.email}</div>
                    <div style={{ fontSize: 11, color: C.sub }}>@{item.email?.split('@')[0]}</div>
                  </div>
                </>
              ) : ac.type === 'categoria' ? (
                <>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(16,185,129,0.12)', color: '#059669',
                    display: 'grid', placeItems: 'center', fontSize: 13, flexShrink: 0 }}>#</div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink }}>{item}</div>
                </>
              ) : (
                <>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(99,102,241,0.12)', color: '#6366f1',
                    display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>OA</div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#6366f1' }}>{item.codigo || item.referencia}</div>
                    <div style={{ fontSize: 11, color: C.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                      {item.nombre || item.destino || '—'}
                    </div>
                  </div>
                </>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Error envío */}
      {sendErr && (
        <div style={{ padding: "4px 14px", fontSize: 11.5, color: "#ef4444", background: "#fef2f2", borderTop: "1px solid #fecaca" }}>
          {sendErr}
        </div>
      )}

      {/* Input */}
      <form onSubmit={enviar} style={{ display: "flex", gap: 8, padding: "10px 12px", borderTop: `1px solid ${C.line}`, flexShrink: 0 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <textarea ref={taRef} value={texto} onChange={handleChange} onKeyDown={onKey}
            placeholder="Escribe… @ para mencionar, / para pedido"
            rows={1}
            style={{ width: "100%", padding: "8px 11px", borderRadius: 10, border: `1px solid ${C.strong}`,
              resize: "none", outline: "none", fontFamily: "inherit", fontSize: 13,
              background: C.s2, color: C.ink, lineHeight: 1.4, maxHeight: 80, overflowY: "auto", boxSizing: "border-box" }}
          />
        </div>
        <button type="submit" disabled={!texto.trim() || sending}
          style={{ background: texto.trim() && !sending ? C.brand : C.strong, color: "#fff", border: "none",
            borderRadius: 10, padding: "0 13px", cursor: texto.trim() && !sending ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", transition: "background .15s", flexShrink: 0 }}>
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}

function formatHora(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

// ─── ChatFloat ─────────────────────────────────────────────────────────────
// Componente principal: panel flotante de chat + gestión de estado
// Exporta también la campana de notificaciones via ref
const ChatFloat = forwardRef(function ChatFloat({ empresa, miembros = [], currentUser, onUnreadChange, pedidos = [], materiales = [], onPedidoRef }, ref) {
  const [open, setOpen]           = useState(false);
  const [view, setView]           = useState("list");
  const [partner, setPartner]     = useState(null);
  const [allMessages, setAllMessages] = useState([]);

  const myId      = currentUser?.id;
  const companyId = empresa?.id;

  // Expone openConversation al padre via ref
  useImperativeHandle(ref, () => ({
    openConversation: (user) => {
      setPartner(user);
      setView("conv");
      setOpen(true);
    },
    openPanel: () => setOpen(true),
  }));

  // Carga inicial + suscripción Realtime
  useEffect(() => {
    if (!companyId || !myId) return;
    cargarTodosMensajes(companyId).then(setAllMessages);
    const unsub = suscribirMensajes(companyId, (msg) => {
      // Dedup: el mensaje propio ya fue añadido optimistamente por handleSend
      setAllMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
    });
    return unsub;
  }, [companyId, myId]);

  // Marcar como leídos al entrar en conversación
  useEffect(() => {
    if (partner && companyId && myId && open && view === "conv") {
      marcarLeidos(companyId, myId, partner.user_id);
      setAllMessages(prev => prev.map(m =>
        m.from_user_id === partner.user_id && m.to_user_id === myId
          ? { ...m, is_read: true } : m
      ));
    }
  }, [partner?.user_id, view, open]);

  // Mensajes de la conversación activa
  const convMessages = useMemo(() => {
    if (!partner) return [];
    return allMessages.filter(m =>
      (m.from_user_id === myId && m.to_user_id === partner.user_id) ||
      (m.from_user_id === partner.user_id && m.to_user_id === myId)
    );
  }, [allMessages, partner?.user_id, myId]);

  // Unread total (para campana)
  const totalUnread = useMemo(() =>
    allMessages.filter(m => m.to_user_id === myId && !m.is_read).length,
    [allMessages, myId]
  );

  // Notificar al padre del conteo de no-leídos
  useEffect(() => { onUnreadChange?.(totalUnread); }, [totalUnread]);

  const otros = useMemo(() => miembros.filter(m => m.user_id !== myId), [miembros, myId]);

  const handleSend = async (msg) => {
    // Envío principal al interlocutor
    const sent = await enviarMensaje(companyId, myId, partner.user_id, msg);
    setAllMessages(prev => [...prev, { ...sent, is_read: false }]);

    // Fanout a usuarios @mencionados (si no son el interlocutor ya)
    const handles = [...msg.matchAll(/@([\w.]+)/g)].map(m => m[1].toLowerCase());
    if (handles.length) {
      for (const mb of otros) {
        if (mb.user_id === partner.user_id) continue;
        const handle = mb.email?.split('@')[0]?.toLowerCase();
        if (handle && handles.includes(handle)) {
          await enviarMensaje(companyId, myId, mb.user_id, msg);
        }
      }
    }
  };

  const handleSelect = (member) => {
    setPartner(member);
    setView("conv");
  };

  const handleBack = () => {
    setView("list");
    setPartner(null);
  };

  if (!companyId || !myId) return null;

  return (
    <>
      {/* Panel flotante */}
      {open && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          width: 340, height: 500,
          background: "var(--surface)", border: `1px solid var(--border-strong)`,
          borderRadius: 16, boxShadow: "0 8px 48px rgba(0,0,0,0.22)",
          display: "flex", flexDirection: "column", overflow: "hidden",
          fontFamily: "var(--font-body)",
        }}>
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "13px 16px",
            borderBottom: `1px solid ${C.line}`, flexShrink: 0,
            background: C.brand,
          }}>
            <MessageCircle size={18} color="#fff" />
            <span style={{ flex: 1, fontWeight: 700, fontSize: 14, color: "#fff" }}>
              {view === "conv" && partner
                ? (partner.nombre || partner.email || "Conversación")
                : "Mensajes"}
            </span>
            <button onClick={() => setOpen(false)}
              style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8,
                cursor: "pointer", color: "#fff", padding: 5, display: "flex" }}>
              <X size={15} />
            </button>
          </div>

          {/* Contenido */}
          {view === "list" ? (
            <ListView otros={otros} allMessages={allMessages} myId={myId} onSelect={handleSelect} />
          ) : (
            <ConvView
              partner={partner}
              messages={convMessages}
              myId={myId}
              onBack={handleBack}
              onSend={handleSend}
              miembros={otros}
              pedidos={pedidos}
              onPedidoRef={onPedidoRef}
            />
          )}
        </div>
      )}

      {/* Botón flotante (visible cuando el panel está cerrado) */}
      {!open && (
        <button onClick={() => setOpen(true)}
          style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 9999,
            width: 50, height: 50, borderRadius: "50%",
            background: C.brand, color: "#fff", border: "none", cursor: "pointer",
            boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
            display: "grid", placeItems: "center",
            transition: "transform .15s, box-shadow .15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = "0 6px 28px rgba(99,102,241,0.55)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(99,102,241,0.4)"; }}
          title="Mensajes"
        >
          <MessageCircle size={21} />
          {totalUnread > 0 && (
            <span style={{
              position: "absolute", top: -2, right: -2,
              minWidth: 18, height: 18, borderRadius: 999,
              background: "#ef4444", color: "#fff",
              fontSize: 10.5, fontWeight: 800,
              display: "grid", placeItems: "center", padding: "0 4px",
              border: "2px solid var(--surface)",
            }}>{totalUnread > 99 ? "99+" : totalUnread}</span>
          )}
        </button>
      )}
    </>
  );
});

export default ChatFloat;
