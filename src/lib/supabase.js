/* ===========================================================================
 * Cliente Supabase de L-Scale (Logistic Scale).
 * - Proyecto ÚNICO "Scale": auth y companies COMPARTIDOS con todas las apps.
 * - Las tablas de L-Scale viven en el schema `lscale`.
 * - Mismo sistema de cookies compartidas que P-Scale (mismo dominio).
 * ======================================================================== */
import { createBrowserClient } from "@supabase/ssr";

const URL  = import.meta.env?.VITE_SUPABASE_URL;
const ANON = import.meta.env?.VITE_SUPABASE_ANON_KEY;
const RAW_COOKIE_DOMAIN = import.meta.env?.VITE_SCALE_COOKIE_DOMAIN?.trim?.() || "";

export const supabaseConfigurado = Boolean(URL && ANON);

let _cli = null;
function sharedCookieOptions() {
  const cookieDomain = RAW_COOKIE_DOMAIN.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  const hostForSecurityCheck = cookieDomain.replace(/^\./, "").toLowerCase();
  const useSecureCookies = Boolean(
    cookieDomain && hostForSecurityCheck !== "localhost" && hostForSecurityCheck !== "127.0.0.1"
  );
  return {
    path: "/",
    sameSite: "lax",
    ...(cookieDomain ? { domain: cookieDomain } : {}),
    ...(useSecureCookies ? { secure: true } : {}),
  };
}

// Cliente para tablas comunes (public): companies, company_members…
export function sb() {
  if (!supabaseConfigurado) return null;
  if (!_cli) {
    _cli = createBrowserClient(URL, ANON, {
      cookieOptions: sharedCookieOptions(),
      isSingleton: true,
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return _cli;
}

// Cliente apuntando al schema de esta app (lscale.*).
export function lsc() {
  const c = sb();
  return c ? c.schema("lscale") : null;
}
