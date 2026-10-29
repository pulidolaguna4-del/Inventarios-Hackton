import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ClipboardCheck,
  CheckCircle2,
  Clock,
  ListChecks,
  User,
  ChevronLeft,
  ChevronRight,
  CalendarRange,
  Shuffle,
  PartyPopper,
} from 'lucide-react';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { Aviso, BarraConteos, Cargando, ErrorCarga, EtiquetaSku, type MensajeAviso } from '../components/ui/Estados';
import {
  EncabezadoPagina,
  CLASE_BOTON_PRINCIPAL,
  CLASE_BOTON_SECUNDARIO,
  CLASE_CAMPO,
} from '../components/ui/EncabezadoPagina';
import { useApi } from '../hooks/useApi';
import { useProgreso } from '../hooks/ProgresoContexto';
import { api, ErrorApi } from '../services/api';
import type { ReferenciaSorteo } from '../types/inventario';

const CLAVE_RESPONSABLE = 'inventarios_responsable';

type Pestana = 'PENDIENTES' | 'CONTADAS' | 'TODAS';

function hoyIso(): string {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

function leerResponsableGuardado(): string {
  try {
    return localStorage.getItem(CLAVE_RESPONSABLE) ?? '';
  } catch {
    return '';
  }
}

function guardarResponsable(nombre: string) {
  try {
    localStorage.setItem(CLAVE_RESPONSABLE, nombre);
  } catch {
    // Si el navegador no deja guardar, solo se pierde el autocompletado del responsable.
  }
}

/** Fecha y hora del sorteo para mostrar: '2026-10-28T10:20:17' -> '2026-10-28 10:20'. */
function formatearFechaHora(fechaHora: string): string {
  return fechaHora.replace('T', ' ').slice(0, 16);
}

/**
 * Pantalla principal del conteo cíclico: el botón "Sortear" elige referencias al azar
 * (ninguna pasa de 5 conteos en el año) y aquí se registra cada conteo con su responsable.
 */
export const ConteoAlAzar: React.FC = () => {
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

  // Sorteo
  const [cantidadElegida, setCantidadElegida] = useState<string | null>(null);
  const [sorteando, setSorteando] = useState(false);
  const [confirmarSorteo, setConfirmarSorteo] = useState<string | null>(null);

  // Formulario del conteo
  const [seleccionada, setSeleccionada] = useState<ReferenciaSorteo | null>(null);
  const [fecha, setFecha] = useState(hoyIso);
  const [cantidadSistema, setCantidadSistema] = useState('');
  const [cantidadContada, setCantidadContada] = useState('');
  const [guardando, setGuardando] = useState(false);

  const irASorteo = (numero: number) => setParametros({ sorteo: String(numero) });

  const cambiarResponsable = (nombre: string) => {
    setResponsable(nombre);
    guardarResponsable(nombre);
  };

  const hacerSorteo = async (forzar: boolean) => {
    setSorteando(true);
    try {
      const resultado = await api.sortear(Number(cantidadTexto), forzar);
      setConfirmarSorteo(null);
      setAviso({ tipo: 'exito', texto: resultado.mensaje });
      setPestana('PENDIENTES');
      await progreso.recargar();
      irASorteo(resultado.sorteo);
    } catch (e) {
      // 409: el sorteo anterior tiene referencias sin contar; se pide confirmación.
      if (e instanceof ErrorApi && e.codigo === 409) {
        setConfirmarSorteo(e.message);
      } else {
        setConfirmarSorteo(null);
        setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : String(e) });
      }
    } finally {
      setSorteando(false);
    }
  };

  const abrirFormulario = (fila: ReferenciaSorteo) => {
    setSeleccionada(fila);
    setCantidadSistema('');
    setCantidadContada('');
    setFecha(hoyIso());
  };

  const sistemaUsado = cantidadSistema === '' ? seleccionada?.cantidad_sistema_sugerida ?? 0 : Number(cantidadSistema);
  const diferenciaPrevia = cantidadContada === '' ? null : Number(cantidadContada) - sistemaUsado;

  const guardarConteo = async () => {
    if (!seleccionada || !numeroSorteo) return;
    setGuardando(true);
    try {
      const respuesta = await api.registrarConteo({
        sorteo: numeroSorteo,
        sku: seleccionada.sku,
        responsable: responsable.trim(),
        fecha,
        cantidad_contada: Number(cantidadContada),
        cantidad_sistema: cantidadSistema === '' ? null : Number(cantidadSistema),
      });
      const registro = respuesta.registro;
      setSeleccionada(null);
      setAviso({
        tipo: registro.diferencia === 0 ? 'exito' : 'error',
        texto:
          registro.diferencia === 0
            ? `${registro.responsable} contó ${registro.sku} sin diferencias.`
            : `${registro.responsable} contó ${registro.sku} con diferencia de ${registro.diferencia} (sistema ${registro.cantidad_sistema}, contada ${registro.cantidad_contada}).`,
      });
      await Promise.all([lista.recargar(), progreso.recargar()]);
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setGuardando(false);
    }
  };

  if (progreso.cargando && !progreso.datos) return <Cargando texto="Cargando conteos..." />;
  if (progreso.error) return <ErrorCarga mensaje={progreso.error} onReintentar={progreso.recargar} />;
  if (!progreso.datos) return null;

  const resumen = progreso.datos;
  const cantidadTexto = cantidadElegida ?? String(resumen.cantidad_sorteo_por_defecto);
  const cantidadValida = Number.isInteger(Number(cantidadTexto)) && Number(cantidadTexto) >= 1;
  const anioCompleto = resumen.referencias_disponibles === 0;
  const sinResponsable = !responsable.trim();

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
      key: 'responsable',
      header: 'Responsable',
      render: (fila) =>
        fila.registro_sorteo ? (
          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-slate-400" />
            {fila.registro_sorteo.responsable}
            <span className="font-normal text-slate-400">· {fila.registro_sorteo.fecha}</span>
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      key: 'resultado',
      header: 'Resultado',
      render: (fila) => {
        const registro = fila.registro_sorteo;
        if (!registro) {
          return (
            <button
              onClick={() => abrirFormulario(fila)}
              disabled={sinResponsable}
              title={sinResponsable ? 'Primero escribe quién cuenta' : undefined}
              className="px-2.5 py-1 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Contar
            </button>
          );
        }
        return registro.diferencia === 0 ? (
          <span className="text-xs font-bold text-emerald-600">✓ Cuadra ({registro.cantidad_contada})</span>
        ) : (
          <span className="text-xs font-bold text-rose-600">
            Diferencia {registro.diferencia > 0 ? `+${registro.diferencia}` : registro.diferencia}
            <span className="font-normal text-slate-500">
              {' '}
              (sistema {registro.cantidad_sistema}, contada {registro.cantidad_contada})
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
        titulo="Conteo al azar"
        seccion="INVENTARIO / CONTEO CÍCLICO"
        descripcion={`Presiona "Sortear" para que el sistema elija referencias al azar. Primero salen las que llevan menos conteos y ninguna pasa de ${resumen.conteos_por_anio} en el año: al llegar a ${resumen.conteos_por_anio} sale de la lista.`}
        icono={ClipboardCheck}
        acciones={
          numeroSorteo && sorteoActual ? (
            <div className="flex items-center gap-2">
              <button onClick={() => irASorteo(numeroSorteo - 1)} disabled={numeroSorteo <= 1} className={CLASE_BOTON_SECUNDARIO}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-slate-800 text-sm">
                Sorteo {numeroSorteo} <span className="font-medium text-slate-400">de {sorteoActual}</span>
              </span>
              <button
                onClick={() => irASorteo(numeroSorteo + 1)}
                disabled={numeroSorteo >= sorteoActual}
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
        <div className={`p-5 border ${sinResponsable ? 'bg-amber-50 border-amber-400' : 'bg-slate-50 border-slate-200'}`}>
          <label htmlFor="responsable" className="font-mono text-xs tracking-[0.1em] text-slate-600 flex items-center gap-1.5 mb-2.5">
            <User className="w-3.5 h-3.5" />
            QUIÉN ESTÁ CONTANDO
          </label>
          <input
            id="responsable"
            value={responsable}
            onChange={(e) => cambiarResponsable(e.target.value)}
            placeholder="Nombre del responsable"
            className="w-full h-[52px] border-0 border-b-2 border-tinta bg-transparent font-display text-2xl font-bold text-tinta placeholder:text-slate-400 focus:outline-hidden focus:border-senal"
          />
          {sinResponsable && <p className="text-[11px] text-amber-700 mt-1.5">Escribe un nombre para poder registrar conteos.</p>}
        </div>

        <div className="p-5 bg-tinta text-papel">
          {anioCompleto ? (
            <div className="flex items-start gap-2 text-green-300">
              <PartyPopper className="w-5 h-5 shrink-0" />
              <p className="text-sm font-semibold">
                Todas las referencias ya salieron {resumen.conteos_por_anio} veces este año. Para empezar un año nuevo usa "Reiniciar
                conteo" en Conteos del año.
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
                  className="w-24 h-[52px] border border-[#45474d] bg-[#222327] text-papel font-mono text-xl font-semibold text-center focus:outline-hidden focus:border-senal"
                />
                <button
                  onClick={() => hacerSorteo(false)}
                  disabled={sorteando || !cantidadValida}
                  className="titulo-senal flex-1 h-[52px] flex items-center justify-center gap-2.5 bg-senal hover:bg-senal-claro text-tinta text-lg tracking-[0.04em] transition-all active:translate-y-px cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Shuffle className="w-5 h-5" />
                  {sorteando ? 'Sorteando...' : `Sortear ${cantidadValida ? cantidadTexto : ''} al azar`}
                </button>
              </div>
              <p className="text-xs text-[#b5b0a4] mt-2">
                Faltan {resumen.por_sortear} de {resumen.conteos_totales} conteos del año por sortear · Hay{' '}
                {resumen.referencias_disponibles} referencias disponibles.
              </p>
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
              emptyMessage={pestana === 'PENDIENTES' ? '¡Listo! No queda nada por contar en este sorteo.' : 'No hay referencias en esta pestaña.'}
            />
          )}
        </>
      )}

      {/* Confirmación: el sorteo anterior tiene pendientes */}
      <Modal
        isOpen={confirmarSorteo !== null}
        onClose={() => setConfirmarSorteo(null)}
        title="Hay referencias sin contar"
        footer={
          <>
            <button onClick={() => setConfirmarSorteo(null)} className={CLASE_BOTON_SECUNDARIO}>
              Cancelar
            </button>
            <button onClick={() => hacerSorteo(true)} disabled={sorteando} className={CLASE_BOTON_PRINCIPAL}>
              {sorteando ? 'Sorteando...' : 'Sortear de todas formas'}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-700">{confirmarSorteo}</p>
        <p className="text-xs text-slate-500">
          Las referencias pendientes no se pierden: se pueden seguir contando en su sorteo con las flechas de arriba.
        </p>
      </Modal>

      {/* Formulario de conteo */}
      <Modal
        isOpen={seleccionada !== null}
        onClose={() => setSeleccionada(null)}
        title={`Contar ${seleccionada?.sku ?? ''}`}
        footer={
          <>
            <button onClick={() => setSeleccionada(null)} className={CLASE_BOTON_SECUNDARIO}>
              Cancelar
            </button>
            <button
              onClick={guardarConteo}
              disabled={guardando || sinResponsable || cantidadContada === ''}
              className={CLASE_BOTON_PRINCIPAL}
            >
              {guardando ? 'Guardando...' : 'Guardar conteo'}
            </button>
          </>
        }
      >
        {seleccionada && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <p className="font-bold text-slate-800 text-sm">{seleccionada.descripcion}</p>
              <p className="text-slate-500 mt-0.5">
                Ubicación {seleccionada.codigo_ubicacion} · Lleva {seleccionada.contados} de {resumen.conteos_por_anio} conteos ·
                Responsable: <strong className="text-slate-700">{responsable}</strong>
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">¿Cuántas unidades contaste?</label>
              <input
                type="number"
                min={0}
                value={cantidadContada}
                onChange={(e) => setCantidadContada(e.target.value)}
                autoFocus
                className={`${CLASE_CAMPO} text-lg`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Cantidad en sistema</label>
                <input
                  type="number"
                  min={0}
                  value={cantidadSistema}
                  onChange={(e) => setCantidadSistema(e.target.value)}
                  placeholder={String(seleccionada.cantidad_sistema_sugerida)}
                  className={CLASE_CAMPO}
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Fecha</label>
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={CLASE_CAMPO} />
              </div>
            </div>

            {diferenciaPrevia !== null && (
              <div
                className={`p-3 rounded-xl border font-bold text-sm ${
                  diferenciaPrevia === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                {diferenciaPrevia === 0
                  ? '✓ Cuadra con el sistema'
                  : `Diferencia: ${diferenciaPrevia > 0 ? `+${diferenciaPrevia}` : diferenciaPrevia}`}
              </div>
            )}

            <p className="text-[11px] text-slate-500 leading-relaxed">
              El caso no trae stock: si la cantidad en sistema se deja vacía se usa el valor simulado (
              {seleccionada.cantidad_sistema_sugerida}).
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};
