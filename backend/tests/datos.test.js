// Pruebas con el Excel real del caso, el maestro y los pedidos.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as datos from '../src/datos.js';
import * as maestro from '../src/maestro.js';
import * as pedidos from '../src/pedidos.js';

const { ventas, productos_nuevos: productosNuevos } = await datos.cargarDatos();

test('el Excel trae 19.357 líneas, 7.974 órdenes y 3.245 de Arauca', () => {
  const resumen = datos.calcularResumen(ventas, productosNuevos);
  assert.equal(ventas.length, 19357);
  assert.equal(resumen.ordenes_totales, 7974);
  assert.equal(resumen.ordenes_bodega, 3245);
  assert.equal(resumen.referencias_ventas, 112);
  assert.equal(resumen.referencias_nuevas, 11);
  assert.equal(resumen.referencias_totales, 123);
  assert.equal(resumen.fecha_inicial, '2018-01-02');
  assert.equal(resumen.fecha_final, '2018-12-28');
  assert.equal(resumen.dias_con_pedidos_bodega, 247);
});

test('los productos nuevos traen 12 meses y su demanda anual', () => {
  for (const producto of productosNuevos) {
    assert.equal(producto.demanda_mensual.length, 12);
    assert.equal(producto.demanda_anual, producto.demanda_mensual.reduce((a, b) => a + b, 0));
  }
});

test('la categoría sale del primer dígito del SKU', () => {
  assert.equal(datos.categoriaDeSku(100017), 'Aire acondicionado');
  assert.equal(datos.categoriaDeSku(200040), 'Equipos de audio');
  assert.equal(datos.categoriaDeSku(300023), 'Equipos de cómputo');
  assert.equal(datos.categoriaDeSku(400016), 'Refrigeración');
  assert.equal(datos.categoriaDeSku(900001), 'Sin categoría');
});

test('conversión de valores del Excel', () => {
  assert.equal(datos.aEntero(400016.0), 400016);
  assert.equal(datos.aEntero(' '), null);
  assert.equal(datos.aFecha(43102), '2018-01-02');
  assert.equal(datos.aFecha('05/03/2018'), '2018-03-05');
  assert.equal(datos.aFecha('31/02/2018'), null);
});

test('el maestro clasifica 42 A, 36 B y 45 C y ubica las 123 referencias sin repetir', () => {
  const generado = maestro.generarMaestro(ventas, productosNuevos, null);
  assert.deepEqual(generado.conteo_por_clase, { A: 42, B: 36, C: 45 });
  const codigos = generado.referencias.map((r) => r.codigo_ubicacion);
  assert.equal(new Set(codigos).size, 123);
  // Los primeros 63 huecos son de nivel 1.
  assert.ok(generado.referencias.slice(0, 63).every((r) => r.nivel === 1));
});

test('el CSV de logística manda sobre las ubicaciones generadas', () => {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'inventarios-'));
  const ruta = path.join(carpeta, 'maestro_logistica.csv');
  fs.writeFileSync(ruta, 'sku;codigo_ubicacion;clase_abc\n400017;C7-F01-N2;C\n');
  const generado = maestro.generarMaestro(ventas, productosNuevos, ruta);
  const fila = generado.referencias.find((r) => r.sku === 400017);
  assert.equal(fila.codigo_ubicacion, 'C7-F01-N2');
  assert.equal(fila.clase_abc, 'C');
  assert.equal(generado.fuente, 'logistica + generado');
  fs.rmSync(carpeta, { recursive: true });
});

test('los pedidos solo avanzan al estado siguiente', () => {
  let estados = pedidos.cambiarEstado({}, 1, 'En alistamiento');
  assert.equal(estados['1'].estado, 'En alistamiento');
  assert.throws(() => pedidos.cambiarEstado(estados, 1, 'Entregado'), /solo puede pasar/);
  for (const estado of ['Alistado', 'En entrega', 'Entregado']) estados = pedidos.cambiarEstado(estados, 1, estado);
  assert.equal(estados['1'].historial.length, 4);
  assert.throws(() => pedidos.cambiarEstado(estados, 1, 'Pendiente'), /no puede cambiar/);
});

test('los pedidos de un día se agrupan con sus líneas', () => {
  const lista = pedidos.agruparPedidos(ventas, 'Arauca', '2018-01-02');
  assert.ok(lista.length > 0);
  assert.ok(lista.every((p) => p.fecha === '2018-01-02' && p.unidades > 0 && p.referencias >= 1));
});

test('el CSV usa punto y coma, BOM y une las listas con coma', () => {
  const texto = datos.textoCsv([{ sku: 400016, descripcion: 'Válvula', pedidos: [1, 2] }], ['sku', 'descripcion', 'pedidos']);
  assert.equal(texto, '﻿sku;descripcion;pedidos\r\n400016;Válvula;1, 2\r\n');
});

test('el entregable de logística se agrega como alias sin tocar ubicación ni clase del sistema', () => {
  const generado = maestro.generarMaestro(ventas, productosNuevos, null);
  const conLogistica = maestro.agregarDatosLogistica(generado.referencias, maestro.leerLogisticaTarea1());
  const conAlias = conLogistica.filter((r) => r.ubicacion_logistica !== null);
  assert.equal(conAlias.length, 11);
  assert.ok(conAlias.every((r) => r.es_nueva && /^U\d{2}-N1-[ID]$/.test(r.ubicacion_logistica)));
  assert.ok(conLogistica.filter((r) => !r.es_nueva).every((r) => r.ubicacion_logistica === null && r.clase_abc_logistica === null));
  // Los campos propios del sistema quedan iguales.
  conLogistica.forEach((r, i) => {
    assert.equal(r.codigo_ubicacion, generado.referencias[i].codigo_ubicacion);
    assert.equal(r.clase_abc, generado.referencias[i].clase_abc);
  });
  const r100033 = conLogistica.find((r) => r.sku === 100033);
  assert.equal(r100033.ubicacion_logistica, 'U10-N1-D');
  assert.equal(r100033.clase_abc_logistica, 'B');
});

test('la demanda del entregable de logística es la demanda anual del Excel', () => {
  const logistica = maestro.leerLogisticaTarea1();
  for (const producto of productosNuevos) assert.equal(logistica.get(producto.sku).demanda_anual, producto.demanda_anual);
});

test('el CSV usa los títulos de las columnas y formatea para Excel en español', () => {
  const columnas = [
    { campo: 'distancia', titulo: 'Distancia (m)' },
    { campo: 'nueva', titulo: 'Referencia nueva' },
    { campo: 'fecha_hora', titulo: 'Fecha y hora' },
    { campo: 'vacio', titulo: 'Vacío' },
  ];
  const texto = datos.textoCsv([{ distancia: 57.6, nueva: true, fecha_hora: '2026-10-29T09:44:29', vacio: null }], columnas);
  assert.equal(texto, '﻿Distancia (m);Referencia nueva;Fecha y hora;Vacío\r\n57,6;Sí;2026-10-29 09:44:29;\r\n');
});
