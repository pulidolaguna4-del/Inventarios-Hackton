// Reportes en Excel: arman las hojas (títulos, columnas, filas y colores) para reporteExcel.js.
// Aquí no hay XML: solo qué va en cada celda y de qué color.

import { periodoDeSorteo } from './conteo.js';
import {
  CONTEOS_POR_ANIO,
  FACTOR_NIVEL_2,
  PERIODOS_CONTEO,
  TIEMPO_RECOGIDA_NIVEL_1,
  UMBRAL_CLASE_A,
  UMBRAL_CLASE_B,
  VELOCIDAD_OPERARIO,
} from './config.js';

const EMPRESA = 'Distribuciones Centauros · Bodega Arauca';

/** Color de una fila de picking según los niveles de su parada (mismos colores de la leyenda). */
function fondoPorNiveles(niveles) {
  if (niveles.length > 1) return 'ambos';
  return niveles[0] === 2 ? 'nivel2' : 'nivel1';
}

const LEYENDA_NIVELES = [
  { texto: `Nivel 1: recoger tarda T (${TIEMPO_RECOGIDA_NIVEL_1} s)`, fondo: 'nivel1' },
  { texto: `Nivel 2: recoger tarda ${FACTOR_NIVEL_2}T (${TIEMPO_RECOGIDA_NIVEL_1 * FACTOR_NIVEL_2} s)`, fondo: 'nivel2' },
  { texto: `Ambos niveles en la misma parada: ${FACTOR_NIVEL_2 + 1}T`, fondo: 'ambos' },
];

// ---------------------------------------------------------------------------
// Picking (Tarea 6)
// ---------------------------------------------------------------------------

const COLUMNAS_PICKING = [
  { titulo: 'Recorrido', formato: 'numero', ancho: 10 },
  { titulo: 'Salida (entra y vuelve)', formato: 'texto', ancho: 12 },
  { titulo: 'Orden de visita', formato: 'numero', ancho: 9 },
  { titulo: 'Posición en el plano', formato: 'numero', ancho: 10 },
  { titulo: 'Código de ubicación', formato: 'texto', ancho: 14 },
  { titulo: 'Nivel', formato: 'numero', ancho: 7 },
  { titulo: 'Distancia acumulada desde el inicio (m)', formato: 'decimal', ancho: 12 },
  { titulo: 'Tiempo (s)', formato: 'decimal', ancho: 10 },
];

/** Filas de un recorrido: una por ubicación, pintada según el nivel, y su subtotal. */
function filasRecorrido(recorrido, lista) {
  const filas = lista
    .filter((fila) => fila.recorrido === recorrido.recorrido)
    .map((fila) => ({
      valores: [fila.recorrido, recorrido.salida_inicio, fila.orden, fila.numero_plano, fila.codigo_ubicacion, fila.nivel, fila.distancia_acum_m, fila.tiempo_s],
      fondo: fondoPorNiveles(recorrido.paradas[fila.orden - 1].niveles),
    }));
  const marca = recorrido.es_el_mas_demorado ? ' · MÁS DEMORADO' : '';
  filas.push({
    valores: [recorrido.recorrido, recorrido.salida_inicio, null, null, `Subtotal recorrido ${recorrido.recorrido}${marca}`, null, recorrido.distancia_m, recorrido.tiempo_total_s],
    fondo: 'total',
  });
  return filas;
}

/**
 * Lista de despacho de la Tarea 6 (Día2_Ejercicio6). Cada ubicación pintada por nivel,
 * subtotal por recorrido (distancia de ida y vuelta y tiempo total) y total general.
 */
export function hojasPicking(resultado) {
  const filas = resultado.recorridos.flatMap((recorrido) => filasRecorrido(recorrido, resultado.lista));
  const { totales } = resultado;
  filas.push({ valores: ['TOTAL GENERAL', null, null, null, `${totales.recorridos} recorridos · ${totales.ubicaciones} ubicaciones`, null, totales.distancia_m, totales.tiempo_total_s], fondo: 'total' });
  return [
    {
      nombre: 'Picking',
      titulo: `Lista de despacho Tarea 6 — ${EMPRESA}`,
      bloque: [
        `Método: ${resultado.metodo} · máximo 3 ubicaciones por recorrido · cada recorrido sale y vuelve por la misma salida.`,
        `Supuestos: velocidad ${VELOCIDAD_OPERARIO} m/s y T = ${TIEMPO_RECOGIDA_NIVEL_1} s. Subtotal = distancia de ida y vuelta y tiempo total (caminar + recoger).`,
      ],
      columnas: COLUMNAS_PICKING,
      filas,
      leyenda: LEYENDA_NIVELES,
      congelarEncabezado: true,
      autofiltro: true,
    },
  ];
}

// ---------------------------------------------------------------------------
// Conteo cíclico (Tarea 8)
// ---------------------------------------------------------------------------

