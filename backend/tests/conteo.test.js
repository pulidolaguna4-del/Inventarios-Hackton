import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as conteo from '../src/conteo.js';

const SKUS = Array.from({ length: 123 }, (_, i) => 100001 + i);

/** Hace sorteos de `cantidad` hasta que no quede nada por sortear. */
function sortearTodo(cantidad, semilla = 1) {
  const sorteos = [];
  while (conteo.referenciasDisponibles(SKUS, sorteos) > 0) {
    sorteos.push(conteo.sortear(SKUS, sorteos, cantidad, semilla + sorteos.length));
  }
  return sorteos;
}

test('un sorteo elige la cantidad pedida, sin repetir', () => {
  const sorteo = conteo.sortear(SKUS, [], 56, 2026);
  assert.equal(sorteo.numero, 1);
  assert.equal(sorteo.skus.length, 56);
  assert.equal(new Set(sorteo.skus).size, 56);
  assert.equal(sorteo.semilla, 2026);
});

test('primero salen las referencias que llevan menos sorteos', () => {
  const primero = conteo.sortear(SKUS, [], 56, 1);
  const segundo = conteo.sortear(SKUS, [primero], 56, 2);
  // Quedaban 67 sin sortear: el segundo sorteo solo puede elegir entre ellas.
  assert.ok(segundo.skus.every((sku) => !primero.skus.includes(sku)));
  const tercero = conteo.sortear(SKUS, [primero, segundo], 56, 3);
  const nuncaSorteadas = SKUS.filter((sku) => !primero.skus.includes(sku) && !segundo.skus.includes(sku));
  assert.ok(nuncaSorteadas.every((sku) => tercero.skus.includes(sku)));
});

test('sorteando de a 56 cada referencia sale exactamente 5 veces (615 conteos en 11 sorteos)', () => {
  const sorteos = sortearTodo(56);
  assert.equal(sorteos.length, 11);
  assert.equal(sorteos.at(-1).skus.length, 615 - 10 * 56);
  const verificacion = conteo.verificarSorteos(sorteos, SKUS);
  assert.equal(verificacion.valido, true, verificacion.errores.join(' · '));
  assert.equal(verificacion.completo, true);
  assert.equal(verificacion.conteos_sorteados, 615);
  assert.equal(verificacion.minimo_por_referencia, 5);
  assert.equal(verificacion.maximo_por_referencia, 5);
});

test('con otra cantidad también termina en 5 por referencia', () => {
  for (const cantidad of [1, 20, 100, 500]) {
    const verificacion = conteo.verificarSorteos(sortearTodo(cantidad), SKUS);
    assert.equal(verificacion.completo, true, `cantidad ${cantidad}`);
  }
});

test('cuando todas tienen 5, no se puede sortear más', () => {
  assert.throws(() => conteo.sortear(SKUS, sortearTodo(123), 56), /ya salieron 5 veces/);
});

test('la cantidad debe ser un entero positivo', () => {
  assert.throws(() => conteo.sortear(SKUS, [], 0), /mayor que 0/);
  assert.throws(() => conteo.sortear(SKUS, [], 2.5), /entero/);
});

test('la misma semilla da el mismo sorteo', () => {
  assert.deepEqual(conteo.sortear(SKUS, [], 56, 99).skus, conteo.sortear(SKUS, [], 56, 99).skus);
  assert.notDeepEqual(conteo.sortear(SKUS, [], 56, 99).skus, conteo.sortear(SKUS, [], 56, 100).skus);
});

test('la verificación detecta un sorteo con repetidas', () => {
  const sorteo = conteo.sortear(SKUS, [], 10, 1);
  sorteo.skus.push(sorteo.skus[0]);
  assert.equal(conteo.verificarSorteos([sorteo], SKUS).valido, false);
});

test('el stock simulado es siempre el mismo para un SKU y está en el rango', () => {
  assert.equal(conteo.stockSimulado(400016), conteo.stockSimulado(400016));
  for (const sku of SKUS) {
    const stock = conteo.stockSimulado(sku);
    assert.ok(stock >= 5 && stock <= 150);
  }
});

test('semana ISO de fechas conocidas', () => {
  assert.equal(conteo.semanaIso(new Date(2026, 0, 1)), 1);
  assert.equal(conteo.semanaIso(new Date(2026, 9, 28)), 44);
  assert.equal(conteo.semanaDelAnio(new Date(2026, 11, 31)), 52); // la semana 53 se cuenta como 52
});

