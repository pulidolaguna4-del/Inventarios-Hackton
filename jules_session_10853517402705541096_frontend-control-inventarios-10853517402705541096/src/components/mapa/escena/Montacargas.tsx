import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { LayoutBodega } from '../../../types/inventario';
import {
  estadoEnTiempo,
  mismaParadaActiva,
  nivelHorquillas,
  paradaActivaEnTiempo,
  type LineaDeTiempo,
  type ParadaActiva,
  type ParadaLinea,
} from '../../../utils/animacion';
import { alturaNivel, type Conversor } from '../../../utils/escena';
import type { Reloj } from '../../../utils/reloj';
import { ESCENA } from '../constantes';

interface MontacargasProps {
  layout: LayoutBodega;
  linea: LineaDeTiempo;
  reloj: Reloj;
  paradas: ParadaLinea[];
  aThree: Conversor;
  alCambiarParada: (activa: ParadaActiva) => void;
  alTerminar: () => void;
  /** Cámara "Carrito": la cámara lo sigue por detrás. */
  seguir: boolean;
  /** Calidad básica: la baliza no parpadea. */
  animarBaliza: boolean;
  sombras: boolean;
}

/** Altura de las horquillas para recoger en el nivel 1 cuando van "abajo" (transporte). */
const ALTURA_TRANSPORTE = 0.1;
/** Qué tan rápido gira hacia la dirección de avance (más alto = giro más corto). */
const RAPIDEZ_GIRO = 7;

const Rueda: React.FC<{ posicion: [number, number, number]; sombras: boolean }> = ({ posicion, sombras }) => (
  <mesh position={posicion} rotation={[0, 0, Math.PI / 2]} castShadow={sombras}>
    <cylinderGeometry args={[0.13, 0.13, 0.1, 14]} />
    <meshLambertMaterial color={ESCENA.rueda} />
  </mesh>
);

/**
 * El robot como montacargas low-poly: chasis amarillo, 4 ruedas, cabina, mástil con horquillas y
 * baliza. En cada cuadro avanza el reloj, se ubica según el tiempo, gira hacia donde avanza (y en
 * cada parada, hacia la estantería) y sube las horquillas al nivel que recoge.
 */
