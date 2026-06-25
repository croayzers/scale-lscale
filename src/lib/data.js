// MARK: - Capa de datos — Supabase (schema lscale) + SEED demo
// MARK: - Mappers (mapEmpresa, mapMaterial, materialToRow, mapPedido, pedidoToRow, mapExpedicion)
// MARK: - SEED demo (EMPRESA_DEMO, PEDIDOS_DEMO, MATERIALES_DEMO)
// MARK: - cargarDatos
// MARK: - Materiales CRUD (crearMaterial, actualizarMaterial, borrarMaterial, recargarMateriales)
// MARK: - Pedidos CRUD (guardarPedido, borrarPedido, registrarVistoPor)
// MARK: - Expediciones CRUD (guardarExpedicion, borrarExpedicion)
// MARK: - Tramos Planning (guardarTramos, cargarTodosTramos)
// MARK: - Empresa config (crearConfigInicial, cargarPrefs, guardarPrefs)
// MARK: - Notificaciones (cargarMiembrosEmpresa, enviarNotificacionPedido)
import { sb, lsc, supabaseConfigurado } from "./supabase.js";

// MARK: - Mappers (mapEmpresa, mapMaterial, materialToRow, mapPedido, pedidoToRow, mapExpedicion)
// ── Mappers ────────────────────────────────────────────────────────────────

function mapEmpresa(co, cfg) {
  return {
    id: co.id, nombre: co.nombre, pais: co.pais || "ES",
    logo_url:      co.logo_url      || null,
    website:       co.website       || null,
    phone:         co.phone         || null,
    cif:           co.cif           || null,
    billing_email: co.billing_email || null,
    apps: co.apps || [],
    flags: co.flags || {},
    // IA heredada del Portal: companies.flags.ai = { provider, keys }.
    aiProvider: co.flags?.ai?.provider || null,
    aiKeys: co.flags?.ai?.keys || {},
    col_config: cfg?.col_config || {},
    datos_json: cfg?.datos_json || {},
  };
}

function mapMaterial(r) {
  return {
    id: r.id, emp: r.company_id,
    referencia:   r.referencia   || null,
    nombre:       r.nombre,
    descripcion:  r.descripcion  || null,
    categoria:    r.categoria    || null,
    unidad:       r.unidad       || "ud",
    stock_actual: r.stock_actual ?? 0,
    stock_minimo: r.stock_minimo ?? 0,
    ubicacion:    r.ubicacion    || null,
    estado:       r.estado       || "activo",
    proveedor:             r.proveedor             || null,
    referencia_proveedor:  r.referencia_proveedor  || null,
    precio_coste: r.precio_coste ?? null,
    precio:       r.precio       ?? null,
    notas:        r.notas        || null,
    almacen_id:   r.almacen_id   ?? null,
    imagen_url:   r.imagen_url   || null,
    coste_adquisicion:             r.coste_adquisicion             ?? null,
    margen:                        r.margen                        ?? null,
    pvp:                           r.pvp                           ?? null,
    periodo_amortizacion_dias:     r.periodo_amortizacion_dias     ?? null,
    coste_amortizacion_diario:     r.coste_amortizacion_diario     ?? null,
    tipo_activo:                   r.tipo_activo                   || 'propio',
  };
}

function materialToRow(m, companyId) {
  return {
    company_id:   companyId,
    referencia:   m.referencia   ?? null,
    nombre:       m.nombre,
    descripcion:  m.descripcion  ?? null,
    categoria:    m.categoria    ?? null,
    unidad:       m.unidad       ?? "ud",
    stock_actual: Number(m.stock_actual) || 0,
    stock_minimo: Number(m.stock_minimo) || 0,
    ubicacion:    m.ubicacion    ?? null,
    estado:       m.estado       ?? "activo",
    proveedor:            m.proveedor            ?? null,
    referencia_proveedor: m.referencia_proveedor ?? null,
    precio_coste: m.precio_coste != null ? Number(m.precio_coste) : null,
    precio:       m.precio       != null ? Number(m.precio)       : null,
    notas:        m.notas        ?? null,
    almacen_id:   m.almacen_id   ?? null,
    imagen_url:   m.imagen_url   ?? null,
    coste_adquisicion:         m.coste_adquisicion != null ? Number(m.coste_adquisicion) : null,
    margen:                    m.margen            != null ? Number(m.margen)            : null,
    pvp:                       m.pvp               != null ? Number(m.pvp)               : null,
    periodo_amortizacion_dias: m.periodo_amortizacion_dias != null ? Number(m.periodo_amortizacion_dias) : null,
    tipo_activo:               m.tipo_activo ?? 'propio',
  };
}

