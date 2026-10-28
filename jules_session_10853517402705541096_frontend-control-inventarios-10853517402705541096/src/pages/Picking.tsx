import React, { useMemo, useRef, useState } from 'react';
import { Route, Info, AlertTriangle, Map as IconoMapa, Box, Navigation } from 'lucide-react';
import { Cargando, ErrorCarga } from '../components/ui/Estados';
import { EncabezadoPagina } from '../components/ui/EncabezadoPagina';
import { formatearNumero } from '../utils/formato';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import type { PickingConTrazado, VistaMapa } from '../types/inventario';
import {
  COLORES_ABC,
  COLORES_CATEGORIA,
  Escena3D,
  soportaWebGL,
  type ModoCamara,
  type ModoColor,
  type Reproduccion,
} from '../components/mapa/Escena3D';
import { LineaTiempo } from '../components/mapa/LineaTiempo';
import { PanelRecorrido } from '../components/mapa/PanelRecorrido';
import { construirLinea, estadoEnTiempo, ubicacionesPorEstado } from '../utils/animacion';

const VISTAS: { valor: VistaMapa; etiqueta: string }[] = [
  { valor: 'arauca', etiqueta: 'Bodega Arauca' },
  { valor: 'maqueta', etiqueta: 'Maqueta' },
];

const CAMARAS: { valor: ModoCamara; etiqueta: string; icono: typeof Box }[] = [
  { valor: 'planta', etiqueta: 'Planta', icono: IconoMapa },
  { valor: 'isometrica', etiqueta: 'Isométrica', icono: Box },
  { valor: 'carrito', etiqueta: 'Carrito', icono: Navigation },
];

const claseSegmento = (activo: boolean) =>
  `h-10 px-3.5 text-xs font-bold uppercase tracking-wide border border-tinta -ml-px first:ml-0 cursor-pointer transition-colors ${
    activo ? 'bg-tinta text-papel' : 'bg-slate-50 text-tinta hover:bg-white'
  }`;

async function cargarVista(vista: VistaMapa) {
  const [layout, picking] = await Promise.all([api.obtenerLayout(vista), api.obtenerRecorridosConTrazado(vista)]);
  return { layout, picking };
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
 * Mapa y carrito: la bodega en 3D con el carrito recorriendo la ruta de picking, la línea
 * de tiempo, los pasos y las instrucciones para el robot Arduino.
 */
export const Picking: React.FC = () => {
  const [vista, setVista] = useState<VistaMapa>('arauca');
  const [modoColor, setModoColor] = useState<ModoColor>('abc');
  const [modoCamara, setModoCamara] = useState<ModoCamara>('isometrica');
  const [seleccion, setSeleccion] = useState<number | 'todos'>(1);
  const { datos, cargando, error, recargar } = useApi(() => cargarVista(vista), [vista]);

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
  const elegirRecorrido = (nueva: number | 'todos') => {
    setSeleccion(nueva);
    reiniciarLinea();
  };
  const cambiarVelocidad = (nueva: number) => {
    reproduccion.current.velocidad = nueva;
    setVelocidad(nueva);
  };

  const paleta = modoColor === 'abc' ? COLORES_ABC : COLORES_CATEGORIA;
  const recorridoInstrucciones = seleccion === 'todos' ? estado?.recorrido ?? 1 : seleccion;

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo="Mapa y carrito"
        seccion="ARDUINO / RECORRIDOS DEL CARRITO"
        descripcion="La bodega en 3D con el carrito haciendo la ruta de picking. En cada parada se detiene el tiempo real de recogida: nivel 1 = T, nivel 2 = 3T y ambos niveles = 4T. Las instrucciones del robot salen de la maqueta, que es lo que recorre físicamente."
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

      {cargando && !datos ? (
        <Cargando texto="Cargando el mapa..." />
      ) : error ? (
        <ErrorCarga mensaje={error} onReintentar={recargar} />
      ) : datos && linea ? (
        <>
          {!webgl ? (
            <div className="flex items-start gap-2 p-4 border border-amber-400 bg-amber-50 text-amber-900 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>
                Este navegador no puede dibujar gráficos 3D (WebGL desactivado o no disponible), así que el mapa no se muestra.
                Los recorridos siguen disponibles en la tabla de abajo. Prueba con Chrome o Edge actualizados.
              </span>
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
                        Por recoger
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 border border-tinta bg-tinta" />
                        Ya recogida
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
              <PanelRecorrido vista={vista} linea={linea} estado={estado} tiempo={tiempo} recorridoInstrucciones={recorridoInstrucciones} />
            </div>
          )}

          <div className="space-y-3">
            <h3 className="font-bold text-base">Trayectos · {datos.layout.nombre}</h3>
            <TablaTrayectos picking={datos.picking} />
            <div className="flex items-start gap-2 p-4 bg-slate-50 border border-slate-200 text-xs leading-relaxed text-slate-600">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Supuestos (el caso no los da): velocidad {datos.picking.totales.velocidad_m_s ?? 1} m/s y recogida en nivel 1 de{' '}
                {datos.picking.totales.tiempo_recogida_nivel_1_s ?? 20} s (T). El nivel 2 tarda 3T y ambos niveles 4T. El tiempo de recogida
                no cambia cuál es la mejor ruta, solo suma al total.
              </span>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
