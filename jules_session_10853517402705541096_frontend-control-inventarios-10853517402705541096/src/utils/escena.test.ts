import { describe, expect, it } from 'vitest';
import { cajasDeSku, crearConversor, franjasSeguridad, piezasEstanterias, textoSalida } from './escena';
import { construirLinea, nivelHorquillas } from './animacion';
import type { CeldaLayout, LayoutBodega, RecorridoConTrazado } from '../types/inventario';

const celda = (codigo: string, nivel: number, ocupada: boolean, sku: number | null): CeldaLayout => ({
  codigo_ubicacion: codigo,
  columna: 1,
  fila: 1,
  nivel,
  etiqueta: '18',
  x: 1.5,
  y: 10,
  z: (nivel - 1) * 1.5 + 0.75,
  punto_recogida: { x: 2.5, y: 10 },
  ocupada,
  sku,
  descripcion: null,
  clase_abc: 'A',
  categoria: null,
});

/** Un estante de 2 niveles (uno ocupado y uno vacío) junto a un pasillo vertical. */
const layout: LayoutBodega = {
  vista: 'arauca',
  nombre: 'Prueba',
  medidas: {
    ancho_total: 4,
    largo_total: 20,
    limites: { x_min: 0, x_max: 4, y_min: 0, y_max: 20 },
    niveles: 2,
    travesanos: 3,
    alto_nivel: 1.5,
    largo_celda: 2.4,
    fondo_rack: 1,
    ancho_pasillo: 1,
    alto_zona_abierta: 5,
  } as LayoutBodega['medidas'],
  celdas: [celda('C1-F01-N1', 1, true, 100020), celda('C1-F01-N2', 2, false, null)],
  salidas: [{ nombre: 'IZQ', x: 2, y: 0 }],
  cabeceras: [],
  pasillos: [{ nombre: 'P1', tipo: 'pasillo', x_inicio: 2.5, y_inicio: 5, x_fin: 2.5, y_fin: 15 }],
};

describe('Escena 3D: piezas a partir del layout', () => {
  it('las cajas de un SKU salen siempre iguales (1 a 4, sin repetir hueco)', () => {
    for (const sku of [100020, 200015, 400019, 300001]) {
      const cajas = cajasDeSku(sku);
      expect(cajasDeSku(sku)).toEqual(cajas);
      expect(cajas.length).toBeGreaterThanOrEqual(1);
      expect(cajas.length).toBeLessThanOrEqual(4);
      expect(new Set(cajas.map((c) => c.hueco)).size).toBe(cajas.length);
    }
  });

  it('un estante tiene 4 parales, 2 vigas por travesaño, una estiba por celda y cajas solo en la ocupada', () => {
    const piezas = piezasEstanterias(layout, crearConversor(layout));
    expect(piezas.parales).toHaveLength(4);
    expect(piezas.vigas).toHaveLength(2 * 3);
    expect(piezas.estibas).toHaveLength(2);
    expect(piezas.cajas).toHaveLength(cajasDeSku(100020).length);
    expect(piezas.etiquetas).toHaveLength(2);
    expect(piezas.celdas.map((c) => c.codigo_ubicacion)).toEqual(['C1-F01-N1', 'C1-F01-N2']);
    // La estiba del nivel 2 queda sobre la viga intermedia (1,5 m).
    expect(piezas.estibas[1].posicion[1]).toBeGreaterThan(1.5);
    // La etiqueta va al frente, del lado del pasillo (x mayor que el centro del estante).
    expect(piezas.etiquetas[0].posicion[0]).toBeGreaterThan(crearConversor(layout)(1.5, 10)[0]);
  });

  it('las franjas de seguridad alternan amarillo y negro a ambos lados del pasillo y en la zona abierta', () => {
    const franjas = franjasSeguridad(layout, crearConversor(layout));
    expect(franjas.length).toBe(20 + 20 + 6); // 10 m de pasillo a cada lado y 3,4 m de zona abierta, en tramos de 0,5 m
    expect(franjas.slice(0, 4).map((f) => f.tono)).toEqual([0, 1, 0, 1]);
    expect(textoSalida('IZQ')).toBe('SALIDA IZQ');
    expect(textoSalida('ENTRADA')).toBe('ENTRADA');
  });
});

describe('Horquillas del montacargas', () => {
  /** Avanza 10 s, se detiene en una parada de ambos niveles (T = 20 s en N1 y 3T = 60 s en N2) y vuelve. */
  const recorrido: RecorridoConTrazado = {
    recorrido: 1,
    salida_inicio: 'DER',
    salida_fin: 'DER',
    paradas: [],
    distancia_m: 20,
    tiempo_desplazamiento_s: 20,
    tiempo_recogida_s: 80,
    tiempo_total_s: 100,
    es_el_mas_demorado: false,
    tiempo_inicio_global_s: 0,
    tiempo_fin_global_s: 100,
    trazado: {
      distancia_m: 20,
      tiempo_total_s: 100,
      eventos: [
        { tipo: 'tramo', tipo_tramo: 'pasillo', punto_inicio: { x: 0, y: 0 }, punto_fin: { x: 0, y: 10 }, distancia_m: 10, distancia_acum_inicio_m: 0, distancia_acum_fin_m: 10, tiempo_inicio_s: 0, tiempo_fin_s: 10 },
        {
          tipo: 'parada',
          orden: 1,
          etiqueta: '4',
          niveles: [1, 2],
          ubicaciones: [
            { codigo_ubicacion: 'C1-F08-N2', nivel: 2, tiempo_recogida_s: 60 },
            { codigo_ubicacion: 'C1-F08-N1', nivel: 1, tiempo_recogida_s: 20 },
          ],
          punto: { x: 0, y: 10 },
          tiempo_recogida_s: 80,
          distancia_acum_m: 10,
          tiempo_inicio_s: 10,
          tiempo_fin_s: 90,
        },
        { tipo: 'tramo', tipo_tramo: 'pasillo', punto_inicio: { x: 0, y: 10 }, punto_fin: { x: 0, y: 0 }, distancia_m: 10, distancia_acum_inicio_m: 10, distancia_acum_fin_m: 20, tiempo_inicio_s: 90, tiempo_fin_s: 100 },
      ],
    },
  };
  const linea = construirLinea([recorrido], 'todos');

  it('abajo mientras avanza; en ambos niveles, primero el 1 (T) y luego el 2 (3T); al final baja', () => {
    expect(nivelHorquillas(linea, 5)).toBe(0);
    expect(nivelHorquillas(linea, 10)).toBe(0);
    expect(nivelHorquillas(linea, 25)).toBe(1); // dentro de los 20 s del nivel 1
    expect(nivelHorquillas(linea, 70)).toBe(2); // dentro de los 60 s del nivel 2
    const subiendo = nivelHorquillas(linea, 34); // cambiando de nivel 1 a 2
    expect(subiendo).toBeGreaterThan(1);
    expect(subiendo).toBeLessThan(2);
    expect(nivelHorquillas(linea, 89)).toBeLessThan(1); // bajando al final de la parada
    expect(nivelHorquillas(linea, 95)).toBe(0);
  });
});
