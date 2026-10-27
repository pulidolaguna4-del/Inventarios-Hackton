# CLAUDE.md — Sistema de Inventarios (Hackatón Logístico SENA 2026)

## Qué es este proyecto

Es el backend en Python y un frontend básico de pruebas para la bodega satélite de **Arauca** de *Distribuciones Centauros* (caso de la hackatón). Tiene dos funciones que se califican:

1. **Picking optimizado**: toma un lote de pedidos y genera una lista de despacho consolidada y ordenada que minimiza la distancia y el tiempo del operario.
2. **Conteo cíclico**: cada semana elige referencias **al azar**, de modo que **cada referencia se cuente exactamente 5 veces al año**. Cuando una referencia llega a 5, sale de la lista.

Además, para dar visibilidad, muestra el **estado de los pedidos** y lleva el **registro de los conteos**.

La prioridad es **el backend y un frontend sencillo que sirva para probar todo**. El diseño visual viene después.

**Alcance actual: el inventario.** La optimización de recorridos de picking **queda pospuesta**. El código que ya existe en `app/picking.py` se conserva, pero no se sigue desarrollando por ahora. Del picking solo se muestra, **de forma informativa**, cuánto tarda cada trayecto y cuál es el más demorado (`es_el_mas_demorado` en cada recorrido y `recorrido_mas_demorado` en los totales).

## Reglas que no se negocian

- **Python 3.8+ y solo la librería estándar.** No usar `pip install`, Flask, pandas ni openpyxl. En la competencia solo se puede usar el software que ya está instalado en el PC, y si no se cumple el equipo queda descalificado.
- **Frontend en React + TypeScript + Vite** (carpeta `../jules_session_..._frontend-control-inventarios-.../`). El equipo confirmó con los organizadores que usar un framework está permitido. Se compila con `npm run build`, que deja el resultado en `inventarios/static/`, y lo sirve `servidor.py`, así que en la competencia no hace falta Node para ejecutarlo. **El backend sigue siendo solo librería estándar de Python.**
- No modificar el Excel original `datos/DATA_FINAL_ENTREGAR2026.xlsx`.
- Los archivos que se entregan se nombran `Día<N>_Ejercicio<N>` (ej. `Día2_Ejercicio6.csv`) y van en `salidas/`.
- Todo el código se escribe en **español**: nombres en `snake_case`, docstrings y comentarios. Las constantes van en MAYÚSCULAS dentro de `app/config.py`. Los jurados califican que el código sea legible y que las funciones sean claras.
- No escribir con Python 3.10+: nada de `match` ni de tipos `X | Y`.

## Comandos

```bash
python servidor.py                 # levanta http://localhost:8000 (API + frontend compilado)
python -m unittest discover tests  # corre todas las pruebas del backend
python -m app.conteo               # (opcional) genera el plan de conteo por consola

# En la carpeta del frontend (React):
npm run dev     # desarrollo en http://localhost:5173; las llamadas /api van a localhost:8000
npm test        # pruebas del cliente de la API (Vitest)
npm run lint    # oxlint
npm run build   # compila hacia inventarios/static/ (borra lo que haya ahí)
```

Después de cada cambio hay que correr las pruebas. **Después de cambiar el frontend hay que correr `npm run build`**, o el servidor seguirá mostrando la versión anterior.

## Estructura

```
inventarios/
├── CLAUDE.md
├── servidor.py          # http.server (ThreadingHTTPServer): rutas /api/* y archivos de static/
├── app/
│   ├── config.py        # constantes: medidas, velocidades, tiempos, semilla, rutas de archivos
│   ├── excel.py         # lector de .xlsx con zipfile + xml.etree (librería estándar)
│   ├── datos.py         # carga y limpieza de ventas y productos nuevos; persistencia JSON/CSV
│   ├── bodega.py        # layout de Arauca: posición → coordenadas y distancia entre puntos
│   ├── maestro.py       # popularidad, clasificación ABC y asignación SKU → ubicación
│   ├── picking.py       # consolidar el lote, agrupar de a 3 y ordenar la ruta
│   ├── pedidos.py       # estados de los pedidos e historial
│   └── conteo.py        # plan anual aleatorio, registro de conteos y progreso
├── static/              # frontend React COMPILADO (lo genera npm run build; no editar a mano)
├── static_pruebas/      # página sencilla HTML/JS de pruebas, en http://localhost:8000/pruebas/
├── datos/               # Excel original + JSON generados (maestro, estados, plan, registros)
├── salidas/             # exportaciones CSV para entregar
├── tests/               # unittest: test_excel, test_bodega, test_picking, test_conteo
└── docs/                # contexto y documentos del caso (solo lectura)
```

