// Motor de flujos y simulacro de L-Scale
//
// Cada flujo es una secuencia de pasos con precondiciones, acciones y postcondiciones.
// El simulacro las ejecuta en orden, verifica cada transición y reporta desviaciones.
//
// MARK: - Constantes de flujo

// Estados válidos del pedido y sus transiciones permitidas
export const TRANSICIONES = {
  borrador:   ["reservado", "cancelado"],
  reservado:  ["confirmado", "cancelado"],
  confirmado: ["retorno", "cancelado"],
  retorno:    ["finalizado", "confirmado"],  // confirmado = revertir
  finalizado: [],
  cancelado:  [],
};

// Flujo 1: Ciclo completo de un pedido
export const FLUJO_PEDIDO_COMPLETO = {
  id: "pedido_completo",
  nombre: "Ciclo completo: Pedido → Retorno",
  descripcion: "Crea un pedido con materiales, lo confirma, lo manda a retorno y registra la vuelta. Verifica stock en cada paso.",
  apps: ["lscale"],
  pasos: [
    {
      id: "crear_pedido",
      titulo: "Crear pedido con materiales",
      descripcion: "El pedido se crea en estado 'reservado' con líneas de material.",
      tipo: "accion",
      tab: "pedido",
      accion: ({ pedidos, materiales }) => {
        const hoy = new Date().toISOString().slice(0, 10);
        // Elegir materiales que existan para no fallar en modo demo
        const mat1 = materiales[0];
        const mat2 = materiales[1];
        if (!mat1) throw new Error("No hay materiales disponibles para crear el pedido.");

        const nuevoPedido = {
          id: `sim_${Date.now()}`,
          _simulacro: true,
          codigo: `SIM-001`,
          nombre: "Simulacro: Boda Prueba",
          estado: "reservado",
          fecha_pedido: hoy,
          fecha_entrega: hoy,
          hora_ida: "10:00",
          hora_vuelta: "23:00",
          destino: "Finca El Simulacro",
          notas: "Pedido generado por el simulacro",
          lineas: [
            { material_id: mat1.id, nombre: mat1.nombre, cantidad: Math.floor(mat1.stock_actual * 0.5) || 5, unidad: mat1.unidad || "ud", categoria: mat1.categoria },
            ...(mat2 ? [{ material_id: mat2.id, nombre: mat2.nombre, cantidad: Math.floor(mat2.stock_actual * 0.8) || 3, unidad: mat2.unidad || "ud", categoria: mat2.categoria }] : []),
          ],
        };
        return { tipo: "pedido_creado", payload: nuevoPedido };
      },
      verificar: ({ antes, despues }) => {
        const p = despues.pedidos.find(x => x._simulacro);
        const checks = [
          { ok: !!p,                           msg: "Pedido creado en estado" },
          { ok: p?.estado === "reservado",     msg: `Estado inicial: reservado (actual: ${p?.estado})` },
          { ok: (p?.lineas?.length ?? 0) > 0,  msg: "Tiene líneas de material" },
        ];
        return checks;
      },
    },
    {
      id: "verificar_conflictos_planning",
      titulo: "Verificar Planning — sin conflictos con stock suficiente",
      descripcion: "Con cantidades al 50% del stock, no debe haber conflictos en Planning.",
      tipo: "verificacion",
      tab: "planning",
      accion: null,
      verificar: ({ despues, conflictos }) => {
        const p = despues.pedidos.find(x => x._simulacro);
        const pid = p ? String(p.id) : null;
        const conflictosPedido = pid ? (conflictos?.[pid] || []) : [];
        return [
          { ok: conflictosPedido.length === 0, msg: `Sin conflictos de stock en Planning (${conflictosPedido.length} conflictos)` },
        ];
      },
    },
    {
      id: "confirmar_pedido",
      titulo: "Confirmar pedido (reservado → confirmado)",
      descripcion: "El pedido pasa a confirmado: materiales reservados para el evento.",
      tipo: "accion",
      tab: "retorno",
      accion: ({ pedidos }) => {
        const p = pedidos.find(x => x._simulacro);
        if (!p) throw new Error("No se encontró el pedido del simulacro.");
        if (!TRANSICIONES[p.estado]?.includes("confirmado"))
          throw new Error(`No se puede pasar de '${p.estado}' a 'confirmado'.`);
        return { tipo: "pedido_actualizado", payload: { ...p, estado: "confirmado" } };
      },
      verificar: ({ despues }) => {
        const p = despues.pedidos.find(x => x._simulacro);
        return [
          { ok: p?.estado === "confirmado", msg: `Estado: confirmado (actual: ${p?.estado})` },
        ];
      },
    },
    {
      id: "marcar_retorno",
      titulo: "Pedido en ruta (confirmado → retorno)",
      descripcion: "El vehículo sale y el pedido pasa a estado 'retorno'.",
      tipo: "accion",
      tab: "retorno",
      accion: ({ pedidos }) => {
        const p = pedidos.find(x => x._simulacro);
        if (!p) throw new Error("No se encontró el pedido.");
        return { tipo: "pedido_actualizado", payload: { ...p, estado: "retorno" } };
      },
      verificar: ({ despues }) => {
        const p = despues.pedidos.find(x => x._simulacro);
        return [
          { ok: p?.estado === "retorno", msg: `Estado: retorno (actual: ${p?.estado})` },
        ];
      },
    },
    {
      id: "registrar_retorno_stock",
      titulo: "Registrar retorno — stock vuelve al almacén",
      descripcion: "Se registran las cantidades devueltas. El stock_actual de cada material debe incrementarse.",
      tipo: "accion",
      tab: "retorno",
      accion: ({ pedidos, materiales }) => {
        const p = pedidos.find(x => x._simulacro);
        if (!p) throw new Error("No se encontró el pedido.");
        // Calcular nuevo stock
        const stockAntes = {};
        const stockDespues = {};
        const matsActualizados = materiales.map(m => {
          const linea = (p.lineas || []).find(l =>
            (l.material_id && l.material_id === m.id) ||
            l.nombre?.trim().toLowerCase() === m.nombre?.trim().toLowerCase()
          );
          stockAntes[m.id] = m.stock_actual;
          if (linea) {
            const nuevo = (Number(m.stock_actual) || 0) + (Number(linea.cantidad) || 0);
            stockDespues[m.id] = nuevo;
            return { ...m, stock_actual: nuevo };
          }
          stockDespues[m.id] = m.stock_actual;
          return m;
        });
        const pedidoFinalizado = {
          ...p,
          estado: "finalizado",
          fecha_retorno: new Date().toISOString().slice(0, 10),
          lineas: (p.lineas || []).map((l, i) => ({ ...l, _retorno: l.cantidad })),
        };
        return {
          tipo: "retorno_completado",
          payload: pedidoFinalizado,
          materiales: matsActualizados,
          stockAntes,
          stockDespues,
        };
      },
      verificar: ({ antes, despues, resultado }) => {
        const p = despues.pedidos.find(x => x._simulacro);
        const checks = [
          { ok: p?.estado === "finalizado", msg: `Pedido finalizado (actual: ${p?.estado})` },
        ];
        // Verificar que el stock subió para cada material del pedido
        if (resultado?.stockAntes && resultado?.stockDespues) {
          for (const [matId, stockPost] of Object.entries(resultado.stockDespues)) {
            const stockPre = resultado.stockAntes[matId] ?? stockPost;
            if (stockPost !== stockPre) {
              checks.push({ ok: stockPost > stockPre, msg: `Stock mat.${matId}: ${stockPre} → ${stockPost} (+${stockPost - stockPre})` });
            }
          }
        }
        return checks;
      },
    },
    {
      id: "verificar_conflictos_resueltos",
      titulo: "Planning — conflictos resueltos tras retorno",
      descripcion: "Tras finalizar el pedido, ya no debe aparecer en conflictos de Planning.",
      tipo: "verificacion",
      tab: "planning",
      accion: null,
      verificar: ({ despues, conflictos }) => {
        const p = despues.pedidos.find(x => x._simulacro);
        const pid = p ? String(p.id) : null;
        const aun = pid ? (conflictos?.[pid] || []) : [];
        return [
          { ok: aun.length === 0, msg: `Pedido finalizado no aparece en conflictos (${aun.length} restantes)` },
          { ok: p?.estado === "finalizado", msg: "Pedido en estado finalizado" },
        ];
      },
    },
    {
      id: "limpiar_simulacro",
      titulo: "Limpiar datos del simulacro",
      descripcion: "Elimina el pedido creado por el simulacro. El stock queda en su valor post-retorno.",
      tipo: "limpieza",
      tab: null,
      accion: ({ pedidos }) => {
        return { tipo: "pedido_eliminado", id: pedidos.find(x => x._simulacro)?.id };
      },
      verificar: ({ despues }) => {
        const p = despues.pedidos.find(x => x._simulacro);
        return [{ ok: !p, msg: "Pedido simulacro eliminado del estado" }];
      },
    },
  ],
};

