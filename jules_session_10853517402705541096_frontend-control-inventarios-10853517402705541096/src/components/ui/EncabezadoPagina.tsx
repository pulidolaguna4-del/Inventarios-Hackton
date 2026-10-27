import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface EncabezadoPaginaProps {
  titulo: string;
  descripcion: string;
  icono: LucideIcon;
  /** Botones u otros controles que van a la derecha. */
  acciones?: React.ReactNode;
}

export const EncabezadoPagina: React.FC<EncabezadoPaginaProps> = ({ titulo, descripcion, icono: Icono, acciones }) => (
  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
    <div>
      <div className="flex items-center gap-2">
        <Icono className="w-6 h-6 text-indigo-600" />
        <h2 className="text-xl font-bold text-slate-900">{titulo}</h2>
      </div>
      <p className="text-xs text-slate-500 mt-1 max-w-3xl">{descripcion}</p>
    </div>
    {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
  </div>
);

/** Clases de los botones, para que todas las páginas se vean igual. */
export const CLASE_BOTON_PRINCIPAL =
  'flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
export const CLASE_BOTON_SECUNDARIO =
  'flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
export const CLASE_CAMPO =
  'w-full p-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500';
