# Guía — Cómo funciona L-Scale como ERP logístico

> Esta guía explica la **lógica de negocio** de L-Scale para que cualquiera del equipo
> entienda qué hace la app por dentro: inventario híbrido (propio vs. alquilado),
> control de mermas y separación de márgenes.
> Dos niveles: primero para el **equipo de almacén/eventos** (lenguaje llano), luego un
> **anexo técnico** para el administrador.

---

## Parte 0 · Elige cuánta gestión necesitas (Modo de gestión)

**No todas las empresas necesitan todo.** Antes de nada, en **Configuración → Modo de gestión**
eliges el nivel que encaja con tu negocio. Puedes empezar simple y activar más cuando quieras;
nada se pierde al cambiar de nivel.

| Nivel | Para quién | Qué ves |
|-------|-----------|---------|
| **Operativo** | Solo organizas pedidos (la contabilidad la llevas en otro sitio) | Stock, pedidos, reparto propio/alquiler y retornos. **Sin** importes ni datos financieros. |
| **Contabilidad básica** | Quieres controlar coste, margen y roturas | Lo anterior **+** coste y margen en pedidos, registro de roturas/pérdidas (cargos al cliente, deudas a proveedor) y la pestaña **Finanzas**. |
| **Avanzada** | Gestionas activos de valor y quieres trazabilidad fina | Lo anterior **+** lotes (FIFO), precio medio, números de serie y amortización. |

### Ajuste por categoría (la parte potente)

¿Tienes **material caro mezclado con material simple**? No hace falta subir todo. En la misma
pantalla puedes **subir el nivel solo a una categoría**:

> Ejemplo real: un organizador audiovisual pone el nivel general en **Básica**, pero la categoría
> **"Audiovisual"** (altavoces, mezcladores) la sube a **Avanzada** para controlar sus números de
> serie y amortización. Los cables y consumibles se quedan en Básica, sin lotes ni series.

Regla simple: una categoría **solo puede subir** por encima del nivel general, nunca bajar
(las opciones por debajo aparecen atenuadas: "heredado del nivel general").

**Qué pasa al cambiar de nivel:** subir muestra más campos; bajar los **oculta pero no borra** nada.
Si vuelves a subir, tus datos siguen ahí. Lo que sigue activo **siempre**, en cualquier nivel:
el reparto propio/alquiler de los pedidos y los estados de retorno (Apto/Roto/Perdido…) — eso es
gestión logística, no contabilidad.

---

## Parte 1 · Para ti (equipo de almacén / eventos)

> Nota: lo de abajo describe **todas** las funciones. Según tu *Modo de gestión*, algunas no
> aparecerán (p. ej. en Operativo no verás lotes, amortización ni importes). Es normal y esperado.

### 1. Cada material tiene un "tipo de control"

Al crear un material eliges **cómo se controla su stock**. Es lo único que tienes que decidir;
después la app hace los cálculos sola.

| Tipo | Cuándo usarlo | Ejemplo | Qué hace la app |
|------|---------------|---------|-----------------|
| **Consumible (precio medio)** | Fungibles que se mezclan y se gastan | Servilletas, hielo, velas | Trabaja con un **precio medio** de lo que tienes |
| **Por lotes (FIFO)** | Cosas que compras en tandas a precios distintos | Manteles, vajilla, copas | Saca **primero lo más antiguo** que compraste |
| **Serializado** | Equipos caros y únicos, con número | Mesa de mezclas, foco, altavoz | Controla **cada unidad** por su número de serie |

> *FIFO = "primero en entrar, primero en salir". Sirve para que el coste que se imputa a un
> evento sea el del material más viejo, que es el que conviene dar salida antes.*

### 2. Cada material tiene un SKU que NO cambia

El **SKU interno** es el código único del material. Si lo dejas vacío al crearlo, la app le
pone uno automático. Una vez creado **no se puede modificar**: así los históricos, las
estadísticas y la contabilidad siempre cuadran aunque cambies el nombre.

### 3. Pedidos: lo tuyo y lo alquilado se separan solos

Cuando metes **"10 sillas"** en un pedido y solo tienes **6 libres** para esas fechas, la app
**parte la línea en dos automáticamente**:

```
Petición:  10 × Silla Thonet
   │
   ├── 6 uds  ▸ ALMACÉN PROPIO     (salen de tu stock; cuestan su amortización)
   └── 4 uds  ▸ ALQUILER PROVEEDOR  (las pone un proveedor; cuestan su tarifa)
```

- Lo ves con una **etiqueta de color** en cada línea: *Propio* o *Alquiler*.
- El **proveedor lo elige la app sola**: tu proveedor principal si tiene ese material; si no,
  el **más barato** de los que lo tengan en catálogo.
- Si **nadie** lo tiene en catálogo, esa línea queda en **"pendiente de proveedor"** para que
  lo asignes tú a mano.

**Por qué importa:** de un vistazo sabes qué parte del pedido es **margen tuyo** (activo propio)
y qué parte es **gasto de alquiler**.

