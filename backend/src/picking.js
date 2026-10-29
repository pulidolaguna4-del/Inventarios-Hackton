// Picking optimizado: consolida un lote, lo reparte en recorridos de máximo 3
// ubicaciones y ordena cada recorrido para caminar lo menos posible.
//
// Conceptos:
// - Parada: una celda (columna, fila) que hay que visitar. Puede tener productos en
//   el nivel 1, en el nivel 2 o en ambos; cuenta como una sola ubicación.
// - Recorrido: sale por una salida, visita hasta CAPACIDAD_RECORRIDO paradas y vuelve.
//
// El tiempo de recogida de cada parada es fijo (T, 3T o 4T), así que no cambia cuál
// es la mejor ruta: se minimiza la distancia y el tiempo de recogida se suma al final.

import * as bodega from './bodega.js';
import { redondear } from './maestro.js';
import { armarTrazado, encadenarRecorridos } from './trazado.js';
import {
  CAPACIDAD_RECORRIDO,
  FACTOR_NIVEL_2,
  FILAS_POR_ZONA,
  LIMITE_EXACTO,
  MINIMO_DE_RECORRIDOS,
  MISMA_SALIDA,
  NUM_FILAS,
  PEDIDO_TAREA_6,
  SALIDAS,
  TIEMPO_RECOGIDA_NIVEL_1,
  TOLERANCIA_METROS,
  VELOCIDAD_OPERARIO,
} from './config.js';

const FACTORES_NIVEL = { 1: 1, 2: FACTOR_NIVEL_2 };

// ---------------------------------------------------------------------------
// Utilidades de combinatoria (mismo orden que itertools de Python)
// ---------------------------------------------------------------------------

/** Todas las formas de ordenar los elementos de `lista`. */
export function permutaciones(lista) {
  if (lista.length <= 1) return [lista.slice()];
  const resultado = [];
  lista.forEach((elemento, indice) => {
    const resto = [...lista.slice(0, indice), ...lista.slice(indice + 1)];
    for (const orden of permutaciones(resto)) resultado.push([elemento, ...orden]);
  });
  return resultado;
}

/** Todos los subconjuntos de `tamano` elementos de `lista`, respetando su orden. */
export function combinaciones(lista, tamano) {
  if (tamano === 0) return [[]];
  const resultado = [];
  for (let i = 0; i <= lista.length - tamano; i++) {
    for (const resto of combinaciones(lista.slice(i + 1), tamano - 1)) resultado.push([lista[i], ...resto]);
  }
  return resultado;
}

// ---------------------------------------------------------------------------
// Preparar el pedido
// ---------------------------------------------------------------------------

/**
 * Agrupa las líneas de pedido por SKU.
 * Devuelve una lista ordenada por SKU con: sku, descripcion, cantidad (suma) y
 * pedidos (lista de id_pedido de donde sale ese SKU).
 */
export function consolidarLote(lineas) {
  const porSku = new Map();
  for (const linea of [...lineas].sort((a, b) => a.sku - b.sku)) {
    if (!porSku.has(linea.sku)) {
      porSku.set(linea.sku, { sku: linea.sku, descripcion: linea.descripcion ?? '', cantidad: 0, pedidos: [] });
    }
    const consolidado = porSku.get(linea.sku);
    consolidado.cantidad += linea.cantidad;
    if (linea.id_pedido != null && !consolidado.pedidos.includes(linea.id_pedido)) consolidado.pedidos.push(linea.id_pedido);
  }
  for (const consolidado of porSku.values()) consolidado.pedidos.sort((a, b) => a - b);
  return [...porSku.values()];
}

/**
 * Le pone a cada SKU consolidado su código de ubicación.
 * Devuelve {items, sin_ubicacion}: los SKU con ubicación y los que no la tienen.
 */
export function ubicarItems(consolidados, ubicacionPorSku) {
  const items = [];
  const sinUbicacion = [];
  for (const consolidado of consolidados) {
    const codigo = ubicacionPorSku[consolidado.sku];
    if (codigo == null) sinUbicacion.push(consolidado.sku);
    else items.push({ ...consolidado, codigo_ubicacion: codigo });
  }
  return { items, sin_ubicacion: sinUbicacion };
}

function nuevaParada(columna, fila) {
  const [x, y] = bodega.coordenadasCelda(columna, fila);
  return { columna, fila, numero_plano: bodega.numeroPlano(columna, fila), x, y, niveles: [], items: [] };
}

