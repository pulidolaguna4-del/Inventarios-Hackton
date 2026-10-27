import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  CalendarDays,
  ClipboardCheck,
  Truck,
  Route,
  BarChart3,
  Boxes,
  X,
} from 'lucide-react';

interface SidebarProps {
  isMobileOpen: boolean;
  onToggleMobile: () => void;
}

const RUTAS_MENU = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/referencias', label: 'Maestro de Referencias', icon: Package },
  { to: '/plan-conteo', label: 'Plan de Conteo Anual', icon: CalendarDays },
  { to: '/registro-conteos', label: 'Registro de Conteos', icon: ClipboardCheck },
  { to: '/pedidos', label: 'Pedidos', icon: Truck },
  { to: '/picking', label: 'Picking (informativo)', icon: Route },
  { to: '/reportes', label: 'Reportes y Exportación', icon: BarChart3 },
];

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen, onToggleMobile }) => {
  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300 w-64 border-r border-slate-800">
      {/* Marca */}
      <div className="p-5 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-white text-base tracking-tight">INVEN-CONTROL</h2>
            <p className="text-xs text-slate-400">Bodega satélite Arauca</p>
          </div>
        </div>
        <button onClick={onToggleMobile} className="lg:hidden text-slate-400 hover:text-white p-1">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navegación */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        <div className="px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Menú Principal</div>
        {RUTAS_MENU.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => isMobileOpen && onToggleMobile()}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all text-sm font-medium ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md font-semibold'
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                }`
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Reglas del caso */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-xs text-slate-400">
        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-800">
          <p className="font-semibold text-slate-300">Reglas del conteo cíclico</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            Cada referencia se cuenta exactamente 5 veces al año, elegida al azar. Al llegar a 5 sale de la lista.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Fondo oscuro en móvil */}
      {isMobileOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-xs" onClick={onToggleMobile} />
      )}

      {/* Menú deslizable en móvil */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform lg:hidden transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>

      {/* Menú fijo en escritorio */}
      <aside className="hidden lg:block shrink-0">{sidebarContent}</aside>
    </>
  );
};
