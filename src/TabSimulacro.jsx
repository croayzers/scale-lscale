// MARK: - TabSimulacro
// Simulacro interactivo de flujos. Pausa en cada paso esperando instrucciones del usuario
// antes de ejecutar. El usuario puede escribir observaciones, modificar parámetros o saltar.
// Nunca toca Supabase — trabaja sobre copia en memoria del estado real.

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  FlaskConical, Play, RotateCcw, CheckCircle2, XCircle,
  ChevronRight, AlertTriangle, Clock, Layers, Info,
  ChevronDown, ChevronUp, Package, ShoppingBag, CalendarDays,
  SkipForward, StopCircle, Send, MessageSquare, Eye,
  ArrowRight, Lock, Unlock,
} from "lucide-react";
import { C, Btn } from "./lib/ui.jsx";
import { FLUJOS, ejecutarPaso, aplicarResultado } from "./lib/flujos.js";
import { calcularConflictosStock } from "./lib/stockConflictos.js";

// MARK: - Constantes

const TAB_ICONS = {
  pedido:   <ShoppingBag size={12}/>,
  planning: <CalendarDays size={12}/>,
  retorno:  <RotateCcw size={12}/>,
  almacen:  <Package size={12}/>,
};

const TIPO_LABEL = {
  accion:       { label: "Acción",        bg: "#eff6ff", ink: "#2563eb", border: "#bfdbfe" },
  verificacion: { label: "Verificación",  bg: "#f0fdf4", ink: "#15803d", border: "#bbf7d0" },
  limpieza:     { label: "Limpieza",      bg: "#fafafa", ink: "#64748b", border: "#e2e8f0" },
};

// MARK: - CheckRow

function CheckRow({ check }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "3px 0" }}>
      {check.ok
        ? <CheckCircle2 size={13} color="#16a34a" style={{ flexShrink: 0, marginTop: 1 }}/>
        : <XCircle      size={13} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }}/>
      }
      <span style={{ fontSize: 12, color: check.ok ? "#166534" : "#991b1b", lineHeight: 1.5 }}>
        {check.msg}
      </span>
    </div>
  );
}

// MARK: - PasoEjecutado (paso ya completado en el historial)