/** Junta los items que están en la misma celda en una sola parada. */
export function paradasDesdeItems(items) {
  const porCelda = new Map();
  for (const item of items) {
    const { columna, fila, nivel } = bodega.interpretarCodigo(item.codigo_ubicacion);
    const clave = `${columna}-${fila}`;
    if (!porCelda.has(clave)) porCelda.set(clave, nuevaParada(columna, fila));
    porCelda.get(clave).items.push({ ...item, nivel });
  }
  for (const parada of porCelda.values()) {
    parada.items.sort((a, b) => a.nivel - b.nivel);
    parada.niveles = [...new Set(parada.items.map((item) => item.nivel))].sort((a, b) => a - b);
  }
  return [...porCelda.values()];
}

/**
 * Arma las paradas de una ruta de conteo: las ubicaciones de las referencias de un sorteo.
 * Cada fila trae sku, descripcion, codigo_ubicacion y cantidad_sistema. Dos referencias en
 * la misma celda y distinto nivel quedan en una sola parada (4T), igual que en la Tarea 6.
 */
export function paradasDeConteo(filas) {
  const items = filas.map((fila) => ({
    sku: fila.sku,
    descripcion: fila.descripcion ?? '',
    cantidad: null,
    pedidos: [],
    codigo_ubicacion: fila.codigo_ubicacion,
    cantidad_sistema: fila.cantidad_sistema ?? null,
  }));
  return paradasDesdeItems(items);
}

/** Arma las paradas del pedido de prueba de la Tarea 6 (posiciones sin SKU). */
export function paradasTarea6(pedido = PEDIDO_TAREA_6) {
  const items = [];
  for (const [numero, niveles] of pedido) {
    const { columna, fila } = bodega.celdaUnicaPorNumero(numero);
    for (const nivel of niveles) {
      items.push({
        sku: null,
        descripcion: '',
        cantidad: null,
        pedidos: [],
        codigo_ubicacion: bodega.codigoUbicacion(columna, fila, nivel),
      });
    }
  }
  return paradasDesdeItems(items);
}

// ---------------------------------------------------------------------------
// Tiempos
// ---------------------------------------------------------------------------

/** Segundos que toma recoger un producto en ese nivel (T o 3T). */
export function tiempoRecogidaNivel(nivel) {
  return TIEMPO_RECOGIDA_NIVEL_1 * FACTORES_NIVEL[nivel];
}

/** Suma el tiempo de recogida de todos los items de la parada (ambos niveles = 4T). */
export function tiempoRecogidaParada(parada) {
  return parada.items.reduce((suma, item) => suma + tiempoRecogidaNivel(item.nivel), 0);
}

/** Segundos que tarda el operario en caminar esa distancia. */
export function tiempoDesplazamiento(distanciaM) {
  return distanciaM / VELOCIDAD_OPERARIO;
}

// ---------------------------------------------------------------------------
// Mejor orden dentro de un recorrido
// ---------------------------------------------------------------------------

/** Combinaciones [salida de inicio, salida de llegada] permitidas. */
export function paresDeSalidas() {
  const nombres = Object.keys(SALIDAS);
  if (MISMA_SALIDA) return nombres.map((salida) => [salida, salida]);
  return nombres.flatMap((inicio) => nombres.map((fin) => [inicio, fin]));
}

/**
 * Prueba todos los órdenes y salidas para un grupo de paradas y devuelve el más corto:
 * {orden, salida_inicio, salida_fin, distancia}.
 */
export function mejorRecorrido(paradas) {
  let mejor = null;
  for (const orden of permutaciones(paradas)) {
    const puntosParadas = orden.map((parada) => [parada.x, parada.y]);
    for (const [salidaInicio, salidaFin] of paresDeSalidas()) {
      const puntos = [bodega.coordenadasSalida(salidaInicio), ...puntosParadas, bodega.coordenadasSalida(salidaFin)];
      const distancia = bodega.distanciaRuta(puntos);
      if (mejor === null || distancia < mejor.distancia - TOLERANCIA_METROS) {
        mejor = { orden, salida_inicio: salidaInicio, salida_fin: salidaFin, distancia };
      }
    }
  }
  return mejor;
}

/** Guarda la distancia mínima de cada grupo de paradas para no recalcularla. */
function crearCostoDeGrupos(paradas) {
  const memoria = new Map();
  return (indices) => {
    if (indices.length === 0) return 0;
    const clave = [...indices].sort((a, b) => a - b).join(',');
    if (!memoria.has(clave)) {
      memoria.set(clave, mejorRecorrido(clave.split(',').map((indice) => paradas[Number(indice)])).distancia);
    }
    return memoria.get(clave);
  };
}

// ---------------------------------------------------------------------------
// Repartir las paradas en recorridos
// ---------------------------------------------------------------------------

