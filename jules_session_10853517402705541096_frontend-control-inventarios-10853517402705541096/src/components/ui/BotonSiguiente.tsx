import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

interface BotonSiguienteProps {
  /** Ruta del paso que sigue, con su contexto en la URL (ej. "/recorrido?origen=sorteo&sorteo=7"). */
  to: string;
  /** Número del paso al que lleva (1 a 4). */
  paso: number;
  texto: string;
  /** Línea corta debajo del texto, ej. "12 referencias en 4 recorridos". */
  detalle?: string;
}

/** Botón grande al final de cada paso que lleva al paso siguiente. */
export const BotonSiguiente: React.FC<BotonSiguienteProps> = ({ to, paso, texto, detalle }) => (
  <Link
    to={to}
    className="group flex items-center justify-between gap-4 w-full px-6 py-5 bg-tinta text-papel border-b-[3px] border-senal no-underline hover:bg-slate-800 transition-colors"
  >
    <span className="flex items-center gap-4">
      <span className="titulo-senal flex items-center justify-center w-10 h-10 bg-senal text-tinta text-xl shrink-0">{paso}</span>
      <span className="flex flex-col">
        <span className="titulo-senal text-xl sm:text-2xl">{texto}</span>
        {detalle && <span className="font-mono text-xs text-[#b5b0a4]">{detalle}</span>}
      </span>
    </span>
    <ArrowRight className="w-7 h-7 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden="true" />
  </Link>
);
