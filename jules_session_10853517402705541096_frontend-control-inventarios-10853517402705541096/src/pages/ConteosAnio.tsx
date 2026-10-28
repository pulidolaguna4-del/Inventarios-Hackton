import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarRange, RotateCcw, ShieldCheck, AlertTriangle, Award, ClipboardList, CheckCircle2, User, Shuffle } from 'lucide-react';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { StatCard } from '../components/ui/StatCard';
import { Aviso, Cargando, ErrorCarga, EtiquetaSku, type MensajeAviso } from '../components/ui/Estados';
import { EncabezadoPagina, CLASE_BOTON_SECUNDARIO, CLASE_CAMPO } from '../components/ui/EncabezadoPagina';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import type { AvanceSemana, RegistroConteo, ResumenSorteo } from '../types/inventario';

const SEMANAS_POR_TRIMESTRE = 13;
const TODOS = 'TODOS';

/** Color de cada semana según cuántos conteos se hicieron en ella. */
function claseSemana(avance: AvanceSemana, semanaActual: number): string {
  if (avance.registrados >= 20) return 'bg-indigo-600 text-white border-indigo-600';
  if (avance.registrados >= 6) return 'bg-indigo-300 text-indigo-950 border-indigo-300';
  if (avance.registrados > 0) return 'bg-indigo-100 text-indigo-800 border-indigo-200';
  if (avance.semana > semanaActual) return 'bg-white text-slate-300 border-slate-100';
  return 'bg-white text-slate-600 border-slate-200';
}

/** Parte las 52 semanas en 4 trimestres de 13 para leer el año por filas. */
function agruparPorTrimestre(avances: AvanceSemana[]): AvanceSemana[][] {
  const trimestres: AvanceSemana[][] = [];
  for (let inicio = 0; inicio < avances.length; inicio += SEMANAS_POR_TRIMESTRE) {
    trimestres.push(avances.slice(inicio, inicio + SEMANAS_POR_TRIMESTRE));
  }
  return trimestres;
}

/** Cuántos conteos hizo cada responsable, de mayor a menor. */
function conteosPorResponsable(registros: RegistroConteo[]): { nombre: string; cantidad: number }[] {
  const conteo = new Map<string, number>();
  registros.forEach((registro) => conteo.set(registro.responsable, (conteo.get(registro.responsable) ?? 0) + 1));
  return Array.from(conteo, ([nombre, cantidad]) => ({ nombre, cantidad })).sort((a, b) => b.cantidad - a.cantidad);
}

async function cargarAnio() {
  const [progreso, registros] = await Promise.all([api.obtenerProgresoConteo(), api.obtenerRegistrosConteo()]);
  return { progreso, registros: registros.registros };
}

