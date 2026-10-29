import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Truck, ArrowRight, Eye, CalendarDays } from 'lucide-react';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { BadgeEstadoPedido } from '../components/ui/Badge';
import { Aviso, Cargando, ErrorCarga, type MensajeAviso } from '../components/ui/Estados';
import { formatearNumero } from '../utils/formato';
import { EncabezadoPagina } from '../components/ui/EncabezadoPagina';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import type { EstadoPedido, Pedido } from '../types/inventario';

export const Pedidos: React.FC = () => {
  const resumen = useApi(api.obtenerResumen);
  // ?fecha=AAAA-MM-DD llega desde el origen "Pedidos del día" del Paso 2.
  const [parametros] = useSearchParams();
  const [fechaElegida, setFechaElegida] = useState<string | null>(parametros.get('fecha'));
  const fecha = fechaElegida ?? resumen.datos?.fechas_disponibles[0];
  const pedidos = useApi(() => (fecha ? api.obtenerPedidos(fecha) : Promise.resolve(null)), [fecha]);

  const [filtroEstado, setFiltroEstado] = useState<EstadoPedido | 'TODOS'>('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [aviso, setAviso] = useState<MensajeAviso | null>(null);
  const [avanzando, setAvanzando] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<Pedido | null>(null);

  const avanzar = async (pedido: Pedido) => {
    if (!pedido.siguiente_estado) return;
    setAvanzando(pedido.id_pedido);
    try {
      const respuesta = await api.avanzarPedido(pedido.id_pedido, pedido.siguiente_estado);
      setAviso({ tipo: 'exito', texto: `Pedido ${respuesta.id_pedido}: ahora está "${respuesta.estado}".` });
      await pedidos.recargar();
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setAvanzando(null);
    }
  };

  if (resumen.cargando && !resumen.datos) return <Cargando texto="Cargando pedidos..." />;
  if (resumen.error) return <ErrorCarga mensaje={resumen.error} onReintentar={resumen.recargar} />;
  if (!resumen.datos) return null;

  const respuesta = pedidos.datos;
  const texto = busqueda.trim().toLowerCase();
  const visibles = (respuesta?.pedidos ?? []).filter(
    (pedido) =>
      (filtroEstado === 'TODOS' || pedido.estado === filtroEstado) &&
      (!texto || String(pedido.id_pedido).includes(texto) || pedido.lineas.some((linea) => String(linea.sku).includes(texto))),
  );

  const columnas: Column<Pedido>[] = [
    {
      key: 'id_pedido',
      header: 'Pedido',
      render: (pedido) => <span className="font-mono font-bold text-slate-800">{pedido.id_pedido}</span>,
    },
    { key: 'cliente', header: 'Cliente' },
    {
      key: 'productos',
      header: 'Productos',
      render: (pedido) => (
        <span className="text-xs text-slate-600">
          {pedido.lineas.slice(0, 3).map((linea) => `${linea.sku} ×${linea.cantidad}`).join(', ')}
          {pedido.lineas.length > 3 && ` y ${pedido.lineas.length - 3} más`}
        </span>
      ),
    },
    {
      key: 'unidades',
      header: 'Unidades',
      className: 'text-right',
      render: (pedido) => formatearNumero(pedido.unidades),
    },
    { key: 'estado', header: 'Estado', render: (pedido) => <BadgeEstadoPedido estado={pedido.estado} /> },
    {
      key: 'ultimo_cambio',
      header: 'Último cambio',
      render: (pedido) => <span className="text-xs text-slate-500">{pedido.ultimo_cambio?.replace('T', ' ') ?? '—'}</span>,
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (pedido) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setDetalle(pedido)}
            className="p-1.5 text-slate-500 border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
            title="Ver detalle e historial"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {pedido.siguiente_estado ? (
            <button
              onClick={() => avanzar(pedido)}
              disabled={avanzando === pedido.id_pedido}
              className="px-2.5 py-1 text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 rounded-lg cursor-pointer flex items-center gap-1 disabled:opacity-50"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              {pedido.siguiente_estado}
            </button>
          ) : (
            <span className="text-xs font-bold text-emerald-600">Finalizado</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <EncabezadoPagina
        titulo="Pedidos"
        seccion="INVENTARIO / PEDIDOS DE ARAUCA"
        descripcion="Estado de cada pedido de Arauca. Solo se puede avanzar al estado siguiente: Pendiente → En alistamiento → Alistado → En entrega → Entregado. Cada cambio queda con su fecha y hora."
        icono={Truck}
        acciones={
          <label className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-600">
            <CalendarDays className="w-4 h-4 text-slate-400" />
            Fecha
            <select
              value={fecha ?? ''}
              onChange={(e) => setFechaElegida(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-hidden cursor-pointer"
            >
              {resumen.datos.fechas_disponibles.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
          </label>
        }
      />

      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />

      {/* Conteo por estado, que también sirve de filtro */}
      {respuesta && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => setFiltroEstado('TODOS')}
            className={`p-3 rounded-xl border text-left cursor-pointer ${
              filtroEstado === 'TODOS' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <p className="text-xl font-bold">{respuesta.pedidos.length}</p>
            <p className="text-xs opacity-80">Todos</p>
          </button>
          {respuesta.estados.map((estado) => (
            <button
              key={estado}
              onClick={() => setFiltroEstado(estado)}
              className={`p-3 rounded-xl border text-left cursor-pointer ${
                filtroEstado === estado ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <p className="text-xl font-bold">{respuesta.conteo_por_estado[estado]}</p>
              <p className="text-xs opacity-80">{estado}</p>
            </button>
          ))}
        </div>
      )}

      {pedidos.error ? (
        <ErrorCarga mensaje={pedidos.error} onReintentar={pedidos.recargar} />
      ) : (
        <DataTable
          columns={columnas}
          data={visibles}
          keyExtractor={(pedido) => String(pedido.id_pedido)}
          searchPlaceholder="Buscar por número de pedido o SKU..."
          onSearchChange={setBusqueda}
          isLoading={pedidos.cargando}
          pageSize={15}
          emptyMessage="No hay pedidos con ese filtro."
        />
      )}

      {/* Detalle del pedido */}
      <Modal isOpen={detalle !== null} onClose={() => setDetalle(null)} title={`Pedido ${detalle?.id_pedido ?? ''}`} maxWidth="xl">
        {detalle && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <span>
                Cliente <strong>{detalle.cliente}</strong> · {detalle.fecha} · {detalle.referencias} referencias ·{' '}
                {formatearNumero(detalle.unidades)} unidades
              </span>
              <BadgeEstadoPedido estado={detalle.estado} />
            </div>
            <table className="w-full text-left border border-slate-200">
              <thead className="bg-slate-100 text-slate-600 uppercase">
                <tr>
                  <th className="p-2">SKU</th>
                  <th className="p-2">Descripción</th>
                  <th className="p-2 text-right">Cantidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detalle.lineas.map((linea, indice) => (
                  <tr key={`${linea.sku}-${indice}`}>
                    <td className="p-2 font-mono font-bold">{linea.sku}</td>
                    <td className="p-2">{linea.descripcion}</td>
                    <td className="p-2 text-right">{formatearNumero(linea.cantidad)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div>
              <p className="font-bold text-slate-700 mb-1.5">Historial de estados</p>
              {detalle.historial.length === 0 ? (
                <p className="text-slate-500">Sin cambios: el pedido sigue Pendiente.</p>
              ) : (
                <ol className="space-y-1">
                  {detalle.historial.map((cambio) => (
                    <li key={cambio.fecha_hora + cambio.estado} className="flex items-center gap-2">
                      <BadgeEstadoPedido estado={cambio.estado} />
                      <span className="text-slate-500">{cambio.fecha_hora.replace('T', ' ')}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
