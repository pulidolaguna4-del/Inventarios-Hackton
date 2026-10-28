// Conteo cíclico por sorteos: elegir referencias al azar, registrar los conteos y medir el avance.
//
// Regla del caso: cada referencia se cuenta CONTEOS_POR_ANIO (5) veces al año, elegida al
// azar. Cuando una referencia llega a 5, sale de la lista.
//
// Cómo funciona un sorteo (botón "Sortear" en la pantalla):
// 1. Se pide una cantidad (por defecto 56).
// 2. Se eligen al azar referencias entre las que llevan MENOS sorteos: primero las que
//    llevan 0, luego las que llevan 1, y así. Ninguna se repite en el mismo sorteo y
//    ninguna pasa de 5 en el año.
// 3. Así, al completar 123 × 5 = 615 conteos, todas quedan con exactamente 5.
//
// Periodos (plan de logística): el año se divide en 5 periodos (Ene–Feb, Mar–Abr, May–Jun,
// Jul–Sep, Oct–Dic) y en cada uno se cuentan todas las referencias una vez. Cada sorteo
// pertenece al periodo del mes en que se hizo.

import crypto from 'node:crypto';
import fs from 'node:fs';
import { leerJson, guardarJson, fechaValida } from './datos.js';
import { ahoraIso } from './maestro.js';
import {
  CONTEOS_POR_ANIO,
  PERIODOS_CONTEO,
  SEMANAS_ANIO,
  SEMILLA_STOCK_SIMULADO,
  STOCK_SIMULADO_MAXIMO,
  STOCK_SIMULADO_MINIMO,
} from './config.js';

// ---------------------------------------------------------------------------
// Números aleatorios con semilla
// ---------------------------------------------------------------------------

/**
 * Generador de números aleatorios con semilla (algoritmo mulberry32).
 * Con la misma semilla siempre produce la misma secuencia: cada sorteo guarda su
 * semilla para poder demostrar en la sustentación cómo se obtuvo.
 * Devuelve una función que entrega un número entre 0 (incluido) y 1 (excluido).
 */