## Documentos de referencia (`docs/`)

Hay que consultarlos cuando haga falta un detalle del caso. Para buscar, usar las versiones `.txt`, que se leen más rápido que el PDF o el DOCX.

| Archivo | Contenido |
|---|---|
| `docs/referencia/HACKATON_2026_V3.txt` (y `.pdf`) | Caso completo: empresa, costos, layout, desafío de software y criterios de evaluación |
| `docs/referencia/REGLAMENTO_HACKATON_2026.txt` (y `.docx`) | Reglamento: reglas, tareas por día y forma de entrega |
| `docs/referencia/layout_arauca.png` | Plano de la bodega de Arauca con medidas (Gráfica 8) |
| `docs/referencia/layout_tarea6.png` | Pedido de la Tarea 6 con colores por nivel (Gráfica 9) |
| `docs/referencia/indicaciones_equipo_conteo.jpg` | Indicaciones del equipo sobre el conteo cíclico |
| `docs/CONTEXTO_HACKATON_2026.md` | Resumen de toda la hackatón, incluido el Arduino |
| `docs/CONTEXTO_INVENTARIOS.md` | Resumen funcional del sistema de inventarios |

Si algo de estos documentos contradice este CLAUDE.md, **este archivo manda**: aquí ya están las decisiones tomadas.

**Separación de responsabilidades:** los módulos de `app/` son funciones puras que se pueden probar, y no saben nada de HTTP. `servidor.py` solo recibe la petición, llama a `app/` y responde en JSON. Para guardar archivos se escribe primero a un temporal y luego se usa `os.replace`.

## Datos: `datos/DATA_FINAL_ENTREGAR2026.xlsx`

Se lee con `app/excel.py`, usando `zipfile` y `xml.etree` (sin openpyxl). El lector tiene que manejar:
- `xl/sharedStrings.xml`: celdas con `t="s"`.
- `xl/workbook.xml` y sus rels, para encontrar cada hoja por su nombre.
- Fechas guardadas como número serial de Excel: `datetime(1899, 12, 30) + timedelta(days=n)`.
- Errores con `t="e"` (como `#REF!`), que se convierten en `None`.
- Códigos guardados como float (`400016.0`), que se pasan a `int`.

**Hoja `DATA VENTAS`**: título en la fila 1, **encabezados en la fila 3** y datos desde la fila 4 (19.357 líneas de 2018).

| Columna Excel | Campo interno | Notas |
|---|---|---|
| No. de orden | `id_pedido` | 7.974 órdenes en total; **3.245 de Arauca** |
| Fecha | `fecha` | 02/01/2018–28/12/2018. Arauca tiene 247 días, ~13 órdenes por día |
| Codigo de la referencia | `sku` | **112 referencias únicas** |
| Descripción de la referencia | `descripcion` | 1:1 con el SKU |
| Cantidad por referencia | `cantidad` | 1–3.600 (solo 3 líneas pasan de 2.500, ninguna de Arauca) |
| Empresa | `cliente` | C1, C2 o C3 |
| Ciudad | `ciudad` | Arauca, Yopal, San Jose, Villavicencio |
| Calegoria | — | **Todas las filas dicen `#REF!`; se ignora** |
| Valor unitario mcia | `valor_unitario` | A veces viene vacío o con `' '` |

Las órdenes tienen en promedio 1,5 líneas y como máximo 13.

**Hoja `PRODUCTOS A INCLUIR`**: encabezados en la **fila 4** y datos en las filas 5 a 15. Son **11 referencias nuevas** (`CODIGO, DESCRIPCIÓN, CATEGORIA, ENERO…DICIEMBRE`) que no se cruzan con las de ventas. Los meses vacíos se toman como 0.

**La categoría se saca del primer dígito del SKU**: `1` = Aire acondicionado, `2` = Equipos de audio, `3` = Equipos de cómputo, `4` = Refrigeración.

