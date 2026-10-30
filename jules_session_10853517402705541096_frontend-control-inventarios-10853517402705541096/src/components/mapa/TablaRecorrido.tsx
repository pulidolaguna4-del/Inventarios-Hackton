import React, { useMemo } from 'react';
import { Check, User } from 'lucide-react';
import { Tabla, type ColumnaTabla, type TonoFila } from '../ui/Tabla';
import { Insignia, type TonoInsignia } from '../ui/Insignia';
import type { AccionesConteo, ConteoSorteo, ErrorConteo } from '../../hooks/useConteoSorteo';
import type { RegistroConteo } from '../../types/inventario';
import { estadoParada, formatearTiempo, type EstadoParada, type ParadaActiva } from '../../utils/animacion';
import { textoVecesT, type FilaRecorrido, type GrupoRecorrido } from '../../utils/tablaRecorrido';
import { formatearNumero } from '../../utils/formato';

interface TablaRecorridoProps {
  grupos: GrupoRecorrido[];
  /** Índice de cada parada ("recorrido-orden") en la línea de tiempo que se reproduce. */
  indicePorParada: Map<string, number>;
  activa: ParadaActiva;
  /** Conteo del sorteo (solo en la ruta de conteo); sin él, la tabla no tiene columnas de conteo. */
  conteo: ConteoSorteo | null;
  numeroSorteo?: number;
  /** Clic (o Enter) en una fila: la animación salta a esa parada. */
  alElegir: (fila: FilaRecorrido) => void;
  /** Cursor sobre una fila: se resalta su celda en el 3D. */
  alPasar: (codigo: string | null) => void;
}

/**
 * Lo que muestra cada fila. Todo lo que cambia va aquí (estado, registro, texto escrito, error)
 * para que la tabla compare la fila campo por campo y solo vuelva a dibujar las que cambiaron.
 */
interface FilaVista extends FilaRecorrido {
  estado: EstadoParada | null;
  registro: RegistroConteo | null;
  recien_guardado: boolean;
  texto_sistema: string;
  texto_contada: string;
  error: ErrorConteo | null;
  guardando: boolean;
}

const TONO_POR_ESTADO: Record<EstadoParada, TonoFila> = { aqui: 'aqui', en_camino: 'camino', visitada: 'visitada', pendiente: 'pendiente' };

const INSIGNIA_ESTADO: Record<EstadoParada, { texto: string; tono: TonoInsignia }> = {
  pendiente: { texto: 'Pendiente', tono: 'neutro' },
  en_camino: { texto: 'En camino', tono: 'aviso' },
  aqui: { texto: 'Aquí', tono: 'acento' },
  visitada: { texto: 'Visitada', tono: 'exito' },
};

const LEYENDA: { texto: string; variable: string }[] = [
  { texto: 'Aquí', variable: '--fila-aqui' },
  { texto: 'En camino', variable: '--fila-camino' },
  { texto: 'Visitada', variable: '--fila-visitada' },
  { texto: 'Pendiente', variable: '--fila-pendiente' },
];

const formatearDiferencia = (diferencia: number) => (diferencia > 0 ? `+${diferencia}` : String(diferencia));

