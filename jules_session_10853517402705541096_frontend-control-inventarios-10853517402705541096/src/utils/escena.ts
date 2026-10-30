// Geometría de la escena 3D, como funciones puras (se pueden probar sin WebGL).
//
// Todo sale del layout del backend: aquí solo se decide cómo se ve cada pieza (parales, vigas,
// estibas, cajas, etiquetas, franjas del piso). Ejes del backend: x a lo ancho, y hacia el fondo,
// z hacia arriba. En three.js: x igual, la altura es "y" y el fondo queda hacia -z.

import type { CeldaLayout, LayoutBodega } from '../types/inventario';

export type Vector3 = [number, number, number];

/** Una caja de la escena: centro y tamaño en coordenadas de three.js (y opcional, un tono). */
export interface Pieza {
  posicion: Vector3;
  tamano: Vector3;
  /** Índice de color (cajas: tono kraft; franjas: amarillo o negro). */
  tono?: number;
}

/** Convierte un punto del backend a three.js, centrado en la bodega. */
export function crearConversor(layout: LayoutBodega) {
  const { limites } = layout.medidas;
  const cx = (limites.x_min + limites.x_max) / 2;
  const cy = (limites.y_min + limites.y_max) / 2;
  return (x: number, y: number, alto = 0): Vector3 => [x - cx, alto, -(y - cy)];
}
export type Conversor = ReturnType<typeof crearConversor>;

/** Un estante: las celdas de los distintos niveles que comparten el mismo lugar en planta. */
export interface Estante {
  clave: string;
  x: number;
  y: number;
  /** true si el estante es largo en y (su pasillo corre a lo largo de y). */
  largoEnY: boolean;
  /** Hacia dónde queda el pasillo (frente del estante), en el backend: +1 o -1 sobre el eje corto. */
  frente: number;
  celdas: CeldaLayout[];
}

export function agruparEstantes(celdas: CeldaLayout[]): Estante[] {
  const porLugar = new Map<string, Estante>();
  for (const celda of celdas) {
    const clave = `${celda.x.toFixed(3)}|${celda.y.toFixed(3)}`;
    if (!porLugar.has(clave)) {
      const dx = celda.punto_recogida.x - celda.x;
      const dy = celda.punto_recogida.y - celda.y;
      const largoEnY = Math.abs(dx) > Math.abs(dy);
      porLugar.set(clave, { clave, x: celda.x, y: celda.y, largoEnY, frente: Math.sign(largoEnY ? dx : dy) || 1, celdas: [] });
    }
    porLugar.get(clave)!.celdas.push(celda);
  }
  return [...porLugar.values()];
}

// ---------------------------------------------------------------------------
// Cajas reproducibles por SKU
// ---------------------------------------------------------------------------

