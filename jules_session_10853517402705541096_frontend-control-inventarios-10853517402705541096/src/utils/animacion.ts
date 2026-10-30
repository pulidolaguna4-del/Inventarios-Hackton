// Animación del carrito como función del tiempo.
//
// La posición se deriva SOLO del tiempo transcurrido: dado t, se busca el evento del
// trazado que lo contiene y se interpola. No hay pasos acumulados, así que se puede saltar
// a cualquier segundo con la barra de la línea de tiempo y el carrito queda en su lugar exacto.

import type { EventoParada, EventoTrazado, RecorridoConTrazado } from '../types/inventario';

/** Un evento del trazado ubicado en la línea de tiempo que se está reproduciendo. */
export type EventoLinea = EventoTrazado & {
  recorrido: number;
  /** Segundos de inicio y fin dentro de la línea de tiempo. */
  t_inicio: number;
  t_fin: number;
  /** Metros recorridos en los recorridos anteriores (al reproducir varios seguidos). */
  distancia_previa_m: number;
};

export interface LineaDeTiempo {
  eventos: EventoLinea[];
  duracion: number;
  distancia_total_m: number;
  total_paradas: number;
}

export interface EstadoCarrito {
  x: number;
  y: number;
  /** Dirección en que mira el carrito (unitaria). */
  dx: number;
  dy: number;
  indice: number;
  recorrido: number;
  distancia_m: number;
  paradas_completas: number;
  en_parada: boolean;
  terminado: boolean;
}

/** Arma la línea de tiempo de un recorrido o de todos seguidos. */
export function construirLinea(recorridos: RecorridoConTrazado[], seleccion: number | 'todos'): LineaDeTiempo {
  const elegidos = seleccion === 'todos' ? recorridos : recorridos.filter((r) => r.recorrido === seleccion);
  const eventos: EventoLinea[] = [];
  let tiempoPrevio = 0;
  let distanciaPrevia = 0;
  for (const recorrido of elegidos) {
    for (const evento of recorrido.trazado.eventos) {
      eventos.push({
        ...evento,
        recorrido: recorrido.recorrido,
        t_inicio: tiempoPrevio + evento.tiempo_inicio_s,
        t_fin: tiempoPrevio + evento.tiempo_fin_s,
        distancia_previa_m: distanciaPrevia,
      });
    }
    tiempoPrevio += recorrido.trazado.tiempo_total_s;
    distanciaPrevia += recorrido.trazado.distancia_m;
  }
  return {
    eventos,
    duracion: tiempoPrevio,
    distancia_total_m: distanciaPrevia,
    total_paradas: eventos.filter((e) => e.tipo === 'parada').length,
  };
}

/** Índice del evento que contiene el instante t (búsqueda binaria; t ya acotado). */
function indiceEnTiempo(eventos: EventoLinea[], t: number): number {
  let bajo = 0;
  let alto = eventos.length - 1;
  while (bajo < alto) {
    const medio = (bajo + alto + 1) >> 1;
    if (eventos[medio].t_inicio <= t) bajo = medio;
    else alto = medio - 1;
  }
  return bajo;
}

/** Dirección del último tramo en o antes del evento `indice` (el carrito mira hacia allá). */
function direccionHasta(eventos: EventoLinea[], indice: number): [number, number] {
  for (let i = indice; i >= 0; i--) {
    const evento = eventos[i];
    if (evento.tipo === 'tramo') {
      return [Math.sign(evento.punto_fin.x - evento.punto_inicio.x), Math.sign(evento.punto_fin.y - evento.punto_inicio.y)];
    }
  }
  return [0, 1];
}

/** Estado del carrito en el instante t (segundos desde el inicio de la línea de tiempo). */
export function estadoEnTiempo(linea: LineaDeTiempo, t: number): EstadoCarrito | null {
  const { eventos, duracion } = linea;
  if (eventos.length === 0) return null;
  const tiempo = Math.min(Math.max(t, 0), duracion);
  const indice = indiceEnTiempo(eventos, tiempo);
  const evento = eventos[indice];
  const [dx, dy] = direccionHasta(eventos, indice);
  const paradasCompletas = eventos.filter((e) => e.tipo === 'parada' && e.t_fin <= tiempo).length;
  const base = { indice, recorrido: evento.recorrido, dx, dy, paradas_completas: paradasCompletas, terminado: tiempo >= duracion };

  if (evento.tipo === 'parada') {
    return { ...base, x: evento.punto.x, y: evento.punto.y, distancia_m: evento.distancia_previa_m + evento.distancia_acum_m, en_parada: tiempo < evento.t_fin };
  }
  const largo = evento.t_fin - evento.t_inicio;
  const fraccion = largo > 0 ? Math.min((tiempo - evento.t_inicio) / largo, 1) : 1;
  return {
    ...base,
    x: evento.punto_inicio.x + (evento.punto_fin.x - evento.punto_inicio.x) * fraccion,
    y: evento.punto_inicio.y + (evento.punto_fin.y - evento.punto_inicio.y) * fraccion,
    distancia_m: evento.distancia_previa_m + evento.distancia_acum_inicio_m + evento.distancia_m * fraccion,
    en_parada: false,
  };
}

