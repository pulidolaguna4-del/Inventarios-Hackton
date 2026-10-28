// Instrucciones para el robot Arduino a partir del trazado de un recorrido.
//
// El trazado son tramos rectos horizontales o verticales (ruta Manhattan), así que entre
// dos tramos el robot gira 90° a la derecha, 90° a la izquierda o da media vuelta (180°,
// que se emite como dos giros a la derecha). Los tramos seguidos en la misma dirección se
// unen en un solo avanzar(cm). Las distancias se pasan a centímetros de la maqueta con la
// escala 1:N (1 m real = 100 / N cm).

import { DIRECCION_INICIAL_ROBOT, ESCALA_MAQUETA } from './config.js';

// Código corto de cada acción en el arreglo que se pega en el sketch de Arduino.
const CODIGO_ACCION = { avanzar: 'A', girarDerecha: 'D', girarIzquierda: 'I', recoger: 'R' };

/** Dirección unitaria [dx, dy] de un tramo horizontal o vertical. */
function direccionTramo(tramo) {
  return [Math.sign(tramo.punto_fin.x - tramo.punto_inicio.x), Math.sign(tramo.punto_fin.y - tramo.punto_inicio.y)];
}

/**
 * Giros para pasar de mirar en `actual` a mirar en `nueva` (direcciones unitarias).
 * Con x a la derecha e y hacia el fondo, el producto cruz positivo es giro a la izquierda.
 */
export function girosEntre(actual, nueva) {
  const punto = actual[0] * nueva[0] + actual[1] * nueva[1];
  if (punto === 1) return [];
  if (punto === -1) return ['girarDerecha', 'girarDerecha'];
  const cruz = actual[0] * nueva[1] - actual[1] * nueva[0];
  return [cruz > 0 ? 'girarIzquierda' : 'girarDerecha'];
}

/** Metros reales -> centímetros de maqueta, con un decimal. */
export function metrosACentimetros(metros, escala) {
  return Math.round((metros * 1000) / escala) / 10;
}

/** Valida la escala 1:N que llega por la URL. */
export function validarEscala(escala) {
  const numero = Number(escala);
  if (!Number.isFinite(numero) || numero <= 0) throw new Error(`La escala debe ser un número mayor que 0 (1:N): '${escala}'`);
  return numero;
}

/**
 * Convierte los eventos del trazado de un recorrido en instrucciones del robot:
 * avanzar(cm), girarDerecha(), girarIzquierda() y recoger(nivel).
 * Devuelve {instrucciones, total_cm, numero_instrucciones, texto, codigo_arduino}.
 */
export function generarInstrucciones(eventos, escala = ESCALA_MAQUETA, encabezado = '') {
  const instrucciones = [];
  let direccion = DIRECCION_INICIAL_ROBOT;
  let metrosPendientes = 0;
  // Se redondea la distancia acumulada y no cada tramo por separado: así los errores de
  // redondeo no se suman y el total de centímetros siempre es exacto.
  let metrosRecorridos = 0;
  let cmEmitidos = 0;

  const agregar = (accion, valor = null, comentario = null) => {
    instrucciones.push({ orden: instrucciones.length + 1, accion, valor, comentario });
  };
  const soltarAvance = () => {
    if (metrosPendientes > 0) {
      metrosRecorridos += metrosPendientes;
      const cmHastaAqui = metrosACentimetros(metrosRecorridos, escala);
      agregar('avanzar', Math.round((cmHastaAqui - cmEmitidos) * 10) / 10);
      cmEmitidos = cmHastaAqui;
    }
    metrosPendientes = 0;
  };

  for (const evento of eventos) {
    if (evento.tipo === 'tramo') {
      const nueva = direccionTramo(evento);
      const giros = girosEntre(direccion, nueva);
      if (giros.length) {
        soltarAvance();
        giros.forEach((giro) => agregar(giro, null, giros.length === 2 ? 'media vuelta (180°)' : null));
        direccion = nueva;
      }
      metrosPendientes += evento.distancia_m;
    } else {
      soltarAvance();
      for (const ubicacion of evento.ubicaciones) agregar('recoger', ubicacion.nivel, ubicacion.codigo_ubicacion);
    }
  }
  soltarAvance();

  const conTexto = instrucciones.map((i) => ({
    ...i,
    texto: `${i.accion}(${i.valor ?? ''});${i.comentario ? ` // ${i.comentario}` : ''}`,
  }));
  const totalCm = Math.round(conTexto.filter((i) => i.accion === 'avanzar').reduce((suma, i) => suma + i.valor * 10, 0)) / 10;
  const filasArduino = conTexto.map((i) => {
    const valor = i.accion === 'avanzar' ? i.valor.toFixed(1) : i.accion === 'recoger' ? i.valor : 90;
    return `  {'${CODIGO_ACCION[i.accion]}', ${valor}},${i.comentario ? ` // ${i.comentario}` : ''}`;
  });
  const codigoArduino = [
    `// ${encabezado}${encabezado ? ' · ' : ''}escala 1:${escala} · ${conTexto.length} instrucciones · ${totalCm} cm`,
    "// A = avanzar(cm), D = girarDerecha(90°), I = girarIzquierda(90°), R = recoger(nivel)",
    'const Instruccion RUTA[] = {',
    ...filasArduino,
    '};',
  ].join('\n');

  return {
    instrucciones: conTexto,
    total_cm: totalCm,
    numero_instrucciones: conTexto.length,
    texto: conTexto.map((i) => i.texto).join('\n'),
    codigo_arduino: codigoArduino,
  };
}
