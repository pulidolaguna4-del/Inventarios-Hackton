/**
 * Centra `elemento` dentro de `contenedor` asignando solo el scrollTop del contenedor:
 * no mueve la ventana ni otros contenedores (scrollIntoView sí lo haría). El desplazamiento
 * suave lo da el CSS del contenedor (`scroll-behavior: smooth`, que se apaga con
 * prefers-reduced-motion).
 */
export function centrarEnContenedor(contenedor: HTMLElement, elemento: HTMLElement) {
  const caja = contenedor.getBoundingClientRect();
  const fila = elemento.getBoundingClientRect();
  const destino = contenedor.scrollTop + (fila.top - caja.top) - (contenedor.clientHeight - fila.height) / 2;
  contenedor.scrollTop = Math.max(0, destino);
}
