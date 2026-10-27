# CONTEXTO — II Hackatón Logístico SENA · Feria LOGEX 2026

> Archivo de contexto para las conversaciones de la hackatón. Fuentes: `REGLAMENTO_HACKATON_2026.docx` y `HACKATON_2026_V3.pdf` (caso de análisis).
> Organiza: SENA – Centro de Gestión de Mercados, Logística y Tecnologías de la Información.
> Inicio: martes 27 de octubre de 2026 (Día 1).

Somos el **equipo de software / teleinformática**. Tenemos **dos proyectos**:

1. **Sistema de inventarios**: optimización de picking + conteo cíclico (software básico).
2. **Robot Arduino**: ensamblar, programar desplazamientos y ejecutar en la maqueta la ruta de picking que genere el sistema.

---

## 0. Reglas que NO se pueden romper

- **Solo se puede usar el software que ya está instalado en el equipo.** Si se usa otro, el equipo queda **descalificado**. Antes de proponer una librería, herramienta o instalación, hay que confirmar que ya está en el PC.
  - La regla del reglamento es **general**: aplica a todo lo que se haga en el PC de la competencia, no solo al Arduino. Las dos viñetas siguientes son nuestra forma de aplicarla. **Pendiente**: preguntar a los jurados si se permite instalar librerías de Arduino o paquetes de Python.
  - Python: usar solo la **librería estándar** (`csv`, `random`, `math`, `datetime`, `json`), salvo que se confirme que hay otras instaladas.
  - Arduino: solo el **Arduino IDE** y las librerías que ya traiga (p. ej. `Servo`). Nada de instalar librerías nuevas.
- **Entregas por Google Drive**: una carpeta por ejercicio con el nombre `Día<N>_Ejercicio<N>` (ej.: `Día2_Ejercicio6`). Los archivos de adentro (código, Excel, Word, PPT) también llevan ese nombre. **Si el nombre no sigue la estructura, no se califica.**
- Si un ejercicio requiere cálculos, se recomienda dejarlos también en Excel con el mismo nombre.
- No hay orientación sobre el orden de las tareas: las tareas se entregan cada mañana.

---

## 1. La empresa (caso)

- **Distribuciones Centauros**, en Villavicencio. Vende productos eléctricos y electrónicos: aire acondicionado, refrigeración, cómputo y audio.
- Portafolio actual: **197 referencias** (49 de aire acondicionado, 60 de audio, 50 de cómputo, 38 de refrigeración) **+ 11 nuevas = 208 referencias**.
- CEDI en Villavicencio y tres satélites: **Yopal (S1), San José del Guaviare (S2) y Arauca (S3)**.
- **El piloto del sistema se hace en la bodega satélite de Arauca.**
- Problema actual: el picking se hace con listas en papel y sin orden (recorridos largos), el conteo cíclico se hace en papel (hay referencias que nunca se cuentan) y no hay visibilidad en tiempo real.
- Unidad de despacho: canastilla de 60×40×50 cm, unas 20 referencias y 15 kg por canastilla. Unidad de almacenamiento: pallet de 1×1,2 m, unas 15 unidades por pallet. Racks porta-pallet de 6 m de alto, vigas de 2,4 m y 1 m de profundidad.
- Política de inventario: máximo 20 días de inventario por categoría. Nivel de servicio del 90 %.

### Datos de entrada (los entregan en CSV/Excel)

| Archivo | Campos |
|---|---|
| Maestro de inventario | `SKU` (ej. 100001), `Ubicación` (ej. `A1-03`, `B2-15` o número consecutivo de posición) |
| Órdenes de pedido | `ID Pedido`, `SKU`, `Cantidad Requerida` |
| Ubicaciones para conteo cíclico | `Ubicación` |

> Todavía **no tenemos los CSV reales**. Cuando lleguen, ajustar los nombres de columnas en el código.

---

## 2. PROYECTO 1 — Sistema de inventarios (picking + conteo cíclico)

### Objetivo mínimo (dos funciones)

1. **Optimización de picking**: recibir un lote de órdenes y generar una **lista de picking consolidada y ordenada** que minimice la distancia o el tiempo del operario, agrupando los SKU por ubicación física en una secuencia lógica (ej.: A1→A5, luego B1→B5; por cuadrante y luego por pasillo).
2. **Conteo cíclico**: generar la **lista semanal de referencias a contar**, con **selección aleatoria**, garantizando que **cada referencia se cuente al menos 5 veces al año**.

### Layout de la bodega de Arauca (Gráfica 8)

Siete columnas de posiciones, nueve filas (de arriba hacia abajo). Las **SALIDAS** están abajo, a la izquierda y a la derecha.

```
        Col1  Col2 Col3   Col4 Col5   Col6 Col7
Fila1    18    17   19     20   52     51   53
Fila2    16    15   22     21   50     49   54
Fila3    14    13   23     22*  48     47   55
Fila4    12    11   25     24   46     45   56
Fila5    10     9   27     26   44     43   57
Fila6     8     7   29     28   42     41   58
Fila7     6     5   31     30   40     39   59
Fila8     4     3   33     32   38     37   60
Fila9     1     2   35     34   35*  36   61
        [SALIDA]                    [SALIDA]
```

