-- ============================================================================
-- 016_smoke_test_tabla.sql — Validación de los 3 motores del ERP (migración 016)
-- Versión que DEVUELVE FILAS (no NOTICEs): se ve en cualquier editor SQL.
--
-- Cómo usar:
--   1) Pégalo entero en el SQL Editor de Supabase y ejecuta.
--   2) Verás una tabla: cada fila es un test con OK/FALLO + esperado/obtenido.
--   3) Crea datos temporales con prefijo ZZ_TEST y los BORRA al final (no usa
--      ROLLBACK para que la tabla de resultados sea visible).
--
-- Si alguna fila dice 'FALLO', pégame esa fila.
-- ============================================================================

DROP TABLE IF EXISTS _smoke_resultados;
CREATE TEMP TABLE _smoke_resultados (
  n int, test text, resultado text, esperado text, obtenido text
);

-- Helper para registrar cada test (compatible con PG 15 de Supabase).
CREATE OR REPLACE FUNCTION pg_temp._chk(p_n int, p_test text, p_ok boolean, p_esp text, p_obt text)
RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
  INSERT INTO _smoke_resultados VALUES
    (p_n, p_test, CASE WHEN p_ok THEN '✅ OK' ELSE '❌ FALLO' END, p_esp, p_obt);
END $f$;

DO $$
DECLARE
  v_company   uuid;
  v_prov      bigint;
  v_mat_fifo  bigint;
  v_mat_pmp   bigint;
  v_mat_serie bigint;
  v_pedido    bigint;
  v_lineas    int;
  v_propia    numeric;
  v_alquiler  numeric;
  v_coste     numeric;
  v_ret       bigint;
  v_cargos    int;
  v_deudas    int;
  v_eventos   int;
  v_linea_id  bigint;
  v_serie_disp int;
  v_ok        boolean;
