// Maqueta del robot Arduino: la bodega en U del entregable de logística (Tarea 1).
//
// La U es un pasillo con estantes a ambos lados. El operario (o el robot) entra por el
// brazo izquierdo, recorre el fondo, regresa por el brazo derecho y sale por el frente; el
// frente une la salida con la entrada y cierra un anillo. La circulación es en un solo sentido.
//
// Coordenadas (metros "reales"): la entrada está en (0, 0) y el anillo pasa por
// (0, L) -> (W, L) -> (W, 0) -> (0, 0), con L = LARGO_BRAZO_U y W = ANCHO_FONDO_U.
// Una posición se identifica por su lugar en el anillo; su código U.. es solo una etiqueta.

import { armarTrazado, encadenarRecorridos } from './trazado.js';
import { tiempoRecogidaNivel, tiempoDesplazamiento } from './picking.js';
import { redondear } from './maestro.js';
import {
  ANCHO_FONDO_U,
  ANCHO_PASILLO_U,
  CAPACIDAD_RECORRIDO,
  FONDO_ESTANTE_U,
  LADOS_ANILLO_U,
  LARGO_BRAZO_U,
  MARGEN_POSICIONES_U,
  NIVELES_MAQUETA,
  SEPARACION_POSICIONES_U,
  TOLERANCIA_METROS,
} from './config.js';

// ---------------------------------------------------------------------------
// El anillo
// ---------------------------------------------------------------------------

/** Lados del anillo en orden de recorrido, con su punto de inicio, dirección y largo. */
export function ladosDelAnillo() {
  const L = LARGO_BRAZO_U;
  const W = ANCHO_FONDO_U;
  const lados = [
    { nombre: 'izquierdo', inicio: [0, 0], direccion: [0, 1], largo: L, tipo_tramo: 'pasillo' },
    { nombre: 'fondo', inicio: [0, L], direccion: [1, 0], largo: W, tipo_tramo: 'pasillo' },
    { nombre: 'derecho', inicio: [W, L], direccion: [0, -1], largo: L, tipo_tramo: 'pasillo' },
    { nombre: 'frente', inicio: [W, 0], direccion: [-1, 0], largo: W, tipo_tramo: 'frente' },
  ];
  let acumulado = 0;
  return lados.map((lado) => {
    const conInicio = { ...lado, s_inicio: acumulado };
    acumulado += lado.largo;
    return conInicio;
  });
}

/** Largo total del anillo (perímetro de la U cerrada por el frente). */
export function perimetroAnillo() {
  return 2 * (LARGO_BRAZO_U + ANCHO_FONDO_U);
}

/** Distancia sobre el anillo desde la entrada hasta la salida (fin del brazo derecho). */
export function sSalida() {
  return 2 * LARGO_BRAZO_U + ANCHO_FONDO_U;
}

/** Lado del anillo en que cae la distancia `s` (0 <= s < perímetro). */
function ladoEn(s) {
  const lados = ladosDelAnillo();
  return lados.find((lado) => s < lado.s_inicio + lado.largo - TOLERANCIA_METROS) ?? lados.at(-1);
}

/** Punto [x, y] del pasillo a una distancia `s` de la entrada, medida sobre el anillo. */
export function puntoEnAnillo(s) {
  const lado = ladoEn(s);
  const avance = s - lado.s_inicio;
  return [lado.inicio[0] + lado.direccion[0] * avance, lado.inicio[1] + lado.direccion[1] * avance];
}

/**
 * Tramos rectos para ir por el anillo desde `sDesde` hasta `sHasta` (sHasta >= sDesde,
 * puede llegar al perímetro). Se cortan en las esquinas de la U.
 */
