// Trazado de un recorrido para la animación del mapa 3D y para las instrucciones del robot.
//
// Un trazado es la lista ordenada de eventos de un recorrido: tramos rectos (el carrito
// avanza) y paradas (el carrito se detiene a recoger). Cada evento trae su tiempo de inicio
// y de fin, así la animación es una función del tiempo: dado t, se sabe dónde está el carrito.

import { VELOCIDAD_OPERARIO } from './config.js';

const DECIMALES = 3;

/** Redondea a 3 decimales (milímetros y milésimas de segundo). */
function redondear(numero) {
  return Math.round(numero * 10 ** DECIMALES) / 10 ** DECIMALES;
}

function punto([x, y]) {
  return { x: redondear(x), y: redondear(y) };
}

/** Largo de un tramo recto horizontal o vertical. */
export function largoTramo(tramo) {
  return Math.abs(tramo.punto_inicio[0] - tramo.punto_fin[0]) + Math.abs(tramo.punto_inicio[1] - tramo.punto_fin[1]);
}

/**
 * Arma los eventos de un recorrido con distancias y tiempos acumulados.
 *
 * `secuencia` es una lista de:
 * - {tipo: 'tramo', tipo_tramo, punto_inicio: [x, y], punto_fin: [x, y]}
 * - {tipo: 'parada', tiempo_recogida_s, ...datos de la parada}
 * Devuelve {eventos, distancia_m, tiempo_total_s}.
 */
export function armarTrazado(secuencia, velocidad = VELOCIDAD_OPERARIO) {
  let distancia = 0;
  let tiempo = 0;
  const eventos = secuencia.map((paso) => {
    if (paso.tipo === 'tramo') {
      const largo = largoTramo(paso);
      const evento = {
        tipo: 'tramo',
        tipo_tramo: paso.tipo_tramo,
        punto_inicio: punto(paso.punto_inicio),
        punto_fin: punto(paso.punto_fin),
        distancia_m: redondear(largo),
        distancia_acum_inicio_m: redondear(distancia),
        distancia_acum_fin_m: redondear(distancia + largo),
        tiempo_inicio_s: redondear(tiempo),
        tiempo_fin_s: redondear(tiempo + largo / velocidad),
      };
      distancia += largo;
      tiempo += largo / velocidad;
      return evento;
    }
    const { tipo, punto: lugar, tiempo_recogida_s: espera, ...datos } = paso;
    const evento = {
      tipo,
      ...datos,
      punto: punto(lugar),
      tiempo_recogida_s: redondear(espera),
      distancia_acum_m: redondear(distancia),
      tiempo_inicio_s: redondear(tiempo),
      tiempo_fin_s: redondear(tiempo + espera),
    };
    tiempo += espera;
    return evento;
  });
  return { eventos, distancia_m: redondear(distancia), tiempo_total_s: redondear(tiempo) };
}

/**
 * Pone uno tras otro los trazados de varios recorridos ("reproducir los tres seguidos"):
 * a cada recorrido le agrega el segundo global en que empieza y termina.
 */
export function encadenarRecorridos(recorridosConTrazado) {
  let inicio = 0;
  return recorridosConTrazado.map((recorrido) => {
    const conTiempos = {
      ...recorrido,
      tiempo_inicio_global_s: redondear(inicio),
      tiempo_fin_global_s: redondear(inicio + recorrido.trazado.tiempo_total_s),
    };
    inicio += recorrido.trazado.tiempo_total_s;
    return conTiempos;
  });
}
