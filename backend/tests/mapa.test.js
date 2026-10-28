// Pruebas del mapa 3D: layout de las dos vistas, trazado de los recorridos e instrucciones del robot.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as bodega from '../src/bodega.js';
import * as datos from '../src/datos.js';
import * as layout from '../src/layout.js';
import * as maestro from '../src/maestro.js';
import * as maqueta from '../src/maqueta.js';
import * as picking from '../src/picking.js';
import * as robot from '../src/robot.js';
import { ESCALA_MAQUETA, NIVELES_MAQUETA, TIEMPO_RECOGIDA_NIVEL_1 } from '../src/config.js';

const { ventas, productos_nuevos: productosNuevos } = await datos.cargarDatos();
const referencias = maestro.generarMaestro(ventas, productosNuevos, null).referencias;
const logistica = maestro.leerLogisticaTarea1();

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

test('layout Arauca: 126 huecos, 123 ocupados, 2 niveles y 3 travesaños', () => {
  const vista = layout.layoutArauca(referencias);
  assert.equal(vista.celdas.length, 126);
  assert.equal(vista.celdas.filter((c) => c.ocupada).length, 123);
  assert.equal(vista.medidas.niveles, 2);
  assert.equal(vista.medidas.travesanos, 3);
  assert.deepEqual(new Set(vista.celdas.map((c) => c.nivel)), new Set([1, 2]));
  assert.equal(vista.salidas.length, 2);
  assert.equal(vista.cabeceras.length, 2);
  assert.equal(vista.pasillos.length, 4);
});

test('layout Arauca: cada celda trae su rack junto al pasillo y su punto de recogida', () => {
  const vista = layout.layoutArauca(referencias);
  const c1 = vista.celdas.find((c) => c.codigo_ubicacion === 'C1-F09-N1');
  assert.equal(c1.etiqueta, '1');
  assert.deepEqual([c1.x, c1.y], [1.5, 6.2]);
  assert.deepEqual(c1.punto_recogida, { x: 2.5, y: 6.2 });
  assert.ok(c1.sku && c1.clase_abc && c1.categoria);
  // Ningún rack queda dentro de un pasillo.
  for (const celda of vista.celdas) assert.ok(Math.abs(celda.x - celda.punto_recogida.x) >= vista.medidas.ancho_pasillo / 2);
  assert.ok(vista.celdas.every((c) => c.x >= vista.medidas.limites.x_min && c.x <= vista.medidas.limites.x_max));
});

test('layout maqueta: 15 posiciones en un nivel, 11 ocupadas con las referencias de logística', () => {
  const vista = layout.layoutMaqueta(referencias, logistica);
  assert.equal(vista.celdas.length, 15 * NIVELES_MAQUETA);
  assert.equal(vista.medidas.niveles, NIVELES_MAQUETA);
  const ocupadas = vista.celdas.filter((c) => c.ocupada);
  assert.equal(ocupadas.length, 11);
  assert.deepEqual(
    ocupadas.map((c) => `${c.etiqueta}:${c.sku}`),
    ['U01:200040', 'U02:300026', 'U03:300027', 'U04:400019', 'U05:300028', 'U06:100031', 'U07:200041', 'U08:200042', 'U09:100032', 'U10:100033', 'U11:400020'],
  );
  assert.ok(vista.celdas.filter((c) => !c.ocupada).every((c) => ['U12', 'U13', 'U14', 'U15'].includes(c.etiqueta)));
  assert.equal(vista.celdas.find((c) => c.etiqueta === 'U01').codigo_ubicacion, 'U01-N1-I');
});

test('maqueta: la identidad es el lugar en el anillo y los estantes I/D quedan a lados opuestos', () => {
  const posiciones = maqueta.posicionesMaqueta();
  assert.deepEqual(posiciones.map((p) => p.indice_anillo), Array.from({ length: 15 }, (_, i) => i + 1));
  assert.ok(posiciones.every((p, i) => i === 0 || p.s > posiciones[i - 1].s));
  // En el brazo izquierdo (se avanza hacia +y), I queda en x < 0 y D en x > 0.
  const u01 = posiciones.find((p) => p.codigo === 'U01');
  const u02 = posiciones.find((p) => p.codigo === 'U02');
  assert.ok(u01.centro_estante[0] < 0 && u02.centro_estante[0] > 0);
});

// ---------------------------------------------------------------------------
// Trazado
// ---------------------------------------------------------------------------

test('trazado Arauca: la suma de los tramos sigue dando 174,4 m', () => {
  const resultado = picking.agregarTrazado(picking.pickingTarea6());
  const total = resultado.recorridos.reduce((suma, r) => suma + r.trazado.distancia_m, 0);
  assert.ok(Math.abs(total - 174.4) < 1e-6, `total ${total}`);
  for (const r of resultado.recorridos) {
    assert.ok(Math.abs(r.trazado.distancia_m - r.distancia_m) < 1e-6);
    assert.ok(Math.abs(r.trazado.tiempo_total_s - r.tiempo_total_s) < 1e-6);
  }
});

test('trazado Arauca: los tramos son rectos, continuos y los tiempos encadenados', () => {
  for (const r of picking.agregarTrazado(picking.pickingTarea6()).recorridos) {
    let anterior = null;
    for (const evento of r.trazado.eventos) {
      if (anterior) assert.equal(evento.tiempo_inicio_s, anterior.tiempo_fin_s);
      if (evento.tipo === 'tramo') {
        assert.ok(evento.punto_inicio.x === evento.punto_fin.x || evento.punto_inicio.y === evento.punto_fin.y);
        assert.ok(['pasillo', 'cabecera', 'zona_abierta'].includes(evento.tipo_tramo));
      }
      anterior = evento;
    }
  }
});

