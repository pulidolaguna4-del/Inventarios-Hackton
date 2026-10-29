// Constantes y utilidades del mapa 3D, aparte de los componentes para que la recarga
// en caliente de Vite funcione (un archivo de componentes solo debe exportar componentes).

export const COLORES_ABC: Record<string, string> = { A: '#ff6b2c', B: '#4a6fa5', C: '#a8a29e' };
export const COLORES_CATEGORIA: Record<string, string> = {
  'Aire acondicionado': '#4a6fa5',
  'Equipos de audio': '#ff6b2c',
  'Equipos de cómputo': '#2f9e6e',
  Refrigeración: '#8e6bbf',
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
