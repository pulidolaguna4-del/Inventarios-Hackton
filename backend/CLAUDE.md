# CLAUDE.md — Sistema de Inventarios (Hackatón Logístico SENA 2026)

## Qué es este proyecto

Backend en **Node.js + Express** y frontend en **React** para la bodega satélite de **Arauca** de *Distribuciones Centauros* (caso de la hackatón). El proyecto tiene dos partes:

1. **Inventarios**: conteo cíclico por **sorteos** (un botón elige N referencias **al azar**, 12 por defecto, y **cada referencia se cuenta exactamente 5 veces al año**, una vez en cada uno de los 5 periodos del plan de logística; al llegar a 5 sale de la lista), registro de quién cuenta, vista anual e informes.
2. **Arduino**: el picking de la Tarea 6 (recorridos de máximo 3 ubicaciones) que luego ejecuta el robot sobre la maqueta. El mismo algoritmo arma la ruta de conteo de cada sorteo.

El frontend y el backend se comunican **solo por la API REST** (`/api/...`, JSON).

## Estado actual y decisiones (actualizado 29/10/2026)

Resumen para retomar el trabajo, también desde Claude chat. Lo que dice este archivo manda sobre `inventarios/CLAUDE.md` y `Documentacion/CLAUDE.md`, que describen la versión vieja en Python y ya no aplican.

### Carpetas del repositorio

| Carpeta | Qué es | Estado |
|---|---|---|
| `backend/` | API en Node.js + Express. Sirve también el frontend compilado (`backend/public/`) | **En uso** |
| `jules_session_..._frontend-control-inventarios-.../` | Código fuente del frontend en React + TypeScript + Vite + Tailwind 4 | **En uso** |
| `inventarios/` | Backend viejo en Python (stdlib) y documentos del caso en `inventarios/docs/` | Obsoleto; se conserva como respaldo y por `docs/` |
| `Documentacion/` | Contexto original del proyecto | Solo referencia |

El proyecto está en git: **https://github.com/pulidolaguna4-del/Inventarios-Hackton** (rama `main`). Los datos de `backend/datos/` (maestro, sorteos, registros de conteo y estados de pedidos) también se suben. Antes de borrar algo, respaldarlo.

### Decisiones tomadas (en orden)


1. **Frontend simplificado.** De 7 pantallas: se quitó el Dashboard y se unieron "Plan de conteo" y "Registro de conteos". El 29/10/2026 se reorganizó en el **flujo de 4 pasos** (decisión 9).
2. **Backend migrado de Python a Node.js + Express.** Se descartó la regla de "solo librería estándar de Python". Antes del cambio se verificó que las 13 rutas de la API respondían igual en ambas versiones. Picking, maestro y lectura del Excel dan exactamente los mismos resultados (174,4 m; 42 A / 36 B / 45 C; 19.357 líneas).
3. **Conteo cíclico por sorteos en vez de plan semanal fijo.** Antes: un plan anual generado de una vez (52 semanas de 11 o 12 referencias). Ahora: un **botón "Sortear"** elige N referencias al azar (editable en pantalla) entre las que llevan menos conteos. Ninguna pasa de 5 al año. El plan semanal viejo y sus 3 conteos de prueba quedaron respaldados en `backend/datos/*_respaldo_*.json`.
4. **Responsable obligatorio en cada conteo.** Se escribe una vez y se guarda en el navegador (`utils/responsable.ts`); el Paso 1 y el Paso 2 usan el mismo.
5. **Rediseño visual "bodega industrial"** (diseño A del lienzo de Claude Design): barra superior en vez de lateral, con animaciones; fondo papel, tinta y un acento naranja; títulos en Archivo condensada en mayúsculas. Detalle en la sección "Frontend React".
6. **Modal de "Contar" arreglado con un portal.** Salía muy abajo, fuera de la vista. Causa confirmada en el navegador: `<main class="pagina-entrar">` (animación de entrada con `fill-mode: both`) queda con `transform: matrix(1,0,0,1,0,0)`. Eso lo vuelve el bloque contenedor de los hijos `position: fixed`, y el overlay medía 1780 px en vez de los 900 de la ventana. Arreglo: `Modal.tsx` se monta con `createPortal(…, document.body)`. **Regla:** todo overlay o modal nuevo va con portal.
7. **Cantidad por sorteo: 12, no 56 (28/10/2026).** El 56 no salía de ningún lado y quedó descartado. El modelo correcto son 5 pasadas completas al año sobre todo el universo: 123 × 5 = 615 conteos, que en 52 semanas dan ≈ 12 por semana (`CANTIDAD_SORTEO_POR_DEFECTO = 12`). Se agregaron los **5 periodos de conteo** del plan de logística (Ene–Feb, Mar–Abr, May–Jun, Jul–Sep, Oct–Dic). Cada sorteo pertenece al periodo del mes en que se hizo. Los sorteos que ya existían (1, 2 y 3, de 56, 5 y 40 referencias, todos en Oct–Dic) se conservan; si se quiere empezar limpio con 12, usar "Reiniciar conteo", que respalda todo.
8. **Entregable de logística recibido (Tarea 1, `trabajo_1_LOGISTICA`).** Su alcance son **solo las 11 referencias nuevas**. Se guardó en `backend/datos/logistica_tarea1.json` y se muestra como **alias**, sin reemplazar nada del sistema (ver "Dos capas de layout" y "Maestro de ubicaciones").
9. **Flujo de 4 pasos (29/10/2026).** Sortear → Recorrido y conteo → Inventario → Informes. El carrito recorre las ubicaciones del sorteo (ruta de conteo = "prioridad de conteo", criterio de lógica de optimización del 15 %) y el conteo se hace en esa misma pantalla, sin modal. Detalle en "Flujo de uso: 4 pasos".

### Flujo de uso: 4 pasos (29/10/2026)

La barra ya no tiene 6 pestañas sueltas: son **4 pasos numerados** que cuentan una sola historia. Cada paso termina con un botón grande "siguiente" (`components/ui/BotonSiguiente.tsx`) que lleva el contexto en la URL (el número de sorteo).

