import React from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { formatearTiempo } from '../../utils/animacion';

export const VELOCIDADES = [1, 2, 4];

interface LineaTiempoProps {
  duracion: number;
  tiempo: number;
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
  `h-9 px-3 text-xs font-bold border border-tinta cursor-pointer transition-colors ${activa ? 'bg-tinta text-papel' : 'bg-slate-50 text-tinta hover:bg-white'}`;

/** Controles de reproducción: play/pausa, velocidad, barra arrastrable y selector de recorrido. */
export const LineaTiempo: React.FC<LineaTiempoProps> = ({
  duracion,
  tiempo,
  reproduciendo,
  velocidad,
  recorridos,
  seleccion,
  alReproducir,
  alReiniciar,
  alCambiarVelocidad,
  alBuscar,
  alElegirRecorrido,
}) => (
  <div className="bg-tinta text-papel p-4 flex flex-col gap-3">
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={alReproducir}
        aria-label={reproduciendo ? 'Pausar' : 'Reproducir'}
        className="flex items-center justify-center w-11 h-11 bg-senal hover:bg-senal-claro text-tinta cursor-pointer shrink-0"
      >
        {reproduciendo ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
      </button>
      <button
        type="button"
        onClick={alReiniciar}
        aria-label="Volver al inicio"
        className="flex items-center justify-center w-11 h-11 border border-[#45474d] hover:bg-[#222327] cursor-pointer shrink-0"
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
        max={duracion}
        step={0.1}
        value={Math.min(tiempo, duracion)}
        onChange={(e) => alBuscar(Number(e.target.value))}
        className="flex-1 accent-[#ff6b2c] cursor-pointer"
      />
      <span className="font-mono text-sm tabular-nums shrink-0 w-[92px] text-right">
        {formatearTiempo(tiempo)} / {formatearTiempo(duracion)}
      </span>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] tracking-[0.1em] text-[#b5b0a4]">RECORRIDO</span>
        <div className="flex">
          {recorridos.map((numero) => (
            <button
              key={numero}
              type="button"
              onClick={() => alElegirRecorrido(numero)}
              aria-pressed={seleccion === numero}
              className={`${claseOpcion(seleccion === numero)} border-[#45474d] ${seleccion === numero ? '!bg-papel !text-tinta' : '!bg-transparent !text-papel hover:!bg-[#222327]'}`}
            >
              {numero}
            </button>
          ))}
          <button
            type="button"
            onClick={() => alElegirRecorrido('todos')}
            aria-pressed={seleccion === 'todos'}
            className={`${claseOpcion(seleccion === 'todos')} border-[#45474d] ${seleccion === 'todos' ? '!bg-papel !text-tinta' : '!bg-transparent !text-papel hover:!bg-[#222327]'}`}
          >
            Todos seguidos
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] tracking-[0.1em] text-[#b5b0a4]">VELOCIDAD</span>
        <div className="flex">
          {VELOCIDADES.map((opcion) => (
            <button
              key={opcion}
              type="button"
              onClick={() => alCambiarVelocidad(opcion)}
              aria-pressed={velocidad === opcion}
              className={`${claseOpcion(velocidad === opcion)} border-[#45474d] ${velocidad === opcion ? '!bg-papel !text-tinta' : '!bg-transparent !text-papel hover:!bg-[#222327]'}`}
            >
              {opcion}×
            </button>
          ))}
        </div>
      </div>
    </div>
  </div>
);
