import { describe, it, expect } from 'vitest';
import { construirLinea, estadoEnTiempo, formatearTiempo, ubicacionesPorEstado } from './animacion';
import type { RecorridoConTrazado } from '../types/inventario';

/** Recorrido de prueba: avanza 10 m hacia +y, recoge 20 s y vuelve 10 m. */
function recorridoDePrueba(numero: number, inicioGlobal: number): RecorridoConTrazado {
  return {
    recorrido: numero,
    salida_inicio: 'DER',
    salida_fin: 'DER',
    paradas: [],
    distancia_m: 20,
    tiempo_desplazamiento_s: 20,
    tiempo_recogida_s: 20,
    tiempo_total_s: 40,
    es_el_mas_demorado: false,
    tiempo_inicio_global_s: inicioGlobal,
    tiempo_fin_global_s: inicioGlobal + 40,
    trazado: {
      distancia_m: 20,
      tiempo_total_s: 40,
      eventos: [
        { tipo: 'tramo', tipo_tramo: 'pasillo', punto_inicio: { x: 0, y: 0 }, punto_fin: { x: 0, y: 10 }, distancia_m: 10, distancia_acum_inicio_m: 0, distancia_acum_fin_m: 10, tiempo_inicio_s: 0, tiempo_fin_s: 10 },
        { tipo: 'parada', orden: 1, etiqueta: '4', niveles: [1], ubicaciones: [{ codigo_ubicacion: `C${numero}-F08-N1`, nivel: 1, tiempo_recogida_s: 20 }], punto: { x: 0, y: 10 }, tiempo_recogida_s: 20, distancia_acum_m: 10, tiempo_inicio_s: 10, tiempo_fin_s: 30 },
        { tipo: 'tramo', tipo_tramo: 'pasillo', punto_inicio: { x: 0, y: 10 }, punto_fin: { x: 0, y: 0 }, distancia_m: 10, distancia_acum_inicio_m: 10, distancia_acum_fin_m: 20, tiempo_inicio_s: 30, tiempo_fin_s: 40 },
      ],
    },
  };
}

const recorridos = [recorridoDePrueba(1, 0), recorridoDePrueba(2, 40)];

describe('Animación del carrito como función del tiempo', () => {
  it('interpola la posición dentro de un tramo', () => {
    const estado = estadoEnTiempo(construirLinea(recorridos, 1), 5)!;
    expect(estado.x).toBe(0);
    expect(estado.y).toBe(5);
    expect(estado.distancia_m).toBe(5);
    expect([estado.dx, estado.dy]).toEqual([0, 1]);
  });

  it('se detiene en la parada durante el tiempo de recogida', () => {
    const linea = construirLinea(recorridos, 1);
    for (const t of [10, 20, 29.9]) {
      const estado = estadoEnTiempo(linea, t)!;
      expect(estado.y).toBe(10);
      expect(estado.en_parada).toBe(true);
      expect(estado.distancia_m).toBe(10);
    }
    expect(estadoEnTiempo(linea, 30)!.paradas_completas).toBe(1);
  });

  it('saltar a cualquier instante da el mismo resultado sin importar el orden (barra de arrastre)', () => {
    const linea = construirLinea(recorridos, 1);
    const directo = estadoEnTiempo(linea, 35);
    estadoEnTiempo(linea, 2);
    estadoEnTiempo(linea, 39);
    expect(estadoEnTiempo(linea, 35)).toEqual(directo);
    expect(directo!.y).toBe(5);
    expect([directo!.dx, directo!.dy]).toEqual([0, -1]);
  });

  it('acota el tiempo al inicio y al final', () => {
    const linea = construirLinea(recorridos, 1);
    expect(estadoEnTiempo(linea, -5)!.y).toBe(0);
    const final = estadoEnTiempo(linea, 999)!;
    expect(final.y).toBe(0);
    expect(final.terminado).toBe(true);
    expect(final.distancia_m).toBe(20);
  });

  it('reproduce todos los recorridos seguidos sumando tiempos y distancias', () => {
    const linea = construirLinea(recorridos, 'todos');
    expect(linea.duracion).toBe(80);
    expect(linea.distancia_total_m).toBe(40);
    expect(linea.total_paradas).toBe(2);
    const estado = estadoEnTiempo(linea, 45)!;
    expect(estado.recorrido).toBe(2);
    expect(estado.y).toBe(5);
    expect(estado.distancia_m).toBe(25);
  });

  it('separa las ubicaciones visitadas de las pendientes', () => {
    const linea = construirLinea(recorridos, 'todos');
    const { visitadas, pendientes } = ubicacionesPorEstado(linea, 50);
    expect([...visitadas]).toEqual(['C1-F08-N1']);
    expect([...pendientes]).toEqual(['C2-F08-N1']);
  });

  it('formatea el tiempo como m:ss', () => {
    expect(formatearTiempo(0)).toBe('0:00');
    expect(formatearTiempo(237.6)).toBe('3:57');
  });
});
