import React from 'react';
import { useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';

interface LayoutProps {
  children: React.ReactNode;
  semanaActual: number | null;
  sorteoActual: number | null;
  conectado: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, semanaActual, sorteoActual, conectado }) => {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-papel">
      <Navbar semanaActual={semanaActual} sorteoActual={sorteoActual} conectado={conectado} />
      {/* La clave hace que cada página entre con su animación al cambiar de sección. */}
      <main key={pathname} className="pagina-entrar max-w-[1280px] mx-auto px-4 sm:px-6 pt-8 pb-16 space-y-6">
        {children}
      </main>
    </div>
  );
};
