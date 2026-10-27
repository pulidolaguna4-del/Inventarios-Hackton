// Cliente de la API del backend (servidor.py).
// Las rutas son relativas: en producción las sirve el mismo servidor de Python y
// en desarrollo Vite las redirige a http://localhost:8000 (ver vite.config.ts).

import type {
  Maestro,
  NuevoRegistroConteo,
  PlanGenerado,
  RegistroConteo,
  RespuestaPedidos,
  ResultadoPicking,
  Resumen,
  ResumenConteo,
  SemanaConteo,
  TipoExportacion,
  EstadoPedido,
  Pedido,
} from '../types/inventario';

/** Error que devuelve el backend como {"error": "mensaje"} junto con su código HTTP. */
export class ErrorApi extends Error {
  codigo: number;

  constructor(mensaje: string, codigo: number) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.codigo = codigo;
  }
}

export async function pedirJson<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(ruta, opciones);
  } catch {
    throw new ErrorApi('No hay conexión con el servidor. ¿Está corriendo "python servidor.py"?', 0);
  }
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw new ErrorApi(datos.error || `Error ${respuesta.status}`, respuesta.status);
  }
  return datos as T;
}

export function enviarJson<T>(ruta: string, cuerpo: unknown): Promise<T> {
  return pedirJson<T>(ruta, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
}

function conParametros(ruta: string, parametros: Record<string, string | number | undefined>): string {
  const consulta = new URLSearchParams();
  Object.entries(parametros).forEach(([clave, valor]) => {
    if (valor !== undefined && valor !== '') consulta.set(clave, String(valor));
  });
  const texto = consulta.toString();
  return texto ? `${ruta}?${texto}` : ruta;
}

export const api = {
  obtenerResumen: () => pedirJson<Resumen>('/api/resumen'),

  obtenerMaestro: () => pedirJson<Maestro>('/api/maestro'),
  recalcularMaestro: () => enviarJson<Maestro>('/api/maestro/generar', {}),

  obtenerProgresoConteo: () => pedirJson<ResumenConteo>('/api/conteo/progreso'),
  obtenerSemanaConteo: (semana: number) => pedirJson<SemanaConteo>(`/api/conteo/semana/${semana}`),
  obtenerRegistrosConteo: (filtros: { sku?: number; semana?: number } = {}) =>
    pedirJson<{ registros: RegistroConteo[] }>(conParametros('/api/conteo/registros', filtros)),
  registrarConteo: (registro: NuevoRegistroConteo) =>
    enviarJson<{ mensaje: string; registro: RegistroConteo }>('/api/conteo/registro', registro),
  generarPlanConteo: (semilla: number, forzar = false) =>
    enviarJson<PlanGenerado>('/api/conteo/plan/generar', { semilla, forzar }),

  obtenerPedidos: (fecha?: string) => pedirJson<RespuestaPedidos>(conParametros('/api/pedidos', { fecha })),
  avanzarPedido: (idPedido: number, estado: EstadoPedido) =>
    enviarJson<Pick<Pedido, 'id_pedido' | 'estado' | 'siguiente_estado' | 'historial'>>(
      `/api/pedidos/${idPedido}/estado`,
      { estado },
    ),

  obtenerPickingPrueba: () => pedirJson<ResultadoPicking>('/api/picking/prueba'),

  /**
   * Pide el CSV al backend (que también lo guarda en salidas/) y lo descarga en el navegador.
   * Devuelve el nombre final del archivo.
   */
  descargarCsv: async (
    tipo: TipoExportacion,
    nombre: string,
    extra: Record<string, string | number | undefined> = {},
  ): Promise<string> => {
    const respuesta = await fetch(conParametros(`/api/exportar/${tipo}`, { nombre, ...extra }));
    if (!respuesta.ok) {
      const datos = await respuesta.json().catch(() => ({}));
      throw new ErrorApi(datos.error || `Error ${respuesta.status}`, respuesta.status);
    }
    const archivo = await respuesta.blob();
    const nombreArchivo = nombre.replace(/\.csv$/i, '') + '.csv';
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(archivo);
    enlace.download = nombreArchivo;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
    return nombreArchivo;
  },
};
