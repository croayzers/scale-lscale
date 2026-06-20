const KEY_PROVS = (cid) => `lscale.dist_provs.${cid}`;
const KEY_FILAS = (cid) => `lscale.dist_filas.${cid}`;
const KEY_ALIAS = (cid) => `lscale.dist_alias.${cid}`;
const KEY_PLANTILLAS = (cid) => `lscale.dist_plantillas.${cid}`;

export function normDistribuidor(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function leerJSON(key) {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(window.localStorage.getItem(key)) || []; }
  catch { return []; }
}

export function cargarDistribuidores(companyId) {
  const cid = companyId || "local";
  return {
    proveedores: leerJSON(KEY_PROVS(cid)),
    filas: leerJSON(KEY_FILAS(cid)),
    aliases: leerJSON(KEY_ALIAS(cid)),
    plantillas: leerJSON(KEY_PLANTILLAS(cid)),
  };
}

export function materialesEstandar(materiales = []) {
  const seen = new Set();
  return materiales
    .map((m) => ({
      material_id: m.id ?? null,
      nombre: (m.nombre || "").trim(),
      nombre_norm: normDistribuidor(m.nombre),
    }))
    .filter((m) => {
      if (!m.nombre_norm || seen.has(m.nombre_norm)) return false;
      seen.add(m.nombre_norm);
      return true;
    });
}

export function sincronizarAliasConMateriales(aliases = [], materiales = []) {
  const base = materialesEstandar(materiales).map((m) => ({
    id: m.material_id ? `mat_${m.material_id}` : `mat_${m.nombre_norm}`,
    nombre: m.nombre,
  }));
  const existentes = new Set(base.map((a) => normDistribuidor(a.nombre)));
  const extras = (aliases || []).filter((a) => !existentes.has(normDistribuidor(a?.nombre)));
  return [...base, ...extras];
}

export function buscarFilaDistribuidorPorNombre(nombre, filas = []) {
  const clave = normDistribuidor(nombre);
  if (!clave) return null;
  return (filas || []).find((fila) => normDistribuidor(fila?.alias) === clave) || null;
}

export function datosProveedorDeLinea(linea, proveedorId, filas = []) {
  if (!proveedorId) return null;
  const nombreBase = linea?.nombre_original || linea?.nombre || "";
  const fila = buscarFilaDistribuidorPorNombre(nombreBase, filas);
  if (!fila) return null;
  const datos = fila.proveedores?.[proveedorId];
  if (!datos) return null;
  if (typeof datos === "string") return { nombre: datos };
  return datos;
}

export function nombreProveedorDeLinea(linea, proveedorId, filas = []) {
  const base = linea?.nombre_original || linea?.nombre || "";
  const datos = datosProveedorDeLinea(linea, proveedorId, filas);
  return datos?.nombre || base;
}

export function resumenProveedorPedido(pedido, proveedorId, filas = []) {
  return (pedido?.lineas || []).map((linea, idx) => {
    const base = linea?.nombre_original || linea?.nombre || "";
    const datos = datosProveedorDeLinea(linea, proveedorId, filas);
    return {
      key: `${linea?.material_id ?? base}_${idx}`,
      categoria: linea?.categoria || "(sin categoría)",
      cantidad: Number(linea?.cantidad) || 0,
      unidad: linea?.unidad || "ud",
      nombreBase: base,
      nombreProveedor: datos?.nombre || base,
      referencia: datos?.ref || null,
      coste: datos?.coste || null,
      descuento: datos?.descuento || null,
      tieneCorrelacion: Boolean(datos?.nombre),
    };
  });
}
