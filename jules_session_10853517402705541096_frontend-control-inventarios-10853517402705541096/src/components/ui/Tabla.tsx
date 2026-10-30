import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Inbox } from 'lucide-react';
import { centrarEnContenedor } from '../../utils/desplazamiento';

// Tabla reutilizable: <table> real, filas tipo píldora, grupos plegables, tonos por fila y
// animaciones solo con CSS (estilos y colores en index.css: .tabla*, --tabla-*, --fila-*).

/** Color de la fila según el avance (en /recorrido) o 'normal'. */
export type TonoFila = 'aqui' | 'camino' | 'visitada' | 'pendiente' | 'normal';

export interface ColumnaTabla<T> {
  clave: string;
  titulo: React.ReactNode;
  /** 'derecha' también alinea los números (tabular-nums). */
  alinear?: 'izquierda' | 'centro' | 'derecha';
  /** Ancho CSS, ej. '7rem'. */
  ancho?: string;
  /** Sin render se muestra fila[clave]. */
  render?: (fila: T) => React.ReactNode;
}

export interface TablaProps<T> {
  /** Conviene pasarlas estables (useMemo): si cambian, se vuelven a dibujar todas las filas. */
  columnas: ColumnaTabla<T>[];
  filas: T[];
  claveFila: (fila: T) => string;
  agruparPor?: (fila: T) => string;
  encabezadoGrupo?: (clave: string, filas: T[]) => React.ReactNode;
  tonoFila?: (fila: T) => TonoFila;
  alClicFila?: (fila: T) => void;
  alPasarFila?: (fila: T | null) => void;
  /** Clave de la fila que debe quedar a la vista (se desplaza solo el scroll interno). */
  filaActiva?: string | null;
  cargando?: boolean;
  vacio?: React.ReactNode;
  pie?: React.ReactNode;
  densidad?: 'comoda' | 'compacta';
  /** Alto máximo (ej. '480px'): scroll interno con el encabezado fijo. */
  altoMaximo?: string;
  /** Nombre accesible de la tabla. */
  etiqueta?: string;
}

/** Hasta cuántas filas se escalona la animación de entrada (30 ms cada una). */
const TOPE_ESCALONADO = 12;
const FILAS_ESQUELETO = 5;
/** Un clic en estos elementos no activa la fila: es para el control. */
const CONTROLES = 'input, button, select, textarea, a, label';

const CLASE_ALINEAR = { izquierda: undefined, centro: 'tabla-centro', derecha: 'tabla-derecha' } as const;

/** true si los dos objetos tienen los mismos valores en el primer nivel. */
function igualesSuperficial(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const clavesA = Object.keys(a);
  if (clavesA.length !== Object.keys(b).length) return false;
  return clavesA.every((clave) => (a as Record<string, unknown>)[clave] === (b as Record<string, unknown>)[clave]);
}

interface Acciones<T> {
  clic?: (fila: T) => void;
  pasar?: (fila: T | null) => void;
}

interface FilaProps<T> {
  fila: T;
  clave: string;
  columnas: ColumnaTabla<T>[];
  tono: TonoFila;
  activa: boolean;
  clicable: boolean;
  /** Posición en la tabla: solo cuenta al montarse (retraso de la animación de entrada). */
  indice: number;
  acciones: React.RefObject<Acciones<T>>;
}

function FilaTablaBase<T>({ fila, clave, columnas, tono, activa, clicable, indice, acciones }: FilaProps<T>) {
  return (
    <tr
      data-clave={clave}
      data-tono={tono}
      className={`tabla-fila${clicable ? ' es-clicable' : ''}`}
      style={{ '--retraso': `${Math.min(indice, TOPE_ESCALONADO) * 30}ms` } as React.CSSProperties}
      tabIndex={clicable ? 0 : undefined}
      aria-current={activa ? 'true' : undefined}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest(CONTROLES)) return;
        acciones.current?.clic?.(fila);
      }}
      onKeyDown={(e) => {
        // Solo la fila misma: el Enter de un input dentro de la fila es del input.
        if (!clicable || e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          acciones.current?.clic?.(fila);
        }
      }}
      onMouseEnter={() => acciones.current?.pasar?.(fila)}
      onMouseLeave={() => acciones.current?.pasar?.(null)}
    >
      {columnas.map((columna) => (
        <td key={columna.clave} className={CLASE_ALINEAR[columna.alinear ?? 'izquierda']} style={columna.ancho ? { width: columna.ancho } : undefined}>
          {columna.render ? columna.render(fila) : ((fila as Record<string, unknown>)[columna.clave] as React.ReactNode)}
        </td>
      ))}
    </tr>
  );
}

/** Solo se vuelve a dibujar si cambió algo de la fila (campo por campo), su tono, si es la activa o las columnas. */
const FilaTabla = React.memo(
  FilaTablaBase,
  (antes, despues) =>
    antes.clave === despues.clave &&
    antes.columnas === despues.columnas &&
    antes.tono === despues.tono &&
    antes.activa === despues.activa &&
    antes.clicable === despues.clicable &&
    antes.acciones === despues.acciones &&
    igualesSuperficial(antes.fila, despues.fila),
) as typeof FilaTablaBase;