**Universo de referencias = 112 + 11 = 123.** Nunca se escribe fijo en el código: se calcula a partir de los datos (`len(maestro)`).

## Bodega de Arauca (`app/bodega.py`)

El layout tiene 7 columnas de racks y 9 filas (fila 1 arriba, fila 9 abajo). Las **SALIDAS** están abajo. Cada número es una posición del plano:

```
         C1  C2  C3    C4  C5    C6  C7
Fila 1   18  17  19    20  52    51  53
Fila 2   16  15  22    21  50    49  54
Fila 3   14  13  23    22  48    47  55
Fila 4   12  11  25    24  46    45  56
Fila 5   10   9  27    26  44    43  57
Fila 6    8   7  29    28  42    41  58
Fila 7    6   5  31    30  40    39  59
Fila 8    4   3  33    32  38    37  60
Fila 9    1   2  35    34  35    36  61
      [SALIDA IZQ]          [SALIDA DER]
```

- **Duplicados en el plano:** el `22` está en C3-F2 y en C4-F3, y el `35` en C3-F9 y en C5-F9. Por eso internamente **una ubicación se identifica por (columna, fila, nivel), no por el número del plano**. El número se guarda solo como etiqueta. Las 9 posiciones de la Tarea 6 no tienen duplicados.
- **Código de ubicación** (propuesta para la Tarea 3; se ajusta con el equipo de logística): `C<col>-F<fila 2 dígitos>-N<nivel>`, por ejemplo `C3-F04-N2`.
- **Niveles:** el picking usa los niveles 1 y 2. Son 63 celdas × 2 niveles = 126 huecos, que alcanzan para las 123 referencias.

### Modelo de coordenadas (en metros; todo ajustable en `config.py`)

- Racks de 1 m de fondo, pasillos de 1 m, celdas de 2,4 m de largo, 2 m libres arriba y 5 m de zona abierta abajo, frente a las salidas.
- Cada columna se recoge desde **un pasillo**. Coordenada x del centro de cada pasillo:
  - C1 y C2 → **2,5**
  - C3 y C4 → **5,6**
  - C5 y C6 → **8,7**
  - C7 → **11,8** (pasillo junto a la pared derecha)
  - *Supuesto:* C1 se recoge desde el pasillo de C2.
- Coordenada y de la fila `f`: `5 + (9 - f) * 2.4 + 1.2`. La fila 9 queda en 6,2 y la fila 1 en 25,4.
- Cabeceras para cruzar entre pasillos: la inferior en **y = 2,5** y la superior en **y = 27,6**.
- Salidas: **IZQ (2,0; 0)** y **DER (10,3; 0)**.
- **Distancia:**
  - Si los dos puntos están en el mismo pasillo: `|y1 - y2|`.
  - Si alguno de los dos puntos está en la zona abierta (y ≤ 5): distancia Manhattan directa.
  - En cualquier otro caso: el mínimo entre pasar por la cabecera inferior y pasar por la superior, `|y1 - yc| + |x1 - x2| + |y2 - yc|`.

## Picking (`app/picking.py`)

> **Estado: pospuesto.** Ya están hechos la consolidación, el reparto exacto, la heurística y la lista de despacho. No se agregan más funciones de recorridos hasta que el equipo lo decida. Lo único que se usa por ahora es el dato informativo del trayecto más demorado.
>
> Decisión abierta para cuando se retome: con `MINIMO_DE_RECORRIDOS = True` (por defecto) la Tarea 6 da 3 recorridos y 174,4 m. Con `False` se permiten recorridos de menos de 3 ubicaciones y da 4 recorridos y 164,8 m.
>
> Supuestos de tiempo (el caso no los da): `VELOCIDAD_OPERARIO = 1.0` m/s y `TIEMPO_RECOGIDA_NIVEL_1 = 20` s.

**Reglas del caso:**
- **Máximo 3 ubicaciones por recorrido** (`CAPACIDAD_RECORRIDO = 3`).
- Tiempo de recogida: nivel 1 = `T`, nivel 2 = `3T` (`FACTOR_NIVEL_2 = 3`) y ambos niveles = `4T`.
- **Cada recorrido sale y vuelve por la misma salida** (`MISMA_SALIDA = True`).
- Tiempo total = distancia / `VELOCIDAD_OPERARIO` + suma de los tiempos de recogida.
- Como el tiempo de recogida es fijo para cada ubicación, **no cambia cuál es la mejor ruta**; solo suma al tiempo total. Hay que explicarlo así en la sustentación.

