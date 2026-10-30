import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { CeldaLayout, LayoutBodega } from '../../types/inventario';
import type { LineaDeTiempo, ParadaActiva, ParadaLinea } from '../../utils/animacion';
import type { Reloj } from '../../utils/reloj';
import { crearConversor, moverEtiqueta, piezasEstanterias, type Pieza } from '../../utils/escena';
import { ESCENA } from './constantes';
import { Estanterias, type ModoColor } from './escena/Estanterias';
import { Piso } from './escena/Piso';
import { Montacargas } from './escena/Montacargas';
import { CapaRuta } from './escena/CapaRuta';
import { EtiquetaCelda, EtiquetaParada, Proyector, type Anclaje } from './escena/Etiquetas';

// La escena solo dibuja lo que llega del backend (layout y trazado): no sabe medidas de la bodega.
// Estilo: ilustración isométrica tipo "casa de muñecas" (low-poly, colores sólidos, sin texturas),
// con una capa futurista encima (ruta luminosa, próxima parada, contornos).

export type { ModoColor };
export type ModoCamara = 'planta' | 'isometrica' | 'carrito';
/** Básica: sin sombras, sin baliza animada y resolución 1×, para gráficas integradas. */
export type Calidad = 'alta' | 'basica';

interface EscenaProps {
  layout: LayoutBodega;
  linea: LineaDeTiempo;
  /** Reloj compartido: la escena lo avanza en cada cuadro. */
  reloj: Reloj;
  paradas: ParadaLinea[];
  /** Parada activa (para el anillo de la próxima parada y los contornos). */
  activa: ParadaActiva;
  /** Se llama solo cuando cambia la parada activa (no en cada cuadro). */
  alCambiarParada: (activa: ParadaActiva) => void;
  alTerminar: () => void;
  modoColor: ModoColor;
  modoCamara: ModoCamara;
  calidad: Calidad;
  visitadas: Set<string>;
  pendientes: Set<string>;
  /** Celdas resaltadas desde la tabla (cursor sobre una fila). */
  resaltadas: Set<string>;
  /** Clic en una celda: se selecciona su fila en la tabla. */
  alElegirCelda: (codigo: string) => void;
}

/** Ángulo isométrico: la cámara mira desde (1, 1, 1). */
const DISTANCIA_ISO = 60;
/** Espacio que ocupan los controles del HUD arriba y abajo (px), para encuadrar la bodega. */
const ALTO_HUD = 170;

/** Ubica la cámara de la vista elegida y encuadra la bodega (la isométrica con zoom ortográfico). */
const Camaras: React.FC<{ layout: LayoutBodega; modo: ModoCamara }> = ({ layout, modo }) => {
  const camara = useThree((estado) => estado.camera);
  const controles = useThree((estado) => estado.controls) as OrbitControlsImpl | null;
  const { width, height } = useThree((estado) => estado.size);
  const { ancho_total: ancho, largo_total: largo } = layout.medidas;
  const alto = (layout.medidas.travesanos - 1) * layout.medidas.alto_nivel;

  useEffect(() => {
    if (modo === 'carrito' || !controles) return;
    if (modo === 'planta') {
      camara.position.set(0, Math.max(ancho, largo) * 1.25, 0.01);
    } else {
      camara.position.set(DISTANCIA_ISO, DISTANCIA_ISO, DISTANCIA_ISO);
      if (camara instanceof THREE.OrthographicCamera) {
        // Tamaño de la bodega proyectada en la vista isométrica.
        const horizontal = (ancho + largo) / Math.SQRT2;
        const vertical = (ancho + largo) / Math.sqrt(6) + alto * 0.82;
        // Intencional: la cámara es un objeto de three.js (no estado de React) y el zoom de la
        // ortográfica solo se cambia asignándolo y luego llamando a updateProjectionMatrix().
        // oxlint-disable-next-line react/immutability
        camara.zoom = Math.max(4, Math.min(width / (horizontal * 1.08), Math.max(height - ALTO_HUD, 200) / (vertical * 1.08)));
        camara.updateProjectionMatrix();
      }
    }
    controles.target.set(0, 0, 0);
    controles.update();
  }, [modo, camara, controles, ancho, largo, alto, width, height]);
  return null;
};

