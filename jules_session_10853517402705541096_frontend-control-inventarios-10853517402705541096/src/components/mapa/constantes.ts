// Constantes y utilidades del mapa 3D, aparte de los componentes para que la recarga
// en caliente de Vite funcione (un archivo de componentes solo debe exportar componentes).

export const COLORES_ABC: Record<string, string> = { A: '#ff6b2c', B: '#4a6fa5', C: '#a8a29e' };
export const COLORES_CATEGORIA: Record<string, string> = {
  'Aire acondicionado': '#4a6fa5',
  'Equipos de audio': '#ff6b2c',
  'Equipos de cómputo': '#2f9e6e',
  Refrigeración: '#8e6bbf',
};

/**
 * Colores de la escena 3D (estilo isométrico "casa de muñecas": colores sólidos, sin texturas).
 * Están todos aquí para ajustarlos con el rediseño general.
 */
export const ESCENA = {
  fondo: '#e6ebf1',
  piso: '#cdd6e1',
  baldosa: '#b9c4d2',
  pared: '#a9c1dc',
  paredCorte: '#4f6784',
  paral: '#2f6fb3',
  viga: '#f08a24',
  estiba: '#b98a55',
  cajas: ['#c9935a', '#d9a86c', '#b57d45'],
  seguridad: ['#f5c518', '#1d1d1f'],
  salidaTexto: '#1d1d1f',
  salidaFlecha: '#f5c518',
  chasis: '#f5c518',
  contrapeso: '#3a3d42',
  rueda: '#1d1d1f',
  mastil: '#4a4e55',
  horquillas: '#2b2d31',
  baliza: '#ff6b2c',
  // Capa futurista
  ruta: '#e8590c',
  rutaRecorrida: '#ff8a3d',
  anillo: '#ff6b2c',
  contornoActivo: '#ff6b2c',
  contornoPendiente: '#e0a800',
  contornoVisitada: '#3a3d42',
  sinDato: '#d9d4c7',
};

/** Velocidades de reproducción del carrito. */
export const VELOCIDADES = [1, 2, 4];

/** true si el navegador puede dibujar WebGL. */
export function soportaWebGL(): boolean {
  try {
    const lienzo = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (lienzo.getContext('webgl2') || lienzo.getContext('webgl')));
  } catch {
    return false;
  }
}