**Flujo:**
1. **Consolidar el lote:** agrupar por SKU, sumar las cantidades y guardar de qué pedidos sale cada SKU.
2. **Buscar la ubicación** de cada SKU en el maestro y armar la lista de ubicaciones a visitar, con su nivel.
3. **Formar los grupos de 3:**
   - **Exacto si hay ≤ 12 ubicaciones:** se prueban todas las particiones en grupos de 3 (son 280 para 9 ubicaciones). Para cada grupo se prueban las 6 permutaciones y las 2 salidas, y se elige el mínimo total.
   - **Heurística si hay > 12:** se ordena por zona (altura de la fila) y por pasillo en serpentina, se corta en bloques de 3 y luego se mejora con intercambios entre grupos mientras la distancia baje.
4. **Salida:** la lista de despacho con `recorrido, orden, codigo_ubicacion, numero_plano, nivel, sku, descripcion, cantidad, pedidos, distancia_acum_m, tiempo_s`, más los totales.

**Fuentes de pedidos** (las dos usan el mismo algoritmo):
- **`prueba` — Tarea 6 (Gráfica 9), que es lo que evalúan los jurados.** Son 9 ubicaciones fijas sin SKU:
  - Ambos niveles: **4, 25, 60**
  - Nivel 1: **7, 21, 55**
  - Nivel 2: **49, 44, 41**
- **`lote` — órdenes reales de Arauca del Excel**, para probar con datos de verdad. El lote se elige por **fecha** (≈ 13 órdenes) o por una lista de `id_pedido`.
- **`manual`**: un pedido armado desde el frontend para pruebas puntuales.

**Resultado de referencia** de la prueba con los valores por defecto: 3 recorridos y **≈ 174,4 m**. Los grupos óptimos son {4, 7, 60}, {25, 21, 55} y {49, 44, 41}, todos por la salida DER. Si se cambian las constantes de la bodega, este valor cambia y hay que actualizar la prueba.

## Maestro de ubicaciones (`app/maestro.py`)

- **Popularidad** = cantidad de líneas de pedido por SKU en Arauca. Las 5 referencias que nunca se vendieron en Arauca quedan con 0.
- **Referencias nuevas (criterio):** `líneas equivalentes = demanda anual proyectada × (líneas de Arauca ÷ unidades de Arauca)`. El factor es ≈ 0,0427 líneas por unidad. Se asume que la proyección corresponde a Arauca.
- **Clasificación ABC** por popularidad acumulada: A hasta el 80 %, B hasta el 95 % y C el resto. La referencia que cruza el umbral queda en la clase de arriba. Resultado: **42 A, 36 B y 45 C**.
- **Asignación:** con `PRIORIZAR_NIVEL_1 = True` (por defecto) se llenan primero los 63 huecos de nivel 1 y después los de nivel 2, cada grupo de más cerca a más lejos de la salida más cercana. Se justifica porque el caso dice que el picking es "a nivel de suelo" y el nivel 2 tarda el triple. Con `False` se ordena solo por distancia. Los SKU más populares van a los primeros huecos y quedan 3 huecos libres.
- Si el equipo de logística entrega su propio `datos/maestro_logistica.csv` (Tarea 1), **ese archivo manda** sobre lo que se genera. Lleva las columnas `sku` y `codigo_ubicacion`, y opcionalmente `clase_abc`, separadas por `;` o `,`. Los SKU que no vengan en ese archivo se ubican en los huecos libres.
- Se guarda en `datos/maestro.json` como `{"generado", "fuente", "criterios", "conteo_por_clase", "referencias": [...]}`. Cada referencia lleva `sku, descripcion, categoria, es_nueva, popularidad, origen_popularidad, clase_abc, porcentaje_acumulado, codigo_ubicacion, columna, fila, nivel, numero_plano, distancia_salida_m, fuente_ubicacion`.
- El conteo cíclico toma sus referencias del maestro (`_referencias_actuales()` en `servidor.py`), así que los registros ya llevan `codigo_ubicacion`.