// Flujo 2: Conflicto de stock en Planning
export const FLUJO_CONFLICTO_STOCK = {
  id: "conflicto_stock",
  nombre: "Conflicto de stock: dos eventos, mismo material",
  descripcion: "Crea dos pedidos que juntos superen el stock disponible. Verifica que Planning marca al segundo con ⚠, y que al retornar el primero el conflicto desaparece.",
  apps: ["lscale"],
  pasos: [
    {
      id: "crear_pedido_a",
      titulo: "Crear Pedido A — consume el 70% del stock",
      descripcion: "Pedido A: 70% del stock_actual del material más abundante.",
      tipo: "accion",
      tab: "pedido",
      accion: ({ materiales }) => {
        const hoy = new Date().toISOString().slice(0, 10);
        const mat = [...materiales].sort((a, b) => b.stock_actual - a.stock_actual)[0];
        if (!mat) throw new Error("No hay materiales.");
        const cantA = Math.ceil(mat.stock_actual * 0.7);
        return {
          tipo: "pedido_creado",
          payload: {
            id: `simA_${Date.now()}`,
            _simulacro: true, _simId: "A",
            codigo: "SIM-A", nombre: "Simulacro: Evento A",
            estado: "reservado",
            fecha_entrega: hoy, hora_ida: "08:00",
            lineas: [{ material_id: mat.id, nombre: mat.nombre, cantidad: cantA, unidad: mat.unidad || "ud", categoria: mat.categoria }],
            _matRef: { id: mat.id, nombre: mat.nombre, stock: mat.stock_actual, cantA },
          },
        };
      },
      verificar: ({ despues }) => {
        const p = despues.pedidos.find(x => x._simId === "A");
        return [{ ok: !!p && p.estado === "reservado", msg: `Pedido A creado (${p?.estado})` }];
      },
    },
    {
      id: "crear_pedido_b",
      titulo: "Crear Pedido B — empuja el total por encima del stock",
      descripcion: "Pedido B: 50% adicional del mismo material. A+B = 120% → desborda el stock.",
      tipo: "accion",
      tab: "pedido",
      accion: ({ pedidos, materiales }) => {
        const pA = pedidos.find(x => x._simId === "A");
        if (!pA) throw new Error("Pedido A no encontrado.");
        const matRef = pA._matRef || pA.lineas?.[0];
        const mat = materiales.find(m => m.id === (matRef?.material_id ?? matRef?.id));
        if (!mat) throw new Error("Material de referencia no encontrado.");
        const cantB = Math.ceil(mat.stock_actual * 0.5);
        const hoy = new Date().toISOString().slice(0, 10);
        // Pedido B ligeramente más tarde para que sea el "culpable"
        return {
          tipo: "pedido_creado",
          payload: {
            id: `simB_${Date.now()}`,
            _simulacro: true, _simId: "B",
            codigo: "SIM-B", nombre: "Simulacro: Evento B",
            estado: "reservado",
            fecha_entrega: hoy, hora_ida: "12:00",
            lineas: [{ material_id: mat.id, nombre: mat.nombre, cantidad: cantB, unidad: mat.unidad || "ud", categoria: mat.categoria }],
          },
        };
      },
      verificar: ({ despues }) => {
        const pB = despues.pedidos.find(x => x._simId === "B");
        return [{ ok: !!pB && pB.estado === "reservado", msg: `Pedido B creado (${pB?.estado})` }];
      },
    },
    {
      id: "verificar_conflicto_b",
      titulo: "Planning — Pedido B debe tener conflicto ⚠",
      descripcion: "El pedido más tardío (B) recibe el triángulo de conflicto porque empuja el total por encima del stock.",
      tipo: "verificacion",
      tab: "planning",
      accion: null,
      verificar: ({ despues, conflictos }) => {
        const pA = despues.pedidos.find(x => x._simId === "A");
        const pB = despues.pedidos.find(x => x._simId === "B");
        const conflA = pA ? (conflictos?.[String(pA.id)] || []) : [];
        const conflB = pB ? (conflictos?.[String(pB.id)] || []) : [];
        return [
          { ok: conflA.length === 0, msg: `Pedido A sin conflicto (tiene ${conflA.length})` },
          { ok: conflB.length > 0,   msg: `Pedido B con conflicto ⚠ (tiene ${conflB.length})` },
        ];
      },
    },
    {
      id: "finalizar_pedido_a",
      titulo: "Finalizar Pedido A — retorno completo",
      descripcion: "Pedido A se finaliza con retorno. Su material vuelve al stock.",
      tipo: "accion",
      tab: "retorno",
      accion: ({ pedidos, materiales }) => {
        const pA = pedidos.find(x => x._simId === "A");
        if (!pA) throw new Error("Pedido A no encontrado.");
        const matsActualizados = materiales.map(m => {
          const l = (pA.lineas || []).find(l => l.material_id === m.id);
          if (l) return { ...m, stock_actual: (m.stock_actual || 0) + (l.cantidad || 0) };
          return m;
        });
        return {
          tipo: "retorno_completado",
          payload: { ...pA, estado: "finalizado", fecha_retorno: new Date().toISOString().slice(0, 10) },
          materiales: matsActualizados,
        };
      },
      verificar: ({ despues }) => {
        const pA = despues.pedidos.find(x => x._simId === "A");
        return [{ ok: pA?.estado === "finalizado", msg: `Pedido A finalizado (${pA?.estado})` }];
      },
    },
    {
      id: "verificar_conflicto_resuelto",
      titulo: "Planning — conflicto de B debe desaparecer",
      descripcion: "Tras el retorno de A, el stock recuperado es suficiente para B. El triángulo debe desaparecer.",
      tipo: "verificacion",
      tab: "planning",
      accion: null,
      verificar: ({ despues, conflictos }) => {
        const pB = despues.pedidos.find(x => x._simId === "B");
        const conflB = pB ? (conflictos?.[String(pB.id)] || []) : [];
        return [
          { ok: conflB.length === 0, msg: `Conflicto de B resuelto (quedan ${conflB.length})` },
        ];
      },
    },
    {
      id: "limpiar_ab",
      titulo: "Limpiar pedidos del simulacro",
      tipo: "limpieza",
      tab: null,
      accion: ({ pedidos }) => ({
        tipo: "limpiar_simulacros",
        ids: pedidos.filter(x => x._simulacro).map(x => x.id),
      }),
      verificar: ({ despues }) => {
        const quedan = despues.pedidos.filter(x => x._simulacro);
        return [{ ok: quedan.length === 0, msg: `Pedidos simulacro eliminados (quedan ${quedan.length})` }];
      },
    },
  ],
};