export function crearAleatorio(semilla) {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Semilla nueva e impredecible para un sorteo. */
export function semillaNueva() {
  return crypto.randomInt(1, 2 ** 31);
}

/** Elige `cantidad` elementos distintos de `lista` al azar (barajado parcial de Fisher-Yates). */
export function muestraAleatoria(lista, cantidad, aleatorio) {
  const copia = [...lista];
  for (let i = 0; i < cantidad; i++) {
    const j = i + Math.floor(aleatorio() * (copia.length - i));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia.slice(0, cantidad);
}

// ---------------------------------------------------------------------------
// Sorteos
// ---------------------------------------------------------------------------

/** Cuántas veces ha salido sorteada cada referencia: Map sku -> veces. */
export function vecesSorteadas(skus, sorteos) {
  const veces = new Map(skus.map((sku) => [sku, 0]));
  for (const sorteo of sorteos) {
    for (const sku of sorteo.skus) veces.set(sku, (veces.get(sku) ?? 0) + 1);
  }
  return veces;
}

/** Referencias que todavía pueden salir en un sorteo (llevan menos de 5). */
export function referenciasDisponibles(skus, sorteos, maximo = CONTEOS_POR_ANIO) {
  return [...vecesSorteadas(skus, sorteos)].filter(([, veces]) => veces < maximo).length;
}

/**
 * Hace un sorteo nuevo y lo devuelve (no lo guarda).
 *
 * Elige `cantidad` referencias al azar, empezando por las que llevan menos sorteos.
 * Si quedan menos referencias disponibles que `cantidad`, se toman todas las que queden.
 */
export function sortear(skus, sorteos, cantidad, semilla = semillaNueva(), ahora = new Date(), maximo = CONTEOS_POR_ANIO) {
  if (!Number.isInteger(cantidad) || cantidad < 1) throw new Error('La cantidad a sortear debe ser un número entero mayor que 0');
  const veces = vecesSorteadas(skus, sorteos);
  const disponibles = [...veces.values()].filter((v) => v < maximo).length;
  if (disponibles === 0) {
    throw new Error(`Todas las referencias ya salieron ${maximo} veces este año. Reinicie el conteo para empezar un año nuevo.`);
  }

  const elegidas = elegirMenosContadas(veces, Math.min(cantidad, disponibles), maximo, crearAleatorio(semilla));
  const fechaHora = ahoraIso(ahora);
  return {
    numero: sorteos.length + 1,
    fecha_hora: fechaHora,
    periodo: periodoDeFecha(fechaHora).numero,
    semilla,
    cantidad_pedida: cantidad,
    skus: elegidas.sort((a, b) => a - b),
  };
}

/** Elige `tamano` referencias al azar, empezando por las que llevan menos sorteos. */
function elegirMenosContadas(veces, tamano, maximo, aleatorio) {
  const elegidas = [];
  let faltan = tamano;
  const niveles = [...new Set([...veces.values()].filter((v) => v < maximo))].sort((a, b) => a - b);
  for (const nivel of niveles) {
    const candidatas = [...veces].filter(([, v]) => v === nivel).map(([sku]) => sku).sort((a, b) => a - b);
    if (candidatas.length <= faltan) {
      elegidas.push(...candidatas);
      faltan -= candidatas.length;
    } else {
      elegidas.push(...muestraAleatoria(candidatas, faltan, aleatorio));
      faltan = 0;
    }
    if (faltan === 0) break;
  }
  return elegidas;
}

/**
 * Revisa que los sorteos cumplan las reglas:
 * - Ninguna referencia se repite dentro del mismo sorteo.
 * - Ninguna referencia sale más de 5 veces en el año.
 * - Todas las referencias de los sorteos existen en el maestro.
 */
export function verificarSorteos(sorteos, skus, maximo = CONTEOS_POR_ANIO) {
  const errores = [];
  for (const sorteo of sorteos) {
    if (new Set(sorteo.skus).size !== sorteo.skus.length) errores.push(`El sorteo ${sorteo.numero} repite referencias`);
  }
  const universo = new Set(skus);
  const veces = vecesSorteadas(skus, sorteos);
  const desconocidas = [...veces.keys()].filter((sku) => !universo.has(sku));
  if (desconocidas.length) errores.push(`Referencias que no están en el maestro: ${desconocidas.join(', ')}`);
  const excedidas = [...veces].filter(([, v]) => v > maximo).map(([sku]) => sku);
  if (excedidas.length) errores.push(`Referencias sorteadas más de ${maximo} veces: ${excedidas.join(', ')}`);

  const cantidades = [...universo].map((sku) => veces.get(sku) ?? 0);
  const sorteados = cantidades.reduce((suma, v) => suma + v, 0);
  return {
    valido: errores.length === 0,
    errores,
    referencias: universo.size,
    conteos_esperados: universo.size * maximo,
    conteos_sorteados: sorteados,
    minimo_por_referencia: cantidades.length ? Math.min(...cantidades) : 0,
    maximo_por_referencia: cantidades.length ? Math.max(...cantidades) : 0,
    completo: errores.length === 0 && cantidades.every((v) => v === maximo),
  };
}

/** Devuelve el sorteo con ese número; lanza error si no existe. */
function buscarSorteo(sorteos, numero) {
  const sorteo = sorteos.find((s) => s.numero === numero);
  if (!sorteo) {
    throw new Error(sorteos.length ? `El sorteo debe estar entre 1 y ${sorteos.length}: ${numero}` : 'Todavía no se ha hecho ningún sorteo');
  }
  return sorteo;
}

// ---------------------------------------------------------------------------
// Fechas y periodos
// ---------------------------------------------------------------------------

/** Periodo de conteo al que pertenece una fecha 'AAAA-MM-DD...' (según su mes). */
export function periodoDeFecha(fechaTexto) {
  const mes = Number(String(fechaTexto).slice(5, 7));
  const periodo = PERIODOS_CONTEO.find((p) => mes >= p.mes_inicio && mes <= p.mes_fin);
  if (!periodo) throw new Error(`Fecha sin periodo de conteo: '${fechaTexto}'`);
  return periodo;
}

/** Número de periodo de un sorteo (los sorteos antiguos sin el campo lo toman de su fecha). */
export function periodoDeSorteo(sorteo) {
  return sorteo.periodo ?? periodoDeFecha(sorteo.fecha_hora).numero;
}

/** Número de semana ISO (1 a 53) de una fecha. */
export function semanaIso(fecha) {
  const dia = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  const diaSemana = dia.getUTCDay() || 7; // lunes = 1 ... domingo = 7
  dia.setUTCDate(dia.getUTCDate() + 4 - diaSemana); // jueves de esa semana
  const inicioAnio = new Date(Date.UTC(dia.getUTCFullYear(), 0, 1));
  return Math.ceil(((dia - inicioAnio) / 86400000 + 1) / 7);
}

/** Número de semana (1 a SEMANAS_ANIO) de una fecha; por defecto, hoy. La 53 cuenta como 52. */
export function semanaDelAnio(fecha = new Date()) {
  return Math.min(semanaIso(fecha), SEMANAS_ANIO);
}

/** Fecha local de hoy en formato 'AAAA-MM-DD'. */
export function hoyIso(fecha = new Date()) {
  return ahoraIso(fecha).slice(0, 10);
}

// ---------------------------------------------------------------------------
// Registro de conteos
// ---------------------------------------------------------------------------

/** Cantidad en sistema simulada para un SKU: siempre la misma para el mismo SKU. */
export function stockSimulado(sku) {
  const aleatorio = crearAleatorio(SEMILLA_STOCK_SIMULADO * 1000003 + Number(sku));
  return STOCK_SIMULADO_MINIMO + Math.floor(aleatorio() * (STOCK_SIMULADO_MAXIMO - STOCK_SIMULADO_MINIMO + 1));
}

/**
 * Valida un conteo nuevo y devuelve el registro listo para guardar.
 *
 * `datosRegistro` trae: sorteo, sku, responsable, cantidad_contada y, opcionalmente,
 * cantidad_sistema (si falta se usa el stock simulado) y fecha. La semana del año se
 * calcula con la fecha del conteo.
 */
export function crearRegistro(datosRegistro, sorteos, registros, referenciasPorSku, hoy = new Date()) {
  const numeroSorteo = enteroObligatorio(datosRegistro, 'sorteo');
  const sku = enteroObligatorio(datosRegistro, 'sku');
  const cantidadContada = enteroObligatorio(datosRegistro, 'cantidad_contada', 0);
  const responsable = String(datosRegistro.responsable ?? '').trim();
  if (!responsable) throw new Error('Falta el responsable del conteo');

  if (!buscarSorteo(sorteos, numeroSorteo).skus.includes(sku)) {
    throw new Error(`La referencia ${sku} no salió en el sorteo ${numeroSorteo}`);
  }
  if (registros.some((r) => r.sorteo === numeroSorteo && r.sku === sku)) {
    throw new Error(`La referencia ${sku} ya se contó en el sorteo ${numeroSorteo}`);
  }

  const sinSistema = [null, undefined, ''].includes(datosRegistro.cantidad_sistema);
  const cantidadSistema = sinSistema ? stockSimulado(sku) : enteroObligatorio(datosRegistro, 'cantidad_sistema', 0);
  const fecha = fechaRegistro(datosRegistro.fecha, hoy);

  return {
    fecha,
    responsable,
    sorteo: numeroSorteo,
    semana: semanaDelAnio(new Date(`${fecha}T12:00:00`)),
    sku,
    codigo_ubicacion: referenciasPorSku.get(sku)?.codigo_ubicacion ?? null,
    cantidad_sistema: cantidadSistema,
    cantidad_contada: cantidadContada,
    diferencia: cantidadContada - cantidadSistema,
  };
}

/** Lee un campo entero obligatorio; lanza error si falta, no es entero o es menor al mínimo. */
function enteroObligatorio(datosRegistro, campo, minimo = null) {
  const valor = datosRegistro[campo];
  if (valor === null || valor === undefined || valor === '' || typeof valor === 'boolean') {
    throw new Error(`Falta el campo '${campo}'`);
  }
  const texto = String(valor).trim();
  if (!/^[+-]?\d+$/.test(texto)) throw new Error(`El campo '${campo}' debe ser un número entero: '${valor}'`);
  const numero = Number(texto);
  if (minimo !== null && numero < minimo) throw new Error(`El campo '${campo}' no puede ser menor que ${minimo}`);
  return numero;
}

/** Valida una fecha aaaa-mm-dd; si no viene, usa la de hoy. */
function fechaRegistro(textoFecha, hoy) {
  if (!textoFecha) return hoyIso(hoy);
  const partes = String(textoFecha).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const fecha = partes ? fechaValida(+partes[1], +partes[2], +partes[3]) : null;
  if (!fecha) throw new Error(`La fecha debe tener el formato aaaa-mm-dd: '${textoFecha}'`);
  return fecha;
}

// ---------------------------------------------------------------------------
// Progreso
// ---------------------------------------------------------------------------

/** Estado de cada referencia: en qué sorteos salió, 'contada X/5' y si tuvo diferencias. */
export function progresoPorReferencia(sorteos, registros, referencias, maximo = CONTEOS_POR_ANIO) {
  const sorteosPorSku = new Map();
  for (const sorteo of sorteos) {
    for (const sku of sorteo.skus) {
      if (!sorteosPorSku.has(sku)) sorteosPorSku.set(sku, []);
      sorteosPorSku.get(sku).push(sorteo.numero);
    }
  }
  const registrosPorSku = new Map();
  for (const registro of registros) {
    if (!registrosPorSku.has(registro.sku)) registrosPorSku.set(registro.sku, []);
    registrosPorSku.get(registro.sku).push(registro);
  }

  return referencias.map((referencia) => {
    const registrosSku = registrosPorSku.get(referencia.sku) ?? [];
    const contados = registrosSku.length;
    const conDiferencia = registrosSku.filter((r) => r.diferencia !== 0).length;
    return {
      sku: referencia.sku,
      descripcion: referencia.descripcion ?? '',
      categoria: referencia.categoria ?? '',
      codigo_ubicacion: referencia.codigo_ubicacion ?? null,
      sorteos: sorteosPorSku.get(referencia.sku) ?? [],
      contados,
      estado: `contada ${contados}/${maximo}`,
      sale_de_la_lista: contados >= maximo,
      conteos_con_diferencia: conDiferencia,
      tiene_diferencia: conDiferencia > 0,
    };
  });
}

/** Lista de un sorteo: qué toca contar, qué ya se contó y el progreso X/5 de cada referencia. */
export function referenciasDeSorteo(numeroSorteo, sorteos, registros, referencias) {
  const sorteo = buscarSorteo(sorteos, numeroSorteo);
  const progreso = new Map(progresoPorReferencia(sorteos, registros, referencias).map((fila) => [fila.sku, fila]));
  const registrosSorteo = new Map(registros.filter((r) => r.sorteo === numeroSorteo).map((r) => [r.sku, r]));

  const filas = sorteo.skus.map((sku) => ({
    ...(progreso.get(sku) ?? { sku, contados: 0, sale_de_la_lista: false }),
    contada_en_sorteo: registrosSorteo.has(sku),
    registro_sorteo: registrosSorteo.get(sku) ?? null,
    cantidad_sistema_sugerida: stockSimulado(sku),
  }));

  return {
    sorteo: sorteo.numero,
    fecha_hora: sorteo.fecha_hora,
    periodo: periodoDeSorteo(sorteo),
    semilla: sorteo.semilla,
    tamano: sorteo.skus.length,
    pendientes: filas.filter((fila) => !fila.contada_en_sorteo).length,
    referencias: filas,
  };
}

/** Resumen corto de cada sorteo: cuántas referencias trae y cuántas ya se contaron. */
export function resumenSorteos(sorteos, registros) {
  return sorteos.map((sorteo) => {
    const contados = registros.filter((r) => r.sorteo === sorteo.numero);
    return {
      numero: sorteo.numero,
      fecha_hora: sorteo.fecha_hora,
      periodo: periodoDeSorteo(sorteo),
      tamano: sorteo.skus.length,
      registrados: contados.length,
      con_diferencia: contados.filter((r) => r.diferencia !== 0).length,
    };
  });
}

/**
 * Avance de cada periodo de conteo: qué sorteos le pertenecen, cuántos conteos se
 * sortearon y registraron, y cuántas referencias distintas ya se contaron en él
 * (la meta de cada periodo es contar todas las referencias una vez).
 */
export function avancePorPeriodo(sorteos, registros, totalReferencias) {
  const periodoPorSorteo = new Map(sorteos.map((s) => [s.numero, periodoDeSorteo(s)]));
  return PERIODOS_CONTEO.map((periodo) => {
    const delPeriodo = sorteos.filter((s) => periodoPorSorteo.get(s.numero) === periodo.numero);
    const registrosPeriodo = registros.filter((r) => periodoPorSorteo.get(r.sorteo) === periodo.numero);
    return {
      ...periodo,
      sorteos: delPeriodo.map((s) => s.numero),
      conteos_sorteados: delPeriodo.reduce((suma, s) => suma + s.skus.length, 0),
      conteos_registrados: registrosPeriodo.length,
      referencias_contadas: new Set(registrosPeriodo.map((r) => r.sku)).size,
      referencias_totales: totalReferencias,
    };
  });
}

/** Por cada semana del año: cuántos conteos se hicieron y cuántos tuvieron diferencia. */
export function avanceSemanal(registros, semanas = SEMANAS_ANIO) {
  return Array.from({ length: semanas }, (_, indice) => {
    const deLaSemana = registros.filter((r) => r.semana === indice + 1);
    return {
      semana: indice + 1,
      registrados: deLaSemana.length,
      con_diferencia: deLaSemana.filter((r) => r.diferencia !== 0).length,
    };
  });
}

/** Totales del año, avance por semana, resumen de sorteos y verificación. */
export function resumenProgreso(sorteos, registros, referencias, semanaActual = semanaDelAnio(), hoy = new Date()) {
  const skus = referencias.map((r) => r.sku);
  const progreso = progresoPorReferencia(sorteos, registros, referencias);
  const verificacion = verificarSorteos(sorteos, skus);
  const sorteados = verificacion.conteos_sorteados;
  return {
    semana_actual: semanaActual,
    referencias: skus.length,
    conteos_por_anio: CONTEOS_POR_ANIO,
    conteos_totales: verificacion.conteos_esperados,
    conteos_sorteados: sorteados,
    conteos_registrados: registros.length,
    pendientes_por_contar: sorteados - registros.length,
    por_sortear: verificacion.conteos_esperados - sorteados,
    referencias_disponibles: referenciasDisponibles(skus, sorteos),
    cumplimiento: verificacion.conteos_esperados ? Math.round((1000 * registros.length) / verificacion.conteos_esperados) / 10 : 0,
    referencias_completas: progreso.filter((fila) => fila.sale_de_la_lista).length,
    referencias_con_diferencia: progreso.filter((fila) => fila.tiene_diferencia).length,
    sorteo_actual: sorteos.at(-1)?.numero ?? null,
    periodo_actual: periodoDeFecha(hoyIso(hoy)).numero,
    periodos: avancePorPeriodo(sorteos, registros, skus.length),
    sorteos: resumenSorteos(sorteos, registros),
    verificacion,
    avance_semanal: avanceSemanal(registros),
    progreso,
  };
}

/** Registros de conteo filtrados por SKU, sorteo o semana, del más reciente al más antiguo. */
export function filtrarRegistros(registros, { sku = null, sorteo = null, semana = null } = {}) {
  return registros
    .filter((r) => (sku === null || r.sku === sku) && (sorteo === null || r.sorteo === sorteo) && (semana === null || r.semana === semana))
    .reverse();
}

// ---------------------------------------------------------------------------
// Archivos
// ---------------------------------------------------------------------------

/** Lee los sorteos guardados; lista vacía si todavía no hay. */
export function cargarSorteos(ruta) {
  return leerJson(ruta, []);
}

export function guardarSorteos(ruta, sorteos) {
  guardarJson(ruta, sorteos);
}

/** Lee los registros de conteo; lista vacía si todavía no hay. */
export function cargarRegistros(ruta) {
  return leerJson(ruta, []);
}

export function guardarRegistros(ruta, registros) {
  guardarJson(ruta, registros);
}

/** Copia el archivo a <nombre>_respaldo_<fecha_hora>.json y devuelve la ruta de la copia. */
export function respaldarArchivo(ruta) {
  const marca = ahoraIso().replaceAll('-', '').replace('T', '_').replaceAll(':', '');
  const rutaRespaldo = ruta.replace(/\.(\w+)$/, `_respaldo_${marca}.$1`);
  fs.copyFileSync(ruta, rutaRespaldo);
  return rutaRespaldo;
}
