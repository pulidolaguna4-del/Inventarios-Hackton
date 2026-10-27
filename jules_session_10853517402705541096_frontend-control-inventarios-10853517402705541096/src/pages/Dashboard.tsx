import React from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  CheckCircle2,
  CalendarDays,
  AlertTriangle,
  Award,
  TrendingUp,
  BarChart,
  PieChart as PieIcon,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { StatCard } from '../components/ui/StatCard';
import { Cargando, ErrorCarga } from '../components/ui/Estados';
import { formatearNumero } from '../utils/formato';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';

const COLORES = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
const ESTILO_TOOLTIP = { backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' };

async function cargarDashboard() {
  const [resumen, progreso, maestro] = await Promise.all([
    api.obtenerResumen(),
    api.obtenerProgresoConteo(),
    api.obtenerMaestro(),
  ]);
  return { resumen, progreso, maestro };
}

/** Cuenta cuántas referencias hay en cada categoría (para la gráfica de torta). */
function distribucionPorCategoria(categorias: string[]) {
  const conteo = new Map<string, number>();
  categorias.forEach((categoria) => conteo.set(categoria, (conteo.get(categoria) ?? 0) + 1));
  return Array.from(conteo, ([categoria, cantidad]) => ({ categoria, cantidad }));
}

export const Dashboard: React.FC = () => {
  const { datos, cargando, error, recargar } = useApi(cargarDashboard);

  if (cargando && !datos) return <Cargando texto="Cargando indicadores..." />;
  if (error) return <ErrorCarga mensaje={error} onReintentar={recargar} />;
  if (!datos) return null;

  const { resumen, progreso, maestro } = datos;
  const semanaActual = progreso.avance_semanal.find((fila) => fila.semana === progreso.semana_actual);
  const verificacion = progreso.verificacion_plan;
  const categorias = distribucionPorCategoria(maestro.referencias.map((referencia) => referencia.categoria));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Banner superior */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 rounded-2xl p-6 text-white shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mb-2">
            <Award className="w-3.5 h-3.5" />
            Bodega satélite {resumen.bodega}
          </span>
          <h2 className="text-2xl font-extrabold tracking-tight">Indicadores Clave del Control de Inventarios</h2>
          <p className="text-slate-300 text-sm mt-1 max-w-2xl">
            {resumen.referencias_totales} referencias ({resumen.referencias_ventas} con ventas y{' '}
            {resumen.referencias_nuevas} nuevas) · {formatearNumero(resumen.ordenes_bodega)} pedidos de{' '}
            {resumen.bodega} entre {resumen.fecha_inicial} y {resumen.fecha_final}.
          </p>
        </div>
        <button
          onClick={recargar}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Tarjetas de indicadores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Referencias"
          value={resumen.referencias_totales}
          description={`A: ${maestro.conteo_por_clase.A} · B: ${maestro.conteo_por_clase.B} · C: ${maestro.conteo_por_clase.C}`}
          icon={Package}
          colorTheme="indigo"
        />
        <StatCard
          title="Conteos registrados"
          value={`${progreso.conteos_registrados} / ${progreso.conteos_planeados}`}
          description="En el año"
          icon={TrendingUp}
          colorTheme="purple"
        />
        <StatCard
          title={`Semana ${progreso.semana_actual}`}
          value={`${semanaActual?.registrados ?? 0} / ${semanaActual?.planeados ?? 0}`}
          description="Contadas / programadas"
          icon={CalendarDays}
          colorTheme="blue"
        />
        <StatCard
          title="Completas (5/5)"
          value={progreso.referencias_completas}
          description="Ya salieron de la lista"
          icon={CheckCircle2}
          colorTheme="emerald"
        />
        <StatCard
          title="Con diferencia"
          value={progreso.referencias_con_diferencia}
          description="Referencias con faltantes o sobrantes"
          icon={AlertTriangle}
          colorTheme="rose"
        />
        <StatCard
          title="Cumplimiento"
          value={`${progreso.cumplimiento_a_la_fecha}%`}
          description={`Hasta la semana ${progreso.semana_actual}`}
          icon={Award}
          colorTheme="amber"
        />
      </div>

      {/* Verificación del plan anual */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border text-sm ${
          verificacion.valido ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}
      >
        <div className="flex items-center gap-2 font-medium">
          {verificacion.valido ? <ShieldCheck className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          {verificacion.valido
            ? `Plan anual verificado: ${verificacion.referencias} referencias × 5 = ${verificacion.total_conteos} conteos en ${verificacion.semanas} semanas, ninguna repetida en la misma semana.`
            : `El plan tiene errores: ${verificacion.errores.join(' · ')}`}
        </div>
        <Link to="/plan-conteo" className="text-xs font-bold underline underline-offset-2">
          Ver plan
        </Link>
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-800 text-base">Conteos programados vs. registrados por semana</h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">52 semanas</span>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={progreso.avance_semanal} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="semana" tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} interval={3} />
                <YAxis tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip contentStyle={ESTILO_TOOLTIP} labelFormatter={(semana) => `Semana ${semana}`} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="planeados" name="Programados" fill="#818cf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="registrados" name="Registrados" fill="#10b981" radius={[4, 4, 0, 0]} />
              </ReBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <PieIcon className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-base">Referencias por categoría</h3>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categorias}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="cantidad"
                  nameKey="categoria"
                >
                  {categorias.map((_, indice) => (
                    <Cell key={`celda-${indice}`} fill={COLORES[indice % COLORES.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={ESTILO_TOOLTIP} />
                <Legend wrapperStyle={{ fontSize: '11px' }} layout="horizontal" align="center" verticalAlign="bottom" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
