// Carga y limpieza de los datos del caso, y utilidades para guardar archivos JSON y CSV.
//
// Las ventas y los productos nuevos salen del Excel original, que nunca se modifica.
// Los archivos que genera el sistema se escriben primero en un temporal y luego se
// renombran, para no dejar archivos a medio escribir.

import fs from 'node:fs';
import path from 'node:path';
import { abrirLibro, convertirFechaExcel, leerTabla } from './excel.js';
import {
  BOM_UTF8,
  CATEGORIA_DESCONOCIDA,
  CATEGORIAS_POR_DIGITO,
  CIUDAD_BODEGA,
  COLUMNAS_VENTAS,
  FILA_ENCABEZADOS_PRODUCTOS_NUEVOS,
  FILA_ENCABEZADOS_VENTAS,
  HOJA_PRODUCTOS_NUEVOS,
  HOJA_VENTAS,
  MESES,
  RUTA_EXCEL,
  SEPARADOR_CSV,
} from './config.js';

// ---------------------------------------------------------------------------
// Carga desde el Excel
// ---------------------------------------------------------------------------

/**
 * Lee la hoja de ventas y devuelve una lista de líneas de pedido limpias.
 *
 * Cada línea trae: id_pedido, fecha, sku, descripcion, cantidad, cliente, ciudad y
 * valor_unitario. Se descartan las líneas a las que les falta el pedido, la fecha,
 * el SKU o la cantidad.
 */
export function limpiarVentas(registros) {
  validarEncabezados(registros, Object.keys(COLUMNAS_VENTAS), HOJA_VENTAS);
  const lineas = [];
  for (const registro of registros) {
    const linea = {};
    for (const [columna, campo] of Object.entries(COLUMNAS_VENTAS)) linea[campo] = registro[columna];
    linea.id_pedido = aEntero(linea.id_pedido);
    linea.fecha = aFecha(linea.fecha);
    linea.sku = aEntero(linea.sku);
    linea.descripcion = aTexto(linea.descripcion);
    linea.cantidad = aEntero(linea.cantidad);
    linea.cliente = aTexto(linea.cliente);
    linea.ciudad = aTexto(linea.ciudad);
    linea.valor_unitario = aDecimal(linea.valor_unitario);

    const obligatorios = [linea.id_pedido, linea.fecha, linea.sku, linea.cantidad];
    if (obligatorios.some((valor) => valor === null)) continue;
    lineas.push(linea);
  }
  return lineas;
}

/**
 * Lee la hoja de productos a incluir y devuelve las referencias nuevas.
 *
 * Cada producto trae: sku, descripcion, categoria, demanda_mensual (12 valores, de
 * enero a diciembre; los meses vacíos valen 0) y demanda_anual.
 */
export function limpiarProductosNuevos(registros) {
  validarEncabezados(registros, ['CODIGO', 'DESCRIPCIÓN', ...MESES], HOJA_PRODUCTOS_NUEVOS);
  const productos = [];
  for (const registro of registros) {
    const sku = aEntero(registro.CODIGO);
    if (sku === null) continue;
    const demandaMensual = MESES.map((mes) => aEntero(registro[mes]) ?? 0);
    productos.push({
      sku,
      descripcion: aTexto(registro['DESCRIPCIÓN']),
      categoria: categoriaDeSku(sku),
      demanda_mensual: demandaMensual,
      demanda_anual: demandaMensual.reduce((suma, valor) => suma + valor, 0),
    });
  }
  return productos;
}

let datosEnMemoria = null;

/**
 * Carga ventas y productos nuevos una sola vez y los deja en memoria.
 * Devuelve {ventas, productos_nuevos}. Quien los use no debe modificarlos.
 */
export function cargarDatos(rutaExcel = RUTA_EXCEL) {
  if (!datosEnMemoria) {
    datosEnMemoria = abrirLibro(rutaExcel).then((libro) => ({
      ventas: limpiarVentas(leerTabla(libro, HOJA_VENTAS, FILA_ENCABEZADOS_VENTAS)),
      productos_nuevos: limpiarProductosNuevos(
        leerTabla(libro, HOJA_PRODUCTOS_NUEVOS, FILA_ENCABEZADOS_PRODUCTOS_NUEVOS),
      ),
    }));
    // Si falla la lectura, se permite reintentar en la siguiente llamada.
    datosEnMemoria.catch(() => {
      datosEnMemoria = null;
    });
  }
  return datosEnMemoria;
}

