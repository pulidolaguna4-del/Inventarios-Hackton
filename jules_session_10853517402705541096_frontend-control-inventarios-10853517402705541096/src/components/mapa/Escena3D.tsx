import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { CeldaLayout, LayoutBodega } from '../../types/inventario';
import { estadoEnTiempo, type LineaDeTiempo } from '../../utils/animacion';

// La escena solo dibuja lo que llega del backend (layout y trazado): no sabe medidas de la bodega.
// Ejes del backend: x a lo ancho, y hacia el fondo, z hacia arriba.
// En three.js: x igual, la altura es "y" y el fondo queda hacia -z.

export type ModoColor = 'abc' | 'categoria';
export type ModoCamara = 'planta' | 'isometrica' | 'carrito';

/** Estado de reproducción compartido entre la escena (useFrame) y los controles (React). */
export interface Reproduccion {
  t: number;
  reproduciendo: boolean;
  velocidad: number;
}

export const COLORES_ABC: Record<string, string> = { A: '#ff6b2c', B: '#4a6fa5', C: '#a8a29e' };
export const COLORES_CATEGORIA: Record<string, string> = {
  'Aire acondicionado': '#4a6fa5',
  'Equipos de audio': '#ff6b2c',
  'Equipos de cómputo': '#2f9e6e',
  Refrigeración: '#8e6bbf',
};
const COLOR_PENDIENTE = '#facc15';
const COLOR_VISITADA = '#17181a';
const COLOR_SIN_DATO = '#d9d4c7';

interface EscenaProps {
  layout: LayoutBodega;
  linea: LineaDeTiempo;
  reproduccion: React.MutableRefObject<Reproduccion>;
  /** Se llama ~10 veces por segundo con el tiempo actual, para refrescar los controles. */
  alAvanzar: (t: number) => void;
  alTerminar: () => void;
  modoColor: ModoColor;
  modoCamara: ModoCamara;
  visitadas: Set<string>;
  pendientes: Set<string>;
}

/** Convierte un punto del backend a three.js, centrado en la bodega. */
function crearConversor(layout: LayoutBodega) {
  const { limites } = layout.medidas;
  const cx = (limites.x_min + limites.x_max) / 2;
  const cy = (limites.y_min + limites.y_max) / 2;
  return (x: number, y: number, alto = 0): [number, number, number] => [x - cx, alto, -(y - cy)];
}

/** Un estante: las celdas de los distintos niveles que comparten el mismo lugar en planta. */
interface Estante {
  clave: string;
  x: number;
  y: number;
  /** true si el pasillo corre a lo largo del eje y (el estante es largo en y). */
  largoEnY: boolean;
  celdas: CeldaLayout[];
}

function agruparEstantes(celdas: CeldaLayout[]): Estante[] {
  const porLugar = new Map<string, Estante>();
  for (const celda of celdas) {
    const clave = `${celda.x.toFixed(3)}|${celda.y.toFixed(3)}`;
    if (!porLugar.has(clave)) {
      const largoEnY = Math.abs(celda.punto_recogida.x - celda.x) > Math.abs(celda.punto_recogida.y - celda.y);
      porLugar.set(clave, { clave, x: celda.x, y: celda.y, largoEnY, celdas: [] });
    }
    porLugar.get(clave)!.celdas.push(celda);
  }
  return [...porLugar.values()];
}

// ---------------------------------------------------------------------------
// Piezas de la escena
// ---------------------------------------------------------------------------

