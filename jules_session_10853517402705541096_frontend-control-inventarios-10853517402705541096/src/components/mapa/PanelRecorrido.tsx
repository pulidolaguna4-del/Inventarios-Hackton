import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, PackageCheck } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { VistaMapa } from '../../types/inventario';
import { formatearTiempo, type EstadoCarrito, type EventoLinea, type LineaDeTiempo } from '../../utils/animacion';
import { formatearNumero } from '../../utils/formato';

const NOMBRE_TRAMO: Record<string, string> = {
  pasillo: 'por el pasillo',
  cabecera: 'cruzando por la cabecera',
  zona_abierta: 'por la zona abierta',
  frente: 'por el frente',
};

/** Hacia dónde va un tramo, en palabras. */
function sentidoTramo(evento: Extract<EventoLinea, { tipo: 'tramo' }>): string {
  const dx = evento.punto_fin.x - evento.punto_inicio.x;
  const dy = evento.punto_fin.y - evento.punto_inicio.y;
  if (Math.abs(dy) >= Math.abs(dx)) return dy > 0 ? 'hacia el fondo' : 'hacia el frente';
  return dx > 0 ? 'a la derecha' : 'a la izquierda';
}

const Contador: React.FC<{ titulo: string; valor: string; detalle?: string }> = ({ titulo, valor, detalle }) => (
  <div className="flex flex-col gap-0.5">
    <span className="font-mono text-[10px] tracking-[0.1em] text-slate-500">{titulo}</span>
    <span className="font-display text-2xl font-extrabold tabular-nums leading-none">{valor}</span>
    {detalle && <span className="text-[11px] text-slate-500">{detalle}</span>}
  </div>
);

interface PanelProps {
  vista: VistaMapa;
  linea: LineaDeTiempo;
  estado: EstadoCarrito | null;
  tiempo: number;
  /** Recorrido del que se muestran las instrucciones del robot. */
  recorridoInstrucciones: number;
}

