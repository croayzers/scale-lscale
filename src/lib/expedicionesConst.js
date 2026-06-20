/* Constantes compartidas entre TabExpediciones y TabPlanning */

export const TIPOS = {
  salir_almacen:    { label:"Salir Almacén",        short:"Salida",     color:"#16a34a", bg:"#dcfce7", grupo:"inicio" },
  llevar_evento:    { label:"Llevar a evento",      short:"En ruta →",  color:"#ea580c", bg:"#ffedd5", grupo:"inicio" },
  descargar_evento: { label:"Descargar en evento",  short:"Descargar",  color:"#dc2626", bg:"#fee2e2", grupo:"inicio" },
  recoger_evento:   { label:"Recoger de evento",    short:"Recoger",    color:"#dc2626", bg:"#fee2e2", grupo:"final"  },
  regresar_almacen: { label:"Regresar al almacén",  short:"← Regreso",  color:"#ea580c", bg:"#ffedd5", grupo:"final"  },
  descargar_almacen:{ label:"Descargar en almacén", short:"Alm.",       color:"#16a34a", bg:"#dcfce7", grupo:"final"  },
};

export const DEFAULT_DURS = {
  salir_almacen:    0.5,
  llevar_evento:    1.0,
  descargar_evento: 0.5,
  recoger_evento:   0.5,
  regresar_almacen: 1.0,
  descargar_almacen:0.5,
};