const NOMBRE_PERIODO = new Map(PERIODOS_CONTEO.map((periodo) => [periodo.numero, `${periodo.numero} · ${periodo.nombre}`]));

/** Hoja 1: una fila por referencia sorteada, en el orden de los sorteos (o solo las de `soloSorteo`). */
function hojaSorteos(sorteos, porSku, soloSorteo = null) {
  const veces = new Map();
  const filas = sorteos.flatMap((sorteo) =>
    sorteo.skus.map((sku) => {
      veces.set(sku, (veces.get(sku) ?? 0) + 1);
      const referencia = porSku.get(sku) ?? {};
      return {
        valores: [
          sorteo.numero,
          sorteo.fecha_hora.replace('T', ' '),
          NOMBRE_PERIODO.get(periodoDeSorteo(sorteo)) ?? '',
          sku,
          referencia.descripcion ?? '',
          referencia.categoria ?? '',
          referencia.codigo_ubicacion ?? '',
          veces.get(sku),
        ],
      };
    }),
  ).filter((fila) => soloSorteo === null || fila.valores[0] === soloSorteo);
  return {
    nombre: 'Sorteos',
    titulo: `Conteo cíclico: referencias sorteadas — ${EMPRESA}`,
    columnas: [
      { titulo: 'Sorteo', formato: 'numero', ancho: 8 },
      { titulo: 'Fecha y hora', formato: 'texto', ancho: 18 },
      { titulo: 'Periodo de conteo', formato: 'texto', ancho: 14 },
      { titulo: 'SKU', formato: 'numero', ancho: 9 },
      { titulo: 'Descripción', formato: 'texto', ancho: 28 },
      { titulo: 'Categoría', formato: 'texto', ancho: 18 },
      { titulo: 'Código de ubicación', formato: 'texto', ancho: 14 },
      { titulo: `Vez en el año (de ${CONTEOS_POR_ANIO})`, formato: 'numero', ancho: 10 },
    ],
    filas,
    zebra: true,
    congelarEncabezado: true,
    autofiltro: true,
  };
}

/** Hoja 2: cuántas veces salió cada referencia en el año; si no es exactamente 5, REVISAR. */
function hojaVerificacion(sorteos, referencias, registros, verificacion) {
  const sorteadas = new Map();
  for (const sorteo of sorteos) for (const sku of sorteo.skus) sorteadas.set(sku, (sorteadas.get(sku) ?? 0) + 1);
  const contadas = new Map();
  for (const registro of registros) contadas.set(registro.sku, (contadas.get(registro.sku) ?? 0) + 1);
  const ultimo = sorteos.at(-1);

  const filas = referencias.map((referencia) => {
    const veces = sorteadas.get(referencia.sku) ?? 0;
    const ok = veces === CONTEOS_POR_ANIO;
    return {
      valores: [referencia.sku, referencia.descripcion, veces, contadas.get(referencia.sku) ?? 0, ok ? 'OK' : 'REVISAR'],
      fondo: ok ? undefined : 'alerta',
    };
  });
  return {
    nombre: 'Verificación',
    titulo: `Conteo cíclico: verificación del año — ${EMPRESA}`,
    bloque: [
      `Total de referencias: ${referencias.length}`,
      `Total de conteos sorteados: ${verificacion.conteos_sorteados} de ${verificacion.conteos_esperados} (${CONTEOS_POR_ANIO} por referencia)`,
      ultimo
        ? `Semilla usada en el último sorteo (${ultimo.numero}): ${ultimo.semilla}. Las de todos los sorteos están en la hoja "Semillas".`
        : 'Todavía no hay sorteos.',
      verificacion.valido
        ? `Reglas: ninguna referencia repetida en un sorteo y ninguna con más de ${CONTEOS_POR_ANIO}. OK.`
        : `Reglas incumplidas: ${verificacion.errores.join(' · ')}`,
    ],
    columnas: [
      { titulo: 'SKU', formato: 'numero', ancho: 9 },
      { titulo: 'Descripción', formato: 'texto', ancho: 28 },
      { titulo: 'Conteos del año (sorteada)', formato: 'numero', ancho: 12 },
      { titulo: 'Conteos registrados', formato: 'numero', ancho: 12 },
      { titulo: `Estado (OK = exactamente ${CONTEOS_POR_ANIO})`, formato: 'texto', ancho: 14 },
    ],
    filas,
    zebra: true,
    leyenda: [{ texto: `REVISAR: la referencia no lleva exactamente ${CONTEOS_POR_ANIO} conteos en el año`, fondo: 'alerta' }],
    congelarEncabezado: true,
    autofiltro: true,
  };
}