/** Menor número de recorridos que alcanza para visitar todas las paradas. */
export function minimoDeRecorridos(cantidadParadas, capacidad = CAPACIDAD_RECORRIDO) {
  return Math.ceil(cantidadParadas / capacidad);
}

/**
 * Encuentra el reparto en grupos de máximo `capacidad` con la menor distancia total.
 *
 * Revisa todas las particiones posibles con programación dinámica: la primera parada
 * pendiente se junta con cada combinación de compañeras y el resto se resuelve igual,
 * guardando los resultados ya calculados. Con 9 paradas y `soloMinimo` cubre las 280
 * particiones en 3 grupos de 3. Devuelve una lista de grupos (arreglos de índices).
 */
export function agruparExacto(paradas, capacidad = CAPACIDAD_RECORRIDO, soloMinimo = MINIMO_DE_RECORRIDOS) {
  const costoGrupo = crearCostoDeGrupos(paradas);
  const maximoGrupos = soloMinimo ? minimoDeRecorridos(paradas.length, capacidad) : paradas.length;
  const memoria = new Map();

  const resolver = (pendientes, gruposDisponibles) => {
    if (pendientes.length === 0) return { total: 0, grupos: [] };
    if (pendientes.length > gruposDisponibles * capacidad) return null;
    const clave = `${pendientes.join(',')}|${gruposDisponibles}`;
    if (memoria.has(clave)) return memoria.get(clave);

    const [primera, ...resto] = pendientes;
    let mejor = null;
    // Primero los grupos grandes: ante un empate se prefieren menos recorridos.
    for (let tamano = Math.min(capacidad - 1, resto.length); tamano >= 0; tamano--) {
      for (const companeras of combinaciones(resto, tamano)) {
        const grupo = [primera, ...companeras];
        const quedan = resto.filter((indice) => !companeras.includes(indice));
        const solucionResto = resolver(quedan, gruposDisponibles - 1);
        if (solucionResto === null) continue;
        const total = costoGrupo(grupo) + solucionResto.total;
        if (mejor === null || total < mejor.total - TOLERANCIA_METROS) {
          mejor = { total, grupos: [grupo, ...solucionResto.grupos] };
        }
      }
    }
    memoria.set(clave, mejor);
    return mejor;
  };

  return resolver(paradas.map((_, indice) => indice), maximoGrupos).grupos;
}

/**
 * Reparte muchas paradas en grupos de forma rápida (no garantiza el óptimo).
 * 1. Ordena las paradas por franjas de filas, empezando por las más cercanas a las
 *    salidas, y en cada franja recorre los pasillos en serpentina.
 * 2. Corta esa secuencia en bloques de `capacidad`.
 * 3. Mientras la distancia total baje, intercambia o mueve paradas entre grupos.
 */
export function agruparHeuristico(paradas, capacidad = CAPACIDAD_RECORRIDO) {
  const costoGrupo = crearCostoDeGrupos(paradas);
  const clave = (parada) => {
    const zona = Math.floor((NUM_FILAS - parada.fila) / FILAS_POR_ZONA);
    const sentido = zona % 2 === 0 ? 1 : -1;
    return [zona, sentido * parada.x, parada.y];
  };
  const secuencia = paradas
    .map((_, indice) => indice)
    .sort((a, b) => {
      const [claveA, claveB] = [clave(paradas[a]), clave(paradas[b])];
      return claveA[0] - claveB[0] || claveA[1] - claveB[1] || claveA[2] - claveB[2];
    });
  const grupos = [];
  for (let inicio = 0; inicio < secuencia.length; inicio += capacidad) grupos.push(secuencia.slice(inicio, inicio + capacidad));
  return mejorarConIntercambios(grupos, costoGrupo, capacidad);
}

/** Aplica intercambios y movimientos entre pares de grupos mientras mejoren. */
function mejorarConIntercambios(grupos, costoGrupo, capacidad) {
  let huboMejora = true;
  while (huboMejora) {
    huboMejora = false;
    for (let a = 0; a < grupos.length; a++) {
      for (let b = a + 1; b < grupos.length; b++) {
        if (mejorarPar(grupos, a, b, costoGrupo, capacidad)) huboMejora = true;
      }
    }
    grupos = grupos.filter((grupo) => grupo.length > 0);
  }
  return grupos;
}

