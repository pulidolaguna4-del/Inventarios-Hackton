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
