import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Route, Info, AlertTriangle } from 'lucide-react';
import { Cargando, ErrorCarga } from '../components/ui/Estados';
import { EncabezadoPagina } from '../components/ui/EncabezadoPagina';
import { BotonSiguiente } from '../components/ui/BotonSiguiente';
import { formatearNumero } from '../utils/formato';
import { useApi } from '../hooks/useApi';
import { useProgreso } from '../hooks/ProgresoContexto';
import { useConteoSorteo } from '../hooks/useConteoSorteo';
import { api } from '../services/api';
import type { ConsultaRecorridos, OrigenPicking, PickingConTrazado, VistaMapa } from '../types/inventario';
import { Escena3D, type Calidad, type ModoCamara, type ModoColor } from '../components/mapa/Escena3D';
import { soportaWebGL } from '../components/mapa/constantes';
import { LineaTiempo } from '../components/mapa/LineaTiempo';
import { ControlesMapa, LeyendaMapa, ResumenOrigen, SelectorVista, TarjetaParada } from '../components/mapa/HudMapa';
import { SelectorOrigen } from '../components/mapa/SelectorOrigen';
import { TablaRecorrido } from '../components/mapa/TablaRecorrido';
import { InstruccionesArduino } from '../components/mapa/InstruccionesArduino';
import {
  claveParada,
  construirLinea,
  mismaParadaActiva,
  paradaActivaEnTiempo,
  paradasDeLinea,
  ubicacionesPorEstado,
  type ParadaActiva,
  type ParadaLinea,
} from '../utils/animacion';
import { Reloj } from '../utils/reloj';
import { gruposDelRecorrido, type FilaRecorrido } from '../utils/tablaRecorrido';

const ORIGENES: OrigenPicking[] = ['sorteo', 'prueba', 'lote'];

/** Cómo se muestra el método que eligió el backend según el tamaño del lote. */
const NOMBRE_METODO: Record<string, string> = { exacto: 'exacto', heuristico: 'heurística', anillo: 'anillo de la maqueta' };

const SIN_RESALTAR = new Set<string>();

async function cargarVista(consulta: ConsultaRecorridos) {
  const [layout, picking] = await Promise.all([api.obtenerLayout(consulta.vista), api.obtenerRecorridos(consulta)]);
  return { layout, picking };
}

/** Resumen del HUD: "Sorteo 8 · 12 referencias · 4 recorridos · método exacto". */
function textoOrigen(picking: PickingConTrazado, vista: VistaMapa, origen: OrigenPicking, referencias: number, sorteo?: number, fecha?: string): string {
  const { recorridos, ubicaciones } = picking.totales;
  const metodo = `método ${NOMBRE_METODO[picking.metodo] ?? picking.metodo}`;
  const cola = `${recorridos} ${recorridos === 1 ? 'recorrido' : 'recorridos'} · ${metodo}`;
  if (vista === 'maqueta') return `Maqueta del robot · ${ubicaciones} paradas · ${cola}`;
  if (origen === 'sorteo') return `Sorteo ${sorteo ?? picking.sorteo ?? ''} · ${referencias} referencias · ${cola}`;
  if (origen === 'lote') return `Pedidos del ${fecha ?? picking.fecha ?? ''} · ${referencias} referencias · ${cola}`;
  return `Tarea 6 · ${ubicaciones} paradas · ${cola}`;
}

