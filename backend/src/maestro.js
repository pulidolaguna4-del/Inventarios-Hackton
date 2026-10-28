// Maestro de ubicaciones: popularidad, clasificación ABC y asignación SKU -> ubicación.
//
// Criterios:
// - Popularidad = número de líneas de pedido del SKU en la bodega de Arauca.
// - Referencias nuevas (sin ventas): su demanda anual proyectada se convierte en
//   "líneas equivalentes" con el promedio de Arauca:
//       líneas equivalentes = demanda anual × (líneas de Arauca ÷ unidades de Arauca)
// - Clase ABC por popularidad acumulada: A hasta el 80 %, B hasta el 95 % y C el resto.
//   La referencia que cruza el umbral queda en la clase de arriba.
// - Asignación: los SKU más populares van a los huecos más convenientes (ver
//   ordenarHuecos). Si existe el CSV de logística, sus ubicaciones mandan.

import fs from 'node:fs';
import * as bodega from './bodega.js';
import { lineasDeCiudad, listarReferencias, leerJson, guardarJson, aEntero } from './datos.js';
import {
  CIUDAD_BODEGA,
  CLASES_ABC,
  PRIORIZAR_NIVEL_1,
  RUTA_LOGISTICA_TAREA1,
  RUTA_MAESTRO_LOGISTICA,
  SALIDAS,
  UMBRAL_CLASE_A,
  UMBRAL_CLASE_B,
} from './config.js';

/** Redondea a `decimales` cifras (como round() de Python para estos casos). */
export function redondear(numero, decimales = 2) {
  const factor = 10 ** decimales;
  return Math.round((numero + Number.EPSILON) * factor) / factor;
}

// ---------------------------------------------------------------------------
// Popularidad y ABC
// ---------------------------------------------------------------------------

/** Líneas de pedido por unidad vendida en la bodega (para convertir demanda en líneas). */
export function factorLineasPorUnidad(lineasBodega) {
  const unidades = lineasBodega.reduce((suma, linea) => suma + linea.cantidad, 0);
  return unidades ? lineasBodega.length / unidades : 0;
}

/**
 * Devuelve las referencias con su popularidad, ordenadas de mayor a menor.
 * Las referencias que solo se venden en otras ciudades quedan con popularidad 0.
 */
export function calcularPopularidad(ventas, productosNuevos, ciudad = CIUDAD_BODEGA) {
  const lineasBodega = lineasDeCiudad(ventas, ciudad);
  const lineasPorSku = new Map();
  for (const linea of lineasBodega) lineasPorSku.set(linea.sku, (lineasPorSku.get(linea.sku) ?? 0) + 1);
  const factor = factorLineasPorUnidad(lineasBodega);
  const demandaNuevos = new Map(productosNuevos.map((producto) => [producto.sku, producto.demanda_anual]));

  const referencias = listarReferencias(ventas, productosNuevos).map((referencia) =>
    referencia.es_nueva
      ? { ...referencia, popularidad: redondear(demandaNuevos.get(referencia.sku) * factor), origen_popularidad: 'proyeccion' }
      : { ...referencia, popularidad: lineasPorSku.get(referencia.sku) ?? 0, origen_popularidad: 'ventas' },
  );
  return referencias.sort((a, b) => b.popularidad - a.popularidad || a.sku - b.sku);
}

/** Agrega clase_abc y porcentaje_acumulado a referencias ya ordenadas por popularidad. */
export function clasificarAbc(referenciasOrdenadas, umbralA = UMBRAL_CLASE_A, umbralB = UMBRAL_CLASE_B) {
  const total = referenciasOrdenadas.reduce((suma, referencia) => suma + referencia.popularidad, 0);
  let acumulado = 0;
  for (const referencia of referenciasOrdenadas) {
    const participacionPrevia = total ? acumulado / total : 1;
    if (participacionPrevia < umbralA) referencia.clase_abc = 'A';
    else if (participacionPrevia < umbralB) referencia.clase_abc = 'B';
    else referencia.clase_abc = 'C';
    acumulado += referencia.popularidad;
    referencia.porcentaje_acumulado = total ? redondear((100 * acumulado) / total) : 0;
  }
  return referenciasOrdenadas;
}

// ---------------------------------------------------------------------------
// Asignación de ubicaciones
// ---------------------------------------------------------------------------

/** Metros desde la celda hasta la salida más cercana. */
export function distanciaASalidaMasCercana(columna, fila) {
  const punto = bodega.coordenadasCelda(columna, fila);
  return Math.min(...Object.values(SALIDAS).map((salida) => bodega.distancia(punto, salida)));
}

