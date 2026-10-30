import React from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { estadoEnTiempo, formatearTiempo, type LineaDeTiempo } from '../../utils/animacion';
import { useTiempoReloj, type Reloj } from '../../utils/reloj';
import { formatearNumero } from '../../utils/formato';
import { VELOCIDADES } from './constantes';

interface LineaTiempoProps {
  reloj: Reloj;
  linea: LineaDeTiempo;
  reproduciendo: boolean;
  velocidad: number;
  recorridos: number[];
  seleccion: number | 'todos';
  alReproducir: () => void;
  alReiniciar: () => void;
  alCambiarVelocidad: (velocidad: number) => void;
  alBuscar: (t: number) => void;
  alElegirRecorrido: (seleccion: number | 'todos') => void;
}

const claseOpcion = (activa: boolean) =>
  `h-8 min-w-8 px-2.5 text-xs font-bold border border-[#45474d] -ml-px first:ml-0 cursor-pointer transition-colors ${
    activa ? 'bg-papel text-tinta' : 'bg-transparent text-papel hover:bg-[#222327]'
  }`;

const Contador: React.FC<{ titulo: string; valor: string; detalle: string }> = ({ titulo, valor, detalle }) => (
  <div className="flex flex-col leading-none">
    <span className="font-mono text-[9px] tracking-[0.12em] text-[#b5b0a4]">{titulo}</span>
    <span className="font-display text-lg font-extrabold tabular-nums">
      {valor}
      <span className="ml-1 font-mono text-[10px] font-normal text-[#b5b0a4]">{detalle}</span>
    </span>
  </div>
);

/**
 * Barra inferior del HUD: play/pausa, velocidad, barra arrastrable, recorrido y contadores.
 * Es lo único que escucha el reloj (~10 veces por segundo); la página y la tabla no.
 */
export const LineaTiempo: React.FC<LineaTiempoProps> = ({
  reloj,
  linea,
  reproduciendo,
  velocidad,
  recorridos,
  seleccion,
  alReproducir,
  alReiniciar,
  alCambiarVelocidad,
  alBuscar,
  alElegirRecorrido,
}) => {
  const tiempo = useTiempoReloj(reloj);
  const estado = estadoEnTiempo(linea, tiempo);
  return (
    <div className="bg-tinta/90 backdrop-blur-sm text-papel px-3 py-2.5 flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={alReproducir}
          aria-label={reproduciendo ? 'Pausar' : 'Reproducir'}
          className="flex items-center justify-center w-10 h-10 bg-senal hover:bg-senal-claro text-tinta cursor-pointer shrink-0"
        >
          {reproduciendo ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>
        <button
          type="button"
          onClick={alReiniciar}
          aria-label="Volver al inicio"
          className="flex items-center justify-center w-10 h-10 border border-[#45474d] hover:bg-[#222327] cursor-pointer shrink-0"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <label htmlFor="barra-tiempo" className="sr-only">
          Posición en la línea de tiempo
        </label>
        <input
          id="barra-tiempo"
          type="range"
          min={0}
          max={linea.duracion}
          step={0.1}
          value={Math.min(tiempo, linea.duracion)}
          onChange={(e) => alBuscar(Number(e.target.value))}
          className="flex-1 min-w-0 accent-[#ff6b2c] cursor-pointer"
        />
        <span className="font-mono text-xs tabular-nums shrink-0 text-right">
          {formatearTiempo(tiempo)} / {formatearTiempo(linea.duracion)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.1em] text-[#b5b0a4]">RECORRIDO</span>
          <div className="flex" role="group" aria-label="Recorrido de la línea de tiempo">
            <button type="button" onClick={() => alElegirRecorrido('todos')} aria-pressed={seleccion === 'todos'} className={claseOpcion(seleccion === 'todos')}>
              Todos
            </button>
            {recorridos.map((numero) => (
              <button key={numero} type="button" onClick={() => alElegirRecorrido(numero)} aria-pressed={seleccion === numero} className={claseOpcion(seleccion === numero)}>
                {numero}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.1em] text-[#b5b0a4]">VELOCIDAD</span>
          <div className="flex" role="group" aria-label="Velocidad">
            {VELOCIDADES.map((opcion) => (
              <button key={opcion} type="button" onClick={() => alCambiarVelocidad(opcion)} aria-pressed={velocidad === opcion} className={claseOpcion(velocidad === opcion)}>
                {opcion}×
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-5 ml-auto">
          <Contador titulo="METROS" valor={formatearNumero(estado?.distancia_m ?? 0, 1)} detalle={`/ ${formatearNumero(linea.distancia_total_m, 1)}`} />
          <Contador titulo="TIEMPO" valor={formatearTiempo(tiempo)} detalle={`/ ${formatearTiempo(linea.duracion)}`} />
          <Contador
            titulo="PARADAS"
            valor={`${estado?.paradas_completas ?? 0}/${linea.total_paradas}`}
            detalle={estado?.en_parada ? 'recogiendo' : 'visitadas'}
          />
        </div>
      </div>
    </div>
  );
};