| Paso | Ruta | Pantalla | Qué hace |
|---|---|---|---|
| 1 | `/sortear` (`?sorteo=N`) | Sortear (`pages/Sortear.tsx`) | Responsable, cantidad, "Sortear N al azar", navegación entre sorteos y la lista **de solo lectura** (pendiente / contada, con responsable y diferencia). **Aquí no se cuenta.** Si el último sorteo tiene pendientes, el botón queda deshabilitado con "Termina el sorteo N antes de sortear otro (X pendientes)"; "Sortear de todas formas" (`forzar: true`) es un enlace pequeño con confirmación. Cierra con "Ver recorrido del sorteo N →" (`/recorrido?origen=sorteo&sorteo=N`) |
| 2 | `/recorrido` (`?origen=sorteo\|prueba\|lote&sorteo=N&fecha=`) | Recorrido y conteo (`pages/Recorrido.tsx`) | Mapa 3D **a todo el ancho** con los controles flotando encima (HUD) y, debajo, el selector de origen y la **tabla del recorrido sincronizada** con la animación, donde se cuenta. Detalle en "Pantalla Recorrido". Al completar el sorteo: "Ver cómo quedó el inventario →" (`/inventario?sorteo=N`). En la vista Maqueta, los orígenes sorteo y lote muestran un aviso |
| 3 | `/inventario` (`?vista=anio`, `?sorteo=N`) | Inventario (`pages/Inventario.tsx`) | Una pantalla con dos vistas. **Referencias** (por defecto, `components/inventario/VistaReferencias.tsx`): maestro con ABC, ubicación, conteos X/5, historial y "Recalcular maestro"; con `?sorteo=N` arranca filtrada en "Contadas en el sorteo N" (chip ✕ para quitarlo) y una columna sistema → contada (diferencia). **Año** (`VistaAnio.tsx`): 5 periodos, sorteos, conteos por semana, historial filtrable por responsable y "Reiniciar conteo". Las tarjetas de indicadores y la verificación **ya no van aquí** (están en Informes). Cierra con "Ver informes →" |
| 4 | `/informes` | Informes (`pages/Informes.tsx`) | Arriba los indicadores del año, **solo aquí**: cumplimiento como número grande, sorteados, referencias completas y con diferencia. Debajo la verificación (ninguna repetida en un sorteo, ninguna pasa de 5). Luego las 3 descargas de entrega con el nombre exacto, sin pedir nombre (`utils/entregas.ts`): `Día2_Ejercicio1.csv` (maestro), `Día2_Ejercicio6.csv` (picking Tarea 6) y `Día2_Ejercicio8.csv` (sorteos). Más abajo, secundarias: registros de conteo y pedidos de un día |

- **Portada en `/`** (`pages/Inicio.tsx`, 30/10/2026): cabecera con el caso y un botón principal que depende del estado (sin sorteos → "Empezar: sortear"; último sorteo con pendientes → "Continuar: contar el sorteo N" en `/recorrido?origen=sorteo&sorteo=N`; completo → "Sortear el siguiente"), enlace a la Tarea 6 en 3D, cifras del año (referencias, conteos, cumplimiento, Tarea 6 en metros desde `/api/picking/prueba`) y los 4 pasos como tarjetas con su estado. La marca de la barra lleva a `/` y las rutas desconocidas también.
- **Rutas viejas** (`components/layout/Redirigir.tsx`, con prueba en Vitest): `/conteos-anio` → `/inventario?vista=anio`, `/referencias` → `/inventario`, `/reportes` → `/informes`, `/picking` → `/recorrido`.
- `/pedidos` sigue existiendo pero **sale de la barra**. Su único rol: el origen "Pedidos del día" del Paso 2 enlaza ahí para ver el detalle.
- **Indicador "SEM · SORTEO" de la barra:** antes se pedía el progreso una sola vez al abrir la página, por eso mostraba el sorteo 6 cuando ya existía el 7. Ahora el progreso vive en un contexto (`hooks/ProgresoContexto.tsx`, `useProgreso()`), y las pantallas que sortean, cuentan o reinician llaman a `recargar()`.

### Preguntas abiertas

- [x] ~~¿56 por sorteo o 12?~~ **Resuelto: 12**, con el modelo de 5 periodos (decisión 7).
- [ ] ¿Está instalado Node.js en el PC de la competencia? El reglamento solo permite el software que ya esté instalado.
- [ ] ¿Se borra `inventarios/` (Python)? Antes hay que mover `inventarios/docs/`.
- [ ] Mapa 3D: ¿el carrito usa solo los 9 puntos de la Tarea 6 o también pedidos reales? ¿Cuáles son las medidas reales de la maqueta en U de logística (escala en cm para las instrucciones del robot)?

### Próximos pasos

Hecho el 29/10/2026: el flujo de 4 pasos (ver arriba). Lo que se había listado antes quedó así:
- ~~Simplificar Reportes~~ → absorbido por el **Paso 4 (Informes)**.
- ~~Rediseñar Pedidos como tablero por estado~~ → **cancelado**: no suma puntos en la rúbrica. Pedidos queda fuera de la barra y su único rol es el origen "Pedidos del día" del Paso 2.
- ~~Mapa 3D~~ → cerrado dentro del **Paso 2** (falta solo la confirmación en el navegador, ver abajo).
- ~~"Pedidos como entrada del picking"~~ → reemplazado por el origen `lote` ("Pedidos del día") del Paso 2.

Siguiente:
0. **Rediseño de `/recorrido`** en dos fases: la Fase 1 (distribución y sincronía) está hecha; falta la **Fase 2 (estilo visual del 3D)**: cámara ortográfica isométrica, estanterías porta-pallet con cajas sobre estibas (InstancedMesh), montacargas con horquillas por nivel, ruta luminosa y calidad alta/básica.
1. ~~Portada en `/`~~ **Hecha el 30/10/2026** (ver "Flujo de uso: 4 pasos").
2. **Último pendiente visual, después de los 4 pasos:** pulir lo que conserva el estilo viejo (insignias verdes de clase, pestañas y barras índigo, `rounded-xl/2xl`). No mezclarlo con cambios de lógica.

### Pantalla Recorrido (rediseño 30/10/2026, Fase 1: distribución y sincronía)