/** Compara dos arreglos de números elemento por elemento (orden lexicográfico). */
function compararClaves(claveA, claveB) {
  for (let i = 0; i < claveA.length; i++) {
    if (claveA[i] !== claveB[i]) return claveA[i] - claveB[i];
  }
  return 0;
}

/**
 * Lista de huecos de picking del más conveniente al menos conveniente.
 *
 * Con priorizarNivel1 van primero todos los de nivel 1 (picking a nivel de suelo; el
 * nivel 2 tarda el triple) y luego los de nivel 2, cada grupo por cercanía a la salida.
 * Sin él, se ordena por distancia y en la misma celda va primero el nivel 1.
 */
export function ordenarHuecos(priorizarNivel1 = PRIORIZAR_NIVEL_1) {
  const lista = bodega.huecos().map((hueco) => ({
    ...hueco,
    distancia_salida_m: redondear(distanciaASalidaMasCercana(hueco.columna, hueco.fila)),
  }));
  const clave = (h) =>
    priorizarNivel1
      ? [h.nivel, h.distancia_salida_m, h.columna, h.fila]
      : [h.distancia_salida_m, h.columna, h.fila, h.nivel];
  return lista.sort((a, b) => compararClaves(clave(a), clave(b)));
}

/**
 * Asigna un hueco a cada referencia, de la más popular a la menos popular.
 *
 * `ubicacionesFijas` es {sku: codigo_ubicacion} (por ejemplo, del CSV de logística):
 * esas se respetan y los demás SKU se reparten en los huecos libres.
 */
export function asignarUbicaciones(referenciasOrdenadas, ubicacionesFijas = {}, priorizarNivel1 = PRIORIZAR_NIVEL_1) {
  const huecosPorCodigo = new Map(ordenarHuecos(priorizarNivel1).map((hueco) => [hueco.codigo_ubicacion, hueco]));

  const ocupados = new Map();
  for (const [sku, codigo] of Object.entries(ubicacionesFijas)) {
    if (!huecosPorCodigo.has(codigo)) throw new Error(`Ubicación inválida para el SKU ${sku}: ${codigo}`);
    if (ocupados.has(codigo)) throw new Error(`Los SKU ${ocupados.get(codigo)} y ${sku} tienen la misma ubicación ${codigo}`);
    ocupados.set(codigo, sku);
  }

  const libres = [...huecosPorCodigo.keys()].filter((codigo) => !ocupados.has(codigo));
  const porAsignar = referenciasOrdenadas.filter((referencia) => !(referencia.sku in ubicacionesFijas));
  if (porAsignar.length > libres.length) {
    throw new Error(`Hay ${porAsignar.length} referencias por ubicar y solo ${libres.length} huecos libres`);
  }

  let siguienteLibre = 0;
  return referenciasOrdenadas.map((referencia) => {
    const esFija = referencia.sku in ubicacionesFijas;
    const codigo = esFija ? ubicacionesFijas[referencia.sku] : libres[siguienteLibre++];
    const hueco = huecosPorCodigo.get(codigo);
    return {
      ...referencia,
      fuente_ubicacion: esFija ? 'logistica' : 'generada',
      codigo_ubicacion: codigo,
      columna: hueco.columna,
      fila: hueco.fila,
      nivel: hueco.nivel,
      numero_plano: hueco.numero_plano,
      distancia_salida_m: hueco.distancia_salida_m,
    };
  });
}

// ---------------------------------------------------------------------------
// Maestro completo
// ---------------------------------------------------------------------------

/** Fecha y hora local en formato 'AAAA-MM-DDTHH:MM:SS'. */
export function ahoraIso(fecha = new Date()) {
  const desfase = fecha.getTimezoneOffset() * 60000;
  return new Date(fecha.getTime() - desfase).toISOString().slice(0, 19);
}

