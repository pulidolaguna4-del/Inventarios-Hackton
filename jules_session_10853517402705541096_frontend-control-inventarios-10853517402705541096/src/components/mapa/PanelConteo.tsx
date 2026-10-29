import React, { useEffect, useRef, useState } from 'react';
import { Check, User } from 'lucide-react';
import { api } from '../../services/api';
import { guardarResponsable, leerResponsableGuardado } from '../../utils/responsable';
import type { ItemParada, RegistroConteo, SorteoConteo } from '../../types/inventario';

/** Una referencia del sorteo en el orden del recorrido: recorrido, parada y producto. */
export interface FilaConteo {
  recorrido: number;
  orden: number;
  item: ItemParada & { sku: number };
}

interface PanelConteoProps {
  sorteo: SorteoConteo;
  filas: FilaConteo[];
  /** Parada donde está el carrito ("recorrido-orden"), para resaltar sus filas. */
  paradaActual: string | null;
  /** Se llama después de guardar un conteo (para recargar el sorteo y el progreso). */
  alGuardar: () => Promise<void>;
}

const claveParada = (fila: FilaConteo) => `${fila.recorrido}-${fila.orden}`;

const formatearDiferencia = (diferencia: number) => (diferencia > 0 ? `+${diferencia}` : String(diferencia));

/**
 * Conteo en línea del Paso 2: las referencias del sorteo en el orden en que el carrito las
 * visita. Enter guarda el conteo y pasa a la fila siguiente. Los campos no dependen de la
 * animación: se puede contar en cualquier orden y con el carrito quieto.
 */