- **Mapa arriba, a todo el ancho**, alto `min(72vh, 760px)` y mínimo 480 px. Sin panel lateral. **HUD** sobre el mapa (`components/mapa/HudMapa.tsx`): arriba a la izquierda, el resumen del origen ("Sorteo 8 · 12 referencias · 4 recorridos · método exacto"); arriba a la derecha, las cámaras (Isométrica, Planta, Carrito), Bodega Arauca / Maqueta y pantalla completa (`requestFullscreen` del contenedor del mapa, sin librerías); abajo a la izquierda, la leyenda ABC / categoría; abajo, de lado a lado, `LineaTiempo` (play/pausa, 1×/2×/4×, barra, recorrido Todos/1..N y contadores de metros, tiempo y paradas).
- **Pantalla completa:** la tabla no se ve, así que el HUD agrega `TarjetaParada` (solo en ese modo) con la parada actual y la siguiente: ubicación, SKU, nivel y tiempo.
- **La línea de tiempo arranca en "Todos"** (todos los recorridos seguidos) en todos los orígenes, también en la Tarea 6. El selector aísla un recorrido.
- **Debajo del mapa:** `SelectorOrigen` (pestañas Sorteos / Pedido de prueba (Tarea 6) / Pedidos del día; en Sorteos, la lista con número, fecha, periodo, "X de N contadas" y "Seleccionar", que cambia la URL y reinicia la línea en 0), luego `TablaRecorrido`, la tabla de trayectos con los supuestos y, al final, la sección plegable **"Instrucciones para el Arduino"** (`InstruccionesArduino.tsx`, pide las instrucciones solo cuando se abre y tiene su propio selector de recorrido). `PanelConteo` y `PanelRecorrido` se borraron.
- **Tabla del recorrido** (`TablaRecorrido.tsx`, filas de `utils/tablaRecorrido.ts`): una fila por ubicación en el orden de visita, agrupada por recorrido ("Recorrido 1 · 3 paradas · 57,6 m"). Columnas: orden, ubicación, nivel, SKU, descripción, parada (T/3T con segundos), estado y, solo en la ruta de conteo, sistema (editable) y contada. Estados: Pendiente → En camino → Aquí → Visitada; si se registró el conteo, "Contada", con la diferencia en rojo si no es 0. Las filas de un recorrido que no está en la línea muestran "—".
- **Interacción:** clic en una fila → la animación salta a la llegada del carrito a esa parada (si estaba aislado otro recorrido, aísla el de la fila), se pausa y el foco va a "contada". Cursor sobre una fila → la celda se resalta en el 3D (contorno naranja con `Edges`). Clic en una celda del 3D → selecciona su fila. Enter guarda (`POST /api/conteo/registro`) y pasa a la siguiente fila sin contar. Los campos nunca dependen de la animación.
- **Registro del conteo:** `hooks/useConteoSorteo.ts` (la lógica que antes estaba en `PanelConteo`). Los registros guardados en pantalla son de un sorteo: no se arrastran al cambiar de sorteo.
- **Desplazamiento:** la fila "Aquí" (o "En camino") se centra asignando **solo el `scrollTop` del contenedor de la tabla** (`centrarEnContenedor`), nunca `scrollIntoView`, que también mueve la ventana. El movimiento suave es CSS (`scroll-smooth motion-reduce:scroll-auto`), así que respeta `prefers-reduced-motion`. El foco usa `preventScroll`.
- **Sincronía y rendimiento** (`utils/reloj.ts`, `utils/animacion.ts`): el **reloj** (`Reloj`) es la única fuente de verdad del tiempo. La escena lo avanza en `useFrame` (`reloj.avanzar`) y lo publica unas 10 veces por segundo; solo `LineaTiempo` lo escucha (`useTiempoReloj`, con `useSyncExternalStore`). En cada cuadro la escena calcula `paradaActivaEnTiempo` (búsqueda binaria) y **solo avisa a React cuando cambia la parada activa** (`{indice, fase: en_camino | aqui | terminado}`). La página y la tabla se vuelven a dibujar solo entonces. La parada activa se guarda junto con su línea; si la línea cambia, se recalcula con el último tiempo publicado.

### Mapa 3D (cerrado el 29/10/2026, dentro del Paso 2)

Pedido del equipo en 5 pasos. Respaldo antes de empezar: `Documentos/Respaldos-Hackton/proyecto_antes_mapa3d_20261028_1136.zip` (backend y frontend con `node_modules`).

**Hecho y probado (backend, 68 pruebas):**
1. `GET /api/bodega/layout?vista=arauca|maqueta` (`src/layout.js`): medidas, celdas (`x, y` = centro del estante, `z` = centro de la caja, `punto_recogida`), salidas, cabeceras y pasillos como segmentos. Constantes nuevas en `config.js`: `FONDO_RACK`, `ANCHO_PASILLO`, `ESPACIO_SUPERIOR`, `LADO_RACK_POR_COLUMNA`, `ALTO_NIVEL` (1,5, supuesto), `NUM_TRAVESANOS` (3; solo 2 niveles de almacenamiento), y para la U `LARGO_BRAZO_U`, `ANCHO_FONDO_U`, `SEPARACION_POSICIONES_U`, `MARGEN_POSICIONES_U`, `ANCHO_PASILLO_U`, `FONDO_ESTANTE_U`, `ALTO_NIVEL_U`, `NIVELES_MAQUETA = 1`, `ESCALA_MAQUETA = 20`, `LADOS_ANILLO_U`, `DIRECCION_INICIAL_ROBOT`.
2. `GET /api/picking/prueba?con_trazado=true`: cada recorrido trae `trazado.eventos` (tramos `pasillo`/`cabecera`/`zona_abierta` y paradas con T/3T/4T) con tiempos de inicio y fin, y `tiempo_inicio_global_s`. **Sigue dando 174,4 m** (57,6 + 67,6 + 49,2). `bodega.tramosEntre()` da exactamente `distancia()` en los 4.225 pares de puntos. `src/trazado.js` arma los eventos.
   `GET /api/picking/maqueta` (`src/maqueta.js`): la U como anillo (izquierdo → fondo → derecho → frente), 4 recorridos de máximo 3 en orden del anillo (U01–03, U04–06, U07–09, U10–11), cada uno da la vuelta completa (24 m) en un solo sentido y vuelve a la entrada.
3. `GET /api/picking/instrucciones?vista=maqueta&recorrido=N&escala=20` (`src/robot.js`): `avanzar(cm)`, `girarDerecha()`, `girarIzquierda()`, `recoger(nivel)`; media vuelta = dos `girarDerecha()`; el redondeo se hace sobre el acumulado para que el total de cm sea exacto; devuelve `texto` y `codigo_arduino` (`{'A', 3.8}, {'R', 1}...`).

