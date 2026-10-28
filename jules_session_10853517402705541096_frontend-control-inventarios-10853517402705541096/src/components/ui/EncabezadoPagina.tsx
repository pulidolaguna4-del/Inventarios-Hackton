import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface EncabezadoPaginaProps {
  titulo: string;
  descripcion: string;
  icono: LucideIcon;
  /** Ruta corta que va arriba del título, ej. "INVENTARIO / CONTEO CÍCLICO". */
  seccion?: string;
  /** Botones u otros controles que van a la derecha. */
  acciones?: React.ReactNode;
}

/** Encabezado de cada página con título tipo señalización. */
export const EncabezadoPagina: React.FC<EncabezadoPaginaProps> = ({
  titulo,
  descripcion,
  icono: Icono,
  seccion = 'INVENTARIO',
  acciones,
}) => (
  <div className="flex flex-wrap items-end justify-between gap-5 border-b border-slate-200 pb-6">
    <div className="flex flex-col gap-2 max-w-3xl">
      <span className="flex items-center gap-1.5 font-mono text-xs tracking-[0.12em] text-slate-500">
        <Icono className="w-3.5 h-3.5" aria-hidden="true" />
        {seccion}
      </span>
      <h1 className="titulo-senal m-0 text-4xl sm:text-[52px]">{titulo}</h1>
      <p className="m-0 text-[15px] leading-relaxed text-slate-600">{descripcion}</p>
    </div>
    {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
  </div>
);

/** Clases de los botones y campos, para que todas las páginas se vean igual. */
export const CLASE_BOTON_PRINCIPAL =
  'flex items-center gap-1.5 px-4 h-10 bg-tinta hover:bg-slate-800 text-papel text-xs font-bold uppercase tracking-wide transition-all active:translate-y-px cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
export const CLASE_BOTON_SECUNDARIO =
  'flex items-center gap-1.5 px-4 h-10 bg-slate-50 hover:bg-white text-tinta border border-tinta text-xs font-bold uppercase tracking-wide transition-all active:translate-y-px cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
export const CLASE_CAMPO =
  'w-full p-2.5 border border-slate-300 bg-white text-sm font-medium focus:outline-hidden focus:border-tinta focus:ring-2 focus:ring-senal/40';
