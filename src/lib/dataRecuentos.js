// MARK: - CRUD recuentos (abrirRecuento, cerrarRecuento, cancelarRecuento, actualizarLinea)
// MARK: - Historial y análisis (cargarSesiones, cargarLineasSesion, cargarHistorico)
// MARK: - Compras (registrarCompra, cargarCompras)
// MARK: - SEED demo
import { lsc, supabaseConfigurado } from "./supabase.js";
import { actualizarMaterial } from "./data.js";

// ── Mappers ────────────────────────────────────────────────────────────────

function mapSesion(r) {
  return {
    id:          r.id,
    company_id:  r.company_id,
    almacen_id:  r.almacen_id ?? null,
    nombre:      r.nombre || `Recuento ${new Date(r.created_at).toLocaleDateString("es-ES")}`,
    estado:      r.estado || "abierta",
    notas:       r.notas || null,
    creado_por:  r.creado_por || null,
    cerrado_por: r.cerrado_por || null,
    created_at:  r.created_at,
    closed_at:   r.closed_at || null,
  };
}

function mapLinea(r) {
  return {
    id:               r.id,
    sesion_id:        r.sesion_id,
    company_id:       r.company_id,
    material_id:      r.material_id,
    cantidad_sistema: Number(r.cantidad_sistema) || 0,
    cantidad_contada: r.cantidad_contada != null ? Number(r.cantidad_contada) : null,
    diferencia:       r.diferencia != null ? Number(r.diferencia) : null,
    notas:            r.notas || null,
    contado_en:       r.contado_en || null,
    contado_por:      r.contado_por || null,
  };
}

// ── Mappers compras ────────────────────────────────────────────────────────

function mapCompra(r, lineas = []) {
  return {
    id:         r.id,
    company_id: r.company_id,
    fecha:      r.fecha,
    notas:      r.notas || null,
    creado_por: r.creado_por || null,
    lineas,
  };
}

function mapCompraLinea(r) {
  return {
    id:          r.id,
    compra_id:   r.compra_id,
    material_id: r.material_id ?? null,
    nombre:      r.nombre,
    cantidad:    Number(r.cantidad) || 0,
    unidad:      r.unidad || "ud",
  };
}

// ── SEED demo ──────────────────────────────────────────────────────────────

// MARK: - SEED demo
function hoyMas(n) {
  const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + n);
  return d.toISOString();
}

export const COMPRAS_DEMO = [
  {
    id: 1, company_id: "demo",
    fecha: new Date(Date.now() - 45 * 86400000).toISOString(),
    notas: "Reposición tras recuento enero", creado_por: "demo@demo.com",
    lineas: [
      { id: 1, compra_id: 1, material_id: 1, nombre: "Silla Thonet",         cantidad: 10, unidad: "ud" },
      { id: 2, compra_id: 1, material_id: 4, nombre: "Copa de agua cristal",  cantidad: 50, unidad: "ud" },
    ],
  },
  {
    id: 2, company_id: "demo",
    fecha: new Date(Date.now() - 10 * 86400000).toISOString(),
    notas: null, creado_por: "demo@demo.com",
    lineas: [
      { id: 3, compra_id: 2, material_id: 1, nombre: "Silla Thonet",         cantidad: 5,  unidad: "ud" },
      { id: 4, compra_id: 2, material_id: 2, nombre: "Mesa redonda 180cm",   cantidad: 3,  unidad: "ud" },
      { id: 5, compra_id: 2, material_id: 4, nombre: "Copa de agua cristal",  cantidad: 30, unidad: "ud" },
    ],
  },
];

export const SESIONES_DEMO = [
  {
    id: 1, company_id: "demo", almacen_id: null,
    nombre: "Recuento enero 2026", estado: "cerrada",
    notas: null, creado_por: "demo@demo.com", cerrado_por: "demo@demo.com",
    created_at: hoyMas(-60), closed_at: hoyMas(-60),
  },
  {
    id: 2, company_id: "demo", almacen_id: null,
    nombre: "Recuento abril 2026", estado: "cerrada",
    notas: "Conteo tras temporada alta", creado_por: "demo@demo.com", cerrado_por: "demo@demo.com",
    created_at: hoyMas(-15), closed_at: hoyMas(-15),
  },
];