/** Generador pseudoaleatorio con semilla (mulberry32): mismo SKU, mismas cajas. */
export function aleatorioConSemilla(semilla: number): () => number {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TONOS_CAJA = 3;

export interface CajaEnEstiba {
  /** Hueco en la rejilla 2×2 de la estiba (0..3); una sola caja ocupa el centro (-1). */
  hueco: number;
  /** Alto relativo (0..1) y tono kraft (0..TONOS_CAJA-1). */
  alto: number;
  tono: number;
}

/** De 1 a 4 cajas por SKU, con alto y tono que salen de una semilla: siempre se ve igual. */
export function cajasDeSku(sku: number): CajaEnEstiba[] {
  const azar = aleatorioConSemilla(sku * 2654435761);
  const cantidad = 1 + Math.floor(azar() * 4);
  if (cantidad === 1) return [{ hueco: -1, alto: azar(), tono: Math.floor(azar() * TONOS_CAJA) }];
  // Barajar (Fisher-Yates con la misma semilla) y quedarse con los primeros huecos.
  const huecos = [0, 1, 2, 3];
  for (let i = huecos.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [huecos[i], huecos[j]] = [huecos[j], huecos[i]];
  }
  huecos.splice(cantidad);
  huecos.sort((a, b) => a - b);
  return huecos.map((hueco) => ({ hueco, alto: azar(), tono: Math.floor(azar() * TONOS_CAJA) }));
}

// ---------------------------------------------------------------------------
// Estanterías porta-pallet
// ---------------------------------------------------------------------------

const GROSOR_PARAL = 0.08;
const ALTO_VIGA = 0.12;
const GROSOR_VIGA = 0.07;
const ALTO_ESTIBA = 0.14;

export interface PiezasEstanterias {
  parales: Pieza[];
  vigas: Pieza[];
  estibas: Pieza[];
  cajas: Pieza[];
  /** Una etiqueta por celda, al frente de su viga (en el mismo orden que `celdas`). */
  etiquetas: Pieza[];
  /** Volumen de cada celda: para el cursor, los clics y los contornos. */
  volumenes: Pieza[];
  celdas: CeldaLayout[];
}

/** Altura (three.js) de la cara de arriba de la viga del nivel `nivel` (1 = piso). */
export function alturaNivel(layout: LayoutBodega, nivel: number): number {
  return (nivel - 1) * layout.medidas.alto_nivel + ALTO_VIGA;
}

/** Todas las piezas de las estanterías, calculadas una vez por layout. */
export function piezasEstanterias(layout: LayoutBodega, aThree: Conversor): PiezasEstanterias {
  const { medidas } = layout;
  const largo = medidas.largo_celda * 0.94;
  const fondo = medidas.fondo_rack * 0.9;
  const altoTotal = (medidas.travesanos - 1) * medidas.alto_nivel;
  const piezas: PiezasEstanterias = { parales: [], vigas: [], estibas: [], cajas: [], etiquetas: [], volumenes: [], celdas: [] };

  for (const estante of agruparEstantes(layout.celdas)) {
    const [x, , z] = aThree(estante.x, estante.y);
    // Tamaño en planta del estante en three.js: [ancho en x, profundidad en z].
    const [ancho, profundidad] = estante.largoEnY ? [fondo, largo] : [largo, fondo];
    // El frente (lado del pasillo) en three.js: en x si el estante es largo en y; si no, en -z.
    const frente: [number, number] = estante.largoEnY ? [estante.frente, 0] : [0, -estante.frente];

    // Parales azules en las 4 esquinas, de piso a la viga superior.
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      piezas.parales.push({
        posicion: [x + (sx * (ancho - GROSOR_PARAL)) / 2, (altoTotal + ALTO_VIGA) / 2, z + (sz * (profundidad - GROSOR_PARAL)) / 2],
        tamano: [GROSOR_PARAL, altoTotal + ALTO_VIGA, GROSOR_PARAL],
      });
    }
    // Vigas naranjas: una al frente y otra atrás en cada travesaño (piso, intermedia, superior).
    for (let k = 0; k < medidas.travesanos; k++) {
      const alto = k * medidas.alto_nivel + ALTO_VIGA / 2;
      for (const lado of [1, -1]) {
        piezas.vigas.push({
          posicion: [x + (frente[0] * lado * (ancho - GROSOR_VIGA)) / 2, alto, z + (frente[1] * lado * (profundidad - GROSOR_VIGA)) / 2],
          tamano: estante.largoEnY ? [GROSOR_VIGA, ALTO_VIGA, profundidad] : [ancho, ALTO_VIGA, GROSOR_VIGA],
        });
      }
    }

    for (const celda of estante.celdas) {
      const base = alturaNivel(layout, celda.nivel);
      // Estiba de madera sobre la viga.
      const [anchoEstiba, profEstiba] = [ancho * 0.86, profundidad * 0.86];
      piezas.estibas.push({ posicion: [x, base + ALTO_ESTIBA / 2, z], tamano: [anchoEstiba, ALTO_ESTIBA, profEstiba] });

      // Cajas kraft (solo si la celda está ocupada).
      if (celda.ocupada && celda.sku !== null) {
        const libre = medidas.alto_nivel - ALTO_VIGA - ALTO_ESTIBA - 0.12;
        for (const caja of cajasDeSku(celda.sku)) {
          const alto = Math.min(libre, 0.35 + caja.alto * 0.4);
          if (caja.hueco === -1) {
            piezas.cajas.push({ posicion: [x, base + ALTO_ESTIBA + alto / 2, z], tamano: [anchoEstiba * 0.8, alto, profEstiba * 0.8], tono: caja.tono });
            continue;
          }
          const [cx, cz] = [caja.hueco % 2 === 0 ? -1 : 1, caja.hueco < 2 ? -1 : 1];
          const [mx, mz] = [anchoEstiba / 2, profEstiba / 2];
          piezas.cajas.push({
            posicion: [x + (cx * mx) / 2, base + ALTO_ESTIBA + alto / 2, z + (cz * mz) / 2],
            tamano: [mx * 0.9, alto, mz * 0.9],
            tono: caja.tono,
          });
        }
      }

      // Etiqueta de color al frente de la viga de la celda.
      const altoViga = (celda.nivel - 1) * medidas.alto_nivel + ALTO_VIGA / 2;
      piezas.etiquetas.push({
        posicion: [x + frente[0] * (ancho / 2 + 0.012), altoViga, z + frente[1] * (profundidad / 2 + 0.012)],
        tamano: estante.largoEnY ? [0.02, ALTO_VIGA * 0.8, Math.min(0.5, largo * 0.3)] : [Math.min(0.5, largo * 0.3), ALTO_VIGA * 0.8, 0.02],
      });
      piezas.volumenes.push({
        posicion: [x, celda.z, z],
        tamano: [ancho * 0.96, medidas.alto_nivel * 0.92, profundidad * 0.96],
      });
      piezas.celdas.push(celda);
    }
  }
  return piezas;
}

