// Escritor mínimo de archivos .xlsx, solo con la librería estándar de Node.
//
// Un .xlsx es un zip con archivos XML. Aquí se arman esos XML a mano y se empaquetan con
// node:zlib (deflateRawSync para comprimir y crc32 para el control de cada archivo).
// Los textos van como cadenas en línea (t="inlineStr"), así no hace falta sharedStrings.xml.
//
// Los reportes no saben nada de XML: arman sus hojas como datos y llaman a crearXlsx().
//
// Una hoja es:
// {
//   nombre: 'Picking',                       // nombre de la pestaña (máx. 31 caracteres)
//   titulo: 'Lista de despacho — ...',       // fila 1, combinada a lo ancho de la tabla
//   bloque: ['Velocidad: 1 m/s', ...],       // líneas de información debajo del título (opcional)
//   columnas: [{ titulo: 'Recorrido', ancho: 10, formato: 'numero' }, ...],
//   filas: [{ valores: [1, 'DER', ...], fondo: 'nivel1' }, ...],   // fondo opcional
//   zebra: true,                             // filas sin fondo alternan blanco y gris claro
//   leyenda: [{ texto: 'Nivel 1 (T)', fondo: 'nivel1' }, ...],    // debajo de la tabla (opcional)
//   congelarEncabezado: true,
//   autofiltro: true,
// }

import zlib from 'node:zlib';

// ---------------------------------------------------------------------------
// Estilos: colores, fondos, formatos y el índice de cada combinación en styles.xml
// ---------------------------------------------------------------------------

/** Colores (RGB) de los fondos. Los de nivel son los mismos para el mapa y la sustentación. */
export const COLORES = {
  oscuro: '1F3864', // título y encabezados (texto blanco)
  zebra: 'F2F2F2',
  nivel1: 'FFE699', // nivel 1 = T
  nivel2: 'F4B7B7', // nivel 2 = 3T
  ambos: 'FFCC99', // ambos niveles = 4T
  alerta: 'FF7070',
  total: 'D9E2F3',
  claseA: 'C6EFCE',
  claseB: 'FFEB9C',
  claseC: 'E7E6E6',
};

/** Fondos que puede llevar una fila de datos ('blanco' = sin relleno). */
export const FONDOS = ['blanco', 'zebra', 'nivel1', 'nivel2', 'ambos', 'alerta', 'total', 'claseA', 'claseB', 'claseC'];

/** Formatos de columna: texto, entero sin decimales o decimal con 1 cifra. */
export const FORMATOS = ['texto', 'numero', 'decimal'];

// Índices fijos de cellXfs en styles.xml.
const ESTILO_NORMAL = 0;
const ESTILO_TITULO = 1;
const ESTILO_ENCABEZADO = 2;
const ESTILO_INFO = 3;
const PRIMER_ESTILO_DE_DATOS = 4;

// Formatos numéricos: 1 es el "0" que trae Excel; 164 es el primero propio permitido.
const FORMATO_ENTERO = 1;
const FORMATO_DECIMAL = 164;
const NUMFMT_POR_FORMATO = { texto: 0, numero: FORMATO_ENTERO, decimal: FORMATO_DECIMAL };

// Fuentes: 0 normal, 1 título (14 negrita blanca), 2 encabezado (negrita blanca), 3 total (negrita).
const FUENTE_NORMAL = 0;
const FUENTE_TITULO = 1;
const FUENTE_ENCABEZADO = 2;
const FUENTE_TOTAL = 3;

// Bordes: 0 ninguno, 1 fino en los cuatro lados, 2 fino con el superior grueso (totales).
const BORDE_FINO = 1;
const BORDE_TOTAL = 2;

// Rellenos: Excel exige que los dos primeros sean "none" y "gray125"; después van los propios.
const RELLENO_OSCURO = 2;
const RELLENO_POR_FONDO = Object.fromEntries(FONDOS.map((fondo, indice) => [fondo, fondo === 'blanco' ? 0 : 3 + indice - 1]));

const ALTO_TITULO = 26;
const ALTO_ENCABEZADO = 32;
const ANCHO_MAXIMO = 60;
// Espacio que ocupa el botón del autofiltro en el encabezado (en caracteres).
const ANCHO_BOTON_FILTRO = 5;
// La leyenda se combina sobre estas columnas para que el color cubra todo el texto.
const COLUMNAS_LEYENDA = 4;