- Racks: Col1 (sencillo) · Col2+Col3 (doble, espalda con espalda) · Col4+Col5 (doble) · Col6+Col7 (doble).
- Pasillos entre Col1|Col2, Col3|Col4 y Col5|Col6. **El picking se hace a nivel de suelo y el auxiliar puede tomar de ambos lados del pasillo.**
- Medidas que se leen en el plano: cada posición mide **2,4 m** de largo; pasillo de **1 m**; rack doble de **2,1 m** de ancho; **2 m** libres arriba y **5 m** desde la última fila hasta las salidas.
- ⚠️ **Errores del plano original**: el **22** aparece dos veces (Col3-F2 y Col4-F3) y el **35** también (Col3-F9 y Col5-F9). Hay que decidir una corrección (p. ej. Col4-F3 = 23 y Col5-F9 = 36) y documentarla en la entrega.
- Método de almacenamiento propuesto: **aleatorio** (un producto puede estar en varias posiciones), así que se necesita un **sistema de codificación de ubicaciones** tipo WMS. Formato sugerido: `Pasillo-Rack-Posición-Nivel`, por ejemplo `P2-R3-F04-N1`.

### Pedido a alistar (Gráfica 9 — Tarea 6)

| Color | Significado | Posiciones |
|---|---|---|
| 🟧 Naranja | Recoger en **dos niveles** (1 y 2) | **4, 25, 60** |
| 🟨 Amarillo | Recoger en **nivel 1** | **7, 21, 55** |
| 🟥 Rojo | Recoger en **nivel 2** | **49, 44, 41** |

**Restricciones del picking:**
- El equipo (operario o robot) **solo puede visitar 3 ubicaciones por recorrido**. Con 9 ubicaciones salen **3 recorridos**, cada uno sale de una SALIDA y vuelve a ella.
- **Recoger en nivel 2 tarda 3 veces lo que tarda en nivel 1** (naranja = 1 + 3 = 4 unidades de tiempo; amarillo = 1; rojo = 3).
- Función objetivo: **tiempo total = tiempo de recorrido (distancia ÷ velocidad) + tiempo de recogida**.

**Enfoque sugerido para el algoritmo:**
1. Pasar cada posición a coordenadas (x, y) en metros, usando el pasillo desde el que se accede.
2. Calcular la distancia entre puntos con métrica Manhattan sobre los pasillos (para cambiar de pasillo hay que salir por el cabezal de arriba o de abajo).
3. Agrupar las ubicaciones en lotes de 3 (por cuadrante o pasillo; o, como son pocas, probar **todas las combinaciones** y quedarse con la mejor).
4. Ordenar cada lote por pasillo y luego por fila (recorrido en S / serpentina) y escoger la salida más cercana.
5. Salida: una **lista de despacho** con orden, ubicación, nivel, SKU, cantidad, distancia acumulada y tiempo estimado. Además, la **secuencia de movimientos** para el robot (Proyecto 2).

### Conteo cíclico (Tarea 8)

- Total de referencias: **208**. Mínimo de conteos: 208 × 5 = **1.040 conteos al año**.
- Propuesta: **5 ciclos al año**. En cada ciclo se barajan aleatoriamente las 208 referencias (`random.shuffle`) y se reparten en **10 semanas de unas 21 referencias**. Así salen 5 conteos por referencia en 50 semanas y quedan 2 semanas de holgura.
- Como cada ciclo usa selección aleatoria **sin repetición**, se garantiza el mínimo de 5 conteos, que es lo que se evalúa: "selección completamente aleatoria y cumple con el número de conteos".
- Usar una **semilla** (`random.seed`) para poder reproducir el resultado en la sustentación.
- Salida: un CSV o Excel con las columnas `Semana`, `Ciclo`, `SKU`, `Ubicación` y una verificación final de conteos por SKU (todos ≥ 5).

### Calidad del código (también se califica)

- Usar **Python** con la librería estándar (o JS si es lo que hay instalado).
- Funciones pequeñas con nombres claros en español: `cargar_ordenes()`, `consolidar_picking()`, `ordenar_ruta()`, `generar_plan_conteo()`.
- Comentarios y docstrings en español. Las constantes van en MAYÚSCULAS (`CAPACIDAD_UBICACIONES = 3`, `FACTOR_NIVEL_2 = 3`).
- Leer y escribir CSV con el módulo `csv`, validar los datos de entrada (SKU inexistente, cantidades ≤ 0) y no fijar datos a mano dentro del código.

---

## 3. PROYECTO 2 — Robot Arduino (teleinformática)

### Tareas

- **Tarea 0 (Día 1)**: ensamblar el robot con los componentes entregados y probarlo con un programa básico de desplazamiento.
  - Se evalúa: que el robot funcione y que siga las órdenes según el código.
