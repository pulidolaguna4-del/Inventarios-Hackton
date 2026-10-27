import React from 'react';
import { Route, Timer, MapPin, Info, AlertTriangle } from 'lucide-react';
import { StatCard } from '../components/ui/StatCard';
import { Cargando, ErrorCarga } from '../components/ui/Estados';
import { formatearNumero } from '../utils/formato';
import { EncabezadoPagina } from '../components/ui/EncabezadoPagina';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';

/** Texto de los niveles de una parada: N1, N2 o N1+N2. */
function textoNiveles(niveles: number[]): string {
  return niveles.map((nivel) => `N${nivel}`).join('+');
}

export const Picking: React.FC = () => {
  const { datos, cargando, error, recargar } = useApi(api.obtenerPickingPrueba);

  if (cargando && !datos) return <Cargando texto="Calculando trayectos..." />;
  if (error) return <ErrorCarga mensaje={error} onReintentar={recargar} />;
  if (!datos) return null;

  const { totales, recorridos } = datos;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <EncabezadoPagina
        titulo="Picking — Pedido de la Tarea 6"
        descripcion="Dato informativo: cuánto tarda cada trayecto del pedido de prueba y cuál es el más demorado. La optimización de recorridos está pospuesta."
        icono={Route}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Trayectos" value={totales.recorridos} description={`${totales.ubicaciones} ubicaciones, máx. 3 por trayecto`} icon={Route} colorTheme="indigo" />
        <StatCard title="Distancia total" value={`${formatearNumero(totales.distancia_m)} m`} description="Ida y vuelta por la salida" icon={MapPin} colorTheme="blue" />
        <StatCard title="Tiempo total" value={`${formatearNumero(totales.tiempo_total_s, 1)} s`} description="Caminar + recoger" icon={Timer} colorTheme="purple" />
        <StatCard
          title="Más demorado"
          value={`Trayecto ${totales.recorrido_mas_demorado ?? '—'}`}
          description={`${formatearNumero(totales.tiempo_mas_demorado_s, 1)} s`}
          icon={AlertTriangle}
          colorTheme="rose"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100/60 text-slate-600 text-xs font-bold uppercase tracking-wider">
              <th className="py-3.5 px-4">Trayecto</th>
              <th className="py-3.5 px-4">Salida</th>
              <th className="py-3.5 px-4">Posiciones (orden de visita)</th>
              <th className="py-3.5 px-4 text-right">Distancia (m)</th>
              <th className="py-3.5 px-4 text-right">Caminar (s)</th>
              <th className="py-3.5 px-4 text-right">Recoger (s)</th>
              <th className="py-3.5 px-4 text-right">Total (s)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {recorridos.map((recorrido) => (
              <tr key={recorrido.recorrido} className={recorrido.es_el_mas_demorado ? 'bg-rose-50' : ''}>
                <td className="py-3.5 px-4 font-bold">
                  {recorrido.recorrido}
                  {recorrido.es_el_mas_demorado && (
                    <span className="ml-2 text-[10px] font-bold uppercase text-rose-700 bg-rose-100 border border-rose-200 px-1.5 py-0.5 rounded">
                      Más demorado
                    </span>
                  )}
                </td>
                <td className="py-3.5 px-4">{recorrido.salida_inicio}</td>
                <td className="py-3.5 px-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {recorrido.paradas.map((parada, indice) => (
                      <React.Fragment key={parada.numero_plano}>
                        {indice > 0 && <span className="text-slate-400">→</span>}
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-xs font-bold">
                          {parada.numero_plano} <span className="font-medium text-slate-500">{textoNiveles(parada.niveles)}</span>
                        </span>
                      </React.Fragment>
                    ))}
                  </div>
                </td>
                <td className="py-3.5 px-4 text-right">{formatearNumero(recorrido.distancia_m)}</td>
                <td className="py-3.5 px-4 text-right">{formatearNumero(recorrido.tiempo_desplazamiento_s, 1)}</td>
                <td className="py-3.5 px-4 text-right">{formatearNumero(recorrido.tiempo_recogida_s, 1)}</td>
                <td className="py-3.5 px-4 text-right font-bold">{formatearNumero(recorrido.tiempo_total_s, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-start gap-2 p-4 bg-blue-50 text-blue-800 border border-blue-200 rounded-2xl text-xs leading-relaxed">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Supuestos (el caso no los da): velocidad del operario {totales.velocidad_m_s} m/s y recogida en nivel 1 de{' '}
          {totales.tiempo_recogida_nivel_1_s} s (T). El nivel 2 tarda 3T y ambos niveles 4T. El tiempo de recogida no cambia cuál es
          la mejor ruta, solo suma al total.
        </span>
      </div>
    </div>
  );
};
