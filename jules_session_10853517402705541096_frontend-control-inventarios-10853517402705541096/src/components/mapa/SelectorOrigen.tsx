import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Package, Shuffle, Truck } from 'lucide-react';
import type { OrigenPicking, PeriodoConteo, ResumenSorteo } from '../../types/inventario';
import { formatearFechaHora } from '../../utils/formato';

interface SelectorOrigenProps {
  origen: OrigenPicking;
  /** Sorteo que se está mostrando (origen sorteo). */
  sorteoActivo?: number;
  sorteos: ResumenSorteo[];
  periodos: PeriodoConteo[];
  /** Fechas con pedidos de Arauca y la elegida (origen lote). */
  fechas: string[];
  fecha?: string;
  alCambiar: (origen: OrigenPicking, extra?: { sorteo?: number; fecha?: string }) => void;
}

const PESTANAS: { valor: OrigenPicking; etiqueta: string; icono: typeof Shuffle }[] = [
  { valor: 'sorteo', etiqueta: 'Sorteos', icono: Shuffle },
  { valor: 'prueba', etiqueta: 'Pedido de prueba (Tarea 6)', icono: Package },
  { valor: 'lote', etiqueta: 'Pedidos del día', icono: Truck },
];

/** Qué recorre el carrito: un sorteo (ruta de conteo), la Tarea 6 o los pedidos de un día. */
export const SelectorOrigen: React.FC<SelectorOrigenProps> = ({ origen, sorteoActivo, sorteos, periodos, fechas, fecha, alCambiar }) => {
  const nombrePeriodo = new Map(periodos.map((periodo) => [periodo.numero, periodo.nombre]));
  const pestanas = PESTANAS.filter((pestana) => pestana.valor !== 'sorteo' || sorteos.length > 0);
  return (
    <div className="border border-slate-200 bg-slate-50">
      <div className="flex flex-wrap border-b border-slate-200" role="tablist" aria-label="Qué recorre el carrito">
        {pestanas.map(({ valor, etiqueta, icono: Icono }) => (
          <button
            key={valor}
            type="button"
            role="tab"
            aria-selected={origen === valor}
            onClick={() => origen !== valor && alCambiar(valor)}
            className={`flex items-center gap-1.5 h-11 px-4 text-xs font-bold uppercase tracking-wide cursor-pointer border-b-[3px] ${
              origen === valor ? 'border-senal text-tinta bg-white' : 'border-transparent text-slate-500 hover:text-tinta'
            }`}
          >
            <Icono className="w-3.5 h-3.5" />
            {etiqueta}
          </button>
        ))}
      </div>

      {origen === 'sorteo' && (
        <div className="max-h-56 overflow-y-auto">
          <table className="w-full text-left border-collapse text-sm min-w-[620px]">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="border-b border-slate-300 font-mono text-[11px] tracking-[0.1em] text-slate-500">
                <th className="py-2 px-4 font-medium">SORTEO</th>
                <th className="py-2 px-4 font-medium">FECHA</th>
                <th className="py-2 px-4 font-medium">PERIODO</th>
                <th className="py-2 px-4 font-medium">PROGRESO</th>
                <th className="py-2 px-4" />
              </tr>
            </thead>
            <tbody>
              {[...sorteos].reverse().map((s) => {
                const activo = s.numero === sorteoActivo;
                return (
                  <tr key={s.numero} className={`border-b border-slate-200 ${activo ? 'bg-white' : ''}`}>
                    <td className={`py-2 px-4 font-bold border-l-[3px] ${activo ? 'border-l-senal' : 'border-l-transparent'}`}>Sorteo {s.numero}</td>
                    <td className="py-2 px-4 font-mono text-xs">{formatearFechaHora(s.fecha_hora)}</td>
                    <td className="py-2 px-4 text-xs">
                      {s.periodo} · {nombrePeriodo.get(s.periodo) ?? ''}
                    </td>
                    <td className="py-2 px-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 bg-slate-200">
                          <div className="h-full bg-senal" style={{ width: `${s.tamano ? (s.registrados / s.tamano) * 100 : 0}%` }} />
                        </div>
                        <span className="font-mono text-xs tabular-nums">
                          {s.registrados} de {s.tamano} contadas
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-4 text-right">
                      {activo ? (
                        <span className="font-mono text-[11px] font-semibold text-senal">EN EL MAPA</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => alCambiar('sorteo', { sorteo: s.numero })}
                          aria-label={`Seleccionar sorteo ${s.numero}`}
                          className="h-8 px-3 border border-tinta bg-slate-50 hover:bg-tinta hover:text-papel text-xs font-bold uppercase tracking-wide cursor-pointer"
                        >
                          Seleccionar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {origen === 'prueba' && (
        <p className="px-4 py-3 text-sm text-slate-600">
          Las 9 posiciones fijas de la Gráfica 9 (sin SKU): ambos niveles en 4, 25 y 60; nivel 1 en 7, 21 y 55; nivel 2 en 49, 44 y 41.
        </p>
      )}

      {origen === 'lote' && (
        <div className="flex flex-wrap items-end gap-3 px-4 py-3">
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="font-mono text-[11px] tracking-[0.1em] text-slate-500">FECHA</span>
            <select value={fecha ?? ''} onChange={(e) => alCambiar('lote', { fecha: e.target.value })} className="h-10 px-2 border border-tinta bg-white font-mono text-sm">
              {fechas.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
          </label>
          <Link to={`/pedidos?fecha=${fecha ?? ''}`} className="flex items-center gap-1 h-10 text-xs font-bold text-indigo-600 hover:underline">
            <ExternalLink className="w-3.5 h-3.5" />
            Ver los pedidos de ese día
          </Link>
        </div>
      )}
    </div>
  );
};