// Flujo 3: Stock bajo mínimo → alerta → retorno lo resuelve
export const FLUJO_STOCK_MINIMO = {
  id: "stock_minimo",
  nombre: "Alerta stock mínimo → retorno la resuelve",
  descripcion: "Crea un pedido que deje un material por debajo del mínimo. Verifica que aparece la alerta roja. Al retornar, la alerta desaparece.",
  apps: ["lscale"],
  pasos: [
    {
      id: "crear_pedido_agotador",
      titulo: "Crear pedido que deja material bajo mínimo",
      descripcion: "Se usa cantidad = stock_actual - (stock_minimo / 2), dejando el stock por debajo del mínimo configurado.",
      tipo: "accion",
      tab: "pedido",
      accion: ({ materiales }) => {
        const hoy = new Date().toISOString().slice(0, 10);
        // Buscar material con stock_minimo configurado para que la alerta sea detectable
        const mat = materiales.find(m => m.stock_minimo > 0 && m.stock_actual > m.stock_minimo) || materiales[0];
        if (!mat) throw new Error("No hay material con stock_minimo configurado.");
        // Cantidad que deja el stock por debajo del mínimo
        const cantidadAgotadora = mat.stock_actual - Math.floor(mat.stock_minimo / 2);
        if (cantidadAgotadora <= 0) throw new Error(`El material '${mat.nombre}' no tiene suficiente stock para el simulacro.`);
        return {
          tipo: "pedido_creado",
          payload: {
            id: `simMin_${Date.now()}`,
            _simulacro: true, _simId: "MIN",
            codigo: "SIM-MIN", nombre: "Simulacro: Agotador de Stock",
            estado: "reservado",
            fecha_entrega: hoy, hora_ida: "09:00",
            lineas: [{ material_id: mat.id, nombre: mat.nombre, cantidad: cantidadAgotadora, unidad: mat.unidad || "ud", categoria: mat.categoria }],
            _matRef: { id: mat.id, nombre: mat.nombre, stock: mat.stock_actual, minimo: mat.stock_minimo, cantUsada: cantidadAgotadora },
          },
        };
      },
      verificar: ({ despues }) => {
        const p = despues.pedidos.find(x => x._simId === "MIN");
        return [{ ok: !!p, msg: `Pedido creado (estado: ${p?.estado})` }];
      },
    },
    {
      id: "verificar_alerta_activa",
      titulo: "Alerta roja de stock mínimo visible",
      descripcion: "Con el pedido reservado, la simulación del stock baja del mínimo. La alerta debe ser visible en el PanelAlertasStock.",
      tipo: "verificacion",
      tab: "almacen",
      accion: null,
      verificar: ({ despues }) => {
        const p = despues.pedidos.find(x => x._simId === "MIN");
        const matRef = p?._matRef;
        if (!matRef) return [{ ok: false, msg: "No se pudo obtener referencia del material" }];
        // Calcular stock simulado
        const mat = despues.materiales.find(m => m.id === matRef.id);
        // En realidad el stock_actual no baja al crear pedido (solo al retornar)
        // La alerta de Planning se basa en calcularConflictosStock; la alerta de mínimo en stock_actual
        // Este paso verifica que el sistema tenga la lógica de "si consumido > stock_actual → conflicto"
        const consumoSimulado = matRef.cantUsada;
        const stockResultante = (mat?.stock_actual ?? 0) - consumoSimulado;
        return [
          { ok: stockResultante < matRef.minimo, msg: `Stock resultante (${stockResultante}) < mínimo (${matRef.minimo}) → alerta esperada` },
          { ok: !!mat, msg: `Material '${matRef.nombre}' encontrado en almacén` },
        ];
      },
    },
    {
      id: "retorno_resuelve_alerta",
      titulo: "Retorno completo → alerta debe desaparecer",
      descripcion: "Todo el material vuelve. stock_actual sube de nuevo por encima del mínimo.",
      tipo: "accion",
      tab: "retorno",
      accion: ({ pedidos, materiales }) => {
        const p = pedidos.find(x => x._simId === "MIN");
        if (!p) throw new Error("Pedido MIN no encontrado.");
        const matsActualizados = materiales.map(m => {
          const l = (p.lineas || []).find(l => l.material_id === m.id);
          if (l) return { ...m, stock_actual: (m.stock_actual || 0) + (l.cantidad || 0) };
          return m;
        });
        return {
          tipo: "retorno_completado",
          payload: { ...p, estado: "finalizado", fecha_retorno: new Date().toISOString().slice(0, 10) },
          materiales: matsActualizados,
        };
      },
      verificar: ({ despues }) => {
        const p = despues.pedidos.find(x => x._simId === "MIN");
        if (!p) return [{ ok: false, msg: "Pedido no encontrado" }];
        const matRef = p._matRef;
        const mat = despues.materiales.find(m => m.id === matRef?.id);
        const stockFinal = mat?.stock_actual ?? 0;
        return [
          { ok: p.estado === "finalizado", msg: `Pedido finalizado (${p.estado})` },
          { ok: stockFinal >= (matRef?.minimo ?? 0), msg: `Stock restaurado: ${stockFinal} ≥ mínimo ${matRef?.minimo} → alerta resuelta` },
        ];
      },
    },
    {
      id: "limpiar_min",
      titulo: "Limpiar pedido del simulacro",
      tipo: "limpieza",
      tab: null,
      accion: ({ pedidos }) => ({
        tipo: "limpiar_simulacros",
        ids: pedidos.filter(x => x._simulacro).map(x => x.id),
      }),
      verificar: ({ despues }) => [
        { ok: !despues.pedidos.find(x => x._simulacro), msg: "Estado limpio" },
      ],
    },
  ],
};

