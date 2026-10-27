/** Número con separadores de Colombia (1.234,5). Vacío si no hay valor. */
export function formatearNumero(valor: number | null | undefined, decimales = 2): string {
  if (valor === null || valor === undefined) return '';
  return valor.toLocaleString('es-CO', { maximumFractionDigits: decimales });
}