**Frontend:**
4. Dependencias instaladas: `three` 0.186, `@react-three/fiber` 9.8, `@react-three/drei` 10.7, `@types/three`. Archivos: `src/utils/animacion.ts` (+ 7 pruebas en Vitest: la posición del carrito es función pura del tiempo), `src/components/mapa/Escena3D.tsx` (piso, pasillos, cabeceras, salidas, estantes con 3 travesaños, cajas por ABC o categoría, por recoger en amarillo y ya recogidas en tinta, ruta punteada, carrito movido con `useFrame` y el reloj de three, cámaras planta / isométrica / carrito, tooltip con `Html`), `LineaTiempo.tsx` (play/pausa, 1× 2× 4×, barra arrastrable, recorrido 1..N o "todos seguidos") y `PanelRecorrido.tsx` (contadores, lista de pasos con autodesplazamiento, instrucciones con escala editable y botón copiar; reemplazado el 30/10/2026 por el HUD, la tabla del recorrido e `InstruccionesArduino`, ver "Pantalla Recorrido"). `pages/Picking.tsx` (hoy `pages/Recorrido.tsx`) reescrita con interruptor Bodega Arauca / Maqueta y la tabla de trayectos debajo; si no hay WebGL muestra un aviso y la tabla. La pantalla se carga aparte (`React.lazy`): `Recorrido-*.js` pesa ≈ 994 KB y el resto sigue en 338 KB.
   Compila (`tsc`), 14 pruebas de Vitest pasan y el build funciona. Sin texturas, fuentes ni HDR remotos (no se usa `<Text>` ni `<Environment>` de drei).

**Cierre (29/10/2026):**
- Visto en el navegador por el equipo: dibuja la bodega, botones de cámara, interruptor ABC/categoría, panel de pasos y campo de escala.
- Lint en 0: `COLORES_ABC`, `COLORES_CATEGORIA`, `soportaWebGL` y `VELOCIDADES` pasaron a `components/mapa/constantes.ts`. El aviso de `reproduccion` mutada en `useFrame` es intencional (reloj compartido) y quedó con `oxlint-disable-next-line` y su explicación.
- Sin WebGL: aviso + tabla de trayectos + el conteo funciona igual. Probado en Vitest (`pages/Recorrido.test.tsx`, con `soportaWebGL` en falso).
- [ ] **Falta confirmar en el navegador:** que el carrito siga el trazado al reproducir, la escala de la escena y la vista maqueta.

### Dos capas de layout: bodega real y maqueta

El plano en U de logística **no es la bodega de Arauca**: es la **maqueta del robot Arduino**. Tiene 15 posiciones (U01–U15) en un solo nivel, que es lo que cabe en cartón. Por eso conviven dos capas, y la primera nunca se reemplaza:

| Capa | Qué representa | Referencias | Posiciones | Código | Campo |
|---|---|---|---|---|---|
| **Bodega real** | Bodega satélite de Arauca (Gráfica 8 del caso) | Las 123 | 7 columnas × 9 filas × 2 niveles = 126 huecos | `C<col>-F<fila>-N<nivel>` (ej. `C3-F04-N2`) | `codigo_ubicacion` |
| **Maqueta** | Bodega en U del robot, según logística | Solo las 11 nuevas | 15 posiciones, 1 nivel | `U<nn>-N1-<I/D>` (ej. `U01-N1-I`) | `ubicacion_logistica` (null en las otras 112) |

- Las posiciones de la Tarea 6 (4, 25, 60, 7, 21, 55, 49, 44, 41) **solo existen en la bodega real**. Si se cambiara al esquema U se perdería el resultado de **174,4 m**, que es lo que califican.
- En la maqueta de logística, el operario entra por el lado izquierdo, recorre el fondo, regresa por el lado derecho y sale por el frente común.
- `/referencias` muestra los dos códigos: el propio y, en las 11 nuevas, "Maqueta U..".

### Herramientas del entorno

- **Claude Design**: lienzo con las 3 propuestas de barra (se eligió la A): https://claude.ai/artifact/6Pr87nY7hFYZTRzdnXz6h6
- **Skill `caveman`** instalada en `~/.claude/skills/` (`/caveman` activa respuestas cortas; "stop caveman" la apaga). Solo las skills, sin los hooks del plugin.

## Reglas que no se negocian

- **Backend: Node.js 20+ con Express 5** (ES modules). Dependencias: `express` y `exceljs` (para leer el Excel). Antes de agregar otra librería, confirmarlo con el equipo.
- **Frontend: React + TypeScript + Vite** (carpeta `../jules_session_..._frontend-control-inventarios-.../`). `npm run build` deja la página compilada en `backend/public/` y Express la sirve.
- No modificar el Excel original `datos/DATA_FINAL_ENTREGAR2026.xlsx`.
- Los archivos que se entregan se nombran `Día<N>_Ejercicio<N>` (ej. `Día2_Ejercicio6.csv`) y van en `salidas/`.
- Todo el código se escribe en **español**: funciones y variables en `camelCase`, comentarios y JSDoc en español. **Los campos del JSON de la API van en `snake_case`** (ej. `codigo_ubicacion`), porque así los espera el frontend. Las constantes van en MAYÚSCULAS dentro de `src/config.js`. Los jurados califican que el código sea legible y que las funciones sean claras.

## Comandos

```bash
# En la carpeta backend/
npm install        # solo la primera vez
npm start          # levanta http://localhost:8000 (API + frontend compilado)
npm run dev        # igual, pero se reinicia solo al guardar cambios
npm test           # corre todas las pruebas del backend (node:test)

# En la carpeta del frontend (React):
npm run dev        # desarrollo en http://localhost:5173; las llamadas /api van a localhost:8000
npm test           # pruebas del cliente de la API (Vitest)
npm run lint       # oxlint
npm run build      # compila hacia backend/public/ (borra lo que haya ahí)
```

Después de cada cambio hay que correr las pruebas. **Después de cambiar el frontend hay que correr `npm run build`**, o el servidor seguirá mostrando la versión anterior. El puerto se puede cambiar con la variable de entorno `PORT`.

## Estructura

