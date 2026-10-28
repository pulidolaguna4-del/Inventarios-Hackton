// Layout de la bodega de Arauca: ubicaciones, coordenadas y distancias.
//
// Una ubicación se identifica por (columna, fila, nivel). El número del plano solo
// es una etiqueta, porque en el plano el 22 y el 35 aparecen dos veces.
//
// Modelo de coordenadas (en metros):
// - x: centro del pasillo desde el que se recoge la columna.
// - y: centro de la celda medido desde la pared de las salidas (y = 0).
// - Debajo de y = ALTO_ZONA_ABIERTA hay una zona libre donde se camina en línea recta.
// - Para pasar de un pasillo a otro se usa la cabecera inferior o la superior.

import {
  ALTO_ZONA_ABIERTA,
  ANCHO_PASILLO,
  ESPACIO_SUPERIOR,
  FONDO_RACK,
  LADO_RACK_POR_COLUMNA,
  LARGO_CELDA,
  LAYOUT_NUMEROS,
  NIVELES_PICKING,
  NUM_COLUMNAS,
  NUM_FILAS,
  SALIDAS,
  TOLERANCIA_METROS,
  X_PASILLO_POR_COLUMNA,
  Y_CABECERA_INFERIOR,
  Y_CABECERA_SUPERIOR,
} from './config.js';

const PATRON_CODIGO = /^C(\d+)-F(\d+)-N(\d+)$/;

// ---------------------------------------------------------------------------
// Ubicaciones
// ---------------------------------------------------------------------------

/** Arma el código de ubicación, por ejemplo (3, 4, 2) -> 'C3-F04-N2'. */
export function codigoUbicacion(columna, fila, nivel) {
  validarCelda(columna, fila);
  validarNivel(nivel);
  return `C${columna}-F${String(fila).padStart(2, '0')}-N${nivel}`;
}

/** Convierte 'C3-F04-N2' en {columna: 3, fila: 4, nivel: 2}. Lanza error si no es válido. */
export function interpretarCodigo(codigo) {
  const coincidencia = String(codigo).trim().toUpperCase().match(PATRON_CODIGO);
  if (!coincidencia) throw new Error(`Código de ubicación inválido: '${codigo}'`);
  const [columna, fila, nivel] = coincidencia.slice(1).map(Number);
  validarCelda(columna, fila);
  validarNivel(nivel);
  return { columna, fila, nivel };
}

/** Lanza error si la columna o la fila no existen en la bodega. */
export function validarCelda(columna, fila) {
  if (!(columna >= 1 && columna <= NUM_COLUMNAS)) {
    throw new Error(`La columna debe estar entre 1 y ${NUM_COLUMNAS}: ${columna}`);
  }
  if (!(fila >= 1 && fila <= NUM_FILAS)) {
    throw new Error(`La fila debe estar entre 1 y ${NUM_FILAS}: ${fila}`);
  }
}

/** Lanza error si el nivel no es de picking. */
export function validarNivel(nivel) {
  if (!NIVELES_PICKING.includes(nivel)) {
    throw new Error(`El nivel debe ser uno de ${NIVELES_PICKING.join(', ')}: ${nivel}`);
  }
}

/** Devuelve el número con que aparece la celda en el plano. */
export function numeroPlano(columna, fila) {
  validarCelda(columna, fila);
  return LAYOUT_NUMEROS[fila - 1][columna - 1];
}

/** Lista todas las celdas {columna, fila}, de arriba a abajo y de izquierda a derecha. */
export function celdas() {
  const resultado = [];
  for (let fila = 1; fila <= NUM_FILAS; fila++) {
    for (let columna = 1; columna <= NUM_COLUMNAS; columna++) resultado.push({ columna, fila });
  }
  return resultado;
}

/** Devuelve las celdas que llevan ese número en el plano (dos para el 22 y el 35). */
export function buscarPorNumero(numero) {
  return celdas().filter(({ columna, fila }) => numeroPlano(columna, fila) === numero);
}

/** Devuelve la única celda con ese número; lanza error si no existe o está repetido. */
export function celdaUnicaPorNumero(numero) {
  const encontradas = buscarPorNumero(numero);
  if (encontradas.length === 0) throw new Error(`El número ${numero} no está en el plano`);
  if (encontradas.length > 1) {
    const lista = encontradas.map(({ columna, fila }) => `C${columna}-F${String(fila).padStart(2, '0')}`).join(', ');
    throw new Error(`El número ${numero} está repetido en el plano (${lista}); use columna y fila`);
  }
  return encontradas[0];
}

/** Lista todos los huecos de picking (celda × nivel) con su código y coordenadas. */
export function huecos(niveles = NIVELES_PICKING) {
  const resultado = [];
  for (const { columna, fila } of celdas()) {
    const [x, y] = coordenadasCelda(columna, fila);
    for (const nivel of niveles) {
      resultado.push({
        codigo_ubicacion: codigoUbicacion(columna, fila, nivel),
        columna,
        fila,
        nivel,
        numero_plano: numeroPlano(columna, fila),
        x,
        y,
      });
    }
  }
  return resultado;
}

// ---------------------------------------------------------------------------
// Coordenadas
// ---------------------------------------------------------------------------

/**
 * Devuelve [x, y] del punto del pasillo frente a la celda.
 * La fila 9 queda en y = 6,2 y la fila 1 en y = 25,4 con los valores por defecto.
 */
export function coordenadasCelda(columna, fila) {
  validarCelda(columna, fila);
  const x = X_PASILLO_POR_COLUMNA[columna];
  const y = ALTO_ZONA_ABIERTA + (NUM_FILAS - fila) * LARGO_CELDA + LARGO_CELDA / 2;
  return [x, y];
}

