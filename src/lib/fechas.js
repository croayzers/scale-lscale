/* ─── Utilidades de fecha para L-Scale ─────────────────────────────────────
   fmtFecha : formatea una fecha ISO (YYYY-MM-DD) al formato configurado
   siguienteCodigo : genera el próximo código OA_NNNNN
   ─────────────────────────────────────────────────────────────────────────── */

export function fmtFecha(iso, fmt = "DD/MM/YYYY") {
  if (!iso) return "—";
  const parts = String(iso).slice(0, 10).split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  switch (fmt) {
    case "MM/DD/YYYY": return `${m}/${d}/${y}`;
    case "DD-MM-YYYY": return `${d}-${m}-${y}`;
    default:           return `${d}/${m}/${y}`; // DD/MM/YYYY
  }
}

export function siguienteCodigo(pedidos = []) {
  let max = 199;
  for (const p of pedidos) {
    const match = /^OA_(\d+)$/.exec(p.codigo || "");
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `OA_${String(max + 1).padStart(5, "0")}`;
}
