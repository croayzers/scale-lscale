// MARK: - Capa de IA: tool-specs + dispatcher para el asistente de L-Scale
/* ───────────────────────────────────────────────────────────────────────────
   Define las "tools" que el asistente IA puede invocar y el dispatcher que las
   ejecuta sobre datos ya cargados en memoria (funciones puras de dataCompras.js).

   Se conecta vía el prop `ia` de ChatBase (@scale/shared/chat):
     ia.tools  = toolSpecs()
     ia.onTool = crearDispatcher(ctx)   // (name, input) => { resumen, datos }

   onTool es SÍNCRONO: por eso opera sobre arrays ya cargados (ctx.compras, …),
   sin I/O. App.jsx mantiene esos datos frescos.
   ─────────────────────────────────────────────────────────────────────────── */
import {
  consultarCompras, totalizar, sumatorioPorMaterial,
} from "./dataCompras.js";

// Catálogo de tools en formato neutro {name, description, params}.
// params sigue el formato del paquete: { campo: { type, description, required? } }.
export function toolSpecs() {
  return [
    {
      name: "consultar_compras",
      description: "Busca líneas de compra del histórico, filtrando por material (texto parcial), almacén, proveedor y/o rango de fechas. Útil para preguntas como 'todas las Copa de Vino de los últimos 120 días' o 'qué compramos al proveedor X en mayo'. Devuelve las líneas y un total (cantidad y coste).",
      params: {
        material: { type: "string", description: "Texto a buscar en el nombre del material (parcial, sin distinguir mayúsculas). Ej: 'copa de vino'." },
        dias: { type: "number", description: "Atajo: limita a los últimos N días (desde hoy)." },
        desde: { type: "string", description: "Fecha inicio inclusive (YYYY-MM-DD). Alternativa a 'dias'." },
        hasta: { type: "string", description: "Fecha fin inclusive (YYYY-MM-DD)." },
        almacen: { type: "string", description: "Nombre del almacén a filtrar (opcional)." },
        proveedor: { type: "string", description: "Nombre del proveedor a filtrar (opcional)." },
      },
    },
    {
      name: "sumatorio_compras",
      description: "Agrega las compras por material y por mes en un rango. Devuelve, por cada material, el total comprado (cantidad y coste) y el desglose mensual. Útil para 'cuánto hemos comprado de cada cosa este trimestre' o informes de aprovisionamiento.",
      params: {
        material: { type: "string", description: "Filtra a un material concreto (texto parcial, opcional)." },
        dias: { type: "number", description: "Últimos N días (opcional)." },
        desde: { type: "string", description: "Fecha inicio (YYYY-MM-DD, opcional)." },
        hasta: { type: "string", description: "Fecha fin (YYYY-MM-DD, opcional)." },
        almacen: { type: "string", description: "Nombre del almacén (opcional)." },
        proveedor: { type: "string", description: "Nombre del proveedor (opcional)." },
      },
    },
  ];
}

// Resuelve nombre de almacén/proveedor → id usando los catálogos del contexto.
const buscarIdPorNombre = (lista, nombre) => {
  if (!nombre) return undefined;
  const q = nombre.trim().toLowerCase();
  const hit = (lista || []).find((x) => (x.nombre || "").trim().toLowerCase().includes(q));
  return hit ? hit.id : undefined;
};

// Traduce el input del LLM (nombres) al filtro de dataCompras (ids).
function inputAFiltro(input = {}, ctx = {}) {
  return {
    material: input.material || undefined,
    dias: input.dias != null ? Number(input.dias) : undefined,
    desde: input.desde || undefined,
    hasta: input.hasta || undefined,
    almacen_id: buscarIdPorNombre(ctx.almacenes, input.almacen),
    proveedor_id: buscarIdPorNombre(ctx.proveedores, input.proveedor),
  };
}

const nombreAlmacen = (ctx, id) => (ctx.almacenes || []).find((a) => a.id === id)?.nombre || (id != null ? `Almacén ${id}` : "—");
const nombreProveedor = (ctx, id) => (ctx.proveedores || []).find((p) => p.id === id)?.nombre || (id != null ? `Proveedor ${id}` : null);

// Crea el dispatcher (síncrono) que ejecuta las tools sobre ctx.compras.
// ctx = { compras, almacenes, proveedores }
export function crearDispatcher(ctx = {}) {
  return function onTool(name, input = {}) {
    const compras = ctx.compras || [];
    try {
      if (name === "consultar_compras") {
        const filtro = inputAFiltro(input, ctx);
        const lineas = consultarCompras(compras, filtro);
        const t = totalizar(lineas);
        // Datos compactos para el modelo (máx. 50 líneas, no saturar el contexto).
        const datos = lineas.slice(0, 50).map((l) => ({
          fecha: l.fecha?.slice(0, 10), material: l.nombre, cantidad: l.cantidad, unidad: l.unidad,
          almacen: nombreAlmacen(ctx, l.almacen_id),
          proveedor: nombreProveedor(ctx, l.proveedor_id),
          coste_unitario: l.precio_coste ?? null,
        }));
        const resumen = `${t.n_lineas} líneas · ${t.cantidad} uds${t.coste > 0 ? ` · ${t.coste.toFixed(2)} €` : ""}`;
        return { resumen, datos: { total: t, lineas: datos, truncado: lineas.length > 50 } };
      }

      if (name === "sumatorio_compras") {
        const filtro = inputAFiltro(input, ctx);
        const { materiales, periodos } = sumatorioPorMaterial(compras, filtro, "mes");
        const datos = materiales.map((m) => ({
          material: m.nombre, unidad: m.unidad,
          total_cantidad: m.total_cantidad,
          total_coste: Number(m.total_coste.toFixed(2)),
          por_mes: m.periodos,
        }));
        return {
          resumen: `${materiales.length} materiales en ${periodos.length} meses`,
          datos: { periodos, materiales: datos },
        };
      }

      return { error: `Herramienta desconocida: ${name}` };
    } catch (e) {
      return { error: e?.message || "Error ejecutando la herramienta" };
    }
  };
}
