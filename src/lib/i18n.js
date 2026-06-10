/* ===========================================================================
 * i18n · Idioma de la interfaz (Español / Inglés / Català)
 * Mismo sistema que P-Scale — contexto compartido.
 * ======================================================================== */
import { createContext, useContext } from "react";

export const IDIOMAS = [
  { id: "es", label: "ES", nombre: "Español" },
  { id: "ca", label: "CA", nombre: "Català" },
  { id: "en", label: "EN", nombre: "English" },
];

export const LangContext = createContext("es");
export const useLang = () => useContext(LangContext);

export function useL() {
  const lang = useContext(LangContext);
  return (es, en, ca) => {
    if (lang === "ca") return ca == null ? es : ca;
    if (lang === "en") return en == null ? es : en;
    return es;
  };
}