function mapPedido(r) {
  const d = r.datos && typeof r.datos === "object" ? r.datos : {};
  return { ...d, id: r.id, emp: r.company_id, codigo: r.codigo, nombre: r.nombre,
    fecha_pedido: r.fecha_pedido, fecha_entrega: r.fecha_entrega, estado: r.estado || "borrador",
    destino: r.destino, notas: r.notas,
    creado_por_id: r.creado_por_id ?? null,
    creado_por_nombre: r.creado_por_nombre ?? null,
    vistos_por: Array.isArray(r.vistos_por) ? r.vistos_por : [],
    fecha_evento_inicio: r.fecha_evento_inicio ?? null,
    fecha_evento_fin:    r.fecha_evento_fin    ?? null,
    tipo_pedido:         r.tipo_pedido         || 'estandar',
    margen_venta:        r.margen_venta        ?? null,
    tipo_margen:         r.tipo_margen         || 'pct',
    precio_venta:        r.precio_venta        ?? null,
  };
}

function pedidoToRow(p, companyId) {
  // Calcular precio_venta desnormalizado para poder consultarlo en analytics
  const _coste = typeof p._coste_total === "number" ? p._coste_total : null;
  const _mv    = p.margen_venta != null ? Number(p.margen_venta) : null;
  const _pv    = (_coste != null && _mv != null)
    ? (p.tipo_margen === "fijo" ? _coste + _mv : _coste * (1 + _mv / 100))
    : (p.precio_venta ?? null);

  return {
    id: p.id ? String(p.id) : undefined,
    company_id: companyId,
    codigo: p.codigo ?? null, nombre: p.nombre ?? null,
    fecha_pedido: p.fecha_pedido || null, fecha_entrega: p.fecha_entrega || null,
    estado: p.estado || "borrador", destino: p.destino ?? null, notas: p.notas ?? null,
    creado_por_id: p.creado_por_id ?? null,
    creado_por_nombre: p.creado_por_nombre ?? null,
    vistos_por: p.vistos_por ?? [],
    fecha_evento_inicio: p.fecha_evento_inicio ?? null,
    fecha_evento_fin:    p.fecha_evento_fin    ?? null,
    tipo_pedido:         p.tipo_pedido         ?? 'estandar',
    margen_venta:        p.margen_venta        != null ? Number(p.margen_venta) : null,
    tipo_margen:         p.tipo_margen         ?? 'pct',
    precio_venta:        _pv,
    datos: p,
  };
}

function mapExpedicion(r) {
  const d = r.datos && typeof r.datos === "object" ? r.datos : {};
  return { ...d, id: r.id, emp: r.company_id, pedido_id: r.pedido_id,
    codigo: r.codigo, fecha_salida: r.fecha_salida, fecha_retorno: r.fecha_retorno,
    estado: r.estado || "preparando", destino: r.destino, responsable: r.responsable,
    vehiculo: r.vehiculo };
}

// MARK: - SEED demo (EMPRESA_DEMO, PEDIDOS_DEMO, MATERIALES_DEMO)
// ── SEED demo (sin Supabase) ───────────────────────────────────────────────

const EMPRESA_DEMO = {
  id: "demo", nombre: "Empresa Demo (L-Scale)", pais: "ES",
  logo_url: null, apps: ["lscale"], flags: {}, col_config: {},
};

// Fechas relativas al día de hoy para que el demo siempre tenga eventos visibles
function hoyMas(n) {
  const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+n);
  return d.toISOString().slice(0,10);
}

const PEDIDOS_DEMO = [
  {
    id: 1, emp: "demo", codigo: "PED-001", nombre: "Boda García - Jardín del Olivar",
    fecha_pedido: hoyMas(-1), fecha_entrega: hoyMas(0),
    estado: "confirmado", destino: "Finca El Olivar, Madrid",
    notas: "Montar antes de las 10h", _tipo: "pedido", vehiculo_id: "1",
    hora_ida: "09:00", hora_vuelta: "23:00",
    lineas: [
      { material_id: 1, nombre: "Silla Thonet",           cantidad: 80,  unidad: "ud" },
      { material_id: 2, nombre: "Mesa redonda 180cm",     cantidad: 16,  unidad: "ud" },
      { material_id: 3, nombre: "Mantel blanco 200x200",  cantidad: 16,  unidad: "ud" },
      { material_id: 4, nombre: "Copa de agua cristal",   cantidad: 160, unidad: "ud" },
    ],
  },
  {
    id: 2, emp: "demo", codigo: "PED-002", nombre: "Cocktail Corporativo Repsol",
    fecha_pedido: hoyMas(0), fecha_entrega: hoyMas(0),
    estado: "confirmado", destino: "Torre Repsol, Madrid",
    notas: null, _tipo: "pedido", vehiculo_id: "2",
    hora_ida: "14:00", hora_vuelta: "21:30",
    lineas: [
      { material_id: 1, nombre: "Silla Thonet",         cantidad: 50,  unidad: "ud" },
      { material_id: 5, nombre: "Atril madera",         cantidad: 3,   unidad: "ud" },
      { material_id: 4, nombre: "Copa de agua cristal", cantidad: 100, unidad: "ud" },
    ],
  },
  {
    id: 3, emp: "demo", codigo: "PED-003", nombre: "Aniversario Hotel Palace",
    fecha_pedido: hoyMas(1), fecha_entrega: hoyMas(9),
    estado: "borrador", destino: "Hotel Palace, Barcelona",
    notas: null, _tipo: "pedido", vehiculo_id: "1",
    lineas: [
      { material_id: 2, nombre: "Mesa redonda 180cm",    cantidad: 20,  unidad: "ud" },
      { material_id: 3, nombre: "Mantel blanco 200x200", cantidad: 20,  unidad: "ud" },
      { material_id: 4, nombre: "Copa de agua cristal",  cantidad: 200, unidad: "ud" },
    ],
  },
];

