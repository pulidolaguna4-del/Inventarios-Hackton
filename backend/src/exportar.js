// Exportaciones a CSV. Los archivos quedan en salidas/; los de entrega se nombran Día<N>_Ejercicio<N>.csv.

import path from 'node:path';
import { escribirAtomico, guardarCsv } from './datos.js';
import { periodoDeSorteo } from './conteo.js';
import { DIR_SALIDAS, PATRON_NOMBRE_ARCHIVO, PERIODOS_CONTEO } from './config.js';

/** Devuelve el nombre sin espacios ni extensión (.csv o .xlsx); lanza error si tiene caracteres no permitidos. */
export function validarNombreArchivo(nombre) {
  // NFC: la "í" de "Día" siempre queda como un solo carácter, venga como venga.
  let limpio = String(nombre ?? '').normalize('NFC').trim();
  limpio = limpio.replace(/\.(csv|xlsx)$/i, '');
  if (!PATRON_NOMBRE_ARCHIVO.test(limpio)) {
    throw new Error(`El nombre solo puede tener letras, números, _ y - (ej. Día2_Ejercicio6): '${limpio}'`);
  }
  return limpio;
}

/** Guarda el libro (Buffer de crearXlsx) en <carpeta>/<nombre>.xlsx y devuelve la ruta del archivo. */
export function exportarXlsx(nombre, libro, carpeta = DIR_SALIDAS) {
  const ruta = path.join(carpeta, `${validarNombreArchivo(nombre)}.xlsx`);
  escribirAtomico(ruta, libro);
  return ruta;
}

/** Guarda las filas en <carpeta>/<nombre>.csv y devuelve la ruta del archivo. */
export function exportarCsv(nombre, filas, columnas, carpeta = DIR_SALIDAS) {
  const ruta = path.join(carpeta, `${validarNombreArchivo(nombre)}.csv`);
  guardarCsv(ruta, filas, columnas);
  return ruta;
}

/**
 * Encabezado Content-Disposition de una descarga. `filename*` lleva el nombre exacto en
 * UTF-8 (Día2_Ejercicio6.csv); `filename` es el respaldo sin tildes para clientes viejos.
 */
export function encabezadoDescarga(nombreArchivo) {
  const sinTildes = nombreArchivo.normalize('NFD').replace(/\p{M}/gu, '');
  return `attachment; filename="${sinTildes}"; filename*=UTF-8''${encodeURIComponent(nombreArchivo)}`;
}

/**
 * Una fila por referencia sorteada: sorteo, fecha, periodo, SKU y su ubicación.
 * `veces_en_el_anio` dice qué vez es para esa referencia (1 a 5). Opcionalmente, un solo sorteo.
 */
export function filasSorteos(sorteos, referencias, numeroSorteo = null) {
  const porSku = new Map(referencias.map((referencia) => [referencia.sku, referencia]));
  const nombrePeriodo = new Map(PERIODOS_CONTEO.map((periodo) => [periodo.numero, `${periodo.numero} · ${periodo.nombre}`]));
  const vecesPorSku = new Map();
  const filas = [];
  for (const sorteo of sorteos) {
    const periodo = nombrePeriodo.get(periodoDeSorteo(sorteo)) ?? '';
    for (const sku of sorteo.skus) {
      vecesPorSku.set(sku, (vecesPorSku.get(sku) ?? 0) + 1);
      if (numeroSorteo !== null && sorteo.numero !== numeroSorteo) continue;
      filas.push({
        ...(porSku.get(sku) ?? { sku }),
        sorteo: sorteo.numero,
        fecha_hora: sorteo.fecha_hora,
        periodo,
        veces_en_el_anio: vecesPorSku.get(sku),
      });
    }
  }
  return filas;
}

/**
 * Lista de despacho para el CSV: cada fila lleva también la salida de su recorrido, la
 * distancia y el tiempo total del recorrido y si es el más demorado (lo que pide la Tarea 6).
 */
export function filasDespacho(resultado) {
  const porRecorrido = new Map(resultado.recorridos.map((recorrido) => [recorrido.recorrido, recorrido]));
  return resultado.lista.map((fila) => {
    const recorrido = porRecorrido.get(fila.recorrido);
    return {
      ...fila,
      salida: recorrido.salida_inicio,
      distancia_recorrido_m: recorrido.distancia_m,
      tiempo_recorrido_s: recorrido.tiempo_total_s,
      es_el_mas_demorado: recorrido.es_el_mas_demorado,
    };
  });
}

/** Registros de conteo con la descripción de cada referencia (el registro solo guarda el SKU). */
export function filasRegistros(registros, referencias) {
  const descripcionPorSku = new Map(referencias.map((referencia) => [referencia.sku, referencia.descripcion]));
  return registros.map((registro) => ({ ...registro, descripcion: descripcionPorSku.get(registro.sku) ?? '' }));
}