function validarEncabezados(registros, columnasEsperadas, nombreHoja) {
  if (registros.length === 0) throw new Error(`La hoja '${nombreHoja}' no tiene datos`);
  const faltantes = columnasEsperadas.filter((columna) => !(columna in registros[0]));
  if (faltantes.length) {
    throw new Error(`A la hoja '${nombreHoja}' le faltan las columnas: ${faltantes.join(', ')}`);
  }
}

// ---------------------------------------------------------------------------
// Consultas sobre los datos
// ---------------------------------------------------------------------------

/** Devuelve la categoría según el primer dígito del SKU (ej. 400016 -> Refrigeración). */
export function categoriaDeSku(sku) {
  return CATEGORIAS_POR_DIGITO[String(sku)[0]] ?? CATEGORIA_DESCONOCIDA;
}

/**
 * Universo de referencias: los SKU vendidos más los nuevos, ordenados por SKU.
 * Cada referencia trae sku, descripcion, categoria y si es_nueva.
 */
export function listarReferencias(ventas, productosNuevos) {
  const referencias = new Map();
  for (const linea of ventas) {
    if (!referencias.has(linea.sku)) {
      referencias.set(linea.sku, {
        sku: linea.sku,
        descripcion: linea.descripcion,
        categoria: categoriaDeSku(linea.sku),
        es_nueva: false,
      });
    }
  }
  for (const producto of productosNuevos) {
    if (!referencias.has(producto.sku)) {
      referencias.set(producto.sku, {
        sku: producto.sku,
        descripcion: producto.descripcion,
        categoria: producto.categoria,
        es_nueva: true,
      });
    }
  }
  return [...referencias.keys()].sort((a, b) => a - b).map((sku) => referencias.get(sku));
}

/** Filtra las líneas de pedido de una ciudad (por defecto, la bodega de Arauca). */
export function lineasDeCiudad(lineas, ciudad = CIUDAD_BODEGA) {
  const buscada = ciudad.trim().toLowerCase();
  return lineas.filter((linea) => linea.ciudad.toLowerCase() === buscada);
}

/** Totales generales: referencias, órdenes de la bodega y fechas con pedidos. */
export function calcularResumen(ventas, productosNuevos, ciudad = CIUDAD_BODEGA) {
  const lineasBodega = lineasDeCiudad(ventas, ciudad);
  const fechasBodega = [...new Set(lineasBodega.map((linea) => linea.fecha))].sort();
  const fechasTodas = ventas.map((linea) => linea.fecha).sort();
  const skusVentas = new Set(ventas.map((linea) => linea.sku));
  const skusNuevos = new Set(productosNuevos.map((producto) => producto.sku));

  return {
    bodega: ciudad,
    referencias_totales: new Set([...skusVentas, ...skusNuevos]).size,
    referencias_ventas: skusVentas.size,
    referencias_nuevas: skusNuevos.size,
    lineas_ventas: ventas.length,
    ordenes_totales: new Set(ventas.map((linea) => linea.id_pedido)).size,
    lineas_bodega: lineasBodega.length,
    ordenes_bodega: new Set(lineasBodega.map((linea) => linea.id_pedido)).size,
    dias_con_pedidos_bodega: fechasBodega.length,
    fecha_inicial: fechasTodas[0] ?? null,
    fecha_final: fechasTodas.at(-1) ?? null,
    fechas_disponibles: fechasBodega,
  };
}

// ---------------------------------------------------------------------------
// Conversión de valores
// ---------------------------------------------------------------------------

/** Convierte 400016.0, '400016' o 400016 en 400016; lo vacío o inválido en null. */
export function aEntero(valor) {
  if (valor === null || valor === undefined || typeof valor === 'boolean') return null;
  const numero = typeof valor === 'number' ? valor : Number.parseFloat(String(valor).trim());
  return Number.isFinite(numero) ? Math.trunc(numero) : null;
}