/** Índice en cellXfs de una celda de datos con ese fondo y ese formato. */
export function indiceEstilo(fondo = 'blanco', formato = 'texto') {
  const f = FONDOS.indexOf(fondo);
  const n = FORMATOS.indexOf(formato);
  if (f < 0) throw new Error(`Fondo desconocido: ${fondo}. Opciones: ${FONDOS.join(', ')}`);
  if (n < 0) throw new Error(`Formato desconocido: ${formato}. Opciones: ${FORMATOS.join(', ')}`);
  return PRIMER_ESTILO_DE_DATOS + f * FORMATOS.length + n;
}

// ---------------------------------------------------------------------------
// Utilidades de XML y de celdas
// ---------------------------------------------------------------------------

const ENCABEZADO_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PAQUETE = 'http://schemas.openxmlformats.org/package/2006/relationships';

/** Escapa & < > " y quita los caracteres de control que el XML no permite. */
export function escaparXml(texto) {
  return String(texto)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Letra de una columna: 1 -> A, 26 -> Z, 27 -> AA. */
export function letraColumna(numero) {
  let letras = '';
  for (let n = numero; n > 0; n = Math.floor((n - 1) / 26)) letras = String.fromCharCode(65 + ((n - 1) % 26)) + letras;
  return letras;
}

/** XML de una celda. Números sin t y con su valor crudo; textos en línea; vacío solo con estilo. */
function celdaXml(referencia, valor, estilo) {
  if (valor === null || valor === undefined || valor === '') return `<c r="${referencia}" s="${estilo}"/>`;
  if (typeof valor === 'number' && Number.isFinite(valor)) return `<c r="${referencia}" s="${estilo}"><v>${valor}</v></c>`;
  const texto = typeof valor === 'boolean' ? (valor ? 'Sí' : 'No') : String(valor);
  return `<c r="${referencia}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${escaparXml(texto)}</t></is></c>`;
}

/** Fila completa: una celda por columna, todas con el mismo estilo o con el de su columna. */
function filaXml(numeroFila, valores, estiloDe, alto = null) {
  const atributoAlto = alto ? ` ht="${alto}" customHeight="1"` : '';
  const celdas = valores.map((valor, i) => celdaXml(`${letraColumna(i + 1)}${numeroFila}`, valor, estiloDe(i))).join('');
  return `<row r="${numeroFila}"${atributoAlto}>${celdas}</row>`;
}

// ---------------------------------------------------------------------------
// Partes del libro
// ---------------------------------------------------------------------------

function tiposDeContenido(cantidadHojas) {
  const hojas = Array.from(
    { length: cantidadHojas },
    (_, i) =>
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join('');
  return (
    ENCABEZADO_XML +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    hojas +
    '</Types>'
  );
}

function relacionesPaquete() {
  return (
    ENCABEZADO_XML +
    `<Relationships xmlns="${NS_PAQUETE}">` +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>'
  );
}

function relacionesLibro(cantidadHojas) {
  const tipo = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const hojas = Array.from(
    { length: cantidadHojas },
    (_, i) => `<Relationship Id="rId${i + 1}" Type="${tipo}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
  ).join('');
  return (
    ENCABEZADO_XML +
    `<Relationships xmlns="${NS_PAQUETE}">${hojas}` +
    `<Relationship Id="rId${cantidadHojas + 1}" Type="${tipo}/styles" Target="styles.xml"/>` +
    '</Relationships>'
  );
}

/** workbook.xml: las pestañas y, para cada autofiltro, el nombre oculto que Excel espera. */
function libroXml(hojas, distribuciones) {
  const pestanas = hojas.map((hoja, i) => `<sheet name="${escaparXml(hoja.nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('');
  const filtros = distribuciones
    .map((d, i) => (d.rangoFiltro ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${referenciaAbsoluta(hojas[i].nombre, d.rangoFiltro)}</definedName>` : ''))
    .join('');
  return (
    ENCABEZADO_XML +
    `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    '<bookViews><workbookView/></bookViews>' +
    `<sheets>${pestanas}</sheets>` +
    (filtros ? `<definedNames>${filtros}</definedNames>` : '') +
    '</workbook>'
  );
}

/** 'Hoja'!$A$3:$H$20 (las comillas simples del nombre se duplican). */
function referenciaAbsoluta(nombreHoja, rango) {
  const absoluto = rango.replace(/([A-Z]+)(\d+)/g, '$$$1$$$2');
  return escaparXml(`'${nombreHoja.replaceAll("'", "''")}'!${absoluto}`);
}

function rellenoXml(color) {
  return `<fill><patternFill patternType="solid"><fgColor rgb="FF${color}"/><bgColor indexed="64"/></patternFill></fill>`;
}

function bordeXml(superior = 'thin') {
  const lado = (nombre, estilo = 'thin') => `<${nombre} style="${estilo}"><color rgb="FF9E9E9E"/></${nombre}>`;
  return `<border>${lado('left')}${lado('right')}${lado('top', superior)}${lado('bottom')}<diagonal/></border>`;
}

/** Un xf de cellXfs. */
function xf({ fuente = FUENTE_NORMAL, relleno = 0, borde = 0, formato = 0, alineacion = '' }) {
  const aplicar = `applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1"${alineacion ? ' applyAlignment="1"' : ''}`;
  const cuerpo = alineacion ? `<alignment ${alineacion}/>` : '';
  return `<xf numFmtId="${formato}" fontId="${fuente}" fillId="${relleno}" borderId="${borde}" xfId="0" ${aplicar}>${cuerpo}</xf>`;
}

/** styles.xml con fuentes, rellenos, bordes y un estilo por cada combinación de fondo y formato. */
function estilosXml() {
  const fuentes = [
    '<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>',
    '<font><b/><sz val="14"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>',
    '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>',
    '<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>',
  ];
  const rellenos = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
    rellenoXml(COLORES.oscuro),
    ...FONDOS.filter((fondo) => fondo !== 'blanco').map((fondo) => rellenoXml(COLORES[fondo])),
  ];
  const bordes = ['<border><left/><right/><top/><bottom/><diagonal/></border>', bordeXml('thin'), bordeXml('medium')];

  const estilos = [
    xf({}),
    xf({ fuente: FUENTE_TITULO, relleno: RELLENO_OSCURO, alineacion: 'vertical="center"' }),
    xf({ fuente: FUENTE_ENCABEZADO, relleno: RELLENO_OSCURO, borde: BORDE_FINO, alineacion: 'horizontal="center" vertical="center" wrapText="1"' }),
    xf({ alineacion: 'vertical="center"' }),
  ];
  for (const fondo of FONDOS) {
    for (const formato of FORMATOS) {
      const esTotal = fondo === 'total';
      estilos.push(
        xf({
          fuente: esTotal ? FUENTE_TOTAL : FUENTE_NORMAL,
          relleno: RELLENO_POR_FONDO[fondo],
          borde: esTotal ? BORDE_TOTAL : BORDE_FINO,
          formato: NUMFMT_POR_FORMATO[formato],
          alineacion: 'vertical="center"',
        }),
      );
    }
  }

  return (
    ENCABEZADO_XML +
    `<styleSheet xmlns="${NS_MAIN}">` +
    `<numFmts count="1"><numFmt numFmtId="${FORMATO_DECIMAL}" formatCode="0.0"/></numFmts>` +
    `<fonts count="${fuentes.length}">${fuentes.join('')}</fonts>` +
    `<fills count="${rellenos.length}">${rellenos.join('')}</fills>` +
    `<borders count="${bordes.length}">${bordes.join('')}</borders>` +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    `<cellXfs count="${estilos.length}">${estilos.join('')}</cellXfs>` +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>'
  );
}

// ---------------------------------------------------------------------------
// Hojas
// ---------------------------------------------------------------------------

/**
 * Ancho de cada columna: el pedido o el que necesite el contenido, para que nunca salga ####.
 * El encabezado se parte en dos líneas, pero su palabra más larga más el botón del filtro
 * tienen que caber en una.
 */
function anchosColumnas(hoja) {
  const boton = hoja.autofiltro ? ANCHO_BOTON_FILTRO : 1;
  return hoja.columnas.map((columna, i) => {
    const palabraMasLarga = Math.max(...columna.titulo.split(/\s+/).map((palabra) => palabra.length));
    const encabezado = Math.max(palabraMasLarga, Math.ceil(columna.titulo.length / 2) + 2) + boton;
    const datos = Math.max(0, ...hoja.filas.map((fila) => textoParaAncho(fila.valores[i], columna.formato).length)) + 2;
    return Math.min(ANCHO_MAXIMO, Math.max(columna.ancho ?? 8, encabezado, datos));
  });
}

function textoParaAncho(valor, formato) {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number' && formato === 'decimal') return valor.toFixed(1);
  return String(valor);
}

/** Dónde queda cada parte de la hoja: título, bloque, encabezado, datos y leyenda. */
function distribuirHoja(hoja) {
  const ultimaColumna = letraColumna(hoja.columnas.length);
  const filaEncabezado = 2 + (hoja.bloque?.length ?? 0) + (hoja.bloque?.length ? 1 : 0);
  const ultimaFilaDatos = filaEncabezado + hoja.filas.length;
  return {
    ultimaColumna,
    filaEncabezado,
    ultimaFilaDatos,
    rangoFiltro: hoja.autofiltro && hoja.filas.length ? `A${filaEncabezado}:${ultimaColumna}${ultimaFilaDatos}` : null,
  };
}

/** Estilo de cada fila de datos: su fondo o, si no trae, blanco/gris alternado. */
function fondoDeFila(hoja, fila, indice) {
  if (fila.fondo) return fila.fondo;
  return hoja.zebra && indice % 2 === 1 ? 'zebra' : 'blanco';
}

function vistaXml(hoja, d, esPrimera) {
  const seleccionada = esPrimera ? ' tabSelected="1"' : '';
  if (!hoja.congelarEncabezado) return `<sheetViews><sheetView workbookViewId="0"${seleccionada}/></sheetViews>`;
  const primeraLibre = `A${d.filaEncabezado + 1}`;
  return (
    `<sheetViews><sheetView workbookViewId="0"${seleccionada}>` +
    `<pane ySplit="${d.filaEncabezado}" topLeftCell="${primeraLibre}" activePane="bottomLeft" state="frozen"/>` +
    `<selection pane="bottomLeft" activeCell="${primeraLibre}" sqref="${primeraLibre}"/>` +
    '</sheetView></sheetViews>'
  );
}

/** Filas del título y del bloque de información; cada una combinada a lo ancho de la tabla. */
function filasDeCabecera(hoja, d) {
  const vacias = hoja.columnas.length - 1;
  const filas = [filaXml(1, [hoja.titulo, ...Array(vacias).fill(null)], () => ESTILO_TITULO, ALTO_TITULO)];
  const combinadas = [`A1:${d.ultimaColumna}1`];
  (hoja.bloque ?? []).forEach((linea, i) => {
    filas.push(filaXml(2 + i, [linea, ...Array(vacias).fill(null)], () => ESTILO_INFO));
    combinadas.push(`A${2 + i}:${d.ultimaColumna}${2 + i}`);
  });
  return { filas, combinadas };
}

/** Filas de la leyenda, debajo de la tabla y con una fila de aire. Cada una se combina sobre varias columnas. */
function filasDeLeyenda(hoja, d) {
  const ancho = Math.min(COLUMNAS_LEYENDA, hoja.columnas.length);
  const filas = [];
  const combinadas = [];
  (hoja.leyenda ?? []).forEach((item, i) => {
    const numero = d.ultimaFilaDatos + 2 + i;
    filas.push(filaXml(numero, [item.texto, ...Array(ancho - 1).fill(null)], () => indiceEstilo(item.fondo, 'texto')));
    if (ancho > 1) combinadas.push(`A${numero}:${letraColumna(ancho)}${numero}`);
  });
  return { filas, combinadas };
}

function hojaXml(hoja, d, esPrimera) {
  const anchos = anchosColumnas(hoja);
  const columnas = anchos.map((ancho, i) => `<col min="${i + 1}" max="${i + 1}" width="${ancho}" customWidth="1"/>`).join('');
  const cabecera = filasDeCabecera(hoja, d);
  const encabezado = filaXml(d.filaEncabezado, hoja.columnas.map((c) => c.titulo), () => ESTILO_ENCABEZADO, ALTO_ENCABEZADO);
  const datos = hoja.filas.map((fila, indice) => {
    const fondo = fondoDeFila(hoja, fila, indice);
    return filaXml(d.filaEncabezado + 1 + indice, fila.valores, (i) => indiceEstilo(fondo, hoja.columnas[i].formato ?? 'texto'));
  });
  const leyenda = filasDeLeyenda(hoja, d);
  const ultimaFila = hoja.leyenda?.length ? d.ultimaFilaDatos + 1 + hoja.leyenda.length : d.ultimaFilaDatos;
  const rangos = [...cabecera.combinadas, ...leyenda.combinadas];
  const combinadas = rangos.map((rango) => `<mergeCell ref="${rango}"/>`).join('');
  return (
    ENCABEZADO_XML +
    `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    `<dimension ref="A1:${d.ultimaColumna}${ultimaFila}"/>` +
    vistaXml(hoja, d, esPrimera) +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    `<cols>${columnas}</cols>` +
    `<sheetData>${[...cabecera.filas, encabezado, ...datos, ...leyenda.filas].join('')}</sheetData>` +
    (d.rangoFiltro ? `<autoFilter ref="${d.rangoFiltro}"/>` : '') +
    `<mergeCells count="${rangos.length}">${combinadas}</mergeCells>` +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
    '</worksheet>'
  );
}

/** Revisa lo que Excel no acepta: nombres de pestaña inválidos o repetidos y filas mal armadas. */
function validarHojas(hojas) {
  if (!hojas.length) throw new Error('El libro necesita al menos una hoja');
  const nombres = new Set();
  for (const hoja of hojas) {
    if (!hoja.nombre || hoja.nombre.length > 31 || /[[\]:*?/\\]/.test(hoja.nombre)) {
      throw new Error(`Nombre de hoja inválido (máx. 31 caracteres, sin [ ] : * ? / \\): '${hoja.nombre}'`);
    }
    if (nombres.has(hoja.nombre.toLowerCase())) throw new Error(`Hoja repetida: '${hoja.nombre}'`);
    nombres.add(hoja.nombre.toLowerCase());
    const largo = hoja.columnas.length;
    const malas = hoja.filas.findIndex((fila) => fila.valores.length > largo);
    if (malas >= 0) throw new Error(`La fila ${malas + 1} de '${hoja.nombre}' tiene más valores que columnas`);
  }
}

// ---------------------------------------------------------------------------
// Zip
// ---------------------------------------------------------------------------

/** Fecha y hora en el formato de MS-DOS que usa el zip. */
function fechaDos(fecha) {
  const hora = (fecha.getHours() << 11) | (fecha.getMinutes() << 5) | Math.floor(fecha.getSeconds() / 2);
  const dia = ((fecha.getFullYear() - 1980) << 9) | ((fecha.getMonth() + 1) << 5) | fecha.getDate();
  return { hora, dia };
}

/**
 * Empaqueta los archivos {ruta, contenido} en un zip (método deflate).
 * Por cada archivo: cabecera local + datos; al final, el directorio central y su cierre.
 */
export function crearZip(archivos, fecha = new Date()) {
  const { hora, dia } = fechaDos(fecha);
  const locales = [];
  const centrales = [];
  let desplazamiento = 0;
  for (const { ruta, contenido } of archivos) {
    const nombre = Buffer.from(ruta, 'utf8');
    const datos = Buffer.from(contenido, 'utf8');
    const comprimidos = zlib.deflateRawSync(datos);
    const crc = zlib.crc32(datos);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // versión necesaria
    local.writeUInt16LE(0x0800, 6); // nombres en UTF-8
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(hora, 10);
    local.writeUInt16LE(dia, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comprimidos.length, 18);
    local.writeUInt32LE(datos.length, 22);
    local.writeUInt16LE(nombre.length, 26);
    local.writeUInt16LE(0, 28);
    locales.push(local, nombre, comprimidos);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // hecho con
    central.writeUInt16LE(20, 6); // versión necesaria
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(hora, 12);
    central.writeUInt16LE(dia, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comprimidos.length, 20);
    central.writeUInt32LE(datos.length, 24);
    central.writeUInt16LE(nombre.length, 28);
    central.writeUInt32LE(desplazamiento, 42);
    centrales.push(central, nombre);

    desplazamiento += local.length + nombre.length + comprimidos.length;
  }
  const directorio = Buffer.concat(centrales);
  const cierre = Buffer.alloc(22);
  cierre.writeUInt32LE(0x06054b50, 0);
  cierre.writeUInt16LE(archivos.length, 8);
  cierre.writeUInt16LE(archivos.length, 10);
  cierre.writeUInt32LE(directorio.length, 12);
  cierre.writeUInt32LE(desplazamiento, 16);
  return Buffer.concat([...locales, directorio, cierre]);
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/** Arma el .xlsx completo de las `hojas` y lo devuelve como Buffer (no lo guarda). */
export function crearXlsx(hojas, fecha = new Date()) {
  validarHojas(hojas);
  const distribuciones = hojas.map(distribuirHoja);
  const archivos = [
    { ruta: '[Content_Types].xml', contenido: tiposDeContenido(hojas.length) },
    { ruta: '_rels/.rels', contenido: relacionesPaquete() },
    { ruta: 'xl/workbook.xml', contenido: libroXml(hojas, distribuciones) },
    { ruta: 'xl/_rels/workbook.xml.rels', contenido: relacionesLibro(hojas.length) },
    { ruta: 'xl/styles.xml', contenido: estilosXml() },
    ...hojas.map((hoja, i) => ({ ruta: `xl/worksheets/sheet${i + 1}.xml`, contenido: hojaXml(hoja, distribuciones[i], i === 0) })),
  ];
  return crearZip(archivos, fecha);
}

export { ESTILO_NORMAL, ESTILO_TITULO, ESTILO_ENCABEZADO, ESTILO_INFO };
