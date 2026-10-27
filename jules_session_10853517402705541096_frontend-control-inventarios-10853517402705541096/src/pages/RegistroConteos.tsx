import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardCheck, CheckCircle2, Clock, ListChecks, User, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { api } from '../services/api';
import type { ReferenciaSemana } from '../types/inventario';

const SEMANAS_ANIO = 52;
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

export const RegistroConteos: React.FC = () => {
  const [parametros, setParametros] = useSearchParams();
  const progreso = useApi(api.obtenerProgresoConteo);
  const semana = Number(parametros.get('semana')) || progreso.datos?.semana_actual || 1;
  const lista = useApi(() => api.obtenerSemanaConteo(semana), [semana]);

  const [pestana, setPestana] = useState<Pestana>('PENDIENTES');
  const [aviso, setAviso] = useState<MensajeAviso | null>(null);

  // Formulario del conteo
  const [seleccionada, setSeleccionada] = useState<ReferenciaSemana | null>(null);
  const [responsable, setResponsable] = useState(leerResponsableGuardado);
  const [fecha, setFecha] = useState(hoyIso);
  const [cantidadSistema, setCantidadSistema] = useState('');
  const [cantidadContada, setCantidadContada] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cambiarSemana = (nueva: number) => {
    setParametros({ semana: String(Math.min(SEMANAS_ANIO, Math.max(1, nueva))) });
  };

  const abrirFormulario = (fila: ReferenciaSemana) => {
    setSeleccionada(fila);
    setCantidadSistema('');
    setCantidadContada('');
    setFecha(hoyIso());
  };

  const sistemaUsado = cantidadSistema === '' ? seleccionada?.cantidad_sistema_sugerida ?? 0 : Number(cantidadSistema);
  const diferenciaPrevia = cantidadContada === '' ? null : Number(cantidadContada) - sistemaUsado;

  const guardarConteo = async () => {
    if (!seleccionada) return;
    setGuardando(true);
    try {
      try {
        localStorage.setItem(CLAVE_RESPONSABLE, responsable);
      } catch {
        // Si el navegador no deja guardar, solo se pierde el autocompletado del responsable.
      }
      const respuesta = await api.registrarConteo({
        semana,
        sku: seleccionada.sku,
        responsable,
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
            ? `Conteo de ${registro.sku} registrado sin diferencias.`
            : `Conteo de ${registro.sku} registrado con diferencia de ${registro.diferencia} (sistema ${registro.cantidad_sistema}, contada ${registro.cantidad_contada}).`,
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

  const referencias = lista.datos?.referencias ?? [];
  const pendientes = referencias.filter((fila) => !fila.contada_esta_semana);
  const contadas = referencias.filter((fila) => fila.contada_esta_semana);
  const visibles = pestana === 'PENDIENTES' ? pendientes : pestana === 'CONTADAS' ? contadas : referencias;

  const columnas: Column<ReferenciaSemana>[] = [
    { key: 'sku', header: 'SKU', render: (fila) => <EtiquetaSku sku={fila.sku} /> },
    {
      key: 'descripcion',
      header: 'Descripción',
      render: (fila) => <span className="font-semibold text-slate-800">{fila.descripcion}</span>,
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
      key: 'resultado',
      header: 'Sistema / Contada / Diferencia',
      render: (fila) => {
        const registro = fila.registro_semana;
        if (!registro) return <span className="text-xs text-slate-400">Sin contar</span>;
        return (
          <span className="text-xs font-medium">
            {registro.cantidad_sistema} / {registro.cantidad_contada} /{' '}
            <span className={`font-bold ${registro.diferencia === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {registro.diferencia}
            </span>
          </span>
        );
      },
    },
    {
      key: 'acciones',
      header: 'Acción',
      render: (fila) =>
        fila.registro_semana ? (
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <User className="w-3.5 h-3.5" />
            {fila.registro_semana.responsable} · {fila.registro_semana.fecha}
          </span>
        ) : (
          <button
            onClick={() => abrirFormulario(fila)}
            className="px-2.5 py-1 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Registrar conteo
          </button>
        ),
    },
  ];

  const botonPestana = (valor: Pestana, etiqueta: string, cantidad: number, Icono: typeof Clock, activo: string, inactivo: string) => (
    <button
      onClick={() => setPestana(valor)}
      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
        pestana === valor ? `${activo} text-white shadow-xs` : `bg-white ${inactivo} border`
      }`}
    >
      <Icono className="w-3.5 h-3.5" />
      {etiqueta} ({cantidad})
    </button>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <EncabezadoPagina
        titulo="Registro de Conteos"
        descripcion="Lista de referencias que toca contar en la semana. Al registrar un conteo se guarda la cantidad del sistema, la contada y la diferencia. Cuando una referencia llega a 5 conteos sale de la lista."
        icono={ClipboardCheck}
        acciones={
          <div className="flex items-center gap-2">
            <button onClick={() => cambiarSemana(semana - 1)} disabled={semana <= 1} className={CLASE_BOTON_SECUNDARIO}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-slate-800 text-sm">
              Semana {semana}
              {semana === progreso.datos?.semana_actual && <span className="ml-1 text-xs text-indigo-600">(actual)</span>}
            </span>
            <button onClick={() => cambiarSemana(semana + 1)} disabled={semana >= SEMANAS_ANIO} className={CLASE_BOTON_SECUNDARIO}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        }
      />

      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        {botonPestana('PENDIENTES', 'Por contar', pendientes.length, Clock, 'bg-amber-600', 'text-amber-700 hover:bg-amber-50 border-amber-200')}
        {botonPestana('CONTADAS', 'Contadas', contadas.length, CheckCircle2, 'bg-emerald-600', 'text-emerald-700 hover:bg-emerald-50 border-emerald-200')}
        {botonPestana('TODAS', 'Todas', referencias.length, ListChecks, 'bg-indigo-600', 'text-slate-600 hover:bg-slate-100 border-slate-200')}
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
          emptyMessage={pestana === 'PENDIENTES' ? 'No queda nada por contar esta semana.' : 'No hay referencias en esta pestaña.'}
        />
      )}

      {/* Formulario de conteo */}
      <Modal
        isOpen={seleccionada !== null}
        onClose={() => setSeleccionada(null)}
        title={`Registrar conteo — ${seleccionada?.sku ?? ''}`}
        footer={
          <>
            <button onClick={() => setSeleccionada(null)} className={CLASE_BOTON_SECUNDARIO}>
              Cancelar
            </button>
            <button
              onClick={guardarConteo}
              disabled={guardando || !responsable.trim() || cantidadContada === ''}
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
                Ubicación {seleccionada.codigo_ubicacion} · Semana {semana} · Lleva {seleccionada.contados} de 5 conteos
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Responsable</label>
                <input value={responsable} onChange={(e) => setResponsable(e.target.value)} placeholder="Nombre de quien cuenta" className={CLASE_CAMPO} />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Fecha</label>
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={CLASE_CAMPO} />
              </div>
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
                <label className="font-bold text-slate-700 block">Cantidad contada</label>
                <input
                  type="number"
                  min={0}
                  value={cantidadContada}
                  onChange={(e) => setCantidadContada(e.target.value)}
                  autoFocus
                  className={CLASE_CAMPO}
                />
              </div>
            </div>

            {diferenciaPrevia !== null && (
              <div
                className={`p-3 rounded-xl border font-bold text-sm ${
                  diferenciaPrevia === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                Diferencia: {diferenciaPrevia > 0 ? `+${diferenciaPrevia}` : diferenciaPrevia}
              </div>
            )}

            <div className="p-3 bg-blue-50 text-blue-800 border border-blue-200 rounded-xl text-[11px] leading-relaxed">
              El caso no trae stock. Si la cantidad en sistema se deja vacía se usa el valor simulado ({seleccionada.cantidad_sistema_sugerida}),
              que siempre es el mismo para esta referencia.
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
