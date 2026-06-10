/* ============================================================
   Parser de Excel para "Listado Chequeo Materiales"
   Hoja1: información de la expedición
   Hoja2: materiales agrupados por Timing y Categoría
   ============================================================ */
import * as XLSX from "xlsx";

// DD/MM/YY(YY) o YYYY-MM-DD → YYYY-MM-DD
function parseFecha(raw) {
  const s = String(raw ?? "").trim();
  // Número serial de Excel (días desde 1900)
  if (/^\d{4,6}$/.test(s)) {
    const d = XLSX.SSF.parse_date_code(Number(s));
    if (d) return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  }
  const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (!m) return s;
  const [, d, mo, y] = m;
  const yr = y.length === 2 ? `20${y}` : y;
  return `${yr}-${mo.padStart(2,"0")}-${d.padStart(2,"0")}`;
}

// HH:MM o número decimal Excel → "HH:MM"
function parseHora(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  // Formato HH:MM directo
  if (/^\d{1,2}:\d{2}$/.test(s)) return s.padStart(5, "0");
  // Número decimal Excel (fracción de día)
  const n = Number(s);
  if (!isNaN(n) && n > 0 && n < 1) {
    const totalMin = Math.round(n * 24 * 60);
    const hh = Math.floor(totalMin / 60), mm = totalMin % 60;
    return `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
  }
  return s;
}

function esEnteroPositivo(s) {
  const n = parseInt(s, 10);
  return n > 0 && String(n) === String(s).replace(/\.0+$/, "").trim();
}

/* ─── Hoja 1: datos de la expedición ─────────────────────────────────────── */
function parsearHoja1(wb) {
  const sh = wb.Sheets[wb.SheetNames[0]];
  if (!sh) return {};
  // raw: true para leer valores numéricos de fecha/hora sin formato
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: "" });
  // También leemos con raw:false para tener los valores formateados como texto
  const rowsFmt = XLSX.utils.sheet_to_json(sh, { header: 1, defval: "", raw: false });

  const r = {
    codigo:"", referencia:"", nombre:"", contacto:"",
    destino:"", fecha_entrega:"", fecha_retorno:"",
    hora_ida:"", hora_vuelta:"", hora_recollida:"", hora_recollida_fi:"",
    pax_adults: null, pax_nens: null,
  };

  let seccion = "";

  for (let ri = 0; ri < rows.length; ri++) {
    const row    = rows[ri];
    const rowFmt = rowsFmt[ri] || [];
    const cells    = row.map(c    => String(c    ?? "").trim());
    const cellsFmt = rowFmt.map(c => String(c    ?? "").trim());
    const joined   = cells.join(" ");

    // Códigos EV / OV en cualquier celda
    for (const c of cells) {
      if (/^EV\d{4,}$/.test(c)      && !r.codigo)     r.codigo     = c;
      if (/^OV[\w\-]{3,}$/.test(c)  && !r.referencia) r.referencia = c;
    }
    // Código también en cellsFmt (a veces XLSX formatea distinto)
    for (const c of cellsFmt) {
      if (/^EV\d{4,}$/.test(c)      && !r.codigo)     r.codigo     = c;
      if (/^OV[\w\-]{3,}$/.test(c)  && !r.referencia) r.referencia = c;
    }

    // PAX  (cualquier celda de la fila)
    const joinedFmt = cellsFmt.join(" ");
    const paxA = (joined + " " + joinedFmt).match(/(\d+)\s*pax\s*adult/i);
    const paxN = (joined + " " + joinedFmt).match(/(\d+)\s*pax\s*nen/i);
    if (paxA && !r.pax_adults) r.pax_adults = Number(paxA[1]);
    if (paxN && !r.pax_nens)   r.pax_nens   = Number(paxN[1]);

    // Secciones
    if (/\bENTREGA\b/i.test(joined))                       seccion = "entrega";
    if (/\b(RECOLLIDA|RECOGIDA|RETORN)\b/i.test(joined))   seccion = "recollida";

    // Etiqueta en col A/B — buscar primera celda con texto
    const lbl = (cells.find(c => c) || "").toUpperCase();

    // Primera celda con valor numérico o fecha en el resto de la fila
    const valText = cells.slice(1).find(c => c) || cellsFmt.slice(1).find(c => c) || "";
    const valFmt  = cellsFmt.slice(1).find(c => c) || "";

    // Fecha: usar valor formateado (texto) que XLSX convierte
    const fechaVal = cellsFmt.slice(1).find(c => /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(c) || /^\d{4}-\d{2}-\d{2}$/.test(c)) || valFmt;

    if (/NOM DEL CLIENT|CLIENT/.test(lbl)                  && valText) r.nombre   = valText;
    if (/PERSONA DE CONTACTE|CONTACTO/.test(lbl)           && valText) r.contacto = valText;
    if (/\bLLOC\b|\bLUGAR\b/.test(lbl)                    && valText) r.destino  = valText;

    // Fecha general del acte
    if (/DATA DE L|FECHA/.test(lbl)) {
      const fv = cellsFmt.slice(1).find(c => /\d/.test(c));
      if (fv && !r.fecha_entrega) r.fecha_entrega = parseFecha(fv);
    }

    // DIA dentro de sección
    if (/^DIA$/.test(lbl)) {
      const fv = cellsFmt.slice(1).find(c => /\d/.test(c));
      if (fv) {
        const f = parseFecha(fv);
        if (seccion === "entrega"   && !r.fecha_entrega) r.fecha_entrega = f;
        if (seccion === "recollida" && !r.fecha_retorno) r.fecha_retorno = f;
      }
    }

    // HORA DE ENTREGA (hora_ida / hora_vuelta)
    if (/HORA.*COMEN[CÇ]AR.*DESCARR/i.test(joined) || /HORA.*INICIO.*DESCARG/i.test(joined)) {
      const hv = cellsFmt.slice(1).find(c => /\d/.test(c)) || cells.slice(1).find(c => /\d/.test(c));
      if (hv) r.hora_ida = parseHora(hv);
    }
    if (/HORA.*ESTAR.*DESCARREGAT/i.test(joined) || /HORA.*FIN.*DESCARG/i.test(joined)) {
      const hv = cellsFmt.slice(1).find(c => /\d/.test(c)) || cells.slice(1).find(c => /\d/.test(c));
      if (hv) r.hora_vuelta = parseHora(hv);
    }

    // HORA DE RECOLLIDA (hora_recollida / hora_recollida_fi)
    if (/HORA.*COMEN[CÇ]AR.*RECULL/i.test(joined) || /HORA.*INICIO.*RECOG/i.test(joined)) {
      const hv = cellsFmt.slice(1).find(c => /\d/.test(c)) || cells.slice(1).find(c => /\d/.test(c));
      if (hv) r.hora_recollida = parseHora(hv);
    }
    if (/HORA.*ESTAR.*RECULLIT/i.test(joined) || /HORA.*FIN.*RECOG/i.test(joined)) {
      const hv = cellsFmt.slice(1).find(c => /\d/.test(c)) || cells.slice(1).find(c => /\d/.test(c));
      if (hv) r.hora_recollida_fi = parseHora(hv);
    }
  }

  // Si hora_recollida pero no hora_retorno del DIA, usar fecha_entrega como fallback
  // Mapeo final: hora_ida = hora comienzo descarga, hora_vuelta = hora fin recogida
  if (!r.hora_vuelta && r.hora_recollida_fi) r.hora_vuelta = r.hora_recollida_fi;
  else if (!r.hora_vuelta && r.hora_recollida) r.hora_vuelta = r.hora_recollida;

  return r;
}

/* ─── Hoja 2: materiales ─────────────────────────────────────────────────── */
// startRow: 1-indexed row to begin reading (configurable por almacén)
function parsearHoja2(wb, startRow = 6) {
  const sh = wb.Sheets[wb.SheetNames[1]];
  if (!sh) return [];
  const allRows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: "" });
  const rows = allRows.slice(Math.max(0, startRow - 1));

  const items = [];
  let currentTiming    = "";
  let currentCategoria = "";

  for (const row of rows) {
    const cells = row.map(c => String(c ?? "").trim());
    if (cells.every(c => !c)) continue;

    // Saltar marcadores especiales (<INDEFINIDO>, etc.)
    if (cells.some(c => /^<.*>$/.test(c))) continue;

    // Buscar cantidad: celda más a la derecha que sea entero positivo
    let qty = 0, qtyIdx = -1;
    for (let i = cells.length - 1; i >= 0; i--) {
      if (cells[i] && esEnteroPositivo(cells[i])) {
        qty = parseInt(cells[i], 10); qtyIdx = i; break;
      }
    }

    // Partes de texto (no vacías, no son la celda qty)
    const partes = cells
      .map((v, i) => ({ v, i }))
      .filter(({ v, i }) => v && i !== qtyIdx);

    if (!partes.length) continue;

    /* ── Cabecera de Timing: sin cantidad, texto MAYÚSCULAS centrado ───── */
    if (qty === 0) {
      const allText = partes.map(p => p.v).join(" ").trim();
      if (
        allText === allText.toUpperCase() &&
        allText.length >= 3 &&
        allText.length <= 50 &&
        partes.length <= 4
      ) {
        currentTiming = allText;
      }
      continue;
    }

    /* ── Fila de material ─────────────────────────────────────────────── */
    // Estructura detectada del Excel:
    //   Col A (idx 0): vacía O categoría (toda mayúsculas)
    //   Col B (idx 1): categoría (toda mayúsculas) O nombre del material
    //   Col C/D (idx 2+): nombre del material O comentario
    //   Última col con entero: cantidad

    let categoria  = currentCategoria;
    let nombre     = "";
    let comentario = "";

    if (partes.length === 1) {
      // Solo un texto + cantidad: es nombre
      nombre = partes[0].v;

    } else {
      // Buscar si alguna parte es categoría (todo mayúsculas, sin dígitos, ≥3 chars)
      const esCat = (s) =>
        s === s.toUpperCase() &&
        s.replace(/\s/g, "").length >= 3 &&
        !/\d/.test(s);

      const p0 = partes[0].v;
      const p1 = partes[1]?.v || "";

      if (esCat(p0)) {
        // Col A es categoría → nombre en col B, comentario en col C+
        currentCategoria = p0; categoria = p0;
        nombre    = p1;
        comentario = partes.slice(2).map(p => p.v).join(" ");
      } else if (esCat(p1) && partes[0].i === 0) {
        // Col A vacía (índice 0 no presente en partes) o col B es categoría
        // Col B categoría → nombre en col C
        currentCategoria = p1; categoria = p1;
        nombre    = partes[2]?.v || "";
        comentario = partes.slice(3).map(p => p.v).join(" ");
      } else if (!p0 || partes[0].i > 0) {
        // Col A vacía, col B es nombre
        if (esCat(p0) || esCat(p1)) {
          currentCategoria = esCat(p0) ? p0 : p1;
          categoria = currentCategoria;
          const nameIdx = esCat(p0) ? 1 : 2;
          nombre    = partes[nameIdx]?.v || "";
          comentario = partes.slice(nameIdx + 1).map(p => p.v).join(" ");
        } else {
          nombre    = p0 || p1;
          comentario = partes.slice(1).map(p => p.v).join(" ");
        }
      } else {
        // Col A tiene texto que no es categoría → es nombre
        nombre    = p0;
        comentario = partes.slice(1).map(p => p.v).join(" ");
      }
    }

    // Si nombre sigue vacío, tomar el primer texto no-categoría
    if (!nombre) {
      const nocat = partes.find(p => !/^[A-ZÁÉÍÓÚÜÑ\s]+$/.test(p.v) || p.v.length < 3);
      if (nocat) nombre = nocat.v;
    }

    if (nombre && !nombre.startsWith("<")) {
      items.push({
        timing:       currentTiming,
        categoria,
        nombre,
        comentario:   comentario.trim(),
        cantidad:     qty,
        nombre_custom: "",
      });
    }
  }

  return items;
}

/* ─── Parser "Checklist de materiales" (una sola hoja) ───────────────────── */

function parsearCabecera(rows, rowsFmt) {
  const exp = {
    nombre: "", destino: "", fecha_entrega: "", pax_adults: null,
    codigo: "", referencia: "", contacto: "", notas: "",
    hora_ida: "", hora_vuelta: "",
  };
  const buscar = (patron, arr) => {
    for (let i = 0; i < arr.length - 1; i++) {
      if (patron.test(arr[i])) {
        for (let j = i + 1; j < arr.length; j++) {
          if (arr[j]) return arr[j];
        }
      }
    }
    return null;
  };
  for (let ri = 0; ri < Math.min(12, rows.length); ri++) {
    const cells    = rows[ri].map(c    => String(c    ?? "").trim());
    const cellsFmt = rowsFmt[ri].map(c => String(c ?? "").trim());
    const fecha   = buscar(/^fecha$/i,           cellsFmt) || buscar(/^fecha$/i,           cells);
    const pax     = buscar(/^pax$/i,             cellsFmt) || buscar(/^pax$/i,             cells);
    const rest    = buscar(/restaurante/i,        cellsFmt);
    const cc      = buscar(/centro de coste/i,   cellsFmt) || buscar(/centro de coste/i,   cells);
    const menu    = buscar(/^men[uú]$/i,          cellsFmt);
    const com     = buscar(/comentario/i,         cellsFmt);
    const otros   = buscar(/^otros$/i,            cellsFmt);
    const fmenu   = buscar(/fecha\s*men[uú]/i,   cellsFmt);
    const usuario = buscar(/^usuario$/i,          cellsFmt);
    if (fecha   && !exp.fecha_entrega) exp.fecha_entrega = parseFecha(fecha);
    if (pax     && !exp.pax_adults)    exp.pax_adults    = parseInt(pax, 10) || null;
    if (rest    && !exp.nombre)        exp.nombre        = rest;
    if (cc      && !exp.destino)       exp.destino       = cc;
    if (menu    && !exp.referencia)    exp.referencia    = menu;
    if (com     && !exp.notas)         exp.notas         = com;
    if (otros   && !exp.hora_ida)      exp.hora_ida      = parseHora(otros);
    if (fmenu   && !exp.fecha_retorno) exp.fecha_retorno = parseFecha(fmenu);
    if (usuario && !exp.contacto)      exp.contacto      = usuario;
  }
  return exp;
}

// Detectar fila de cabecera de tabla (contiene "Grupo" y "Productos")
function detectarHeaderIdx(rows) {
  for (let ri = 8; ri < Math.min(18, rows.length); ri++) {
    const cells = rows[ri].map(c => String(c ?? "").trim().toLowerCase());
    if (cells.some(c => c === "grupo") && cells.some(c => c === "productos" || c === "producto")) {
      return ri;
    }
  }
  return 12; // fallback fila 13
}

// Extraer todas las columnas con nombre de la fila de cabecera
// Devuelve array de { idx, label } incluyendo las que tienen nombre aunque estén vacías en datos
function extraerColumnas(rows, headerIdx) {
  const cells = rows[headerIdx]?.map(c => String(c ?? "").trim()) || [];
  return cells
    .map((label, idx) => ({ idx, label }))
    .filter(({ label }) => label !== "");
}

// Convertir cantidad raw según el separador decimal elegido por el usuario
// decimalSep "," → formato europeo (1.000,50): el punto es miles, la coma es decimal
// decimalSep "." → formato anglosajón (1,000.50): la coma es miles, el punto es decimal
function parseCantidad(raw, decimalSep = ",") {
  if (raw === "" || raw == null) return 0;
  const s = String(raw).replace(/\s/g, "");
  let n;
  if (decimalSep === ",") {
    // Quitar puntos de miles, sustituir coma decimal por punto
    n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  } else {
    // Quitar comas de miles, dejar punto decimal
    n = parseFloat(s.replace(/,/g, ""));
  }
  if (isNaN(n) || n <= 0) return 0;
  return Math.round(n);
}

// Extraer preview de filas de datos (desde headerIdx+1, máx 12 filas no vacías)
export function checklistPreview(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb      = XLSX.read(e.target.result, { type: "array", cellDates: true });
        const sh      = wb.Sheets[wb.SheetNames[0]];
        const rows    = XLSX.utils.sheet_to_json(sh, { header: 1, defval: "" });
        const rowsFmt = XLSX.utils.sheet_to_json(sh, { header: 1, defval: "", raw: false });

        const headerIdx = detectarHeaderIdx(rows);
        const columnas  = extraerColumnas(rows, headerIdx);

        // Normalizar todas las filas al mismo ancho (máx columna con nombre)
        const maxCol = columnas.length ? columnas[columnas.length - 1].idx + 1 : 10;
        const pad    = (r) => { const a = [...r]; while (a.length < maxCol) a.push(""); return a; };

        // Filas de datos: hasta 15 no-vacías después del header
        const previewRows = [];
        for (let ri = headerIdx + 1; ri < rows.length && previewRows.length < 15; ri++) {
          const cells    = pad(rows[ri]).map(c    => String(c    ?? "").trim());
          const cellsFmt = pad(rowsFmt[ri] || []).map(c => String(c ?? "").trim());
          if (cells.every(c => !c)) continue;
          // Usar valor formateado para números (cantidades)
          const merged = columnas.map(({ idx }) => cellsFmt[idx] || cells[idx] || "");
          previewRows.push(merged);
        }

        const expedicion = parsearCabecera(rows, rowsFmt);
        resolve({ columnas, previewRows, headerIdx, expedicion });
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// Parser final con columnas elegidas por el usuario
// colNombre: idx de columna del nombre del material
// colCantidad: idx de columna de la cantidad
// colGrupo: idx de columna del grupo/timing (opcional)
// colCategoria: idx de columna de la categoría/familia (opcional)
function parsearChecklistConCols(wb, { colNombre, colCantidad, colGrupo = -1, colCategoria = -1, decimalSep = "," }) {
  const sh      = wb.Sheets[wb.SheetNames[0]];
  const rows    = XLSX.utils.sheet_to_json(sh, { header: 1, defval: "" });
  const rowsFmt = XLSX.utils.sheet_to_json(sh, { header: 1, defval: "", raw: false });

  const expedicion = parsearCabecera(rows, rowsFmt);
  const headerIdx  = detectarHeaderIdx(rows);

  const items = [];
  let currentGrupo = "";
  let currentCat   = "";

  for (let ri = headerIdx + 1; ri < rows.length; ri++) {
    const cells    = rows[ri].map(c    => String(c    ?? "").trim());
    const cellsFmt = rowsFmt[ri]?.map(c => String(c ?? "").trim()) || [];
    if (cells.every(c => !c)) continue;

    const grupo    = colGrupo    >= 0 ? (cells[colGrupo]    || "") : "";
    const cat      = colCategoria >= 0 ? (cells[colCategoria] || "") : "";
    const nombre   = cells[colNombre]  || "";
    const cantRaw  = cellsFmt[colCantidad] || cells[colCantidad] || "";

    if (grupo) currentGrupo = grupo;
    if (cat)   currentCat   = cat;

    const cantidad = parseCantidad(cantRaw, decimalSep);
    if (!nombre || cantidad === 0) continue;

    items.push({
      timing:        currentGrupo,
      categoria:     currentCat || currentGrupo || "",
      nombre,
      comentario:    "",
      cantidad,
      nombre_custom: "",
    });
  }

  return { expedicion, materiales: items };
}

function parsearChecklist(wb, colMapping) {
  return parsearChecklistConCols(wb, colMapping);
}

/* ─── Export ─────────────────────────────────────────────────────────────── */

// parser: "hoja1hoja2" (default) | "checklist"
// colMapping (solo checklist): { colNombre, colCantidad, colGrupo, colCategoria }
export function parsearExcelPedido(file, { startRow = 6, parser = "hoja1hoja2", colMapping = null } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array", cellDates: true });
        if (parser === "checklist") {
          resolve(parsearChecklist(wb, colMapping || {}));
        } else {
          resolve({ expedicion: parsearHoja1(wb), materiales: parsearHoja2(wb, startRow) });
        }
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
