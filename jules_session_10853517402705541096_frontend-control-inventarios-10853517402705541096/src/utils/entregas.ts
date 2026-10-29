import type { TipoExportacion } from '../types/inventario';

/**
 * Archivos de entrega según el reglamento. El nombre debe ser exactamente este: si no sigue
 * la estructura Día<N>_Ejercicio<N>, el jurado no lo califica. Se descarga como <nombre>.csv.
 */
export const ARCHIVOS_ENTREGA: { tipo: TipoExportacion; nombre: string; titulo: string; descripcion: string }[] = [
  { tipo: 'maestro', nombre: 'Día2_Ejercicio1', titulo: 'Maestro de ubicaciones · Tarea 1', descripcion: 'SKU, popularidad, clase ABC y ubicación asignada.' },
  { tipo: 'picking', nombre: 'Día2_Ejercicio6', titulo: 'Picking de la Tarea 6', descripcion: 'Trayectos del pedido de prueba con distancias y tiempos.' },
  { tipo: 'conteo', nombre: 'Día2_Ejercicio8', titulo: 'Sorteos de conteo · Tarea 8', descripcion: 'Referencias elegidas al azar en cada sorteo, con su ubicación.' },
];
