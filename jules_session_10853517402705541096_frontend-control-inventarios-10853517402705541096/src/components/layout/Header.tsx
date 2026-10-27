import React from 'react';
import { Calendar, Wifi, WifiOff, Hash } from 'lucide-react';

interface HeaderProps {
  semanaActual: number | null;
  semilla: number | null;
  conectado: boolean;
}

export const Header: React.FC<HeaderProps> = ({ semanaActual, semilla, conectado }) => {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-slate-800 tracking-tight">Control de Inventarios — Arauca</h1>
        {semanaActual !== null && (
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
            <Calendar className="w-3.5 h-3.5" />
            Semana actual: {semanaActual}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 ml-auto sm:ml-0">
        {semilla !== null && (
          <span
            className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 text-xs font-medium"
            title="Semilla del plan de conteo: la misma semilla siempre genera el mismo plan"
          >
            <Hash className="w-3.5 h-3.5" />
            Semilla del plan: {semilla}
          </span>
        )}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-medium ${
            conectado
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}
        >
          {conectado ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          <span>{conectado ? 'Backend conectado' : 'Sin conexión al backend'}</span>
        </div>
      </div>
    </header>
  );
};