// ---------------------------------------------------------------------------
// Piso: franjas de seguridad
// ---------------------------------------------------------------------------

const LARGO_FRANJA = 0.5;
const ANCHO_FRANJA = 0.08;

/** Segmentos de franja amarilla y negra (tono 0 = amarillo, 1 = negro) a lo largo de una línea del backend. */
function franjasEnLinea(aThree: Conversor, x0: number, y0: number, x1: number, y1: number): Pieza[] {
  const largo = Math.hypot(x1 - x0, y1 - y0);
  const cantidad = Math.max(1, Math.floor(largo / LARGO_FRANJA));
  const enY = Math.abs(y1 - y0) >= Math.abs(x1 - x0);
  const piezas: Pieza[] = [];
  for (let i = 0; i < cantidad; i++) {
    const f = (i + 0.5) / cantidad;
    const posicion = aThree(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, 0.006);
    const tramo = largo / cantidad;
    piezas.push({ posicion, tamano: enY ? [ANCHO_FRANJA, 0.01, tramo] : [tramo, 0.01, ANCHO_FRANJA], tono: i % 2 });
  }
  return piezas;
}

/** Franjas a ambos lados de cada pasillo y en el borde de la zona abierta frente a las salidas. */
export function franjasSeguridad(layout: LayoutBodega, aThree: Conversor): Pieza[] {
  const mitad = layout.medidas.ancho_pasillo / 2;
  const piezas: Pieza[] = [];
  for (const pasillo of layout.pasillos) {
    const enY = Math.abs(pasillo.y_fin - pasillo.y_inicio) >= Math.abs(pasillo.x_fin - pasillo.x_inicio);
    for (const lado of [-1, 1]) {
      const [ox, oy] = enY ? [lado * mitad, 0] : [0, lado * mitad];
      piezas.push(...franjasEnLinea(aThree, pasillo.x_inicio + ox, pasillo.y_inicio + oy, pasillo.x_fin + ox, pasillo.y_fin + oy));
    }
  }
  const zonaAbierta = (layout.medidas as { alto_zona_abierta?: number }).alto_zona_abierta;
  if (zonaAbierta) {
    const { x_min, x_max } = layout.medidas.limites;
    piezas.push(...franjasEnLinea(aThree, x_min + 0.3, zonaAbierta, x_max - 0.3, zonaAbierta));
  }
  return piezas;
}

/** Texto pintado en el piso para una salida del layout. */
export const textoSalida = (nombre: string) => (nombre === 'IZQ' || nombre === 'DER' ? `SALIDA ${nombre}` : nombre);

/** Mueve una etiqueta del DOM a su posición en pantalla (o la oculta). */
export function moverEtiqueta(caja: HTMLDivElement | null, pantalla: { x: number; y: number } | null) {
  if (!caja) return;
  caja.style.visibility = pantalla ? 'visible' : 'hidden';
  if (pantalla) caja.style.transform = `translate3d(${pantalla.x.toFixed(1)}px, ${pantalla.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
}