const MATERIALES_DEMO = [
  { id: 1, emp: "demo", referencia: "M-001", nombre: "Silla Thonet", descripcion: null,
    almacen_id: 1, categoria: "Mobiliario", unidad: "ud", stock_actual: 120, stock_minimo: 20,
    ubicacion: "A-01", estado: "activo", proveedor: null, precio_coste: null, notas: null },
  { id: 2, emp: "demo", referencia: "M-002", nombre: "Mesa redonda 180cm", descripcion: null,
    almacen_id: 1, categoria: "Mobiliario", unidad: "ud", stock_actual: 30, stock_minimo: 5,
    ubicacion: "A-02", estado: "activo", proveedor: null, precio_coste: null, notas: null },
  { id: 3, emp: "demo", referencia: "M-003", nombre: "Mantel blanco 200x200", descripcion: null,
    almacen_id: 2, categoria: "Lencería", unidad: "ud", stock_actual: 80, stock_minimo: 30,
    ubicacion: "B-01", estado: "activo", proveedor: null, precio_coste: null, notas: null },
  { id: 4, emp: "demo", referencia: "M-004", nombre: "Copa de agua cristal", descripcion: null,
    almacen_id: 2, categoria: "Cristalería", unidad: "ud", stock_actual: 350, stock_minimo: 100,
    ubicacion: "C-01", estado: "activo", proveedor: null, precio_coste: null, notas: null },
  { id: 5, emp: "demo", referencia: "M-005", nombre: "Atril madera", descripcion: null,
    almacen_id: 3, categoria: "Complementos", unidad: "ud", stock_actual: 8, stock_minimo: 2,
    ubicacion: "D-01", estado: "activo", proveedor: null, precio_coste: null, notas: null },
];

// MARK: - cargarDatos
// ── Carga inicial ──────────────────────────────────────────────────────────