```
backend/
├── CLAUDE.md
├── servidor.js          # carga el Excel y arranca Express en el puerto 8000
├── src/
│   ├── app.js           # crea la app de Express: /api, archivos de public/ y manejo de errores
│   ├── rutas.js         # rutas de la API: reciben la petición, llaman a los módulos y responden JSON
│   ├── config.js        # constantes: medidas, velocidades, tiempos, semilla, rutas de archivos
│   ├── excel.js         # lector de .xlsx con ExcelJS
│   ├── datos.js         # carga y limpieza de ventas y productos nuevos; persistencia JSON/CSV
│   ├── bodega.js        # layout de Arauca: posición → coordenadas y distancia entre puntos
│   ├── maestro.js       # popularidad, clasificación ABC y asignación SKU → ubicación
│   ├── picking.js       # consolidar el lote, agrupar de a 3 y ordenar la ruta
│   ├── pedidos.js       # estados de los pedidos e historial
│   ├── conteo.js        # sorteos al azar, registro de conteos y progreso
│   ├── exportar.js      # exportaciones CSV y guardado en salidas/
│   ├── reporteExcel.js  # escritor de .xlsx a mano (zip + XML con node:zlib)
│   └── reportes.js      # hojas de cada reporte en Excel (picking, conteo, maestro)
├── public/              # frontend React COMPILADO (lo genera npm run build; no editar a mano)
├── datos/               # Excel original + JSON generados (maestro, estados, sorteos, registros)
├── salidas/             # exportaciones CSV para entregar
└── tests/               # node:test: bodega, picking, conteo, datos (Excel real) y api
```

Los documentos del caso (PDF del reto, reglamento, planos) están en `../inventarios/docs/`.

**Separación de responsabilidades:** los módulos de `src/` (menos `app.js` y `rutas.js`) son funciones que se pueden probar y no saben nada de HTTP. `rutas.js` solo recibe la petición, llama a los módulos y responde en JSON. Los errores de validación de los módulos se lanzan como `Error` y la API los devuelve como 400; `ErrorApi` lleva su propio código (404, 409). Para guardar archivos se escribe primero en un temporal y luego se renombra.

## Datos: `datos/DATA_FINAL_ENTREGAR2026.xlsx`

Se lee con `src/excel.js` (ExcelJS), que busca cada hoja por su nombre. El lector normaliza:
- Textos con formato (`richText`), resultados de fórmulas e hipervínculos, que se pasan a texto o número.
- Fechas guardadas como número serial de Excel: 30/12/1899 + n días (ExcelJS ya las entrega como fecha si la celda tiene formato de fecha). Internamente las fechas son texto `AAAA-MM-DD`.
- Errores con `t="e"` (como `#REF!`), que se convierten en `null`.
- Códigos guardados como float (`400016.0`), que se pasan a entero.

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

**Universo de referencias = 112 + 11 = 123.** Nunca se escribe fijo en el código: se calcula a partir de los datos (`referencias.length`).

## Bodega de Arauca (`src/bodega.js`)

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

### Modelo de coordenadas (en metros; todo ajustable en `src/config.js`)

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

## Picking (`src/picking.js`)

> **Estado:** hechos la consolidación, el reparto exacto, la heurística, la lista de despacho (`GET /api/picking?origen=...`) y el mapa 3D con el carrito (Paso 2).
>
> Decisión abierta para cuando se retome: con `MINIMO_DE_RECORRIDOS = true` (por defecto) la Tarea 6 da 3 recorridos y 174,4 m. Con `false` se permiten recorridos de menos de 3 ubicaciones y da 4 recorridos y 164,8 m.
>
> Supuestos de tiempo (el caso no los da): `VELOCIDAD_OPERARIO = 1.0` m/s y `TIEMPO_RECOGIDA_NIVEL_1 = 20` s.

**Reglas del caso:**
- **Máximo 3 ubicaciones por recorrido** (`CAPACIDAD_RECORRIDO = 3`).
- Tiempo de recogida: nivel 1 = `T`, nivel 2 = `3T` (`FACTOR_NIVEL_2 = 3`) y ambos niveles = `4T`.
- **Cada recorrido sale y vuelve por la misma salida** (`MISMA_SALIDA = true`).
- Tiempo total = distancia / `VELOCIDAD_OPERARIO` + suma de los tiempos de recogida.
- Como el tiempo de recogida es fijo para cada ubicación, **no cambia cuál es la mejor ruta**; solo suma al tiempo total. Hay que explicarlo así en la sustentación.

**Flujo:**
1. **Consolidar el lote:** agrupar por SKU, sumar las cantidades y guardar de qué pedidos sale cada SKU.
2. **Buscar la ubicación** de cada SKU en el maestro y armar la lista de ubicaciones a visitar, con su nivel.
3. **Formar los grupos de 3:**
   - **Exacto si hay ≤ 12 ubicaciones:** se prueban todas las particiones en grupos de 3 (son 280 para 9 ubicaciones). Para cada grupo se prueban las 6 permutaciones y las 2 salidas, y se elige el mínimo total.
   - **Heurística si hay > 12:** se ordena por zona (altura de la fila) y por pasillo en serpentina, se corta en bloques de 3 y luego se mejora con intercambios entre grupos mientras la distancia baje.
4. **Salida:** la lista de despacho con `recorrido, orden, codigo_ubicacion, numero_plano, nivel, sku, descripcion, cantidad, pedidos, distancia_acum_m, tiempo_s`, más los totales.

**Orígenes** (todos usan el mismo algoritmo; `?origen=` en `GET /api/picking`):
- **`prueba` — Tarea 6 (Gráfica 9), que es lo que evalúan los jurados.** Son 9 ubicaciones fijas sin SKU:
  - Ambos niveles: **4, 25, 60**
  - Nivel 1: **7, 21, 55**
  - Nivel 2: **49, 44, 41**
- **`lote` — órdenes reales de Arauca del Excel**, para probar con datos de verdad. El lote se elige por **fecha** (≈ 13 órdenes) o por una lista de `id_pedido`.
- **`sorteo` — ruta de conteo.** Las ubicaciones de las referencias del sorteo N (del maestro). Es la "prioridad de conteo": el carrito va a lo que se sorteó. Con 12 por sorteo salen 4 recorridos de 3 y, como son ≤ 12, la ruta es la óptima exacta. Dos referencias en la misma celda y distinto nivel son una sola parada (4T). `cantidad_sistema` de cada parada = la registrada al contar o, si no se ha contado, `stockSimulado(sku)`.
  - **Supuesto (el caso no lo define):** el tiempo de conteo por parada es el mismo de recogida (nivel 1 = T, nivel 2 = 3T, ambos = 4T).
