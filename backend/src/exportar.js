// Exportaciones a CSV. Los archivos quedan en salidas/; los de entrega se nombran Día<N>_Ejercicio<N>.csv.

import path from 'node:path';
import { guardarCsv } from './datos.js';
import { DIR_SALIDAS, PATRON_NOMBRE_ARCHIVO } from './config.js';

/** Devuelve el nombre sin espacios ni '.csv'; lanza error si tiene caracteres no permitidos. */
export function validarNombreArchivo(nombre) {
  let limpio = String(nombre ?? '').trim();
  if (limpio.toLowerCase().endsWith('.csv')) limpio = limpio.slice(0, -4);
  if (!PATRON_NOMBRE_ARCHIVO.test(limpio)) {
    throw new Error(`El nombre solo puede tener letras, números, _ y - (ej. Día2_Ejercicio6): '${limpio}'`);
  }
  return limpio;
}

/** Guarda las filas en <carpeta>/<nombre>.csv y devuelve la ruta del archivo. */
export function exportarCsv(nombre, filas, columnas, carpeta = DIR_SALIDAS) {
  const ruta = path.join(carpeta, `${validarNombreArchivo(nombre)}.csv`);
  guardarCsv(ruta, filas, columnas);
  return ruta;
}

/** Una fila por referencia sorteada: sorteo, fecha, SKU y su ubicación. Opcionalmente, un solo sorteo. */
export function filasSorteos(sorteos, referencias, numeroSorteo = null) {
  const porSku = new Map(referencias.map((referencia) => [referencia.sku, referencia]));
  const filas = [];
  for (const sorteo of sorteos) {
    if (numeroSorteo !== null && sorteo.numero !== numeroSorteo) continue;
    for (const sku of sorteo.skus) {
      filas.push({ ...(porSku.get(sku) ?? { sku }), sorteo: sorteo.numero, fecha_hora: sorteo.fecha_hora });
    }
  }
  return filas;
}
