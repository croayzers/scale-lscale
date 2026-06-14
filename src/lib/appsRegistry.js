/* ===========================================================================
 * Catálogo de apps Scale — fuente de verdad: public.apps_registry (Supabase).
 * Antes cada app tenía las URLs del resto hardcodeadas. Ahora se leen de la
 * tabla compartida; añadir una app = 1 fila, cero cambios de código.
 * Si la tabla no responde (offline/sin sesión) se usa FALLBACK_APPS.
 * ======================================================================== */
import { sb } from "./supabase.js";

const IS_DEV = typeof import.meta !== "undefined" && import.meta.env?.DEV;

// Respaldo mínimo si la tabla no está disponible.
export const FALLBACK_APPS = [
  { id: "lscale", nombre: "L-Scale", emoji: "📦", color: "#f97316", url_prod: "https://logistics.thescaleapps.com", url_dev: "http://localhost:5182", activa: true,  orden: 10 },
  { id: "pscale", nombre: "P-Scale", emoji: "👥", color: "#6366f1", url_prod: "https://people.thescaleapps.com",    url_dev: "http://localhost:5181", activa: true,  orden: 20 },
  { id: "sscale", nombre: "S-Scale", emoji: "📱", color: "#8b5cf6", url_prod: "https://social.thescaleapps.com",    url_dev: "http://localhost:3001", activa: true,  orden: 30 },
  { id: "escale", nombre: "E-Scale", emoji: "🏛️", color: "#10b981", url_prod: "https://events.thescaleapps.com",    url_dev: "http://localhost:5173", activa: true,  orden: 40 },
];

let _cache = null;

// URL efectiva según entorno; null si la app está inactiva o sin URL.
export function appUrl(app) {
  if (!app?.activa) return null;
  const envOverride = app.url_env && import.meta.env?.[app.url_env];
  const url = envOverride || (IS_DEV ? (app.url_dev ?? app.url_prod) : app.url_prod);
  return url || null;
}

// Carga el catálogo una vez (cacheado). Devuelve siempre un array.
export async function cargarApps() {
  if (_cache) return _cache;
  try {
    const c = sb();
    if (c) {
      const { data, error } = await c
        .from("apps_registry")
        .select("id,nombre,emoji,color,url_prod,url_dev,activa,orden")
        .order("orden", { ascending: true });
      if (!error && Array.isArray(data) && data.length) {
        _cache = data;
        return _cache;
      }
    }
  } catch (e) {
    console.warn("[appsRegistry] sin tabla, usando fallback:", e?.message);
  }
  _cache = [...FALLBACK_APPS].sort((a, b) => a.orden - b.orden);
  return _cache;
}
