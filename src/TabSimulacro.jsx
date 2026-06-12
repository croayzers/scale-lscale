// MARK: - TabSimulacro
// Motor de simulacro visual para L-Scale.
// Ejecuta flujos definidos en lib/flujos.js sobre una copia del estado real,
// sin tocar Supabase ni el estado de producción.

import React, { useState, useMemo, useCallback, useRef } from "react";
import {
  FlaskConical, Play, RotateCcw, CheckCircle2, XCircle,
  ChevronRight, AlertTriangle, Clock, Layers, Info,
  ChevronDown, ChevronUp, Package, ShoppingBag, CalendarDays,
} from "lucide-react";
import { C, Btn } from "./lib/ui.jsx";
import { FLUJOS, ejecutarPaso, aplicarResultado } from "./lib/flujos.js";
import { calcularConflictosStock } from "./lib/stockConflictos.js";

// MARK: - Constantes de UI

const TAB_ICONS = {
  pedido:   <ShoppingBag size={13}/>,
  planning: <CalendarDays size={13}/>,
  retorno:  <RotateCcw size={13}/>,
  almacen:  <Package size={13}/>,
};

const TIPO_COLOR = {
  accion:      { bg: "#eff6ff", ink: "#2563eb", border: "#bfdbfe" },
  verificacion:{ bg: "#f0fdf4", ink: "#15803d", border: "#bbf7d0" },
  limpieza:    { bg: "#fafafa", ink: "#64748b", border: "#e2e8f0" },
};

// MARK: - Subcomponentes

function CheckRow({ check }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "3px 0" }}>
      {check.ok
        ? <CheckCircle2 size={14} color="#16a34a" style={{ flexShrink: 0, marginTop: 1 }}/>
        : <XCircle     size={14} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }}/>
      }
      <span style={{ fontSize: 12.5, color: check.ok ? "#166534" : "#991b1b" }}>{check.msg}</span>
    </div>
  );
}