export const LINEAS_DEMO = [
  // Sesión 1 — enero
  { id: 1,  sesion_id: 1, company_id: "demo", material_id: 1, cantidad_sistema: 120, cantidad_contada: 118, diferencia: -2,  notas: null, contado_en: hoyMas(-60), contado_por: "demo@demo.com" },
  { id: 2,  sesion_id: 1, company_id: "demo", material_id: 2, cantidad_sistema: 30,  cantidad_contada: 30,  diferencia: 0,   notas: null, contado_en: hoyMas(-60), contado_por: "demo@demo.com" },
  { id: 3,  sesion_id: 1, company_id: "demo", material_id: 3, cantidad_sistema: 80,  cantidad_contada: 82,  diferencia: 2,   notas: "Aparecieron 2 extra", contado_en: hoyMas(-60), contado_por: "demo@demo.com" },
  { id: 4,  sesion_id: 1, company_id: "demo", material_id: 4, cantidad_sistema: 350, cantidad_contada: 344, diferencia: -6,  notas: null, contado_en: hoyMas(-60), contado_por: "demo@demo.com" },
  { id: 5,  sesion_id: 1, company_id: "demo", material_id: 5, cantidad_sistema: 8,   cantidad_contada: 8,   diferencia: 0,   notas: null, contado_en: hoyMas(-60), contado_por: "demo@demo.com" },
  // Sesión 2 — abril
  { id: 6,  sesion_id: 2, company_id: "demo", material_id: 1, cantidad_sistema: 118, cantidad_contada: 115, diferencia: -3,  notas: null, contado_en: hoyMas(-15), contado_por: "demo@demo.com" },
  { id: 7,  sesion_id: 2, company_id: "demo", material_id: 2, cantidad_sistema: 30,  cantidad_contada: 29,  diferencia: -1,  notas: null, contado_en: hoyMas(-15), contado_por: "demo@demo.com" },
  { id: 8,  sesion_id: 2, company_id: "demo", material_id: 3, cantidad_sistema: 82,  cantidad_contada: null, diferencia: null, notas: null, contado_en: null, contado_por: null },
  { id: 9,  sesion_id: 2, company_id: "demo", material_id: 4, cantidad_sistema: 344, cantidad_contada: 340, diferencia: -4,  notas: null, contado_en: hoyMas(-15), contado_por: "demo@demo.com" },
  { id: 10, sesion_id: 2, company_id: "demo", material_id: 5, cantidad_sistema: 8,   cantidad_contada: 7,   diferencia: -1,  notas: null, contado_en: hoyMas(-15), contado_por: "demo@demo.com" },
];

// ── Cargar sesiones ────────────────────────────────────────────────────────

// MARK: - Historial y análisis (cargarSesiones, cargarLineasSesion, cargarHistorico)
export async function cargarSesiones(companyId) {
  if (!supabaseConfigurado) return SESIONES_DEMO.map(mapSesion);
  const { data, error } = await lsc().from("recuento_sesiones")
    .select("*").eq("company_id", companyId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapSesion);
}

export async function cargarLineasSesion(sesionId) {
  if (!supabaseConfigurado) return LINEAS_DEMO.filter(l => l.sesion_id === sesionId).map(mapLinea);
  const { data, error } = await lsc().from("recuento_lineas")
    .select("*").eq("sesion_id", sesionId).order("id");
  if (error) throw error;
  return (data || []).map(mapLinea);
}

export async function cargarHistorico(companyId) {
  if (!supabaseConfigurado) {
    const sesiones = SESIONES_DEMO.filter(s => s.estado === "cerrada").map(mapSesion);
    const lineas   = LINEAS_DEMO.map(mapLinea);
    return { sesiones, lineas };
  }
  const { data: ses } = await lsc().from("recuento_sesiones")
    .select("*").eq("company_id", companyId).eq("estado", "cerrada").order("closed_at");
  const ids = (ses || []).map(s => s.id);
  if (!ids.length) return { sesiones: [], lineas: [] };
  const { data: lin } = await lsc().from("recuento_lineas")
    .select("*").in("sesion_id", ids).order("sesion_id").order("material_id");
  return { sesiones: (ses || []).map(mapSesion), lineas: (lin || []).map(mapLinea) };
}