const Piso: React.FC<{ layout: LayoutBodega; aThree: ReturnType<typeof crearConversor> }> = ({ layout, aThree }) => {
  const { medidas } = layout;
  const margen = 1.5;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[medidas.ancho_total + margen * 2, medidas.largo_total + margen * 2]} />
        <meshStandardMaterial color="#e9e4d8" />
      </mesh>
      {/* Pasillos */}
      {layout.pasillos.map((pasillo) => {
        const largo = Math.hypot(pasillo.x_fin - pasillo.x_inicio, pasillo.y_fin - pasillo.y_inicio);
        const enY = Math.abs(pasillo.y_fin - pasillo.y_inicio) >= Math.abs(pasillo.x_fin - pasillo.x_inicio);
        const [x, , z] = aThree((pasillo.x_inicio + pasillo.x_fin) / 2, (pasillo.y_inicio + pasillo.y_fin) / 2);
        const ancho = medidas.ancho_pasillo;
        return (
          <mesh key={pasillo.nombre} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.002, z]}>
            <planeGeometry args={enY ? [ancho, largo + ancho] : [largo + ancho, ancho]} />
            <meshStandardMaterial color={pasillo.tipo === 'frente' ? '#ddd6c6' : '#d6cfbf'} />
          </mesh>
        );
      })}
      {/* Cabeceras para cruzar entre pasillos */}
      {layout.cabeceras.map((cabecera) => {
        const [x, , z] = aThree((cabecera.x_inicio + cabecera.x_fin) / 2, cabecera.y);
        return (
          <mesh key={cabecera.nombre} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.003, z]}>
            <planeGeometry args={[cabecera.x_fin - cabecera.x_inicio + medidas.ancho_pasillo, 0.12]} />
            <meshStandardMaterial color="#8e897d" />
          </mesh>
        );
      })}
      {/* Salidas */}
      {layout.salidas.map((salida) => {
        const posicion = aThree(salida.x, salida.y, 0.02);
        return (
          <group key={salida.nombre} position={posicion}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[1.4, 0.5]} />
              <meshStandardMaterial color="#ff6b2c" />
            </mesh>
            <Html position={[0, 0.4, 0.6]} center zIndexRange={[10, 0]}>
              <span className="font-mono text-[11px] font-semibold bg-tinta text-papel px-1.5 py-0.5 whitespace-nowrap">{salida.nombre}</span>
            </Html>
          </group>
        );
      })}
    </group>
  );
};

interface EstanteProps {
  estante: Estante;
  layout: LayoutBodega;
  aThree: ReturnType<typeof crearConversor>;
  colorDe: (celda: CeldaLayout) => string;
  alPasar: (celda: CeldaLayout | null) => void;
}

const Estante3D: React.FC<EstanteProps> = ({ estante, layout, aThree, colorDe, alPasar }) => {
  const { medidas } = layout;
  const largo = medidas.largo_celda * 0.94;
  const fondo = medidas.fondo_rack * 0.9;
  const [ancho, profundidad] = estante.largoEnY ? [fondo, largo] : [largo, fondo];
  const altoTotal = (medidas.travesanos - 1) * medidas.alto_nivel;
  const [x, , z] = aThree(estante.x, estante.y);
  const esquinas: [number, number][] = [
    [-ancho / 2, -profundidad / 2],
    [ancho / 2, -profundidad / 2],
    [-ancho / 2, profundidad / 2],
    [ancho / 2, profundidad / 2],
  ];
  return (
    <group position={[x, 0, z]}>
      {/* Travesaños: piso, viga intermedia y viga superior (solo 2 niveles de almacenamiento) */}
      {Array.from({ length: medidas.travesanos }, (_, k) => (
        <mesh key={k} position={[0, k * medidas.alto_nivel + 0.03, 0]}>
          <boxGeometry args={[ancho, 0.06, profundidad]} />
          <meshStandardMaterial color="#45474d" />
        </mesh>
      ))}
      {esquinas.map(([px, pz], indice) => (
        <mesh key={indice} position={[px, altoTotal / 2, pz]}>
          <boxGeometry args={[0.06, altoTotal + 0.06, 0.06]} />
          <meshStandardMaterial color="#45474d" />
        </mesh>
      ))}
      {/* Cajas de cada nivel */}
      {estante.celdas
        .filter((celda) => celda.ocupada)
        .map((celda) => (
          <mesh
            key={celda.codigo_ubicacion}
            position={[0, celda.z, 0]}
            onPointerOver={(e) => {
              e.stopPropagation();
              alPasar(celda);
            }}
            onPointerOut={() => alPasar(null)}
          >
            <boxGeometry args={[ancho * 0.8, medidas.alto_nivel * 0.62, profundidad * 0.8]} />
            <meshStandardMaterial color={colorDe(celda)} />
          </mesh>
        ))}
    </group>
  );
};

