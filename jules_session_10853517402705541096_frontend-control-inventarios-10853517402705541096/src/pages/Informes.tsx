import React, { useState } from 'react';
import { BarChart3, Download, FileSpreadsheet, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Aviso, Cargando, ErrorCarga, type MensajeAviso } from '../components/ui/Estados';
import { EncabezadoPagina, CLASE_BOTON_SECUNDARIO, CLASE_CAMPO } from '../components/ui/EncabezadoPagina';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { ARCHIVOS_ENTREGA } from '../utils/entregas';
import type { TipoExportacion } from '../types/inventario';

async function cargarInformes() {
  const [progreso, registros, resumen] = await Promise.all([api.obtenerProgresoConteo(), api.obtenerRegistrosConteo(), api.obtenerResumen()]);
  return { progreso, registros: registros.registros, resumen };
}

/** Indicador secundario: título corto, valor grande y una línea de detalle. */
const Indicador: React.FC<{ titulo: string; valor: string; detalle: string; alerta?: boolean }> = ({ titulo, valor, detalle, alerta }) => (
  <div className="flex flex-col gap-1 p-4 bg-slate-50 border border-slate-200">
    <span className="font-mono text-[11px] tracking-[0.1em] text-slate-500">{titulo}</span>
    <span className={`font-display text-3xl font-extrabold tabular-nums leading-none ${alerta ? 'text-rose-600' : 'text-tinta'}`}>{valor}</span>
    <span className="text-xs text-slate-500">{detalle}</span>
  </div>
);

/**
 * Paso 4 del flujo: los indicadores del año (con el cumplimiento como número grande), la
 * verificación del sorteo y las descargas con el nombre exacto de entrega.
 */
