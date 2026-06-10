/* Constantes compartidas entre TabExpediciones y TabPlanning */

export const TIPOS = {
  salir_almacen:    { label:"Salir Almacén",        short:"Salida",     color:"#6366f1", bg:"#ede9fe", grupo:"inicio" },
  llevar_evento:    { label:"Llevar a evento",      short:"En ruta →",  color:"#2563eb", bg:"#dbeafe", grupo:"inicio" },
  descargar_evento: { label:"Descargar en evento",  short:"Descargar",  color:"#059669", bg:"#d1fae5", grupo:"inicio" },
  recoger_evento:   { label:"Recoger de evento",    short:"Recoger",    color:"#d97706", bg:"#fef3c7", grupo:"final"  },
  regresar_almacen: { label:"Regresar al almacén",  short:"← Regreso",  color:"#7c3aed", bg:"#ede9fe", grupo:"final"  },
  descargar_almacen:{ label:"Descargar en almacén", short:"Alm.",       color:"#9d174d", bg:"#fce7f3", grupo:"final"  },
};

export const DEFAULT_DURS = {
  salir_almacen:    0.5,
  llevar_evento:    1.0,
  descargar_evento: 0.5,
  recoger_evento:   0.5,
  regresar_almacen: 1.0,
  descargar_almacen:0.5,
};
