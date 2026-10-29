import { Navigate, useLocation } from 'react-router-dom';

interface RedirigirProps {
  to: string;
  /** Parámetros que se agregan a la consulta, ej. {vista: 'anio'}. */
  extra?: Record<string, string>;
}

/**
 * Redirige a `to` conservando la consulta de la URL (/?sorteo=7 -> /sortear?sorteo=7).
 * Sirve para que las rutas viejas sigan funcionando, ej. /conteos-anio -> /inventario?vista=anio.
 */
export function Redirigir({ to, extra = {} }: RedirigirProps) {
  const { search } = useLocation();
  const consulta = new URLSearchParams(search);
  Object.entries(extra).forEach(([clave, valor]) => consulta.set(clave, valor));
  const texto = consulta.toString();
  return <Navigate to={texto ? `${to}?${texto}` : to} replace />;
}