export const Escena3D: React.FC<EscenaProps> = ({
  layout,
  linea,
  reloj,
  paradas,
  activa,
  alCambiarParada,
  alTerminar,
  modoColor,
  modoCamara,
  calidad,
  visitadas,
  pendientes,
  resaltadas,
  alElegirCelda,
}) => {
  const aThree = useMemo(() => crearConversor(layout), [layout]);
  const piezas = useMemo(() => piezasEstanterias(layout, aThree), [layout, aThree]);
  const volumenPorCodigo = useMemo(
    () => new Map<string, Pieza>(piezas.celdas.map((celda, indice) => [celda.codigo_ubicacion, piezas.volumenes[indice]])),
    [piezas],
  );
  const [celdaSenalada, setCeldaSenalada] = useState<CeldaLayout | null>(null);
  const alta = calidad === 'alta';

  // El manejador del clic vive en un ref para que las estanterías (memorizadas) no se redibujen.
  const elegir = useRef(alElegirCelda);
  useEffect(() => {
    elegir.current = alElegirCelda;
  });
  const alElegir = useCallback((celda: CeldaLayout) => elegir.current(celda.codigo_ubicacion), []);

  // Etiquetas flotantes (DOM encima del lienzo): la próxima parada y la celda bajo el cursor.
  const etiquetaParada = useRef<HTMLDivElement>(null);
  const etiquetaCelda = useRef<HTMLDivElement>(null);
  const proxima = activa.fase === 'terminado' ? undefined : paradas[activa.indice];
  const anclajes: Anclaje[] = [
    {
      posicion: proxima ? aThree(proxima.punto.x, proxima.punto.y, 2.2) : null,
      alProyectar: (pantalla) => moverEtiqueta(etiquetaParada.current, pantalla),
    },
    {
      posicion: celdaSenalada ? aThree(celdaSenalada.x, celdaSenalada.y, celdaSenalada.z + layout.medidas.alto_nivel * 0.6) : null,
      alProyectar: (pantalla) => moverEtiqueta(etiquetaCelda.current, pantalla),
    },
  ];

  const tamano = Math.max(layout.medidas.ancho_total, layout.medidas.largo_total);
  return (
    <div className="absolute inset-0 overflow-hidden">
    {/* Cambiar la calidad vuelve a crear el lienzo (las sombras se configuran al crearlo). */}
    <Canvas key={calidad} shadows={alta} dpr={alta ? [1, 2] : 1} gl={{ antialias: alta }}>
      <color attach="background" args={[ESCENA.fondo]} />
      <OrthographicCamera makeDefault={modoCamara === 'isometrica'} position={[DISTANCIA_ISO, DISTANCIA_ISO, DISTANCIA_ISO]} zoom={20} near={-200} far={600} />
      <PerspectiveCamera makeDefault={modoCamara !== 'isometrica'} position={[0, tamano * 1.25, 0.01]} fov={45} near={0.1} far={500} />

      <hemisphereLight args={['#ffffff', '#9fb0c4', 0.9]} />
      <directionalLight
        position={[tamano * 0.6, tamano * 1.1, tamano * 0.45]}
        intensity={1.6}
        castShadow={alta}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-tamano}
        shadow-camera-right={tamano}
        shadow-camera-top={tamano}
        shadow-camera-bottom={-tamano}
        shadow-camera-far={tamano * 4}
        shadow-bias={-0.0004}
      />

      <Piso layout={layout} aThree={aThree} sombras={alta} />
      <Estanterias piezas={piezas} modoColor={modoColor} sombras={alta} alPasar={setCeldaSenalada} alElegir={alElegir} />
      <CapaRuta
        linea={linea}
        reloj={reloj}
        paradas={paradas}
        activa={activa}
        aThree={aThree}
        volumenPorCodigo={volumenPorCodigo}
        visitadas={visitadas}
        pendientes={pendientes}
        resaltadas={resaltadas}
        animar={alta}
      />
      <Montacargas
        layout={layout}
        linea={linea}
        reloj={reloj}
        paradas={paradas}
        aThree={aThree}
        alCambiarParada={alCambiarParada}
        alTerminar={alTerminar}
        seguir={modoCamara === 'carrito'}
        animarBaliza={alta}
        sombras={alta}
      />

      <Proyector anclajes={anclajes} />

      <OrbitControls makeDefault enabled={modoCamara !== 'carrito'} maxPolarAngle={Math.PI / 2.05} />
      <Camaras layout={layout} modo={modoCamara} />
    </Canvas>
    <EtiquetaParada ref={etiquetaParada} parada={proxima} />
    <EtiquetaCelda ref={etiquetaCelda} celda={celdaSenalada} />
    </div>
  );
};
