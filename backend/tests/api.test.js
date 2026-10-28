// Pruebas de la API levantando el servidor en un puerto libre.
// Solo usan rutas que no modifican los datos guardados.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../src/app.js';
import { cargarDatos } from '../src/datos.js';

let servidor;
let base;

before(async () => {
  await cargarDatos();
  servidor = crearApp().listen(0);
  await new Promise((resolver) => servidor.once('listening', resolver));
  base = `http://localhost:${servidor.address().port}/api`;
});

after(() => servidor.close());

async function pedir(ruta, opciones) {
  const respuesta = await fetch(base + ruta, opciones);
  return { codigo: respuesta.status, cuerpo: await respuesta.json() };
}

function enviar(ruta, cuerpo) {
  return pedir(ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo });
}

test('GET /api/resumen', async () => {
  const { codigo, cuerpo } = await pedir('/resumen');
  assert.equal(codigo, 200);
  assert.equal(cuerpo.referencias_totales, 123);
});

test('GET /api/conteo/progreso trae los totales del año y la verificación', async () => {
  const { cuerpo } = await pedir('/conteo/progreso');
  assert.equal(cuerpo.verificacion.valido, true);
  assert.equal(cuerpo.conteos_totales, 615);
  assert.equal(cuerpo.avance_semanal.length, 52);
  assert.equal(cuerpo.cantidad_sorteo_por_defecto, 12);
  assert.equal(cuerpo.periodos.length, 5);
});

test('GET /api/maestro trae la ubicación y la clase de logística como campos aparte', async () => {
  const { cuerpo } = await pedir('/maestro');
  const fila = cuerpo.referencias.find((r) => r.sku === 200040);
  assert.equal(fila.ubicacion_logistica, 'U01-N1-I');
  assert.equal(fila.clase_abc_logistica, 'A');
  assert.match(fila.codigo_ubicacion, /^C\d-F\d{2}-N\d$/);
  assert.equal(cuerpo.referencias.filter((r) => r.ubicacion_logistica).length, 11);
});

test('GET /api/picking/prueba', async () => {
  const { cuerpo } = await pedir('/picking/prueba');
  assert.equal(cuerpo.totales.distancia_m, 174.4);
});

test('errores: sorteo inexistente, ruta inexistente y JSON mal formado', async () => {
  assert.equal((await pedir('/conteo/sorteo/999')).codigo, 400);
  assert.equal((await pedir('/no-existe')).codigo, 404);
  const malo = await enviar('/conteo/registro', '{malo');
  assert.equal(malo.codigo, 400);
  assert.match(malo.cuerpo.error, /JSON/);
});

test('registrar sin responsable responde 400 y no guarda nada', async () => {
  const { codigo, cuerpo } = await enviar('/conteo/registro', JSON.stringify({ sorteo: 1, sku: 1, cantidad_contada: 1 }));
  assert.equal(codigo, 400);
  assert.match(cuerpo.error, /responsable/);
});

test('un pedido no puede saltarse estados', async () => {
  const { codigo, cuerpo } = await enviar('/pedidos/46882122/estado', JSON.stringify({ estado: 'Entregado' }));
  assert.equal(codigo, 400);
  assert.match(cuerpo.error, /solo puede pasar/);
});

test('sortear con una cantidad inválida responde 400 y no guarda nada', async () => {
  const { codigo, cuerpo } = await enviar('/conteo/sorteo', JSON.stringify({ cantidad: 0, forzar: true }));
  assert.equal(codigo, 400);
  assert.match(cuerpo.error, /mayor que 0/);
});

test('exportar con un nombre inválido responde 400', async () => {
  const { codigo } = await pedir('/exportar/maestro?nombre=../malo');
  assert.equal(codigo, 400);
});

test('GET /api/bodega/layout para las dos vistas y vista inválida', async () => {
  const arauca = await pedir('/bodega/layout');
  assert.equal(arauca.cuerpo.vista, 'arauca');
  assert.equal(arauca.cuerpo.celdas.length, 126);
  const maqueta = await pedir('/bodega/layout?vista=maqueta');
  assert.equal(maqueta.cuerpo.celdas.filter((c) => c.ocupada).length, 11);
  assert.equal((await pedir('/bodega/layout?vista=otra')).codigo, 400);
});

test('GET /api/picking/prueba?con_trazado=true trae el trazado y sigue sumando 174,4 m', async () => {
  const { cuerpo } = await pedir('/picking/prueba?con_trazado=true');
  const total = cuerpo.recorridos.reduce((suma, r) => suma + r.trazado.distancia_m, 0);
  assert.ok(Math.abs(total - 174.4) < 1e-6);
  assert.ok(cuerpo.recorridos[0].trazado.eventos.length > 0);
  const sinTrazado = await pedir('/picking/prueba');
  assert.equal(sinTrazado.cuerpo.recorridos[0].trazado, undefined);
});

test('GET /api/picking/instrucciones: por defecto maqueta 1:20; la escala llega por la URL', async () => {
  const porDefecto = await pedir('/picking/instrucciones');
  assert.equal(porDefecto.cuerpo.vista, 'maqueta');
  assert.equal(porDefecto.cuerpo.escala, 20);
  assert.equal(porDefecto.cuerpo.recorrido, 1);
  const a10 = await pedir('/picking/instrucciones?escala=10');
  assert.ok(Math.abs(a10.cuerpo.total_cm - 2 * porDefecto.cuerpo.total_cm) < 0.5);
  const arauca = await pedir('/picking/instrucciones?vista=arauca&recorrido=3');
  assert.equal(arauca.cuerpo.recorrido, 3);
  assert.equal((await pedir('/picking/instrucciones?recorrido=9')).codigo, 400);
  assert.equal((await pedir('/picking/instrucciones?escala=0')).codigo, 400);
});
