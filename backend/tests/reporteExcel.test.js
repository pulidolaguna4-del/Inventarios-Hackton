// Pruebas del escritor de .xlsx (reporteExcel.js) y de los reportes (reportes.js).
// Cada archivo se vuelve a leer con el lector del proyecto (excel.js, ExcelJS).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import ExcelJS from 'exceljs';
import { crearXlsx, escaparXml, indiceEstilo, letraColumna, COLORES } from '../src/reporteExcel.js';
import { hojasConteo, hojasMaestro, hojasPicking } from '../src/reportes.js';
import { abrirLibro, leerTabla } from '../src/excel.js';
import { pickingTarea6 } from '../src/picking.js';
import { verificarSorteos } from '../src/conteo.js';

const HOJA_DE_PRUEBA = {
  nombre: 'Prueba',
  titulo: 'Título & "comillas" <tags>',
  bloque: ['Línea de información'],
  columnas: [
    { titulo: 'SKU', formato: 'numero' },
    { titulo: 'Descripción', formato: 'texto' },
    { titulo: 'Distancia (m)', formato: 'decimal' },
  ],
  filas: [
    { valores: [100003, 'Válvula 1/2"', 57.6] },
    { valores: [200011, 'Tubo <A&B>', 12.25], fondo: 'nivel2' },
    { valores: ['TOTAL', null, 69.85], fondo: 'total' },
  ],
  zebra: true,
  leyenda: [{ texto: 'Nivel 2', fondo: 'nivel2' }],
  congelarEncabezado: true,
  autofiltro: true,
};

/** Nombres de los archivos dentro del zip, leídos del directorio central. */
function partesDelZip(buffer) {
  const fin = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const cantidad = buffer.readUInt16LE(fin + 10);
  let posicion = buffer.readUInt32LE(fin + 16);
  const nombres = [];
  for (let i = 0; i < cantidad; i++) {
    const largo = buffer.readUInt16LE(posicion + 28);
    const extra = buffer.readUInt16LE(posicion + 30);
    const comentario = buffer.readUInt16LE(posicion + 32);
    nombres.push(buffer.toString('utf8', posicion + 46, posicion + 46 + largo));
    posicion += 46 + largo + extra + comentario;
  }
  return nombres;
}

/** Contenido de una parte del zip (descomprimida), buscando su cabecera local. */
function leerParte(buffer, ruta) {
  let posicion = 0;
  while (buffer.readUInt32LE(posicion) === 0x04034b50) {
    const tamano = buffer.readUInt32LE(posicion + 18);
    const largo = buffer.readUInt16LE(posicion + 26);
    const extra = buffer.readUInt16LE(posicion + 28);
    const nombre = buffer.toString('utf8', posicion + 30, posicion + 30 + largo);
    const inicio = posicion + 30 + largo + extra;
    if (nombre === ruta) return zlib.inflateRawSync(buffer.subarray(inicio, inicio + tamano)).toString('utf8');
    posicion = inicio + tamano;
  }
  throw new Error(`No está la parte ${ruta}`);
}

function guardarTemporal(buffer) {
  const ruta = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'xlsx-')), 'prueba.xlsx');
  fs.writeFileSync(ruta, buffer);
  return ruta;
}

test('utilidades: letras de columna y escape de XML', () => {
  assert.deepEqual([1, 26, 27, 52, 703].map(letraColumna), ['A', 'Z', 'AA', 'AZ', 'AAA']);
  assert.equal(escaparXml('a & b < c > d "e"\u0001'), 'a &amp; b &lt; c &gt; d &quot;e&quot;');
  assert.throws(() => indiceEstilo('morado'), /Fondo desconocido/);
});

test('el zip trae todas las partes del .xlsx', () => {
  const buffer = crearXlsx([HOJA_DE_PRUEBA, { ...HOJA_DE_PRUEBA, nombre: 'Otra' }]);
  assert.deepEqual(partesDelZip(buffer), [
    '[Content_Types].xml',
    '_rels/.rels',
    'xl/workbook.xml',
    'xl/_rels/workbook.xml.rels',
    'xl/styles.xml',
    'xl/worksheets/sheet1.xml',
    'xl/worksheets/sheet2.xml',
  ]);
  const hoja = leerParte(buffer, 'xl/worksheets/sheet1.xml');
  assert.match(hoja, /t="inlineStr"/);
  assert.match(hoja, /<v>57\.6<\/v>/); // número crudo, sin t
  assert.ok(!hoja.includes('sharedStrings'));
  // Orden que exige Excel: sheetData, autoFilter y después mergeCells.
  assert.ok(hoja.indexOf('</sheetData>') < hoja.indexOf('<autoFilter') && hoja.indexOf('<autoFilter') < hoja.indexOf('<mergeCells'));
});