test('registrar un conteo valida las reglas y guarda la semana de la fecha', () => {
  const sorteos = [conteo.sortear(SKUS, [], 10, 1)];
  const sku = sorteos[0].skus[0];
  const referencias = new Map([[sku, { sku, codigo_ubicacion: 'C1-F09-N1' }]]);
  const base = { sorteo: 1, sku, responsable: 'Ana', cantidad_contada: 10, cantidad_sistema: 12, fecha: '2026-10-28' };

  const registro = conteo.crearRegistro(base, sorteos, [], referencias);
  assert.equal(registro.diferencia, -2);
  assert.equal(registro.semana, 44);
  assert.equal(registro.codigo_ubicacion, 'C1-F09-N1');

  assert.throws(() => conteo.crearRegistro({ ...base, responsable: ' ' }, sorteos, [], referencias), /responsable/);
  assert.throws(() => conteo.crearRegistro(base, sorteos, [registro], referencias), /ya se contó/);
  assert.throws(() => conteo.crearRegistro({ ...base, cantidad_contada: -1 }, sorteos, [], referencias), /menor/);
  assert.throws(() => conteo.crearRegistro({ ...base, fecha: '2026-02-30' }, sorteos, [], referencias), /formato/);
  assert.throws(() => conteo.crearRegistro({ ...base, sorteo: 2 }, sorteos, [], referencias), /entre 1 y 1/);
  const otroSku = SKUS.find((s) => !sorteos[0].skus.includes(s));
  assert.throws(() => conteo.crearRegistro({ ...base, sku: otroSku }, sorteos, [], referencias), /no salió/);
});

test('sin cantidad en sistema se usa el stock simulado', () => {
  const sorteos = [conteo.sortear(SKUS, [], 5, 1)];
  const sku = sorteos[0].skus[0];
  const registro = conteo.crearRegistro({ sorteo: 1, sku, responsable: 'Ana', cantidad_contada: 0 }, sorteos, [], new Map());
  assert.equal(registro.cantidad_sistema, conteo.stockSimulado(sku));
});

test('el resumen cuenta sorteados, registrados y pendientes', () => {
  const sorteos = [conteo.sortear(SKUS, [], 56, 1)];
  const registro = conteo.crearRegistro(
    { sorteo: 1, sku: sorteos[0].skus[0], responsable: 'Ana', cantidad_contada: 3, fecha: '2026-10-28' },
    sorteos,
    [],
    new Map(),
  );
  const resumen = conteo.resumenProgreso(sorteos, [registro], SKUS.map((sku) => ({ sku })), 44, new Date(2026, 9, 28));
  assert.equal(resumen.periodo_actual, 5);
  assert.equal(resumen.conteos_totales, 615);
  assert.equal(resumen.conteos_sorteados, 56);
  assert.equal(resumen.conteos_registrados, 1);
  assert.equal(resumen.pendientes_por_contar, 55);
  assert.equal(resumen.por_sortear, 559);
  assert.equal(resumen.sorteo_actual, 1);
  assert.equal(resumen.avance_semanal[43].registrados, 1);
  assert.equal(resumen.sorteos[0].registrados, 1);
});

test('cada fecha cae en uno de los 5 periodos del plan de logística', () => {
  const casos = { '2026-01-05': 1, '2026-02-28': 1, '2026-03-01': 2, '2026-04-30': 2, '2026-05-15': 3, '2026-06-30': 3, '2026-07-01': 4, '2026-09-30': 4, '2026-10-01': 5, '2026-12-31': 5 };
  for (const [fecha, periodo] of Object.entries(casos)) assert.equal(conteo.periodoDeFecha(fecha).numero, periodo, fecha);
  assert.equal(conteo.periodoDeFecha('2026-10-28T10:20:17').nombre, 'Oct–Dic');
});

test('el sorteo guarda su periodo según la fecha en que se hace', () => {
  assert.equal(conteo.sortear(SKUS, [], 12, 1, new Date(2026, 2, 10)).periodo, 2);
  assert.equal(conteo.sortear(SKUS, [], 12, 1, new Date(2026, 9, 28)).periodo, 5);
  // Un sorteo guardado antes de existir el campo toma el periodo de su fecha.
  assert.equal(conteo.periodoDeSorteo({ numero: 1, fecha_hora: '2026-08-02T09:00:00', skus: [] }), 4);
});

test('el avance por periodo agrupa sorteos y cuenta referencias distintas contadas', () => {
  const s1 = conteo.sortear(SKUS, [], 12, 1, new Date(2026, 0, 10));
  const s2 = conteo.sortear(SKUS, [s1], 12, 2, new Date(2026, 9, 5));
  const registros = [
    { sorteo: 1, sku: s1.skus[0], diferencia: 0 },
    { sorteo: 1, sku: s1.skus[1], diferencia: 0 },
    { sorteo: 2, sku: s2.skus[0], diferencia: 1 },
  ];
  const periodos = conteo.avancePorPeriodo([s1, s2], registros, SKUS.length);
  assert.equal(periodos.length, 5);
  assert.deepEqual(periodos[0].sorteos, [1]);
  assert.equal(periodos[0].conteos_sorteados, 12);
  assert.equal(periodos[0].referencias_contadas, 2);
  assert.deepEqual(periodos[4].sorteos, [2]);
  assert.equal(periodos[4].conteos_registrados, 1);
  assert.equal(periodos[1].conteos_sorteados, 0);
  assert.equal(periodos[0].referencias_totales, 123);
});

test('con 12 por sorteo cada referencia también termina en exactamente 5', () => {
  const verificacion = conteo.verificarSorteos(sortearTodo(12), SKUS);
  assert.equal(verificacion.completo, true);
  assert.equal(verificacion.conteos_sorteados, 615);
});