BEGIN
  -- ── Empresa de pruebas ────────────────────────────────────────────────────
  SELECT company_id INTO v_company FROM lscale.empresa_config LIMIT 1;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'No hay ninguna empresa con L-Scale configurada (lscale.empresa_config vacía)';
  END IF;

  INSERT INTO lscale.proveedores(company_id, nombre) VALUES (v_company, 'ZZ_TEST_Proveedor')
  RETURNING id INTO v_prov;

  -- ── TEST 1 · LINE SPLITTING ───────────────────────────────────────────────
  INSERT INTO lscale.materiales(company_id, nombre, stock_actual, tipo_trazabilidad, precio_coste)
  VALUES (v_company, 'ZZ_TEST_Silla', 6, 'Consumible_PMP', 3) RETURNING id INTO v_mat_pmp;
  INSERT INTO lscale.correlaciones(company_id, material_id, proveedor_id, nombre_proveedor, coste)
  VALUES (v_company, v_mat_pmp, v_prov, 'Silla del proveedor', 5);
  INSERT INTO lscale.pedidos(company_id, nombre, estado, tipo_pedido,
                             fecha_evento_inicio, fecha_evento_fin, fecha_entrega)
  VALUES (v_company, 'ZZ_TEST_Pedido', 'borrador', 'evento', CURRENT_DATE, CURRENT_DATE, CURRENT_DATE)
  RETURNING id INTO v_pedido;

  PERFORM lscale.fn_split_linea(v_pedido, v_mat_pmp, 10);
  SELECT count(*),
         COALESCE(SUM(cantidad) FILTER (WHERE origen_coste='Almacen_Propio'),0),
         COALESCE(SUM(cantidad) FILTER (WHERE origen_coste='Alquiler_Proveedor'),0)
    INTO v_lineas, v_propia, v_alquiler
  FROM lscale.lineas_pedido WHERE pedido_id = v_pedido;
  PERFORM pg_temp._chk(1, 'Split 10 = 6 propio + 4 alquiler',
    (v_lineas=2 AND v_propia=6 AND v_alquiler=4),
    '2 líneas / 6 / 4', format('%s líneas / %s / %s', v_lineas, v_propia, v_alquiler));

  SELECT EXISTS(SELECT 1 FROM lscale.lineas_pedido
    WHERE pedido_id=v_pedido AND origen_coste='Alquiler_Proveedor' AND proveedor_id=v_prov)
    INTO v_ok;
  PERFORM pg_temp._chk(2, 'Proveedor asignado a línea de alquiler', v_ok, 'proveedor = test', v_ok::text);

  -- ── TEST 2 · FIFO ─────────────────────────────────────────────────────────
  INSERT INTO lscale.materiales(company_id, nombre, stock_actual, tipo_trazabilidad)
  VALUES (v_company, 'ZZ_TEST_Mantel', 0, 'Lotes_FIFO') RETURNING id INTO v_mat_fifo;
  INSERT INTO lscale.lotes(company_id, material_id, fecha_entrada, coste_unitario, cantidad_inicial, cantidad_restante)
  VALUES (v_company, v_mat_fifo, now()-interval '2 days', 10, 5, 5),
         (v_company, v_mat_fifo, now()-interval '1 day',  12, 5, 5);

  SELECT lscale.fn_valorar_salida(v_mat_fifo, 3) INTO v_coste;
  PERFORM pg_temp._chk(3, 'FIFO salida 3 (lote barato)', (v_coste=30), '30', v_coste::text);
  SELECT lscale.fn_valorar_salida(v_mat_fifo, 4) INTO v_coste;
  PERFORM pg_temp._chk(4, 'FIFO salida 4 (atraviesa lotes)', (v_coste=44), '44', v_coste::text);

  -- ── TEST 3 · PMP ──────────────────────────────────────────────────────────
  INSERT INTO lscale.lotes(company_id, material_id, fecha_entrada, coste_unitario, cantidad_inicial, cantidad_restante)
  VALUES (v_company, v_mat_pmp, now()-interval '2 days', 10, 10, 10),
         (v_company, v_mat_pmp, now()-interval '1 day',  20, 10, 10);
  SELECT lscale.fn_valorar_salida(v_mat_pmp, 4) INTO v_coste;
  PERFORM pg_temp._chk(5, 'PMP salida 4 (medio 15)', (v_coste=60), '60', v_coste::text);

  -- ── TEST 4 · SERIALIZADO ──────────────────────────────────────────────────
  INSERT INTO lscale.materiales(company_id, nombre, stock_actual, tipo_trazabilidad)
  VALUES (v_company, 'ZZ_TEST_Altavoz', 0, 'Serializado') RETURNING id INTO v_mat_serie;
  INSERT INTO lscale.unidades_serie(company_id, material_id, numero_serie, estado, coste_adquisicion)
  VALUES (v_company, v_mat_serie, 'SN-001', 'disponible', 200),
         (v_company, v_mat_serie, 'SN-002', 'disponible', 200);

  v_ok := false;
  BEGIN
    PERFORM lscale.fn_valorar_salida(v_mat_serie, 1);  -- sin serie → debe fallar
  EXCEPTION WHEN OTHERS THEN v_ok := true;
  END;
  PERFORM pg_temp._chk(6, 'Serializado exige nº de serie', v_ok, 'excepción', CASE WHEN v_ok THEN 'lanzó excepción' ELSE 'no falló' END);

  SELECT lscale.fn_valorar_salida(v_mat_serie, 1, ARRAY['SN-001']) INTO v_coste;
  SELECT count(*) INTO v_serie_disp FROM lscale.unidades_serie
    WHERE material_id=v_mat_serie AND estado='disponible';
  PERFORM pg_temp._chk(7, 'Serializado salida SN-001', (v_coste=200 AND v_serie_disp=1),
    'coste 200 / 1 disp', format('coste %s / %s disp', v_coste, v_serie_disp));

  -- ── TEST 5 · Disparador Roto PROPIO ───────────────────────────────────────
  SELECT id INTO v_linea_id FROM lscale.lineas_pedido
   WHERE pedido_id=v_pedido AND origen_coste='Almacen_Propio' LIMIT 1;
  INSERT INTO lscale.retornos(company_id, pedido_id, linea_pedido_id, material_id,
                              cantidad, estado_recepcion, responsable_merma, origen_coste)
  VALUES (v_company, v_pedido, v_linea_id, v_mat_pmp, 1, 'Roto', 'Cliente', 'Almacen_Propio')
  RETURNING id INTO v_ret;
  SELECT count(*) INTO v_cargos  FROM lscale.cargos_merma     WHERE retorno_id=v_ret;
  SELECT count(*) INTO v_deudas  FROM lscale.deudas_proveedor WHERE retorno_id=v_ret;
  SELECT count(*) INTO v_eventos FROM lscale.eventos_salientes
    WHERE tipo='merma_propia' AND (payload->>'retorno_id')::bigint=v_ret;
  PERFORM pg_temp._chk(8, 'Retorno Roto PROPIO → cargo cliente',
    (v_cargos=1 AND v_deudas=0 AND v_eventos=1),
    'cargo 1 / deuda 0 / evento 1', format('cargo %s / deuda %s / evento %s', v_cargos, v_deudas, v_eventos));

  -- ── TEST 6 · Disparador Perdido ALQUILER ──────────────────────────────────
  SELECT id INTO v_linea_id FROM lscale.lineas_pedido
   WHERE pedido_id=v_pedido AND origen_coste='Alquiler_Proveedor' LIMIT 1;
  INSERT INTO lscale.retornos(company_id, pedido_id, linea_pedido_id, material_id,
                              cantidad, estado_recepcion, responsable_merma, origen_coste, proveedor_id)
  VALUES (v_company, v_pedido, v_linea_id, v_mat_pmp, 1, 'Perdido', 'Almacen', 'Alquiler_Proveedor', v_prov)
  RETURNING id INTO v_ret;
  SELECT count(*) INTO v_cargos  FROM lscale.cargos_merma     WHERE retorno_id=v_ret;
  SELECT count(*) INTO v_deudas  FROM lscale.deudas_proveedor WHERE retorno_id=v_ret;
  SELECT count(*) INTO v_eventos FROM lscale.eventos_salientes
    WHERE tipo='merma_alquiler' AND (payload->>'retorno_id')::bigint=v_ret;
  PERFORM pg_temp._chk(9, 'Retorno Perdido ALQUILER → cargo + deuda',
    (v_cargos=1 AND v_deudas=1 AND v_eventos=1),
    'cargo 1 / deuda 1 / evento 1', format('cargo %s / deuda %s / evento %s', v_cargos, v_deudas, v_eventos));

  -- ── TEST 7 · SKU inmutable ────────────────────────────────────────────────
  v_ok := false;
  BEGIN
    UPDATE lscale.materiales SET sku_interno='OTRO-SKU' WHERE id=v_mat_pmp;
  EXCEPTION WHEN OTHERS THEN v_ok := true;
  END;
  PERFORM pg_temp._chk(10, 'SKU inmutable', v_ok, 'excepción', CASE WHEN v_ok THEN 'rechazó cambio' ELSE 'permitió cambio' END);

  SELECT EXISTS(SELECT 1 FROM lscale.materiales WHERE id=v_mat_pmp AND sku_interno LIKE 'LSC-%') INTO v_ok;
  PERFORM pg_temp._chk(11, 'SKU autogenerado LSC-<id>', v_ok, 'LSC-<id>', v_ok::text);

  -- ── Limpieza (todo lleva prefijo ZZ_TEST o FK a ellos) ────────────────────
  DELETE FROM lscale.retornos      WHERE pedido_id = v_pedido;  -- cargos/deudas/eventos caen por FK SET NULL → borrar manual abajo
  DELETE FROM lscale.cargos_merma     WHERE pedido_id = v_pedido;
  DELETE FROM lscale.deudas_proveedor WHERE proveedor_id = v_prov;
  DELETE FROM lscale.eventos_salientes WHERE company_id = v_company
    AND tipo IN ('merma_propia','merma_alquiler')
    AND (payload->>'pedido_id')::bigint = v_pedido;
  DELETE FROM lscale.lineas_pedido WHERE pedido_id = v_pedido;
  DELETE FROM lscale.lotes WHERE material_id IN (v_mat_pmp, v_mat_fifo);
  DELETE FROM lscale.unidades_serie WHERE material_id = v_mat_serie;
  DELETE FROM lscale.correlaciones WHERE proveedor_id = v_prov;
  DELETE FROM lscale.pedidos WHERE id = v_pedido;
  DELETE FROM lscale.materiales WHERE id IN (v_mat_pmp, v_mat_fifo, v_mat_serie);
  DELETE FROM lscale.proveedores WHERE id = v_prov;
END$$;

-- Resultado visible (tabla de filas):
SELECT n AS "#", test AS "Test", resultado AS "Resultado",
       esperado AS "Esperado", obtenido AS "Obtenido"
FROM _smoke_resultados ORDER BY n;