- Todas las respuestas traen `origen` y `metodo` (`exacto` o `heuristico`) y `totales.ubicaciones` (paradas), para mostrar en pantalla qué método eligió el sistema según el tamaño.

**Resultado de referencia** de la prueba con los valores por defecto: 3 recorridos y **≈ 174,4 m**. Los grupos óptimos son {4, 7, 60}, {25, 21, 55} y {49, 44, 41}, todos por la salida DER. Si se cambian las constantes de la bodega, este valor cambia y hay que actualizar la prueba.

## Maestro de ubicaciones (`src/maestro.js`)

- **Popularidad** = cantidad de líneas de pedido por SKU en Arauca. Las 5 referencias que nunca se vendieron en Arauca quedan con 0.
- **Referencias nuevas (criterio):** `líneas equivalentes = demanda anual proyectada × (líneas de Arauca ÷ unidades de Arauca)`. El factor es ≈ 0,0427 líneas por unidad. Se asume que la proyección corresponde a Arauca.
- **Clasificación ABC** por popularidad acumulada: A hasta el 80 %, B hasta el 95 % y C el resto. La referencia que cruza el umbral queda en la clase de arriba. Resultado: **42 A, 36 B y 45 C**.
- **Asignación:** con `PRIORIZAR_NIVEL_1 = true` (por defecto) se llenan primero los 63 huecos de nivel 1 y después los de nivel 2, cada grupo de más cerca a más lejos de la salida más cercana. Se justifica porque el caso dice que el picking es "a nivel de suelo" y el nivel 2 tarda el triple. Con `false` se ordena solo por distancia. Los SKU más populares van a los primeros huecos y quedan 3 huecos libres.
- Si el equipo de logística entrega su propio `datos/maestro_logistica.csv` (Tarea 1), **ese archivo manda** sobre lo que se genera. Lleva las columnas `sku` y `codigo_ubicacion`, y opcionalmente `clase_abc`, separadas por `;` o `,`. Los SKU que no vengan en ese archivo se ubican en los huecos libres.
- Se guarda en `datos/maestro.json` como `{"generado", "fuente", "criterios", "conteo_por_clase", "referencias": [...]}`. Cada referencia lleva `sku, descripcion, categoria, es_nueva, popularidad, origen_popularidad, clase_abc, porcentaje_acumulado, codigo_ubicacion, columna, fila, nivel, numero_plano, distancia_salida_m, fuente_ubicacion`.
- El conteo cíclico toma sus referencias del maestro (`referenciasActuales()` en `src/rutas.js`), así que los registros ya llevan `codigo_ubicacion`.
- **Datos de logística (Tarea 1)** en `datos/logistica_tarea1.json` (11 referencias: `sku, ubicacion_logistica, zona, clase_abc_logistica, demanda_anual`). `maestroActual()` los agrega con `agregarDatosLogistica()` como **dos campos aparte**: `ubicacion_logistica` y `clase_abc_logistica` (null en las 112 restantes). **No** se tocan `codigo_ubicacion` ni `clase_abc`. Este archivo es distinto de `maestro_logistica.csv`, que sí reemplazaría ubicaciones y no se usa.
- **Dos clasificaciones ABC (para la sustentación):**
  - `clase_abc` (sistema): **por líneas de pedido en Arauca**, sobre las 123 referencias → 42 A / 36 B / 45 C. Es la métrica correcta para slotting, porque cada línea es un viaje del operario. Para las 11 nuevas, el sistema da 5 B y 6 C.
  - `clase_abc_logistica` (logística): sobre las 11 nuevas, **por unidades de demanda anual**. Su columna "NUMERO DE PEDIDO" es en realidad la demanda anual en unidades, la suma de los 12 meses, que coincide exacto con la del Excel. Ellos asignaron 9 A, 1 B y 1 C, pero esa clasificación no sigue su propia métrica. Ordenando por su mismo número al 80/95 % acumulado saldrían **7 A, 3 B y 1 C**. El caso más visible: 100033 tiene la demanda más alta (539) y quedó B, mientras 400019 con 507 quedó A.
  - **No se "corrige" su hoja desde el código.** Se muestran los dos valores en `/referencias` ("Logística: A" bajo la clase del sistema) para explicar la diferencia.

## Conteo cíclico por sorteos (`src/conteo.js`)

**Decisión del equipo (28/10/2026):** se reemplazó el plan anual fijo (52 semanas de 11 o 12) por **sorteos a demanda**. El plan semanal anterior y sus 3 registros de prueba quedaron respaldados en `datos/*_respaldo_*.json`.

- `N` = número de referencias del maestro (123). Total del año = `N * CONTEOS_POR_ANIO` (5) = **615 conteos**.
- **Botón "Sortear"** (`POST /api/conteo/sorteo {"cantidad": 12}`): la cantidad por defecto es `CANTIDAD_SORTEO_POR_DEFECTO = 12` (615 ÷ 52 ≈ 12 por semana) y se puede cambiar en pantalla.
- **Selección:** se eligen al azar (`muestraAleatoria`) referencias entre las que llevan **menos sorteos**: primero todas las que llevan 0, luego las que llevan 1, y así. Ninguna se repite en el mismo sorteo y ninguna pasa de 5. Así, al sortear los 615, todas quedan con **exactamente 5**, con cualquier cantidad por sorteo (probado con 1, 12, 20, 56, 100 y 500).
- Si quedan menos referencias disponibles que la cantidad pedida, se sortean las que queden. Cuando todas tienen 5, sortear devuelve 400 hasta que se reinicie el año.
- Si el sorteo anterior tiene referencias sin contar, sortear devuelve **409**. Con `"forzar": true` se sortea igual, y las pendientes se pueden seguir contando en su sorteo.
- Cada sorteo guarda su `semilla` (aleatoria, de `crypto`) y usa `crearAleatorio(semilla)` (mulberry32): con la misma semilla y el mismo estado sale la misma lista, lo que sirve para demostrarlo en la sustentación.
- Los sorteos se guardan en `datos/sorteos_conteo.json` como `[{numero, fecha_hora, periodo, semilla, cantidad_pedida, skus}]`. Los conteos van en `datos/registros_conteo.json` con `fecha, responsable, sorteo, semana, sku, codigo_ubicacion, cantidad_sistema, cantidad_contada, diferencia`. La `semana` (1–52, ISO) sale de la fecha del conteo y alimenta la vista anual.
- Un registro se rechaza (400) si la referencia no salió en ese sorteo o si ya se contó en ese sorteo.
- **Progreso por SKU:** `contada X/5`. Con 5 sale de la lista; si la diferencia es distinta de 0, se marca.
- **Verificación** (también va en las pruebas): ninguna referencia repetida dentro de un sorteo, ninguna con más de 5 y ningún SKU fuera del maestro; `completo` cuando todas tienen 5.
- **Periodos de conteo** (`PERIODOS_CONTEO` en `config.js`): 1 Ene–Feb, 2 Mar–Abr, 3 May–Jun, 4 Jul–Sep, 5 Oct–Dic. En cada periodo la meta es contar las 123 referencias una vez. Cada sorteo guarda `periodo`, que sale del mes de su `fecha_hora`; los sorteos guardados antes de existir el campo lo calculan con `periodoDeSorteo()`. `/api/conteo/progreso` devuelve `periodo_actual` y `periodos: [{numero, nombre, mes_inicio, mes_fin, sorteos, conteos_sorteados, conteos_registrados, referencias_contadas, referencias_totales}]`. El sorteo sigue eligiendo por "menos conteos en el año", así que las pasadas se completan en orden.
- `cantidad_sistema`: como el caso no trae stock, es **editable** en el registro. Si no se digita, se usa `stockSimulado(sku)`, un valor reproducible (siempre el mismo para el mismo SKU) entre `STOCK_SIMULADO_MINIMO` y `STOCK_SIMULADO_MAXIMO`.
- **Reiniciar conteo** (`POST /api/conteo/reiniciar`): respalda sorteos y registros en `*_respaldo_<fecha_hora>.json` y empieza un año nuevo en cero.