export const Informes: React.FC = () => {
  const { datos, cargando, error, recargar } = useApi(cargarInformes);
  const [aviso, setAviso] = useState<MensajeAviso | null>(null);
  const [descargando, setDescargando] = useState<string | null>(null);
  const [fechaElegida, setFechaElegida] = useState<string | null>(null);

  if (cargando && !datos) return <Cargando texto="Cargando informes..." />;
  if (error) return <ErrorCarga mensaje={error} onReintentar={recargar} />;
  if (!datos) return null;

  const { progreso, registros, resumen } = datos;
  const { verificacion } = progreso;
  const conteosConDiferencia = registros.filter((registro) => registro.diferencia !== 0).length;
  const fechaPedidos = fechaElegida ?? resumen.fechas_disponibles[0];

  const descargar = async (tipo: TipoExportacion, nombre: string, extra: Record<string, string | undefined> = {}) => {
    setDescargando(nombre);
    try {
      const archivo = await api.descargarCsv(tipo, nombre, extra);
      setAviso({ tipo: 'exito', texto: `Descargado ${archivo}. También quedó guardado en la carpeta salidas/ del backend.` });
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setDescargando(null);
    }
  };

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo="Informes"
        seccion="PASO 4 · RESULTADOS Y ENTREGA"
        descripcion="Cumplimiento del conteo cíclico del año y los archivos para entregar al jurado. Cada descarga queda también en la carpeta salidas/ del backend."
        icono={BarChart3}
      />

      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />

      {/* Indicadores del año */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)] gap-4">
        <div className="flex flex-col justify-between gap-3 p-6 bg-tinta text-papel border-b-[3px] border-senal">
          <span className="font-mono text-xs tracking-[0.12em] text-[#b5b0a4]">CUMPLIMIENTO DEL AÑO</span>
          <span className="titulo-senal text-7xl sm:text-8xl leading-none tabular-nums">{progreso.cumplimiento}%</span>
          <span className="text-sm text-[#b5b0a4]">
            {progreso.conteos_registrados} de {progreso.conteos_totales} conteos hechos ({progreso.referencias} referencias ×{' '}
            {progreso.conteos_por_anio} al año)
          </span>
          <span className="block h-2 bg-[#2a2b30]" aria-hidden="true">
            <span className="block h-full bg-senal" style={{ width: `${Math.min(progreso.cumplimiento, 100)}%` }} />
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Indicador
            titulo="SORTEADOS"
            valor={`${progreso.conteos_sorteados}/${progreso.conteos_totales}`}
            detalle={`${progreso.sorteos.length} sorteos · ${progreso.pendientes_por_contar} por contar`}
          />
          <Indicador
            titulo="REFERENCIAS COMPLETAS"
            valor={`${progreso.referencias_completas}/${progreso.referencias}`}
            detalle={`Ya tienen sus ${progreso.conteos_por_anio} conteos`}
          />
          <Indicador
            titulo="CON DIFERENCIA"
            valor={String(conteosConDiferencia)}
            detalle={`conteos · ${progreso.referencias_con_diferencia} referencias afectadas`}
            alerta={conteosConDiferencia > 0}
          />
        </div>
      </div>

      {/* Verificación del sorteo */}
      <div
        className={`p-3 border text-sm flex items-start gap-2 ${
          verificacion.valido ? 'bg-slate-50 border-tinta text-tinta' : 'bg-rose-50 border-rose-300 text-rose-800'
        }`}
      >
        {verificacion.valido ? <ShieldCheck className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
        <span className="font-medium">
          {verificacion.valido
            ? `Verificado: ninguna referencia se repite en un mismo sorteo y ninguna pasa de ${progreso.conteos_por_anio} conteos. ` +
              (verificacion.completo
                ? `Las ${verificacion.referencias} referencias ya salieron exactamente ${progreso.conteos_por_anio} veces.`
                : `Cada referencia ha salido entre ${verificacion.minimo_por_referencia} y ${verificacion.maximo_por_referencia} veces.`)
            : verificacion.errores.join(' · ')}
        </span>
      </div>

      {/* Archivos de entrega */}
      <div className="space-y-3">
        <div>
          <h3 className="font-bold text-base">Archivos de entrega</h3>
          <p className="text-xs text-slate-500">
            El nombre sigue la estructura del reglamento, <strong>Día&lt;N&gt;_Ejercicio&lt;N&gt;</strong>. Si se cambia, el jurado no lo
            califica.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ARCHIVOS_ENTREGA.map((archivo) => (
            <button
              key={archivo.nombre}
              type="button"
              onClick={() => descargar(archivo.tipo, archivo.nombre)}
              disabled={descargando !== null}
              className="group flex flex-col items-start gap-2 p-5 text-left bg-tinta text-papel border-b-[3px] border-senal hover:bg-slate-800 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
            >
              <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.1em] text-[#b5b0a4]">
                <FileSpreadsheet className="w-4 h-4" />
                {archivo.titulo.toUpperCase()}
              </span>
              <span className="titulo-senal text-2xl normal-case">{archivo.nombre}.csv</span>
              <span className="text-xs text-[#b5b0a4]">{archivo.descripcion}</span>
              <span className="mt-1 flex items-center gap-1.5 text-xs font-bold text-senal">
                <Download className="w-4 h-4" />
                {descargando === archivo.nombre ? 'Descargando…' : 'Descargar'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Descargas secundarias */}
      <div className="space-y-3 pt-2">
        <h3 className="font-bold text-sm text-slate-600">Otras descargas</h3>
        <div className="flex flex-wrap items-end gap-3">
          <button
            type="button"
            onClick={() => descargar('registros_conteo', 'registros_conteo')}
            disabled={descargando !== null}
            className={CLASE_BOTON_SECUNDARIO}
          >
            <Download className="w-4 h-4" />
            Registros de conteo ({registros.length})
          </button>
          <div className="flex items-end gap-2">
            <select
              value={fechaPedidos}
              onChange={(e) => setFechaElegida(e.target.value)}
              aria-label="Fecha de los pedidos"
              className={`${CLASE_CAMPO} w-auto h-10 py-0`}
            >
              {resumen.fechas_disponibles.map((fecha) => (
                <option key={fecha} value={fecha}>
                  {fecha}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => descargar('pedidos', `pedidos_${fechaPedidos}`, { fecha: fechaPedidos })}
              disabled={descargando !== null}
              className={CLASE_BOTON_SECUNDARIO}
            >
              <Download className="w-4 h-4" />
              Pedidos del día
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
