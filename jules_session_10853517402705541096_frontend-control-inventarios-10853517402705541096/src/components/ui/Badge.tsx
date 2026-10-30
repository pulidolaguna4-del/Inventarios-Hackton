import React from 'react';
import type { ClaseAbc } from '../../types/inventario';

export type TonoBadge = 'indigo' | 'emerald' | 'amber' | 'rose' | 'blue' | 'purple' | 'slate';

interface BadgeProps {
  label: string;
  tono?: TonoBadge;
  size?: 'sm' | 'md';
}

const ESTILOS_TONO: Record<TonoBadge, string> = {
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  slate: 'bg-slate-100 text-slate-600 border-slate-300',
};

export const Badge: React.FC<BadgeProps> = ({ label, tono = 'slate', size = 'md' }) => {
  const tamano = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';
  return (
    <span className={`inline-flex items-center rounded-full border whitespace-nowrap ${tamano} ${ESTILOS_TONO[tono]}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-75"></span>
      {label}
    </span>
  );
};

const TONO_POR_CLASE: Record<ClaseAbc, TonoBadge> = { A: 'emerald', B: 'amber', C: 'slate' };

export const BadgeClase: React.FC<{ clase: ClaseAbc }> = ({ clase }) => (
  <Badge label={`Clase ${clase}`} tono={TONO_POR_CLASE[clase]} size="sm" />
);