export async function cargarDatos() {
  if (!supabaseConfigurado) {
    return { modo: "demo", empresas: [EMPRESA_DEMO], materiales: MATERIALES_DEMO, pedidos: PEDIDOS_DEMO, expediciones: [], reservas: [] };
  }
  try {
    const { data: { user }, error: eUser } = await sb().auth.getUser();
    if (import.meta.env?.DEV) console.log("%c[L-Scale] Auth getUser", "color:#2563eb;font-weight:bold", user?.id ?? "null", eUser?.message ?? "ok");
    if (!user) return { modo: "sin_sesion", empresas: [], materiales: [], pedidos: [], expediciones: [], reservas: [] };

    const { data: comps, error: eComps } = await sb().from("companies").select("*");
    const { data: cfgs,  error: eCfgs  } = await lsc().from("empresa_config").select("*");
    const cfgBy  = Object.fromEntries((cfgs  || []).map((c) => [c.company_id, c]));
    const allEmpresas = (comps || []).map((co) => mapEmpresa(co, cfgBy[co.id]));
    const empresas = allEmpresas.slice(0, 1);

    // Membresía del usuario: rol + apps permitidas (una sola query)
    let myRol = "owner";
    let nivelApp = null; // ver | editar | admin
    if (empresas.length > 0) {
      const { data: memb } = await sb().from("company_members")
        .select("rol, apps, app_permisos")
        .eq("company_id", empresas[0].id)
        .eq("user_id", user.id)
        .maybeSingle();
      myRol = memb?.rol ?? "member";
      const memberApps = memb?.apps ?? null;
      if (myRol !== "owner" && memberApps !== null && !memberApps.includes("lscale")) {
        return { modo: "sin_acceso", empresas, materiales: [], pedidos: [], expediciones: [], reservas: [], rol: myRol };
      }
      // Nivel de permiso en lscale: ver | editar | admin (null = sin restricción)
      nivelApp = (memb?.app_permisos?.["lscale"]) ?? null;
    }

    const { data: mats, error: eMats } = await lsc().from("materiales").select("*");
    const materiales = (mats || []).map(mapMaterial);

    const { data: peds, error: ePeds } = await lsc().from("pedidos").select("*");
    const pedidos = (peds || []).map(mapPedido);

    const { data: exps, error: eExps } = await lsc().from("expediciones").select("*");
    const expediciones = (exps || []).map(mapExpedicion);

    const { data: reservas, error: eReservas } = await lsc().from("reservas_stock").select("*");

    if (import.meta.env?.DEV) {
      console.log("%c[L-Scale] Carga desde Supabase", "color:#16a34a;font-weight:bold");
      console.log("  companies:", comps?.length ?? 0, eComps ? `❌ ${eComps.message}` : "ok");
      console.log("  empresa_config:", cfgs?.length ?? 0, eCfgs ? `❌ ${eCfgs.message}` : "ok");
      console.log("  materiales:", mats?.length ?? 0, eMats ? `❌ ${eMats.message}` : "ok");
      console.log("  pedidos:", peds?.length ?? 0, ePeds ? `❌ ${ePeds.message}` : "ok");
      console.log("  expediciones:", exps?.length ?? 0, eExps ? `❌ ${eExps.message}` : "ok");
      console.log("  reservas_stock:", reservas?.length ?? 0, eReservas ? `❌ ${eReservas.message}` : "ok");
    }

    if (!empresas.length) return { modo: "sin_empresa", empresas: [], materiales: [], pedidos: [], expediciones: [], reservas: [], rol: myRol };
    const tieneConfig = cfgs && cfgs.length > 0;
    if (!tieneConfig) return { modo: "sin_config", empresas, materiales: [], pedidos: [], expediciones: [], reservas: [], rol: myRol };

    // Extraer prefs del registro de config ya cargado (evita un segundo round-trip)
    const cfgRow = cfgBy[empresas[0]?.id];
    const dj = cfgRow?.datos_json;
    const cc = cfgRow?.col_config;
    const prefs = (dj && Object.keys(dj).length ? dj : null)
               ?? (cc && (cc.almacenes || cc.vehiculos || cc.roles) ? cc : null)
               ?? dj ?? cc ?? {};

    return { modo: "supabase", empresas, materiales, pedidos, expediciones, reservas: reservas || [], rol: myRol, prefs, nivelApp };
  } catch (e) {
    console.warn("[L-Scale] Error cargando de Supabase, uso demo:", e?.message);
    return { modo: "demo", empresas: [EMPRESA_DEMO], materiales: MATERIALES_DEMO, pedidos: [], expediciones: [], reservas: [] };
  }
}

// MARK: - Materiales CRUD (crearMaterial, actualizarMaterial, borrarMaterial, recargarMateriales)
// ── Materiales CRUD ────────────────────────────────────────────────────────

export async function crearMaterial(m, companyId) {
  const { data, error } = await lsc().from("materiales").insert(materialToRow(m, companyId)).select().single();
  if (error) throw error;
  return mapMaterial(data);
}

export async function actualizarMaterial(id, cambios) {
  const permitidas = ["referencia","nombre","descripcion","categoria","unidad","stock_actual",
    "stock_minimo","ubicacion","estado","proveedor","referencia_proveedor","precio_coste","notas","imagen_url","almacen_id",
    "coste_adquisicion","margen","pvp","periodo_amortizacion_dias","tipo_activo"];
  const patch = {};
  for (const k of permitidas) if (k in cambios) patch[k] = cambios[k];
  if ("stock_actual" in patch) patch.stock_actual = Number(patch.stock_actual) || 0;
  if ("stock_minimo" in patch) patch.stock_minimo = Number(patch.stock_minimo) || 0;
  if ("almacen_id" in patch) patch.almacen_id = patch.almacen_id != null ? Number(patch.almacen_id) : null;
  const { data, error } = await lsc().from("materiales").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return mapMaterial(data);
}

export async function borrarMaterial(id) {
  const { error } = await lsc().from("materiales").delete().eq("id", id);
  if (error) throw error;
}

// Marca una IA "sin tokens" en companies.flags.ai.estado (para el panel admin).
// Best-effort: si RLS bloquea la escritura, se ignora.
export async function marcarIASinTokens(companyId, provider) {
  if (!companyId || !provider) return;
  try {
    const { data } = await sb().from("companies").select("flags").eq("id", companyId).single();
    const flags = data?.flags || {};
    const ai = flags.ai || {};
    const estado = { ...(ai.estado || {}), [provider]: "sin_tokens" };
    await sb().from("companies").update({ flags: { ...flags, ai: { ...ai, estado } } }).eq("id", companyId);
  } catch { /* sin permiso: el aviso al usuario basta */ }
}

export async function recargarMateriales() {
  const { data, error } = await lsc().from("materiales").select("*");
  if (error) throw error;
  return (data || []).map(mapMaterial);
}