function PasoCard({ paso, estado, resultado, expanded, onToggle }) {
  const tipoStyle = TIPO_COLOR[paso.tipo] || TIPO_COLOR.accion;
  const isIdle     = estado === "idle";
  const isRunning  = estado === "running";
  const isDone     = estado === "ok" || estado === "fail" || estado === "warn";

  return (
    <div style={{
      border: `1.5px solid ${
        estado === "ok"      ? "#bbf7d0" :
        estado === "fail"    ? "#fca5a5" :
        estado === "warn"    ? "#fde68a" :
        isRunning            ? C.brand + "88" :
        C.line
      }`,
      borderRadius: 10,
      overflow: "hidden",
      opacity: isIdle ? 0.55 : 1,
      transition: "opacity .2s, border-color .2s",
    }}>
      {/* Header del paso */}
      <button onClick={isDone ? onToggle : undefined}
        style={{
          width: "100%", background: isRunning ? C.brandSoft :
            estado === "ok"   ? "#f0fdf4" :
            estado === "fail" ? "#fef2f2" :
            estado === "warn" ? "#fffbeb" : C.s2,
          border: "none", cursor: isDone ? "pointer" : "default",
          padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
          fontFamily: "inherit",
        }}>
        {/* Icono de estado */}
        <div style={{ flexShrink: 0, display: "flex" }}>
          {isRunning  && <div className="spin" style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${C.brand}`, borderTopColor: "transparent" }}/>}
          {estado === "ok"   && <CheckCircle2 size={16} color="#16a34a"/>}
          {estado === "fail" && <XCircle      size={16} color="#dc2626"/>}
          {estado === "warn" && <AlertTriangle size={16} color="#d97706"/>}
          {isIdle && <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${C.line}`, background: C.s2 }}/>}
        </div>

        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{paso.titulo}</div>
          {paso.descripcion && (
            <div style={{ fontSize: 11.5, color: C.sub, marginTop: 1, lineHeight: 1.4 }}>{paso.descripcion}</div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {paso.tab && (
            <span style={{ display: "flex", alignItems: "center", gap: 4,
              background: tipoStyle.bg, color: tipoStyle.ink, border: `1px solid ${tipoStyle.border}`,
              borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
              {TAB_ICONS[paso.tab]}
              {paso.tab}
            </span>
          )}
          {isDone && (expanded ? <ChevronUp size={14} color={C.sub}/> : <ChevronDown size={14} color={C.sub}/>)}
        </div>
      </button>

      {/* Detalle expandido */}
      {expanded && isDone && (
        <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.line}`, background: C.surface }}>
          {resultado?.error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 7,
              padding: "7px 10px", marginBottom: 8, fontSize: 12.5, color: "#991b1b" }}>
              {resultado.error}
            </div>
          )}
          {(resultado?.checks || []).map((ch, i) => <CheckRow key={i} check={ch}/>)}
          {resultado?.resultado && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ fontSize: 11, color: C.sub, cursor: "pointer" }}>Payload de la acción</summary>
              <pre style={{ fontSize: 10.5, color: C.sub, marginTop: 4, overflow: "auto",
                maxHeight: 120, background: C.s2, padding: 8, borderRadius: 6 }}>
                {JSON.stringify(resultado.resultado, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function ResumenSimulacro({ pasos, resultados }) {
  const total  = pasos.length;
  const ok     = Object.values(resultados).filter(r => r.exito).length;
  const fail   = Object.values(resultados).filter(r => !r.exito && r.error !== undefined).length;
  const pct    = total > 0 ? Math.round((ok / total) * 100) : 0;

  return (
    <div style={{
      background: ok === total ? "#f0fdf4" : fail > 0 ? "#fef2f2" : "#fffbeb",
      border: `1.5px solid ${ok === total ? "#86efac" : fail > 0 ? "#fca5a5" : "#fde68a"}`,
      borderRadius: 12, padding: "14px 18px", marginBottom: 18,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        {ok === total
          ? <CheckCircle2 size={20} color="#16a34a"/>
          : fail > 0 ? <XCircle size={20} color="#dc2626"/>
          : <AlertTriangle size={20} color="#d97706"/>
        }
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 14.5, color: C.ink }}>
            {ok === total ? "Simulacro completado correctamente" : fail > 0 ? "Simulacro con errores" : "Simulacro con advertencias"}
          </div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>
            {ok}/{total} pasos correctos · {pct}% de éxito
          </div>
        </div>
      </div>
      {/* Barra de progreso */}
      <div style={{ height: 6, background: C.line, borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`,
          background: pct === 100 ? "#22c55e" : pct >= 60 ? "#f59e0b" : "#ef4444",
          borderRadius: 999, transition: "width .4s ease" }}/>
      </div>
    </div>
  );
}

// MARK: - TabSimulacro

export default function TabSimulacro({ pedidos = [], materiales = [], setPedidos, setMateriales, L }) {
  const [flujoSel,    setFlujoSel]   = useState(null);
  const [corriendo,   setCorriendo]  = useState(false);
  const [pasoActual,  setPasoActual] = useState(-1);
  const [estadoPasos, setEstadoPasos]= useState({});   // { [pasoId]: "idle"|"running"|"ok"|"fail"|"warn" }
  const [resultados,  setResultados] = useState({});   // { [pasoId]: { checks, error, resultado, exito } }
  const [expandidos,  setExpandidos] = useState({});
  const [estadoSim,   setEstadoSim]  = useState(null); // copia del estado { pedidos, materiales } que maneja el simulacro
  const finalizado = pasoActual >= (flujoSel?.pasos?.length ?? 0);
  const inicialRef = useRef(null);

  const iniciarSimulacro = useCallback(async (flujo) => {
    setFlujoSel(flujo);
    setCorriendo(true);
    setPasoActual(0);
    setEstadoPasos({});
    setResultados({});
    setExpandidos({});

    // El simulacro trabaja sobre una copia profunda del estado real
    const estadoInicial = { pedidos: JSON.parse(JSON.stringify(pedidos)), materiales: JSON.parse(JSON.stringify(materiales)) };
    inicialRef.current = estadoInicial;
    let estadoCorriente = estadoInicial;

    for (let i = 0; i < flujo.pasos.length; i++) {
      const paso = flujo.pasos[i];
      setPasoActual(i);
      setEstadoPasos(prev => ({ ...prev, [paso.id]: "running" }));

      // Pequeña pausa para efecto visual
      await new Promise(r => setTimeout(r, 350));

      // Calcular conflictos sobre el estado corriente
      const conflictos = calcularConflictosStock(estadoCorriente.pedidos, estadoCorriente.materiales);

      const { resultado, estadoPost, checks, error, exito } = ejecutarPaso(paso, estadoCorriente, conflictos);

      // Actualizar estado del simulacro con el resultado
      estadoCorriente = estadoPost;
      setEstadoSim({ ...estadoCorriente });

      const estadoPaso = exito ? "ok" : error ? "fail" : checks.some(c => !c.ok) ? "warn" : "ok";

      setEstadoPasos(prev => ({ ...prev, [paso.id]: estadoPaso }));
      setResultados(prev => ({ ...prev, [paso.id]: { checks, error, resultado, exito } }));
      setExpandidos(prev => ({ ...prev, [paso.id]: !exito })); // auto-expand si hay problema

      await new Promise(r => setTimeout(r, 200));
    }

    setPasoActual(flujo.pasos.length); // marca finalizado
    setCorriendo(false);
  }, [pedidos, materiales]);

  const resetear = () => {
    setFlujoSel(null);
    setCorriendo(false);
    setPasoActual(-1);
    setEstadoPasos({});
    setResultados({});
    setExpandidos({});
    setEstadoSim(null);
    inicialRef.current = null;
  };

  // Estadísticas del estado simulado vs real
  const diffStocks = useMemo(() => {
    if (!estadoSim || !inicialRef.current) return [];
    const diffs = [];
    for (const m of estadoSim.materiales) {
      const orig = inicialRef.current.materiales.find(x => x.id === m.id);
      if (orig && orig.stock_actual !== m.stock_actual) {
        diffs.push({ nombre: m.nombre, antes: orig.stock_actual, despues: m.stock_actual, delta: m.stock_actual - orig.stock_actual });
      }
    }
    return diffs;
  }, [estadoSim]);

  // MARK: - Render selección de flujo
  if (!flujoSel) {
    return (
      <div style={{ padding: "20px 24px", maxWidth: 860, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
          <div style={{ background: "#fef3c7", color: "#d97706", borderRadius: 13, padding: 11 }}>
            <FlaskConical size={24}/>
          </div>
          <div>
            <h2 style={{ fontSize: 20, margin: 0 }}>Simulacro de Flujos</h2>
            <p style={{ color: C.sub, fontSize: 13, margin: "3px 0 0" }}>
              Ejecuta flujos de prueba sobre los datos actuales sin modificar Supabase.
            </p>
          </div>
        </div>

        {/* Aviso */}
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10,
          padding: "10px 14px", display: "flex", gap: 9, marginBottom: 22 }}>
          <Info size={15} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }}/>
          <div style={{ fontSize: 12.5, color: "#92400e", lineHeight: 1.5 }}>
            El simulacro trabaja sobre una <strong>copia en memoria</strong> del estado actual.
            No crea pedidos ni modifica el stock en Supabase. Los datos reales no se alteran.
          </div>
        </div>

        {/* Cards de flujos */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {FLUJOS.map(f => {
            const nPasos = f.pasos.length;
            const nAcciones = f.pasos.filter(p => p.tipo === "accion").length;
            const nVerif    = f.pasos.filter(p => p.tipo === "verificacion").length;
            return (
              <div key={f.id} style={{
                background: C.surface, border: `1.5px solid ${C.line}`, borderRadius: 14,
                padding: "18px 20px", display: "flex", gap: 16, alignItems: "flex-start",
              }}>
                <div style={{ background: "#fef3c7", color: "#d97706", borderRadius: 10, padding: 9, flexShrink: 0 }}>
                  <Layers size={18}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{f.nombre}</div>
                  <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5, marginBottom: 10 }}>{f.descripcion}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[
                      { label: `${nPasos} pasos`,     color: "#f1f5f9", ink: "#475569" },
                      { label: `${nAcciones} acciones`, color: "#eff6ff", ink: "#2563eb" },
                      { label: `${nVerif} verificaciones`, color: "#f0fdf4", ink: "#15803d" },
                    ].map(tag => (
                      <span key={tag.label} style={{ background: tag.color, color: tag.ink,
                        borderRadius: 999, padding: "2px 10px", fontSize: 11.5, fontWeight: 600 }}>
                        {tag.label}
                      </span>
                    ))}
                  </div>
                </div>
                <Btn color="#d97706" onClick={() => iniciarSimulacro(f)}
                  style={{ flexShrink: 0, gap: 6 }}>
                  <Play size={13}/> Ejecutar
                </Btn>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // MARK: - Render ejecución del flujo
  const pasosTotal = flujoSel.pasos.length;
  const pasosOk    = Object.values(estadoPasos).filter(e => e === "ok").length;
  const pasosFail  = Object.values(estadoPasos).filter(e => e === "fail" || e === "warn").length;

  return (
    <div style={{ padding: "20px 24px", maxWidth: 860, margin: "0 auto" }}>
      {/* Header flujo activo */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{ background: "#fef3c7", color: "#d97706", borderRadius: 13, padding: 10, flexShrink: 0 }}>
          <FlaskConical size={22}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{flujoSel.nombre}</div>
          {corriendo
            ? <div style={{ fontSize: 12.5, color: C.brand, display: "flex", alignItems: "center", gap: 5 }}>
                <div className="spin" style={{ width: 11, height: 11, borderRadius: "50%", border: `2px solid ${C.brand}`, borderTopColor: "transparent" }}/>
                Ejecutando paso {pasoActual + 1} de {pasosTotal}…
              </div>
            : finalizado
            ? <div style={{ fontSize: 12.5, color: pasosFail === 0 ? "#16a34a" : "#dc2626" }}>
                Finalizado — {pasosOk}/{pasosTotal} pasos correctos
              </div>
            : null
          }
        </div>
        <Btn outline onClick={resetear} style={{ flexShrink: 0, fontSize: 12 }}>
          <RotateCcw size={13}/> Nuevo simulacro
        </Btn>
      </div>

      {/* Barra de progreso global */}
      <div style={{ height: 5, background: C.line, borderRadius: 999, overflow: "hidden", marginBottom: 18 }}>
        <div style={{
          height: "100%",
          width: `${Math.round((Object.keys(estadoPasos).length / pasosTotal) * 100)}%`,
          background: pasosFail > 0 ? "#f59e0b" : C.brand,
          borderRadius: 999, transition: "width .3s ease",
        }}/>
      </div>

      {/* Resumen (solo cuando finalizado) */}
      {finalizado && <ResumenSimulacro pasos={flujoSel.pasos} resultados={resultados}/>}

      {/* Cambios de stock durante el simulacro */}
      {finalizado && diffStocks.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10,
          padding: "12px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, letterSpacing: .5,
            textTransform: "uppercase", marginBottom: 8 }}>
            Variación de stock durante el simulacro
          </div>
          {diffStocks.map(d => (
            <div key={d.nombre} style={{ display: "flex", alignItems: "center", gap: 10,
              padding: "4px 0", borderBottom: `1px solid ${C.line}` }}>
              <span style={{ flex: 1, fontSize: 13, color: C.ink }}>{d.nombre}</span>
              <span style={{ fontSize: 12, color: C.sub }}>{d.antes}</span>
              <ChevronRight size={13} color={C.sub}/>
              <span style={{ fontSize: 12, fontWeight: 700, color: d.delta > 0 ? "#16a34a" : "#dc2626" }}>
                {d.despues}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: d.delta > 0 ? "#16a34a" : "#dc2626",
                background: d.delta > 0 ? "#f0fdf4" : "#fef2f2",
                borderRadius: 999, padding: "1px 7px",
              }}>
                {d.delta > 0 ? `+${d.delta}` : d.delta}
              </span>
            </div>
          ))}
          <div style={{ fontSize: 11.5, color: C.sub, marginTop: 8 }}>
            Nota: estos cambios son solo en memoria del simulacro. El stock real en Supabase no fue modificado.
          </div>
        </div>
      )}

      {/* Lista de pasos */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {flujoSel.pasos.map((paso, i) => (
          <PasoCard
            key={paso.id}
            paso={paso}
            estado={estadoPasos[paso.id] || (i < pasoActual ? "ok" : "idle")}
            resultado={resultados[paso.id]}
            expanded={!!expandidos[paso.id]}
            onToggle={() => setExpandidos(prev => ({ ...prev, [paso.id]: !prev[paso.id] }))}
          />
        ))}
      </div>

      {/* Footer con estadísticas de pedidos en el estado simulado */}
      {estadoSim && (
        <div style={{ marginTop: 18, background: C.s2, border: `1px solid ${C.line}`,
          borderRadius: 10, padding: "10px 14px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: .5,
            textTransform: "uppercase", marginBottom: 6 }}>
            Estado del simulacro en memoria
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12.5 }}>
              <span style={{ color: C.sub }}>Pedidos activos: </span>
              <strong>{estadoSim.pedidos.filter(p => ["reservado","confirmado","retorno"].includes(p.estado)).length}</strong>
            </div>
            <div style={{ fontSize: 12.5 }}>
              <span style={{ color: C.sub }}>Pedidos simulacro: </span>
              <strong style={{ color: "#d97706" }}>{estadoSim.pedidos.filter(p => p._simulacro).length}</strong>
            </div>
            <div style={{ fontSize: 12.5 }}>
              <span style={{ color: C.sub }}>Materiales: </span>
              <strong>{estadoSim.materiales.length}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
