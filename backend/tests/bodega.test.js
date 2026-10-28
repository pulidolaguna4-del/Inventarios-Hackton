import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as bodega from '../src/bodega.js';

test('el código de ubicación se arma y se interpreta igual', () => {
  assert.equal(bodega.codigoUbicacion(3, 4, 2), 'C3-F04-N2');
  assert.deepEqual(bodega.interpretarCodigo('c3-f04-n2'), { columna: 3, fila: 4, nivel: 2 });
  assert.throws(() => bodega.interpretarCodigo('C9-F04-N1'), /columna/);
  assert.throws(() => bodega.interpretarCodigo('C3-F04-N3'), /nivel/);
  assert.throws(() => bodega.interpretarCodigo('X'), /inválido/);
});

test('los números repetidos del plano (22 y 35) aparecen dos veces', () => {
  assert.equal(bodega.buscarPorNumero(22).length, 2);
  assert.equal(bodega.buscarPorNumero(35).length, 2);
  assert.throws(() => bodega.celdaUnicaPorNumero(22), /repetido/);
  assert.deepEqual(bodega.celdaUnicaPorNumero(4), { columna: 1, fila: 8 });
});

test('hay 63 celdas y 126 huecos de picking', () => {
  assert.equal(bodega.celdas().length, 63);
  assert.equal(bodega.huecos().length, 126);
});

test('coordenadas: la fila 9 queda en y = 6,2 y la fila 1 en y = 25,4', () => {
  assert.deepEqual(bodega.coordenadasCelda(1, 9), [2.5, 6.2]);
  const [, yFila1] = bodega.coordenadasCelda(7, 1);
  assert.ok(Math.abs(yFila1 - 25.4) < 1e-9);
});

test('distancia en el mismo pasillo es solo la diferencia de altura', () => {
  assert.ok(Math.abs(bodega.distancia([2.5, 10], [2.5, 20]) - 10) < 1e-9);
});

test('distancia entre pasillos usa la cabecera más corta', () => {
  // Cerca de abajo: por la cabecera inferior (y = 2,5).
  const abajo = bodega.distancia([2.5, 6.2], [5.6, 6.2]);
  assert.ok(Math.abs(abajo - (3.7 + 3.1 + 3.7)) < 1e-9);
  // Cerca de arriba: por la cabecera superior (y = 27,6).
  const arriba = bodega.distancia([2.5, 25.4], [5.6, 25.4]);
  assert.ok(Math.abs(arriba - (2.2 + 3.1 + 2.2)) < 1e-9);
});

test('desde la zona abierta la distancia es Manhattan directa', () => {
  assert.ok(Math.abs(bodega.distancia([10.3, 0], [8.7, 6.2]) - (1.6 + 6.2)) < 1e-9);
});

test('distancia de un recorrido de ida y vuelta', () => {
  const total = bodega.distanciaRecorrido([{ columna: 1, fila: 9 }], 'IZQ');
  assert.ok(Math.abs(total - 2 * (0.5 + 6.2)) < 1e-9);
});
