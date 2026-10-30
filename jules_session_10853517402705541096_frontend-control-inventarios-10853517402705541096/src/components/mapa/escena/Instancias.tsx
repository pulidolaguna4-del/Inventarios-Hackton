import React, { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Pieza } from '../../../utils/escena';

interface InstanciasProps {
  piezas: Pieza[];
  /** Un color para todas, o uno por tono (pieza.tono). */
  color: string | string[];
  sombras: boolean;
  /** Si se pasa, el color de cada instancia sale de aquí (y se actualiza cuando cambia). */
  colorDe?: (indice: number) => string;
}

const MATRIZ = new THREE.Matrix4();
const ROTACION = new THREE.Quaternion();
const POSICION = new THREE.Vector3();
const ESCALA = new THREE.Vector3();
const COLOR = new THREE.Color();

/**
 * Cientos de cajas iguales en una sola llamada de dibujo (InstancedMesh): parales, vigas,
 * estibas, cajas, etiquetas y franjas. Las matrices se ponen una vez por cada lista de piezas.
 */
export const Instancias: React.FC<InstanciasProps> = ({ piezas, color, sombras, colorDe }) => {
  const malla = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const instancias = malla.current;
    if (!instancias) return;
    piezas.forEach((pieza, indice) => {
      MATRIZ.compose(POSICION.set(...pieza.posicion), ROTACION, ESCALA.set(...pieza.tamano));
      instancias.setMatrixAt(indice, MATRIZ);
    });
    instancias.instanceMatrix.needsUpdate = true;
    instancias.computeBoundingSphere();
  }, [piezas]);

  useLayoutEffect(() => {
    const instancias = malla.current;
    if (!instancias || (typeof color === 'string' && !colorDe)) return;
    piezas.forEach((pieza, indice) => {
      const valor = colorDe ? colorDe(indice) : (color as string[])[pieza.tono ?? 0];
      instancias.setColorAt(indice, COLOR.set(valor));
    });
    if (instancias.instanceColor) instancias.instanceColor.needsUpdate = true;
  }, [piezas, color, colorDe]);

  if (piezas.length === 0) return null;
  return (
    <instancedMesh ref={malla} args={[undefined, undefined, piezas.length]} castShadow={sombras} receiveShadow={sombras}>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial color={typeof color === 'string' && !colorDe ? color : '#ffffff'} />
    </instancedMesh>
  );
};
