import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Boxes, Route, Shuffle } from 'lucide-react';
import { Cargando, ErrorCarga } from '../components/ui/Estados';
import { useApi } from '../hooks/useApi';
import { useProgreso } from '../hooks/ProgresoContexto';
import { api } from '../services/api';
import { ARCHIVOS_ENTREGA } from '../utils/entregas';
import { formatearNumero } from '../utils/formato';
import type { ResumenConteo } from '../types/inventario';

/** Lo que sigue según el estado del conteo: el botón principal de la portada. */
function siguienteAccion(progreso: ResumenConteo): { to: string; texto: string; detalle: string } {
  const ultimo = progreso.sorteos[progreso.sorteos.length - 1];
  if (!ultimo) {
    return { to: '/sortear', texto: 'Empezar: sortear qué contar', detalle: `${progreso.cantidad_sorteo_por_defecto} referencias al azar por sorteo` };
  }
  const pendientes = ultimo.tamano - ultimo.registrados;
  if (pendientes > 0) {
    return {
      to: `/recorrido?origen=sorteo&sorteo=${ultimo.numero}`,
      texto: `Continuar: contar el sorteo ${ultimo.numero}`,
      detalle: `${ultimo.registrados} de ${ultimo.tamano} contadas · faltan ${pendientes}`,
    };
  }
  return { to: '/sortear', texto: 'Sortear el siguiente', detalle: `Sorteo ${ultimo.numero} completo · ${ultimo.tamano} referencias contadas` };
}

const Cifra: React.FC<{ titulo: string; valor: string; detalle: string }> = ({ titulo, valor, detalle }) => (
  <div className="flex flex-col gap-1 p-4 sm:p-5 bg-slate-50 border border-slate-200">
    <span className="font-mono text-[11px] tracking-[0.1em] text-slate-500">{titulo}</span>
    <span className="titulo-senal text-4xl sm:text-5xl tabular-nums">{valor}</span>
    <span className="text-xs text-slate-500">{detalle}</span>
  </div>
);

const TarjetaPaso: React.FC<{ paso: number; to: string; titulo: string; icono: typeof Shuffle; descripcion: string; estado: string }> = ({
  paso,
  to,
  titulo,
  icono: Icono,
  descripcion,
  estado,
}) => (
  <Link
    to={to}
    className="group flex flex-col gap-3 p-5 bg-slate-50 border border-slate-200 border-t-[3px] border-t-tinta hover:border-t-senal hover:bg-white no-underline text-tinta transition-colors"
  >
    <span className="flex items-center justify-between">
      <span className="titulo-senal flex items-center justify-center w-10 h-10 bg-tinta text-papel text-xl group-hover:bg-senal group-hover:text-tinta transition-colors">
        {paso}
      </span>
      <Icono className="w-5 h-5 text-slate-400 group-hover:text-senal transition-colors" aria-hidden="true" />
    </span>
    <span className="titulo-senal text-2xl">{titulo}</span>
    <span className="text-sm text-slate-600 leading-relaxed flex-1">{descripcion}</span>
    <span className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200 font-mono text-xs">
      {estado}
      <ArrowRight className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden="true" />
    </span>
  </Link>
);

/**
 * Portada (/): qué es el sistema, las cifras del año, el botón para seguir donde se quedó y
 * los 4 pasos del flujo con su estado actual.
 */