/** Columnas de la tabla; con `acciones`, también las de conteo. Solo dependen de cosas estables. */
function crearColumnas(acciones: AccionesConteo | null): ColumnaTabla<FilaVista>[] {
  const columnas: ColumnaTabla<FilaVista>[] = [
    {
      clave: 'orden',
      titulo: 'Orden',
      ancho: '5.5rem',
      render: (fila) => (
        <span className="flex items-center gap-2 font-mono text-xs tabular-nums">
          {fila.estado === 'aqui' && <span className="tabla-punto" aria-hidden="true" />}
          {fila.estado === 'visitada' && <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />}
          {fila.recorrido}.{fila.orden}
        </span>
      ),
    },
    {
      clave: 'ubicacion',
      titulo: 'Ubicación',
      render: (fila) => (
        <span className="flex items-center gap-1.5">
          <span className="tabla-chip">{fila.codigo_ubicacion}</span>
          <span className="font-mono text-[11px] opacity-60">#{fila.etiqueta}</span>
        </span>
      ),
    },
    { clave: 'nivel', titulo: 'Nivel', render: (fila) => <span className="font-mono text-xs">N{fila.nivel}</span> },
    { clave: 'sku', titulo: 'SKU', render: (fila) => (fila.sku !== null ? <span className="tabla-chip">{fila.sku}</span> : <span className="opacity-50">—</span>) },
    {
      clave: 'descripcion',
      titulo: 'Descripción',
      render: (fila) => (
        <span className="block max-w-[240px] truncate" title={fila.descripcion ?? undefined}>
          {fila.descripcion ?? <span className="opacity-50">—</span>}
        </span>
      ),
    },
    {
      clave: 'parada',
      titulo: 'Parada',
      alinear: 'derecha',
      render: (fila) => (
        <span className="font-mono text-xs whitespace-nowrap">
          <strong>{textoVecesT(fila.veces_t)}</strong> · {formatearNumero(fila.tiempo_s, 0)} s
        </span>
      ),
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      render: (fila) => {
        if (fila.registro) {
          return (
            <span className="flex items-center gap-1.5">
              <Insignia tono="exito" icono={<Check className="w-3 h-3" aria-hidden="true" />}>
                Contada
              </Insignia>
              {fila.estado === 'aqui' && <Insignia tono="acento">Aquí</Insignia>}
            </span>
          );
        }
        if (!fila.estado) return <span className="opacity-50 text-xs" title="Este recorrido no está en la línea de tiempo">—</span>;
        const { texto, tono } = INSIGNIA_ESTADO[fila.estado];
        return <Insignia tono={tono}>{texto}</Insignia>;
      },
    },
  ];
  if (!acciones) return columnas;

  columnas.push(
    {
      clave: 'sistema',
      titulo: 'Sistema',
      alinear: 'derecha',
      ancho: '7rem',
      render: (fila) => {
        const sku = fila.sku;
        if (sku === null) return null;
        if (fila.registro) return <span className="font-mono">{fila.registro.cantidad_sistema}</span>;
        return (
          <input
            type="number"
            min={0}
            value={fila.texto_sistema}
            onChange={(e) => acciones.cambiarSistema(sku, e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && acciones.enfocar(sku)}
            aria-label={`Cantidad en sistema de ${sku}`}
            className="w-20 text-right"
          />
        );
      },
    },
    {
      clave: 'contada',
      titulo: 'Contada',
      ancho: '13rem',
      render: (fila) => {
        const sku = fila.sku;
        if (sku === null) return null;
        if (fila.registro) {
          const conDiferencia = fila.registro.diferencia !== 0;
          return (
            <span
              className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 font-mono tabular-nums font-bold ${conDiferencia ? 'text-rose-700' : ''} ${
                fila.recien_guardado ? 'tabla-destello' : ''
              }`}
            >
              {fila.registro.cantidad_contada}
              <span className="font-normal text-xs">(dif. {formatearDiferencia(fila.registro.diferencia)})</span>
            </span>
          );
        }
        const escrito = fila.texto_contada;
        return (
          <div className="flex flex-col gap-0.5 py-1">
            <span className="flex items-center gap-2">
              <input
                ref={acciones.refCampo(sku)}
                type="number"
                min={0}
                value={escrito}
                onChange={(e) => acciones.cambiarContada(sku, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    acciones.guardar({ sku, cantidad_sistema: fila.cantidad_sistema });
                  }
                }}
                disabled={fila.guardando}
                aria-label={`Cantidad contada de ${sku}`}
                className="w-20 text-right"
              />
              {escrito !== '' && (
                <span className="font-mono text-xs opacity-70 whitespace-nowrap">
                  dif. {formatearDiferencia(Number(escrito) - Number(fila.texto_sistema || 0))}
                </span>
              )}
            </span>
            {fila.error && (
              <span key={fila.error.numero} role="alert" className="tabla-temblor text-[11px] font-normal text-rose-700">
                {fila.error.texto}
              </span>
            )}
          </div>
        );
      },
    },
  );
  return columnas;
}

/**
 * Tabla del recorrido sobre la Tabla reutilizable: filas en el orden de visita, agrupadas por
 * recorrido y coloreadas según el avance del carrito (la tabla no escucha el reloj: solo se
 * actualiza cuando cambia la parada activa). En la ruta de conteo, aquí mismo se cuenta.
 */
export const TablaRecorrido: React.FC<TablaRecorridoProps> = ({ grupos, indicePorParada, activa, conteo, numeroSorteo, alElegir, alPasar }) => {
  const acciones = conteo?.acciones ?? null;
  const columnas = useMemo(() => crearColumnas(acciones), [acciones]);
  const totalFilas = grupos.reduce((suma, grupo) => suma + grupo.filas.length, 0);
  const grupoPorClave = new Map(grupos.map((grupo) => [String(grupo.recorrido), grupo]));

  const filas: FilaVista[] = grupos.flatMap((grupo) =>
    grupo.filas.map((fila) => {
      const indice = indicePorParada.get(fila.clave_parada);
      const sku = fila.sku;
      const conConteo = conteo !== null && sku !== null;
      return {
        ...fila,
        estado: indice === undefined ? null : estadoParada(indice, activa),
        registro: conConteo ? conteo.registroDe(sku) : null,
        recien_guardado: conConteo ? conteo.recienGuardado(sku) : false,
        texto_sistema: conConteo ? conteo.textoSistema({ sku, cantidad_sistema: fila.cantidad_sistema }) : '',
        texto_contada: conConteo ? conteo.textoContada(sku) : '',
        error: conConteo ? conteo.errores[sku] ?? null : null,
        guardando: conConteo ? conteo.guardando === sku : false,
      };
    }),
  );
  const filaActiva = (filas.find((fila) => fila.estado === 'aqui') ?? filas.find((fila) => fila.estado === 'en_camino'))?.codigo_ubicacion ?? null;

  const encabezadoGrupo = (clave: string, filasGrupo: FilaVista[]) => {
    const grupo = grupoPorClave.get(clave);
    const enLinea = filasGrupo.filter((fila) => fila.estado !== null);
    const enCurso = enLinea.some((fila) => fila.estado === 'aqui' || fila.estado === 'en_camino');
    const completado = enLinea.length > 0 && enLinea.every((fila) => fila.estado === 'visitada');
    return (
      <span className="flex flex-1 flex-wrap items-center justify-between gap-2">
        <span>
          <strong>Recorrido {clave}</strong>
          {grupo && (
            <span className="opacity-70">
              {' '}
              · {grupo.paradas} {grupo.paradas === 1 ? 'parada' : 'paradas'} · {formatearNumero(grupo.distancia_m, 1)} m · {formatearTiempo(grupo.tiempo_s)}
            </span>
          )}
        </span>
        {enCurso ? <Insignia tono="acento">En curso</Insignia> : completado ? <Insignia tono="exito">Completado</Insignia> : null}
      </span>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {conteo && (
          <>
            {conteo.sinResponsable ? (
              <label className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                <User className="w-3.5 h-3.5" /> ¿Quién está contando?
                <input
                  value={conteo.responsable}
                  onChange={(e) => conteo.cambiarResponsable(e.target.value)}
                  placeholder="Nombre del responsable"
                  className="h-9 w-56 px-3 rounded-[10px] border border-amber-400 bg-amber-50 text-sm text-tinta"
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
          </>
        )}
        {/* Leyenda de los colores de fila */}
        <span className="flex flex-wrap items-center gap-3 ml-auto text-xs text-slate-600" aria-label="Colores de las filas">
          {LEYENDA.map(({ texto, variable }) => (
            <span key={texto} className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-[4px] border border-black/10" style={{ background: `var(${variable})` }} />
              {texto}
            </span>
          ))}
        </span>
      </div>

      <Tabla
        etiqueta="Paradas del recorrido"
        columnas={columnas}
        filas={filas}
        claveFila={(fila) => fila.codigo_ubicacion}
        agruparPor={(fila) => String(fila.recorrido)}
        encabezadoGrupo={encabezadoGrupo}
        tonoFila={(fila) => (fila.estado ? TONO_POR_ESTADO[fila.estado] : 'normal')}
        alClicFila={alElegir}
        alPasarFila={(fila) => alPasar(fila?.codigo_ubicacion ?? null)}
        filaActiva={filaActiva}
        altoMaximo="520px"
        pie={conteo ? 'Clic o Enter en una fila: el carrito salta a esa parada. Escribe lo contado y presiona Enter: se guarda y pasa a la siguiente.' : 'Clic o Enter en una fila: el carrito salta a esa parada.'}
      />
    </div>
  );
};
