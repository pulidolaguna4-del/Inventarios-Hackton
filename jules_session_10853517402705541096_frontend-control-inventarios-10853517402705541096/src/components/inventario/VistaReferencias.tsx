import React, { useCallback, useMemo, useState } from 'react';
import { History, RefreshCw, MapPin, Info, X } from 'lucide-react';
import { Tabla, type ColumnaTabla } from '../ui/Tabla';
import { FiltrosTabla } from '../ui/FiltrosTabla';
import { Insignia } from '../ui/Insignia';
import { Modal } from '../ui/Modal';
import { BadgeClase } from '../ui/Badge';
import { Aviso, BarraConteos, Cargando, ErrorCarga, type MensajeAviso } from '../ui/Estados';
import { formatearNumero } from '../../utils/formato';
import { CLASE_BOTON_PRINCIPAL } from '../ui/EncabezadoPagina';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { ClaseAbc, ProgresoReferencia, Referencia, RegistroConteo } from '../../types/inventario';

/** Referencia del maestro con su progreso de conteo del año. */
type FilaReferencia = Referencia & { progreso: ProgresoReferencia | undefined };

/** Maestro y progreso del año; con un sorteo, también lo que se contó en él. */
async function cargarReferencias(sorteo: number | null) {
  const [maestro, progreso, delSorteo] = await Promise.all([
    api.obtenerMaestro(),
    api.obtenerProgresoConteo(),
    sorteo ? api.obtenerRegistrosConteo({ sorteo }) : Promise.resolve(null),
  ]);
  return { maestro, progreso, registrosSorteo: delSorteo?.registros ?? [] };
}

const ESTADOS_FILTRO = [
  { valor: 'ALL', texto: 'Todos los estados' },
  { valor: 'EN_LISTA', texto: 'En lista (menos de 5)' },
  { valor: 'COMPLETA', texto: 'Completas (5/5)' },
  { valor: 'CON_DIFERENCIA', texto: 'Con diferencia' },
  { valor: 'NUEVA', texto: 'Referencias nuevas' },
];

function cumpleEstado(fila: FilaReferencia, estado: string): boolean {
  switch (estado) {
    case 'EN_LISTA':
      return !fila.progreso?.sale_de_la_lista;
    case 'COMPLETA':
      return Boolean(fila.progreso?.sale_de_la_lista);
    case 'CON_DIFERENCIA':
      return Boolean(fila.progreso?.tiene_diferencia);
    case 'NUEVA':
      return fila.es_nueva;
    default:
      return true;
  }
}

/** Columnas del historial de conteos de una referencia (en el modal). */
const COLUMNAS_HISTORIAL: ColumnaTabla<RegistroConteo>[] = [
  { clave: 'fecha', titulo: 'Fecha' },
  { clave: 'sorteo', titulo: 'Sorteo', render: (registro) => `#${registro.sorteo}` },
  { clave: 'semana', titulo: 'Semana', alinear: 'derecha' },
  { clave: 'responsable', titulo: 'Responsable' },
  { clave: 'cantidad_sistema', titulo: 'Sistema', alinear: 'derecha' },
  { clave: 'cantidad_contada', titulo: 'Contada', alinear: 'derecha' },
  {
    clave: 'diferencia',
    titulo: 'Diferencia',
    alinear: 'derecha',
    render: (registro) => (
      <strong className={registro.diferencia === 0 ? 'text-emerald-700' : 'text-rose-600'}>
        {registro.diferencia > 0 ? `+${registro.diferencia}` : registro.diferencia}
      </strong>
    ),
  },
];

interface VistaReferenciasProps {
  /** Si llega, la tabla arranca filtrada en lo que se contó en ese sorteo (?sorteo=N). */
  sorteo: number | null;
  alQuitarSorteo: () => void;
}

/**
 * Vista "Referencias" del Paso 3: el maestro con ABC, ubicación, conteos X/5 e historial.
 * Al llegar desde el Paso 2 (?sorteo=N) muestra primero lo que se acaba de contar.
 */
