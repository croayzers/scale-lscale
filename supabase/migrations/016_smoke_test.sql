-- ============================================================================
-- 016_smoke_test.sql — Validación de los 3 motores del ERP (migración 016)
--
-- Cómo usar:
--   1) Pégalo en el SQL Editor de Supabase.
--   2) Ejecuta TODO. Verás NOTICEs con ✅/❌ por cada comprobación.
--   3) Al final hace ROLLBACK: NO deja datos de prueba en la base.
--      Si quieres conservarlos, cambia el ROLLBACK final por COMMIT.
--
-- Usa una company_id real (la primera que tenga lscale.empresa_config) para
-- pasar RLS/FK. No toca datos existentes salvo crear filas temporales que
-- se revierten.
-- ============================================================================
BEGIN;

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
BEGIN
  -- ── Empresa de pruebas ────────────────────────────────────────────────────
  SELECT company_id INTO v_company FROM lscale.empresa_config LIMIT 1;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'No hay ninguna empresa con L-Scale configurada (lscale.empresa_config vacía)';
  END IF;
  RAISE NOTICE 'Empresa de pruebas: %', v_company;

  -- Proveedor de pruebas
  INSERT INTO lscale.proveedores(company_id, nombre) VALUES (v_company, 'ZZ_TEST_Proveedor')
  RETURNING id INTO v_prov;

  -- ════════════════════════════════════════════════════════════════════════
  -- TEST 1 · LINE SPLITTING (6 propio + 4 alquiler)
  -- ════════════════════════════════════════════════════════════════════════
  -- Material con stock 6, correlación con el proveedor (coste 5€)
  INSERT INTO lscale.materiales(company_id, nombre, stock_actual, tipo_trazabilidad, precio_coste)
  VALUES (v_company, 'ZZ_TEST_Silla', 6, 'Consumible_PMP', 3)
  RETURNING id INTO v_mat_pmp;

  INSERT INTO lscale.correlaciones(company_id, material_id, proveedor_id, nombre_proveedor, coste)
  VALUES (v_company, v_mat_pmp, v_prov, 'Silla del proveedor', 5);

  -- Pedido evento de 1 día
  INSERT INTO lscale.pedidos(company_id, nombre, estado, tipo_pedido,
                             fecha_evento_inicio, fecha_evento_fin, fecha_entrega)
  VALUES (v_company, 'ZZ_TEST_Pedido', 'borrador', 'evento',
          CURRENT_DATE, CURRENT_DATE, CURRENT_DATE)
  RETURNING id INTO v_pedido;

  -- Petición de 10 uds → debe partir en 6 propio + 4 alquiler
  PERFORM lscale.fn_split_linea(v_pedido, v_mat_pmp, 10);

  SELECT count(*),
         COALESCE(SUM(cantidad) FILTER (WHERE origen_coste='Almacen_Propio'),0),
         COALESCE(SUM(cantidad) FILTER (WHERE origen_coste='Alquiler_Proveedor'),0)
    INTO v_lineas, v_propia, v_alquiler
  FROM lscale.lineas_pedido WHERE pedido_id = v_pedido;

  IF v_lineas = 2 AND v_propia = 6 AND v_alquiler = 4 THEN
    RAISE NOTICE '✅ TEST 1 Split: 2 líneas (6 propio + 4 alquiler). OK';
  ELSE
    RAISE WARNING '❌ TEST 1 Split: lineas=% propia=% alquiler=% (esperado 2/6/4)',
      v_lineas, v_propia, v_alquiler;
  END IF;

  -- La línea de alquiler debe llevar el proveedor (el único con correlación)
  PERFORM 1 FROM lscale.lineas_pedido
   WHERE pedido_id = v_pedido AND origen_coste='Alquiler_Proveedor' AND proveedor_id = v_prov;
  IF FOUND THEN
    RAISE NOTICE '✅ TEST 1b Proveedor asignado a la línea de alquiler. OK';
  ELSE
    RAISE WARNING '❌ TEST 1b La línea de alquiler no tiene el proveedor esperado';
  END IF;

  -- ════════════════════════════════════════════════════════════════════════
  -- TEST 2 · VALORACIÓN FIFO (lote barato primero)
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO lscale.materiales(company_id, nombre, stock_actual, tipo_trazabilidad)
  VALUES (v_company, 'ZZ_TEST_Mantel', 0, 'Lotes_FIFO')
  RETURNING id INTO v_mat_fifo;

  -- Lote 1 (más antiguo): 5 uds a 10€. Lote 2: 5 uds a 12€.
  INSERT INTO lscale.lotes(company_id, material_id, fecha_entrada, coste_unitario, cantidad_inicial, cantidad_restante)
  VALUES (v_company, v_mat_fifo, now() - interval '2 days', 10, 5, 5),
         (v_company, v_mat_fifo, now() - interval '1 day',  12, 5, 5);

  -- Salida de 3 uds → todas del lote barato → coste 30
  SELECT lscale.fn_valorar_salida(v_mat_fifo, 3) INTO v_coste;
  IF v_coste = 30 THEN
    RAISE NOTICE '✅ TEST 2 FIFO: salida 3 uds = 30€ (3×10, lote viejo). OK';
  ELSE
    RAISE WARNING '❌ TEST 2 FIFO: coste=% (esperado 30)', v_coste;
  END IF;

  -- Salida de 4 uds más → 2 del lote viejo (resto) + 2 del nuevo → 2×10 + 2×12 = 44
  SELECT lscale.fn_valorar_salida(v_mat_fifo, 4) INTO v_coste;
  IF v_coste = 44 THEN
    RAISE NOTICE '✅ TEST 2b FIFO atraviesa lotes: 4 uds = 44€ (2×10 + 2×12). OK';
  ELSE
    RAISE WARNING '❌ TEST 2b FIFO: coste=% (esperado 44)', v_coste;
  END IF;

  -- ════════════════════════════════════════════════════════════════════════
  -- TEST 3 · VALORACIÓN PMP (precio medio ponderado)
  -- ════════════════════════════════════════════════════════════════════════
  -- 10 uds a 10€ + 10 uds a 20€ → PMP = 15€. Salida de 4 → 60€.
  INSERT INTO lscale.lotes(company_id, material_id, fecha_entrada, coste_unitario, cantidad_inicial, cantidad_restante)
  VALUES (v_company, v_mat_pmp, now() - interval '2 days', 10, 10, 10),
         (v_company, v_mat_pmp, now() - interval '1 day',  20, 10, 10);

  SELECT lscale.fn_valorar_salida(v_mat_pmp, 4) INTO v_coste;
  IF v_coste = 60 THEN
    RAISE NOTICE '✅ TEST 3 PMP: salida 4 uds = 60€ (PMP 15 × 4). OK';
  ELSE
    RAISE WARNING '❌ TEST 3 PMP: coste=% (esperado 60)', v_coste;
  END IF;

  -- ════════════════════════════════════════════════════════════════════════
  -- TEST 4 · SERIALIZADO (exige nº de serie)
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO lscale.materiales(company_id, nombre, stock_actual, tipo_trazabilidad)
  VALUES (v_company, 'ZZ_TEST_Altavoz', 0, 'Serializado')
  RETURNING id INTO v_mat_serie;

  INSERT INTO lscale.unidades_serie(company_id, material_id, numero_serie, estado, coste_adquisicion)
  VALUES (v_company, v_mat_serie, 'SN-001', 'disponible', 200),
         (v_company, v_mat_serie, 'SN-002', 'disponible', 200);

  -- Salida sin serie → debe fallar
  BEGIN
    PERFORM lscale.fn_valorar_salida(v_mat_serie, 1);
    RAISE WARNING '❌ TEST 4 Serializado: NO lanzó excepción al faltar el nº de serie';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✅ TEST 4 Serializado exige nº de serie (excepción correcta). OK';
  END;

  -- Salida con serie → coste 200, unidad pasa a en_uso
  SELECT lscale.fn_valorar_salida(v_mat_serie, 1, ARRAY['SN-001']) INTO v_coste;
  SELECT count(*) INTO v_serie_disp FROM lscale.unidades_serie
    WHERE material_id = v_mat_serie AND estado = 'disponible';
  IF v_coste = 200 AND v_serie_disp = 1 THEN
    RAISE NOTICE '✅ TEST 4b Serializado: salida SN-001 = 200€, queda 1 disponible. OK';
  ELSE
    RAISE WARNING '❌ TEST 4b Serializado: coste=% disponibles=% (esperado 200 / 1)', v_coste, v_serie_disp;
  END IF;

  -- ════════════════════════════════════════════════════════════════════════
  -- TEST 5 · DISPARADOR FINANCIERO — Retorno Roto sobre línea PROPIA
  -- ════════════════════════════════════════════════════════════════════════
  SELECT id INTO v_linea_id FROM lscale.lineas_pedido
   WHERE pedido_id = v_pedido AND origen_coste='Almacen_Propio' LIMIT 1;

  INSERT INTO lscale.retornos(company_id, pedido_id, linea_pedido_id, material_id,
                              cantidad, estado_recepcion, responsable_merma, origen_coste)
  VALUES (v_company, v_pedido, v_linea_id, v_mat_pmp, 1, 'Roto', 'Cliente', 'Almacen_Propio')
  RETURNING id INTO v_ret;

  SELECT count(*) INTO v_cargos  FROM lscale.cargos_merma     WHERE retorno_id = v_ret;
  SELECT count(*) INTO v_deudas  FROM lscale.deudas_proveedor WHERE retorno_id = v_ret;
  SELECT count(*) INTO v_eventos FROM lscale.eventos_salientes WHERE tipo='merma_propia'
    AND (payload->>'retorno_id')::bigint = v_ret;

  IF v_cargos = 1 AND v_deudas = 0 AND v_eventos = 1 THEN
    RAISE NOTICE '✅ TEST 5 Retorno Roto PROPIO: 1 cargo cliente, 0 deudas, 1 evento. OK';
  ELSE
    RAISE WARNING '❌ TEST 5 PROPIO: cargos=% deudas=% eventos=% (esperado 1/0/1)',
      v_cargos, v_deudas, v_eventos;
  END IF;

  -- ════════════════════════════════════════════════════════════════════════
  -- TEST 6 · DISPARADOR FINANCIERO — Retorno Perdido sobre línea ALQUILER
  -- ════════════════════════════════════════════════════════════════════════
  SELECT id INTO v_linea_id FROM lscale.lineas_pedido
   WHERE pedido_id = v_pedido AND origen_coste='Alquiler_Proveedor' LIMIT 1;

  INSERT INTO lscale.retornos(company_id, pedido_id, linea_pedido_id, material_id,
                              cantidad, estado_recepcion, responsable_merma,
                              origen_coste, proveedor_id)
  VALUES (v_company, v_pedido, v_linea_id, v_mat_pmp, 1, 'Perdido', 'Almacen',
          'Alquiler_Proveedor', v_prov)
  RETURNING id INTO v_ret;

  SELECT count(*) INTO v_cargos  FROM lscale.cargos_merma     WHERE retorno_id = v_ret;
  SELECT count(*) INTO v_deudas  FROM lscale.deudas_proveedor WHERE retorno_id = v_ret;
  SELECT count(*) INTO v_eventos FROM lscale.eventos_salientes WHERE tipo='merma_alquiler'
    AND (payload->>'retorno_id')::bigint = v_ret;

  IF v_cargos = 1 AND v_deudas = 1 AND v_eventos = 1 THEN
    RAISE NOTICE '✅ TEST 6 Retorno Perdido ALQUILER: 1 cargo cliente + 1 deuda proveedor + 1 evento. OK';
  ELSE
    RAISE WARNING '❌ TEST 6 ALQUILER: cargos=% deudas=% eventos=% (esperado 1/1/1)',
      v_cargos, v_deudas, v_eventos;
  END IF;

  -- ════════════════════════════════════════════════════════════════════════
  -- TEST 7 · SKU inmutable
  -- ════════════════════════════════════════════════════════════════════════
  -- El material PMP recibió SKU automático (LSC-<id>). Intentar cambiarlo debe fallar.
  BEGIN
    UPDATE lscale.materiales SET sku_interno = 'OTRO-SKU' WHERE id = v_mat_pmp;
    RAISE WARNING '❌ TEST 7 SKU: permitió cambiar el SKU (debería ser inmutable)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✅ TEST 7 SKU inmutable: rechazó el cambio (excepción correcta). OK';
  END;

  PERFORM 1 FROM lscale.materiales WHERE id = v_mat_pmp AND sku_interno LIKE 'LSC-%';
  IF FOUND THEN
    RAISE NOTICE '✅ TEST 7b SKU autogenerado con formato LSC-<id>. OK';
  ELSE
    RAISE WARNING '❌ TEST 7b SKU no se autogeneró con el formato esperado';
  END IF;

  RAISE NOTICE '──────────────────────────────────────────────';
  RAISE NOTICE 'Smoke-test completado. Revisa arriba que TODO sea ✅.';
END$$;

-- No dejamos basura de prueba en la base.
-- (Cambia a COMMIT si quieres inspeccionar las filas creadas.)
ROLLBACK;
