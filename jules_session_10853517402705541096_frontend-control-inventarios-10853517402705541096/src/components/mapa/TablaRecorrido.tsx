import React, { useEffect, useRef } from 'react';
import { Check, User } from 'lucide-react';
import type { ConteoSorteo } from '../../hooks/useConteoSorteo';
import { estadoParada, type EstadoParada, type ParadaActiva } from '../../utils/animacion';
import { centrarEnContenedor, textoVecesT, type FilaRecorrido, type GrupoRecorrido } from '../../utils/tablaRecorrido';
import { formatearNumero } from '../../utils/formato';

interface TablaRecorridoProps {
  grupos: GrupoRecorrido[];
  /** Índice de cada parada ("recorrido-orden") en la línea de tiempo que se reproduce. */
  indicePorParada: Map<string, number>;
  activa: ParadaActiva;
  /** Conteo del sorteo (solo en la ruta de conteo); sin él, la tabla no tiene columnas de conteo. */
  conteo: ConteoSorteo | null;
  numeroSorteo?: number;
  /** Clic en una fila: la animación salta a esa parada. */
  alElegir: (fila: FilaRecorrido) => void;
  /** Cursor sobre una fila: se resalta su celda en el 3D. */
  alPasar: (codigo: string | null) => void;
}

const formatearDiferencia = (diferencia: number) => (diferencia > 0 ? `+${diferencia}` : String(diferencia));

const ESTADOS: Record<EstadoParada, { texto: string; clase: string }> = {
  pendiente: { texto: 'Pendiente', clase: 'border-slate-300 text-slate-500' },
  en_camino: { texto: 'En camino', clase: 'border-senal text-tinta' },
  aqui: { texto: 'Aquí', clase: 'border-senal bg-senal text-tinta' },
  visitada: { texto: 'Visitada', clase: 'border-tinta bg-tinta text-papel' },
};

const Insignia: React.FC<{ texto: string; clase: string }> = ({ texto, clase }) => (
  <span className={`inline-block px-1.5 py-0.5 border font-mono text-[10px] font-semibold uppercase whitespace-nowrap ${clase}`}>{texto}</span>
);

/**
 * Tabla del recorrido, a todo el ancho y en el orden de visita. El estado de cada fila sale de
 * la parada activa de la animación (la tabla no escucha el reloj: solo se vuelve a dibujar
 * cuando cambia la parada). En la ruta de conteo, aquí mismo se cuenta.
 */
