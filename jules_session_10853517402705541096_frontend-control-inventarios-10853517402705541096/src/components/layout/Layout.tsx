import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Menu } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  semanaActual: number | null;
  semilla: number | null;
  conectado: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, semanaActual, semilla, conectado }) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      <Sidebar isMobileOpen={isMobileOpen} onToggleMobile={() => setIsMobileOpen(!isMobileOpen)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Barra superior en móvil */}
        <div className="lg:hidden bg-slate-900 text-white p-3 flex items-center justify-between border-b border-slate-800">
          <button onClick={() => setIsMobileOpen(true)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300">
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-bold text-sm tracking-tight">INVEN-CONTROL</span>
          {semanaActual !== null && (
            <span className="text-xs bg-indigo-600 px-2 py-0.5 rounded font-semibold">Sem {semanaActual}</span>
          )}
        </div>

        <Header semanaActual={semanaActual} semilla={semilla} conectado={conectado} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">{children}</main>
      </div>
    </div>
  );
};
