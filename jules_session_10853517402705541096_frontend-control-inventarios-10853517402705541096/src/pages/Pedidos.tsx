import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Truck, ArrowRight, Eye, CalendarDays } from 'lucide-react';
import { Tabla, type ColumnaTabla } from '../components/ui/Tabla';
import { FiltrosTabla } from '../components/ui/FiltrosTabla';
import { Insignia, type TonoInsignia } from '../components/ui/Insignia';
import { Modal } from '../components/ui/Modal';
import { Aviso, Cargando, ErrorCarga, type MensajeAviso } from '../components/ui/Estados';
import { formatearNumero } from '../utils/formato';
import { EncabezadoPagina } from '../components/ui/EncabezadoPagina';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import type { EstadoPedido, Pedido } from '../types/inventario';

/** Tono de la Insignia de cada estado, de gris (sin empezar) a verde (entregado). */
const TONO_ESTADO: Record<EstadoPedido, TonoInsignia> = {
  Pendiente: 'neutro',
  'En alistamiento': 'aviso',
  Alistado: 'aviso',
  'En entrega': 'acento',
  Entregado: 'exito',
};

const InsigniaEstado: React.FC<{ estado: EstadoPedido }> = ({ estado }) => <Insignia tono={TONO_ESTADO[estado]}>{estado}</Insignia>;

/** Pedido con lo que cambia su fila (si se está avanzando), para que la Tabla compare campo por campo. */
type FilaPedido = Pedido & { avanzando: boolean };

interface AccionesPedido {
  avanzar: (pedido: Pedido) => void;
  verDetalle: (pedido: Pedido) => void;
}

/** Columnas de la tabla (con acciones estables, para que no cambien entre renders). */
function crearColumnas(acciones: AccionesPedido): ColumnaTabla<FilaPedido>[] {
  return [
    { clave: 'id_pedido', titulo: 'Pedido', render: (pedido) => <span className="tabla-chip">{pedido.id_pedido}</span> },
    { clave: 'cliente', titulo: 'Cliente' },
    {
      clave: 'productos',
      titulo: 'Productos',
      render: (pedido) => (
        <span className="text-xs opacity-80">
          {pedido.lineas.slice(0, 3).map((linea) => `${linea.sku} ×${linea.cantidad}`).join(', ')}
          {pedido.lineas.length > 3 && ` y ${pedido.lineas.length - 3} más`}
        </span>
      ),
    },
    { clave: 'unidades', titulo: 'Unidades', alinear: 'derecha', render: (pedido) => formatearNumero(pedido.unidades) },
    { clave: 'estado', titulo: 'Estado', render: (pedido) => <InsigniaEstado estado={pedido.estado} /> },
    {
      clave: 'ultimo_cambio',
      titulo: 'Último cambio',
      render: (pedido) => <span className="font-mono text-xs opacity-70">{pedido.ultimo_cambio?.replace('T', ' ') ?? '—'}</span>,
    },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      render: (pedido) => (
        <span className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => acciones.verDetalle(pedido)}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--tabla-chip)] hover:bg-[var(--tabla-hover)] cursor-pointer"
            title="Ver detalle e historial"
            aria-label={`Ver el pedido ${pedido.id_pedido}`}
          >
            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          {pedido.siguiente_estado ? (
            <button
              type="button"
              onClick={() => acciones.avanzar(pedido)}
              disabled={pedido.avanzando}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-full text-xs font-semibold bg-[var(--insignia-acento-fondo)] text-[var(--insignia-acento-texto)] hover:brightness-95 cursor-pointer disabled:opacity-50"
            >
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              {pedido.siguiente_estado}
            </button>
          ) : (
            <Insignia tono="exito">Finalizado</Insignia>
          )}
        </span>
      ),
    },
  ];
}

const COLUMNAS_LINEAS: ColumnaTabla<Pedido['lineas'][number]>[] = [
  { clave: 'sku', titulo: 'SKU', render: (linea) => <span className="tabla-chip">{linea.sku}</span> },
  { clave: 'descripcion', titulo: 'Descripción' },
  { clave: 'cantidad', titulo: 'Cantidad', alinear: 'derecha', render: (linea) => formatearNumero(linea.cantidad) },
];

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

  // Acciones estables (siempre llaman a la versión más reciente de `avanzar`): las columnas no
  // cambian y las filas memorizadas no se vuelven a dibujar por eso.
  const ultimoAvanzar = useRef(avanzar);
  useEffect(() => {
    ultimoAvanzar.current = avanzar;
  });
  const [acciones] = useState<AccionesPedido>(() => ({
    avanzar: (pedido) => ultimoAvanzar.current(pedido),
    verDetalle: (pedido) => setDetalle(pedido),
  }));
  const columnas = useMemo(() => crearColumnas(acciones), [acciones]);

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

  const filas: FilaPedido[] = visibles.map((pedido) => ({ ...pedido, avanzando: avanzando === pedido.id_pedido }));

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
        <div className="space-y-3">
          <FiltrosTabla
            busqueda={busqueda}
            alBuscar={setBusqueda}
            marcador="Buscar por número de pedido o SKU..."
            resumen={respuesta ? `${visibles.length} de ${respuesta.pedidos.length} pedidos del ${respuesta.fecha}` : undefined}
          />
          <Tabla
            etiqueta="Pedidos del día"
            columnas={columnas}
            filas={filas}
            claveFila={(pedido) => String(pedido.id_pedido)}
            tonoFila={(pedido) => (pedido.estado === 'Entregado' ? 'visitada' : 'normal')}
            alClicFila={setDetalle}
            cargando={pedidos.cargando && !respuesta}
            altoMaximo="640px"
            vacio="No hay pedidos con ese filtro."
            pie="Clic o Enter en un pedido para ver su detalle e historial."
          />
        </div>
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
              <InsigniaEstado estado={detalle.estado} />
            </div>
            <Tabla
              etiqueta="Productos del pedido"
              densidad="compacta"
              columnas={COLUMNAS_LINEAS}
              filas={detalle.lineas}
              claveFila={(linea) => String(linea.sku)}
            />
            <div>
              <p className="font-bold text-slate-700 mb-1.5">Historial de estados</p>
              {detalle.historial.length === 0 ? (
                <p className="text-slate-500">Sin cambios: el pedido sigue Pendiente.</p>
              ) : (
                <ol className="space-y-1">
                  {detalle.historial.map((cambio) => (
                    <li key={cambio.fecha_hora + cambio.estado} className="flex items-center gap-2">
                      <InsigniaEstado estado={cambio.estado} />
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