function PasoEjecutado({ paso, resultado, instruccion, indice }) {
  const [abierto, setAbierto] = useState(false);
  const estadoColor = resultado.exito ? "#16a34a" : resultado.error ? "#dc2626" : "#d97706";
  const estadoBg    = resultado.exito ? "#f0fdf4" : resultado.error ? "#fef2f2" : "#fffbeb";

  return (
    <div style={{
      border: `1.5px solid ${resultado.exito ? "#bbf7d0" : resultado.error ? "#fca5a5" : "#fde68a"}`,
      borderRadius: 10, overflow: "hidden",
    }}>
      <button onClick={() => setAbierto(v => !v)}
        style={{ width: "100%", background: estadoBg, border: "none", cursor: "pointer",
          padding: "9px 14px", display: "flex", alignItems: "center", gap: 10,
          fontFamily: "inherit", textAlign: "left" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.sub,
          background: C.s2, border: `1px solid ${C.line}`, borderRadius: 6,
          padding: "1px 6px", flexShrink: 0 }}>
          {indice + 1}
        </span>
        {resultado.exito
          ? <CheckCircle2 size={15} color="#16a34a" style={{ flexShrink: 0 }}/>
          : resultado.error
          ? <XCircle      size={15} color="#dc2626" style={{ flexShrink: 0 }}/>
          : <AlertTriangle size={15} color="#d97706" style={{ flexShrink: 0 }}/>
        }
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.ink }}>{paso.titulo}</span>
        {instruccion && (
          <span style={{ fontSize: 11, color: C.sub, display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <MessageSquare size={11}/> nota
          </span>
        )}
        {abierto ? <ChevronUp size={13} color={C.sub}/> : <ChevronDown size={13} color={C.sub}/>}
      </button>

      {abierto && (
        <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.line}`, background: C.surface }}>
          {instruccion && (
            <div style={{ background: "#f8fafc", border: `1px solid ${C.line}`, borderRadius: 7,
              padding: "7px 10px", marginBottom: 8, fontSize: 12, color: C.sub,
              display: "flex", gap: 7, alignItems: "flex-start" }}>
              <MessageSquare size={12} style={{ flexShrink: 0, marginTop: 1 }}/>
              <span>{instruccion}</span>
            </div>
          )}
          {resultado.error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 7,
              padding: "7px 10px", marginBottom: 8, fontSize: 12, color: "#991b1b" }}>
              Error: {resultado.error}
            </div>
          )}
          {(resultado.checks || []).map((ch, i) => <CheckRow key={i} check={ch}/>)}
        </div>
      )}
    </div>
  );
}

// MARK: - PasoActivo (panel principal de interacción)

function PasoActivo({ paso, indice, total, estadoSim, conflictos, instruccion, setInstruccion, onEjecutar, onSaltar, onAbortar, ejecutando }) {
  const tipoStyle = TIPO_LABEL[paso.tipo] || TIPO_LABEL.accion;
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, [paso.id]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onEjecutar();
  };

  // Estadísticas del estado actual del simulacro
  const pedidosActivos = (estadoSim?.pedidos || []).filter(p =>
    ["reservado", "confirmado", "retorno"].includes(p.estado)
  );

  return (
    <div style={{
      background: C.surface,
      border: `2px solid ${C.brand}`,
      borderRadius: 14,
      overflow: "hidden",
      boxShadow: `0 0 0 3px ${C.brand}18`,
    }}>
      {/* Barra de progreso superior */}
      <div style={{ height: 3, background: C.line }}>
        <div style={{ height: "100%", width: `${Math.round((indice / total) * 100)}%`,
          background: C.brand, transition: "width .3s ease" }}/>
      </div>

      <div style={{ padding: "16px 18px" }}>
        {/* Cabecera del paso */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div style={{ background: C.brandSoft, color: C.brand, borderRadius: 8,
            padding: "6px 9px", fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
            {indice + 1}/{total}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.ink, marginBottom: 4 }}>
              {paso.titulo}
            </div>
            <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.5 }}>
              {paso.descripcion}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {paso.tab && (
              <span style={{ display: "flex", alignItems: "center", gap: 4,
                background: "#f1f5f9", color: "#475569",
                borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 600 }}>
                {TAB_ICONS[paso.tab]} {paso.tab}
              </span>
            )}
            <span style={{ background: tipoStyle.bg, color: tipoStyle.ink,
              border: `1px solid ${tipoStyle.border}`,
              borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 600 }}>
              {tipoStyle.label}
            </span>
          </div>
        </div>

        {/* Estado del simulacro en este punto */}
        {estadoSim && (
          <div style={{ background: "#f8fafc", border: `1px solid ${C.line}`, borderRadius: 8,
            padding: "8px 12px", marginBottom: 12, display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ fontSize: 11.5 }}>
              <span style={{ color: C.sub }}>Pedidos activos: </span>
              <strong>{pedidosActivos.length}</strong>
            </div>
            <div style={{ fontSize: 11.5 }}>
              <span style={{ color: C.sub }}>Conflictos: </span>
              <strong style={{ color: Object.keys(conflictos).length > 0 ? "#d97706" : "#16a34a" }}>
                {Object.keys(conflictos).length}
              </strong>
            </div>
            {(estadoSim.pedidos || []).filter(p => p._simulacro).map(p => (
              <div key={p.id} style={{ fontSize: 11.5, display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#d97706", flexShrink: 0 }}/>
                <span style={{ color: "#92400e" }}>{p.codigo} ({p.estado})</span>
              </div>
            ))}
          </div>
        )}

        {/* Campo de instrucciones */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11.5, fontWeight: 700, color: C.sub, display: "block",
            marginBottom: 5, letterSpacing: .3 }}>
            INSTRUCCIONES / NOTAS PARA ESTE PASO
          </label>
          <textarea
            ref={inputRef}
            value={instruccion}
            onChange={e => setInstruccion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              paso.tipo === "accion"
                ? "Escribe instrucciones adicionales, observaciones, o deja vacío para ejecutar con los parámetros por defecto…"
                : paso.tipo === "verificacion"
                ? "¿Qué esperas ver en este punto? Puedes añadir condiciones adicionales a verificar…"
                : "Notas sobre la limpieza o escribe 'saltar' para no limpiar los datos del simulacro…"
            }
            style={{
              width: "100%", minHeight: 64, padding: "10px 12px",
              border: `1.5px solid ${C.strong}`, borderRadius: 8,
              fontSize: 13, fontFamily: "inherit", color: C.ink,
              background: C.s2, resize: "vertical", outline: "none",
              lineHeight: 1.5, boxSizing: "border-box",
              transition: "border-color .15s",
            }}
            onFocus={e => e.target.style.borderColor = C.brand}
            onBlur={e => e.target.style.borderColor = C.strong}
          />
          <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>
            Ctrl+Enter para continuar
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onAbortar} disabled={ejecutando}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
              border: `1px solid ${C.line}`, borderRadius: 8, background: "none",
              color: C.sub, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
            <StopCircle size={13}/> Abortar
          </button>
          <button onClick={onSaltar} disabled={ejecutando}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
              border: `1px solid ${C.line}`, borderRadius: 8, background: C.s2,
              color: C.ink, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
            <SkipForward size={13}/> Saltar
          </button>
          <button onClick={onEjecutar} disabled={ejecutando}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 18px",
              border: "none", borderRadius: 8, background: C.brand,
              color: "#fff", fontSize: 13, fontWeight: 700, cursor: ejecutando ? "not-allowed" : "pointer",
              fontFamily: "inherit", opacity: ejecutando ? 0.7 : 1 }}>
            {ejecutando
              ? <><div style={{ width: 13, height: 13, borderRadius: "50%",
                  border: "2px solid #fff", borderTopColor: "transparent" }} className="spin"/>
                  Ejecutando…</>
              : <><Send size={13}/> Ejecutar paso</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// MARK: - ResumenFinal

function ResumenFinal({ flujo, resultados, instrucciones, diffStocks, onReiniciar }) {
  const total  = flujo.pasos.length;
  const ok     = Object.values(resultados).filter(r => r.exito).length;
  const fail   = Object.values(resultados).filter(r => !r.exito).length;
  const pct    = total > 0 ? Math.round((ok / total) * 100) : 0;
  const exito  = ok === total;

  return (
    <div style={{ background: exito ? "#f0fdf4" : "#fef2f2",
      border: `1.5px solid ${exito ? "#86efac" : "#fca5a5"}`,
      borderRadius: 12, padding: "18px 20px", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        {exito
          ? <CheckCircle2 size={24} color="#16a34a"/>
          : <XCircle size={24} color="#dc2626"/>
        }
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: C.ink }}>
            {exito ? "Simulacro completado sin errores" : `Simulacro finalizado con ${fail} error${fail !== 1 ? "es" : ""}`}
          </div>
          <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2 }}>
            {ok}/{total} pasos correctos · {pct}% de éxito
          </div>
        </div>
        <Btn outline onClick={onReiniciar} style={{ fontSize: 12 }}>
          <RotateCcw size={13}/> Nuevo simulacro
        </Btn>
      </div>

      {/* Barra */}
      <div style={{ height: 6, background: "#e5e7eb", borderRadius: 999, overflow: "hidden", marginBottom: 14 }}>
        <div style={{ height: "100%", width: `${pct}%`,
          background: exito ? "#22c55e" : pct >= 60 ? "#f59e0b" : "#ef4444",
          borderRadius: 999 }}/>
      </div>

      {/* Variación de stock */}
      {diffStocks.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.line}`,
          borderRadius: 8, padding: "10px 14px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: .5,
            textTransform: "uppercase", marginBottom: 8 }}>
            Variación de stock (solo en memoria — Supabase no fue modificado)
          </div>
          {diffStocks.map(d => (
            <div key={d.nombre} style={{ display: "flex", alignItems: "center", gap: 8,
              padding: "4px 0", borderBottom: `1px solid ${C.line}`, fontSize: 12.5 }}>
              <span style={{ flex: 1, color: C.ink }}>{d.nombre}</span>
              <span style={{ color: C.sub }}>{d.antes}</span>
              <ArrowRight size={11} color={C.sub}/>
              <strong style={{ color: d.delta > 0 ? "#16a34a" : "#dc2626" }}>{d.despues}</strong>
              <span style={{ fontSize: 11, fontWeight: 700,
                color: d.delta > 0 ? "#16a34a" : "#dc2626",
                background: d.delta > 0 ? "#f0fdf4" : "#fef2f2",
                borderRadius: 999, padding: "1px 7px" }}>
                {d.delta > 0 ? `+${d.delta}` : d.delta}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// MARK: - TabSimulacro principal

export default function TabSimulacro({ pedidos = [], materiales = [], L }) {
  const [flujoSel,      setFlujoSel]      = useState(null);
  const [fase,          setFase]          = useState("seleccion"); // seleccion | corriendo | finalizado
  const [pasoActual,    setPasoActual]    = useState(0);
  const [instruccion,   setInstruccion]   = useState("");          // texto del textarea activo
  const [instrucciones, setInstrucciones] = useState({});          // { [pasoId]: string }
  const [resultados,    setResultados]    = useState({});          // { [pasoId]: { checks, error, exito } }
  const [saltados,      setSaltados]      = useState(new Set());
  const [ejecutando,    setEjecutando]    = useState(false);
  const [estadoSim,     setEstadoSim]     = useState(null);
  const estadoSimRef = useRef(null);
  const inicialRef   = useRef(null);

  const conflictos = useMemo(() =>
    estadoSim ? calcularConflictosStock(estadoSim.pedidos, estadoSim.materiales) : {},
  [estadoSim]);

  const diffStocks = useMemo(() => {
    if (!estadoSim || !inicialRef.current) return [];
    return estadoSim.materiales
      .map(m => {
        const orig = inicialRef.current.materiales.find(x => x.id === m.id);
        if (!orig || orig.stock_actual === m.stock_actual) return null;
        return { nombre: m.nombre, antes: orig.stock_actual, despues: m.stock_actual, delta: m.stock_actual - orig.stock_actual };
      })
      .filter(Boolean);
  }, [estadoSim]);

  const iniciar = useCallback((flujo) => {
    const copia = {
      pedidos:    JSON.parse(JSON.stringify(pedidos)),
      materiales: JSON.parse(JSON.stringify(materiales)),
    };
    inicialRef.current    = JSON.parse(JSON.stringify(copia));
    estadoSimRef.current  = copia;
    setEstadoSim(copia);
    setFlujoSel(flujo);
    setPasoActual(0);
    setInstruccion("");
    setInstrucciones({});
    setResultados({});
    setSaltados(new Set());
    setFase("corriendo");
  }, [pedidos, materiales]);

  const ejecutarPasoActual = useCallback(async () => {
    if (!flujoSel || ejecutando) return;
    setEjecutando(true);

    const paso   = flujoSel.pasos[pasoActual];
    const confl  = calcularConflictosStock(estadoSimRef.current.pedidos, estadoSimRef.current.materiales);
    const res    = ejecutarPaso(paso, estadoSimRef.current, confl);

    // Guardar instrucción de este paso
    setInstrucciones(prev => ({ ...prev, [paso.id]: instruccion }));

    // Aplicar al estado simulado
    estadoSimRef.current = res.estadoPost;
    setEstadoSim({ ...res.estadoPost });

    setResultados(prev => ({ ...prev, [paso.id]: { checks: res.checks, error: res.error, exito: res.exito } }));

    await new Promise(r => setTimeout(r, 200));
    setEjecutando(false);
    setInstruccion("");

    const siguiente = pasoActual + 1;
    if (siguiente >= flujoSel.pasos.length) {
      setFase("finalizado");
    } else {
      setPasoActual(siguiente);
    }
  }, [flujoSel, pasoActual, instruccion, ejecutando]);

  const saltarPaso = useCallback(() => {
    if (!flujoSel) return;
    const paso = flujoSel.pasos[pasoActual];
    setSaltados(prev => new Set([...prev, paso.id]));
    setInstrucciones(prev => ({ ...prev, [paso.id]: instruccion || "(saltado)" }));
    setResultados(prev => ({ ...prev, [paso.id]: { checks: [{ ok: true, msg: "Paso saltado por el usuario" }], error: null, exito: true } }));
    setInstruccion("");
    const siguiente = pasoActual + 1;
    if (siguiente >= flujoSel.pasos.length) setFase("finalizado");
    else setPasoActual(siguiente);
  }, [flujoSel, pasoActual, instruccion]);

  const abortar = useCallback(() => {
    setFase("seleccion");
    setFlujoSel(null);
    estadoSimRef.current = null;
    inicialRef.current   = null;
    setEstadoSim(null);
  }, []);

  const reiniciar = useCallback(() => {
    setFase("seleccion");
    setFlujoSel(null);
    estadoSimRef.current = null;
    inicialRef.current   = null;
    setEstadoSim(null);
  }, []);

  // MARK: - Pantalla de selección de flujo
  if (fase === "seleccion") {
    return (
      <div style={{ padding: "20px 24px", maxWidth: 860, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
          <div style={{ background: "#fef3c7", color: "#d97706", borderRadius: 13, padding: 11 }}>
            <FlaskConical size={24}/>
          </div>
          <div>
            <h2 style={{ fontSize: 20, margin: 0 }}>Simulacro de Flujos</h2>
            <p style={{ color: C.sub, fontSize: 13, margin: "3px 0 0" }}>
              Ejecuta un flujo de prueba paso a paso. En cada paso puedes dar instrucciones antes de que se ejecute.
            </p>
          </div>
        </div>

        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10,
          padding: "10px 14px", display: "flex", gap: 9, marginBottom: 22 }}>
          <Info size={15} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }}/>
          <div style={{ fontSize: 12.5, color: "#92400e", lineHeight: 1.5 }}>
            Trabaja sobre una <strong>copia en memoria</strong> del estado actual.
            No modifica pedidos ni stock en Supabase. En cada paso el simulacro te preguntará antes de actuar.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {FLUJOS.map(f => (
            <div key={f.id} style={{ background: C.surface, border: `1.5px solid ${C.line}`,
              borderRadius: 14, padding: "18px 20px", display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ background: "#fef3c7", color: "#d97706", borderRadius: 10,
                padding: 9, flexShrink: 0 }}>
                <Layers size={18}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{f.nombre}</div>
                <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5, marginBottom: 10 }}>{f.descripcion}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { label: `${f.pasos.length} pasos`, bg: "#f1f5f9", ink: "#475569" },
                    { label: `${f.pasos.filter(p=>p.tipo==="accion").length} acciones`, bg: "#eff6ff", ink: "#2563eb" },
                    { label: `${f.pasos.filter(p=>p.tipo==="verificacion").length} verificaciones`, bg: "#f0fdf4", ink: "#15803d" },
                  ].map(t => (
                    <span key={t.label} style={{ background: t.bg, color: t.ink,
                      borderRadius: 999, padding: "2px 10px", fontSize: 11.5, fontWeight: 600 }}>
                      {t.label}
                    </span>
                  ))}
                </div>
              </div>
              <Btn color="#d97706" onClick={() => iniciar(f)} style={{ flexShrink: 0, gap: 6 }}>
                <Play size={13}/> Iniciar
              </Btn>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // MARK: - Pantalla de ejecución
  const pasosEjecutados = flujoSel.pasos.slice(0, pasoActual);
  const pasoEnCurso     = fase === "corriendo" ? flujoSel.pasos[pasoActual] : null;

  return (
    <div style={{ padding: "20px 24px", maxWidth: 860, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ background: "#fef3c7", color: "#d97706", borderRadius: 11, padding: 9, flexShrink: 0 }}>
          <FlaskConical size={20}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: C.ink }}>{flujoSel.nombre}</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 1 }}>
            {fase === "corriendo"
              ? `Paso ${pasoActual + 1} de ${flujoSel.pasos.length} — esperando instrucciones`
              : `Completado — ${Object.values(resultados).filter(r=>r.exito).length}/${flujoSel.pasos.length} correctos`
            }
          </div>
        </div>
        {fase === "corriendo" && (
          <button onClick={abortar}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
              border: `1px solid ${C.line}`, borderRadius: 7, background: "none",
              color: C.sub, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            <StopCircle size={12}/> Abortar
          </button>
        )}
      </div>

      {/* Barra de progreso global */}
      <div style={{ height: 4, background: C.line, borderRadius: 999, overflow: "hidden", marginBottom: 18 }}>
        <div style={{
          height: "100%",
          width: `${Math.round((pasoActual / flujoSel.pasos.length) * 100)}%`,
          background: C.brand, borderRadius: 999, transition: "width .3s ease",
        }}/>
      </div>

      {/* Resumen final */}
      {fase === "finalizado" && (
        <ResumenFinal
          flujo={flujoSel}
          resultados={resultados}
          instrucciones={instrucciones}
          diffStocks={diffStocks}
          onReiniciar={reiniciar}
        />
      )}

      {/* Historial de pasos ejecutados */}
      {pasosEjecutados.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
          {pasosEjecutados.map((paso, i) => (
            <PasoEjecutado
              key={paso.id}
              paso={paso}
              resultado={resultados[paso.id] || { checks: [], exito: true }}
              instruccion={instrucciones[paso.id]}
              indice={i}
            />
          ))}
        </div>
      )}

      {/* Paso activo — panel de instrucciones */}
      {fase === "corriendo" && pasoEnCurso && (
        <PasoActivo
          paso={pasoEnCurso}
          indice={pasoActual}
          total={flujoSel.pasos.length}
          estadoSim={estadoSim}
          conflictos={conflictos}
          instruccion={instruccion}
          setInstruccion={setInstruccion}
          onEjecutar={ejecutarPasoActual}
          onSaltar={saltarPaso}
          onAbortar={abortar}
          ejecutando={ejecutando}
        />
      )}

      {/* Pasos pendientes (solo labels, colapsados) */}
      {fase === "corriendo" && flujoSel.pasos.length > pasoActual + 1 && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 5 }}>
          {flujoSel.pasos.slice(pasoActual + 1).map((paso, i) => {
            const tipoStyle = TIPO_LABEL[paso.tipo] || TIPO_LABEL.accion;
            return (
              <div key={paso.id} style={{ display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px", border: `1px dashed ${C.line}`, borderRadius: 8,
                background: C.s2, opacity: 0.55 }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%",
                  border: `2px solid ${C.line}`, background: C.surface, flexShrink: 0 }}/>
                <span style={{ fontSize: 11, color: C.sub, background: C.surface,
                  border: `1px solid ${C.line}`, borderRadius: 6, padding: "1px 6px", flexShrink: 0 }}>
                  {pasoActual + 2 + i}
                </span>
                <span style={{ flex: 1, fontSize: 13, color: C.dim }}>{paso.titulo}</span>
                <span style={{ background: tipoStyle.bg, color: tipoStyle.ink,
                  border: `1px solid ${tipoStyle.border}`,
                  borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 600 }}>
                  {tipoStyle.label}
                </span>
                <Lock size={11} color={C.dim}/>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