test('se vuelve a leer con excel.js: encabezados, valores y textos escapados', async () => {
  const libro = await abrirLibro(guardarTemporal(crearXlsx([HOJA_DE_PRUEBA])));
  const filas = leerTabla(libro, 'Prueba', 4); // título, bloque, fila vacía, encabezado
  assert.deepEqual(filas[0], { SKU: 100003, Descripción: 'Válvula 1/2"', 'Distancia (m)': 57.6 });
  assert.deepEqual(filas[1], { SKU: 200011, Descripción: 'Tubo <A&B>', 'Distancia (m)': 12.25 });
  assert.equal(libro.getWorksheet('Prueba').getCell('A1').value, 'Título & "comillas" <tags>');
});

test('formato: título combinado, encabezado congelado, autofiltro, colores, decimales y anchos', async () => {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(crearXlsx([HOJA_DE_PRUEBA]));
  const hoja = libro.getWorksheet('Prueba');
  assert.ok(hoja.model.merges.includes('A1:C1'));
  assert.deepEqual([hoja.views[0].state, hoja.views[0].ySplit], ['frozen', 4]);
  assert.equal(typeof hoja.autoFilter === 'string' ? hoja.autoFilter : hoja.autoFilter.ref ?? `${hoja.autoFilter.from}:${hoja.autoFilter.to}`, 'A4:C7');
  assert.equal(hoja.getCell('A1').font.bold, true);
  assert.equal(hoja.getCell('A4').fill.fgColor.argb, `FF${COLORES.oscuro}`);
  assert.equal(hoja.getCell('A6').fill.fgColor.argb, `FF${COLORES.nivel2}`);
  assert.equal(hoja.getCell('A7').font.bold, true); // total
  assert.equal(hoja.getCell('A7').border.top.style, 'medium');
  assert.equal(hoja.getCell('C5').numFmt, '0.0');
  assert.equal(hoja.getCell('A9').fill.fgColor.argb, `FF${COLORES.nivel2}`); // leyenda
  assert.ok(hoja.getColumn(2).width >= 'Válvula 1/2"'.length);
});

test('nombres de hoja inválidos o filas más largas que las columnas no se aceptan', () => {
  assert.throws(() => crearXlsx([{ ...HOJA_DE_PRUEBA, nombre: 'a/b' }]), /Nombre de hoja inválido/);
  assert.throws(() => crearXlsx([{ ...HOJA_DE_PRUEBA, filas: [{ valores: [1, 2, 3, 4] }] }]), /más valores que columnas/);
});

test('reporte de picking: filas por nivel, subtotal por recorrido y total general de 174,4 m', async () => {
  const resultado = pickingTarea6();
  const [hoja] = hojasPicking(resultado);
  const total = hoja.filas.at(-1);
  assert.equal(total.valores[0], 'TOTAL GENERAL');
  assert.equal(total.valores[6], 174.4);
  assert.equal(hoja.filas.filter((fila) => String(fila.valores[4]).startsWith('Subtotal')).length, 3);
  // La posición 4 tiene ambos niveles (4T), la 49 solo el nivel 2.
  const fondoDe = (plano) => hoja.filas.find((fila) => fila.valores[3] === plano).fondo;
  assert.deepEqual([fondoDe(4), fondoDe(7), fondoDe(49)], ['ambos', 'nivel1', 'nivel2']);
  const libro = await abrirLibro(guardarTemporal(crearXlsx(hojasPicking(resultado))));
  // leerTabla salta la fila vacía entre la tabla y la leyenda: quedan los datos y las 3 líneas de la leyenda.
  assert.equal(leerTabla(libro, 'Picking', 5).length, hoja.filas.length + hoja.leyenda.length);
});

test('reporte de conteo: verificación marca REVISAR si no son exactamente 5 y muestra la semilla', () => {
  const referencias = [{ sku: 1, descripcion: 'Uno' }, { sku: 2, descripcion: 'Dos' }];
  const sorteos = Array.from({ length: 5 }, (_, i) => ({ numero: i + 1, fecha_hora: '2026-10-29T08:00:00', semilla: 100 + i, skus: i < 4 ? [1, 2] : [1] }));
  const [, verificacion, semillas] = hojasConteo({ sorteos, referencias, registros: [], verificacion: verificarSorteos(sorteos, [1, 2]) });
  assert.deepEqual(verificacion.filas.map((f) => [f.valores[2], f.valores[4], f.fondo]), [[5, 'OK', undefined], [4, 'REVISAR', 'alerta']]);
  assert.ok(verificacion.bloque.some((linea) => linea.includes('104')));
  assert.equal(semillas.filas.length, 5);
});

test('reporte del maestro: cada fila con el color de su clase ABC', () => {
  const [hoja] = hojasMaestro({
    conteo_por_clase: { A: 1, B: 1, C: 1 },
    referencias: ['A', 'B', 'C'].map((clase, i) => ({ sku: i, descripcion: 'x', categoria: 'y', popularidad: 1, clase_abc: clase, codigo_ubicacion: 'C1-F01-N1', nivel: 1 })),
  });
  assert.deepEqual(hoja.filas.map((fila) => fila.fondo), ['claseA', 'claseB', 'claseC']);
});