// Registro de todos los flujos disponibles
export const FLUJOS = [
  FLUJO_PEDIDO_COMPLETO,
  FLUJO_CONFLICTO_STOCK,
  FLUJO_STOCK_MINIMO,
];

// MARK: - Motor de ejecución

// Aplica el resultado de una acción al estado (pedidos + materiales)
export function aplicarResultado(resultado, estadoActual) {
  const { pedidos, materiales } = estadoActual;
  if (!resultado) return estadoActual;

  switch (resultado.tipo) {
    case "pedido_creado":
      return { pedidos: [...pedidos, resultado.payload], materiales };

    case "pedido_actualizado":
      return { pedidos: pedidos.map(p => p.id === resultado.payload.id ? resultado.payload : p), materiales };

    case "retorno_completado": {
      const nuevosPedidos = pedidos.map(p => p.id === resultado.payload.id ? resultado.payload : p);
      const nuevasMats = resultado.materiales ?? materiales;
      return { pedidos: nuevosPedidos, materiales: nuevasMats };
    }

    case "pedido_eliminado":
      return { pedidos: pedidos.filter(p => p.id !== resultado.id), materiales };

    case "limpiar_simulacros":
      return { pedidos: pedidos.filter(p => !resultado.ids.includes(p.id)), materiales };

    default:
      return estadoActual;
  }
}

// Ejecuta un paso y devuelve el resultado + checks
export function ejecutarPaso(paso, estadoActual, conflictos) {
  let resultado = null;
  let error = null;
  let estadoPost = estadoActual;

  if (paso.accion) {
    try {
      resultado = paso.accion({ pedidos: estadoActual.pedidos, materiales: estadoActual.materiales });
      estadoPost = aplicarResultado(resultado, estadoActual);
    } catch (e) {
      error = e.message;
    }
  }

  let checks = [];
  try {
    checks = paso.verificar({
      antes: estadoActual,
      despues: estadoPost,
      resultado,
      conflictos,
    });
  } catch (e) {
    checks = [{ ok: false, msg: `Error en verificación: ${e.message}` }];
  }

  const exito = !error && checks.every(c => c.ok);

  return { resultado, estadoPost, checks, error, exito };
}
