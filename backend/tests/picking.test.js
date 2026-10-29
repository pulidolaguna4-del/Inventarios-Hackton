import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as picking from '../src/picking.js';
import { TIEMPO_RECOGIDA_NIVEL_1 } from '../src/config.js';

const resultado = picking.pickingTarea6();

test('Tarea 6: 3 recorridos y 174,4 m', () => {
  assert.equal(resultado.metodo, 'exacto');
  assert.equal(resultado.totales.recorridos, 3);
  assert.ok(Math.abs(resultado.totales.distancia_m - 174.4) < 1e-9);
});

test('Tarea 6: los grupos óptimos son {4, 7, 60}, {25, 21, 55} y {49, 44, 41}', () => {
  const grupos = resultado.recorridos.map((r) => r.paradas.map((p) => p.numero_plano).sort((a, b) => a - b).join(','));
  assert.deepEqual(new Set(grupos), new Set(['4,7,60', '21,25,55', '41,44,49']));
  assert.ok(resultado.recorridos.every((r) => r.salida_inicio === 'DER' && r.salida_fin === 'DER'));
});

test('se marca un solo recorrido como el más demorado', () => {
  const marcados = resultado.recorridos.filter((r) => r.es_el_mas_demorado);
  assert.equal(marcados.length, 1);
  assert.equal(marcados[0].tiempo_total_s, Math.max(...resultado.recorridos.map((r) => r.tiempo_total_s)));
  assert.equal(resultado.totales.recorrido_mas_demorado, marcados[0].recorrido);
});

test('tiempo de recogida: 3 × 4T + 3 × T + 3 × 3T = 24T', () => {
  assert.ok(Math.abs(resultado.totales.tiempo_recogida_s - 24 * TIEMPO_RECOGIDA_NIVEL_1) < 1e-9);
});

test('consolidar el lote suma cantidades por SKU y guarda los pedidos', () => {
  const consolidado = picking.consolidarLote([
    { id_pedido: 2, sku: 400016, descripcion: 'a', cantidad: 5 },
    { id_pedido: 1, sku: 100017, descripcion: 'b', cantidad: 1 },
    { id_pedido: 1, sku: 400016, descripcion: 'a', cantidad: 3 },
  ]);
  assert.deepEqual(consolidado.map((c) => c.sku), [100017, 400016]);
  assert.equal(consolidado[1].cantidad, 8);
  assert.deepEqual(consolidado[1].pedidos, [1, 2]);
});

test('dos niveles de la misma celda son una sola parada', () => {
  const paradas = picking.paradasDesdeItems([{ codigo_ubicacion: 'C1-F08-N2' }, { codigo_ubicacion: 'C1-F08-N1' }]);
  assert.equal(paradas.length, 1);
  assert.deepEqual(paradas[0].niveles, [1, 2]);
});

test('con muchas paradas se usa la heurística y ningún grupo pasa de 3', () => {
  const items = [];
  for (let fila = 1; fila <= 9; fila += 2) for (let columna = 1; columna <= 7; columna += 2) items.push({ codigo_ubicacion: `C${columna}-F0${fila}-N1` });
  const lista = picking.generarListaDespacho(picking.paradasDesdeItems(items));
  assert.equal(lista.metodo, 'heuristico');
  assert.ok(lista.recorridos.every((r) => r.paradas.length <= 3));
  assert.equal(lista.recorridos.reduce((suma, r) => suma + r.paradas.length, 0), items.length);
});

test('ruta de conteo: dos referencias en la misma celda son una parada de 4T y traen lo necesario para contar', () => {
  const filas = [
    { sku: 100001, descripcion: 'Uno', codigo_ubicacion: 'C1-F08-N1', cantidad_sistema: 10 },
    { sku: 100002, descripcion: 'Dos', codigo_ubicacion: 'C1-F08-N2', cantidad_sistema: 7 },
    { sku: 200001, descripcion: 'Tres', codigo_ubicacion: 'C7-F01-N1', cantidad_sistema: 3 },
  ];
  const conteo = picking.pickingConteo(filas);
  assert.equal(conteo.metodo, 'exacto');
  assert.equal(conteo.totales.ubicaciones, 2);
  const parada = conteo.recorridos.flatMap((r) => r.paradas).find((p) => p.columna === 1);
  assert.deepEqual(parada.niveles, [1, 2]);
  assert.deepEqual(parada.items.map((i) => [i.sku, i.cantidad_sistema]), [[100001, 10], [100002, 7]]);
  assert.equal(picking.tiempoRecogidaParada({ items: parada.items }), 4 * TIEMPO_RECOGIDA_NIVEL_1);
});

test('ruta de conteo de 12 ubicaciones: exacta, de a 3 y con el mismo algoritmo que la Tarea 6', () => {
  const filas = [];
  for (let fila = 1; fila <= 6; fila++) for (const columna of [2, 6]) filas.push({ sku: fila * 10 + columna, codigo_ubicacion: `C${columna}-F0${fila}-N1` });
  const conteo = picking.pickingConteo(filas);
  assert.equal(conteo.metodo, 'exacto');
  assert.equal(conteo.recorridos.length, 4);
  assert.ok(conteo.recorridos.every((r) => r.paradas.length === 3 && r.salida_inicio === r.salida_fin));
});

test('lote de pedidos: consolida por SKU y separa los que no tienen ubicación', () => {
  const lineas = [
    { id_pedido: 1, sku: 100017, cantidad: 2 },
    { id_pedido: 2, sku: 100017, cantidad: 1 },
    { id_pedido: 2, sku: 999999, cantidad: 1 },
  ];
  const lote = picking.pickingLote(lineas, { 100017: 'C2-F05-N1' });
  assert.deepEqual(lote.sin_ubicacion, [999999]);
  assert.equal(lote.lista.length, 1);
  assert.equal(lote.lista[0].cantidad, 3);
});
