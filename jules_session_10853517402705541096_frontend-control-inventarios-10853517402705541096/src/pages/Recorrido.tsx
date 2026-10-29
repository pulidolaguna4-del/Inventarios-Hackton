import React, { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Route, Info, AlertTriangle, Map as IconoMapa, Box, Navigation, ExternalLink, Cpu } from 'lucide-react';
import { Cargando, ErrorCarga } from '../components/ui/Estados';
import { EncabezadoPagina } from '../components/ui/EncabezadoPagina';
import { BotonSiguiente } from '../components/ui/BotonSiguiente';
import { formatearNumero } from '../utils/formato';
import { useApi } from '../hooks/useApi';
import { useProgreso } from '../hooks/ProgresoContexto';
import { api } from '../services/api';
import type { ConsultaRecorridos, OrigenPicking, PickingConTrazado, VistaMapa } from '../types/inventario';
import { Escena3D, type ModoCamara, type ModoColor, type Reproduccion } from '../components/mapa/Escena3D';
import { COLORES_ABC, COLORES_CATEGORIA, soportaWebGL } from '../components/mapa/constantes';
import { LineaTiempo } from '../components/mapa/LineaTiempo';
import { PanelRecorrido } from '../components/mapa/PanelRecorrido';
import { PanelConteo, type FilaConteo } from '../components/mapa/PanelConteo';
import { construirLinea, estadoEnTiempo, ubicacionesPorEstado } from '../utils/animacion';

const VISTAS: { valor: VistaMapa; etiqueta: string }[] = [
  { valor: 'arauca', etiqueta: 'Bodega Arauca' },
  { valor: 'maqueta', etiqueta: 'Maqueta' },
];

const ORIGENES: OrigenPicking[] = ['sorteo', 'prueba', 'lote'];

const CAMARAS: { valor: ModoCamara; etiqueta: string; icono: typeof Box }[] = [
  { valor: 'planta', etiqueta: 'Planta', icono: IconoMapa },
  { valor: 'isometrica', etiqueta: 'Isométrica', icono: Box },
  { valor: 'carrito', etiqueta: 'Carrito', icono: Navigation },
];

/** Cómo se muestra el método que eligió el backend según el tamaño del lote. */
const NOMBRE_METODO: Record<string, string> = { exacto: 'exacto', heuristico: 'heurística', anillo: 'anillo de la maqueta' };

const claseSegmento = (activo: boolean) =>
  `h-10 px-3.5 text-xs font-bold uppercase tracking-wide border border-tinta -ml-px first:ml-0 cursor-pointer transition-colors ${
    activo ? 'bg-tinta text-papel' : 'bg-slate-50 text-tinta hover:bg-white'
  }`;

async function cargarVista(consulta: ConsultaRecorridos) {
  const [layout, picking] = await Promise.all([api.obtenerLayout(consulta.vista), api.obtenerRecorridos(consulta)]);
  return { layout, picking };
}

/** Referencias de la ruta de conteo en el orden en que el carrito las visita. */
function filasEnOrdenDeRecorrido(picking: PickingConTrazado): FilaConteo[] {
  return picking.recorridos.flatMap((recorrido) =>
    recorrido.paradas.flatMap((parada, indice) =>
      (parada.items ?? [])
        .filter((item): item is FilaConteo['item'] => item.sku !== null)
        .map((item) => ({ recorrido: recorrido.recorrido, orden: indice + 1, item })),
    ),
  );
}