## Pedidos (`src/pedidos.js`)

Estados en orden:

`Pendiente` → `En alistamiento` → `Alistado` → `En entrega` → `Entregado`

- Todos los avances se hacen **a mano con un botón** en `/pedidos`. La pantalla está fuera de la barra: se abre desde el origen "Pedidos del día" del Paso 2 (`/pedidos?fecha=`).
- Solo se permite avanzar al estado siguiente; cualquier otra transición devuelve error 400. Un pedido que no es de Arauca da 404.
- Un pedido sin cambios registrados está `Pendiente`.
- Cada cambio se guarda en `datos/estados_pedidos.json` con su `fecha_hora`. El formato es `{"<id_pedido>": {"estado", "historial": [{"estado", "fecha_hora"}]}}`.
- `GET /api/pedidos` acepta `fecha` (sin ella usa la primera fecha con pedidos) y un `estado` opcional para filtrar. Devuelve `conteo_por_estado` del día.

## API (`src/rutas.js`)

Todas las respuestas son JSON. Los errores se devuelven como `{"error": "mensaje"}` con el código HTTP que corresponda.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/resumen` | Totales: referencias, órdenes de Arauca, fechas disponibles |
| GET | `/api/maestro` | Maestro de ubicaciones; cada referencia trae además `ubicacion_logistica` y `clase_abc_logistica` (null salvo las 11 nuevas) |
| POST | `/api/maestro/generar` | Recalcula el ABC y las ubicaciones |
| GET | `/api/picking?origen=prueba\|sorteo\|lote&sorteo=N&fecha=AAAA-MM-DD&con_trazado=true` | Lista de despacho en Arauca. `prueba` = Tarea 6; `sorteo` = ruta de conteo del sorteo N (sin N, el último); `lote` = pedidos de Arauca de la fecha. Cada parada trae `items` con `sku, descripcion, nivel, codigo_ubicacion, cantidad, cantidad_sistema` |
| GET | `/api/picking/prueba` | Alias de `/api/picking?origen=prueba` (Tarea 6: 3 recorridos, 174,4 m) |
| GET | `/api/picking/maqueta` | Recorridos del robot en la U (de a 3), con trazado |
| GET | `/api/picking/instrucciones?vista=maqueta&recorrido=1&escala=20` | Instrucciones del robot (por defecto maqueta, escala de `ESCALA_MAQUETA`). En `vista=arauca` acepta también `origen`, `sorteo` y `fecha`; en la maqueta solo existe `origen=prueba` (otro origen da 400) |
| GET | `/api/bodega/layout?vista=arauca\|maqueta` | Geometría para el mapa 3D |
| GET | `/api/pedidos?fecha=AAAA-MM-DD&estado=` | Pedidos con su estado |
| POST | `/api/pedidos/<id>/estado` | `{"estado":"En entrega"}` |
| POST | `/api/conteo/sorteo` | `{"cantidad":12, "forzar":false}`: sortea referencias al azar (409 si el sorteo anterior tiene pendientes y no se fuerza) |
| GET | `/api/conteo/sorteo/<n>` | Referencias del sorteo n, con su progreso |
| POST | `/api/conteo/registro` | `{"sorteo", "sku", "responsable", "cantidad_contada", "cantidad_sistema"?, "fecha"?}` |
| GET | `/api/conteo/progreso` | Totales del año, `periodo_actual` y `periodos`, sorteos (con `periodo`), avance por semana, progreso por SKU y verificación |
| GET | `/api/conteo/registros?sku=&sorteo=&semana=` | Historial de conteos, del más reciente al más antiguo |
| POST | `/api/conteo/reiniciar` | Respalda sorteos y registros y empieza un año nuevo |
| GET | `/api/exportar/<tipo>?nombre=Día2_Ejercicio6&formato=xlsx\|csv` | Guarda el reporte en `salidas/` y lo descarga (por defecto `.xlsx` con formato; `formato=csv` para el CSV plano). Tipos: `maestro`, `conteo` (los sorteos; opcional `&sorteo=N`), `registros_conteo`, `pedidos` (`&fecha=`), `picking` |

**Reportes en Excel (.xlsx, por defecto desde el 29/10/2026).** `GET /api/exportar/<tipo>` devuelve un `.xlsx` con formato (`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) y guarda la copia en `salidas/<nombre>.xlsx` (temporal + renombrar). Con `?formato=csv` sale el CSV plano de antes.
- **Escritor propio, sin dependencias** (`src/reporteExcel.js`): el zip y los XML se arman a mano con `node:zlib` (`deflateRawSync` y `crc32`). Partes: `[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml`, `xl/_rels/workbook.xml.rels`, `xl/styles.xml` y una `xl/worksheets/sheetN.xml` por hoja. Textos en línea (`t="inlineStr"`), sin `sharedStrings.xml`. `crearXlsx(hojas)` recibe las hojas como datos (`nombre, titulo, bloque, columnas [{titulo, formato, ancho}], filas [{valores, fondo}], zebra, leyenda, congelarEncabezado, autofiltro`).
- **Formato:** título combinado (14, negrita, blanco sobre `#1F3864`), encabezado blanco sobre azul oscuro con ajuste de texto, bordes finos, zebra `#F2F2F2`, enteros sin decimales y decimales con `0.0`, totales en negrita con borde superior grueso y fondo `#D9E2F3`, encabezado congelado, autofiltro (con su `_xlnm._FilterDatabase`) y anchos calculados para que nunca salga `####` ni el botón del filtro tape el encabezado. Colores: nivel 1 `#FFE699`, nivel 2 `#F4B7B7`, ambos `#FFCC99`, alerta `#FF7070`, clase A `#C6EFCE`, B `#FFEB9C`, C `#E7E6E6`.
- **Reportes** (`src/reportes.js`): `Día2_Ejercicio6` = picking de la Tarea 6 pintado por nivel, subtotal por recorrido y TOTAL GENERAL (174,4 m) con leyenda. `Día2_Ejercicio8` = hojas Sorteos, Verificación (OK solo si la referencia lleva exactamente 5; si no, REVISAR en rojo; bloque con total de referencias, conteos y semilla del último sorteo) y Semillas. `Día2_Ejercicio1` = maestro pintado por clase ABC. Registros de conteo y pedidos salen como tabla simple (diferencias en rojo).
- **Verificado en Excel** (29/10/2026, por automatización COM): los tres archivos de entrega abren sin aviso de reparación, sin `####`, con panel congelado y autofiltro. Control: un `.xlsx` con el XML mal ordenado hace fallar `Workbooks.Open`, así que la prueba sí detecta archivos dañados.
- Nota: a mitad de año casi todas las filas de Verificación salen en REVISAR, porque todavía no llevan 5 conteos.

