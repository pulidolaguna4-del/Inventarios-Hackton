import React, { useMemo, useState } from 'react';
import { Package, History, RefreshCw, MapPin, Info } from 'lucide-react';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { BadgeClase } from '../components/ui/Badge';
import { Aviso, BarraConteos, Cargando, ErrorCarga, EtiquetaSku, type MensajeAviso } from '../components/ui/Estados';
import { formatearNumero } from '../utils/formato';
import { EncabezadoPagina, CLASE_BOTON_PRINCIPAL } from '../components/ui/EncabezadoPagina';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import type { ClaseAbc, ProgresoReferencia, Referencia, RegistroConteo } from '../types/inventario';

/** Referencia del maestro con su progreso de conteo del año. */
type FilaReferencia = Referencia & { progreso: ProgresoReferencia | undefined };

async function cargarReferencias() {
  const [maestro, progreso] = await Promise.all([api.obtenerMaestro(), api.obtenerProgresoConteo()]);
  return { maestro, progreso };
}

const ESTADOS_FILTRO = [
  { value: 'EN_LISTA', label: 'En lista (menos de 5)' },
  { value: 'COMPLETA', label: 'Completas (5/5)' },
  { value: 'CON_DIFERENCIA', label: 'Con diferencia' },
  { value: 'NUEVA', label: 'Referencias nuevas' },
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

export const Referencias: React.FC = () => {
  const { datos, cargando, error, recargar } = useApi(cargarReferencias);
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

  const filtradas = filas.filter((fila) => {
    const texto = busqueda.trim().toLowerCase();
    return (
      (!texto || String(fila.sku).includes(texto) || fila.descripcion.toLowerCase().includes(texto)) &&
      (categoria === 'ALL' || fila.categoria === categoria) &&
      (clase === 'ALL' || fila.clase_abc === clase) &&
      (estado === 'ALL' || cumpleEstado(fila, estado))
    );
  });

  const abrirHistorial = async (fila: FilaReferencia) => {
    setSeleccionada(fila);
    setHistorial([]);
    try {
      const respuesta = await api.obtenerRegistrosConteo({ sku: fila.sku });
      setHistorial(respuesta.registros);
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : String(e) });
    }
  };

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

  if (cargando && !datos) return <Cargando texto="Cargando maestro de referencias..." />;
  if (error) return <ErrorCarga mensaje={error} onReintentar={recargar} />;
  if (!datos) return null;

  const { maestro } = datos;

  const columnas: Column<FilaReferencia>[] = [
    { key: 'sku', header: 'SKU', render: (fila) => <EtiquetaSku sku={fila.sku} /> },
    {
      key: 'descripcion',
      header: 'Descripción',
      render: (fila) => (
        <div>
          <span className="font-semibold text-slate-800">{fila.descripcion}</span>
          {fila.es_nueva && (
            <span className="ml-2 text-[10px] font-bold uppercase text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">
              Nueva
            </span>
          )}
          <div className="text-xs text-slate-500">{fila.categoria}</div>
        </div>
      ),
    },
    { key: 'clase_abc', header: 'Clase', render: (fila) => <BadgeClase clase={fila.clase_abc} /> },
    {
      key: 'popularidad',
      header: 'Popularidad',
      className: 'text-right',
      render: (fila) => (
        <span title={fila.origen_popularidad === 'proyeccion' ? 'Líneas equivalentes según la demanda proyectada' : 'Líneas de pedido en Arauca'}>
          {formatearNumero(fila.popularidad)}
        </span>
      ),
    },
    {
      key: 'codigo_ubicacion',
      header: 'Ubicación',
      render: (fila) => (
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-mono text-xs font-semibold">{fila.codigo_ubicacion}</span>
          <span className="text-xs text-slate-500">(N.º {fila.numero_plano})</span>
        </div>
      ),
    },
    {
      key: 'progreso',
      header: 'Conteos del año',
      render: (fila) => (
        <BarraConteos contados={fila.progreso?.contados ?? 0} conDiferencia={fila.progreso?.tiene_diferencia} />
      ),
    },
    {
      key: 'acciones',
      header: '',
      render: (fila) => (
        <button
          onClick={() => abrirHistorial(fila)}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg cursor-pointer"
        >
          <History className="w-3.5 h-3.5" />
          Historial
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <EncabezadoPagina
        titulo="Maestro de Referencias"
        descripcion="Popularidad (líneas de pedido en Arauca), clasificación ABC, ubicación asignada en la bodega y avance de conteos del año de cada referencia."
        icono={Package}
        acciones={
          <button onClick={recalcularMaestro} disabled={recalculando} className={CLASE_BOTON_PRINCIPAL}>
            <RefreshCw className={`w-4 h-4 ${recalculando ? 'animate-spin' : ''}`} />
            Recalcular maestro
          </button>
        }
      />

      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />

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
        <div className="flex items-center gap-1.5">
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

      <DataTable
        columns={columnas}
        data={filtradas}
        keyExtractor={(fila) => String(fila.sku)}
        searchPlaceholder="Buscar por SKU o descripción..."
        onSearchChange={setBusqueda}
        categories={categorias}
        selectedCategory={categoria}
        onCategoryChange={setCategoria}
        statuses={ESTADOS_FILTRO}
        selectedStatus={estado}
        onStatusChange={setEstado}
        pageSize={15}
        emptyMessage="Ninguna referencia cumple los filtros."
      />

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
              <p className="font-bold text-slate-700 mb-1.5">Semanas programadas en el plan</p>
              <div className="flex flex-wrap gap-1.5">
                {(seleccionada.progreso?.semanas_programadas ?? []).map((semana) => {
                  const contada = historial.some((registro) => registro.semana === semana);
                  return (
                    <span
                      key={semana}
                      className={`px-2.5 py-1 rounded-lg border font-bold ${
                        contada ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      Semana {semana} {contada ? '✓' : ''}
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
                <table className="w-full text-left border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-100 text-slate-600 uppercase">
                    <tr>
                      <th className="p-2">Fecha</th>
                      <th className="p-2">Semana</th>
                      <th className="p-2">Responsable</th>
                      <th className="p-2 text-right">Sistema</th>
                      <th className="p-2 text-right">Contada</th>
                      <th className="p-2 text-right">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historial.map((registro) => (
                      <tr key={`${registro.semana}-${registro.fecha}`}>
                        <td className="p-2">{registro.fecha}</td>
                        <td className="p-2">{registro.semana}</td>
                        <td className="p-2">{registro.responsable}</td>
                        <td className="p-2 text-right">{registro.cantidad_sistema}</td>
                        <td className="p-2 text-right">{registro.cantidad_contada}</td>
                        <td className={`p-2 text-right font-bold ${registro.diferencia === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {registro.diferencia}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