function textoDiferencia(diferencia: number) {
  return (
    <span className={`font-bold ${diferencia === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
      {diferencia === 0 ? '✓ 0' : diferencia > 0 ? `+${diferencia}` : diferencia}
    </span>
  );
}

/**
 * Vista anual del conteo cíclico: conteos hechos en cada una de las 52 semanas,
 * los sorteos del año, quién contó qué y el historial completo.
 */
export const ConteosAnio: React.FC = () => {
  const { datos, cargando, error, recargar } = useApi(cargarAnio);
  const [semanaElegida, setSemanaElegida] = useState<number | null>(null);
  const [periodoElegido, setPeriodoElegido] = useState<number | null>(null);
  const [filtroResponsable, setFiltroResponsable] = useState(TODOS);
  const [soloDiferencias, setSoloDiferencias] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const [aviso, setAviso] = useState<MensajeAviso | null>(null);
  const [confirmarReinicio, setConfirmarReinicio] = useState(false);
  const [reiniciando, setReiniciando] = useState(false);

  const reiniciar = async () => {
    setReiniciando(true);
    try {
      const respuesta = await api.reiniciarConteo();
      setAviso({
        tipo: 'exito',
        texto: respuesta.mensaje + (respuesta.respaldos.length ? ` · Respaldos: ${respuesta.respaldos.join(', ')}` : ''),
      });
      await recargar();
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setReiniciando(false);
      setConfirmarReinicio(false);
    }
  };

  if (cargando && !datos) return <Cargando texto="Cargando conteos del año..." />;
  if (error) return <ErrorCarga mensaje={error} onReintentar={recargar} />;
  if (!datos) return null;

  const { progreso, registros } = datos;
  const verificacion = progreso.verificacion;
  const semana = semanaElegida ?? progreso.semana_actual;
  const registrosSemana = registros.filter((registro) => registro.semana === semana);
  const responsables = conteosPorResponsable(registros);
  const texto = busqueda.trim().toLowerCase();
  const registrosVisibles = registros.filter(
    (registro) =>
      (filtroResponsable === TODOS || registro.responsable === filtroResponsable) &&
      (!soloDiferencias || registro.diferencia !== 0) &&
      (!texto || String(registro.sku).includes(texto)),
  );
  const conteosConDiferencia = registros.filter((registro) => registro.diferencia !== 0).length;

  const columnasRegistro: Column<RegistroConteo>[] = [
    { key: 'fecha', header: 'Fecha' },
    { key: 'sorteo', header: 'Sorteo', render: (registro) => <Link to={`/?sorteo=${registro.sorteo}`} className="font-semibold text-indigo-600 hover:underline">#{registro.sorteo}</Link> },
    { key: 'sku', header: 'SKU', render: (registro) => <EtiquetaSku sku={registro.sku} /> },
    {
      key: 'codigo_ubicacion',
      header: 'Ubicación',
      render: (registro) => <span className="font-mono text-xs">{registro.codigo_ubicacion ?? '—'}</span>,
    },
    { key: 'responsable', header: 'Responsable', render: (registro) => <span className="font-semibold">{registro.responsable}</span> },
    { key: 'cantidad_sistema', header: 'Sistema', className: 'text-right' },
    { key: 'cantidad_contada', header: 'Contada', className: 'text-right' },
    { key: 'diferencia', header: 'Diferencia', className: 'text-right', render: (registro) => textoDiferencia(registro.diferencia) },
  ];

  const nombrePeriodo = new Map(progreso.periodos.map((periodo) => [periodo.numero, periodo.nombre]));
  const sorteosVisibles = [...progreso.sorteos].reverse().filter((sorteo) => periodoElegido === null || sorteo.periodo === periodoElegido);

  const columnasSorteo: Column<ResumenSorteo>[] = [
    { key: 'numero', header: 'Sorteo', render: (sorteo) => <span className="font-bold">#{sorteo.numero}</span> },
    {
      key: 'periodo',
      header: 'Periodo',
      render: (sorteo) => <span className="font-mono text-xs">P{sorteo.periodo} · {nombrePeriodo.get(sorteo.periodo)}</span>,
    },
    { key: 'fecha_hora', header: 'Fecha', render: (sorteo) => sorteo.fecha_hora.replace('T', ' ').slice(0, 16) },
    {
      key: 'avance',
      header: 'Contadas',
      render: (sorteo) => {
        const porcentaje = Math.round((100 * sorteo.registrados) / sorteo.tamano);
        return (
          <div className="flex items-center gap-2 min-w-[160px]">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full ${porcentaje === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${porcentaje}%` }} />
            </div>
            <span className="text-xs font-semibold text-slate-600">
              {sorteo.registrados}/{sorteo.tamano}
            </span>
          </div>
        );
      },
    },
    {
      key: 'con_diferencia',
      header: 'Con diferencia',
      className: 'text-right',
      render: (sorteo) => <span className={sorteo.con_diferencia ? 'font-bold text-rose-600' : 'text-slate-400'}>{sorteo.con_diferencia}</span>,
    },
    {
      key: 'abrir',
      header: '',
      render: (sorteo) => (
        <Link to={`/?sorteo=${sorteo.numero}`} className="text-xs font-bold text-indigo-600 hover:underline">
          Abrir →
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <EncabezadoPagina
        titulo="Conteos del año"
        seccion="INVENTARIO / CONTEO CÍCLICO"
        descripcion="Todo el conteo cíclico de un vistazo: cuántos conteos se hicieron cada semana, los sorteos del año, quién contó cada referencia y si hubo diferencias."
        icono={CalendarRange}
        acciones={
          <button onClick={() => setConfirmarReinicio(true)} className={CLASE_BOTON_SECUNDARIO}>
            <RotateCcw className="w-4 h-4" />
            Reiniciar conteo
          </button>
        }
      />

      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />

      {/* Indicadores del año */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Cumplimiento del año"
          value={`${progreso.cumplimiento}%`}
          description={`${progreso.conteos_registrados} de ${progreso.conteos_totales} conteos hechos`}
          icon={Award}
          colorTheme="amber"
        />
        <StatCard
          title="Sorteados"
          value={`${progreso.conteos_sorteados} / ${progreso.conteos_totales}`}
          description={`${progreso.sorteos.length} sorteos · ${progreso.pendientes_por_contar} por contar`}
          icon={ClipboardList}
          colorTheme="indigo"
        />
        <StatCard
          title="Referencias completas"
          value={`${progreso.referencias_completas} / ${progreso.referencias}`}
          description={`Ya tienen sus ${progreso.conteos_por_anio} conteos`}
          icon={CheckCircle2}
          colorTheme="emerald"
        />
        <StatCard
          title="Con diferencia"
          value={conteosConDiferencia}
          description={`${progreso.referencias_con_diferencia} referencias afectadas`}
          icon={AlertTriangle}
          colorTheme="rose"
        />
      </div>

      <div
        className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
          verificacion.valido ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}
      >
        {verificacion.valido ? <ShieldCheck className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
        <span className="font-medium">
          {verificacion.valido
            ? `Verificado: ninguna referencia se repite en un mismo sorteo y ninguna pasa de ${progreso.conteos_por_anio} conteos. ` +
              (verificacion.completo
                ? `Las ${verificacion.referencias} referencias ya salieron exactamente ${progreso.conteos_por_anio} veces.`
                : `Cada referencia ha salido entre ${verificacion.minimo_por_referencia} y ${verificacion.maximo_por_referencia} veces.`)
            : verificacion.errores.join(' · ')}
        </span>
      </div>

      {/* Periodos del plan de logística y sus sorteos */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-800 text-base">Periodos de conteo</h3>
            <p className="text-xs text-slate-500">
              Plan de logística: en cada periodo se cuentan las {progreso.referencias} referencias una vez (5 periodos = 5 conteos al año).
              Haz clic en un periodo para ver sus sorteos.
            </p>
          </div>
          <Link to="/" className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline">
            <Shuffle className="w-3.5 h-3.5" />
            Ir a sortear
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {progreso.periodos.map((periodo) => {
            const esActual = periodo.numero === progreso.periodo_actual;
            const elegido = periodo.numero === periodoElegido;
            const porcentaje = Math.round((100 * periodo.referencias_contadas) / periodo.referencias_totales);
            return (
              <button
                key={periodo.numero}
                type="button"
                onClick={() => setPeriodoElegido(elegido ? null : periodo.numero)}
                aria-pressed={elegido}
                className={`text-left p-4 border bg-slate-50 cursor-pointer transition-colors hover:bg-white ${
                  elegido ? 'border-tinta ring-2 ring-tinta' : esActual ? 'border-senal' : 'border-slate-200'
                }`}
              >
                <span className="flex items-center justify-between font-mono text-[11px] tracking-[0.1em] text-slate-500">
                  PERIODO {periodo.numero}
                  {esActual && <span className="bg-senal text-tinta px-1.5 font-semibold">ACTUAL</span>}
                </span>
                <span className="titulo-senal block text-2xl mt-1">{periodo.nombre}</span>
                <span className="block text-sm font-semibold mt-2">
                  {periodo.referencias_contadas}
                  <span className="font-normal text-slate-500"> / {periodo.referencias_totales} referencias contadas</span>
                </span>
                <span className="block h-1.5 bg-slate-200 mt-1.5" aria-hidden="true">
                  <span className={`block h-full ${porcentaje === 100 ? 'bg-emerald-500' : 'bg-tinta'}`} style={{ width: `${porcentaje}%` }} />
                </span>
                <span className="block text-xs text-slate-500 mt-2">
                  {periodo.sorteos.length} sorteos · {periodo.conteos_registrados} de {periodo.conteos_sorteados} conteos hechos
                </span>
              </button>
            );
          })}
        </div>

        <DataTable
          columns={columnasSorteo}
          data={sorteosVisibles}
          keyExtractor={(sorteo) => String(sorteo.numero)}
          pageSize={10}
          emptyMessage={periodoElegido ? 'Este periodo todavía no tiene sorteos.' : 'Todavía no hay sorteos.'}
        />
      </div>

      {/* Cuadrícula de las 52 semanas */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-800 text-base">Conteos por semana</h3>
            <p className="text-xs text-slate-500">Haz clic en una semana para ver qué se contó y quién lo contó.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white border border-slate-200"></span>0</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-100 border border-indigo-200"></span>1–5</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-300"></span>6–19</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-600"></span>20 o más</span>
          </div>
        </div>

        <div className="space-y-1.5 overflow-x-auto">
          {agruparPorTrimestre(progreso.avance_semanal).map((trimestre, indice) => (
            <div key={indice} className="flex items-center gap-1.5 min-w-[560px]">
              <span className="w-8 shrink-0 text-[11px] font-bold text-slate-400">T{indice + 1}</span>
              <div className="grid grid-cols-13 gap-1.5 flex-1">
                {trimestre.map((avance) => (
                  <button
                    key={avance.semana}
                    onClick={() => setSemanaElegida(avance.semana)}
                    title={`Semana ${avance.semana}: ${avance.registrados} conteos`}
                    className={`border rounded-lg py-1.5 text-xs font-bold cursor-pointer transition-all ${claseSemana(avance, progreso.semana_actual)} ${
                      avance.semana === semana ? 'ring-2 ring-indigo-600 ring-offset-1' : ''
                    } ${avance.semana === progreso.semana_actual ? 'underline underline-offset-2' : ''}`}
                  >
                    {avance.semana}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detalle de la semana elegida */}
      <div className="space-y-3">
        <h3 className="font-bold text-slate-800 text-lg">
          Semana {semana}
          {semana === progreso.semana_actual && <span className="ml-2 text-xs text-indigo-600">(actual)</span>}
          <span className="ml-2 text-xs font-medium text-slate-500">{registrosSemana.length} conteos</span>
        </h3>
        <DataTable
          columns={columnasRegistro}
          data={registrosSemana}
          keyExtractor={(registro) => `${registro.sorteo}-${registro.sku}`}
          pageSize={10}
          emptyMessage="En esta semana no se hizo ningún conteo."
        />
      </div>

      {/* Historial completo con filtro por responsable */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-800 text-base">Todos los conteos del año</h3>
            <p className="text-xs text-slate-500">Filtra por responsable para ver lo que contó cada persona.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={filtroResponsable} onChange={(e) => setFiltroResponsable(e.target.value)} className={`${CLASE_CAMPO} w-auto py-2 text-xs`}>
              <option value={TODOS}>Todos los responsables</option>
              {responsables.map((persona) => (
                <option key={persona.nombre} value={persona.nombre}>
                  {persona.nombre} ({persona.cantidad})
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2 cursor-pointer">
              <input type="checkbox" checked={soloDiferencias} onChange={(e) => setSoloDiferencias(e.target.checked)} />
              Solo con diferencia
            </label>
          </div>
        </div>

        {responsables.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {responsables.map((persona) => (
              <button
                key={persona.nombre}
                onClick={() => setFiltroResponsable(filtroResponsable === persona.nombre ? TODOS : persona.nombre)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer ${
                  filtroResponsable === persona.nombre
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                {persona.nombre}
                <span className="opacity-70">· {persona.cantidad} conteos</span>
              </button>
            ))}
          </div>
        )}

        <DataTable
          columns={[{ key: 'semana', header: 'Semana' }, ...columnasRegistro]}
          data={registrosVisibles}
          keyExtractor={(registro) => `${registro.sorteo}-${registro.sku}`}
          searchPlaceholder="Buscar por SKU..."
          onSearchChange={setBusqueda}
          pageSize={15}
          emptyMessage="Todavía no hay conteos con ese filtro."
        />
      </div>

      {/* Reiniciar el año */}
      <Modal
        isOpen={confirmarReinicio}
        onClose={() => setConfirmarReinicio(false)}
        title="Reiniciar el conteo del año"
        footer={
          <>
            <button onClick={() => setConfirmarReinicio(false)} className={CLASE_BOTON_SECUNDARIO}>
              Cancelar
            </button>
            <button
              onClick={reiniciar}
              disabled={reiniciando}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {reiniciando ? 'Reiniciando...' : 'Respaldar y reiniciar'}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-700">
          Se empieza un año nuevo: los {progreso.sorteos.length} sorteos y los {progreso.conteos_registrados} conteos actuales se
          guardan en un archivo de respaldo y la pantalla queda en cero.
        </p>
      </Modal>
    </div>
  );
};
