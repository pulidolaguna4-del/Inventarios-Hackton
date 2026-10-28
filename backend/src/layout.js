// Layout para el mapa 3D: todo lo que el frontend necesita para dibujar sin saber nada
// de la bodega. Las medidas salen de config.js y las coordenadas de bodega.js y maqueta.js.
//
// Ejes: x a lo ancho, y desde la pared de las salidas hacia el fondo, z hacia arriba.
// En cada celda, (x, y) es el centro del estante en planta y z la altura del centro de
// la caja; `punto_recogida` es el punto del pasillo donde se detiene el carrito.

import * as bodega from './bodega.js';
import * as maqueta from './maqueta.js';
import {
  ALTO_NIVEL,
  ALTO_NIVEL_U,
  ALTO_ZONA_ABIERTA,
  ANCHO_PASILLO,
  ANCHO_PASILLO_U,
  FONDO_ESTANTE_U,
  FONDO_RACK,
  LARGO_CELDA,
  NIVELES_MAQUETA,
  NIVELES_PICKING,
  NUM_COLUMNAS,
  NUM_FILAS,
  NUM_TRAVESANOS,
  SALIDAS,
  SEPARACION_POSICIONES_U,
  X_PASILLO_POR_COLUMNA,
  Y_CABECERA_INFERIOR,
  Y_CABECERA_SUPERIOR,
} from './config.js';

export const VISTAS_LAYOUT = ['arauca', 'maqueta'];

/** Datos de la referencia que ocupa una celda (o vacío si no hay ninguna). */
function datosOcupacion(referencia) {
  return {
    ocupada: Boolean(referencia),
    sku: referencia?.sku ?? null,
    descripcion: referencia?.descripcion ?? null,
    clase_abc: referencia?.clase_abc ?? null,
    categoria: referencia?.categoria ?? null,
  };
}

function medidasDesdeLimites(limites) {
  return {
    ancho_total: limites.x_max - limites.x_min,
    largo_total: limites.y_max - limites.y_min,
    limites,
  };
}

/**
 * Layout de la bodega de Arauca: 7 columnas × 9 filas × 2 niveles (126 huecos), las 123
 * referencias del maestro en sus celdas, las salidas, las cabeceras y el eje de cada pasillo.
 */
export function layoutArauca(referencias) {
  const porCodigo = new Map(referencias.map((referencia) => [referencia.codigo_ubicacion, referencia]));
  const celdas = bodega.huecos().map((hueco) => {
    const [x, y] = bodega.centroRack(hueco.columna, hueco.fila);
    return {
      codigo_ubicacion: hueco.codigo_ubicacion,
      columna: hueco.columna,
      fila: hueco.fila,
      nivel: hueco.nivel,
      etiqueta: String(hueco.numero_plano),
      x,
      y,
      z: (hueco.nivel - 0.5) * ALTO_NIVEL,
      punto_recogida: { x: hueco.x, y: hueco.y },
      ...datosOcupacion(porCodigo.get(hueco.codigo_ubicacion)),
    };
  });

  const limites = bodega.limitesBodega();
  const yFinPasillos = ALTO_ZONA_ABIERTA + NUM_FILAS * LARGO_CELDA;
  const ejes = [...new Set(Object.values(X_PASILLO_POR_COLUMNA))].sort((a, b) => a - b);
  return {
    vista: 'arauca',
    nombre: 'Bodega satélite Arauca',
    medidas: {
      ...medidasDesdeLimites(limites),
      columnas: NUM_COLUMNAS,
      filas: NUM_FILAS,
      niveles: NIVELES_PICKING.length,
      travesanos: NUM_TRAVESANOS,
      alto_nivel: ALTO_NIVEL,
      largo_celda: LARGO_CELDA,
      fondo_rack: FONDO_RACK,
      ancho_pasillo: ANCHO_PASILLO,
      alto_zona_abierta: ALTO_ZONA_ABIERTA,
    },
    celdas,
    salidas: Object.entries(SALIDAS).map(([nombre, [x, y]]) => ({ nombre, x, y })),
    cabeceras: [
      { nombre: 'inferior', y: Y_CABECERA_INFERIOR, x_inicio: ejes[0], x_fin: ejes.at(-1) },
      { nombre: 'superior', y: Y_CABECERA_SUPERIOR, x_inicio: ejes[0], x_fin: ejes.at(-1) },
    ],
    // Eje de cada pasillo como segmento (mismo formato que la maqueta).
    pasillos: ejes.map((x, indice) => ({
      nombre: `P${indice + 1}`,
      tipo: 'pasillo',
      columnas: Object.entries(X_PASILLO_POR_COLUMNA).filter(([, eje]) => eje === x).map(([columna]) => Number(columna)),
      x_inicio: x,
      y_inicio: ALTO_ZONA_ABIERTA,
      x_fin: x,
      y_fin: yFinPasillos,
    })),
  };
}