/** El carrito: se mueve en cada cuadro según el tiempo transcurrido (reloj de three). */
const Carrito: React.FC<{
  linea: LineaDeTiempo;
  reproduccion: React.MutableRefObject<Reproduccion>;
  aThree: ReturnType<typeof crearConversor>;
  alAvanzar: (t: number) => void;
  alTerminar: () => void;
  seguir: boolean;
  controles: React.RefObject<OrbitControlsImpl | null>;
}> = ({ linea, reproduccion, aThree, alAvanzar, alTerminar, seguir, controles }) => {
  const grupo = useRef<THREE.Group>(null);
  const acumulado = useRef(0);
  const camara = useThree((estado) => estado.camera);

  useFrame((_, delta) => {
    const r = reproduccion.current;
    if (r.reproduciendo) {
      r.t = Math.min(r.t + delta * r.velocidad, linea.duracion);
      if (r.t >= linea.duracion) {
        r.reproduciendo = false;
        alTerminar();
      }
    }
    const estado = estadoEnTiempo(linea, r.t);
    if (!estado || !grupo.current) return;
    const [x, , z] = aThree(estado.x, estado.y);
    grupo.current.position.set(x, 0, z);
    // El modelo mira hacia +z local; se gira hacia la dirección de avance.
    const objetivo = Math.atan2(estado.dx, -estado.dy);
    const actual = grupo.current.rotation.y;
    const diferencia = Math.atan2(Math.sin(objetivo - actual), Math.cos(objetivo - actual));
    grupo.current.rotation.y = actual + diferencia * Math.min(1, delta * 12);

    if (seguir) {
      const adelante = new THREE.Vector3(estado.dx, 0, -estado.dy);
      const deseada = new THREE.Vector3(x, 0, z).addScaledVector(adelante, -4.5).add(new THREE.Vector3(0, 3.2, 0));
      camara.position.lerp(deseada, Math.min(1, delta * 4));
      const mira = new THREE.Vector3(x, 0.8, z).addScaledVector(adelante, 3);
      controles.current?.target.lerp(mira, Math.min(1, delta * 4));
      camara.lookAt(controles.current?.target ?? mira);
    }

    acumulado.current += delta;
    if (acumulado.current >= 0.1) {
      acumulado.current = 0;
      alAvanzar(r.t);
    }
  });

  return (
    <group ref={grupo}>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.7, 0.36, 1.0]} />
        <meshStandardMaterial color="#ff6b2c" />
      </mesh>
      <mesh position={[0, 0.62, -0.32]}>
        <boxGeometry args={[0.6, 0.3, 0.12]} />
        <meshStandardMaterial color="#17181a" />
      </mesh>
      {/* Morro: indica hacia dónde avanza */}
      <mesh position={[0, 0.3, 0.56]}>
        <boxGeometry args={[0.4, 0.2, 0.12]} />
        <meshStandardMaterial color="#17181a" />
      </mesh>
    </group>
  );
};

/** Ubica la cámara en la vista elegida (planta o isométrica). */
const Camaras: React.FC<{ layout: LayoutBodega; modo: ModoCamara; controles: React.RefObject<OrbitControlsImpl | null> }> = ({ layout, modo, controles }) => {
  const camara = useThree((estado) => estado.camera);
  const { ancho_total: ancho, largo_total: largo } = layout.medidas;
  useEffect(() => {
    if (modo === 'carrito' || !controles.current) return;
    const tamano = Math.max(ancho, largo);
    if (modo === 'planta') camara.position.set(0, tamano * 1.25, 0.01);
    else camara.position.set(ancho * 0.85, tamano * 0.75, largo * 0.85);
    controles.current.target.set(0, 0, 0);
    controles.current.update();
  }, [modo, ancho, largo, camara, controles]);
  return null;
};

