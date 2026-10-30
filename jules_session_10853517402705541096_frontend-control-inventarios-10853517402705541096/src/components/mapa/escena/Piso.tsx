import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { LayoutBodega } from '../../../types/inventario';
import { franjasSeguridad, textoSalida, type Conversor } from '../../../utils/escena';
import { ESCENA } from '../constantes';
import { Instancias } from './Instancias';

const MARGEN = 0.8;
const ALTO_PARED = 1.1;
const GROSOR_PARED = 0.16;
const ALTO_CORTE = 0.07;

/**
 * Letrero pintado en el piso. Se dibuja en un canvas del propio navegador (no se carga ningún
 * archivo): es la única textura de la escena.
 */
function useTexturaTexto(texto: string): THREE.CanvasTexture | null {
  const textura = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const lienzo = document.createElement('canvas');
    lienzo.width = 512;
    lienzo.height = 128;
    const contexto = lienzo.getContext('2d');
    if (!contexto) return null;
    contexto.fillStyle = ESCENA.salidaTexto;
    contexto.font = '800 84px "Archivo Variable", Archivo, "IBM Plex Sans", sans-serif';
    contexto.textAlign = 'center';
    contexto.textBaseline = 'middle';
    contexto.fillText(texto, 256, 68, 500);
    const resultado = new THREE.CanvasTexture(lienzo);
    resultado.anisotropy = 4;
    return resultado;
  }, [texto]);
  useEffect(() => () => textura?.dispose(), [textura]);
  return textura;
}

/** Flecha triangular plana que apunta hacia la salida (hacia +z en three.js). */
const FORMA_FLECHA = (() => {
  const forma = new THREE.Shape();
  forma.moveTo(-0.32, 0);
  forma.lineTo(0.32, 0);
  forma.lineTo(0, 0.42);
  forma.closePath();
  return forma;
})();

/**
 * Salida pintada en el piso. Con zona abierta (Arauca) el letrero va a lo ancho; si la salida
 * está al final de un pasillo angosto (maqueta en U), va a lo largo del pasillo para no quedar
 * debajo de las estanterías.
 */
const Salida: React.FC<{ nombre: string; posicion: [number, number, number]; aLoLargo: boolean }> = ({ nombre, posicion, aLoLargo }) => {
  const textura = useTexturaTexto(textoSalida(nombre));
  const [x, , z] = posicion;
  const flechas = aLoLargo ? [0] : [-0.55, 0.55];
  return (
    <group>
      {textura && (
        <mesh rotation={aLoLargo ? [-Math.PI / 2, 0, Math.PI / 2] : [-Math.PI / 2, 0, 0]} position={[x, 0.012, aLoLargo ? z - 1.45 : z - 0.7]}>
          <planeGeometry args={aLoLargo ? [1.9, 0.48] : [2.4, 0.6]} />
          <meshBasicMaterial map={textura} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {/* Flechas pintadas hacia la salida */}
      {flechas.map((dx) => (
        <mesh key={dx} rotation={[-Math.PI / 2, 0, Math.PI]} position={[x + dx, 0.011, aLoLargo ? z - 0.3 : z - 1.35]}>
          <shapeGeometry args={[FORMA_FLECHA]} />
          <meshBasicMaterial color={ESCENA.salidaFlecha} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
};

/**
 * Piso azul grisáceo con baldosas, dos paredes bajas cortadas (fondo e izquierda) como una
 * maqueta, franjas de seguridad amarillas y negras y las salidas pintadas en el piso.
 */
export const Piso: React.FC<{ layout: LayoutBodega; aThree: Conversor; sombras: boolean }> = React.memo(({ layout, aThree, sombras }) => {
  const { limites } = layout.medidas;
  const ancho = limites.x_max - limites.x_min + MARGEN * 2;
  const largo = limites.y_max - limites.y_min + MARGEN * 2;
  const franjas = useMemo(() => franjasSeguridad(layout, aThree), [layout, aThree]);

  // Cuadrícula de baldosas de 1 m, solo dentro del piso.
  const baldosas = useMemo(() => {
    const puntos: number[] = [];
    for (let x = -ancho / 2; x <= ancho / 2 + 1e-6; x += 1) puntos.push(x, 0.003, -largo / 2, x, 0.003, largo / 2);
    for (let z = -largo / 2; z <= largo / 2 + 1e-6; z += 1) puntos.push(-ancho / 2, 0.003, z, ancho / 2, 0.003, z);
    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute('position', new THREE.Float32BufferAttribute(puntos, 3));
    return geometria;
  }, [ancho, largo]);
  useEffect(() => () => baldosas.dispose(), [baldosas]);

  // Paredes cortadas: la del fondo (-z) y la izquierda (-x), con el borde del corte oscuro.
  const paredes: { posicion: [number, number, number]; tamano: [number, number, number] }[] = [
    { posicion: [0, ALTO_PARED / 2, -largo / 2 - GROSOR_PARED / 2], tamano: [ancho + GROSOR_PARED * 2, ALTO_PARED, GROSOR_PARED] },
    { posicion: [-ancho / 2 - GROSOR_PARED / 2, ALTO_PARED / 2, 0], tamano: [GROSOR_PARED, ALTO_PARED, largo] },
  ];

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow={sombras}>
        <planeGeometry args={[ancho, largo]} />
        <meshLambertMaterial color={ESCENA.piso} />
      </mesh>
      <lineSegments geometry={baldosas}>
        <lineBasicMaterial color={ESCENA.baldosa} />
      </lineSegments>
      {paredes.map(({ posicion, tamano }, indice) => (
        <group key={indice}>
          <mesh position={posicion} castShadow={sombras} receiveShadow={sombras}>
            <boxGeometry args={tamano} />
            <meshLambertMaterial color={ESCENA.pared} />
          </mesh>
          <mesh position={[posicion[0], ALTO_PARED + ALTO_CORTE / 2, posicion[2]]}>
            <boxGeometry args={[tamano[0] + 0.04, ALTO_CORTE, tamano[2] + 0.04]} />
            <meshLambertMaterial color={ESCENA.paredCorte} />
          </mesh>
        </group>
      ))}
      <Instancias piezas={franjas} color={ESCENA.seguridad} sombras={false} />
      {layout.salidas.map((salida) => (
        <Salida
          key={salida.nombre}
          nombre={salida.nombre}
          posicion={aThree(salida.x, salida.y)}
          aLoLargo={!(layout.medidas as { alto_zona_abierta?: number }).alto_zona_abierta}
        />
      ))}
    </group>
  );
});
Piso.displayName = 'Piso';