## Conteo cíclico (`app/conteo.py`)

- `N` = número de referencias del maestro (123). Total de conteos = `N * CONTEOS_POR_ANIO` (5) = 615. Las semanas son `SEMANAS_ANIO = 52`.
- **Tamaño de cada semana:** `base, extra = divmod(total, 52)`. Las primeras `extra` semanas llevan `base + 1` y las demás `base`. Con 123 referencias salen **43 semanas de 12 y 9 de 11**. El número nunca se escribe fijo: el equipo había calculado 57 por semana para 600 referencias, y eso no alcanzaba, porque lo exacto con 600 serían 36 semanas de 58 y 16 de 57.
- **Selección:** cada semana se hace `random.sample` entre las referencias **elegibles** (las que llevan menos de 5), empezando por las que tienen **menos conteos**. Así sigue siendo aleatorio y se garantiza que todas terminen con exactamente 5.
- Se usa `random.seed(SEMILLA_CONTEO)` para poder reproducir el plan en la sustentación.
- El plan anual se guarda en `datos/plan_conteo.json`. El registro real va en `datos/registros_conteo.json` con `fecha, responsable, semana, sku, codigo_ubicacion, cantidad_sistema, cantidad_contada, diferencia`.
- **Progreso por SKU:** se muestra `contada X/5`. Con 5 sale de la lista; si la diferencia es distinta de 0, se marca.
- **Verificación obligatoria** (también va en las pruebas): todas las referencias con 5 conteos, ninguna repetida dentro de la misma semana y la suma de los tamaños semanales igual al total.
- `cantidad_sistema`: como el caso no trae stock, es **editable** en el registro. Si no se digita, se usa `stock_simulado(sku)`, un valor reproducible (siempre el mismo para el mismo SKU) entre `STOCK_SIMULADO_MINIMO` y `STOCK_SIMULADO_MAXIMO`.
- **Universo de referencias:** sale del maestro (`datos/maestro.json`), así que cada referencia trae su `codigo_ubicacion`.
- Un registro se rechaza (400) si la referencia no está programada en esa semana, si ya se registró esa semana o si ya completó sus 5 conteos.
- **Regenerar el plan** con conteos ya registrados devuelve 409. Con `"forzar": true`, los registros se respaldan en `registros_conteo_respaldo_<fecha_hora>.json` y se empieza de cero.
- Semilla por defecto 2026: 43 semanas de 12 y 9 de 11, y la verificación da OK.

## Pedidos (`app/pedidos.py`)

Estados en orden:

`Pendiente` → `En alistamiento` → `Alistado` → `En entrega` → `Entregado`

- Los dos últimos se cambian **a mano con un botón**. Como el picking está pospuesto, por ahora **todos** los avances se hacen a mano con el mismo botón.
- Solo se permite avanzar al estado siguiente; cualquier otra transición devuelve error 400. Un pedido que no es de Arauca da 404.
- Un pedido sin cambios registrados está `Pendiente`.
- Cada cambio se guarda en `datos/estados_pedidos.json` con su `fecha_hora`. El formato es `{"<id_pedido>": {"estado", "historial": [{"estado", "fecha_hora"}]}}`.
- `GET /api/pedidos` acepta `fecha` (sin ella usa la primera fecha con pedidos) y un `estado` opcional para filtrar. Devuelve `conteo_por_estado` del día.

## API (`servidor.py`)