/** Tabla de trayectos: resumen por recorrido (distancia y tiempos). Solo se muestra como respaldo sin WebGL. */
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
 * Paso 2 del flujo: la bodega en 3D a todo el ancho, con los controles flotando encima (HUD),
 * y debajo el selector de origen y la tabla del recorrido sincronizada con la animación. En la
 * ruta de conteo de un sorteo, aquí mismo se cuenta, en el orden del recorrido.
 *
 * Sincronía: el reloj (utils/reloj.ts) es la única fuente de verdad del tiempo. La escena lo
 * avanza en cada cuadro y calcula la parada activa; la página solo se vuelve a dibujar cuando
 * esa parada cambia. La barra de tiempo es lo único que escucha el reloj.
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
  const [calidad, setCalidad] = useState<Calidad>('alta');
  // Por defecto se reproducen todos los recorridos seguidos; el selector aísla uno.
  const [seleccion, setSeleccion] = useState<number | 'todos'>('todos');

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

  const [reloj] = useState(() => new Reloj());
  const [reproduciendo, setReproduciendo] = useState(false);
  const [velocidad, setVelocidad] = useState(1);
  const [webgl] = useState(soportaWebGL);
  const [resaltada, setResaltada] = useState<string | null>(null);
  const contenedorMapa = useRef<HTMLDivElement>(null);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);

  const picking = datos && !maquetaSinOrigen ? datos.picking : null;
  const linea = useMemo(() => (picking ? construirLinea(picking.recorridos, seleccion) : null), [picking, seleccion]);
  const paradas = useMemo(() => (linea ? paradasDeLinea(linea) : []), [linea]);
  const indicePorParada = useMemo(() => new Map(paradas.map((parada, indice) => [claveParada(parada), indice])), [paradas]);
  const grupos = useMemo(() => (picking ? gruposDelRecorrido(picking) : []), [picking]);
  const filas = useMemo(() => grupos.flatMap((grupo) => grupo.filas), [grupos]);
  const filasPorParada = useMemo(() => {
    const mapa = new Map<string, FilaRecorrido[]>();
    for (const fila of filas) mapa.set(fila.clave_parada, [...(mapa.get(fila.clave_parada) ?? []), fila]);
    return mapa;
  }, [filas]);
  // Parada activa: la avisa la escena (o un salto de la barra o de la tabla) y se guarda junto con
  // la línea a la que pertenece. Si la línea cambió (otro origen o recorrido), se recalcula con el
  // último tiempo publicado del reloj, sin esperar al siguiente cuadro.
  const [activaGuardada, setActivaGuardada] = useState<{ paradas: ParadaLinea[]; activa: ParadaActiva } | null>(null);
  const activa =
    activaGuardada && activaGuardada.paradas === paradas ? activaGuardada.activa : paradaActivaEnTiempo(paradas, reloj.leerPublicado());
  const { visitadas, pendientes } = useMemo(() => ubicacionesPorEstado(paradas, activa), [paradas, activa]);
  const resaltadas = useMemo(() => (resaltada ? new Set([resaltada]) : SIN_RESALTAR), [resaltada]);

  // Conteo en línea: solo las filas con SKU del sorteo.
  const filasContables = origen === 'sorteo' ? filas.filter((fila): fila is FilaRecorrido & { sku: number } => fila.sku !== null) : [];
  const alGuardarConteo = async () => {
    await Promise.all([listaSorteo.recargar(), progreso.recargar()]);
  };
  const conteo = useConteoSorteo(listaSorteo.datos, filasContables, alGuardarConteo);

  /** Guarda la parada activa solo si de verdad cambió (la escena la avisa desde useFrame). */
  const guardarActiva = (nueva: ParadaActiva, paradasLinea = paradas) =>
    setActivaGuardada((previa) =>
      previa && previa.paradas === paradasLinea && mismaParadaActiva(previa.activa, nueva) ? previa : { paradas: paradasLinea, activa: nueva },
    );

  useEffect(() => {
    const alCambiar = () => setPantallaCompleta(document.fullscreenElement !== null && document.fullscreenElement === contenedorMapa.current);
    document.addEventListener('fullscreenchange', alCambiar);
    return () => document.removeEventListener('fullscreenchange', alCambiar);
  }, []);

  const irA = (t: number, paradasLinea = paradas) => {
    reloj.irA(t);
    guardarActiva(paradaActivaEnTiempo(paradasLinea, t), paradasLinea);
  };
  const pausar = () => {
    reloj.pausar();
    setReproduciendo(false);
  };
  const reiniciarLinea = () => {
    pausar();
    irA(0);
  };
  const alternarReproduccion = () => {
    if (!linea) return;
    if (reloj.reproduciendo) return pausar();
    if (reloj.t >= linea.duracion) irA(0);
    reloj.reproducir();
    setReproduciendo(true);
  };
  const cambiarVista = (nueva: VistaMapa) => {
    setVista(nueva);
    setSeleccion('todos');
    reiniciarLinea();
  };
  /** Cambia el origen (o su sorteo o fecha) en la URL y empieza la animación de cero. */
  const cambiarOrigen = (nuevo: OrigenPicking, extra: { sorteo?: number; fecha?: string } = {}) => {
    const consultaNueva: Record<string, string> = { origen: nuevo };
    if (nuevo === 'sorteo') consultaNueva.sorteo = String(extra.sorteo ?? sorteo ?? ultimoSorteo ?? '');
    if (nuevo === 'lote' && (extra.fecha ?? fecha)) consultaNueva.fecha = (extra.fecha ?? fecha) as string;
    setParametros(consultaNueva);
    setSeleccion('todos');
    reiniciarLinea();
  };
  const elegirRecorrido = (nueva: number | 'todos') => {
    setSeleccion(nueva);
    reiniciarLinea();
  };
  const cambiarVelocidad = (nueva: number) => {
    reloj.cambiarVelocidad(nueva);
    setVelocidad(nueva);
  };

  /** Clic en una fila: la animación salta a la llegada del carrito a esa parada, se pausa y el foco va a "contada". */
  const elegirFila = (fila: FilaRecorrido) => {
    if (!picking) return;
    pausar();
    let paradasLinea = paradas;
    // Si la línea tiene aislado otro recorrido, se aísla el de la fila.
    if (!indicePorParada.has(fila.clave_parada)) {
      paradasLinea = paradasDeLinea(construirLinea(picking.recorridos, fila.recorrido));
      setSeleccion(fila.recorrido);
    }
    const parada = paradasLinea.find((p) => claveParada(p) === fila.clave_parada);
    if (parada) irA(parada.t_inicio, paradasLinea);
    if (fila.sku !== null && origen === 'sorteo') conteo.acciones.enfocar(fila.sku);
  };
  /** Clic en una celda del 3D: se selecciona su fila. */
  const elegirCelda = (codigo: string) => {
    const fila = filas.find((f) => f.codigo_ubicacion === codigo);
    if (fila) elegirFila(fila);
  };

  const alternarPantallaCompleta = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else contenedorMapa.current?.requestFullscreen?.();
  };

  if (esperandoProgreso) return <Cargando texto="Cargando..." />;

  const sorteoCompleto = listaSorteo.datos !== null && listaSorteo.datos.pendientes === 0;
  const resumenOrigen = picking ? textoOrigen(picking, vista, origen, filas.filter((f) => f.sku !== null).length, sorteo, fecha) : null;
  const recorridos = picking?.recorridos.map((r) => r.recorrido) ?? [];
  const conteoActivo = origen === 'sorteo' && listaSorteo.datos && filasContables.length > 0 ? conteo : null;

  const avisoMaqueta = (
    <div className="flex items-start gap-2 p-5 border border-amber-400 bg-amber-50 text-amber-900 text-sm max-w-xl">
      <AlertTriangle className="w-5 h-5 shrink-0" />
      <span>
        La maqueta del robot solo tiene las 11 referencias nuevas, así que no puede recorrer {origen === 'sorteo' ? 'el sorteo' : 'los pedidos del día'}.
        Cambia a <strong>Bodega Arauca</strong> para ver esta ruta, o elige <strong>Pedido de prueba (Tarea 6)</strong> para ver el recorrido de la
        maqueta.
      </span>
    </div>
  );
  const estadoCarga = maquetaSinOrigen ? (
    avisoMaqueta
  ) : cargando && !datos ? (
    <Cargando texto="Cargando el mapa..." />
  ) : error ? (
    <ErrorCarga mensaje={error} onReintentar={recargar} />
  ) : null;

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo="Recorrido y conteo"
        seccion="PASO 2 · RUTA DEL CARRITO"
        descripcion="El carrito va a las ubicaciones del sorteo y aquí mismo se cuenta, en el orden del recorrido. Usa el mismo algoritmo de la Tarea 6: máximo 3 ubicaciones por recorrido, exacto hasta 12 paradas y heurística si son más. En cada parada se detiene el tiempo de nivel 1 = T, nivel 2 = 3T y ambos niveles = 4T."
        icono={Route}
      />

      {webgl ? (
        <div
          ref={contenedorMapa}
          className={`relative overflow-hidden border border-slate-200 bg-papel ${pantallaCompleta ? 'h-screen' : 'h-[min(72vh,760px)] min-h-[480px]'}`}
        >
          {estadoCarga ? (
            <div className="absolute inset-0 flex items-center justify-center p-6">{estadoCarga}</div>
          ) : (
            datos &&
            linea && (
              <Escena3D
                layout={datos.layout}
                linea={linea}
                reloj={reloj}
                paradas={paradas}
                activa={activa}
                alCambiarParada={guardarActiva}
                alTerminar={() => setReproduciendo(false)}
                modoColor={modoColor}
                modoCamara={modoCamara}
                calidad={calidad}
                visitadas={visitadas}
                pendientes={pendientes}
                resaltadas={resaltadas}
                alElegirCelda={elegirCelda}
              />
            )
          )}

          {/* HUD superior: origen a la izquierda, controles a la derecha */}
          <div className="absolute top-3 inset-x-3 flex flex-wrap items-start justify-between gap-2 pointer-events-none [&>*]:pointer-events-auto">
            {resumenOrigen ? <ResumenOrigen texto={resumenOrigen} /> : <span />}
            <ControlesMapa
              modoCamara={modoCamara}
              alCambiarCamara={setModoCamara}
              vista={vista}
              alCambiarVista={cambiarVista}
              calidad={calidad}
              alCambiarCalidad={setCalidad}
              pantallaCompleta={pantallaCompleta}
              alAlternarPantallaCompleta={alternarPantallaCompleta}
            />
          </div>

          {/* Solo en pantalla completa: la tabla no se ve, así que va la parada actual y la siguiente */}
          {pantallaCompleta && linea && !estadoCarga && (
            <div className="absolute top-16 right-3">
              <TarjetaParada paradas={paradas} activa={activa} filasPorParada={filasPorParada} />
            </div>
          )}

          {/* HUD inferior: leyenda y línea de tiempo */}
          {linea && !estadoCarga && (
            <div className="absolute bottom-0 inset-x-0 flex flex-col pointer-events-none [&>*]:pointer-events-auto">
              <div className="self-start m-3">
                <LeyendaMapa modoColor={modoColor} alCambiar={setModoColor} />
              </div>
              <LineaTiempo
                reloj={reloj}
                linea={linea}
                reproduciendo={reproduciendo}
                velocidad={velocidad}
                recorridos={recorridos}
                seleccion={seleccion}
                alReproducir={alternarReproduccion}
                alReiniciar={reiniciarLinea}
                alCambiarVelocidad={cambiarVelocidad}
                alBuscar={(t) => irA(t)}
                alElegirRecorrido={elegirRecorrido}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {resumenOrigen && <ResumenOrigen texto={resumenOrigen} />}
            <SelectorVista vista={vista} alCambiar={cambiarVista} />
          </div>
          {estadoCarga ?? (
            <div className="flex items-start gap-2 p-4 border border-amber-400 bg-amber-50 text-amber-900 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>
                Este navegador no puede dibujar gráficos 3D (WebGL desactivado o no disponible), así que el mapa no se muestra. Los recorridos
                están en las tablas de abajo{conteoActivo ? ' y el conteo funciona igual' : ''}. Prueba con Chrome o Edge actualizados.
              </span>
            </div>
          )}
        </div>
      )}

      <SelectorOrigen
        origen={origen}
        sorteoActivo={sorteo}
        sorteos={progreso.datos?.sorteos ?? []}
        periodos={progreso.datos?.periodos ?? []}
        fechas={resumen.datos?.fechas_disponibles ?? (picking?.fecha ? [picking.fecha] : [])}
        fecha={fecha ?? picking?.fecha}
        alCambiar={cambiarOrigen}
      />

      {origen === 'lote' && picking?.pedidos !== undefined && (
        <p className="text-xs text-slate-600 -mt-3">
          {picking.pedidos} pedidos de Arauca del {picking.fecha}, consolidados por referencia.
          {picking.sin_ubicacion && picking.sin_ubicacion.length > 0 && (
            <span className="text-amber-700"> Sin ubicación en el maestro: {picking.sin_ubicacion.join(', ')}.</span>
          )}
        </p>
      )}

      {picking && linea && (
        <>
          <TablaRecorrido
            grupos={grupos}
            indicePorParada={indicePorParada}
            activa={activa}
            conteo={conteoActivo}
            numeroSorteo={sorteo}
            alElegir={elegirFila}
            alPasar={setResaltada}
          />

          {origen === 'sorteo' && sorteo && sorteoCompleto && (
            <BotonSiguiente
              to={`/inventario?sorteo=${sorteo}`}
              paso={3}
              texto="Ver cómo quedó el inventario"
              detalle={`Sorteo ${sorteo} completo · ${listaSorteo.datos?.tamano} referencias contadas`}
            />
          )}

          <div className="space-y-3">
            {/* Respaldo sin WebGL: el resumen de trayectos (con mapa, la tabla del recorrido ya lo cuenta). */}
            {!webgl && (
              <>
                <h3 className="font-bold text-base">Trayectos · {datos?.layout.nombre}</h3>
                <TablaTrayectos picking={picking} />
              </>
            )}
            <div className="flex items-start gap-2 p-4 bg-slate-50 border border-slate-200 text-xs leading-relaxed text-slate-600">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Supuestos (el caso no los da): velocidad {picking.totales.velocidad_m_s ?? 1} m/s y recogida en nivel 1 de{' '}
                {picking.totales.tiempo_recogida_nivel_1_s ?? 20} s (T). El nivel 2 tarda 3T y ambos niveles 4T. En la ruta de conteo se usa el
                mismo tiempo por parada, porque el caso no define un tiempo de conteo. El tiempo en cada parada no cambia cuál es la mejor ruta,
                solo suma al total.
              </span>
            </div>
          </div>

          <InstruccionesArduino consulta={consulta} recorridos={recorridos} recorridoInicial={seleccion === 'todos' ? recorridos[0] ?? 1 : seleccion} />
        </>
      )}
    </div>
  );
};