export const TablaRecorrido: React.FC<TablaRecorridoProps> = ({ grupos, indicePorParada, activa, conteo, numeroSorteo, alElegir, alPasar }) => {
  const contenedor = useRef<HTMLDivElement>(null);
  const totalFilas = grupos.reduce((suma, grupo) => suma + grupo.filas.length, 0);
  const columnas = conteo ? 9 : 7;

  // Mantiene a la vista la fila donde está el carrito, sin mover la página.
  useEffect(() => {
    const caja = contenedor.current;
    const fila = caja?.querySelector<HTMLElement>('[data-aqui="true"], [data-en-camino="true"]');
    if (caja && fila) centrarEnContenedor(caja, fila);
  }, [activa]);

  const estadoDe = (fila: FilaRecorrido): EstadoParada | null => {
    const indice = indicePorParada.get(fila.clave_parada);
    return indice === undefined ? null : estadoParada(indice, activa);
  };

  return (
    <div className="border border-slate-200 bg-slate-50">
      {conteo && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 border-b border-slate-200">
          {conteo.sinResponsable ? (
            <label className="flex items-center gap-2 text-xs font-semibold text-amber-800">
              <User className="w-3.5 h-3.5" /> ¿Quién está contando?
              <input
                value={conteo.responsable}
                onChange={(e) => conteo.cambiarResponsable(e.target.value)}
                placeholder="Nombre del responsable"
                className="h-9 w-56 px-2 border border-amber-400 bg-amber-50 text-sm text-tinta"
              />
            </label>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-slate-600">
              <User className="w-3.5 h-3.5" /> Cuenta <strong className="text-tinta">{conteo.responsable}</strong>
              <button type="button" onClick={() => conteo.cambiarResponsable('')} className="underline text-slate-500 hover:text-tinta cursor-pointer">
                cambiar
              </button>
            </span>
          )}
          <span className="font-display text-xl font-extrabold tabular-nums">
            {conteo.contadas} de {totalFilas} <span className="text-sm font-semibold text-slate-500">contadas · sorteo {numeroSorteo}</span>
          </span>
          <div className="h-1.5 bg-slate-200 flex-1 min-w-[120px]">
            <div className="h-full bg-senal transition-all" style={{ width: `${totalFilas ? (conteo.contadas / totalFilas) * 100 : 0}%` }} />
          </div>
          <p className="w-full text-[11px] text-slate-500">
            Clic en una fila: el carrito salta a esa parada. Escribe lo contado y presiona Enter: se guarda y pasa a la siguiente.
          </p>
        </div>
      )}

      <div ref={contenedor} className="max-h-[480px] overflow-auto scroll-smooth motion-reduce:scroll-auto">
        <table className="w-full text-left border-collapse text-sm min-w-[880px]">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr className="border-b-2 border-tinta font-mono text-[11px] tracking-[0.1em] text-slate-600">
              <th className="py-2.5 px-3 font-medium">ORDEN</th>
              <th className="py-2.5 px-3 font-medium">UBICACIÓN</th>
              <th className="py-2.5 px-3 font-medium">NIVEL</th>
              <th className="py-2.5 px-3 font-medium">SKU</th>
              <th className="py-2.5 px-3 font-medium">DESCRIPCIÓN</th>
              <th className="py-2.5 px-3 font-medium">PARADA</th>
              <th className="py-2.5 px-3 font-medium">ESTADO</th>
              {conteo && <th className="py-2.5 px-3 font-medium">SISTEMA</th>}
              {conteo && <th className="py-2.5 px-3 font-medium">CONTADA</th>}
            </tr>
          </thead>
          {grupos.map((grupo) => (
            <tbody key={grupo.recorrido}>
              <tr className="bg-slate-200/60">
                <th colSpan={columnas} scope="colgroup" className="py-1.5 px-3 font-mono text-[11px] font-semibold tracking-[0.08em] text-slate-700">
                  RECORRIDO {grupo.recorrido} · {grupo.paradas} {grupo.paradas === 1 ? 'parada' : 'paradas'} · {formatearNumero(grupo.distancia_m, 1)} m
                </th>
              </tr>
              {grupo.filas.map((fila) => {
                const estado = estadoDe(fila);
                const registro = conteo && fila.sku !== null ? conteo.registroDe(fila.sku) : null;
                const conDiferencia = registro !== null && registro.diferencia !== 0;
                const sku = fila.sku;
                return (
                  <tr
                    key={fila.codigo_ubicacion}
                    data-aqui={estado === 'aqui'}
                    data-en-camino={estado === 'en_camino'}
                    onClick={() => alElegir(fila)}
                    onMouseEnter={() => alPasar(fila.codigo_ubicacion)}
                    onMouseLeave={() => alPasar(null)}
                    onFocus={(e) => contenedor.current && centrarEnContenedor(contenedor.current, e.currentTarget)}
                    className={`border-b border-slate-200 border-l-[3px] cursor-pointer transition-colors ${
                      estado === 'aqui' ? 'border-l-senal bg-white' : 'border-l-transparent hover:bg-white'
                    } ${conDiferencia ? 'bg-rose-50' : ''}`}
                  >
                    <td className="py-2 px-3 font-mono text-xs tabular-nums">
                      {fila.recorrido}.{fila.orden}
                    </td>
                    <td className="py-2 px-3">
                      <span className="font-mono text-xs font-semibold">{fila.codigo_ubicacion}</span>
                      <span className="ml-1.5 font-mono text-[10px] text-slate-500">#{fila.etiqueta}</span>
                    </td>
                    <td className="py-2 px-3 font-mono text-xs">N{fila.nivel}</td>
                    <td className="py-2 px-3 font-mono text-xs">{sku ?? '—'}</td>
                    <td className="py-2 px-3 max-w-[260px] truncate" title={fila.descripcion ?? undefined}>
                      {fila.descripcion ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-2 px-3 font-mono text-xs whitespace-nowrap">
                      <strong>{textoVecesT(fila.veces_t)}</strong> · {formatearNumero(fila.tiempo_s, 0)} s
                    </td>
                    <td className="py-2 px-3">
                      {registro ? (
                        <span className="flex items-center gap-1.5">
                          <Insignia texto="Contada" clase="border-tinta text-tinta" />
                          {estado === 'aqui' && <Insignia {...ESTADOS.aqui} />}
                        </span>
                      ) : estado ? (
                        <Insignia {...ESTADOS[estado]} />
                      ) : (
                        <span className="text-slate-400 text-xs" title="Este recorrido no está en la línea de tiempo">—</span>
                      )}
                    </td>
                    {conteo && sku !== null && (
                      <>
                        <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                          {registro ? (
                            <span className="font-mono text-sm tabular-nums">{registro.cantidad_sistema}</span>
                          ) : (
                            <input
                              type="number"
                              min={0}
                              value={conteo.textoSistema({ sku, cantidad_sistema: fila.cantidad_sistema })}
                              onChange={(e) => conteo.cambiarSistema(sku, e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && conteo.enfocar(sku)}
                              aria-label={`Cantidad en sistema de ${sku}`}
                              className="w-20 h-8 px-1.5 border border-slate-300 bg-white font-mono text-sm text-tinta"
                            />
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {registro ? (
                            <span className={`flex items-center gap-1 font-mono text-sm font-bold tabular-nums ${conDiferencia ? 'text-rose-700' : 'text-tinta'}`}>
                              <Check className="w-3.5 h-3.5" />
                              {registro.cantidad_contada}
                              <span className="font-normal text-xs">(dif. {formatearDiferencia(registro.diferencia)})</span>
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <input
                                ref={conteo.refCampo(sku)}
                                type="number"
                                min={0}
                                value={conteo.textoContada(sku)}
                                onChange={(e) => conteo.cambiarContada(sku, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    conteo.guardar({ sku, cantidad_sistema: fila.cantidad_sistema });
                                  }
                                }}
                                disabled={conteo.guardando === sku}
                                aria-label={`Cantidad contada de ${sku}`}
                                className="w-20 h-8 px-1.5 border border-tinta bg-white font-mono text-sm text-tinta focus:outline-hidden focus:ring-2 focus:ring-senal/50"
                              />
                              {conteo.textoContada(sku) !== '' && (
                                <span className="font-mono text-xs text-slate-500 whitespace-nowrap">
                                  dif. {formatearDiferencia(Number(conteo.textoContada(sku)) - Number(conteo.textoSistema({ sku, cantidad_sistema: fila.cantidad_sistema }) || 0))}
                                </span>
                              )}
                            </div>
                          )}
                          {conteo.errores[sku] && <p className="text-[11px] text-rose-700 mt-1">{conteo.errores[sku]}</p>}
                        </td>
                      </>
                    )}
                    {conteo && sku === null && <td colSpan={2} />}
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
};