Todas las respuestas son JSON. Los errores se devuelven como `{"error": "mensaje"}` con el código HTTP que corresponda.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/resumen` | Totales: referencias, órdenes de Arauca, fechas disponibles |
| GET | `/api/maestro` | Maestro de ubicaciones |
| POST | `/api/maestro/generar` | Recalcula el ABC y las ubicaciones |
| GET | `/api/picking/prueba` | Lista de despacho de la Tarea 6 |
| POST | `/api/picking` | `{"fecha":"2018-03-05"}`, `{"pedidos":[...]}` o `{"manual":[{"sku":..,"cantidad":..}]}` |
| GET | `/api/pedidos?fecha=AAAA-MM-DD` | Pedidos con su estado |
| POST | `/api/pedidos/<id>/estado` | `{"estado":"En entrega"}` |
| POST | `/api/conteo/plan/generar` | `{"semilla":2026, "forzar":false}`: regenera el plan anual (409 si ya hay conteos y no se fuerza) |
| GET | `/api/conteo/semana/<n>` | Referencias de la semana n, con su progreso |
| POST | `/api/conteo/registro` | Registra un conteo |
| GET | `/api/conteo/progreso` | Conteos por SKU y verificación anual |
| GET | `/api/exportar/<tipo>?nombre=Día2_Ejercicio6` | Guarda el CSV en `salidas/` y lo descarga. Tipos: `maestro`, `conteo` (opcional `&semana=N`), `registros_conteo`, `pedidos` (`&fecha=`), `picking` |

**Nombres de entrega por defecto** (según el reglamento): maestro (Tarea 1) → `Día2_Ejercicio1`, picking (Tarea 6) → `Día2_Ejercicio6`, plan de conteo (Tarea 8) → `Día2_Ejercicio8`. Las Tareas 6 y 8 son del "Día 2 y 3"; hay que confirmar el día con el equipo. El servidor solo exige que el nombre tenga letras, números, `_` o `-`, porque los registros y los pedidos no son entregables.

## Frontend React (carpeta `jules_session_..._frontend-control-inventarios-...`)

- `src/services/api.ts`: el único lugar que llama al backend; `src/types/inventario.ts` refleja el JSON tal cual (campos en español, snake_case).
- Páginas (`src/pages/`): Dashboard, Referencias (maestro + historial por SKU), PlanConteo (cuadrícula de 52 semanas, lista de la semana, regenerar con semilla y manejo del 409), RegistroConteos (formulario con diferencia en vivo), Pedidos (avanzar estado, detalle e historial), Picking (informativo) y Reportes (cumplimiento, historial y exportaciones).
- Rutas sin extensión (`/pedidos`, `/plan-conteo`, …) las devuelve `servidor.py` como `index.html` para que las maneje React Router.
- El mock original (112 referencias falsas, "máx. 57 por semana", selector de año, estado "Cancelado") se eliminó: las reglas las manda el backend.
- Rutas de API agregadas para el frontend: `GET /api/conteo/registros?sku=&semana=` y, en `/api/conteo/progreso`, los campos `avance_semanal`, `cumplimiento_a_la_fecha` y `semilla`.

## Página sencilla de pruebas (`static_pruebas/`, en `/pruebas/`)

Es una sola página con pestañas y llama a la API con `fetch`. Debe ser funcional, no bonita:
- **Datos:** el resumen, la tabla del maestro (filtro por clase, búsqueda) y el botón "Recalcular maestro".
- **Conteo cíclico:** tarjetas de avance, verificación del plan, la lista de la semana (por defecto la semana actual) con el registro en cada fila, el progreso X/5 (con opción de ocultar las que ya salieron de la lista) y "Regenerar plan" con semilla.
- **Pedidos:** selector de fecha y de estado, conteo por estado y botón "Avanzar a: <siguiente>".
- **Picking (informativo):** solo los trayectos de la Tarea 6 con su tiempo y el más demorado resaltado. *Pendiente para cuando se retome:* lote por fecha, pedido manual y el mapa de 7×9.
- Cada tabla tiene un botón "Exportar CSV", que pide el nombre del archivo.

## Orden de trabajo sugerido

1. ✅ `excel.py` y `datos.py`, más `/api/resumen` y sus pruebas.
2. ✅ `bodega.py` (coordenadas y distancia) y sus pruebas.
3. ⏸️ `picking.py`: base hecha; los recorridos quedan **pospuestos**. Solo se muestra el trayecto más demorado como dato informativo.
4. ✅ `conteo.py` (plan, verificación y registro). **Es lo segundo más importante para la nota.**
5. ✅ `maestro.py` (ABC y asignación).
6. ✅ `pedidos.py` (estados).
7. ✅ El frontend de pruebas y las exportaciones.

## Pendientes

- [ ] Confirmar la versión de Python que hay en el PC de la competencia.
- [ ] Ajustar el código de ubicaciones con la propuesta del equipo de logística (Tarea 3).
- [ ] Recibir el maestro ABC de logística (Tarea 1), si lo entregan.
- [ ] Validar con el plano que las medidas y las posiciones de las salidas sean correctas.