/** Busca un cambio entre los grupos a y b que baje la distancia; si lo hay, lo aplica. */
function mejorarPar(grupos, a, b, costoGrupo, capacidad) {
  const [grupoA, grupoB] = [grupos[a], grupos[b]];
  const costoActual = costoGrupo(grupoA) + costoGrupo(grupoB);
  const sin = (grupo, elemento) => grupo.filter((x) => x !== elemento);

  const candidatos = [];
  for (const i of grupoA) for (const j of grupoB) candidatos.push([[...sin(grupoA, i), j], [...sin(grupoB, j), i]]);
  if (grupoB.length < capacidad) for (const i of grupoA) candidatos.push([sin(grupoA, i), [...grupoB, i]]);
  if (grupoA.length < capacidad) for (const j of grupoB) candidatos.push([[...grupoA, j], sin(grupoB, j)]);

  for (const [nuevoA, nuevoB] of candidatos) {
    if (costoGrupo(nuevoA) + costoGrupo(nuevoB) < costoActual - TOLERANCIA_METROS) {
      grupos[a] = nuevoA;
      grupos[b] = nuevoB;
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Lista de despacho
// ---------------------------------------------------------------------------

/**
 * Calcula los recorridos y arma la lista de despacho con sus totales.
 * Devuelve {metodo, recorridos, lista, totales}.
 */
export function generarListaDespacho(paradas) {
  const metodo = paradas.length <= LIMITE_EXACTO ? 'exacto' : 'heuristico';
  const grupos = metodo === 'exacto' ? agruparExacto(paradas) : agruparHeuristico(paradas);

  const minimoPlano = (ruta) => Math.min(...ruta.orden.map((parada) => parada.numero_plano));
  const rutas = grupos
    .map((grupo) => mejorRecorrido(grupo.map((indice) => paradas[indice])))
    .sort((a, b) => a.salida_inicio.localeCompare(b.salida_inicio) || minimoPlano(a) - minimoPlano(b));

  const recorridos = [];
  const lista = [];
  let distanciaAcumulada = 0;
  rutas.forEach((ruta, indiceRuta) => {
    const numeroRecorrido = indiceRuta + 1;
    let puntoAnterior = bodega.coordenadasSalida(ruta.salida_inicio);
    ruta.orden.forEach((parada, indiceParada) => {
      const puntoParada = [parada.x, parada.y];
      distanciaAcumulada += bodega.distancia(puntoAnterior, puntoParada);
      puntoAnterior = puntoParada;
      for (const item of parada.items) {
        lista.push(filaDespacho(numeroRecorrido, indiceParada + 1, parada, item, distanciaAcumulada));
      }
    });
    distanciaAcumulada += bodega.distancia(puntoAnterior, bodega.coordenadasSalida(ruta.salida_fin));
    recorridos.push(resumenRecorrido(numeroRecorrido, ruta));
  });

  marcarMasDemorado(recorridos);
  return { metodo, recorridos, lista, totales: calcularTotales(recorridos, paradas.length) };
}

function filaDespacho(numeroRecorrido, orden, parada, item, distanciaAcumulada) {
  return {
    recorrido: numeroRecorrido,
    orden,
    codigo_ubicacion: item.codigo_ubicacion,
    numero_plano: parada.numero_plano,
    nivel: item.nivel,
    sku: item.sku,
    descripcion: item.descripcion,
    cantidad: item.cantidad,
    pedidos: item.pedidos,
    distancia_acum_m: redondear(distanciaAcumulada),
    tiempo_s: redondear(tiempoRecogidaNivel(item.nivel)),
  };
}

function resumenRecorrido(numeroRecorrido, ruta) {
  const tiempoCamino = tiempoDesplazamiento(ruta.distancia);
  const tiempoRecogida = ruta.orden.reduce((suma, parada) => suma + tiempoRecogidaParada(parada), 0);
  return {
    recorrido: numeroRecorrido,
    salida_inicio: ruta.salida_inicio,
    salida_fin: ruta.salida_fin,
    paradas: ruta.orden.map((p) => ({
      numero_plano: p.numero_plano,
      columna: p.columna,
      fila: p.fila,
      niveles: p.niveles,
      items: p.items.map(itemDeParada),
    })),
    distancia_m: redondear(ruta.distancia),
    tiempo_desplazamiento_s: redondear(tiempoCamino),
    tiempo_recogida_s: redondear(tiempoRecogida),
    tiempo_total_s: redondear(tiempoCamino + tiempoRecogida),
  };
}

/** Lo que se muestra de cada producto de una parada (para contar desde el recorrido). */
function itemDeParada(item) {
  return {
    sku: item.sku,
    descripcion: item.descripcion,
    nivel: item.nivel,
    codigo_ubicacion: item.codigo_ubicacion,
    cantidad: item.cantidad,
    cantidad_sistema: item.cantidad_sistema ?? null,
  };
}

/** Dato informativo: marca el recorrido que más tiempo toma (el primero, si hay empate). */
function marcarMasDemorado(recorridos) {
  if (recorridos.length === 0) return;
  const masDemorado = recorridos.reduce((mayor, recorrido) => (recorrido.tiempo_total_s > mayor.tiempo_total_s ? recorrido : mayor));
  for (const recorrido of recorridos) recorrido.es_el_mas_demorado = recorrido === masDemorado;
}

function calcularTotales(recorridos, cantidadParadas) {
  const sumar = (campo) => recorridos.reduce((suma, recorrido) => suma + recorrido[campo], 0);
  const tiempoCamino = sumar('tiempo_desplazamiento_s');
  const tiempoRecogida = sumar('tiempo_recogida_s');
  const masDemorado = recorridos.find((recorrido) => recorrido.es_el_mas_demorado);
  return {
    recorrido_mas_demorado: masDemorado ? masDemorado.recorrido : null,
    tiempo_mas_demorado_s: masDemorado ? masDemorado.tiempo_total_s : null,
    recorridos: recorridos.length,
    ubicaciones: cantidadParadas,
    distancia_m: redondear(sumar('distancia_m')),
    tiempo_desplazamiento_s: redondear(tiempoCamino),
    tiempo_recogida_s: redondear(tiempoRecogida),
    tiempo_total_s: redondear(tiempoCamino + tiempoRecogida),
    velocidad_m_s: VELOCIDAD_OPERARIO,
    tiempo_recogida_nivel_1_s: TIEMPO_RECOGIDA_NIVEL_1,
  };
}

/** Lista de despacho del pedido de prueba de la Tarea 6. */
export function pickingTarea6() {
  return generarListaDespacho(paradasTarea6());
}

/** Ruta de conteo de un sorteo: mismas reglas que la Tarea 6 (de a 3, exacto si son <= 12). */
export function pickingConteo(filas) {
  return generarListaDespacho(paradasDeConteo(filas));
}

/**
 * Lista de despacho de un lote de líneas de pedido (por ejemplo, los pedidos de un día).
 * Devuelve además `sin_ubicacion`: los SKU que no están en el maestro.
 */
export function pickingLote(lineas, ubicacionPorSku) {
  const { items, sin_ubicacion: sinUbicacion } = ubicarItems(consolidarLote(lineas), ubicacionPorSku);
  return { ...generarListaDespacho(paradasDesdeItems(items)), sin_ubicacion: sinUbicacion };
}

// ---------------------------------------------------------------------------
// Trazado para el mapa 3D y el robot
// ---------------------------------------------------------------------------

/**
 * Secuencia de tramos y paradas de un recorrido de la lista de despacho: sale por su
 * salida, visita las paradas en orden (recogiendo cada nivel) y vuelve a la salida.
 */
export function secuenciaRecorrido(recorrido) {
  const secuencia = [];
  let anterior = bodega.coordenadasSalida(recorrido.salida_inicio);
  recorrido.paradas.forEach((parada, indice) => {
    const lugar = bodega.coordenadasCelda(parada.columna, parada.fila);
    for (const tramo of bodega.tramosEntre(anterior, lugar)) secuencia.push({ tipo: 'tramo', ...tramo });
    const ubicaciones = parada.niveles.map((nivel) => ({
      codigo_ubicacion: bodega.codigoUbicacion(parada.columna, parada.fila, nivel),
      nivel,
      tiempo_recogida_s: tiempoRecogidaNivel(nivel),
    }));
    const items = parada.items ?? [];
    secuencia.push({
      tipo: 'parada',
      orden: indice + 1,
      etiqueta: String(parada.numero_plano),
      columna: parada.columna,
      fila: parada.fila,
      niveles: parada.niveles,
      ubicaciones,
      punto: lugar,
      items,
      tiempo_recogida_s: ubicaciones.reduce((suma, u) => suma + u.tiempo_recogida_s, 0),
    });
    anterior = lugar;
  });
  for (const tramo of bodega.tramosEntre(anterior, bodega.coordenadasSalida(recorrido.salida_fin))) {
    secuencia.push({ tipo: 'tramo', ...tramo });
  }
  return secuencia;
}

/** Agrega a cada recorrido de una lista de despacho su trazado punto por punto. */
export function agregarTrazado(resultado) {
  const recorridos = resultado.recorridos.map((recorrido) => ({ ...recorrido, trazado: armarTrazado(secuenciaRecorrido(recorrido)) }));
  return { ...resultado, recorridos: encadenarRecorridos(recorridos) };
}