// ---------------------------------------------------------------------------
// Escena completa
// ---------------------------------------------------------------------------

export const Escena3D: React.FC<EscenaProps> = ({ layout, linea, reproduccion, alAvanzar, alTerminar, modoColor, modoCamara, visitadas, pendientes }) => {
  const aThree = useMemo(() => crearConversor(layout), [layout]);
  const estantes = useMemo(() => agruparEstantes(layout.celdas), [layout]);
  const controles = useRef<OrbitControlsImpl | null>(null);
  const [celdaSenalada, setCeldaSenalada] = useState<CeldaLayout | null>(null);

  const colorDe = (celda: CeldaLayout) => {
    if (visitadas.has(celda.codigo_ubicacion)) return COLOR_VISITADA;
    if (pendientes.has(celda.codigo_ubicacion)) return COLOR_PENDIENTE;
    const paleta = modoColor === 'abc' ? COLORES_ABC : COLORES_CATEGORIA;
    const clave = modoColor === 'abc' ? celda.clase_abc : celda.categoria;
    return (clave && paleta[clave]) || COLOR_SIN_DATO;
  };

  // Línea de la ruta sobre el piso.
  const puntosRuta = useMemo(() => {
    const tramos = linea.eventos.filter((e) => e.tipo === 'tramo');
    if (tramos.length === 0) return [];
    return [tramos[0].punto_inicio, ...tramos.map((t) => t.punto_fin)].map((p) => aThree(p.x, p.y, 0.04));
  }, [linea, aThree]);

  const tamano = Math.max(layout.medidas.ancho_total, layout.medidas.largo_total);
  return (
    <Canvas camera={{ position: [layout.medidas.ancho_total * 0.85, tamano * 0.75, layout.medidas.largo_total * 0.85], fov: 45, near: 0.1, far: 500 }} dpr={[1, 2]}>
      <color attach="background" args={['#f4f1ea']} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[10, 25, 12]} intensity={1.1} />
      <directionalLight position={[-12, 10, -8]} intensity={0.35} />

      <Piso layout={layout} aThree={aThree} />
      {estantes.map((estante) => (
        <Estante3D key={estante.clave} estante={estante} layout={layout} aThree={aThree} colorDe={colorDe} alPasar={setCeldaSenalada} />
      ))}
      {puntosRuta.length > 1 && <Line points={puntosRuta} color="#17181a" lineWidth={2} dashed dashSize={0.4} gapSize={0.25} />}
      <Carrito
        linea={linea}
        reproduccion={reproduccion}
        aThree={aThree}
        alAvanzar={alAvanzar}
        alTerminar={alTerminar}
        seguir={modoCamara === 'carrito'}
        controles={controles}
      />

      {celdaSenalada && (
        <Html position={aThree(celdaSenalada.x, celdaSenalada.y, celdaSenalada.z + layout.medidas.alto_nivel * 0.6)} center zIndexRange={[20, 0]}>
          <div className="bg-tinta text-papel px-2.5 py-1.5 text-xs whitespace-nowrap pointer-events-none">
            <div className="font-mono font-semibold">
              {celdaSenalada.codigo_ubicacion} · {celdaSenalada.etiqueta}
            </div>
            <div>
              {celdaSenalada.sku} · {celdaSenalada.descripcion}
            </div>
            <div className="text-[#b5b0a4]">
              Clase {celdaSenalada.clase_abc ?? '—'} · {celdaSenalada.categoria ?? '—'}
            </div>
          </div>
        </Html>
      )}

      <OrbitControls ref={controles} makeDefault enabled={modoCamara !== 'carrito'} maxPolarAngle={Math.PI / 2.05} />
      <Camaras layout={layout} modo={modoCamara} controles={controles} />
    </Canvas>
  );
};

/** true si el navegador puede dibujar WebGL. */
export function soportaWebGL(): boolean {
  try {
    const lienzo = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (lienzo.getContext('webgl2') || lienzo.getContext('webgl')));
  } catch {
    return false;
  }
}