/** Panel lateral: contadores vivos, lista de pasos con el actual resaltado e instrucciones del robot. */
export const PanelRecorrido: React.FC<PanelProps> = ({ vista, linea, estado, tiempo, recorridoInstrucciones }) => {
  const contenedor = useRef<HTMLOListElement>(null);
  const indiceActual = estado?.indice ?? 0;

  // Desplaza la lista para que el paso actual quede a la vista (sin mover la página).
  useEffect(() => {
    const lista = contenedor.current;
    const elemento = lista?.querySelector<HTMLElement>(`[data-indice="${indiceActual}"]`);
    if (lista && elemento) lista.scrollTo({ top: elemento.offsetTop - lista.clientHeight / 2 + elemento.clientHeight / 2, behavior: 'smooth' });
  }, [indiceActual, linea]);

  // Instrucciones del robot: la escala llega vacía hasta que el backend responde con la suya.
  // Solo se pide al backend una escala válida; mientras se escribe una inválida se marca el campo.
  const [escalaTexto, setEscalaTexto] = useState<string | null>(null);
  const [escalaPedida, setEscalaPedida] = useState<number | undefined>(undefined);
  const escalaValida = escalaTexto === null || Number(escalaTexto) > 0;
  const cambiarEscala = (texto: string) => {
    setEscalaTexto(texto);
    const numero = Number(texto);
    if (texto !== '' && Number.isFinite(numero) && numero > 0) setEscalaPedida(numero);
  };
  const instrucciones = useApi(
    () => api.obtenerInstruccionesRobot(vista, recorridoInstrucciones, escalaPedida),
    [vista, recorridoInstrucciones, escalaPedida],
  );
  const escalaMostrada = escalaTexto ?? String(instrucciones.datos?.escala ?? '');
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    const texto = instrucciones.datos?.codigo_arduino;
    if (!texto) return;
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Sin permiso para el portapapeles: copiar con un área de texto temporal.
      const area = document.createElement('textarea');
      area.value = texto;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  };

  return (
    <aside className="flex flex-col border border-slate-200 bg-slate-50 min-w-0">
      {/* Contadores vivos */}
      <div className="grid grid-cols-3 gap-3 p-4 border-b border-slate-200">
        <Contador titulo="METROS" valor={formatearNumero(estado?.distancia_m ?? 0, 1)} detalle={`de ${formatearNumero(linea.distancia_total_m, 1)} m`} />
        <Contador titulo="TIEMPO" valor={formatearTiempo(tiempo)} detalle={`de ${formatearTiempo(linea.duracion)}`} />
        <Contador titulo="PARADAS" valor={`${estado?.paradas_completas ?? 0}/${linea.total_paradas}`} detalle={estado?.en_parada ? 'recogiendo…' : 'visitadas'} />
      </div>

      {/* Pasos del recorrido */}
      <div className="px-4 pt-3 pb-1 font-mono text-[11px] tracking-[0.1em] text-slate-500">PASOS DEL RECORRIDO</div>
      <ol ref={contenedor} className="relative max-h-[300px] overflow-y-auto px-2 pb-3">
        {linea.eventos.map((evento, indice) => {
          const actual = indice === indiceActual;
          const hecho = evento.t_fin <= tiempo && !actual;
          const cambiaRecorrido = indice === 0 || linea.eventos[indice - 1].recorrido !== evento.recorrido;
          return (
            <React.Fragment key={indice}>
              {cambiaRecorrido && (
                <li className="font-mono text-[11px] font-semibold text-slate-600 px-2 pt-2 pb-1">RECORRIDO {evento.recorrido}</li>
              )}
              <li
                data-indice={indice}
                className={`flex items-start gap-2 px-2 py-1.5 text-[13px] border-l-[3px] ${
                  actual ? 'bg-tinta text-papel border-senal' : hecho ? 'text-slate-400 border-transparent' : 'border-transparent'
                }`}
              >
                <span className="font-mono text-[11px] w-10 shrink-0 pt-0.5 tabular-nums opacity-70">{formatearTiempo(evento.t_inicio)}</span>
                {evento.tipo === 'tramo' ? (
                  <span>
                    Avanza <strong>{formatearNumero(evento.distancia_m, 1)} m</strong> {sentidoTramo(evento)} {NOMBRE_TRAMO[evento.tipo_tramo]}
                  </span>
                ) : (
                  <span className="flex flex-col">
                    <span className="flex items-center gap-1 font-semibold">
                      <PackageCheck className="w-3.5 h-3.5" /> Recoge en {evento.etiqueta} · {formatearNumero(evento.tiempo_recogida_s, 0)} s
                    </span>
                    {evento.ubicaciones.map((u) => (
                      <span key={u.codigo_ubicacion} className="font-mono text-[11px] opacity-80">
                        {u.codigo_ubicacion} · nivel {u.nivel} · {formatearNumero(u.tiempo_recogida_s, 0)} s
                      </span>
                    ))}
                  </span>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>

      {/* Instrucciones del robot */}
      <div className="border-t border-slate-200 p-4 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] tracking-[0.1em] text-slate-500">ROBOT · RECORRIDO {recorridoInstrucciones}</span>
          <label className="flex items-center gap-1.5 text-xs font-semibold">
            Escala 1:
            <input
              type="number"
              min={1}
              value={escalaMostrada}
              onChange={(e) => cambiarEscala(e.target.value)}
              className={`w-16 h-8 px-1.5 border bg-white font-mono text-sm ${escalaValida ? 'border-slate-300' : 'border-rose-500'}`}
              aria-invalid={!escalaValida}
            />
          </label>
        </div>
        {instrucciones.error ? (
          <p className="text-xs text-rose-700">{instrucciones.error}</p>
        ) : (
          <>
            <p className="text-xs text-slate-600">
              {instrucciones.datos
                ? `${instrucciones.datos.numero_instrucciones} instrucciones · ${formatearNumero(instrucciones.datos.total_cm, 1)} cm en total (${formatearNumero(instrucciones.datos.distancia_m, 1)} m reales)`
                : 'Calculando…'}
            </p>
            <pre className="max-h-[220px] overflow-auto bg-tinta text-papel font-mono text-[11px] leading-relaxed p-3">
              {instrucciones.datos?.texto ?? ''}
            </pre>
            <button
              type="button"
              onClick={copiar}
              disabled={!instrucciones.datos}
              className="flex items-center justify-center gap-1.5 h-10 border border-tinta bg-slate-50 hover:bg-white text-xs font-bold uppercase tracking-wide cursor-pointer disabled:opacity-50"
            >
              {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiado ? 'Copiado' : 'Copiar código para Arduino'}
            </button>
          </>
        )}
      </div>
    </aside>
  );
};
