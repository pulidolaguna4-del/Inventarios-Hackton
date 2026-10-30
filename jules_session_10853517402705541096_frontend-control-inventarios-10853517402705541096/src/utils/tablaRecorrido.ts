// Filas de la tabla del recorrido: una por ubicación, en el orden en que el carrito las visita
// y agrupadas por recorrido. Es la misma lista para los tres orígenes; en la Tarea 6 no hay SKU.

import type { EventoParada, PickingConTrazado } from '../types/inventario';
import { claveParada } from './animacion';

/** Veces T que se detiene el carrito por nivel (nivel 2 = 3T, como en el backend). */
const VECES_T_POR_NIVEL: Record<number, number> = { 1: 1, 2: 3 };

export interface FilaRecorrido {
  /** "recorrido-orden": la parada a la que pertenece la fila. */
  clave_parada: string;
  recorrido: number;
  orden: number;
  /** Número del plano (Arauca) o código U.. (maqueta). */
  etiqueta: string;
  codigo_ubicacion: string;
  nivel: number;
  /** Tiempo detenido en esta ubicación y cuántas T son. */
  tiempo_s: number;
  veces_t: number;
  sku: number | null;
  descripcion: string | null;
  cantidad_sistema: number | null;
}

export interface GrupoRecorrido {
  recorrido: number;
  paradas: number;
  distancia_m: number;
  /** Tiempo total del recorrido (caminar + paradas). */
  tiempo_s: number;
  filas: FilaRecorrido[];
}

/** Arma los grupos de la tabla a partir de los recorridos con trazado. */
export function gruposDelRecorrido(picking: PickingConTrazado): GrupoRecorrido[] {
  const t = picking.totales.tiempo_recogida_nivel_1_s;
  return picking.recorridos.map((recorrido) => {
    const eventos = recorrido.trazado.eventos.filter((evento): evento is EventoParada => evento.tipo === 'parada');
    const filas = eventos.flatMap((evento) => {
      const items = recorrido.paradas[evento.orden - 1]?.items;
      // Sin productos (maqueta), las filas salen de las ubicaciones del trazado.
      const ubicaciones = items?.length
        ? items.map((item) => ({ ...item, tiempo: evento.ubicaciones.find((u) => u.codigo_ubicacion === item.codigo_ubicacion)?.tiempo_recogida_s }))
        : evento.ubicaciones.map((u) => ({ codigo_ubicacion: u.codigo_ubicacion, nivel: u.nivel, tiempo: u.tiempo_recogida_s, sku: u.sku ?? null, descripcion: null, cantidad_sistema: null }));
      return ubicaciones.map((u): FilaRecorrido => {
        const vecesNivel = VECES_T_POR_NIVEL[u.nivel] ?? 1;
        const tiempo = u.tiempo ?? (t ? t * vecesNivel : 0);
        return {
          clave_parada: claveParada({ recorrido: recorrido.recorrido, orden: evento.orden }),
          recorrido: recorrido.recorrido,
          orden: evento.orden,
          etiqueta: evento.etiqueta,
          codigo_ubicacion: u.codigo_ubicacion,
          nivel: u.nivel,
          tiempo_s: tiempo,
          veces_t: t ? Math.round(tiempo / t) : vecesNivel,
          sku: u.sku ?? null,
          descripcion: u.descripcion || null,
          cantidad_sistema: u.cantidad_sistema ?? null,
        };
      });
    });
    return { recorrido: recorrido.recorrido, paradas: eventos.length, distancia_m: recorrido.distancia_m, tiempo_s: recorrido.tiempo_total_s, filas };
  });
}

/** "T", "3T"… */
export const textoVecesT = (veces: number) => (veces === 1 ? 'T' : `${veces}T`);