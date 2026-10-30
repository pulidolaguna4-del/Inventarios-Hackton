/** Número con separadores de Colombia (1.234,5). Vacío si no hay valor. */
export function formatearNumero(valor: number | null | undefined, decimales = 2): string {
  if (valor === null || valor === undefined) return '';
  return valor.toLocaleString('es-CO', { maximumFractionDigits: decimales });
}

/** "2026-10-29T09:44:29" -> "2026-10-29 09:44". */
export function formatearFechaHora(fechaHora: string): string {
  return fechaHora.replace('T', ' ').slice(0, 16);
}
