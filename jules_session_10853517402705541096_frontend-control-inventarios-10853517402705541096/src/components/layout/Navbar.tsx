import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

interface NavbarProps {
  semanaActual: number | null;
  sorteoActual: number | null;
  conectado: boolean;
}

// El flujo de uso en 4 pasos: sortear qué contar, recorrer y contar, ver el inventario
// y sacar los informes. /pedidos sigue existiendo, pero se abre desde el Paso 2.
const RUTAS_MENU = [
  { to: '/sortear', paso: 1, label: 'Sortear' },
  { to: '/recorrido', paso: 2, label: 'Recorrido y conteo' },
  { to: '/inventario', paso: 3, label: 'Inventario' },
  { to: '/informes', paso: 4, label: 'Informes' },
];

/** Índice de la opción que corresponde a la ruta actual (-1 si ninguna). */
function indiceActivo(ruta: string): number {
  return RUTAS_MENU.findIndex((item) => ruta.startsWith(item.to));
}

/**
 * Barra superior: marca, los cuatro pasos con un indicador que se desliza hasta
 * el paso activo, la semana y el sorteo actuales y el estado de conexión.
 * En pantallas pequeñas los pasos se abren desde un botón de menú.
 */
export const Navbar: React.FC<NavbarProps> = ({ semanaActual, sorteoActual, conectado }) => {
  const { pathname } = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const activo = indiceActivo(pathname);

  const colorPaso = (esActivo: boolean) => (esActivo ? 'text-senal' : 'text-[#8e897d]');

  return (
    <header className="sticky top-0 z-30 bg-tinta text-papel border-b-[3px] border-senal">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-[68px] flex items-center gap-7">
        {/* Marca */}
        <NavLink to="/sortear" className="flex items-center gap-2.5 shrink-0 text-papel no-underline">
          <span className="titulo-senal flex items-center justify-center w-[34px] h-[34px] bg-senal text-tinta text-[15px]">CA</span>
          <span className="flex flex-col leading-tight">
            <span className="titulo-senal text-[17px] tracking-[0.04em]">Centauros</span>
            <span className="font-mono text-[11px] tracking-[0.08em] text-[#b5b0a4]">BODEGA S3 · ARAUCA</span>
          </span>
        </NavLink>

        {/* Secciones (escritorio) */}
        <nav aria-label="Principal" className="hidden lg:grid relative flex-1 grid-cols-4 h-[68px]">
          {RUTAS_MENU.map((item, indice) => {
            const esActivo = indice === activo;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`nav-item relative flex items-center justify-center gap-2 px-1.5 text-sm font-semibold whitespace-nowrap ${
                  esActivo ? 'text-white' : 'text-[#b5b0a4]'
                }`}
                style={{ animationDelay: `${indice * 0.04}s` }}
              >
                <span className={`titulo-senal text-[15px] ${colorPaso(esActivo)}`}>{item.paso}</span>
                <span>{item.label}</span>
                <span className="nav-rayita absolute left-[22%] right-[22%] bottom-3.5 h-px bg-[#8e897d]" aria-hidden="true" />
              </NavLink>
            );
          })}
          {activo >= 0 && (
            <span
              className="nav-indicador absolute left-0 -bottom-[3px] h-[3px] bg-papel"
              style={{ width: `calc(100% / ${RUTAS_MENU.length})`, transform: `translateX(${activo * 100}%)` }}
              aria-hidden="true"
            />
          )}
        </nav>

        {/* Semana, sorteo y conexión */}
        <div className="hidden lg:flex items-center gap-3.5 shrink-0">
          {semanaActual !== null && (
            <span className="font-mono text-xs border border-[#45474d] px-2.5 py-1.5" title="Semana del año y último sorteo de conteo">
              SEM {semanaActual}
              {sorteoActual !== null && ` · SORTEO ${sorteoActual}`}
            </span>
          )}
          <span className="flex items-center gap-2 text-xs text-[#b5b0a4]">
            <span className={`w-2 h-2 rounded-full ${conectado ? 'bg-green-400 nav-punto-vivo' : 'bg-red-500'}`} />
            {conectado ? 'En línea' : 'Sin conexión'}
          </span>
        </div>

        {/* Botón de menú (móvil) */}
        <button
          type="button"
          onClick={() => setMenuAbierto(!menuAbierto)}
          aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuAbierto}
          className="lg:hidden ml-auto flex items-center justify-center w-11 h-11 border border-[#45474d] text-papel cursor-pointer"
        >
          {menuAbierto ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Menú desplegable (móvil) */}
      {menuAbierto && (
        <nav aria-label="Principal" className="nav-menu-movil lg:hidden border-t border-slate-800 px-4 pt-2 pb-4 flex flex-col">
          {RUTAS_MENU.map((item, indice) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMenuAbierto(false)}
              className={`flex items-center justify-between min-h-12 px-2 border-b border-slate-800 text-base font-semibold ${
                indice === activo ? 'text-white' : 'text-[#b5b0a4]'
              }`}
            >
              <span className="flex items-center gap-3">
                <span className={`titulo-senal text-[15px] ${colorPaso(indice === activo)}`}>{item.paso}</span>
                {item.label}
              </span>
            </NavLink>
          ))}
          <span className="flex items-center justify-between pt-3 px-2 font-mono text-xs text-[#b5b0a4]">
            <span>
              {semanaActual !== null && `SEM ${semanaActual}`}
              {sorteoActual !== null && ` · SORTEO ${sorteoActual}`}
            </span>
            <span className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${conectado ? 'bg-green-400 nav-punto-vivo' : 'bg-red-500'}`} />
              {conectado ? 'En línea' : 'Sin conexión'}
            </span>
          </span>
        </nav>
      )}
    </header>
  );
};