/** Agrupa conservando el orden en que aparece cada grupo. */
function agrupar<T>(filas: T[], agruparPor?: (fila: T) => string): { clave: string; filas: T[] }[] {
  if (!agruparPor) return [{ clave: '', filas }];
  const grupos = new Map<string, T[]>();
  for (const fila of filas) {
    const clave = agruparPor(fila);
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave)!.push(fila);
  }
  return [...grupos].map(([clave, filasGrupo]) => ({ clave, filas: filasGrupo }));
}

export function Tabla<T>({
  columnas,
  filas,
  claveFila,
  agruparPor,
  encabezadoGrupo,
  tonoFila,
  alClicFila,
  alPasarFila,
  filaActiva,
  cargando = false,
  vacio = 'No hay datos para mostrar.',
  pie,
  densidad = 'comoda',
  altoMaximo,
  etiqueta,
}: TablaProps<T>) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [plegados, setPlegados] = useState<Set<string>>(() => new Set());

  // Los manejadores viven en un ref: aunque la página pase funciones nuevas en cada render,
  // las filas memorizadas no se vuelven a dibujar por eso.
  const acciones = useRef<Acciones<T>>({});
  useEffect(() => {
    acciones.current = { clic: alClicFila, pasar: alPasarFila };
  });

  // La fila activa queda a la vista moviendo solo el scroll interno (nunca la página).
  useEffect(() => {
    const caja = contenedor.current;
    if (!caja || !filaActiva) return;
    const fila = [...caja.querySelectorAll<HTMLElement>('tr[data-clave]')].find((tr) => tr.dataset.clave === filaActiva);
    if (fila) centrarEnContenedor(caja, fila);
  }, [filaActiva]);

  const alternarGrupo = (clave: string) =>
    setPlegados((previos) => {
      const siguientes = new Set(previos);
      if (siguientes.has(clave)) siguientes.delete(clave);
      else siguientes.add(clave);
      return siguientes;
    });

  const grupos = agrupar(filas, agruparPor);
  const clicable = Boolean(alClicFila);
  let indice = 0;

  return (
    <div className="tabla-contenedor">
      <div ref={contenedor} className="tabla-scroll" style={altoMaximo ? { maxHeight: altoMaximo } : undefined}>
        <table className="tabla" data-densidad={densidad} aria-label={etiqueta} aria-busy={cargando || undefined}>
          <thead>
            <tr>
              {columnas.map((columna) => (
                <th key={columna.clave} scope="col" className={CLASE_ALINEAR[columna.alinear ?? 'izquierda']} style={columna.ancho ? { width: columna.ancho } : undefined}>
                  {columna.titulo}
                </th>
              ))}
            </tr>
          </thead>
          {cargando ? (
            <tbody>
              {Array.from({ length: FILAS_ESQUELETO }, (_, i) => (
                <tr key={i} className="tabla-fila" data-tono="normal" aria-hidden="true">
                  {columnas.map((columna) => (
                    <td key={columna.clave}>
                      <span className="tabla-esqueleto" style={{ width: `${55 + ((i * 17 + columna.clave.length * 7) % 40)}%` }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ) : filas.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={columnas.length} className="tabla-vacio">
                  <Inbox className="w-8 h-8 mx-auto mb-2 opacity-40" aria-hidden="true" />
                  {vacio}
                </td>
              </tr>
            </tbody>
          ) : (
            grupos.map((grupo) => {
              const plegado = plegados.has(grupo.clave);
              return (
                <tbody key={grupo.clave}>
                  {agruparPor && (
                    <tr className="tabla-grupo">
                      <th colSpan={columnas.length} scope="colgroup">
                        <button type="button" className="tabla-grupo-boton" aria-expanded={!plegado} onClick={() => alternarGrupo(grupo.clave)}>
                          <ChevronDown className="tabla-chevron w-4 h-4" aria-hidden="true" />
                          {encabezadoGrupo ? encabezadoGrupo(grupo.clave, grupo.filas) : grupo.clave}
                        </button>
                      </th>
                    </tr>
                  )}
                  {!plegado &&
                    grupo.filas.map((fila) => {
                      const clave = claveFila(fila);
                      return (
                        <FilaTabla
                          key={clave}
                          fila={fila}
                          clave={clave}
                          columnas={columnas}
                          tono={tonoFila ? tonoFila(fila) : 'normal'}
                          activa={clave === filaActiva}
                          clicable={clicable}
                          indice={indice++}
                          acciones={acciones}
                        />
                      );
                    })}
                </tbody>
              );
            })
          )}
        </table>
      </div>
      {pie && <div className="tabla-pie">{pie}</div>}
    </div>
  );
}
