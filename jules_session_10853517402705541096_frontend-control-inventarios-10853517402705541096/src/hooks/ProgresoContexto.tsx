import React, { createContext, useContext } from 'react';
import { useApi, type EstadoCarga } from './useApi';
import { api } from '../services/api';
import type { ResumenConteo } from '../types/inventario';

/**
 * Progreso del conteo compartido por toda la página: la barra superior muestra la semana
 * y el último sorteo, y las pantallas que sortean, cuentan o reinician llaman a
 * `recargar()` para que la barra se actualice en el momento.
 */
const ProgresoContexto = createContext<EstadoCarga<ResumenConteo> | null>(null);

export const ProveedorProgreso: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const progreso = useApi(api.obtenerProgresoConteo);
  return <ProgresoContexto.Provider value={progreso}>{children}</ProgresoContexto.Provider>;
};

/** Progreso del conteo (`/api/conteo/progreso`) y la función para volver a pedirlo. */
// eslint-disable-next-line react-refresh/only-export-components
export function useProgreso(): EstadoCarga<ResumenConteo> {
  const progreso = useContext(ProgresoContexto);
  if (!progreso) throw new Error('useProgreso debe usarse dentro de <ProveedorProgreso>');
  return progreso;
}