export const VistaReferencias: React.FC<VistaReferenciasProps> = ({ sorteo, alQuitarSorteo }) => {
  const { datos, cargando, error, recargar } = useApi(() => cargarReferencias(sorteo), [sorteo]);
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('ALL');
  const [estado, setEstado] = useState('ALL');
  const [clase, setClase] = useState<ClaseAbc | 'ALL'>('ALL');
  const [aviso, setAviso] = useState<MensajeAviso | null>(null);
  const [recalculando, setRecalculando] = useState(false);

  const [seleccionada, setSeleccionada] = useState<FilaReferencia | null>(null);
  const [historial, setHistorial] = useState<RegistroConteo[]>([]);

  const filas: FilaReferencia[] = useMemo(() => {
    if (!datos) return [];
    const progresoPorSku = new Map(datos.progreso.progreso.map((fila) => [fila.sku, fila]));
    return datos.maestro.referencias.map((referencia) => ({ ...referencia, progreso: progresoPorSku.get(referencia.sku) }));
  }, [datos]);

  const categorias = useMemo(() => Array.from(new Set(filas.map((fila) => fila.categoria))).sort(), [filas]);

  const registroDelSorteo = useMemo(() => new Map((datos?.registrosSorteo ?? []).map((registro) => [registro.sku, registro])), [datos]);

  const filtradas = filas.filter((fila) => {
    const texto = busqueda.trim().toLowerCase();
    return (
      (!sorteo || registroDelSorteo.has(fila.sku)) &&
      (!texto || String(fila.sku).includes(texto) || fila.descripcion.toLowerCase().includes(texto)) &&
      (categoria === 'ALL' || fila.categoria === categoria) &&
      (clase === 'ALL' || fila.clase_abc === clase) &&
      (estado === 'ALL' || cumpleEstado(fila, estado))
    );
  });

  // Solo usa setters: es estable y sirve en las columnas memorizadas.
  const abrirHistorial = useCallback(async (fila: FilaReferencia) => {
    setSeleccionada(fila);
    setHistorial([]);
    try {
      const respuesta = await api.obtenerRegistrosConteo({ sku: fila.sku });
      setHistorial(respuesta.registros);
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  const recalcularMaestro = async () => {
    setRecalculando(true);
    try {
      await api.recalcularMaestro();
      await recargar();
      setAviso({ tipo: 'exito', texto: 'Maestro recalculado: popularidad, clasificación ABC y ubicaciones actualizadas.' });
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setRecalculando(false);
    }
  };

  const columnas = useMemo<ColumnaTabla<FilaReferencia>[]>(
    () => [
      { clave: 'sku', titulo: 'SKU', ancho: '7rem', render: (fila) => <span className="tabla-chip">{fila.sku}</span> },
      {
        clave: 'descripcion',
        titulo: 'Descripción',
        render: (fila) => (
          <span className="flex flex-col py-1">
            <span className="flex flex-wrap items-center gap-2 font-semibold">
              {fila.descripcion}
              {fila.es_nueva && <Insignia tono="aviso">Nueva</Insignia>}
            </span>
            <span className="text-xs opacity-70">{fila.categoria}</span>
          </span>
        ),
      },
      {
        clave: 'clase_abc',
        titulo: 'Clase',
        render: (fila) => (
          <span className="flex flex-col items-start gap-1">
            <BadgeClase clase={fila.clase_abc} />
            {fila.clase_abc_logistica && (
              <span className="font-mono text-[11px] opacity-70" title="Clase que asignó el equipo de logística (por unidades de demanda). La del sistema es por líneas de pedido.">
                Logística: {fila.clase_abc_logistica}
              </span>
            )}
          </span>
        ),
      },
      {
        clave: 'popularidad',
        titulo: 'Popularidad',
        alinear: 'derecha',
        render: (fila) => (
          <span title={fila.origen_popularidad === 'proyeccion' ? 'Líneas equivalentes según la demanda proyectada' : 'Líneas de pedido en Arauca'}>
            {formatearNumero(fila.popularidad)}
          </span>
        ),
      },
      {
        clave: 'codigo_ubicacion',
        titulo: 'Ubicación',
        render: (fila) => (
          <span className="flex flex-wrap items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 opacity-50" aria-hidden="true" />
            <span className="tabla-chip">{fila.codigo_ubicacion}</span>
            <span className="text-xs opacity-70">(N.º {fila.numero_plano})</span>
            {fila.ubicacion_logistica && (
              <span title="Posición en la maqueta del robot según el entregable de logística (Tarea 1)">
                <Insignia tono="acento">Maqueta {fila.ubicacion_logistica}</Insignia>
              </span>
            )}
          </span>
        ),
      },
      {
        clave: 'progreso',
        titulo: 'Conteos del año',
        render: (fila) => <BarraConteos contados={fila.progreso?.contados ?? 0} conDiferencia={fila.progreso?.tiene_diferencia} />,
      },
      ...(sorteo
        ? [
            {
              clave: 'en_sorteo',
              titulo: `Sorteo ${sorteo}`,
              render: (fila: FilaReferencia) => {
                const registro = registroDelSorteo.get(fila.sku);
                if (!registro) return <span className="text-xs opacity-50">—</span>;
                return (
                  <span className={`font-mono text-xs font-bold ${registro.diferencia === 0 ? '' : 'text-rose-600'}`}>
                    {registro.cantidad_sistema} → {registro.cantidad_contada} ({registro.diferencia > 0 ? `+${registro.diferencia}` : registro.diferencia})
                  </span>
                );
              },
            },
          ]
        : []),
      {
        clave: 'acciones',
        titulo: <span className="sr-only">Acciones</span>,
        alinear: 'derecha' as const,
        render: (fila: FilaReferencia) => (
          <button
            type="button"
            onClick={() => abrirHistorial(fila)}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-full text-xs font-semibold bg-[var(--tabla-chip)] hover:bg-[var(--tabla-hover)] cursor-pointer"
          >
            <History className="w-3.5 h-3.5" aria-hidden="true" />
            Historial
          </button>
        ),
      },
    ],
    [sorteo, registroDelSorteo, abrirHistorial],
  );

  if (cargando && !datos) return <Cargando texto="Cargando maestro de referencias..." />;
  if (error) return <ErrorCarga mensaje={error} onReintentar={recargar} />;
  if (!datos) return null;

  const { maestro } = datos;

  return (
    <div className="space-y-6">
      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />

      {sorteo && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 pl-3 pr-1 h-9 bg-tinta text-papel text-xs font-bold">
            Contadas en el sorteo {sorteo} · {registroDelSorteo.size}
            <button
              type="button"
              onClick={alQuitarSorteo}
              aria-label="Quitar el filtro del sorteo"
              className="flex items-center justify-center w-7 h-7 hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </span>
          <span className="text-xs text-slate-500">
            Así quedaron las referencias que se acaban de contar. Quita el filtro para ver las {filas.length}.
          </span>
        </div>
      )}

      {/* Criterios y filtro por clase */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 text-xs text-slate-600">
        <div className="flex items-start gap-2 max-w-3xl">
          <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
          <span>
            Clase A hasta el {maestro.criterios.umbral_a * 100}% de la popularidad acumulada, B hasta el{' '}
            {maestro.criterios.umbral_b * 100}%. Las referencias nuevas usan su demanda proyectada ×{' '}
            {maestro.criterios.factor_lineas_por_unidad} líneas por unidad. Fuente: {maestro.fuente} ({maestro.generado}).
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={recalcularMaestro} disabled={recalculando} className={`${CLASE_BOTON_PRINCIPAL} mr-2`}>
            <RefreshCw className={`w-4 h-4 ${recalculando ? 'animate-spin' : ''}`} />
            Recalcular maestro
          </button>
          {(['ALL', 'A', 'B', 'C'] as const).map((opcion) => (
            <button
              key={opcion}
              onClick={() => setClase(opcion)}
              className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer border ${
                clase === opcion ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              {opcion === 'ALL' ? 'Todas' : `${opcion} (${maestro.conteo_por_clase[opcion]})`}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <FiltrosTabla
          busqueda={busqueda}
          alBuscar={setBusqueda}
          marcador="Buscar por SKU o descripción..."
          filtros={[
            {
              etiqueta: 'Categoría',
              valor: categoria,
              opciones: [{ valor: 'ALL', texto: 'Todas las categorías' }, ...categorias.map((c) => ({ valor: c, texto: c }))],
              alCambiar: setCategoria,
            },
            { etiqueta: 'Estado', valor: estado, opciones: ESTADOS_FILTRO, alCambiar: setEstado },
          ]}
          resumen={`${filtradas.length} de ${filas.length} referencias`}
        />
        <Tabla
          etiqueta="Maestro de referencias"
          columnas={columnas}
          filas={filtradas}
          claveFila={(fila) => String(fila.sku)}
          tonoFila={(fila) => (fila.progreso?.sale_de_la_lista ? 'visitada' : 'normal')}
          alClicFila={abrirHistorial}
          altoMaximo="640px"
          vacio={sorteo ? `Todavía no se ha contado nada del sorteo ${sorteo}.` : 'Ninguna referencia cumple los filtros.'}
          pie="Clic o Enter en una referencia para ver su historial. En verde, las que ya tienen sus 5 conteos del año."
        />
      </div>

      {/* Historial de conteos de una referencia */}
      <Modal
        isOpen={seleccionada !== null}
        onClose={() => setSeleccionada(null)}
        title={`Historial de conteos — ${seleccionada?.sku ?? ''}`}
        maxWidth="2xl"
      >
        {seleccionada && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <p className="font-bold text-slate-800 text-sm">{seleccionada.descripcion}</p>
              <p className="text-slate-500 mt-0.5">
                {seleccionada.categoria} · Ubicación {seleccionada.codigo_ubicacion} · Clase {seleccionada.clase_abc}
              </p>
            </div>

            <div>
              <p className="font-bold text-slate-700 mb-1.5">Sorteos en que ha salido</p>
              {(seleccionada.progreso?.sorteos ?? []).length === 0 && (
                <p className="text-slate-500">Todavía no ha salido en ningún sorteo.</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {(seleccionada.progreso?.sorteos ?? []).map((sorteo) => {
                  const contada = historial.some((registro) => registro.sorteo === sorteo);
                  return (
                    <span
                      key={sorteo}
                      className={`px-2.5 py-1 rounded-lg border font-bold ${
                        contada ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      Sorteo {sorteo} {contada ? '✓' : ''}
                    </span>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="font-bold text-slate-700 mb-1.5">Conteos registrados</p>
              {historial.length === 0 ? (
                <p className="text-slate-500">Todavía no tiene conteos registrados.</p>
              ) : (
                <Tabla
                  etiqueta="Conteos registrados"
                  densidad="compacta"
                  columnas={COLUMNAS_HISTORIAL}
                  filas={historial}
                  claveFila={(registro) => `${registro.sorteo}-${registro.fecha}`}
                />
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
