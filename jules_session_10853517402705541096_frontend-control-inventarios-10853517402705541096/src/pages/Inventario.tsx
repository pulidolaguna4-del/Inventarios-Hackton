import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Package } from 'lucide-react';
import { EncabezadoPagina } from '../components/ui/EncabezadoPagina';
import { BotonSiguiente } from '../components/ui/BotonSiguiente';
import { VistaReferencias } from '../components/inventario/VistaReferencias';
import { VistaAnio } from '../components/inventario/VistaAnio';

type VistaInventario = 'referencias' | 'anio';

const VISTAS: { valor: VistaInventario; etiqueta: string }[] = [
  { valor: 'referencias', etiqueta: 'Referencias' },
  { valor: 'anio', etiqueta: 'Año' },
];

const claseSegmento = (activo: boolean) =>
  `h-10 px-4 text-xs font-bold uppercase tracking-wide border border-tinta -ml-px first:ml-0 cursor-pointer transition-colors ${
    activo ? 'bg-tinta text-papel' : 'bg-slate-50 text-tinta hover:bg-white'
  }`;

/**
 * Paso 3 del flujo: cómo quedó el inventario. Une el maestro de referencias y la vista del
 * año en una sola pantalla (?vista=anio). Si llega ?sorteo=N desde el Paso 2, la vista de
 * referencias arranca filtrada en lo que se contó en ese sorteo.
 */
export const Inventario: React.FC = () => {
  const [parametros, setParametros] = useSearchParams();
  const vista: VistaInventario = parametros.get('vista') === 'anio' ? 'anio' : 'referencias';
  const sorteo = Number(parametros.get('sorteo')) || null;

  /** Cambia un parámetro de la URL y conserva los demás. */
  const cambiarParametro = (clave: string, valor: string | null) => {
    const siguientes = new URLSearchParams(parametros);
    if (valor === null) siguientes.delete(clave);
    else siguientes.set(clave, valor);
    setParametros(siguientes);
  };

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo="Inventario"
        seccion="PASO 3 · CÓMO QUEDÓ"
        descripcion="Las 123 referencias con su clase ABC, ubicación y conteos del año (X/5), y la vista del año con los 5 periodos de conteo, los sorteos y quién contó qué."
        icono={Package}
        acciones={
          <div className="flex" role="tablist" aria-label="Vista del inventario">
            {VISTAS.map((opcion) => (
              <button
                key={opcion.valor}
                type="button"
                role="tab"
                aria-selected={vista === opcion.valor}
                onClick={() => cambiarParametro('vista', opcion.valor === 'anio' ? 'anio' : null)}
                className={claseSegmento(vista === opcion.valor)}
              >
                {opcion.etiqueta}
              </button>
            ))}
          </div>
        }
      />

      {vista === 'anio' ? <VistaAnio /> : <VistaReferencias sorteo={sorteo} alQuitarSorteo={() => cambiarParametro('sorteo', null)} />}

      <BotonSiguiente to="/informes" paso={4} texto="Ver informes" detalle="Cumplimiento del año y archivos de entrega" />
    </div>
  );
};