export async function subirImagenMaterial(file, companyId) {
  const ext = file.name.split(".").pop().toLowerCase() || "jpg";
  const path = `${companyId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb().storage.from("material-images").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = sb().storage.from("material-images").getPublicUrl(path);
  return data.publicUrl;
}

export async function borrarImagenMaterial(publicUrl) {
  const marker = "/material-images/";
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;
  const path = publicUrl.slice(idx + marker.length);
  await sb().storage.from("material-images").remove([path]);
}

// MARK: - Pedidos CRUD (guardarPedido, borrarPedido, registrarVistoPor)
// ── Pedidos ────────────────────────────────────────────────────────────────

export async function guardarPedido(p, companyId) {
  const row = pedidoToRow(p, companyId);
  const id = row.id;
  // El id nunca va en el cuerpo: en UPDATE solo es filtro; mandarlo (string) a la
  // columna bigint provoca un 400 de PostgREST. En INSERT lo genera la BD.
  delete row.id;
  const { data, error } = id
    ? await lsc().from("pedidos").update(row).eq("id", id).select().single()
    : await lsc().from("pedidos").insert(row).select().single();
  if (error) throw error;
  return mapPedido(data);
}

export async function borrarPedido(id) {
  const { error } = await lsc().from("pedidos").delete().eq("id", id);
  if (error) throw error;
}

// Añade userId/nombre a vistos_por si no estaba ya
export async function registrarVistoPor(pedidoId, userId, nombre) {
  const { data } = await lsc().from("pedidos").select("vistos_por").eq("id", pedidoId).single();
  const actual = Array.isArray(data?.vistos_por) ? data.vistos_por : [];
  if (actual.some(v => v.id === userId)) return;
  const next = [...actual, { id: userId, nombre }];
  await lsc().from("pedidos").update({ vistos_por: next }).eq("id", pedidoId);
}

// MARK: - Expediciones CRUD (guardarExpedicion, borrarExpedicion)
// ── Expediciones ───────────────────────────────────────────────────────────

export async function guardarExpedicion(exp, companyId) {
  const row = {
    company_id: companyId,
    pedido_id: exp.pedido_id ?? null,
    codigo: exp.codigo ?? null, fecha_salida: exp.fecha_salida ?? null,
    fecha_retorno: exp.fecha_retorno ?? null, estado: exp.estado ?? "preparando",
    destino: exp.destino ?? null, responsable: exp.responsable ?? null,
    vehiculo: exp.vehiculo ?? null, datos: exp,
  };
  if (exp.id) {
    const { data, error } = await lsc().from("expediciones").update(row).eq("id", exp.id).select().single();
    if (error) throw error;
    return mapExpedicion(data);
  }
  const { data, error } = await lsc().from("expediciones").insert(row).select().single();
  if (error) throw error;
  return mapExpedicion(data);
}

export async function borrarExpedicion(id) {
  const { error } = await lsc().from("expediciones").delete().eq("id", id);
  if (error) throw error;
}

// MARK: - Tramos Planning (guardarTramos, cargarTodosTramos)
// ── Tramos de Planning ─────────────────────────────────────────────────────
// Guarda los tramos de un pedido dentro de expediciones.datos (crea registro si no existe)
export async function guardarTramos(pedidoId, tramos, companyId) {
  const { data: existing } = await lsc().from("expediciones")
    .select("id, datos")
    .eq("company_id", companyId)
    .eq("pedido_id", pedidoId)
    .maybeSingle();

  const datos = { ...(existing?.datos ?? {}), tramos };
  if (existing?.id) {
    const { error } = await lsc().from("expediciones")
      .update({ datos })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await lsc().from("expediciones")
      .insert({ company_id: companyId, pedido_id: pedidoId, datos, estado: "preparando" });
    if (error) throw error;
  }
}

// Devuelve { [pedidoId]: tramos[] } para todos los pedidos de una empresa
export async function cargarTodosTramos(companyId) {
  const { data, error } = await lsc().from("expediciones")
    .select("pedido_id, datos")
    .eq("company_id", companyId);
  if (error) throw error;
  const result = {};
  for (const row of data ?? []) {
    if (row.pedido_id && Array.isArray(row.datos?.tramos)) {
      result[String(row.pedido_id)] = row.datos.tramos;
    }
  }
  return result;
}

// MARK: - Empresa config (crearConfigInicial, cargarPrefs, guardarPrefs)
// ── Empresa config ─────────────────────────────────────────────────────────

export async function crearConfigInicial(companyId) {
  const { data: cfg, error } = await lsc().from("empresa_config")
    .upsert({ company_id: companyId, datos_json: {} }, { onConflict: "company_id" })
    .select().single();
  if (error) throw error;
  return cfg;
}

// Carga preferencias de empresa.
// Usa datos_json (schema nuevo) o col_config (schema original 01_lscale.sql).
export async function cargarPrefs(companyId) {
  if (!supabaseConfigurado) return null;
  const { data, error } = await lsc().from("empresa_config")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) { console.warn("[L-Scale] cargarPrefs error:", error.message); return null; }
  if (!data) return {};
  // datos_json es la columna actual; col_config era la del schema original
  const dj = data.datos_json;
  const cc = data.col_config;
  if (dj && typeof dj === "object" && Object.keys(dj).length > 0) return dj;
  if (cc && typeof cc === "object" && (cc.almacenes || cc.vehiculos || cc.roles)) return cc;
  return dj ?? cc ?? {};
}

// Guarda un campo de preferencias (merge parcial).
// Detecta automáticamente si usar datos_json (nuevo) o col_config (viejo).
export async function guardarPrefs(companyId, patch) {
  if (!supabaseConfigurado) return;
  const { data } = await lsc().from("empresa_config")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  // Detectar qué columna tiene las prefs según el schema en producción
  const usaDatosJson = !data || "datos_json" in data;
  const actual = usaDatosJson
    ? (data?.datos_json ?? {})
    : (data?.col_config ?? {});
  const nuevo = { ...actual, ...patch };
  const colPrefs = usaDatosJson ? "datos_json" : "col_config";
  const { error } = await lsc().from("empresa_config")
    .upsert({ company_id: companyId, [colPrefs]: nuevo }, { onConflict: "company_id" });
  if (error) throw error;
}

// Proveedor PRINCIPAL global de la empresa: su coste es el que se usa por
// defecto al importar/abrir un pedido. Se guarda en empresa_config.datos_json
// (merge parcial), así no necesita columna ni migración propia.
export async function cargarProveedorPrincipal(companyId) {
  if (!supabaseConfigurado) return null;
  const prefs = await cargarPrefs(companyId);
  const v = prefs?.proveedor_principal_id;
  return v != null ? Number(v) : null;
}

export async function guardarProveedorPrincipal(companyId, proveedorId) {
  if (!supabaseConfigurado) return;
  await guardarPrefs(companyId, {
    proveedor_principal_id: proveedorId != null ? Number(proveedorId) : null,
  });
}

// MARK: - Notificaciones (cargarMiembrosEmpresa, enviarNotificacionPedido)

// Carga miembros con email y rol (para el panel de empresa y el chat)
export async function cargarMiembros(companyId) {
  if (!supabaseConfigurado || !companyId) return [];
  const [{ data: members, error }, { data: rpcEmails }] = await Promise.all([
    sb().from("company_members").select("user_id, rol").eq("company_id", companyId),
    sb().rpc("get_company_member_emails", { p_company_id: companyId }),
  ]);
  if (error) { console.error("[L-Scale] cargarMiembros:", error.message); return []; }
  const emailMap = {};
  (rpcEmails || []).forEach(r => { if (r.user_id) emailMap[r.user_id] = r.email; });
  return (members || []).map(m => {
    const email = emailMap[m.user_id] ?? null;
    const nombre = email ? email.split("@")[0].replace(/[._]/g, " ") : "Usuario";
    return { user_id: m.user_id, rol: m.rol, email, nombre };
  });
}

export async function cargarMiembrosEmpresa(companyId) {
  if (!supabaseConfigurado || !companyId) return [];
  const { data, error } = await sb().rpc("get_company_member_emails", { p_company_id: companyId });
  if (error) { console.error("cargarMiembrosEmpresa:", error.message); return []; }
  return data || [];
}

export async function enviarNotificacionPedido(pedido, destinatarios) {
  const WORKER_URL = import.meta.env?.VITE_NOTIFICATIONS_URL;
  const WORKER_SECRET = import.meta.env?.VITE_NOTIFICATIONS_SECRET;
  if (!WORKER_URL || !destinatarios?.length) return;
  await fetch(WORKER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(WORKER_SECRET ? { "x-webhook-secret": WORKER_SECRET } : {}),
    },
    body: JSON.stringify({
      tipo: "pedido_nuevo",
      app: "lscale",
      destinatarios,
      datos: {
        codigo:        pedido.codigo || `PED-${pedido.id}`,
        nombre:        pedido.nombre || "",
        destino:       pedido.destino || "",
        fecha_entrega: pedido.fecha_entrega || "",
        almacen:       pedido.almacen_nombre || "",
        lineas:        pedido.lineas?.length ?? 0,
      },
    }),
  });
}

/* ═══════════════════════════════════════════════════════════════════
   PROVEEDORES y CORRELACIONES (schema lscale)
   La empresa tiene sus materiales; cada proveedor los llama a su modo.
   correlaciones mapea material_id ↔ nombre_proveedor por proveedor.
   ═══════════════════════════════════════════════════════════════════ */

export async function cargarProveedores(companyId) {
  const { data, error } = await lsc().from("proveedores").select("*").eq("company_id", companyId).order("id");
  if (error) throw error;
  return data || [];
}
export async function crearProveedor(p, companyId) {
  const row = { company_id: companyId, nombre: p.nombre, contacto: p.contacto || null, color: p.color || null };
  if (p.datos) row.datos = p.datos;
  const { data, error } = await lsc().from("proveedores").insert(row).select().single();
  if (error) throw error;
  return data;
}
export async function actualizarProveedor(id, cambios) {
  const patch = {};
  for (const k of ["nombre", "contacto", "color", "plantilla", "datos"]) if (k in cambios) patch[k] = cambios[k];
  const { data, error } = await lsc().from("proveedores").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}
export async function borrarProveedor(id) {
  const { error } = await lsc().from("proveedores").delete().eq("id", id);
  if (error) throw error;
}

// CARGA SELECTIVA (minimiza egress): nunca traemos las miles de correlaciones de
// golpe. Pedimos solo las del proveedor elegido, o solo las de los materiales de
// un pedido. Las columnas justas (no select * innecesario en listados grandes).
// `datos` (jsonb) lleva los campos flexibles que aporta cada proveedor
// (categoria, y cualquier otro que asigne en su plantilla de import).
const COR_COLS = "id,material_id,proveedor_id,nombre_proveedor,referencia,coste,descuento,datos,proveedor_item_id";

// Correlaciones de UN proveedor (para ver/editar su columna o traducir su compra).
export async function cargarCorrelacionesDeProveedor(proveedorId) {
  const { data, error } = await lsc().from("correlaciones").select(COR_COLS).eq("proveedor_id", proveedorId);
  if (error) throw error;
  return data || [];
}
// Correlaciones de un conjunto de materiales (para traducir las líneas de un pedido).
export async function cargarCorrelacionesDeMateriales(materialIds = []) {
  if (!materialIds.length) return [];
  const { data, error } = await lsc().from("correlaciones").select(COR_COLS).in("material_id", materialIds);
  if (error) throw error;
  return data || [];
}

// Crea o actualiza una correlación (material ↔ proveedor) por su par único.
// c.datos (jsonb) = campos flexibles del proveedor (categoria, etc.).
export async function guardarCorrelacion(c, companyId) {
  const row = {
    company_id: companyId, material_id: c.material_id, proveedor_id: c.proveedor_id,
    nombre_proveedor: c.nombre_proveedor, referencia: c.referencia || null,
    coste: c.coste ?? null, descuento: c.descuento ?? null, datos: c.datos || {},
  };
  if (c.proveedor_item_id !== undefined) row.proveedor_item_id = c.proveedor_item_id ?? null;
  const { data, error } = await lsc().from("correlaciones")
    .upsert(row, { onConflict: "material_id,proveedor_id" }).select().single();
  if (error) throw error;
  return data;
}

// Import del Excel del proveedor en UN SOLO request (upsert por lotes ~500 filas).
// `items` = [{ material_id, nombre_proveedor, referencia?, coste?, descuento?, datos? }].
export async function guardarCorrelacionesLote(proveedorId, items, companyId) {
  const rows = (items || []).filter(i => i.material_id && i.nombre_proveedor).map(i => ({
    company_id: companyId, proveedor_id: proveedorId, material_id: i.material_id,
    nombre_proveedor: i.nombre_proveedor, referencia: i.referencia || null,
    coste: i.coste ?? null, descuento: i.descuento ?? null, datos: i.datos || {},
  }));
  if (!rows.length) return [];
  const { data, error } = await lsc().from("correlaciones")
    .upsert(rows, { onConflict: "material_id,proveedor_id" }).select(COR_COLS);
  if (error) throw error;
  return data || [];
}

export async function borrarCorrelacion(id) {
  const { error } = await lsc().from("correlaciones").delete().eq("id", id);
  if (error) throw error;
}

/* ═══════════════════════════════════════════════════════════════════
   PROVEEDOR_ITEMS — catálogo completo de cada proveedor (migración 011)
   Guardamos TODAS las filas del Excel del proveedor (casen o no con un
   material tuyo). La correlación clic-a-clic enlaza tu material con uno
   de estos ítems. Carga selectiva: solo el catálogo del proveedor abierto.
   ═══════════════════════════════════════════════════════════════════ */
const ITEM_COLS = "id,proveedor_id,nombre,referencia,categoria,coste,descuento,datos";

// Catálogo de UN proveedor (para correlacionar clic-a-clic).
export async function cargarItemsDeProveedor(proveedorId) {
  const { data, error } = await lsc().from("proveedor_items").select(ITEM_COLS).eq("proveedor_id", proveedorId).order("nombre");
  if (error) throw error;
  return data || [];
}

// Reemplaza el catálogo del proveedor por el del Excel recién importado
// (borra el anterior y vuelve a insertar; un proveedor = un catálogo vigente).
export async function reemplazarItemsProveedor(proveedorId, items, companyId) {
  const { error: delErr } = await lsc().from("proveedor_items").delete().eq("proveedor_id", proveedorId);
  if (delErr) throw delErr;
  const num = (v) => (v === 0 || v) ? (Number(String(v).replace(",", ".")) || null) : null;
  const rows = (items || []).filter(i => (i.nombre || "").trim()).map(i => ({
    company_id: companyId, proveedor_id: proveedorId,
    nombre: String(i.nombre).trim(),
    referencia: i.referencia || null, categoria: i.categoria || null,
    coste: num(i.coste), descuento: num(i.descuento), datos: i.datos || {},
  }));
  if (!rows.length) return [];
  // Inserta por lotes (~500) para Excels grandes.
  const out = [];
  for (let i = 0; i < rows.length; i += 500) {
    const { data, error } = await lsc().from("proveedor_items").insert(rows.slice(i, i + 500)).select(ITEM_COLS);
    if (error) throw error;
    out.push(...(data || []));
  }
  return out;
}

export async function borrarItemsDeProveedor(proveedorId) {
  const { error } = await lsc().from("proveedor_items").delete().eq("proveedor_id", proveedorId);
  if (error) throw error;
}

// MARK: - Inventario dinámico por fechas (reservas_stock, subalquiler)

export async function calcularStockDisponible(materialId, fechaInicio, fechaFin, excluirPedidoId = null) {
  if (!supabaseConfigurado) return null;
  const { data, error } = await lsc().rpc('stock_disponible', {
    p_material_id: materialId,
    p_fecha_inicio: fechaInicio,
    p_fecha_fin: fechaFin,
    p_excluir_pedido: excluirPedidoId,
  });
  if (error) { console.error('[L-Scale] stock_disponible RPC error', error); return null; }
  return data;
}

export async function sincronizarReservasPedido(pedido, companyId) {
  if (!supabaseConfigurado || pedido.tipo_pedido !== 'evento') return;
  const { fecha_evento_inicio: fi, fecha_evento_fin: ff, id: pedidoId } = pedido;
  if (!fi || !ff) return;

  await lsc().from('reservas_stock').delete().eq('pedido_id', pedidoId);

  const cantidadReservable = (l) => {
    if (l._cantidad_propia != null) return Number(l._cantidad_propia) || 0;
    if (l.cantidad_propia != null) return Number(l.cantidad_propia) || 0;
    if (l.tipo_origen === 'subalquiler' || l._origen_logistico === 'subalquiler' || l.proveedor_id != null) return 0;
    return Number(l.cantidad) || 0;
  };

  const reservas = (pedido.lineas || [])
    .map(l => ({ linea: l, cantidad: cantidadReservable(l) }))
    .filter(x => x.linea.material_id && x.cantidad > 0)
    .map(({ linea: l, cantidad }) => ({
      company_id:  companyId,
      pedido_id:   pedidoId,
      material_id: l.material_id,
      cantidad,
      fecha_inicio: fi,
      fecha_fin:    ff,
      tipo_origen:  l.tipo_origen ?? 'propio',
    }));

  if (reservas.length > 0) {
    await lsc().from('reservas_stock').insert(reservas);
  }
}

export async function cargarSubalquilerPedido(pedidoId) {
  if (!supabaseConfigurado) return [];
  const { data, error } = await lsc().from('lineas_subalquiler')
    .select('*')
    .eq('pedido_id', pedidoId)
    .order('created_at');
  if (error) return [];
  return data || [];
}

export async function guardarSubalquilerPedido(pedidoId, lineas, companyId) {
  if (!supabaseConfigurado) return;
  await lsc().from('lineas_subalquiler').delete().eq('pedido_id', pedidoId);
  if (!lineas?.length) return;
  const rows = lineas.map(l => ({
    company_id:      companyId,
    pedido_id:       pedidoId,
    material_id:     l.material_id ?? null,
    nombre_material: l.nombre_material || l.nombre || '?',
    cantidad:        Number(l.cantidad) || 0,
    cantidad_propia: Number(l.cantidad_propia) || 0,
    cantidad_sub:    Number(l.cantidad_sub) || 0,
    proveedor_id:    l.proveedor_id ?? null,
    coste_sub:       l.coste_sub != null ? Number(l.coste_sub) : null,
    coste_total_sub: l.coste_total_sub != null ? Number(l.coste_total_sub) : null,
    opcion_logistica: l.opcion_logistica ?? 'mixto',
    alerta_retorno:  Boolean(l.alerta_retorno),
    notas:           l.notas ?? null,
    estado:          l.estado ?? 'pendiente',
  }));
  await lsc().from('lineas_subalquiler').insert(rows);
}