export const PanelConteo: React.FC<PanelConteoProps> = ({ sorteo, filas, paradaActual, alGuardar }) => {
  const [responsable, setResponsable] = useState(leerResponsableGuardado);
  const [sistema, setSistema] = useState<Record<number, string>>({});
  const [contada, setContada] = useState<Record<number, string>>({});
  const [errores, setErrores] = useState<Record<number, string>>({});
  const [guardando, setGuardando] = useState<number | null>(null);
  // Registros guardados en esta pantalla: se muestran sin esperar a que se recargue el sorteo.
  const [guardados, setGuardados] = useState<Record<number, RegistroConteo>>({});
  const campos = useRef(new Map<number, HTMLInputElement>());
  const lista = useRef<HTMLOListElement>(null);

  const registroDe = (sku: number) =>
    guardados[sku] ?? sorteo.referencias.find((referencia) => referencia.sku === sku)?.registro_sorteo ?? null;
  const contadas = filas.filter((fila) => registroDe(fila.item.sku)).length;
  const sinResponsable = !responsable.trim();

  // Mantiene a la vista las filas de la parada donde está el carrito (sin mover la página).
  useEffect(() => {
    const contenedor = lista.current;
    const elemento = contenedor?.querySelector<HTMLElement>('[data-actual="true"]');
    if (contenedor && elemento) {
      contenedor.scrollTo({ top: elemento.offsetTop - contenedor.clientHeight / 2 + elemento.clientHeight / 2, behavior: 'smooth' });
    }
  }, [paradaActual]);

  const cambiarResponsable = (nombre: string) => {
    setResponsable(nombre);
    guardarResponsable(nombre);
  };

  /** Pasa el foco a la siguiente referencia sin contar (después de la actual, o la primera que quede). */
  const enfocarSiguiente = (indiceActual: number, yaContadas: Set<number>) => {
    const pendientes = filas.map((fila, indice) => ({ fila, indice })).filter(({ fila }) => !yaContadas.has(fila.item.sku));
    const siguiente = pendientes.find(({ indice }) => indice > indiceActual) ?? pendientes[0];
    if (siguiente) campos.current.get(siguiente.fila.item.sku)?.focus();
  };

  const guardar = async (fila: FilaConteo, indice: number) => {
    const sku = fila.item.sku;
    const textoContada = contada[sku] ?? '';
    const textoSistema = sistema[sku] ?? String(fila.item.cantidad_sistema ?? '');
    if (sinResponsable) return setErrores({ ...errores, [sku]: 'Escribe arriba quién está contando.' });
    if (textoContada === '' || !Number.isInteger(Number(textoContada)) || Number(textoContada) < 0) {
      return setErrores({ ...errores, [sku]: 'La cantidad contada debe ser un entero de 0 en adelante.' });
    }
    setGuardando(sku);
    try {
      const { registro } = await api.registrarConteo({
        sorteo: sorteo.sorteo,
        sku,
        responsable: responsable.trim(),
        cantidad_contada: Number(textoContada),
        cantidad_sistema: textoSistema === '' ? null : Number(textoSistema),
      });
      const nuevos = { ...guardados, [sku]: registro };
      setGuardados(nuevos);
      setErrores((previos) => {
        const resto = { ...previos };
        delete resto[sku];
        return resto;
      });
      const yaContadas = new Set(filas.map((f) => f.item.sku).filter((s) => nuevos[s] || registroDe(s)));
      enfocarSiguiente(indice, yaContadas);
      await alGuardar();
    } catch (e) {
      setErrores({ ...errores, [sku]: e instanceof Error ? e.message : String(e) });
    } finally {
      setGuardando(null);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="px-4 py-3 border-b border-slate-200 flex flex-col gap-2">
        {sinResponsable ? (
          <label className="flex flex-col gap-1 text-xs font-semibold text-amber-800">
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> ¿Quién está contando?
            </span>
            <input
              value={responsable}
              onChange={(e) => cambiarResponsable(e.target.value)}
              placeholder="Nombre del responsable"
              className="h-9 px-2 border border-amber-400 bg-amber-50 text-sm text-tinta"
            />
          </label>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-slate-600">
            <User className="w-3.5 h-3.5" /> Cuenta <strong className="text-tinta">{responsable}</strong>
            <button type="button" onClick={() => cambiarResponsable('')} className="ml-auto underline text-slate-500 hover:text-tinta cursor-pointer">
              cambiar
            </button>
          </span>
        )}
        <div className="flex items-baseline justify-between">
          <span className="font-display text-xl font-extrabold tabular-nums">
            {contadas} de {filas.length} <span className="text-sm font-semibold text-slate-500">contadas</span>
          </span>
          <span className="font-mono text-[11px] text-slate-500">SORTEO {sorteo.sorteo}</span>
        </div>
        <div className="h-1.5 bg-slate-200">
          <div className="h-full bg-senal transition-all" style={{ width: `${filas.length ? (contadas / filas.length) * 100 : 0}%` }} />
        </div>
        <p className="text-[11px] text-slate-500">Escribe lo contado y presiona Enter: se guarda y pasa a la siguiente.</p>
      </div>

      <ol ref={lista} className="relative max-h-[420px] overflow-y-auto">
        {filas.map((fila, indice) => {
          const { sku } = fila.item;
          const registro = registroDe(sku);
          const actual = claveParada(fila) === paradaActual;
          const conDiferencia = registro !== null && registro.diferencia !== 0;
          return (
            <li
              key={sku}
              data-actual={actual}
              className={`px-3 py-2.5 border-b border-slate-200 border-l-[3px] ${actual ? 'border-l-senal bg-white' : 'border-l-transparent'} ${
                conDiferencia ? 'bg-rose-50' : registro ? 'bg-slate-100' : ''
              }`}
            >
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono font-semibold">{fila.item.codigo_ubicacion}</span>
                <span className="font-mono text-slate-500">{sku}</span>
                <span className="ml-auto font-mono text-[10px] text-slate-400">
                  R{fila.recorrido}·{fila.orden}
                </span>
              </div>
              <p className="text-[13px] font-semibold text-slate-800 truncate" title={fila.item.descripcion}>
                {fila.item.descripcion}
              </p>
              {registro ? (
                <p className={`flex items-center gap-1 text-xs font-bold ${conDiferencia ? 'text-rose-700' : 'text-tinta'}`}>
                  <Check className="w-3.5 h-3.5" />
                  Sistema {registro.cantidad_sistema} · contada {registro.cantidad_contada} · diferencia {formatearDiferencia(registro.diferencia)}
                  <span className="font-normal text-slate-500">· {registro.responsable}</span>
                </p>
              ) : (
                <div className="flex items-end gap-2 mt-1">
                  <label className="flex flex-col text-[10px] font-mono text-slate-500">
                    SISTEMA
                    <input
                      type="number"
                      min={0}
                      value={sistema[sku] ?? String(fila.item.cantidad_sistema ?? '')}
                      onChange={(e) => setSistema({ ...sistema, [sku]: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && campos.current.get(sku)?.focus()}
                      className="w-20 h-8 px-1.5 border border-slate-300 bg-white font-mono text-sm text-tinta"
                    />
                  </label>
                  <label className="flex flex-col text-[10px] font-mono text-slate-500">
                    CONTADA
                    <input
                      ref={(elemento) => {
                        if (elemento) campos.current.set(sku, elemento);
                        else campos.current.delete(sku);
                      }}
                      type="number"
                      min={0}
                      value={contada[sku] ?? ''}
                      onChange={(e) => setContada({ ...contada, [sku]: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          guardar(fila, indice);
                        }
                      }}
                      disabled={guardando === sku}
                      aria-label={`Cantidad contada de ${sku}`}
                      className="w-20 h-8 px-1.5 border border-tinta bg-white font-mono text-sm text-tinta focus:outline-hidden focus:ring-2 focus:ring-senal/50"
                    />
                  </label>
                  {(contada[sku] ?? '') !== '' && (
                    <span className="pb-1.5 font-mono text-xs text-slate-500">
                      dif. {formatearDiferencia(Number(contada[sku]) - Number(sistema[sku] ?? fila.item.cantidad_sistema ?? 0))}
                    </span>
                  )}
                </div>
              )}
              {errores[sku] && <p className="text-[11px] text-rose-700 mt-1">{errores[sku]}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
};
