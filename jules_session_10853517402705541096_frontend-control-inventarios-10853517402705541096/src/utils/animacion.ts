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

/** Códigos de ubicación de las paradas de la línea, separados en ya visitados y pendientes. */
export function ubicacionesPorEstado(linea: LineaDeTiempo, t: number): { visitadas: Set<string>; pendientes: Set<string> } {
  const visitadas = new Set<string>();
  const pendientes = new Set<string>();
  for (const evento of linea.eventos) {
    if (evento.tipo !== 'parada') continue;
    const destino = evento.t_fin <= t ? visitadas : pendientes;
    for (const ubicacion of (evento as EventoParada).ubicaciones) destino.add(ubicacion.codigo_ubicacion);
  }
  return { visitadas, pendientes };
}

/** Segundos -> "m:ss". */
export function formatearTiempo(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
