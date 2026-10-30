import React, { useCallback, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { CeldaLayout } from '../../../types/inventario';
import type { PiezasEstanterias } from '../../../utils/escena';
import { COLORES_ABC, COLORES_CATEGORIA, ESCENA } from '../constantes';
import { Instancias } from './Instancias';

export type ModoColor = 'abc' | 'categoria';

interface EstanteriasProps {
  piezas: PiezasEstanterias;
  modoColor: ModoColor;
  sombras: boolean;
  /** Cursor sobre una celda (o null al salir). */
  alPasar: (celda: CeldaLayout | null) => void;
  alElegir: (celda: CeldaLayout) => void;
}

const MATRIZ = new THREE.Matrix4();
const ROTACION = new THREE.Quaternion();
const POSICION = new THREE.Vector3();
const ESCALA = new THREE.Vector3();

/**
 * Estanterías porta-pallet: parales azules, vigas naranjas, estibas de madera y cajas kraft
 * (todo con InstancedMesh). La clase ABC o la categoría va en una etiqueta al frente de la viga.
 * Encima, un volumen invisible por celda recibe el cursor y los clics.
 */
export const Estanterias: React.FC<EstanteriasProps> = React.memo(({ piezas, modoColor, sombras, alPasar, alElegir }) => {
  const volumenes = useRef<THREE.InstancedMesh>(null);
  const ultima = useRef<number | null>(null);

  useLayoutEffect(() => {
    const malla = volumenes.current;
    if (!malla) return;
    piezas.volumenes.forEach((pieza, indice) => {
      MATRIZ.compose(POSICION.set(...pieza.posicion), ROTACION, ESCALA.set(...pieza.tamano));
      malla.setMatrixAt(indice, MATRIZ);
    });
    malla.instanceMatrix.needsUpdate = true;
    malla.computeBoundingSphere();
  }, [piezas]);

  const colorEtiqueta = useCallback(
    (indice: number) => {
      const celda = piezas.celdas[indice];
      if (!celda.ocupada) return ESCENA.sinDato;
      const paleta = modoColor === 'abc' ? COLORES_ABC : COLORES_CATEGORIA;
      const clave = modoColor === 'abc' ? celda.clase_abc : celda.categoria;
      return (clave && paleta[clave]) || ESCENA.sinDato;
    },
    [piezas, modoColor],
  );

  const alMover = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.instanceId === undefined || e.instanceId === ultima.current) return;
    ultima.current = e.instanceId;
    alPasar(piezas.celdas[e.instanceId]);
  };

  return (
    <group>
      <Instancias piezas={piezas.parales} color={ESCENA.paral} sombras={sombras} />
      <Instancias piezas={piezas.vigas} color={ESCENA.viga} sombras={sombras} />
      <Instancias piezas={piezas.estibas} color={ESCENA.estiba} sombras={sombras} />
      <Instancias piezas={piezas.cajas} color={ESCENA.cajas} sombras={sombras} />
      <Instancias piezas={piezas.etiquetas} color="#ffffff" colorDe={colorEtiqueta} sombras={false} />
      <instancedMesh
        ref={volumenes}
        args={[undefined, undefined, piezas.volumenes.length]}
        onPointerMove={alMover}
        onPointerOut={() => {
          ultima.current = null;
          alPasar(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (e.instanceId !== undefined) alElegir(piezas.celdas[e.instanceId]);
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        {/* Invisible: solo recibe el cursor y los clics. */}
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </instancedMesh>
    </group>
  );
});
Estanterias.displayName = 'Estanterias';