export const Inicio: React.FC = () => {
  const { datos: progreso, cargando, error, recargar } = useProgreso();
  const tarea6 = useApi(() => api.obtenerPickingPrueba());

  if (cargando && !progreso) return <Cargando texto="Cargando..." />;
  if (error && !progreso) return <ErrorCarga mensaje={error} onReintentar={recargar} />;
  if (!progreso) return null;

  const accion = siguienteAccion(progreso);
  const ultimo = progreso.sorteos[progreso.sorteos.length - 1];
  const periodo = progreso.periodos.find((p) => p.numero === progreso.periodo_actual);

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <section className="relative overflow-hidden bg-tinta text-papel border-b-[3px] border-senal px-6 py-10 sm:px-10 sm:py-14">
        {/* Franja de seguridad decorativa */}
        <span
          className="absolute top-0 right-0 w-40 h-3 sm:w-64"
          style={{ background: 'repeating-linear-gradient(-45deg, #ff6b2c 0 12px, #17181a 12px 24px)' }}
          aria-hidden="true"
        />
        <span className="font-mono text-xs tracking-[0.14em] text-[#b5b0a4]">DISTRIBUCIONES CENTAUROS · BODEGA SATÉLITE DE ARAUCA</span>
        <h1 className="titulo-senal text-5xl sm:text-7xl mt-3 max-w-3xl">
          Conteo cíclico <span className="text-senal">y recorridos</span>
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[#d9d4c7]">
          Cada referencia se cuenta exactamente {progreso.conteos_por_anio} veces al año, en sorteos al azar y con su responsable. El carrito
          recorre las ubicaciones sorteadas con la misma ruta óptima de la Tarea 6: máximo 3 ubicaciones por recorrido.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4">
          <Link
            to={accion.to}
            className="group flex items-center justify-between gap-6 px-5 py-4 bg-senal hover:bg-senal-claro text-tinta no-underline transition-colors"
          >
            <span className="flex flex-col">
              <span className="titulo-senal text-xl sm:text-2xl">{accion.texto}</span>
              <span className="font-mono text-xs">{accion.detalle}</span>
            </span>
            <ArrowRight className="w-7 h-7 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </Link>
          <Link to="/recorrido?origen=prueba" className="text-sm font-semibold text-papel underline underline-offset-4 hover:text-senal">
            Ver la Tarea 6 en el mapa 3D
          </Link>
        </div>
      </section>

      {/* Cifras del año */}
      <section aria-label="Cifras del año" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Cifra titulo="REFERENCIAS" valor={String(progreso.referencias)} detalle="Universo del maestro: ventas de 2018 y nuevas" />
        <Cifra
          titulo="CONTEOS DEL AÑO"
          valor={formatearNumero(progreso.conteos_totales, 0)}
          detalle={`${progreso.referencias} × ${progreso.conteos_por_anio} · ${progreso.conteos_registrados} hechos`}
        />
        <Cifra titulo="CUMPLIMIENTO" valor={`${progreso.cumplimiento}%`} detalle={`${progreso.referencias_completas} referencias con sus ${progreso.conteos_por_anio} conteos`} />
        <Cifra
          titulo="TAREA 6"
          valor={tarea6.datos ? `${formatearNumero(tarea6.datos.totales.distancia_m, 1)} m` : '—'}
          detalle={tarea6.datos ? `${tarea6.datos.totales.recorridos} recorridos · método ${tarea6.datos.metodo}` : 'Calculando…'}
        />
      </section>

      {/* Los 4 pasos */}
      <section aria-label="Pasos del flujo" className="space-y-3">
        <h2 className="font-mono text-xs tracking-[0.14em] text-slate-500">CÓMO SE USA · 4 PASOS</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <TarjetaPaso
            paso={1}
            to="/sortear"
            titulo="Sortear"
            icono={Shuffle}
            descripcion="Elige al azar las referencias a contar entre las que llevan menos conteos. Ninguna pasa de 5 en el año."
            estado={ultimo ? `Último: sorteo ${ultimo.numero} · ${ultimo.tamano} referencias` : 'Aún no hay sorteos'}
          />
          <TarjetaPaso
            paso={2}
            to={ultimo ? `/recorrido?origen=sorteo&sorteo=${ultimo.numero}` : '/recorrido'}
            titulo="Recorrido y conteo"
            icono={Route}
            descripcion="El carrito visita las ubicaciones del sorteo en el mapa 3D y el conteo se registra en el orden del recorrido."
            estado={ultimo ? `${ultimo.registrados} de ${ultimo.tamano} contadas` : 'Sin sorteo que recorrer'}
          />
          <TarjetaPaso
            paso={3}
            to="/inventario"
            titulo="Inventario"
            icono={Boxes}
            descripcion="El maestro con su clase ABC y ubicación, los conteos X/5 de cada referencia y la vista del año por periodos."
            estado={periodo ? `Periodo ${periodo.nombre}: ${periodo.referencias_contadas}/${periodo.referencias_totales}` : `${progreso.referencias} referencias`}
          />
          <TarjetaPaso
            paso={4}
            to="/informes"
            titulo="Informes"
            icono={BarChart3}
            descripcion="Indicadores del año, la verificación de los sorteos y los archivos de entrega en Excel con su nombre exacto."
            estado={`${ARCHIVOS_ENTREGA.length} archivos de entrega`}
          />
        </div>
      </section>
    </div>
  );
};