// ---------------------------------------------------------------------------
// Paradas de la línea: sincronía entre la animación y la tabla del recorrido
// ---------------------------------------------------------------------------

/** Una parada de la línea de tiempo, en el orden en que el carrito la visita. */
export type ParadaLinea = EventoParada & EventoLinea;

/** Las paradas de la línea, en orden de visita. */
export function paradasDeLinea(linea: LineaDeTiempo): ParadaLinea[] {
  return linea.eventos.filter((evento): evento is ParadaLinea => evento.tipo === 'parada');
}

/** Identifica una parada: "recorrido-orden". */
export const claveParada = (parada: { recorrido: number; orden: number }) => `${parada.recorrido}-${parada.orden}`;

/** Dónde está el carrito respecto a la parada `indice`: yendo hacia ella o detenido en ella. */
export type FaseParada = 'en_camino' | 'aqui' | 'terminado';

export interface ParadaActiva {
  /** Índice en `paradasDeLinea`: la primera parada que todavía no termina (o el total si ya no queda ninguna). */
  indice: number;
  fase: FaseParada;
}

/** Parada activa en el instante t (búsqueda binaria: se puede llamar en cada cuadro). */
export function paradaActivaEnTiempo(paradas: ParadaLinea[], t: number): ParadaActiva {
  let bajo = 0;
  let alto = paradas.length;
  while (bajo < alto) {
    const medio = (bajo + alto) >> 1;
    if (paradas[medio].t_fin <= t) bajo = medio + 1;
    else alto = medio;
  }
  if (bajo >= paradas.length) return { indice: paradas.length, fase: 'terminado' };
  return { indice: bajo, fase: t >= paradas[bajo].t_inicio ? 'aqui' : 'en_camino' };
}

export const mismaParadaActiva = (a: ParadaActiva, b: ParadaActiva) => a.indice === b.indice && a.fase === b.fase;

export type EstadoParada = 'pendiente' | 'en_camino' | 'aqui' | 'visitada';

/** Estado de la parada `indice` según la parada activa. */
export function estadoParada(indice: number, activa: ParadaActiva): EstadoParada {
  if (indice < activa.indice) return 'visitada';
  if (indice > activa.indice) return 'pendiente';
  return activa.fase === 'aqui' ? 'aqui' : 'en_camino';
}

/** Códigos de ubicación de las paradas, separados en ya visitados y pendientes según la parada activa. */
export function ubicacionesPorEstado(paradas: ParadaLinea[], activa: ParadaActiva): { visitadas: Set<string>; pendientes: Set<string> } {
  const visitadas = new Set<string>();
  const pendientes = new Set<string>();
  paradas.forEach((parada, indice) => {
    const destino = indice < activa.indice ? visitadas : pendientes;
    for (const ubicacion of parada.ubicaciones) destino.add(ubicacion.codigo_ubicacion);
  });
  return { visitadas, pendientes };
}

// ---------------------------------------------------------------------------
// Horquillas del montacargas
// ---------------------------------------------------------------------------

/** Parte de cada tramo de la parada que se usa para subir (o cambiar de nivel) y, al final, para bajar. */
const FRACCION_SUBIR = 0.3;
const FRACCION_BAJAR = 0.2;

const suavizar = (f: number) => f * f * (3 - 2 * f);

/**
 * Nivel de las horquillas en el instante t, como número continuo: 0 = abajo (transporte),
 * 1 = nivel 1, 2 = nivel 2. En una parada recorre sus ubicaciones de menor a mayor nivel y
 * cada una dura su tiempo de recogida (T o 3T); en "ambos niveles" primero el 1 (T) y luego
 * el 2 (3T). Al final de la parada vuelve a bajar. Así el movimiento dura lo mismo que la parada.
 */
export function nivelHorquillas(linea: LineaDeTiempo, t: number): number {
  const { eventos, duracion } = linea;
  if (eventos.length === 0) return 0;
  const tiempo = Math.min(Math.max(t, 0), duracion);
  const evento = eventos[indiceEnTiempo(eventos, tiempo)];
  if (evento.tipo !== 'parada' || tiempo >= evento.t_fin) return 0;

  const ubicaciones = [...evento.ubicaciones].sort((a, b) => a.nivel - b.nivel);
  let inicio = evento.t_inicio;
  let previo = 0;
  for (let i = 0; i < ubicaciones.length; i++) {
    const { nivel, tiempo_recogida_s: duracionTramo } = ubicaciones[i];
    const fin = inicio + duracionTramo;
    if (tiempo < fin || i === ubicaciones.length - 1) {
      const f = duracionTramo > 0 ? Math.min((tiempo - inicio) / duracionTramo, 1) : 1;
      if (f < FRACCION_SUBIR) return previo + (nivel - previo) * suavizar(f / FRACCION_SUBIR);
      if (i === ubicaciones.length - 1 && f > 1 - FRACCION_BAJAR) return nivel * (1 - suavizar((f - (1 - FRACCION_BAJAR)) / FRACCION_BAJAR));
      return nivel;
    }
    previo = nivel;
    inicio = fin;
  }
  return 0;
}

/** Segundos -> "m:ss". */
export function formatearTiempo(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