/**
 * Centro [x, y] del rack de una celda (para dibujarla). El rack queda al lado izquierdo
 * o derecho de su pasillo según LADO_RACK_POR_COLUMNA, pegado al borde del pasillo.
 */
export function centroRack(columna, fila) {
  const [xPasillo, y] = coordenadasCelda(columna, fila);
  const desplazamiento = ANCHO_PASILLO / 2 + FONDO_RACK / 2;
  const signo = LADO_RACK_POR_COLUMNA[columna] === 'izquierda' ? -1 : 1;
  return [xPasillo + signo * desplazamiento, y];
}

/** Límites del dibujo de la bodega: desde la pared de las salidas hasta la pared del fondo. */
export function limitesBodega() {
  const ejes = Object.values(X_PASILLO_POR_COLUMNA);
  return {
    x_min: Math.min(0, ...ejes.map((x) => x - ANCHO_PASILLO / 2 - FONDO_RACK)),
    x_max: Math.max(...ejes) + ANCHO_PASILLO / 2,
    y_min: 0,
    y_max: ALTO_ZONA_ABIERTA + NUM_FILAS * LARGO_CELDA + ESPACIO_SUPERIOR,
  };
}

/** Devuelve [x, y] de una salida ('IZQ' o 'DER'). */
export function coordenadasSalida(nombre) {
  if (!(nombre in SALIDAS)) {
    throw new Error(`Salida desconocida '${nombre}'. Opciones: ${Object.keys(SALIDAS).join(', ')}`);
  }
  return SALIDAS[nombre];
}

// ---------------------------------------------------------------------------
// Distancias
// ---------------------------------------------------------------------------

/**
 * Distancia caminando entre dos puntos [x, y] de la bodega.
 * - Mismo pasillo: solo se recorre la diferencia de altura.
 * - Si alguno está en la zona abierta: distancia Manhattan directa.
 * - Pasillos distintos: se cruza por la cabecera inferior o la superior, la más corta.
 */
export function distancia([x1, y1], [x2, y2]) {
  if (Math.abs(x1 - x2) <= TOLERANCIA_METROS) return Math.abs(y1 - y2);
  if (y1 <= ALTO_ZONA_ABIERTA || y2 <= ALTO_ZONA_ABIERTA) return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  return Math.min(
    ...[Y_CABECERA_INFERIOR, Y_CABECERA_SUPERIOR].map(
      (yCabecera) => Math.abs(y1 - yCabecera) + Math.abs(x1 - x2) + Math.abs(y2 - yCabecera),
    ),
  );
}

/**
 * Tramos rectos para ir de un punto a otro siguiendo la misma regla que `distancia()`,
 * así la suma de sus largos es exactamente esa distancia. Cada tramo es
 * {tipo_tramo, punto_inicio, punto_fin} con tipo 'pasillo' (avance por un pasillo),
 * 'cabecera' (cruce entre pasillos) o 'zona_abierta' (franja libre frente a las salidas).
 * - Mismo pasillo: un tramo vertical.
 * - Alguno en la zona abierta: el tramo horizontal va a la altura del punto más bajo,
 *   para no atravesar racks, y el vertical por el pasillo.
 * - Pasillos distintos: hasta la cabecera más corta, cruzarla y avanzar al destino.
 * Los tramos de largo 0 se omiten.
 */
export function tramosEntre(puntoA, puntoB) {
  const [x1, y1] = puntoA;
  const [x2, y2] = puntoB;
  let piezas;
  if (Math.abs(x1 - x2) <= TOLERANCIA_METROS) {
    piezas = [['pasillo', [x1, y1], [x2, y2]]];
  } else if (y1 <= ALTO_ZONA_ABIERTA || y2 <= ALTO_ZONA_ABIERTA) {
    piezas =
      y1 <= y2
        ? [['zona_abierta', [x1, y1], [x2, y1]], ['pasillo', [x2, y1], [x2, y2]]]
        : [['pasillo', [x1, y1], [x1, y2]], ['zona_abierta', [x1, y2], [x2, y2]]];
  } else {
    const costo = (yc) => Math.abs(y1 - yc) + Math.abs(y2 - yc);
    // Mismo desempate que distancia(): ante igual largo, la cabecera inferior.
    const yc = costo(Y_CABECERA_SUPERIOR) < costo(Y_CABECERA_INFERIOR) - TOLERANCIA_METROS ? Y_CABECERA_SUPERIOR : Y_CABECERA_INFERIOR;
    piezas = [
      ['pasillo', [x1, y1], [x1, yc]],
      ['cabecera', [x1, yc], [x2, yc]],
      ['pasillo', [x2, yc], [x2, y2]],
    ];
  }
  return piezas
    .filter(([, inicio, fin]) => Math.abs(inicio[0] - fin[0]) + Math.abs(inicio[1] - fin[1]) > TOLERANCIA_METROS)
    .map(([tipo, inicio, fin]) => ({ tipo_tramo: tipo, punto_inicio: inicio, punto_fin: fin }));
}

/** Suma las distancias de una ruta que visita los puntos en ese orden. */
export function distanciaRuta(puntos) {
  let total = 0;
  for (let i = 0; i < puntos.length - 1; i++) total += distancia(puntos[i], puntos[i + 1]);
  return total;
}

/** Distancia de un recorrido que sale por `salida`, visita las celdas en orden y vuelve. */
export function distanciaRecorrido(celdasAVisitar, salida) {
  const puntoSalida = coordenadasSalida(salida);
  const puntos = [puntoSalida, ...celdasAVisitar.map(({ columna, fila }) => coordenadasCelda(columna, fila)), puntoSalida];
  return distanciaRuta(puntos);
}