export const Montacargas: React.FC<MontacargasProps> = ({ layout, linea, reloj, paradas, aThree, alCambiarParada, alTerminar, seguir, animarBaliza, sombras }) => {
  const grupo = useRef<THREE.Group>(null);
  const horquillas = useRef<THREE.Group>(null);
  const baliza = useRef<THREE.MeshLambertMaterial>(null);
  const acumulado = useRef(0);
  const ultimaActiva = useRef<ParadaActiva | null>(null);
  const camara = useThree((estado) => estado.camera);
  const controles = useThree((estado) => estado.controls) as OrbitControlsImpl | null;

  // Dónde está cada celda en planta: en una parada, el montacargas gira hacia ella.
  const celdaPorCodigo = useMemo(() => new Map(layout.celdas.map((celda) => [celda.codigo_ubicacion, celda])), [layout]);
  const altura1 = alturaNivel(layout, 1);
  const altoNivel = layout.medidas.alto_nivel;

  useFrame((estadoThree, delta) => {
    // `reloj` es el reloj compartido (un objeto, no estado de React): la escena lo avanza en cada
    // cuadro y solo publica el tiempo ~10 veces por segundo, así la página no se re-renderiza 60 veces.
    if (reloj.avanzar(delta, linea.duracion)) alTerminar();

    const activa = paradaActivaEnTiempo(paradas, reloj.t);
    if (!ultimaActiva.current || !mismaParadaActiva(activa, ultimaActiva.current)) {
      ultimaActiva.current = activa;
      alCambiarParada(activa);
    }
    acumulado.current += delta;
    if (acumulado.current >= 0.1) {
      acumulado.current = 0;
      reloj.publicar();
    }

    const estado = estadoEnTiempo(linea, reloj.t);
    if (!estado || !grupo.current) return;
    const [x, , z] = aThree(estado.x, estado.y);
    grupo.current.position.set(x, 0, z);

    // Hacia dónde mira: la dirección de avance o, detenido en una parada, la estantería.
    let [dx, dy] = [estado.dx, estado.dy];
    const evento = linea.eventos[estado.indice];
    if (estado.en_parada && evento.tipo === 'parada') {
      const celda = celdaPorCodigo.get(evento.ubicaciones[0]?.codigo_ubicacion ?? '');
      if (celda) [dx, dy] = [celda.x - evento.punto.x, celda.y - evento.punto.y];
    }
    // El modelo mira hacia +z local; giro suave por el camino más corto.
    const objetivo = Math.atan2(dx, -dy);
    const actual = grupo.current.rotation.y;
    const diferencia = Math.atan2(Math.sin(objetivo - actual), Math.cos(objetivo - actual));
    grupo.current.rotation.y = actual + diferencia * Math.min(1, delta * RAPIDEZ_GIRO * Math.max(1, reloj.velocidad));

    // Horquillas: 0 = transporte, 1 = nivel 1, 2 = nivel 2 (continuo, sale del tiempo).
    if (horquillas.current) {
      const nivel = nivelHorquillas(linea, reloj.t);
      horquillas.current.position.y = nivel <= 1 ? ALTURA_TRANSPORTE + (altura1 - ALTURA_TRANSPORTE) * nivel : altura1 + (nivel - 1) * altoNivel;
    }

    if (baliza.current) baliza.current.emissiveIntensity = animarBaliza ? (Math.sin(estadoThree.clock.elapsedTime * 9) > 0 ? 1.6 : 0.15) : 0.8;

    if (seguir) {
      const adelante = new THREE.Vector3(estado.dx, 0, -estado.dy);
      const deseada = new THREE.Vector3(x, 0, z).addScaledVector(adelante, -4.5).add(new THREE.Vector3(0, 3.2, 0));
      camara.position.lerp(deseada, Math.min(1, delta * 4));
      const mira = new THREE.Vector3(x, 0.8, z).addScaledVector(adelante, 3);
      controles?.target.lerp(mira, Math.min(1, delta * 4));
      camara.lookAt(controles?.target ?? mira);
    }
  });

  const alturaMastil = altura1 + altoNivel * Math.max(1, layout.medidas.niveles - 1) + 0.6;
  // El localizador crece con la bodega: en Arauca (28 m) se ve desde la vista completa.
  const escalaLocalizador = Math.max(1, Math.max(layout.medidas.ancho_total, layout.medidas.largo_total) / 14);
  return (
    <group ref={grupo}>
      {/* Chasis y contrapeso */}
      <mesh position={[0, 0.27, 0]} castShadow={sombras}>
        <boxGeometry args={[0.66, 0.3, 0.86]} />
        <meshLambertMaterial color={ESCENA.chasis} />
      </mesh>
      <mesh position={[0, 0.38, -0.4]} castShadow={sombras}>
        <boxGeometry args={[0.66, 0.38, 0.18]} />
        <meshLambertMaterial color={ESCENA.contrapeso} />
      </mesh>
      <Rueda posicion={[-0.35, 0.13, 0.28]} sombras={sombras} />
      <Rueda posicion={[0.35, 0.13, 0.28]} sombras={sombras} />
      <Rueda posicion={[-0.35, 0.13, -0.28]} sombras={sombras} />
      <Rueda posicion={[0.35, 0.13, -0.28]} sombras={sombras} />
      {/* Cabina: 4 parales y techo */}
      {[
        [-0.29, -0.3],
        [0.29, -0.3],
        [-0.29, 0.18],
        [0.29, 0.18],
      ].map(([px, pz]) => (
        <mesh key={`${px}${pz}`} position={[px, 0.82, pz]}>
          <boxGeometry args={[0.04, 0.8, 0.04]} />
          <meshLambertMaterial color={ESCENA.contrapeso} />
        </mesh>
      ))}
      <mesh position={[0, 1.24, -0.06]} castShadow={sombras}>
        <boxGeometry args={[0.66, 0.05, 0.56]} />
        <meshLambertMaterial color={ESCENA.chasis} />
      </mesh>
      {/* Baliza que parpadea */}
      <mesh position={[0, 1.31, -0.06]}>
        <cylinderGeometry args={[0.06, 0.07, 0.09, 12]} />
        <meshLambertMaterial ref={baliza} color={ESCENA.baliza} emissive={ESCENA.baliza} emissiveIntensity={0.8} />
      </mesh>
      {/* Mástil */}
      {[-0.22, 0.22].map((px) => (
        <mesh key={px} position={[px, alturaMastil / 2, 0.5]} castShadow={sombras}>
          <boxGeometry args={[0.05, alturaMastil, 0.06]} />
          <meshLambertMaterial color={ESCENA.mastil} />
        </mesh>
      ))}
      {/* Localizador: pin y haz de luz encima del montacargas, dibujados encima de todo para que
          se vea aunque el pasillo quede detrás de una estantería. */}
      <mesh position={[0, alturaMastil + 0.9 + 0.3 * escalaLocalizador, 0]} rotation={[Math.PI, 0, 0]} scale={escalaLocalizador} renderOrder={11}>
        <coneGeometry args={[0.22, 0.45, 4]} />
        <meshBasicMaterial color={ESCENA.baliza} toneMapped={false} depthTest={false} transparent />
      </mesh>
      <mesh position={[0, (alturaMastil + 0.85) / 2, 0]} renderOrder={10}>
        <cylinderGeometry args={[0.025 * escalaLocalizador, 0.025 * escalaLocalizador, alturaMastil + 0.85, 6]} />
        <meshBasicMaterial color={ESCENA.baliza} toneMapped={false} depthTest={false} transparent opacity={0.45} />
      </mesh>
      {/* Horquillas: suben y bajan según el nivel que recoge */}
      <group ref={horquillas} position={[0, ALTURA_TRANSPORTE, 0.56]}>
        <mesh position={[0, 0.14, 0]}>
          <boxGeometry args={[0.5, 0.28, 0.04]} />
          <meshLambertMaterial color={ESCENA.horquillas} />
        </mesh>
        {[-0.15, 0.15].map((px) => (
          <mesh key={px} position={[px, 0.02, 0.34]} castShadow={sombras}>
            <boxGeometry args={[0.07, 0.04, 0.68]} />
            <meshLambertMaterial color={ESCENA.horquillas} />
          </mesh>
        ))}
      </group>
    </group>
  );
};