/** Tabla de trayectos: se ve siempre debajo del mapa y es el respaldo si no hay WebGL. */
const TablaTrayectos: React.FC<{ picking: PickingConTrazado }> = ({ picking }) => (
  <div className="bg-slate-50 border border-slate-200 overflow-x-auto">
    <table className="w-full text-left border-collapse text-sm min-w-[760px]">
      <thead>
        <tr className="border-b-2 border-tinta font-mono text-[11px] tracking-[0.1em] text-slate-600">
          <th className="py-3 px-4 font-medium">TRAYECTO</th>
          <th className="py-3 px-4 font-medium">SALIDA</th>
          <th className="py-3 px-4 font-medium">POSICIONES (ORDEN DE VISITA)</th>
          <th className="py-3 px-4 font-medium text-right">DISTANCIA (M)</th>
          <th className="py-3 px-4 font-medium text-right">CAMINAR (S)</th>
          <th className="py-3 px-4 font-medium text-right">RECOGER (S)</th>
          <th className="py-3 px-4 font-medium text-right">TOTAL (S)</th>
        </tr>
      </thead>
      <tbody>
        {picking.recorridos.map((recorrido) => (
          <tr key={recorrido.recorrido} className={`border-b border-slate-200 ${recorrido.es_el_mas_demorado ? 'bg-amber-50' : ''}`}>
            <td className="py-3 px-4 font-bold">
              {recorrido.recorrido}
              {recorrido.es_el_mas_demorado && <span className="ml-2 font-mono text-[10px] bg-senal text-tinta px-1.5 py-0.5">MÁS DEMORADO</span>}
            </td>
            <td className="py-3 px-4 font-mono text-xs">{recorrido.salida_inicio}</td>
            <td className="py-3 px-4">
              <div className="flex flex-wrap items-center gap-1.5">
                {recorrido.paradas.map((parada, indice) => (
                  <React.Fragment key={indice}>
                    {indice > 0 && <span className="text-slate-400">→</span>}
                    <span className="px-2 py-0.5 border border-slate-300 bg-white font-mono text-xs font-semibold">
                      {parada.etiqueta ?? parada.numero_plano}{' '}
                      <span className="font-normal text-slate-500">N{parada.niveles.join('+')}</span>
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </td>
            <td className="py-3 px-4 text-right tabular-nums">{formatearNumero(recorrido.distancia_m)}</td>
            <td className="py-3 px-4 text-right tabular-nums">{formatearNumero(recorrido.tiempo_desplazamiento_s, 1)}</td>
            <td className="py-3 px-4 text-right tabular-nums">{formatearNumero(recorrido.tiempo_recogida_s, 1)}</td>
            <td className="py-3 px-4 text-right tabular-nums font-bold">{formatearNumero(recorrido.tiempo_total_s, 1)}</td>
          </tr>
        ))}
        <tr className="font-bold">
          <td className="py-3 px-4" colSpan={3}>
            Total · {picking.totales.recorridos} trayectos · {picking.totales.ubicaciones} ubicaciones
          </td>
          <td className="py-3 px-4 text-right tabular-nums">{formatearNumero(picking.totales.distancia_m)}</td>
          <td className="py-3 px-4 text-right tabular-nums">{formatearNumero(picking.totales.tiempo_desplazamiento_s, 1)}</td>
          <td className="py-3 px-4 text-right tabular-nums">{formatearNumero(picking.totales.tiempo_recogida_s, 1)}</td>
          <td className="py-3 px-4 text-right tabular-nums">{formatearNumero(picking.totales.tiempo_total_s, 1)}</td>
        </tr>
      </tbody>
    </table>
  </div>
);

/**
 * Paso 2 del flujo: la bodega en 3D con el carrito recorriendo la ruta. El origen puede ser
 * el sorteo (ruta de conteo: aquí mismo se cuenta, en el orden del recorrido), el pedido de
 * prueba de la Tarea 6 o los pedidos de un día. También da las instrucciones del robot.
 */
export const Recorrido: React.FC = () => {
  const [parametros, setParametros] = useSearchParams();
  const progreso = useProgreso();
  const ultimoSorteo = progreso.datos?.sorteo_actual ?? null;

  // Origen y contexto salen de la URL; sin origen, el último sorteo (o la Tarea 6 si no hay sorteos).
  const origenUrl = parametros.get('origen') as OrigenPicking | null;
  const origen: OrigenPicking = origenUrl && ORIGENES.includes(origenUrl) ? origenUrl : ultimoSorteo ? 'sorteo' : 'prueba';
  const sorteo = origen === 'sorteo' ? Number(parametros.get('sorteo')) || ultimoSorteo || undefined : undefined;
  const fecha = origen === 'lote' ? parametros.get('fecha') || undefined : undefined;

  const [vista, setVista] = useState<VistaMapa>('arauca');
  const [modoColor, setModoColor] = useState<ModoColor>('abc');
  const [modoCamara, setModoCamara] = useState<ModoCamara>('isometrica');
  const [seleccion, setSeleccion] = useState<number | 'todos'>(1);

  // La maqueta solo tiene las 11 referencias nuevas: allí solo existe su propio recorrido.
  const maquetaSinOrigen = vista === 'maqueta' && origen !== 'prueba';
  const consulta: ConsultaRecorridos = { vista, origen, sorteo, fecha };
  const esperandoProgreso = progreso.cargando && !progreso.datos;
  const { datos, cargando, error, recargar } = useApi(
    () => (esperandoProgreso || maquetaSinOrigen ? Promise.resolve(null) : cargarVista(consulta)),
    [vista, origen, sorteo, fecha, esperandoProgreso],
  );
  const listaSorteo = useApi(
    () => (origen === 'sorteo' && sorteo ? api.obtenerSorteo(sorteo) : Promise.resolve(null)),
    [origen, sorteo],
  );
  const resumen = useApi(() => (origen === 'lote' ? api.obtenerResumen() : Promise.resolve(null)), [origen]);

  // El tiempo vive en una referencia que la escena avanza en cada cuadro; el estado de React
  // solo se refresca ~10 veces por segundo para los controles y el panel.
  const reproduccion = useRef<Reproduccion>({ t: 0, reproduciendo: false, velocidad: 1 });
  const [tiempo, setTiempo] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [velocidad, setVelocidad] = useState(1);
  const [webgl] = useState(soportaWebGL);

  const linea = useMemo(() => (datos ? construirLinea(datos.picking.recorridos, seleccion) : null), [datos, seleccion]);
  const estado = linea ? estadoEnTiempo(linea, tiempo) : null;
  const { visitadas, pendientes } = useMemo(
    () => (linea ? ubicacionesPorEstado(linea, tiempo) : { visitadas: new Set<string>(), pendientes: new Set<string>() }),
    [linea, tiempo],
  );
  const filasConteo = datos && origen === 'sorteo' ? filasEnOrdenDeRecorrido(datos.picking) : [];

  const irA = (t: number) => {
    reproduccion.current.t = t;
    setTiempo(t);
  };
  const pausar = () => {
    reproduccion.current.reproduciendo = false;
    setReproduciendo(false);
  };
  const reiniciarLinea = () => {
    pausar();
    irA(0);
  };
  const alternarReproduccion = () => {
    if (!linea) return;
    if (reproduccion.current.reproduciendo) return pausar();
    if (reproduccion.current.t >= linea.duracion) irA(0);
    reproduccion.current.reproduciendo = true;
    setReproduciendo(true);
  };
  const cambiarVista = (nueva: VistaMapa) => {
    setVista(nueva);
    setSeleccion(1);
    reiniciarLinea();
  };
  /** Cambia el origen (o su sorteo o fecha) en la URL y empieza la animación de cero. */
  const cambiarOrigen = (nuevo: OrigenPicking, extra: { sorteo?: number; fecha?: string } = {}) => {
    const consultaNueva: Record<string, string> = { origen: nuevo };
    if (nuevo === 'sorteo') consultaNueva.sorteo = String(extra.sorteo ?? sorteo ?? ultimoSorteo ?? '');
    if (nuevo === 'lote' && (extra.fecha ?? fecha)) consultaNueva.fecha = (extra.fecha ?? fecha) as string;
    setParametros(consultaNueva);
    setSeleccion(1);
    reiniciarLinea();
  };
  const elegirRecorrido = (nueva: number | 'todos') => {
    setSeleccion(nueva);
    reiniciarLinea();
  };
  const cambiarVelocidad = (nueva: number) => {
    reproduccion.current.velocidad = nueva;
    setVelocidad(nueva);
  };

  if (esperandoProgreso) return <Cargando texto="Cargando..." />;

  const paleta = modoColor === 'abc' ? COLORES_ABC : COLORES_CATEGORIA;
  const recorridoInstrucciones = seleccion === 'todos' ? estado?.recorrido ?? 1 : seleccion;
  const eventoActual = linea && estado ? linea.eventos[estado.indice] : null;
  const paradaActual = eventoActual?.tipo === 'parada' ? `${eventoActual.recorrido}-${eventoActual.orden}` : null;

  const sorteoCompleto = listaSorteo.datos !== null && listaSorteo.datos.pendientes === 0;
  const contadasSorteo = listaSorteo.datos ? listaSorteo.datos.tamano - listaSorteo.datos.pendientes : 0;
  const alGuardarConteo = async () => {
    await Promise.all([listaSorteo.recargar(), progreso.recargar()]);
  };
  const panelConteo =
    origen === 'sorteo' && listaSorteo.datos && filasConteo.length > 0 ? (
      <PanelConteo sorteo={listaSorteo.datos} filas={filasConteo} paradaActual={paradaActual} alGuardar={alGuardarConteo} />
    ) : undefined;

  const etiquetaOrigen = (valor: OrigenPicking) =>
    valor === 'sorteo' ? `Sorteo ${sorteo ?? ultimoSorteo ?? ''}`.trim() : valor === 'prueba' ? 'Pedido de prueba (Tarea 6)' : 'Pedidos del día';

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo="Recorrido y conteo"
        seccion="PASO 2 · RUTA DEL CARRITO"
        descripcion="El carrito va a las ubicaciones del sorteo y aquí mismo se cuenta, en el orden del recorrido. Usa el mismo algoritmo de la Tarea 6: máximo 3 ubicaciones por recorrido, exacto hasta 12 paradas y heurística si son más. En cada parada se detiene el tiempo de nivel 1 = T, nivel 2 = 3T y ambos niveles = 4T."
        icono={Route}
        acciones={
          <div className="flex" role="group" aria-label="Vista del mapa">
            {VISTAS.map((opcion) => (
              <button key={opcion.valor} type="button" onClick={() => cambiarVista(opcion.valor)} aria-pressed={vista === opcion.valor} className={claseSegmento(vista === opcion.valor)}>
                {opcion.etiqueta}
              </button>
            ))}
          </div>
        }
      />

      {/* Origen de las ubicaciones a visitar */}
      <div className="flex flex-wrap items-end gap-3 p-4 bg-slate-50 border border-slate-200">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] tracking-[0.1em] text-slate-500">QUÉ RECORRE EL CARRITO</span>
          <div className="flex flex-wrap" role="group" aria-label="Origen del recorrido">
            {ORIGENES.filter((valor) => valor !== 'sorteo' || ultimoSorteo).map((valor) => (
              <button key={valor} type="button" onClick={() => cambiarOrigen(valor)} aria-pressed={origen === valor} className={claseSegmento(origen === valor)}>
                {etiquetaOrigen(valor)}
              </button>
            ))}
          </div>
        </div>
        {origen === 'sorteo' && progreso.datos && progreso.datos.sorteos.length > 1 && (
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="font-mono text-[11px] tracking-[0.1em] text-slate-500">SORTEO</span>
            <select
              value={sorteo ?? ''}
              onChange={(e) => cambiarOrigen('sorteo', { sorteo: Number(e.target.value) })}
              className="h-10 px-2 border border-tinta bg-white font-mono text-sm"
            >
              {[...progreso.datos.sorteos].reverse().map((s) => (
                <option key={s.numero} value={s.numero}>
                  {s.numero} · {s.registrados}/{s.tamano} contadas
                </option>
              ))}
            </select>
          </label>
        )}
        {origen === 'lote' && (
          <div className="flex items-end gap-3">
            <label className="flex flex-col gap-1.5 text-xs">
              <span className="font-mono text-[11px] tracking-[0.1em] text-slate-500">FECHA</span>
              <select
                value={fecha ?? datos?.picking.fecha ?? ''}
                onChange={(e) => cambiarOrigen('lote', { fecha: e.target.value })}
                className="h-10 px-2 border border-tinta bg-white font-mono text-sm"
              >
                {(resumen.datos?.fechas_disponibles ?? (datos?.picking.fecha ? [datos.picking.fecha] : [])).map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {opcion}
                  </option>
                ))}
              </select>
            </label>
            <Link
              to={`/pedidos?fecha=${fecha ?? datos?.picking.fecha ?? ''}`}
              className="flex items-center gap-1 h-10 text-xs font-bold text-indigo-600 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ver los pedidos de ese día
            </Link>
          </div>
        )}
        {datos && !maquetaSinOrigen && (
          <span className="ml-auto flex items-center gap-1.5 h-10 px-3 bg-tinta text-papel font-mono text-xs" title="El sistema elige el método según el número de paradas">
            <Cpu className="w-3.5 h-3.5 text-senal" />
            método: {NOMBRE_METODO[datos.picking.metodo] ?? datos.picking.metodo} · {datos.picking.totales.ubicaciones} paradas ·{' '}
            {datos.picking.totales.recorridos} recorridos
          </span>
        )}
      </div>

      {origen === 'lote' && datos?.picking.pedidos !== undefined && (
        <p className="text-xs text-slate-600 -mt-3">
          {datos.picking.pedidos} pedidos de Arauca del {datos.picking.fecha}, consolidados por referencia.
          {datos.picking.sin_ubicacion && datos.picking.sin_ubicacion.length > 0 && (
            <span className="text-amber-700"> Sin ubicación en el maestro: {datos.picking.sin_ubicacion.join(', ')}.</span>
          )}
        </p>
      )}

      {maquetaSinOrigen ? (
        <div className="flex items-start gap-2 p-5 border border-amber-400 bg-amber-50 text-amber-900 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>
            La maqueta del robot solo tiene las 11 referencias nuevas, así que no puede recorrer {origen === 'sorteo' ? 'el sorteo' : 'los pedidos del día'}.
            Cambia a <strong>Bodega Arauca</strong> para ver esta ruta, o elige <strong>Pedido de prueba (Tarea 6)</strong> para ver el recorrido de la
            maqueta.
          </span>
        </div>
      ) : cargando && !datos ? (
        <Cargando texto="Cargando el mapa..." />
      ) : error ? (
        <ErrorCarga mensaje={error} onReintentar={recargar} />
      ) : datos && linea ? (
        <>
          {!webgl ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-4 border border-amber-400 bg-amber-50 text-amber-900 text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>
                  Este navegador no puede dibujar gráficos 3D (WebGL desactivado o no disponible), así que el mapa no se muestra. Los recorridos
                  están en la tabla de abajo{panelConteo ? ' y el conteo funciona igual' : ''}. Prueba con Chrome o Edge actualizados.
                </span>
              </div>
              {panelConteo && <div className="max-w-xl border border-slate-200 bg-slate-50">{panelConteo}</div>}
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-4">
              <div className="flex flex-col min-w-0">
                <div className="relative h-[560px] border border-slate-200 bg-papel">
                  <Escena3D
                    layout={datos.layout}
                    linea={linea}
                    reproduccion={reproduccion}
                    alAvanzar={setTiempo}
                    alTerminar={() => setReproduciendo(false)}
                    modoColor={modoColor}
                    modoCamara={modoCamara}
                    visitadas={visitadas}
                    pendientes={pendientes}
                  />
                  {/* Vistas de cámara */}
                  <div className="absolute top-3 left-3 flex" role="group" aria-label="Vista de cámara">
                    {CAMARAS.map(({ valor, etiqueta, icono: Icono }) => (
                      <button key={valor} type="button" onClick={() => setModoCamara(valor)} aria-pressed={modoCamara === valor} className={`${claseSegmento(modoCamara === valor)} flex items-center gap-1.5`}>
                        <Icono className="w-3.5 h-3.5" />
                        {etiqueta}
                      </button>
                    ))}
                  </div>
                  {/* Leyenda y color */}
                  <div className="absolute bottom-3 left-3 bg-slate-50/95 border border-slate-200 p-2.5 flex flex-col gap-2 text-xs">
                    <div className="flex" role="group" aria-label="Colorear por">
                      <button type="button" onClick={() => setModoColor('abc')} aria-pressed={modoColor === 'abc'} className={`${claseSegmento(modoColor === 'abc')} !h-8`}>
                        Clase ABC
                      </button>
                      <button type="button" onClick={() => setModoColor('categoria')} aria-pressed={modoColor === 'categoria'} className={`${claseSegmento(modoColor === 'categoria')} !h-8`}>
                        Categoría
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 max-w-[340px]">
                      {Object.entries(paleta).map(([nombre, color]) => (
                        <span key={nombre} className="flex items-center gap-1.5">
                          <span className="w-3 h-3 border border-tinta" style={{ background: color }} />
                          {modoColor === 'abc' ? `Clase ${nombre}` : nombre}
                        </span>
                      ))}
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 border border-tinta bg-[#facc15]" />
                        Por visitar
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 border border-tinta bg-tinta" />
                        Ya visitada
                      </span>
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 font-mono text-[11px] bg-tinta text-papel px-2 py-1">{datos.layout.nombre.toUpperCase()}</div>
                </div>
                <LineaTiempo
                  duracion={linea.duracion}
                  tiempo={tiempo}
                  reproduciendo={reproduciendo}
                  velocidad={velocidad}
                  recorridos={datos.picking.recorridos.map((r) => r.recorrido)}
                  seleccion={seleccion}
                  alReproducir={alternarReproduccion}
                  alReiniciar={reiniciarLinea}
                  alCambiarVelocidad={cambiarVelocidad}
                  alBuscar={irA}
                  alElegirRecorrido={elegirRecorrido}
                />
              </div>
              <PanelRecorrido
                consulta={consulta}
                linea={linea}
                estado={estado}
                tiempo={tiempo}
                recorridoInstrucciones={recorridoInstrucciones}
                conteo={panelConteo}
                avanceConteo={listaSorteo.datos ? `${contadasSorteo}/${listaSorteo.datos.tamano}` : undefined}
              />
            </div>
          )}

          {origen === 'sorteo' && sorteo && sorteoCompleto && (
            <BotonSiguiente
              to={`/inventario?sorteo=${sorteo}`}
              paso={3}
              texto="Ver cómo quedó el inventario"
              detalle={`Sorteo ${sorteo} completo · ${listaSorteo.datos?.tamano} referencias contadas`}
            />
          )}

          <div className="space-y-3">
            <h3 className="font-bold text-base">Trayectos · {datos.layout.nombre}</h3>
            <TablaTrayectos picking={datos.picking} />
            <div className="flex items-start gap-2 p-4 bg-slate-50 border border-slate-200 text-xs leading-relaxed text-slate-600">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Supuestos (el caso no los da): velocidad {datos.picking.totales.velocidad_m_s ?? 1} m/s y recogida en nivel 1 de{' '}
                {datos.picking.totales.tiempo_recogida_nivel_1_s ?? 20} s (T). El nivel 2 tarda 3T y ambos niveles 4T. En la ruta de conteo se usa
                el mismo tiempo por parada, porque el caso no define un tiempo de conteo. El tiempo en cada parada no cambia cuál es la mejor
                ruta, solo suma al total.
              </span>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