export function tramosAnillo(sDesde, sHasta) {
  const tramos = [];
  for (const lado of ladosDelAnillo()) {
    const inicio = Math.max(sDesde, lado.s_inicio);
    const fin = Math.min(sHasta, lado.s_inicio + lado.largo);
    if (fin - inicio <= TOLERANCIA_METROS) continue;
    const punto = (s) => [lado.inicio[0] + lado.direccion[0] * (s - lado.s_inicio), lado.inicio[1] + lado.direccion[1] * (s - lado.s_inicio)];
    tramos.push({ tipo_tramo: lado.tipo_tramo, punto_inicio: punto(inicio), punto_fin: punto(fin) });
  }
  return tramos;
}

// ---------------------------------------------------------------------------
// Posiciones
// ---------------------------------------------------------------------------

/** Código de una posición de la maqueta en un nivel, ej. ('U01', 1, 'I') -> 'U01-N1-I'. */
export function codigoMaqueta(codigo, nivel, lado) {
  return `${codigo}-N${nivel}-${lado}`;
}

/**
 * Las 15 posiciones de la U en el orden del anillo, con su punto de recogida (en el
 * centro del pasillo) y el centro del estante (a la izquierda o derecha del pasillo
 * según el sentido de avance). Lanza error si las posiciones no caben en su lado.
 */
export function posicionesMaqueta() {
  const lados = new Map(ladosDelAnillo().map((lado) => [lado.nombre, lado]));
  const desplazamiento = ANCHO_PASILLO_U / 2 + FONDO_ESTANTE_U / 2;
  const posiciones = [];
  for (const grupo of LADOS_ANILLO_U) {
    const lado = lados.get(grupo.lado_anillo);
    grupo.posiciones.forEach((posicion, indice) => {
      const avance = MARGEN_POSICIONES_U + indice * SEPARACION_POSICIONES_U;
      if (avance > lado.largo + TOLERANCIA_METROS) {
        throw new Error(`La posición ${posicion.codigo} no cabe en el lado ${lado.nombre} de la U (${avance} m > ${lado.largo} m)`);
      }
      const s = lado.s_inicio + avance;
      const [x, y] = puntoEnAnillo(s);
      // Normal a la izquierda del sentido de avance: (-dy, dx).
      const signo = posicion.lado === 'I' ? 1 : -1;
      const centro = [x - lado.direccion[1] * desplazamiento * signo, y + lado.direccion[0] * desplazamiento * signo];
      posiciones.push({
        indice_anillo: posiciones.length + 1,
        ...posicion,
        lado_anillo: lado.nombre,
        s,
        punto_recogida: [x, y],
        centro_estante: centro,
      });
    });
  }
  return posiciones;
}

/** Límites del dibujo de la maqueta: el anillo más los estantes de ambos lados. */
export function limitesMaqueta() {
  const borde = ANCHO_PASILLO_U / 2 + FONDO_ESTANTE_U;
  return { x_min: -borde, x_max: ANCHO_FONDO_U + borde, y_min: -borde, y_max: LARGO_BRAZO_U + borde };
}

/**
 * Posiciones ocupadas de la maqueta según el entregable de logística, en orden del anillo.
 * `logistica` es Map sku -> {ubicacion_logistica, ...}. Devuelve [{posicion, sku, nivel}].
 */
export function ocupacionMaqueta(logistica) {
  const porCodigo = new Map();
  for (const posicion of posicionesMaqueta()) {
    for (let nivel = 1; nivel <= NIVELES_MAQUETA; nivel++) {
      porCodigo.set(codigoMaqueta(posicion.codigo, nivel, posicion.lado), { posicion, nivel });
    }
  }
  const ocupadas = [];
  for (const fila of logistica.values()) {
    const lugar = porCodigo.get(fila.ubicacion_logistica);
    if (!lugar) throw new Error(`La ubicación de logística ${fila.ubicacion_logistica} (SKU ${fila.sku}) no existe en la maqueta`);
    ocupadas.push({ ...lugar, sku: fila.sku });
  }
  return ocupadas.sort((a, b) => a.posicion.s - b.posicion.s || a.nivel - b.nivel);
}