/** Hoja 3: la semilla de cada sorteo (con la misma semilla y el mismo estado sale la misma lista). */
function hojaSemillas(sorteos) {
  return {
    nombre: 'Semillas',
    titulo: 'Semilla de cada sorteo (reproducible)',
    columnas: [
      { titulo: 'Sorteo', formato: 'numero', ancho: 8 },
      { titulo: 'Fecha y hora', formato: 'texto', ancho: 18 },
      { titulo: 'Periodo de conteo', formato: 'texto', ancho: 14 },
      { titulo: 'Semilla', formato: 'numero', ancho: 14 },
      { titulo: 'Referencias sorteadas', formato: 'numero', ancho: 12 },
    ],
    filas: sorteos.map((sorteo) => ({
      valores: [sorteo.numero, sorteo.fecha_hora.replace('T', ' '), NOMBRE_PERIODO.get(periodoDeSorteo(sorteo)) ?? '', sorteo.semilla, sorteo.skus.length],
    })),
    zebra: true,
    congelarEncabezado: true,
    autofiltro: true,
  };
}

/** Conteo cíclico (Día2_Ejercicio8): sorteos, verificación del año y semillas. */
export function hojasConteo({ sorteos, referencias, registros, verificacion, soloSorteo = null }) {
  const porSku = new Map(referencias.map((referencia) => [referencia.sku, referencia]));
  return [hojaSorteos(sorteos, porSku, soloSorteo), hojaVerificacion(sorteos, referencias, registros, verificacion), hojaSemillas(sorteos)];
}

// ---------------------------------------------------------------------------
// Maestro de ubicaciones (Tarea 1)
// ---------------------------------------------------------------------------

const FONDO_POR_CLASE = { A: 'claseA', B: 'claseB', C: 'claseC' };

/** Maestro (Día2_Ejercicio1): cada referencia pintada por su clase ABC. */
export function hojasMaestro(maestro) {
  const conteo = maestro.conteo_por_clase ?? {};
  return [
    {
      nombre: 'Maestro',
      titulo: `Maestro de ubicaciones — ${EMPRESA}`,
      bloque: [
        `Clase ABC por líneas de pedido en Arauca: A hasta el ${UMBRAL_CLASE_A * 100} % acumulado, B hasta el ${UMBRAL_CLASE_B * 100} %, C el resto.`,
        `Las referencias más populares van en el nivel 1 y cerca de la salida. Resultado: ${conteo.A ?? 0} A, ${conteo.B ?? 0} B y ${conteo.C ?? 0} C.`,
      ],
      columnas: [
        { titulo: 'SKU', formato: 'numero', ancho: 9 },
        { titulo: 'Descripción', formato: 'texto', ancho: 28 },
        { titulo: 'Categoría', formato: 'texto', ancho: 18 },
        { titulo: 'Popularidad (líneas de pedido)', formato: 'numero', ancho: 12 },
        { titulo: 'Clase ABC', formato: 'texto', ancho: 8 },
        { titulo: 'Código de ubicación', formato: 'texto', ancho: 14 },
        { titulo: 'Nivel', formato: 'numero', ancho: 7 },
      ],
      filas: maestro.referencias.map((referencia) => ({
        valores: [referencia.sku, referencia.descripcion, referencia.categoria, referencia.popularidad, referencia.clase_abc, referencia.codigo_ubicacion, referencia.nivel],
        fondo: FONDO_POR_CLASE[referencia.clase_abc],
      })),
      leyenda: [
        { texto: `Clase A (${conteo.A ?? 0})`, fondo: 'claseA' },
        { texto: `Clase B (${conteo.B ?? 0})`, fondo: 'claseB' },
        { texto: `Clase C (${conteo.C ?? 0})`, fondo: 'claseC' },
      ],
      congelarEncabezado: true,
      autofiltro: true,
    },
  ];
}

// ---------------------------------------------------------------------------
// Tablas sencillas (registros de conteo, pedidos)
// ---------------------------------------------------------------------------

/**
 * Una hoja a partir de las columnas {campo, titulo} de los CSV. Los decimales llevan 1 cifra.
 * `alerta(fila)` marca en rojo las filas que lo cumplan (ej. conteos con diferencia).
 */
export function hojaTabla({ nombre, titulo, columnas, filas, alerta = () => false }) {
  const formatoDe = (campo) => {
    const valores = filas.map((fila) => fila[campo]).filter((valor) => valor !== null && valor !== undefined);
    if (!valores.length || !valores.every((valor) => typeof valor === 'number')) return 'texto';
    return valores.every(Number.isInteger) ? 'numero' : 'decimal';
  };
  return [
    {
      nombre,
      titulo: `${titulo} — ${EMPRESA}`,
      columnas: columnas.map((columna) => ({ titulo: columna.titulo, formato: formatoDe(columna.campo), ancho: 10 })),
      filas: filas.map((fila) => ({
        valores: columnas.map(({ campo }) => {
          const valor = fila[campo];
          if (Array.isArray(valor)) return valor.join(', ');
          return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(valor) ? valor.replace('T', ' ') : valor;
        }),
        fondo: alerta(fila) ? 'alerta' : undefined,
      })),
      zebra: true,
      congelarEncabezado: true,
      autofiltro: true,
    },
  ];
}
