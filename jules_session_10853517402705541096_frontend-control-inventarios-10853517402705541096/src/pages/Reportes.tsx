import React, { useState } from 'react';
import { BarChart3, FileSpreadsheet, Download, Award, AlertTriangle, ClipboardList } from 'lucide-react';
import { DataTable, type Column } from '../components/ui/DataTable';
import { StatCard } from '../components/ui/StatCard';
import { ModalExportar, type SolicitudExportacion } from '../components/ui/ModalExportar';
import { Aviso, Cargando, ErrorCarga, EtiquetaSku, type MensajeAviso } from '../components/ui/Estados';
import { EncabezadoPagina, CLASE_CAMPO } from '../components/ui/EncabezadoPagina';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import type { RegistroConteo } from '../types/inventario';

async function cargarReportes() {
  const [progreso, registros, resumen] = await Promise.all([
    api.obtenerProgresoConteo(),
    api.obtenerRegistrosConteo(),
    api.obtenerResumen(),
  ]);
  return { progreso, registros: registros.registros, resumen };
}

export const Reportes: React.FC = () => {
  const { datos, cargando, error, recargar } = useApi(cargarReportes);
  const [solicitud, setSolicitud] = useState<SolicitudExportacion | null>(null);
  const [aviso, setAviso] = useState<MensajeAviso | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [soloDiferencias, setSoloDiferencias] = useState('ALL');
  const [sorteoExportar, setSorteoExportar] = useState('');
  const [fechaExportar, setFechaExportar] = useState('');

  if (cargando && !datos) return <Cargando texto="Cargando reportes..." />;
  if (error) return <ErrorCarga mensaje={error} onReintentar={recargar} />;
  if (!datos) return null;

  const { progreso, registros, resumen } = datos;
  const fechaPedidos = fechaExportar || resumen.fechas_disponibles[0];
  const texto = busqueda.trim().toLowerCase();
  const registrosVisibles = registros.filter(
    (registro) =>
      (!texto || String(registro.sku).includes(texto) || registro.responsable.toLowerCase().includes(texto)) &&
      (soloDiferencias === 'ALL' || registro.diferencia !== 0),
  );

  // Cada exportación: nombre de entrega según el reglamento (Tarea 1, 6 y 8) o un nombre libre.
  const exportaciones: (SolicitudExportacion & { descripcion: string; control?: React.ReactNode })[] = [
    {
      tipo: 'maestro',
      titulo: 'Maestro de ubicaciones (Tarea 1)',
      nombrePorDefecto: 'Día2_Ejercicio1',
      descripcion: 'SKU, popularidad, clase ABC y ubicación asignada.',
    },
    {
      tipo: 'conteo',
      titulo: sorteoExportar ? `Sorteo de conteo #${sorteoExportar}` : 'Sorteos de conteo del año (Tarea 8)',
      nombrePorDefecto: sorteoExportar ? `conteo_sorteo_${sorteoExportar}` : 'Día2_Ejercicio8',
      descripcion: 'Referencias elegidas al azar en cada sorteo, con su ubicación.',
      extra: { sorteo: sorteoExportar || undefined },
      control: (
        <input
          type="number"
          min={1}
          max={progreso.sorteo_actual ?? 1}
          value={sorteoExportar}
          onChange={(e) => setSorteoExportar(e.target.value)}
          placeholder="Todos los sorteos"
          className={CLASE_CAMPO}
        />
      ),
    },
    {
      tipo: 'registros_conteo',
      titulo: 'Registros de conteo',
      nombrePorDefecto: 'registros_conteo',
      descripcion: 'Todos los conteos hechos, con cantidades y diferencias.',
    },
    {
      tipo: 'picking',
      titulo: 'Lista de despacho (Tarea 6)',
      nombrePorDefecto: 'Día2_Ejercicio6',
      descripcion: 'Trayectos del pedido de prueba con distancias y tiempos.',
    },
    {
      tipo: 'pedidos',
      titulo: `Pedidos del ${fechaPedidos}`,
      nombrePorDefecto: `pedidos_${fechaPedidos}`,
      descripcion: 'Pedidos de Arauca de una fecha con su estado.',
      extra: { fecha: fechaPedidos },
      control: (
        <select value={fechaPedidos} onChange={(e) => setFechaExportar(e.target.value)} className={CLASE_CAMPO}>
          {resumen.fechas_disponibles.map((fecha) => (
            <option key={fecha} value={fecha}>
              {fecha}
            </option>
          ))}
        </select>
      ),
    },
  ];

  const columnas: Column<RegistroConteo>[] = [
    { key: 'fecha', header: 'Fecha' },
    { key: 'sorteo', header: 'Sorteo', render: (registro) => `#${registro.sorteo}` },
    { key: 'semana', header: 'Semana' },
    { key: 'sku', header: 'SKU', render: (registro) => <EtiquetaSku sku={registro.sku} /> },
    {
      key: 'codigo_ubicacion',
      header: 'Ubicación',
      render: (registro) => <span className="font-mono text-xs">{registro.codigo_ubicacion ?? '—'}</span>,
    },
    { key: 'responsable', header: 'Responsable' },
    { key: 'cantidad_sistema', header: 'Sistema', className: 'text-right' },
    { key: 'cantidad_contada', header: 'Contada', className: 'text-right' },
    {
      key: 'diferencia',
      header: 'Diferencia',
      className: 'text-right',
      render: (registro) => (
        <span className={`font-bold ${registro.diferencia === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{registro.diferencia}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <EncabezadoPagina
        titulo="Reportes"
        seccion="INVENTARIO / REPORTES Y ARCHIVOS"
        descripcion="Cumplimiento del plan de conteo, historial de registros y archivos CSV para entregar. Cada exportación se descarga y además queda guardada en la carpeta salidas/ del backend."
        icono={BarChart3}
      />

      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Cumplimiento a la fecha"
          value={`${progreso.cumplimiento}%`}
          description={`${progreso.conteos_registrados} de ${progreso.conteos_totales} conteos del año`}
          icon={Award}
          colorTheme="amber"
        />
        <StatCard
          title="Contados / sorteados"
          value={`${progreso.conteos_registrados} / ${progreso.conteos_sorteados}`}
          description={`${progreso.referencias_completas} referencias completas (5/5)`}
          icon={ClipboardList}
          colorTheme="indigo"
        />
        <StatCard
          title="Conteos con diferencia"
          value={registros.filter((registro) => registro.diferencia !== 0).length}
          description={`${progreso.referencias_con_diferencia} referencias afectadas`}
          icon={AlertTriangle}
          colorTheme="rose"
        />
      </div>

      {/* Exportaciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {exportaciones.map((exportacion) => (
          <div key={exportacion.tipo} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg border bg-emerald-50 text-emerald-600 border-emerald-100">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm">{exportacion.titulo}</p>
                <p className="text-xs text-slate-500">{exportacion.descripcion}</p>
              </div>
            </div>
            {exportacion.control}
            <button
              onClick={() => setSolicitud(exportacion)}
              className="mt-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
          </div>
        ))}
      </div>

      {/* Historial de registros */}
      <div className="space-y-3">
        <h3 className="font-bold text-slate-800 text-base">Historial de conteos registrados</h3>
        <DataTable
          columns={columnas}
          data={registrosVisibles}
          keyExtractor={(registro) => `${registro.sorteo}-${registro.sku}`}
          searchPlaceholder="Buscar por SKU o responsable..."
          onSearchChange={setBusqueda}
          statuses={[{ value: 'DIFERENCIA', label: 'Solo con diferencia' }]}
          selectedStatus={soloDiferencias}
          onStatusChange={setSoloDiferencias}
          pageSize={15}
          emptyMessage="Todavía no hay conteos registrados."
        />
      </div>

      <ModalExportar
        key={solicitud ? `${solicitud.tipo}-${solicitud.nombrePorDefecto}` : 'cerrado'}
        solicitud={solicitud}
        onCerrar={() => setSolicitud(null)}
        onTerminar={(mensaje, esError) => setAviso({ tipo: esError ? 'error' : 'exito', texto: mensaje })}
      />
    </div>
  );
};