// ---------------------------------------------------------------------------
// Recorridos del robot en la maqueta
// ---------------------------------------------------------------------------

/**
 * Recorridos de la maqueta: las posiciones ocupadas, en el orden del anillo, se reparten
 * en grupos de máximo CAPACIDAD_RECORRIDO (regla del caso). Cada recorrido sale de la
 * entrada, sigue la U en el sentido de circulación recogiendo en sus posiciones, sale por
 * el frente y vuelve a la entrada por el frente común.
 * Devuelve el mismo formato que la lista de despacho de Arauca, con su trazado.
 */
export function pickingMaqueta(logistica) {
  const ocupadas = ocupacionMaqueta(logistica);
  const grupos = [];
  for (let i = 0; i < ocupadas.length; i += CAPACIDAD_RECORRIDO) grupos.push(ocupadas.slice(i, i + CAPACIDAD_RECORRIDO));

  const recorridos = grupos.map((grupo, indice) => {
    const secuencia = [];
    let sActual = 0;
    grupo.forEach((ocupada, orden) => {
      const { posicion, nivel } = ocupada;
      for (const tramo of tramosAnillo(sActual, posicion.s)) secuencia.push({ tipo: 'tramo', ...tramo });
      secuencia.push({
        tipo: 'parada',
        orden: orden + 1,
        etiqueta: posicion.codigo,
        indice_anillo: posicion.indice_anillo,
        niveles: [nivel],
        ubicaciones: [{ codigo_ubicacion: codigoMaqueta(posicion.codigo, nivel, posicion.lado), nivel, sku: ocupada.sku, tiempo_recogida_s: tiempoRecogidaNivel(nivel) }],
        punto: posicion.punto_recogida,
        tiempo_recogida_s: tiempoRecogidaNivel(nivel),
      });
      sActual = posicion.s;
    });
    for (const tramo of tramosAnillo(sActual, perimetroAnillo())) secuencia.push({ tipo: 'tramo', ...tramo });
    const trazado = armarTrazado(secuencia);
    const tiempoRecogida = grupo.reduce((suma, o) => suma + tiempoRecogidaNivel(o.nivel), 0);
    const tiempoCamino = tiempoDesplazamiento(trazado.distancia_m);
    return {
      recorrido: indice + 1,
      salida_inicio: 'ENTRADA',
      salida_fin: 'ENTRADA',
      paradas: grupo.map((o) => ({ etiqueta: o.posicion.codigo, indice_anillo: o.posicion.indice_anillo, niveles: [o.nivel], sku: o.sku })),
      distancia_m: redondear(trazado.distancia_m),
      tiempo_desplazamiento_s: redondear(tiempoCamino),
      tiempo_recogida_s: redondear(tiempoRecogida),
      tiempo_total_s: redondear(tiempoCamino + tiempoRecogida),
      trazado,
    };
  });

  const masDemorado = recorridos.reduce((mayor, r) => (mayor === null || r.tiempo_total_s > mayor.tiempo_total_s ? r : mayor), null);
  for (const r of recorridos) r.es_el_mas_demorado = r === masDemorado;
  const sumar = (campo) => redondear(recorridos.reduce((suma, r) => suma + r[campo], 0));
  return {
    metodo: 'anillo',
    recorridos: encadenarRecorridos(recorridos),
    totales: {
      recorrido_mas_demorado: masDemorado?.recorrido ?? null,
      tiempo_mas_demorado_s: masDemorado?.tiempo_total_s ?? null,
      recorridos: recorridos.length,
      ubicaciones: ocupadas.length,
      distancia_m: sumar('distancia_m'),
      tiempo_desplazamiento_s: sumar('tiempo_desplazamiento_s'),
      tiempo_recogida_s: sumar('tiempo_recogida_s'),
      tiempo_total_s: sumar('tiempo_total_s'),
    },
  };
}