test('trazado Arauca: cada parada espera su tiempo de recogida (T, 3T o 4T)', () => {
  const T = TIEMPO_RECOGIDA_NIVEL_1;
  const paradas = picking.agregarTrazado(picking.pickingTarea6()).recorridos.flatMap((r) => r.trazado.eventos.filter((e) => e.tipo === 'parada'));
  assert.equal(paradas.length, 9);
  const porEtiqueta = Object.fromEntries(paradas.map((p) => [p.etiqueta, p.tiempo_recogida_s]));
  assert.equal(porEtiqueta['4'], 4 * T);
  assert.equal(porEtiqueta['7'], T);
  assert.equal(porEtiqueta['49'], 3 * T);
});

test('la suma de tramosEntre es igual a distancia() para todos los pares de puntos', () => {
  const puntos = [...bodega.celdas().map((c) => bodega.coordenadasCelda(c.columna, c.fila)), [2, 0], [10.3, 0]];
  for (const a of puntos) {
    for (const b of puntos) {
      const suma = bodega.tramosEntre(a, b).reduce((s, t) => s + Math.abs(t.punto_inicio[0] - t.punto_fin[0]) + Math.abs(t.punto_inicio[1] - t.punto_fin[1]), 0);
      assert.ok(Math.abs(suma - bodega.distancia(a, b)) < 1e-9);
    }
  }
});

test('maqueta: 4 recorridos de máximo 3 que siguen el anillo y vuelven a la entrada', () => {
  const resultado = maqueta.pickingMaqueta(logistica);
  assert.equal(resultado.recorridos.length, 4);
  assert.deepEqual(resultado.recorridos.map((r) => r.paradas.length), [3, 3, 3, 2]);
  for (const r of resultado.recorridos) {
    // Cada recorrido da la vuelta completa a la U (circulación en un sentido).
    assert.ok(Math.abs(r.trazado.distancia_m - maqueta.perimetroAnillo()) < 1e-6);
    const tramos = r.trazado.eventos.filter((e) => e.tipo === 'tramo');
    assert.deepEqual(tramos[0].punto_inicio, { x: 0, y: 0 });
    assert.deepEqual(tramos.at(-1).punto_fin, { x: 0, y: 0 });
  }
});

// ---------------------------------------------------------------------------
// Robot
// ---------------------------------------------------------------------------

test('giros: derecha, izquierda y media vuelta', () => {
  assert.deepEqual(robot.girosEntre([0, 1], [1, 0]), ['girarDerecha']);
  assert.deepEqual(robot.girosEntre([0, 1], [-1, 0]), ['girarIzquierda']);
  assert.deepEqual(robot.girosEntre([0, 1], [0, -1]), ['girarDerecha', 'girarDerecha']);
  assert.deepEqual(robot.girosEntre([1, 0], [1, 0]), []);
});

test('instrucciones de la maqueta: 3 giros a la derecha por vuelta y centímetros a escala', () => {
  const r = maqueta.pickingMaqueta(logistica).recorridos[0];
  const resultado = robot.generarInstrucciones(r.trazado.eventos, ESCALA_MAQUETA);
  const giros = resultado.instrucciones.filter((i) => i.accion.startsWith('girar'));
  // La U se recorre en sentido horario: esquinas fondo-izq, fondo-der y frente-der, y al volver a la entrada.
  assert.ok(giros.every((g) => g.accion === 'girarDerecha'));
  assert.equal(resultado.instrucciones.filter((i) => i.accion === 'recoger').length, 3);
  assert.equal(resultado.total_cm, robot.metrosACentimetros(maqueta.perimetroAnillo(), ESCALA_MAQUETA));
  assert.equal(resultado.numero_instrucciones, resultado.instrucciones.length);
  assert.match(resultado.codigo_arduino, /const Instruccion RUTA\[\] = \{/);
});

test('instrucciones: la escala cambia los centímetros (1:20 = 5 cm por metro, 1:10 = 10 cm)', () => {
  assert.equal(robot.metrosACentimetros(1, 20), 5);
  assert.equal(robot.metrosACentimetros(1, 10), 10);
  const eventos = picking.agregarTrazado(picking.pickingTarea6()).recorridos[0].trazado.eventos;
  const a20 = robot.generarInstrucciones(eventos, 20).total_cm;
  const a10 = robot.generarInstrucciones(eventos, 10).total_cm;
  assert.ok(Math.abs(a10 - 2 * a20) < 0.5);
  assert.throws(() => robot.validarEscala(0), /mayor que 0/);
});

test('instrucciones Arauca: el recorrido 1 tiene media vuelta y recoge ambos niveles en la posición 4', () => {
  const eventos = picking.agregarTrazado(picking.pickingTarea6()).recorridos[0].trazado.eventos;
  const { instrucciones } = robot.generarInstrucciones(eventos, 20);
  assert.ok(instrucciones.some((i) => i.comentario === 'media vuelta (180°)'));
  const recoger = instrucciones.filter((i) => i.accion === 'recoger');
  assert.deepEqual(recoger.slice(0, 2).map((i) => [i.valor, i.comentario]), [[1, 'C1-F08-N1'], [2, 'C1-F08-N2']]);
});