/**
 * Layout de la maqueta del robot: la U de 15 posiciones (NIVELES_MAQUETA niveles), las 11
 * referencias nuevas en las posiciones que asignó logística, la entrada, la salida y los
 * ejes del pasillo en U y del frente.
 */
export function layoutMaqueta(referencias, logistica) {
  const porSku = new Map(referencias.map((referencia) => [referencia.sku, referencia]));
  const ocupadas = new Map(maqueta.ocupacionMaqueta(logistica).map((o) => [`${o.posicion.indice_anillo}-${o.nivel}`, o.sku]));
  const celdas = [];
  for (const posicion of maqueta.posicionesMaqueta()) {
    for (let nivel = 1; nivel <= NIVELES_MAQUETA; nivel++) {
      const sku = ocupadas.get(`${posicion.indice_anillo}-${nivel}`);
      celdas.push({
        codigo_ubicacion: maqueta.codigoMaqueta(posicion.codigo, nivel, posicion.lado),
        columna: null,
        fila: null,
        nivel,
        etiqueta: posicion.codigo,
        indice_anillo: posicion.indice_anillo,
        zona: posicion.zona,
        lado: posicion.lado,
        lado_anillo: posicion.lado_anillo,
        x: posicion.centro_estante[0],
        y: posicion.centro_estante[1],
        z: (nivel - 0.5) * ALTO_NIVEL_U,
        punto_recogida: { x: posicion.punto_recogida[0], y: posicion.punto_recogida[1] },
        ...datosOcupacion(sku === undefined ? null : porSku.get(sku) ?? { sku }),
      });
    }
  }

  const lados = maqueta.ladosDelAnillo();
  const salida = maqueta.puntoEnAnillo(maqueta.sSalida());
  return {
    vista: 'maqueta',
    nombre: 'Maqueta del robot (bodega en U)',
    medidas: {
      ...medidasDesdeLimites(maqueta.limitesMaqueta()),
      posiciones: celdas.length / NIVELES_MAQUETA,
      niveles: NIVELES_MAQUETA,
      travesanos: NIVELES_MAQUETA + 1,
      alto_nivel: ALTO_NIVEL_U,
      largo_celda: SEPARACION_POSICIONES_U,
      fondo_rack: FONDO_ESTANTE_U,
      ancho_pasillo: ANCHO_PASILLO_U,
      perimetro: maqueta.perimetroAnillo(),
    },
    celdas,
    salidas: [
      { nombre: 'ENTRADA', x: 0, y: 0 },
      { nombre: 'SALIDA', x: salida[0], y: salida[1] },
    ],
    cabeceras: [],
    pasillos: lados.map((lado) => ({
      nombre: lado.nombre,
      tipo: lado.tipo_tramo,
      x_inicio: lado.inicio[0],
      y_inicio: lado.inicio[1],
      x_fin: lado.inicio[0] + lado.direccion[0] * lado.largo,
      y_fin: lado.inicio[1] + lado.direccion[1] * lado.largo,
    })),
  };
}
