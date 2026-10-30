import React from 'react';
import { Search } from 'lucide-react';

export interface FiltroSelect {
  etiqueta: string;
  valor: string;
  opciones: { valor: string; texto: string }[];
  alCambiar: (valor: string) => void;
}

interface FiltrosTablaProps {
  busqueda?: string;
  alBuscar?: (texto: string) => void;
  marcador?: string;
  filtros?: FiltroSelect[];
  /** Texto a la derecha, ej. "15 de 123 referencias". */
  resumen?: React.ReactNode;
  children?: React.ReactNode;
}

/** Barra de búsqueda y filtros que va encima de una Tabla (mismo estilo redondeado). */
export const FiltrosTabla: React.FC<FiltrosTablaProps> = ({ busqueda, alBuscar, marcador = 'Buscar...', filtros = [], resumen, children }) => (
  <div className="flex flex-wrap items-center gap-2">
    {alBuscar && (
      <label className="relative flex-1 min-w-[220px] max-w-md">
        <span className="sr-only">{marcador}</span>
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          value={busqueda ?? ''}
          onChange={(e) => alBuscar(e.target.value)}
          placeholder={marcador}
          className="w-full h-10 pl-9 pr-3 rounded-[10px] border border-[var(--tabla-input-borde)] bg-[var(--tabla-superficie)] text-sm focus:outline-none focus:border-[var(--tabla-acento)] focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--tabla-acento)_30%,transparent)]"
        />
      </label>
    )}
    {filtros.map((filtro) => (
      <label key={filtro.etiqueta} className="flex items-center">
        <span className="sr-only">{filtro.etiqueta}</span>
        <select
          value={filtro.valor}
          onChange={(e) => filtro.alCambiar(e.target.value)}
          className="h-10 px-3 rounded-[10px] border border-[var(--tabla-input-borde)] bg-[var(--tabla-superficie)] text-sm cursor-pointer focus:outline-none focus:border-[var(--tabla-acento)] focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--tabla-acento)_30%,transparent)]"
        >
          {filtro.opciones.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.texto}
            </option>
          ))}
        </select>
      </label>
    ))}
    {children}
    {resumen && <span className="ml-auto text-xs text-slate-500">{resumen}</span>}
  </div>
);
