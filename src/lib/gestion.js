// MARK: - Estadios de gestión (Operativo / Básica / Avanzada)
/* ───────────────────────────────────────────────────────────────────────────
   Dos estadios de gestión configurables, granulares por categoría.
   - Estadio 1 (operativo): stock, pedidos, line-splitting, retornos con estado.
     Es el estándar para TODAS las empresas — nunca se desactiva.
   - Estadio 2 (financiero): se gradúa en 'basica' (importes, cargos/deudas,
     pestaña Finanzas) y 'avanzada' (lotes, FIFO/PMP, amortización, nº serie).

   El nivel se guarda en empresa_config.datos_json.gestion:
     { nivel: 'operativo'|'basica'|'avanzada',
       categorias: { '<categoria>': 'operativo'|'basica'|'avanzada' } }

   Regla clave: la categoría puede SUBIR sobre el global (el global es el
   default, no el techo). Nivel efectivo de un material = max(global, categoría).
   ─────────────────────────────────────────────────────────────────────────── */

export const NIVELES = ['operativo', 'basica', 'avanzada'];

// Posición ordinal del nivel (para comparar). Desconocido/nulo → 'operativo'.
export const rank = (n) => {
  const i = NIVELES.indexOf(n);
  return i === -1 ? 0 : i;
};

// Nivel global de la empresa (default 'operativo').
export const nivelGlobal = (gestion) => gestion?.nivel ?? 'operativo';

// Nivel efectivo de una categoría: la categoría solo puede subir sobre el global.
export function nivelCategoria(gestion, categoria) {
  const g = nivelGlobal(gestion);
  const c = gestion?.categorias?.[(categoria || '').trim()];
  return c && rank(c) > rank(g) ? c : g;
}

// Nivel efectivo de un material (según su categoría).
export const nivelMaterial = (gestion, material) =>
  nivelCategoria(gestion, material?.categoria);

// Capacidades derivadas de un nivel, legibles en los componentes.
export function caps(nivel) {
  const r = rank(nivel);
  return {
    finanzas: r >= rank('basica'),   // importes, cargos/deudas, pestaña Finanzas
    avanzado: r >= rank('avanzada'), // lotes, series, amortización, tipo_trazabilidad
  };
}

// ¿La empresa tiene finanzas en ALGÚN sitio? (global ≥ básica, o alguna categoría ≥ básica).
// Útil para decidir si se muestra la pestaña Finanzas o las columnas de coste.
export function empresaTieneFinanzas(gestion) {
  if (caps(nivelGlobal(gestion)).finanzas) return true;
  return Object.values(gestion?.categorias || {}).some((n) => caps(n).finanzas);
}

// ¿La empresa usa el modo avanzado en algún sitio? (para columnas de lotes/amortización).
export function empresaTieneAvanzado(gestion) {
  if (caps(nivelGlobal(gestion)).avanzado) return true;
  return Object.values(gestion?.categorias || {}).some((n) => caps(n).avanzado);
}

// Etiqueta legible de cada nivel (i18n con la prop L del componente).
export const labelNivel = (nivel, L) => ({
  operativo: L('Operativo', 'Operational'),
  basica:    L('Contabilidad básica', 'Basic accounting'),
  avanzada:  L('Avanzada', 'Advanced'),
}[nivel] || nivel);