- **Tarea 7 (Días 2–3)**: programar en el robot la lista de despacho de la Tarea 6, para que haga el recorrido de alistamiento sobre la maqueta.
  - Se evalúa: movimientos correctos y **distancias exactas**, recorrido **fluido** (sin pausas innecesarias ni movimientos erráticos) y **uso correcto de los tiempos de espera** (`delay`).

### Lineamientos de código

- Funciones de movimiento: `avanzar(cm)`, `retroceder(cm)`, `girarIzquierda()`, `girarDerecha()`, `detener()`, `recoger(nivel)`. Esta última hace una pausa de T si es nivel 1, de 3T si es nivel 2 y de 4T si es naranja (ambos niveles).
- **Calibrar** con constantes: `MS_POR_CM` (tiempo que tarda en avanzar 1 cm a cierta velocidad PWM) y `MS_GIRO_90`. Medir en la maqueta real y ajustar.
- Guardar la ruta como un **arreglo de instrucciones** (ej. `{'A', 48}, {'D', 90}, {'R', 1}`) que se recorre en `loop()`/`setup()`, para que la ruta del Proyecto 1 se pueda pegar directamente.
- Usar `delay()` solo para la recogida y para pausas cortas de estabilización; evitar esperas largas entre movimientos.
- Escalar las distancias reales de la bodega (en m) a las de la maqueta (en cm) con un factor `ESCALA`.

### Por confirmar

- Componentes del kit: placa (¿Uno/Nano?), driver de motores (¿L298N/L293D?), motores DC o paso a paso, sensores (¿seguidor de línea, ultrasonido?), alimentación.
- Medidas y escala de la maqueta, y si tiene líneas para seguir.
- Cómo se carga el código (cable USB / Arduino IDE instalado en el PC).

---

## 4. Cronograma

| Día | Logística (compañeros) | Software / Teleinformática (nosotros) |
|---|---|---|
| 1 | T0: pronósticos (≥ 2 técnicas y comparar el error) y política de inventarios de las 11 referencias, con nivel de servicio del 90 % | **T0 Arduino**: ensamblaje y desplazamiento básico |
| 2 | T1: ubicación por popularidad (ABC) en Arauca · T2: método de almacenamiento · T3: codificación de ubicaciones · T4: costo de almacenamiento | Apoyar T3 (la codificación la usa el software) |
| 2–3 | T5: rutas Villavicencio → satélites (costo por ton-km) | **T6**: algoritmo de lista de picking · **T7**: ruta en el robot · **T8**: conteo cíclico |

## 5. Criterios de evaluación (ponderación)

| Criterio | % | ¿Nos toca? |
|---|---|---|
| Planificación de la demanda (pronósticos, inventario de seguridad) | 10 | Logística |
| Logística de almacén (ubicación ABC) | 15 | Logística |
| Plan de distribución (rutas, $648/ton-km en promedio) | 15 | Logística |
| **Lógica de optimización** (secuencia de picking y prioridad de conteo) | **15** | ✅ |
| **Lógica del conteo cíclico** (aleatorio, ≥ 5 por año) | **10** | ✅ |
| **Diseño y estructura del código** | **10** | ✅ |
| **Uso de tecnología básica** (Python/JS, estructuras fundamentales) | **15** | ✅ |
| Presentación y claridad | 5 | Todos |
| **Programación y desplazamiento del robot Arduino** | **5** | ✅ |

**Al software le corresponde el 55 % de la nota**, más el 5 % de la presentación.

---

## 6. Datos útiles del caso (por si los piden)

- Bodegas: Villavicencio 4.718 posiciones y 1.698 m² · Arauca 1.225 y 441 m² · San José 1.131 y 407 m² · Yopal 1.193 y 430 m².
- Costo de almacenamiento por m²: Villavicencio $22.000 · Yopal $20.000 · San José $12.000 · Arauca $10.000.
- Flete por ton-km: Yopal $686 · Arauca $571 · San José $689 · última milla en Villavicencio $648 (promedio para evaluar: $648).
- Canastillas por semana: Arauca 302 · San José 284 · Villavicencio clientes 288 · Villavicencio a satélites 887 · Yopal 301.
- Meta: ventas +30 % → $860.688.412 al año. Inventario promedio: $783.123.197. Los costos logísticos son el 20 % de las ventas (inventarios 40 %, aprovisionamiento 25 %, distribución 20 %, almacenamiento 15 %).

## 7. Cómo debe ayudarme Claude en esta hackatón

- Responder en **español**, de forma directa y con código listo para copiar y ejecutar.
- **No proponer software ni librerías que no estén instalados** (riesgo de descalificación). Si hace falta algo, preguntar primero.
- Comentar el código en español y explicar la lógica, porque hay que **sustentarla** ante los jurados.
- Recordar el nombre de entrega `Día<N>_Ejercicio<N>` en cada archivo.
- Ser rápido: el tiempo es limitado. Primero el objetivo mínimo que funcione y después las mejoras.
