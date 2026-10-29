import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ClipboardCheck, CheckCircle2, Clock, ListChecks, User, ChevronLeft, ChevronRight, CalendarRange, Shuffle, PartyPopper, Lock } from 'lucide-react';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { BotonSiguiente } from '../components/ui/BotonSiguiente';
import { Aviso, BarraConteos, Cargando, ErrorCarga, EtiquetaSku, type MensajeAviso } from '../components/ui/Estados';
import { EncabezadoPagina, CLASE_BOTON_PRINCIPAL, CLASE_BOTON_SECUNDARIO } from '../components/ui/EncabezadoPagina';
import { useApi } from '../hooks/useApi';
import { useProgreso } from '../hooks/ProgresoContexto';
import { api } from '../services/api';
import { guardarResponsable, leerResponsableGuardado } from '../utils/responsable';
import type { ReferenciaSorteo } from '../types/inventario';

type Pestana = 'PENDIENTES' | 'CONTADAS' | 'TODAS';

/** Fecha y hora del sorteo para mostrar: '2026-10-28T10:20:17' -> '2026-10-28 10:20'. */
function formatearFechaHora(fechaHora: string): string {
  return fechaHora.replace('T', ' ').slice(0, 16);
}

/**
 * Paso 1 del flujo: el botón "Sortear" elige referencias al azar (ninguna pasa de 5 conteos
 * en el año). Aquí no se cuenta: la lista es de solo lectura y el conteo se hace en el Paso 2,
 * siguiendo el recorrido del carrito. No se puede sortear otro mientras el último tenga pendientes.
 */
