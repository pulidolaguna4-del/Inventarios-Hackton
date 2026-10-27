import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Shuffle, ShieldCheck, AlertTriangle, ClipboardCheck } from 'lucide-react';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { Aviso, BarraConteos, Cargando, ErrorCarga, EtiquetaSku, type MensajeAviso } from '../components/ui/Estados';
import {
  EncabezadoPagina,
  CLASE_BOTON_PRINCIPAL,
  CLASE_BOTON_SECUNDARIO,
  CLASE_CAMPO,
} from '../components/ui/EncabezadoPagina';
import { useApi } from '../hooks/useApi';
import { api, ErrorApi } from '../services/api';
import type { AvanceSemana, ReferenciaSemana } from '../types/inventario';

const SEMANAS_ANIO = 52;

/** Color de cada semana en la cuadrícula del año según cuánto se ha contado. */
function claseSemana(avance: AvanceSemana, semanaActual: number): string {
  if (avance.registrados >= avance.planeados) return 'bg-emerald-500 text-white border-emerald-500';
  if (avance.registrados > 0) return 'bg-amber-100 text-amber-800 border-amber-300';
  if (avance.semana < semanaActual) return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-white text-slate-600 border-slate-200';
}

export const PlanConteo: React.FC = () => {
  const { datos: progreso, cargando, error, recargar } = useApi(api.obtenerProgresoConteo);
  const [semanaElegida, setSemanaElegida] = useState<number | null>(null);
  const semana = semanaElegida ?? progreso?.semana_actual ?? 1;
  const listaSemana = useApi(() => api.obtenerSemanaConteo(semana), [semana]);

  const [aviso, setAviso] = useState<MensajeAviso | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [semilla, setSemilla] = useState('2026');
  const [pideForzar, setPideForzar] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);

  const cambiarSemana = (nueva: number) => setSemanaElegida(Math.min(SEMANAS_ANIO, Math.max(1, nueva)));

  const abrirModal = () => {
    setSemilla(String(progreso?.semilla ?? 2026));
    setPideForzar(null);
    setModalAbierto(true);
  };

  const generarPlan = async (forzar: boolean) => {
    setGenerando(true);
    try {
      const respuesta = await api.generarPlanConteo(Number(semilla), forzar);
      setModalAbierto(false);
      setAviso({
        tipo: 'exito',
        texto: respuesta.mensaje + (respuesta.respaldo_registros ? ` · Registros anteriores respaldados en ${respuesta.respaldo_registros}` : ''),
      });
      await Promise.all([recargar(), listaSemana.recargar()]);
    } catch (e) {
      // 409: ya hay conteos registrados; se pide confirmación para respaldarlos y empezar de cero.
      if (e instanceof ErrorApi && e.codigo === 409) {
        setPideForzar(e.message);
      } else {
        setModalAbierto(false);
        setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : String(e) });
      }
    } finally {
      setGenerando(false);
    }
  };

  if (cargando && !progreso) return <Cargando texto="Cargando plan anual..." />;
  if (error) return <ErrorCarga mensaje={error} onReintentar={recargar} />;
  if (!progreso) return null;

  const verificacion = progreso.verificacion_plan;
  const tamanos = progreso.avance_semanal.map((fila) => fila.planeados);
  const tamanoMayor = Math.max(...tamanos);
  const tamanoMenor = Math.min(...tamanos);
  const semanasMayores = tamanos.filter((tamano) => tamano === tamanoMayor).length;

  const columnas: Column<ReferenciaSemana>[] = [
    { key: 'sku', header: 'SKU', render: (fila) => <EtiquetaSku sku={fila.sku} /> },
    {
      key: 'descripcion',
      header: 'Descripción',
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
      key: 'semanas_programadas',
      header: 'Semanas del año',
      render: (fila) => <span className="text-xs text-slate-600">{fila.semanas_programadas.join(', ')}</span>,
    },
    {
      key: 'contados',
      header: 'Conteos del año',
      render: (fila) => <BarraConteos contados={fila.contados} conDiferencia={fila.tiene_diferencia} />,
    },
    {
      key: 'estado_semana',
      header: 'Esta semana',
      render: (fila) =>
        fila.contada_esta_semana ? <Badge label="Contada" tono="emerald" /> : <Badge label="Por contar" tono="indigo" />,
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <EncabezadoPagina
        titulo="Plan de Conteo Anual"
        descripcion="El plan se genera una sola vez para todo el año: cada semana se eligen al azar referencias entre las que llevan menos conteos, así todas quedan con exactamente 5. Con la misma semilla siempre sale el mismo plan."
        icono={CalendarDays}
        acciones={
          <button onClick={abrirModal} className={CLASE_BOTON_SECUNDARIO}>
            <Shuffle className="w-4 h-4" />
            Regenerar plan
          </button>
        }
      />

      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />

      {/* Resumen y verificación del plan */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Conteos del año</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {verificacion.referencias} × 5 = {verificacion.total_conteos}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tamaño de las semanas</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {semanasMayores} de {tamanoMayor}
            {tamanoMenor !== tamanoMayor && ` · ${SEMANAS_ANIO - semanasMayores} de ${tamanoMenor}`}
          </p>
        </div>
        <div
          className={`p-4 rounded-2xl border text-sm flex items-start gap-2 ${
            verificacion.valido ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {verificacion.valido ? <ShieldCheck className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <span className="font-medium">
            {verificacion.valido
              ? `Verificado: todas las referencias con ${verificacion.minimo_por_referencia} conteos y ninguna repetida en la misma semana (semilla ${progreso.semilla}).`
              : verificacion.errores.join(' · ')}
          </span>
        </div>
      </div>

      {/* Cuadrícula de las 52 semanas */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="font-bold text-slate-800 text-base">Semanas del año</h3>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500"></span>Completa</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300"></span>En curso</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-50 border border-rose-200"></span>Atrasada</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white border border-slate-200"></span>Pendiente</span>
          </div>
        </div>
        <div className="grid grid-cols-7 sm:grid-cols-13 gap-1.5">
          {progreso.avance_semanal.map((avance) => (
            <button
              key={avance.semana}
              onClick={() => cambiarSemana(avance.semana)}
              title={`Semana ${avance.semana}: ${avance.registrados}/${avance.planeados} contadas`}
              className={`border rounded-lg py-1.5 text-xs font-bold cursor-pointer transition-all ${claseSemana(avance, progreso.semana_actual)} ${
                avance.semana === semana ? 'ring-2 ring-indigo-600 ring-offset-1' : ''
              } ${avance.semana === progreso.semana_actual ? 'underline underline-offset-2' : ''}`}
            >
              {avance.semana}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de la semana elegida */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => cambiarSemana(semana - 1)} disabled={semana <= 1} className={CLASE_BOTON_SECUNDARIO}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h3 className="font-bold text-slate-800 text-lg">
            Semana {semana}
            {semana === progreso.semana_actual && <span className="ml-2 text-xs text-indigo-600">(actual)</span>}
          </h3>
          <button onClick={() => cambiarSemana(semana + 1)} disabled={semana >= SEMANAS_ANIO} className={CLASE_BOTON_SECUNDARIO}>
            <ChevronRight className="w-4 h-4" />
          </button>
          {listaSemana.datos && (
            <span className="text-xs text-slate-500">
              {listaSemana.datos.tamano} referencias · {listaSemana.datos.pendientes} por contar
            </span>
          )}
        </div>
        <Link to={`/registro-conteos?semana=${semana}`} className={CLASE_BOTON_PRINCIPAL}>
          <ClipboardCheck className="w-4 h-4" />
          Registrar conteos de esta semana
        </Link>
      </div>

      {listaSemana.error ? (
        <ErrorCarga mensaje={listaSemana.error} onReintentar={listaSemana.recargar} />
      ) : (
        <DataTable
          columns={columnas}
          data={listaSemana.datos?.referencias ?? []}
          keyExtractor={(fila) => String(fila.sku)}
          isLoading={listaSemana.cargando}
          pageSize={15}
        />
      )}

      {/* Regenerar plan */}
      <Modal
        isOpen={modalAbierto}
        onClose={() => setModalAbierto(false)}
        title="Regenerar plan anual de conteo"
        footer={
          <>
            <button onClick={() => setModalAbierto(false)} className={CLASE_BOTON_SECUNDARIO}>
              Cancelar
            </button>
            {pideForzar ? (
              <button
                onClick={() => generarPlan(true)}
                disabled={generando}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {generando ? 'Generando...' : 'Respaldar registros y regenerar'}
              </button>
            ) : (
              <button onClick={() => generarPlan(false)} disabled={generando || !semilla} className={CLASE_BOTON_PRINCIPAL}>
                {generando ? 'Generando...' : 'Generar plan'}
              </button>
            )}
          </>
        }
      >
        <label className="text-xs font-bold text-slate-700 block mb-1.5">Semilla</label>
        <input
          type="number"
          value={semilla}
          onChange={(e) => {
            setSemilla(e.target.value);
            setPideForzar(null);
          }}
          className={CLASE_CAMPO}
        />
        <p className="text-[11px] text-slate-500 leading-relaxed">
          La misma semilla siempre produce el mismo plan, para poder repetirlo en la sustentación.
        </p>
        {pideForzar && (
          <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs leading-relaxed">
            <strong>Atención:</strong> {pideForzar}
          </div>
        )}
      </Modal>
    </div>
  );
};