/** Calcula popularidad, ABC y ubicaciones. Devuelve el objeto que se guarda en JSON. */
export function generarMaestro(ventas, productosNuevos, rutaLogistica = RUTA_MAESTRO_LOGISTICA) {
  const referencias = clasificarAbc(calcularPopularidad(ventas, productosNuevos));

  const logistica = leerMaestroLogistica(rutaLogistica);
  const skusConocidos = new Set(referencias.map((referencia) => referencia.sku));
  const desconocidos = Object.keys(logistica).map(Number).filter((sku) => !skusConocidos.has(sku));
  if (desconocidos.length) throw new Error(`El maestro de logística trae SKU que no existen: ${desconocidos.join(', ')}`);
  for (const referencia of referencias) {
    const clase = logistica[referencia.sku]?.clase_abc;
    if (clase) referencia.clase_abc = clase;
  }

  const ubicacionesFijas = {};
  for (const [sku, fila] of Object.entries(logistica)) {
    if (fila.codigo_ubicacion) ubicacionesFijas[sku] = fila.codigo_ubicacion;
  }
  const maestro = asignarUbicaciones(referencias, ubicacionesFijas);
  const lineasBodega = lineasDeCiudad(ventas);

  return {
    generado: ahoraIso(),
    fuente: Object.keys(logistica).length ? 'logistica + generado' : 'generado',
    criterios: {
      popularidad: `líneas de pedido en ${CIUDAD_BODEGA}`,
      popularidad_nuevas: `demanda anual × líneas/unidad de ${CIUDAD_BODEGA}`,
      factor_lineas_por_unidad: redondear(factorLineasPorUnidad(lineasBodega), 6),
      umbral_a: UMBRAL_CLASE_A,
      umbral_b: UMBRAL_CLASE_B,
      priorizar_nivel_1: PRIORIZAR_NIVEL_1,
    },
    conteo_por_clase: Object.fromEntries(
      CLASES_ABC.map((clase) => [clase, maestro.filter((referencia) => referencia.clase_abc === clase).length]),
    ),
    referencias: maestro,
  };
}

/**
 * Lee el CSV de logística si existe: {sku: {codigo_ubicacion, clase_abc}}.
 * Acepta separador ';' o ','. Las columnas obligatorias son sku y codigo_ubicacion.
 */
export function leerMaestroLogistica(ruta) {
  if (!ruta || !fs.existsSync(ruta)) return {};
  const contenido = fs.readFileSync(ruta, 'utf-8').replace(/^﻿/, '');
  const separador = contenido.split(';').length >= contenido.split(',').length ? ';' : ',';
  const lineas = contenido.split(/\r?\n/).filter((linea) => linea.trim());
  if (lineas.length === 0) return {};

  const encabezados = lineas[0].split(separador).map((nombre) => nombre.trim().toLowerCase());
  const posicion = (nombre) => encabezados.indexOf(nombre);
  if (posicion('sku') < 0 || posicion('codigo_ubicacion') < 0) {
    throw new Error('El maestro de logística debe tener las columnas sku y codigo_ubicacion');
  }

  const resultado = {};
  lineas.slice(1).forEach((linea, indice) => {
    const numeroLinea = indice + 2;
    const celdas = linea.split(separador).map((celda) => celda.trim());
    const textoSku = celdas[posicion('sku')] ?? '';
    if (!textoSku) return;
    const sku = aEntero(textoSku);
    if (sku === null) throw new Error(`SKU inválido en la línea ${numeroLinea} del maestro de logística: '${textoSku}'`);
    const codigo = (celdas[posicion('codigo_ubicacion')] ?? '').toUpperCase();
    if (codigo) bodega.interpretarCodigo(codigo);
    const clase = posicion('clase_abc') >= 0 ? (celdas[posicion('clase_abc')] ?? '').toUpperCase() : '';
    if (clase && !CLASES_ABC.includes(clase)) throw new Error(`Clase ABC inválida en la línea ${numeroLinea}: '${clase}'`);
    resultado[sku] = { codigo_ubicacion: codigo || null, clase_abc: clase || null };
  });
  return resultado;
}

// ---------------------------------------------------------------------------
// Entregable de logística (Tarea 1)
// ---------------------------------------------------------------------------

/** Lee el entregable de logística: Map sku -> {ubicacion_logistica, clase_abc_logistica, ...}. */
export function leerLogisticaTarea1(ruta = RUTA_LOGISTICA_TAREA1) {
  const contenido = leerJson(ruta, { referencias: [] });
  return new Map(contenido.referencias.map((fila) => [fila.sku, fila]));
}

/**
 * Agrega a cada referencia los datos del entregable de logística, como campos aparte:
 * - ubicacion_logistica: posición en la maqueta del robot (U01-N1-I...), null si no la tiene.
 * - clase_abc_logistica: la clase que puso logística (por unidades), null si no la tiene.
 * No cambia codigo_ubicacion ni clase_abc, que calcula el sistema por líneas de pedido.
 */
export function agregarDatosLogistica(referencias, logistica) {
  return referencias.map((referencia) => {
    const fila = logistica.get(referencia.sku);
    return {
      ...referencia,
      ubicacion_logistica: fila?.ubicacion_logistica ?? null,
      clase_abc_logistica: fila?.clase_abc_logistica ?? null,
    };
  });
}

/** Lee el maestro guardado; null si todavía no existe. */
export function cargarMaestro(ruta) {
  return leerJson(ruta);
}

export function guardarMaestro(ruta, maestro) {
  guardarJson(ruta, maestro);
}
