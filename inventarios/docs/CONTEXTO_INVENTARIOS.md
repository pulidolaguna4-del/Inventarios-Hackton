# CONTEXTO — Sistema de Inventarios · Hackatón Logístico SENA 2026

> Contexto corto para el desarrollo del sistema de inventarios. El Arduino se trabajará después y tendrá su propio contexto. El caso completo está en `CONTEXTO_HACKATON_2026.md`.

## Qué hay que construir

Un sistema web local para la **bodega satélite de Arauca** (empresa *Distribuciones Centauros*) que:

1. **Genera la lista de picking optimizada**: toma un lote de pedidos, consolida los SKU y los ordena para que el recorrido sea el más corto posible. Se puede visitar **máximo 3 ubicaciones por recorrido**, y recoger en **nivel 2 tarda 3 veces** lo que tarda en nivel 1.
2. **Genera el plan de conteo cíclico**: elige las referencias **de forma aleatoria** cada semana, garantizando que **cada referencia se cuente al menos 5 veces al año**.
3. **Muestra el estado de los pedidos** (visibilidad en tiempo real).
4. **Registra los conteos** hechos y las diferencias encontradas.

## Reglas obligatorias

- **Solo se puede usar el software que ya está instalado en el PC** (si no, el equipo queda descalificado). Por eso se usa solo la librería estándar de Python, sin `pip install` ni librerías por CDN.
- Las entregas van en Google Drive, en una carpeta `Día<N>_Ejercicio<N>`, y los archivos llevan ese mismo nombre.
- También se califica el código: legible, con funciones claras y comentado en español.

## Stack decidido

| Capa | Tecnología |
|---|---|
| Lógica | **Python 3**, solo librería estándar: `csv`, `json`, `random`, `datetime`, `http.server`, `itertools`, `openpyxl` (solo si ya está instalado) |
| Servidor | `http.server` de Python. Se ejecuta `python servidor.py` y se abre `http://localhost:8000` |
| Interfaz | Página web local: `index.html` + `app.js` + `estilos.css`, en HTML/CSS/JS puro y sin frameworks |
| Datos | Archivos **CSV/JSON** en la carpeta `datos/` (se pueden abrir en Excel para la entrega) |

### Estructura sugerida

```
inventarios/
├── servidor.py          # http.server + rutas /api/...
├── picking.py           # consolidar y ordenar la ruta de picking
├── conteo.py            # plan de conteo cíclico aleatorio
├── bodega.py            # layout de Arauca: posiciones → coordenadas
├── datos/               # maestro.csv, pedidos.csv, estados.json, conteos.csv
└── static/              # index.html, app.js, estilos.css
```

### API

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/picking` | Lista de despacho ordenada, dividida en recorridos (JSON) |
| GET | `/api/conteo?semana=N` | Referencias que se cuentan en la semana N |
| GET | `/api/pedidos` | Pedidos con su estado actual |
| POST | `/api/pedido/estado` | Cambia el estado de un pedido |
| POST | `/api/conteo/registro` | Guarda un conteo hecho |

## Pantallas

- **Mapa de la bodega**: un cuadro por cada posición del layout. Amarillo = nivel 1, rojo = nivel 2, naranja = ambos niveles. Encima se dibuja la ruta de cada recorrido.
- **Lista de despacho** en una tabla: orden, recorrido, ubicación, nivel, SKU, descripción, cantidad, distancia y tiempo estimado.
- **Pedidos**: estado de cada pedido y botones para avanzarlo.
- **Conteo cíclico**: tabla semana por semana y un formulario para registrar cada conteo.

### Estados de un pedido

`Pendiente` → `En alistamiento` → `Alistado` → **(botón manual)** `En entrega` → `Entregado`

Cada cambio se guarda con fecha y hora en `estados.json`.

### Registro de conteo

Se guardan estos campos: `fecha`, `responsable`, `semana`, `SKU`, `ubicación`, `cantidad_sistema`, `cantidad_contada`, `diferencia`. Si la diferencia es distinta de 0, se marca en rojo.

## Datos reales (`DATA_FINAL_ENTREGAR2026.xlsx`)

**Hoja `DATA VENTAS`**: ventas de 2018 con 19.357 líneas, 7.974 órdenes y **112 referencias**. Los encabezados están en la **fila 3**.

| Columna | Uso |
|---|---|
| `No. de orden` | Agrupa las líneas de un mismo pedido |
| `Fecha` | 02/01/2018 – 28/12/2018 |
| `Codigo de la referencia` | **SKU** (ej. 400016) |
| `Descripción de la referencia` | Nombre del producto |
| `Cantidad por referencia` | Cantidad |
| `Empresa` | Cliente: C1, C2 o C3 |
| `Ciudad` | Arauca (4.959 líneas, 107 referencias), Yopal, San Jose, Villavicencio |
| `Calegoria` | ⚠️ Todas las filas dicen `#REF!`, así que no sirve |
| `Valor unitario mcia` | Algunas celdas están vacías |

**Hoja `PRODUCTOS A INCLUIR`**: las **11 referencias nuevas**, con demanda mensual de enero a diciembre. Los encabezados están en la fila 4 y algunos meses están vacíos (se toman como 0).

