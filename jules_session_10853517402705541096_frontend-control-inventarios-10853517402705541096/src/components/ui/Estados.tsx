import React from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, X } from 'lucide-react';

// Componentes pequeños para mostrar carga, errores y avisos de forma uniforme en todas las páginas.

export const Cargando: React.FC<{ texto?: string }> = ({ texto = 'Cargando datos...' }) => (
  <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
    <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent"></div>
    <p className="text-sm font-medium text-slate-500">{texto}</p>
  </div>
);

export const ErrorCarga: React.FC<{ mensaje: string; onReintentar?: () => void }> = ({ mensaje, onReintentar }) => (
  <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
    <div className="flex items-center gap-2 text-sm font-medium">
      <AlertTriangle className="w-5 h-5 shrink-0" />
      {mensaje}
    </div>
    {onReintentar && (
      <button
        onClick={onReintentar}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white border border-rose-200 rounded-lg hover:bg-rose-100 cursor-pointer"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Reintentar
      </button>
    )}
  </div>
);

export interface MensajeAviso {
  tipo: 'exito' | 'error';
  texto: string;
}

export const Aviso: React.FC<{ aviso: MensajeAviso | null; onCerrar: () => void }> = ({ aviso, onCerrar }) => {
  if (!aviso) return null;
  const esError = aviso.tipo === 'error';
  const Icono = esError ? AlertTriangle : CheckCircle2;
  return (
    <div
      className={`flex items-start justify-between gap-3 p-3.5 rounded-xl border text-sm font-medium ${
        esError ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
      }`}
    >
      <div className="flex items-start gap-2">
        <Icono className="w-5 h-5 shrink-0" />
        <span>{aviso.texto}</span>
      </div>
      <button onClick={onCerrar} className="opacity-60 hover:opacity-100 cursor-pointer">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

/** Barra de progreso "contada X/5" de una referencia. */
export const BarraConteos: React.FC<{ contados: number; maximo?: number; conDiferencia?: boolean }> = ({
  contados,
  maximo = 5,
  conDiferencia = false,
}) => {
  const completa = contados >= maximo;
  return (
    <div className="flex items-center gap-2 min-w-[130px]">
      <div className="flex gap-0.5">
        {Array.from({ length: maximo }, (_, indice) => (
          <span
            key={indice}
            className={`w-3.5 h-2.5 rounded-sm ${
              indice < contados ? (completa ? 'bg-emerald-500' : 'bg-indigo-500') : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
      <span className={`text-xs font-bold ${completa ? 'text-emerald-700' : 'text-slate-600'}`}>
        {contados}/{maximo}
      </span>
      {conDiferencia && (
        <span title="Tuvo diferencias en algún conteo">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
        </span>
      )}
    </div>
  );
};
