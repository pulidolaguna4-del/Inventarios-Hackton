// Lector de archivos .xlsx con ExcelJS.
// Convierte cada hoja en una lista de objetos {encabezado: valor} y normaliza los
// tipos de celda que trae ExcelJS (fórmulas, textos con formato, errores y fechas).

import ExcelJS from 'exceljs';
import { FECHA_BASE_EXCEL_MS } from './config.js';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Convierte un número serial de Excel (ej. 43102) en texto 'AAAA-MM-DD' (2018-01-02). */
export function convertirFechaExcel(numeroSerial) {
  return new Date(FECHA_BASE_EXCEL_MS + Math.round(Number(numeroSerial) * MS_POR_DIA)).toISOString().slice(0, 10);
}

/** Abre el libro de Excel (lectura completa en memoria). */
export async function abrirLibro(rutaArchivo) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.readFile(rutaArchivo);
  return libro;
}

/**
 * Lee una hoja como tabla: una lista de objetos {encabezado: valor}.
 *
 * Toma los encabezados de `filaEncabezados` y convierte cada fila de abajo en un
 * objeto. Las filas totalmente vacías se omiten. Los errores de Excel (#REF!) llegan
 * como null y las fechas como texto 'AAAA-MM-DD'.
 */
export function leerTabla(libro, nombreHoja, filaEncabezados) {
  const hoja = libro.getWorksheet(nombreHoja);
  if (!hoja) {
    const disponibles = libro.worksheets.map((h) => h.name).join(', ');
    throw new Error(`No existe la hoja '${nombreHoja}'. Hojas disponibles: ${disponibles}`);
  }

  const encabezados = new Map(); // número de columna -> nombre
  hoja.getRow(filaEncabezados).eachCell((celda, numeroColumna) => {
    const texto = valorCelda(celda.value);
    if (texto !== null && String(texto).trim()) encabezados.set(numeroColumna, String(texto).trim());
  });
  if (encabezados.size === 0) {
    throw new Error(`La hoja '${nombreHoja}' no tiene encabezados en la fila ${filaEncabezados}`);
  }

  const registros = [];
  hoja.eachRow((fila, numeroFila) => {
    if (numeroFila <= filaEncabezados) return;
    const registro = {};
    for (const [numeroColumna, nombre] of encabezados) {
      registro[nombre] = valorCelda(fila.getCell(numeroColumna).value);
    }
    if (Object.values(registro).some(tieneValor)) registros.push(registro);
  });
  return registros;
}

/** Indica si una celda trae algo distinto de vacío o espacios. */
function tieneValor(valor) {
  if (valor === null || valor === undefined) return false;
  if (typeof valor === 'string') return valor.trim() !== '';
  return true;
}

/** Convierte el valor de una celda de ExcelJS en texto, número, booleano, fecha ISO o null. */
export function valorCelda(valor) {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor !== 'object') return valor;
  if ('error' in valor) return null; // #REF!, #N/A, ...
  if ('result' in valor) return valorCelda(valor.result); // fórmula
  if ('formula' in valor || 'sharedFormula' in valor) return null; // fórmula sin resultado guardado
  if (Array.isArray(valor.richText)) return valor.richText.map((parte) => parte.text).join('');
  if ('text' in valor) return valor.text; // hipervínculo
  return null;
}