// ── Abrir recuento ─────────────────────────────────────────────────────────

// MARK: - CRUD recuentos (abrirRecuento, cerrarRecuento, cancelarRecuento, actualizarLinea)
export async function abrirRecuento({ nombre, almacen_id, notas, categoriasFiltro }, companyId, materiales, userEmail) {
  // Filtrar materiales por almacén y categorías si se indicaron
  let mats = materiales.filter(m => m.estado !== "descatalogado");
  if (almacen_id != null) mats = mats.filter(m => m.almacen_id === almacen_id || m.almacen_id == null);
  if (Array.isArray(categoriasFiltro) && categoriasFiltro.length)
    mats = mats.filter(m => categoriasFiltro.includes(m.categoria));

  if (!supabaseConfigurado) {
    // Demo: estado local
    const nextId = Math.max(0, ...SESIONES_DEMO.map(s => s.id)) + 1;
    const sesion = mapSesion({
      id: nextId, company_id: companyId, almacen_id: almacen_id ?? null,
      nombre: nombre || `Recuento ${new Date().toLocaleDateString("es-ES")}`,
      estado: "abierta", notas: notas || null, creado_por: userEmail,
      cerrado_por: null, created_at: new Date().toISOString(), closed_at: null,
    });
    const nextLineaId = Math.max(0, ...LINEAS_DEMO.map(l => l.id)) + 1;
    const lineas = mats.map((m, i) => mapLinea({
      id: nextLineaId + i, sesion_id: nextId, company_id: companyId,
      material_id: m.id, cantidad_sistema: m.stock_actual, cantidad_contada: null,
      diferencia: null, notas: null, contado_en: null, contado_por: null,
    }));
    SESIONES_DEMO.push(sesion);
    lineas.forEach(l => LINEAS_DEMO.push(l));
    return { sesion, lineas };
  }

  const { data: sesRow, error: eSes } = await lsc().from("recuento_sesiones").insert({
    company_id: companyId,
    almacen_id: almacen_id ?? null,
    nombre: nombre || `Recuento ${new Date().toLocaleDateString("es-ES")}`,
    estado: "abierta",
    notas: notas || null,
    creado_por: userEmail || null,
  }).select().single();
  if (eSes) throw eSes;

  const lineasRows = mats.map(m => ({
    sesion_id: sesRow.id,
    company_id: companyId,
    material_id: m.id,
    cantidad_sistema: m.stock_actual,
    cantidad_contada: null,
  }));

  if (lineasRows.length) {
    const { data: linData, error: eLin } = await lsc().from("recuento_lineas").insert(lineasRows).select();
    if (eLin) throw eLin;
    return { sesion: mapSesion(sesRow), lineas: (linData || []).map(mapLinea) };
  }
  return { sesion: mapSesion(sesRow), lineas: [] };
}

// ── Actualizar una línea ───────────────────────────────────────────────────

export async function actualizarLinea(lineaId, cantidadContada, userEmail, modo) {
  if (modo !== "supabase") {
    const idx = LINEAS_DEMO.findIndex(l => l.id === lineaId);
    if (idx >= 0) {
      LINEAS_DEMO[idx] = {
        ...LINEAS_DEMO[idx],
        cantidad_contada: cantidadContada,
        diferencia: cantidadContada != null ? cantidadContada - LINEAS_DEMO[idx].cantidad_sistema : null,
        contado_en: cantidadContada != null ? new Date().toISOString() : null,
        contado_por: cantidadContada != null ? userEmail : null,
      };
    }
    return;
  }
  const patch = {
    cantidad_contada: cantidadContada,
    contado_en: cantidadContada != null ? new Date().toISOString() : null,
    contado_por: cantidadContada != null ? (userEmail || null) : null,
  };
  const { error } = await lsc().from("recuento_lineas").update(patch).eq("id", lineaId);
  if (error) throw error;
}

// ── Cerrar recuento ────────────────────────────────────────────────────────

