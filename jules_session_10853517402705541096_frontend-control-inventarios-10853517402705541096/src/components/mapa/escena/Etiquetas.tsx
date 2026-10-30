import React, { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { CeldaLayout } from '../../../types/inventario';
import type { ParadaLinea } from '../../../utils/animacion';
import type { Vector3 } from '../../../utils/escena';
import { formatearNumero } from '../../../utils/formato';

// Etiquetas flotantes: son elementos normales del DOM encima del lienzo (no usan el <Html> de
// drei, que en esta app dejaba su contenido vacío). En cada cuadro se proyecta el punto 3D a la
// pantalla y se mueve el elemento con transform, sin pasar por React.

export interface Anclaje {
  /** Punto 3D (three.js) sobre el que flota; null la oculta. */
  posicion: Vector3 | null;
  /** Recibe la posición en pantalla (px) o null si queda fuera; quien es dueño del elemento lo mueve. */
  alProyectar: (pantalla: { x: number; y: number } | null) => void;
}

/** Dentro del <Canvas>: en cada cuadro proyecta el punto 3D de cada etiqueta a la pantalla. */
export const Proyector: React.FC<{ anclajes: Anclaje[] }> = ({ anclajes }) => {
  const camara = useThree((estado) => estado.camera);
  const tamano = useThree((estado) => estado.size);
  const punto = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    for (const { posicion, alProyectar } of anclajes) {
      if (!posicion) {
        alProyectar(null);
        continue;
      }
      punto.set(...posicion).project(camara);
      const enPantalla = Math.abs(punto.x) <= 1.1 && Math.abs(punto.y) <= 1.1 && punto.z <= 1;
      alProyectar(enPantalla ? { x: ((punto.x + 1) / 2) * tamano.width, y: ((1 - punto.y) / 2) * tamano.height } : null);
    }
  });
  return null;
};

const CLASE_ETIQUETA =
  'absolute left-0 top-0 pointer-events-none whitespace-nowrap rounded-[10px] bg-tinta/90 px-2.5 py-1.5 text-[11px] text-papel shadow-lg invisible';

/** Etiqueta de la próxima parada (o en la que está el carrito): ubicación, nivel y tiempo. */
export const EtiquetaParada = React.forwardRef<HTMLDivElement, { parada: ParadaLinea | undefined }>(({ parada }, ref) => (
  <div ref={ref} className={CLASE_ETIQUETA} aria-hidden="true">
    {parada && (
      <>
        <div className="font-mono font-semibold">
          #{parada.etiqueta} · {parada.ubicaciones.map((u) => u.codigo_ubicacion).join(' + ')}
        </div>
        <div className="text-[#d9d4c7]">
          Nivel {parada.niveles.join(' y ')} · {formatearNumero(parada.tiempo_recogida_s, 0)} s{parada.ubicaciones.length > 1 ? ' (ambos niveles)' : ''}
        </div>
      </>
    )}
  </div>
));
EtiquetaParada.displayName = 'EtiquetaParada';

/** Lo que hay en la celda bajo el cursor. */
export const EtiquetaCelda = React.forwardRef<HTMLDivElement, { celda: CeldaLayout | null }>(({ celda }, ref) => (
  <div ref={ref} className={`${CLASE_ETIQUETA} text-xs`} aria-hidden="true">
    {celda && (
      <>
        <div className="font-mono font-semibold">
          {celda.codigo_ubicacion} · {celda.etiqueta}
        </div>
        {celda.sku !== null && (
          <div>
            {celda.sku} · {celda.descripcion}
          </div>
        )}
        <div className="text-[#b5b0a4]">
          Clase {celda.clase_abc ?? '—'} · {celda.categoria ?? '—'}
        </div>
      </>
    )}
  </div>
));
EtiquetaCelda.displayName = 'EtiquetaCelda';
