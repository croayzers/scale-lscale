export function cantidadPropiaRetornable(linea = {}) {
  const cantidad = Number(linea.cantidad) || 0;

  if (linea._cantidad_propia != null) {
    return Math.max(0, Number(linea._cantidad_propia) || 0);
  }
  if (linea.cantidad_propia != null) {
    return Math.max(0, Number(linea.cantidad_propia) || 0);
  }

  const tieneProveedor =
    linea.proveedor_id != null ||
    linea._proveedor_id != null ||
    linea.tipo_origen === "subalquiler" ||
    linea._origen_logistico === "subalquiler";

  return tieneProveedor ? 0 : cantidad;
}

export function cantidadSubalquilada(linea = {}) {
  if (linea._cantidad_sub != null) return Math.max(0, Number(linea._cantidad_sub) || 0);
  if (linea.cantidad_sub != null) return Math.max(0, Number(linea.cantidad_sub) || 0);

  const tieneProveedor =
    linea.proveedor_id != null ||
    linea._proveedor_id != null ||
    linea.tipo_origen === "subalquiler" ||
    linea._origen_logistico === "subalquiler";

  return tieneProveedor ? (Number(linea.cantidad) || 0) : 0;
}

export function limitarRetornoAlmacen(linea, cantidadSolicitada) {
  const retornable = cantidadPropiaRetornable(linea);
  const solicitada = Math.max(0, Number(cantidadSolicitada) || 0);
  return Math.min(solicitada, retornable);
}
