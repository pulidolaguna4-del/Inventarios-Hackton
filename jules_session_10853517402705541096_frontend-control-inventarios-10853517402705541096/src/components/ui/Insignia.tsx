import React from 'react';

export type TonoInsignia = 'neutro' | 'acento' | 'exito' | 'aviso' | 'peligro';

interface InsigniaProps {
  tono?: TonoInsignia;
  /** Ícono pequeño antes del texto (ej. un check). */
  icono?: React.ReactNode;
  children: React.ReactNode;
}

/** Píldora de estado: fondo suave y texto oscuro del mismo tono (colores en index.css, --insignia-*). */
export const Insignia: React.FC<InsigniaProps> = ({ tono = 'neutro', icono, children }) => (
  <span className="insignia" data-tono={tono}>
    {icono}
    {children}
  </span>
);