**Formato de los CSV** (`datos.textoCsv`, columnas en `config.js`): cada columna es `{campo, titulo}`, y el título es el encabezado en español que se ve en Excel ("Código de ubicación", "Distancia total del recorrido (m)"…). Los valores se escriben para Excel en español: decimales con coma (`57,6`), `Sí`/`No`, fecha y hora sin la "T" y vacío en lugar de null. Filas enriquecidas en `exportar.js`:
- `Día2_Ejercicio6` (`filasDespacho`): cada fila trae la salida, la distancia y el tiempo total de su recorrido y si es el más demorado. Sin SKU ni cantidad, porque la Tarea 6 son posiciones sin SKU.
- `Día2_Ejercicio8` (`filasSorteos`): agrega el periodo ("5 · Oct–Dic") y "Vez en el año (de 5)".
- Registros de conteo (`filasRegistros`): agrega la descripción.

**Descargas:** `Content-Disposition` lleva `filename*=UTF-8''D%C3%ADa2_...` (nombre exacto con la "í") y un `filename="Dia2_..."` sin tilde solo como respaldo. El nombre se normaliza a NFC. El CSV lleva BOM UTF-8 y `;` (Excel en español). Hay prueba para las dos cosas.

**Nombres de entrega por defecto** (según el reglamento): maestro (Tarea 1) → `Día2_Ejercicio1`, picking (Tarea 6) → `Día2_Ejercicio6`, sorteos de conteo (Tarea 8) → `Día2_Ejercicio8`. El servidor solo exige que el nombre tenga letras, números, `_` o `-`.

## Frontend React (carpeta `jules_session_..._frontend-control-inventarios-...`)

- `src/services/api.ts`: el único lugar que llama al backend; `src/types/inventario.ts` refleja el JSON tal cual (campos en español, snake_case).
- **Estilo "bodega industrial"** (diseño A del lienzo de Claude Design, 28/10/2026): barra superior oscura (`src/components/layout/Navbar.tsx`) con indicador que se desliza, entrada escalonada y menú desplegable en móvil; títulos en Archivo condensada en mayúsculas (clase `titulo-senal`), cuerpo en IBM Plex Sans y códigos en IBM Plex Mono (fuentes instaladas con `@fontsource`, funcionan sin internet). Colores: papel `#F4F1EA`, tinta `#17181A` y un solo acento naranja `#FF6B2C` (`bg-senal`). En `src/index.css` se **redefinen** las escalas `slate` (grises cálidos) e `indigo` (tinta) y los radios, así que las clases existentes ya toman el estilo; no volver a usar degradados ni tarjetas muy redondeadas.
- La barra muestra los **4 pasos** numerados (ver "Flujo de uso: 4 pasos"), con el mismo indicador que se desliza; ya no hay rótulos de grupo INVENTARIO / ARDUINO.
- Las rutas sin extensión las devuelve Express como `index.html` para que las maneje React Router.
- Pantallas: `pages/Inicio.tsx` (portada), `Sortear.tsx`, `Recorrido.tsx`, `Inventario.tsx` (vistas en `components/inventario/`), `Informes.tsx` y `Pedidos.tsx`. Pruebas de pantalla en Vitest junto a cada una (`*.test.tsx`, con la API simulada). Con `cleanup` en `afterEach`, porque Vitest no usa `globals`.
- `Modal.tsx` se monta con `createPortal` en `document.body` (ver decisión 6). La animación `.pagina-entrar` de `<main>` deja un `transform` que rompe `position: fixed`.

## Pendientes

Ver "Preguntas abiertas" y "Próximos pasos" al inicio de este archivo. Además:

- [x] ~~Ajustar el código de ubicaciones con la propuesta del equipo de logística (Tarea 3).~~ **Resuelto como alias, no como reemplazo**: `ubicacion_logistica` al lado de `codigo_ubicacion` (ver "Dos capas de layout").
- [x] ~~Recibir el maestro ABC de logística (Tarea 1).~~ **Recibido** (`trabajo_1_LOGISTICA`). Alcance: solo las 11 referencias nuevas. Guardado en `datos/logistica_tarea1.json`.
- [ ] Validar con el plano que las medidas y las posiciones de las salidas sean correctas.
- [ ] Confirmar en el navegador el Paso 2: carrito siguiendo el trazado, escala de la escena y vista maqueta.
- [ ] Pulir el estilo viejo (único pendiente visual; va al final, ver "Próximos pasos").
