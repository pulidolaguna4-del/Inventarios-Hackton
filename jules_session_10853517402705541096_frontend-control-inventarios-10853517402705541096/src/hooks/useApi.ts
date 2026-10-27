import { useCallback, useEffect, useRef, useState } from 'react';

interface EstadoCarga<T> {
  datos: T | null;
  cargando: boolean;
  error: string | null;
  /** Vuelve a pedir los datos (por ejemplo, después de guardar algo). */
  recargar: () => Promise<void>;
}

/**
 * Carga datos del backend al montar el componente y cada vez que cambian `dependencias`.
 * Ignora respuestas viejas si llega una petición más nueva antes.
 */
export function useApi<T>(cargar: () => Promise<T>, dependencias: unknown[] = []): EstadoCarga<T> {
  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const numeroPeticion = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const funcionCarga = useCallback(cargar, dependencias);

  const recargar = useCallback(async () => {
    const peticion = ++numeroPeticion.current;
    setCargando(true);
    setError(null);
    try {
      const resultado = await funcionCarga();
      if (peticion === numeroPeticion.current) setDatos(resultado);
    } catch (e) {
      if (peticion === numeroPeticion.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (peticion === numeroPeticion.current) setCargando(false);
    }
  }, [funcionCarga]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { datos, cargando, error, recargar };
}
