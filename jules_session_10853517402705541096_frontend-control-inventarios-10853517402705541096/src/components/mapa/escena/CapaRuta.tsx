import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { Line2 } from 'three-stdlib';
import type { EventoTramo } from '../../../types/inventario';
import type { LineaDeTiempo, ParadaActiva, ParadaLinea, EventoLinea } from '../../../utils/animacion';
import type { Conversor, Pieza } from '../../../utils/escena';
import type { Reloj } from '../../../utils/reloj';
import { ESCENA } from '../constantes';

type TramoLinea = EventoTramo & EventoLinea;

const ALTO_RUTA = 0.035;

/**
 * Ruta en el piso como línea luminosa: la que falta, tenue; la recorrida, brillante. La recorrida
 * se recalcula en cada cuadro desde el reloj (sin pasar por React).
 */
const LineaRuta: React.FC<{ linea: LineaDeTiempo; reloj: Reloj; aThree: Conversor }> = ({ linea, reloj, aThree }) => {
  const recorrida = useRef<Line2>(null);
  const ultimaClave = useRef('');
  const tramos = useMemo(() => linea.eventos.filter((e): e is TramoLinea => e.tipo === 'tramo'), [linea]);
  const puntos = useMemo(
    () => (tramos.length ? [tramos[0].punto_inicio, ...tramos.map((t) => t.punto_fin)].map((p) => aThree(p.x, p.y, ALTO_RUTA)) : []),
    [tramos, aThree],
  );

  useFrame(() => {
    const geometria = recorrida.current?.geometry;
    if (!geometria || puntos.length < 2) return;
    const t = reloj.t;
    // Tramos completos más el punto donde va el carrito dentro del tramo actual.
    let completos = 0;
    while (completos < tramos.length && tramos[completos].t_fin <= t) completos++;
    const actual = tramos[completos];
    let parcial: [number, number, number] | null = null;
    if (actual && t > actual.t_inicio) {
      const f = Math.min((t - actual.t_inicio) / Math.max(actual.t_fin - actual.t_inicio, 1e-6), 1);
      parcial = aThree(
        actual.punto_inicio.x + (actual.punto_fin.x - actual.punto_inicio.x) * f,
        actual.punto_inicio.y + (actual.punto_fin.y - actual.punto_inicio.y) * f,
        ALTO_RUTA,
      );
    }
    const clave = `${completos}|${parcial ? parcial.map((v) => v.toFixed(2)).join(',') : ''}`;
    if (clave === ultimaClave.current) return;
    ultimaClave.current = clave;
    const lista = puntos.slice(0, completos + 1);
    if (parcial) lista.push(parcial);
    if (lista.length < 2) lista.push(lista[0]);
    geometria.setPositions(lista.flat());
  });

  if (puntos.length < 2) return null;
  return (
    <group>
      <Line points={puntos} color={ESCENA.ruta} lineWidth={2.5} transparent opacity={0.6} dashed dashSize={0.35} gapSize={0.2} />
      <Line ref={recorrida} points={[puntos[0], puntos[0]]} color={ESCENA.rutaRecorrida} lineWidth={5} toneMapped={false} />
    </group>
  );
};

/** Anillo que late en el piso, en la próxima parada (o en la que está el carrito). Su etiqueta va aparte (Etiquetas.tsx). */
const AnilloParada: React.FC<{ parada: ParadaLinea; aThree: Conversor; animar: boolean }> = ({ parada, aThree, animar }) => {
  const anillo = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const [x, , z] = aThree(parada.punto.x, parada.punto.y);
  useFrame(({ clock }) => {
    if (!anillo.current || !material.current) return;
    const fase = animar ? (Math.sin(clock.elapsedTime * 4) + 1) / 2 : 0.5;
    anillo.current.scale.setScalar(1 + fase * 0.35);
    material.current.opacity = 0.9 - fase * 0.5;
  });
  return (
    <group position={[x, 0.02, z]}>
      {/* Se dibuja encima de todo (depthTest apagado): se ve aunque el pasillo quede detrás de una estantería. */}
      <mesh ref={anillo} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
        <ringGeometry args={[0.32, 0.46, 40]} />
        <meshBasicMaterial ref={material} color={ESCENA.anillo} transparent toneMapped={false} depthWrite={false} depthTest={false} />
      </mesh>
    </group>
  );
};

export type TipoContorno = 'activo' | 'pendiente' | 'visitada';

const COLOR_CONTORNO: Record<TipoContorno, string> = {
  activo: ESCENA.contornoActivo,
  pendiente: ESCENA.contornoPendiente,
  visitada: ESCENA.contornoVisitada,
};

/** Contorno de una celda: luminoso si está activa o resaltada desde la tabla. */
const Contorno: React.FC<{ pieza: Pieza; tipo: TipoContorno }> = ({ pieza, tipo }) => (
  <mesh position={pieza.posicion}>
    <boxGeometry args={pieza.tamano} />
    {tipo === 'activo' ? (
      <meshBasicMaterial color={ESCENA.contornoActivo} transparent opacity={0.16} depthWrite={false} toneMapped={false} />
    ) : (
      <meshBasicMaterial visible={false} />
    )}
    <Edges color={COLOR_CONTORNO[tipo]} lineWidth={tipo === 'activo' ? 3.5 : 1.5} toneMapped={false} />
  </mesh>
);

interface CapaRutaProps {
  linea: LineaDeTiempo;
  reloj: Reloj;
  paradas: ParadaLinea[];
  activa: ParadaActiva;
  aThree: Conversor;
  /** Volumen de cada celda por código (para los contornos). */
  volumenPorCodigo: Map<string, Pieza>;
  visitadas: Set<string>;
  pendientes: Set<string>;
  resaltadas: Set<string>;
  animar: boolean;
}

/** Capa futurista encima del estilo isométrico: ruta luminosa, próxima parada y contornos. */
export const CapaRuta: React.FC<CapaRutaProps> = ({ linea, reloj, paradas, activa, aThree, volumenPorCodigo, visitadas, pendientes, resaltadas, animar }) => {
  const parada = activa.fase === 'terminado' ? undefined : paradas[activa.indice];
  const contornos = useMemo(() => {
    const tipos = new Map<string, TipoContorno>();
    for (const codigo of visitadas) tipos.set(codigo, 'visitada');
    for (const codigo of pendientes) tipos.set(codigo, 'pendiente');
    for (const ubicacion of parada?.ubicaciones ?? []) tipos.set(ubicacion.codigo_ubicacion, 'activo');
    for (const codigo of resaltadas) tipos.set(codigo, 'activo');
    return [...tipos].flatMap(([codigo, tipo]) => {
      const pieza = volumenPorCodigo.get(codigo);
      return pieza ? [{ codigo, tipo, pieza }] : [];
    });
  }, [visitadas, pendientes, resaltadas, parada, volumenPorCodigo]);

  return (
    <group>
      <LineaRuta linea={linea} reloj={reloj} aThree={aThree} />
      {parada && <AnilloParada parada={parada} aThree={aThree} animar={animar} />}
      {contornos.map(({ codigo, tipo, pieza }) => (
        <Contorno key={`${codigo}-${tipo}`} pieza={pieza} tipo={tipo} />
      ))}
    </group>
  );
};