export async function cerrarRecuento(sesionId, lineas, setMateriales, userEmail, modo) {
  const contadas = lineas.filter(l => l.cantidad_contada != null);

  // Actualizar stock_actual de los materiales contados
  if (modo === "supabase") {
    await Promise.all(contadas.map(l => actualizarMaterial(l.material_id, { stock_actual: l.cantidad_contada })));
    const { error } = await lsc().from("recuento_sesiones").update({
      estado: "cerrada", closed_at: new Date().toISOString(), cerrado_por: userEmail || null,
    }).eq("id", sesionId);
    if (error) throw error;
  } else {
    const idx = SESIONES_DEMO.findIndex(s => s.id === sesionId);
    if (idx >= 0) SESIONES_DEMO[idx] = { ...SESIONES_DEMO[idx], estado: "cerrada", closed_at: new Date().toISOString() };
  }

  // Actualizar estado local de materiales
  if (setMateriales && contadas.length) {
    const stockMap = {};
    contadas.forEach(l => { stockMap[l.material_id] = l.cantidad_contada; });
    setMateriales(prev => prev.map(m => m.id in stockMap ? { ...m, stock_actual: stockMap[m.id] } : m));
  }
}

// ── Cancelar recuento ──────────────────────────────────────────────────────

export async function cancelarRecuento(sesionId, modo) {
  if (modo !== "supabase") {
    const idx = SESIONES_DEMO.findIndex(s => s.id === sesionId);
    if (idx >= 0) SESIONES_DEMO[idx] = { ...SESIONES_DEMO[idx], estado: "cancelada" };
    return;
  }
  const { error } = await lsc().from("recuento_sesiones")
    .update({ estado: "cancelada" }).eq("id", sesionId);
  if (error) throw error;
}

// MARK: - Compras (registrarCompra, cargarCompras)

// Registra una compra de Cesta en Supabase.
// items = [{ nombre, cantidad, unidad, material_id }]
export async function registrarCompra(items, companyId, userEmail, modo) {
  if (modo !== "supabase") {
    const nextId = Math.max(0, ...COMPRAS_DEMO.map(c => c.id)) + 1;
    const lineas = items.map((it, i) => ({
      id: nextId * 100 + i, compra_id: nextId,
      material_id: it.material_id ?? null,
      nombre: it.nombre, cantidad: it.cantidad, unidad: it.unidad || "ud",
    }));
    COMPRAS_DEMO.push({ id: nextId, company_id: companyId,
      fecha: new Date().toISOString(), notas: null, creado_por: userEmail || null, lineas });
    return;
  }

  const { data: compra, error: eC } = await lsc().from("compras").insert({
    company_id: companyId, notas: null, creado_por: userEmail || null,
  }).select().single();
  if (eC) throw eC;

  const lineasRows = items.map(it => ({
    compra_id:   compra.id,
    company_id:  companyId,
    material_id: it.material_id ?? null,
    nombre:      it.nombre,
    cantidad:    Number(it.cantidad) || 0,
    unidad:      it.unidad || "ud",
  }));
  if (lineasRows.length) {
    const { error: eLin } = await lsc().from("compra_lineas").insert(lineasRows);
    if (eLin) throw eLin;
  }
}

// Carga todas las compras con sus líneas, opcionalmente desde una fecha
export async function cargarCompras(companyId, modo, desdeIso = null) {
  if (modo !== "supabase") {
    const lista = desdeIso
      ? COMPRAS_DEMO.filter(c => c.fecha >= desdeIso)
      : [...COMPRAS_DEMO];
    return lista.map(c => mapCompra(c, c.lineas.map(mapCompraLinea)));
  }

  let q = lsc().from("compras").select("*").eq("company_id", companyId).order("fecha", { ascending: false });
  if (desdeIso) q = q.gte("fecha", desdeIso);
  const { data: compras, error: eC } = await q;
  if (eC) throw eC;
  if (!compras?.length) return [];

  const ids = compras.map(c => c.id);
  const { data: lineas, error: eL } = await lsc().from("compra_lineas").select("*").in("compra_id", ids);
  if (eL) throw eL;

  const lineasByCompra = {};
  for (const l of lineas || []) {
    if (!lineasByCompra[l.compra_id]) lineasByCompra[l.compra_id] = [];
    lineasByCompra[l.compra_id].push(mapCompraLinea(l));
  }
  return compras.map(c => mapCompra(c, lineasByCompra[c.id] || []));
}