### 4. "Libre" se calcula POR FECHAS, no por stock total

Disponible significa **disponible en las fechas de ese evento**. Si una silla ya está reservada
para otra boda ese fin de semana, **no cuenta como libre** aunque esté físicamente en el almacén.
Así nunca prometes algo que ya tienes comprometido en otro evento que se solapa.

### 5. Retorno: cada cosa que vuelve tiene un estado

Al cerrar un pedido (pestaña **Retorno / Cierre**) marcas, línea a línea, **cómo vuelve** cada cosa:

| Estado | Significado | ¿Vuelve al stock? |
|--------|-------------|-------------------|
| **Apto** | Perfecto | ✅ Sí |
| **Cuarentena** | Hay que revisarlo/limpiarlo antes | ⏸ No hasta revisar |
| **Roto** | Dañado | ❌ No (es merma) |
| **Perdido** | No ha vuelto | ❌ No (es merma) |

Si marcas **Roto** o **Perdido**, la app te pide además **de quién es la culpa**:
**Cliente**, **Proveedor** o **Almacén**.

### 6. Qué pasa al marcar Roto o Perdido (automático)

Tú solo marcas el estado. Lo demás lo anota la app sola:

- **Si era material tuyo (propio):**
  1. Genera un **cargo al cliente** por el valor del activo (para incluirlo en su factura).
  2. **Da de baja** esa unidad de tu inventario.
- **Si era alquilado:**
  1. **Registra una deuda con tu proveedor** (lo que le debes por el daño).
  2. Genera **igualmente el cargo al cliente**.

En ambos casos se **avisa** al responsable. No tienes que calcular importes ni acordarte de
nada: queda todo registrado.

---

## Parte 2 · Anexo técnico (administrador de la empresa)

### Valoración de salidas de stock

| Tipo de control | Cómo calcula el coste de una salida |
|-----------------|-------------------------------------|
| **FIFO** | Descuenta de los lotes más antiguos; coste = Σ(uds × coste de cada lote consumido) |
| **PMP** (precio medio ponderado) | `PMP = Σ(restante × coste) / Σ(restante)` sobre los lotes con existencias; coste = uds × PMP |
| **Serializado** | Exige el nº de serie; coste = coste de adquisición de esa unidad concreta. Si falta el nº de serie, la operación se rechaza |

### Coste propio vs. alquiler en un pedido

- **Propio:** `coste_amortización_diario × días del evento`
  (donde `coste_amortización_diario = coste_adquisición ÷ días_de_amortización`).
- **Alquiler:** `tarifa_del_proveedor × unidades`.
- **Margen del pedido** = precio de venta − coste total (lo muestra la barra inferior del pedido).

### Estados internos

- **Línea de pedido:** `planificada → confirmada → retornada`.
  Una línea de alquiler sin proveedor queda en `pendiente_proveedor`.
- **Unidad serializada:** `disponible → en_uso → (cuarentena | roto | perdido | baja)`.

### Registro financiero

- `cargos_merma` — lo que se factura al **cliente** por roturas/pérdidas.
- `deudas_proveedor` — lo que la empresa **debe a un proveedor** por material alquilado dañado.
- **No es facturación fiscal**: es el registro contable interno que alimenta los exports y los avisos.
- Los avisos salen por el Worker central de notificaciones (**Scale_Notifications**), drenados
  desde una cola de eventos (`eventos_salientes`).

### Estadios de gestión (cómo se implementan)

- El nivel se guarda en `empresa_config.datos_json.gestion = { nivel, categorias }`
  (`nivel` ∈ `operativo|basica|avanzada`; `categorias` = overrides por categoría).
- Nivel efectivo de un material = **`max(nivel_global, nivel_categoría)`** (la categoría solo sube).
  Lógica centralizada en `src/lib/gestion.js`: `nivelMaterial()`, `caps(nivel) → {finanzas, avanzado}`.
- **No hay migración SQL para esto**: el backend (016) está siempre disponible; el nivel solo decide
  qué muestra la UI y si se registran los cargos/deudas. Bajar de nivel **oculta, no borra**.
- Capacidades por nivel: `finanzas` (≥ básica) habilita coste/margen, pestaña Finanzas y los
  disparadores de merma; `avanzado` (= avanzada) habilita lotes/series/amortización y `tipo_trazabilidad`.
- El **line-splitting** y los **estados de retorno** no dependen del nivel: son Estadio 1 (operativo).

### Multi-empresa y seguridad

Todo está aislado por empresa mediante RLS (Row Level Security): cada empresa solo ve y modifica
sus propios datos. Los motores de cálculo (split, valoración, disparadores de retorno) corren
como funciones y triggers **dentro de la base de datos**, de forma atómica y segura.

---

*Documento de referencia funcional de L-Scale. Para el detalle de tablas y SQL, ver la migración
`supabase/migrations/016_erp_trazabilidad_financiero.sql`.*