**La categoría se deduce del primer dígito del SKU** (sale de las referencias nuevas):
`1xxxxx` = Aire acondicionado · `2xxxxx` = Equipos de audio · `3xxxxx` = Equipos de cómputo · `4xxxxx` = Refrigeración.

**Total de referencias: 112 + 11 = 123.** El caso dice 197, pero los datos traen 112. Se usan los datos.

### ⚠️ El Excel no trae ubicaciones

No existe un maestro con `SKU → Ubicación`, así que **el sistema tiene que generarlo**:

1. Calcular la **popularidad** de cada SKU en Arauca (número de líneas o veces que se pidió) y sumar las 11 nuevas con su demanda proyectada.
2. Hacer una clasificación **ABC**: las referencias A van en las posiciones más cercanas a las SALIDAS y en nivel 1.
3. Guardar el resultado en `datos/maestro.csv` con las columnas `SKU, descripcion, categoria, clase_abc, ubicacion, nivel`.

## Layout de Arauca (resumen)

Siete columnas por nueve filas, con posiciones numeradas del 1 al 61. Hay dos SALIDAS abajo (izquierda y derecha). Cada posición mide 2,4 m de largo, los pasillos 1 m y hay 5 m desde la última fila hasta las salidas. El picking se hace a nivel de suelo y se toma de ambos lados del pasillo.

⚠️ En el plano, las posiciones **22** y **35** están repetidas. Hay que definir una corrección y documentarla.

**Pedido de prueba (Tarea 6):** las posiciones 4, 25 y 60 son de ambos niveles (naranja), las 7, 21 y 55 de nivel 1 (amarillo) y las 49, 44 y 41 de nivel 2 (rojo). Son 9 ubicaciones, así que salen **3 recorridos de 3**.

## Algoritmos

**Picking**
1. Convertir cada posición a (x, y) en metros, según el pasillo por el que se accede.
2. Calcular la distancia Manhattan por los pasillos (para cambiar de pasillo hay que pasar por el cabezal de arriba o de abajo).
3. Formar grupos de 3 ubicaciones. Como son pocas, se pueden probar **todas las combinaciones** con `itertools` y quedarse con la de menor tiempo total.
4. Dentro de cada recorrido, ordenar por pasillo y luego por fila (en serpentina) y salir por la SALIDA más cercana.
5. Tiempo total = distancia ÷ velocidad + recogida (nivel 1 = 1T, nivel 2 = 3T, ambos = 4T).

**Conteo cíclico** (indicaciones del equipo)
- Las referencias salen del Excel: **123** (112 de ventas + 11 nuevas). Cada referencia se cuenta **5 veces al año** (mínimo y máximo) y se escogen **aleatoriamente** cada semana.
- 123 × 5 = 615 conteos ÷ 52 semanas → **43 semanas de 12 y 9 de 11**. El tamaño de la semana se calcula, no se escribe fijo en el código. El equipo había calculado 57 por semana para 600 referencias, y eso tampoco alcanzaba: lo exacto serían 36 semanas de 58 y 16 de 57.
- Cada semana se hace `random.sample` entre las referencias **con menos conteos**: primero todas las que llevan 0, luego las que llevan 1, y así. Sigue siendo aleatorio y asegura que nadie se queda sin completar sus conteos al final del año (ya se probó en simulación: las 600 terminan con exactamente 5).
- El sistema muestra cuáles referencias ya se contaron y cuántas veces. **Cuando una referencia llega a 5, sale de la lista** de elegibles.
- Usar `random.seed(...)` para poder reproducir el plan en la sustentación. Al final se verifica que todas tengan 5 conteos.
- Los valores son parámetros: el total de referencias se calcula de los datos, `CONTEOS_POR_ANIO = 5` y `SEMANAS_ANIO = 52`.
- El detalle técnico para el desarrollo está en `CLAUDE.md`.

## Convenciones de código

- Nombres en español con snake_case: `cargar_ventas()`, `calcular_popularidad()`, `asignar_ubicaciones()`, `ordenar_ruta()`, `generar_plan_conteo()`.
- Constantes en MAYÚSCULAS: `CAPACIDAD_RECORRIDO = 3`, `FACTOR_NIVEL_2 = 3`, `CONTEOS_MINIMOS = 5`.
- Docstrings y comentarios en español, porque hay que sustentar la lógica.
- Validar los datos de entrada: celdas vacías, `#REF!`, SKU que no existen y cantidades ≤ 0.

## Pendientes por confirmar

- [ ] Verificar que Python esté instalado en el PC (y la versión) y si `openpyxl` viene incluido. Si no, exportar las hojas a CSV desde Excel.
- [ ] Definir la codificación de ubicaciones (Tarea 3, con el equipo de logística). Propuesta: `P<pasillo>-C<columna>-F<fila>-N<nivel>`.
- [ ] Definir la corrección de las posiciones 22 y 35 repetidas.
- [x] Referencias: se usan las del Excel (123).
- [x] Pedidos: hay tres fuentes. La prueba de la Tarea 6 (la que se evalúa), los lotes reales de Arauca por fecha y los pedidos manuales.
