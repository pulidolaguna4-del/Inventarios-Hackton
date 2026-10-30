// Reloj de la animación: la única fuente de verdad del tiempo.
//
// La escena 3D lo avanza en cada cuadro (useFrame) sin pasar por el estado de React. Solo
// `publicar()` avisa a quien muestra el tiempo (la línea de tiempo y sus contadores), unas
// 10 veces por segundo. La tabla del recorrido no lo escucha: se entera solo cuando cambia
// la parada activa.

import { useSyncExternalStore } from 'react';

export class Reloj {
  /** Segundos desde el inicio de la línea de tiempo. */
  t = 0;
  reproduciendo = false;
  velocidad = 1;
  /** Último tiempo publicado: lo que leen los componentes de React. */
  private publicado = 0;
  private oyentes = new Set<() => void>();

  suscribir = (oyente: () => void) => {
    this.oyentes.add(oyente);
    return () => {
      this.oyentes.delete(oyente);
    };
  };

  leerPublicado = () => this.publicado;

  /** Avisa a los componentes que muestran el tiempo. */
  publicar() {
    if (this.publicado === this.t) return;
    this.publicado = this.t;
    for (const oyente of this.oyentes) oyente();
  }

  /** Salta a un instante y lo publica de inmediato. */
  irA(t: number) {
    this.t = t;
    this.publicar();
  }

  reproducir() {
    this.reproduciendo = true;
  }

  pausar() {
    this.reproduciendo = false;
  }

  cambiarVelocidad(velocidad: number) {
    this.velocidad = velocidad;
  }

  /** Avanza `delta` segundos reales (por la velocidad) sin pasar de `duracion`. Devuelve true si acaba de terminar. */
  avanzar(delta: number, duracion: number): boolean {
    if (!this.reproduciendo) return false;
    this.t = Math.min(this.t + delta * this.velocidad, duracion);
    if (this.t < duracion) return false;
    this.reproduciendo = false;
    return true;
  }
}

/** Tiempo publicado del reloj (se refresca ~10 veces por segundo mientras se reproduce). */
export function useTiempoReloj(reloj: Reloj): number {
  return useSyncExternalStore(reloj.suscribir, reloj.leerPublicado);
}
