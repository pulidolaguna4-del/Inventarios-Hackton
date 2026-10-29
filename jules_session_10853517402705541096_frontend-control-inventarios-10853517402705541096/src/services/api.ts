// Cliente de la API del backend (Express, ../backend/servidor.js).
// Las rutas son relativas: en producción las sirve el mismo servidor de Express y
// en desarrollo Vite las redirige a http://localhost:8000 (ver vite.config.ts).

import type {
  Maestro,
  NuevoRegistroConteo,
  RegistroConteo,
  ResultadoSorteo,
  RespuestaPedidos,
  ResultadoPicking,
  Resumen,
  ResumenConteo,
  SorteoConteo,
  TipoExportacion,
  EstadoPedido,
  Pedido,
  LayoutBodega,
  PickingConTrazado,
  InstruccionesRobot,
  VistaMapa,
  ConsultaRecorridos,
  FormatoExportacion,
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
    throw new ErrorApi('No hay conexión con el servidor. ¿Está corriendo el backend (npm start en la carpeta backend)?', 0);
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
  obtenerSorteo: (numero: number) => pedirJson<SorteoConteo>(`/api/conteo/sorteo/${numero}`),
  /** Sortea `cantidad` referencias al azar. Responde 409 si el sorteo anterior tiene pendientes y no se fuerza. */
  sortear: (cantidad: number, forzar = false) => enviarJson<ResultadoSorteo>('/api/conteo/sorteo', { cantidad, forzar }),
  /** Empieza un año nuevo: respalda los sorteos y registros y los deja vacíos. */
  reiniciarConteo: () => enviarJson<{ mensaje: string; respaldos: string[] }>('/api/conteo/reiniciar', {}),
  obtenerRegistrosConteo: (filtros: { sku?: number; sorteo?: number; semana?: number } = {}) =>
    pedirJson<{ registros: RegistroConteo[] }>(conParametros('/api/conteo/registros', filtros)),
  registrarConteo: (registro: NuevoRegistroConteo) =>
    enviarJson<{ mensaje: string; registro: RegistroConteo }>('/api/conteo/registro', registro),

  obtenerPedidos: (fecha?: string) => pedirJson<RespuestaPedidos>(conParametros('/api/pedidos', { fecha })),
  avanzarPedido: (idPedido: number, estado: EstadoPedido) =>
    enviarJson<Pick<Pedido, 'id_pedido' | 'estado' | 'siguiente_estado' | 'historial'>>(
      `/api/pedidos/${idPedido}/estado`,
      { estado },
    ),

  obtenerPickingPrueba: () => pedirJson<ResultadoPicking>('/api/picking/prueba'),

  /** Todo lo que el mapa 3D necesita para dibujar la bodega de Arauca o la maqueta. */
  obtenerLayout: (vista: VistaMapa) => pedirJson<LayoutBodega>(conParametros('/api/bodega/layout', { vista })),
  /**
   * Recorridos con su trazado punto por punto. En Arauca según el origen (Tarea 6, ruta de
   * conteo del sorteo o pedidos del día); la maqueta solo tiene su propio recorrido.
   */
  obtenerRecorridos: ({ vista, origen, sorteo, fecha }: ConsultaRecorridos) =>
    pedirJson<PickingConTrazado>(
      vista === 'arauca'
        ? conParametros('/api/picking', { origen, sorteo, fecha, con_trazado: 'true' })
        : '/api/picking/maqueta',
    ),
  /** Instrucciones del robot para un recorrido, a escala 1:N (sin escala, la del backend). */
  obtenerInstruccionesRobot: ({ vista, origen, sorteo, fecha }: ConsultaRecorridos, recorrido: number, escala?: number) =>
    pedirJson<InstruccionesRobot>(
      conParametros('/api/picking/instrucciones', vista === 'arauca' ? { vista, origen, sorteo, fecha, recorrido, escala } : { vista, recorrido, escala }),
    ),

  /**
   * Pide el reporte al backend (que también lo guarda en salidas/) y lo descarga en el navegador.
   * Por defecto es el .xlsx con formato; con formato 'csv', el CSV plano. Devuelve el nombre del archivo.
   */
  descargarReporte: async (
    tipo: TipoExportacion,
    nombre: string,
    extra: Record<string, string | number | undefined> = {},
    formato: FormatoExportacion = 'xlsx',
  ): Promise<string> => {
    const respuesta = await fetch(conParametros(`/api/exportar/${tipo}`, { nombre, ...extra, formato }));
    if (!respuesta.ok) {
      const datos = await respuesta.json().catch(() => ({}));
      throw new ErrorApi(datos.error || `Error ${respuesta.status}`, respuesta.status);
    }
    const archivo = await respuesta.blob();
    const nombreArchivo = `${nombre.replace(/\.(csv|xlsx)$/i, '')}.${formato}`;
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(archivo);
    enlace.download = nombreArchivo;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
    return nombreArchivo;
  },
};