/** Convierte un valor en número decimal; lo vacío o inválido (ej. ' ') en null. */
export function aDecimal(valor) {
  if (valor === null || valor === undefined || typeof valor === 'boolean') return null;
  const numero = typeof valor === 'number' ? valor : Number.parseFloat(String(valor).trim());
  return Number.isFinite(numero) ? numero : null;
}

/** Convierte un valor en texto sin espacios al inicio ni al final. */
export function aTexto(valor) {
  return valor === null || valor === undefined ? '' : String(valor).trim();
}

/** Convierte un serial de Excel o un texto dd/mm/aaaa o aaaa-mm-dd en 'AAAA-MM-DD'. */
export function aFecha(valor) {
  if (valor === null || valor === undefined || typeof valor === 'boolean') return null;
  if (typeof valor === 'number') return convertirFechaExcel(valor);
  const texto = String(valor).trim();
  let partes = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (partes) return fechaValida(+partes[1], +partes[2], +partes[3]);
  partes = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (partes) return fechaValida(+partes[3], +partes[2], +partes[1]);
  return null;
}

/** Devuelve 'AAAA-MM-DD' si la fecha existe en el calendario; si no, null. */
export function fechaValida(anio, mes, dia) {
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) return null;
  return fecha.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Persistencia
// ---------------------------------------------------------------------------

/** Lee un archivo JSON; si no existe devuelve `porDefecto`. */
export function leerJson(ruta, porDefecto = null) {
  if (!fs.existsSync(ruta)) return porDefecto;
  return JSON.parse(fs.readFileSync(ruta, 'utf-8'));
}

/** Guarda `datos` como JSON legible. */
export function guardarJson(ruta, datos) {
  escribirAtomico(ruta, JSON.stringify(datos, null, 2));
}

/**
 * Arma el texto CSV de una lista de objetos con las `columnas` en ese orden.
 * Cada columna es {campo, titulo} (el título es el encabezado) o solo el nombre del campo.
 * Usa punto y coma y BOM UTF-8 para que Excel en español lo abra con tildes.
 */
export function textoCsv(filas, columnas) {
  const definiciones = columnas.map((columna) => (typeof columna === 'string' ? { campo: columna, titulo: columna } : columna));
  const lineas = [definiciones.map((columna) => celdaCsv(columna.titulo)).join(SEPARADOR_CSV)];
  for (const fila of filas) {
    lineas.push(definiciones.map((columna) => celdaCsv(valorParaCsv(fila[columna.campo]))).join(SEPARADOR_CSV));
  }
  return BOM_UTF8 + lineas.join('\r\n') + '\r\n';
}

/** Guarda una lista de objetos como CSV. */
export function guardarCsv(ruta, filas, columnas) {
  escribirAtomico(ruta, textoCsv(filas, columnas));
}

/**
 * Prepara un valor para que Excel en español lo lea bien: listas separadas por coma,
 * vacío en lugar de null, Sí/No, decimales con coma (57,6) y fecha y hora sin la "T".
 */
function valorParaCsv(valor) {
  if (Array.isArray(valor)) return valor.join(', ');
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (typeof valor === 'number' && !Number.isInteger(valor)) return String(valor).replace('.', ',');
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(valor)) return valor.replace('T', ' ');
  return valor;
}

/** Pone comillas a la celda si trae el separador, comillas o saltos de línea. */
function celdaCsv(valor) {
  const texto = String(valor);
  if (/[";\r\n]/.test(texto)) return `"${texto.replaceAll('"', '""')}"`;
  return texto;
}

/** Escribe texto o un Buffer en un temporal de la misma carpeta y luego lo renombra a `ruta`. */
export function escribirAtomico(ruta, contenido) {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  const rutaTemporal = `${ruta}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(rutaTemporal, contenido, 'utf-8');
    fs.renameSync(rutaTemporal, ruta);
  } catch (error) {
    fs.rmSync(rutaTemporal, { force: true });
    throw error;
  }
}