export const Sortear: React.FC = () => {
  const [parametros, setParametros] = useSearchParams();
  const progreso = useProgreso();
  const sorteoActual = progreso.datos?.sorteo_actual ?? null;
  const numeroSorteo = Number(parametros.get('sorteo')) || sorteoActual;
  const lista = useApi(
    () => (numeroSorteo ? api.obtenerSorteo(numeroSorteo) : Promise.resolve(null)),
    [numeroSorteo],
  );

  const [pestana, setPestana] = useState<Pestana>('PENDIENTES');
  const [aviso, setAviso] = useState<MensajeAviso | null>(null);
  const [responsable, setResponsable] = useState(leerResponsableGuardado);
  const [cantidadElegida, setCantidadElegida] = useState<string | null>(null);
  const [sorteando, setSorteando] = useState(false);
  const [confirmarForzar, setConfirmarForzar] = useState(false);

  const irASorteo = (numero: number) => setParametros({ sorteo: String(numero) });

  const cambiarResponsable = (nombre: string) => {
    setResponsable(nombre);
    guardarResponsable(nombre);
  };

  if (progreso.cargando && !progreso.datos) return <Cargando texto="Cargando conteos..." />;
  if (progreso.error) return <ErrorCarga mensaje={progreso.error} onReintentar={progreso.recargar} />;
  if (!progreso.datos) return null;

  const resumen = progreso.datos;
  const cantidadTexto = cantidadElegida ?? String(resumen.cantidad_sorteo_por_defecto);
  const cantidadValida = Number.isInteger(Number(cantidadTexto)) && Number(cantidadTexto) >= 1;
  const anioCompleto = resumen.referencias_disponibles === 0;

  // Solo bloquea el último sorteo: los anteriores con pendientes se pueden seguir contando.
  const ultimo = resumen.sorteos.at(-1) ?? null;
  const pendientesUltimo = ultimo ? ultimo.tamano - ultimo.registrados : 0;
  const bloqueado = pendientesUltimo > 0;

  const hacerSorteo = async (forzar: boolean) => {
    setSorteando(true);
    try {
      const resultado = await api.sortear(Number(cantidadTexto), forzar);
      setConfirmarForzar(false);
      setAviso({ tipo: 'exito', texto: resultado.mensaje });
      setPestana('PENDIENTES');
      await progreso.recargar();
      irASorteo(resultado.sorteo);
    } catch (e) {
      setConfirmarForzar(false);
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setSorteando(false);
    }
  };

  const referencias = lista.datos?.referencias ?? [];
  const pendientes = referencias.filter((fila) => !fila.contada_en_sorteo);
  const contadas = referencias.filter((fila) => fila.contada_en_sorteo);
  const visibles = pestana === 'PENDIENTES' ? pendientes : pestana === 'CONTADAS' ? contadas : referencias;
  const porcentaje = referencias.length ? Math.round((contadas.length / referencias.length) * 100) : 0;

  const columnas: Column<ReferenciaSorteo>[] = [
    { key: 'sku', header: 'SKU', render: (fila) => <EtiquetaSku sku={fila.sku} /> },
    {
      key: 'descripcion',
      header: 'Referencia',
      render: (fila) => (
        <div>
          <span className="font-semibold text-slate-800">{fila.descripcion}</span>
          <div className="text-xs text-slate-500">{fila.categoria}</div>
        </div>
      ),
    },
    {
      key: 'codigo_ubicacion',
      header: 'Ubicación',
      render: (fila) => <span className="font-mono text-xs font-semibold">{fila.codigo_ubicacion}</span>,
    },
    {
      key: 'contados',
      header: 'Conteos del año',
      render: (fila) => <BarraConteos contados={fila.contados} conDiferencia={fila.tiene_diferencia} />,
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (fila) => {
        const registro = fila.registro_sorteo;
        if (!registro) {
          return (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              Pendiente
            </span>
          );
        }
        return (
          <span className="flex flex-col text-xs">
            {registro.diferencia === 0 ? (
              <span className="font-bold text-tinta">✓ Contada · cuadra ({registro.cantidad_contada})</span>
            ) : (
              <span className="font-bold text-rose-600">
                ✓ Contada · diferencia {registro.diferencia > 0 ? `+${registro.diferencia}` : registro.diferencia}
              </span>
            )}
            <span className="flex items-center gap-1 text-slate-500">
              <User className="w-3 h-3" />
              {registro.responsable} · {registro.fecha}
            </span>
          </span>
        );
      },
    },
  ];

  const botonPestana = (valor: Pestana, etiqueta: string, cantidad: number, Icono: typeof Clock) => (
    <button
      onClick={() => setPestana(valor)}
      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
        pestana === valor ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
      }`}
    >
      <Icono className="w-3.5 h-3.5" />
      {etiqueta} ({cantidad})
    </button>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <EncabezadoPagina
        titulo="Sortear"
        seccion="PASO 1 · CONTEO CÍCLICO"
        descripcion={`El sistema elige al azar qué referencias contar. Primero salen las que llevan menos conteos y ninguna pasa de ${resumen.conteos_por_anio} en el año. El conteo se hace en el Paso 2, siguiendo el recorrido del carrito.`}
        icono={ClipboardCheck}
        acciones={
          numeroSorteo && sorteoActual ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => irASorteo(numeroSorteo - 1)}
                disabled={numeroSorteo <= 1}
                aria-label="Sorteo anterior"
                className={CLASE_BOTON_SECUNDARIO}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-slate-800 text-sm">
                Sorteo {numeroSorteo} <span className="font-medium text-slate-400">de {sorteoActual}</span>
              </span>
              <button
                onClick={() => irASorteo(numeroSorteo + 1)}
                disabled={numeroSorteo >= sorteoActual}
                aria-label="Sorteo siguiente"
                className={CLASE_BOTON_SECUNDARIO}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : undefined
        }
      />

      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />

      {/* Quién cuenta y botón de sorteo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 border bg-slate-50 border-slate-200">
          <label htmlFor="responsable" className="font-mono text-xs tracking-[0.1em] text-slate-600 flex items-center gap-1.5 mb-2.5">
            <User className="w-3.5 h-3.5" />
            QUIÉN VA A CONTAR
          </label>
          <input
            id="responsable"
            value={responsable}
            onChange={(e) => cambiarResponsable(e.target.value)}
            placeholder="Nombre del responsable"
            className="w-full h-[52px] border-0 border-b-2 border-tinta bg-transparent font-display text-2xl font-bold text-tinta placeholder:text-slate-400 focus:outline-hidden focus:border-senal"
          />
          <p className="text-[11px] text-slate-500 mt-1.5">Se guarda en este navegador y se usa al contar en el Paso 2.</p>
        </div>

        <div className="p-5 bg-tinta text-papel">
          {anioCompleto ? (
            <div className="flex items-start gap-2 text-green-300">
              <PartyPopper className="w-5 h-5 shrink-0" />
              <p className="text-sm font-semibold">
                Todas las referencias ya salieron {resumen.conteos_por_anio} veces este año. Para empezar un año nuevo usa "Reiniciar
                conteo" en Inventario, vista Año.
              </p>
            </div>
          ) : (
            <>
              <label htmlFor="cantidad-sorteo" className="font-mono text-xs tracking-[0.1em] text-[#b5b0a4] flex items-center gap-1.5 mb-2.5">
                <Shuffle className="w-3.5 h-3.5" />
                CUÁNTAS REFERENCIAS SORTEAR
              </label>
              <div className="flex gap-2">
                <input
                  id="cantidad-sorteo"
                  type="number"
                  min={1}
                  max={resumen.referencias_disponibles}
                  value={cantidadTexto}
                  onChange={(e) => setCantidadElegida(e.target.value)}
                  disabled={bloqueado}
                  className="w-24 h-[52px] border border-[#45474d] bg-[#222327] text-papel font-mono text-xl font-semibold text-center focus:outline-hidden focus:border-senal disabled:opacity-50"
                />
                <button
                  onClick={() => hacerSorteo(false)}
                  disabled={sorteando || !cantidadValida || bloqueado}
                  className="titulo-senal flex-1 h-[52px] flex items-center justify-center gap-2.5 bg-senal hover:bg-senal-claro text-tinta text-lg tracking-[0.04em] transition-all active:translate-y-px cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bloqueado ? <Lock className="w-5 h-5" /> : <Shuffle className="w-5 h-5" />}
                  {sorteando ? 'Sorteando...' : `Sortear ${cantidadValida ? cantidadTexto : ''} al azar`}
                </button>
              </div>
              {bloqueado && ultimo ? (
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-semibold text-senal">
                    Termina el sorteo {ultimo.numero} antes de sortear otro ({pendientesUltimo} pendientes).
                  </p>
                  <button
                    type="button"
                    onClick={() => setConfirmarForzar(true)}
                    className="text-[11px] text-[#b5b0a4] underline hover:text-papel cursor-pointer"
                  >
                    Sortear de todas formas
                  </button>
                </div>
              ) : (
                <p className="text-xs text-[#b5b0a4] mt-2">
                  Faltan {resumen.por_sortear} de {resumen.conteos_totales} conteos del año por sortear · Hay{' '}
                  {resumen.referencias_disponibles} referencias disponibles.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {!numeroSorteo ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center space-y-2">
          <Shuffle className="w-10 h-10 mx-auto text-slate-300" />
          <p className="font-bold text-slate-700">Todavía no hay ningún sorteo</p>
          <p className="text-sm text-slate-500">Escribe cuántas referencias quieres contar y presiona "Sortear".</p>
        </div>
      ) : (
        <>
          {/* Avance del sorteo */}
          <div className="p-4 rounded-2xl border bg-white border-slate-200 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-700">
              <span>
                Sorteo {numeroSorteo}
                {lista.datos && (
                  <span className="font-normal text-slate-500">
                    {' '}
                    · Periodo {lista.datos.periodo} ({resumen.periodos.find((p) => p.numero === lista.datos?.periodo)?.nombre}) ·{' '}
                    {formatearFechaHora(lista.datos.fecha_hora)}
                  </span>
                )}
              </span>
              <Link to="/inventario?vista=anio" className="flex items-center gap-1 text-indigo-600 hover:underline">
                <CalendarRange className="w-3.5 h-3.5" />
                Ver todo el año
              </Link>
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {contadas.length} <span className="text-base font-medium text-slate-500">de {referencias.length} contadas</span>
            </p>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${porcentaje === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                style={{ width: `${porcentaje}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {botonPestana('PENDIENTES', 'Por contar', pendientes.length, Clock)}
            {botonPestana('CONTADAS', 'Contadas', contadas.length, CheckCircle2)}
            {botonPestana('TODAS', 'Todas', referencias.length, ListChecks)}
          </div>

          {lista.error ? (
            <ErrorCarga mensaje={lista.error} onReintentar={lista.recargar} />
          ) : (
            <DataTable
              columns={columnas}
              data={visibles}
              keyExtractor={(fila) => String(fila.sku)}
              isLoading={lista.cargando}
              pageSize={15}
              emptyMessage={pestana === 'PENDIENTES' ? 'No queda nada por contar en este sorteo.' : 'No hay referencias en esta pestaña.'}
            />
          )}

          <BotonSiguiente
            to={`/recorrido?origen=sorteo&sorteo=${numeroSorteo}`}
            paso={2}
            texto={`Ver recorrido del sorteo ${numeroSorteo}`}
            detalle={
              lista.datos
                ? pendientes.length > 0
                  ? `El carrito va a las ${referencias.length} ubicaciones · ${pendientes.length} por contar`
                  : 'Sorteo completo · se puede revisar el recorrido'
                : undefined
            }
          />
        </>
      )}

      {/* Sortear con pendientes: acción secundaria, con confirmación */}
      <Modal
        isOpen={confirmarForzar}
        onClose={() => setConfirmarForzar(false)}
        title="¿Sortear con referencias sin contar?"
        footer={
          <>
            <button onClick={() => setConfirmarForzar(false)} className={CLASE_BOTON_SECUNDARIO}>
              Cancelar
            </button>
            <button onClick={() => hacerSorteo(true)} disabled={sorteando} className={CLASE_BOTON_PRINCIPAL}>
              {sorteando ? 'Sorteando...' : 'Sortear de todas formas'}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-700">
          El sorteo {ultimo?.numero} tiene {pendientesUltimo} referencias sin contar.
        </p>
        <p className="text-xs text-slate-500">
          No se pierden: se pueden seguir contando en su sorteo desde el Paso 2. Lo recomendado es terminar ese sorteo primero.
        </p>
      </Modal>
    </div>
  );
};
