// Pedidos de la bodega y su estado: Pendiente -> En alistamiento -> Alistado -> En entrega -> Entregado.
//
// Solo se puede avanzar al estado siguiente. Cada cambio queda en el historial del
// pedido con su fecha y hora. Un pedido sin cambios registrados está Pendiente.
//
// Los estados se guardan en un JSON con esta forma:
//   {"46882122": {"estado": "Alistado",
//                 "historial": [{"estado": "En alistamiento", "fecha_hora": "..."}, ...]}}

import { lineasDeCiudad, leerJson, guardarJson } from './datos.js';
import { ahoraIso } from './maestro.js';
import { CIUDAD_BODEGA, ESTADOS_PEDIDO } from './config.js';

const ESTADO_INICIAL = ESTADOS_PEDIDO[0];

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

/**
 * Junta las líneas de venta en pedidos de la ciudad, opcionalmente de una sola fecha.
 *
 * Cada pedido trae: id_pedido, fecha, cliente, ciudad, lineas (sku, descripcion,
 * cantidad), referencias (cuántos SKU distintos) y unidades (suma de cantidades).
 * Se devuelven ordenados por fecha y número de pedido.
 */
export function agruparPedidos(ventas, ciudad = CIUDAD_BODEGA, fecha = null) {
  const pedidos = new Map();
  for (const linea of lineasDeCiudad(ventas, ciudad)) {
    if (fecha !== null && linea.fecha !== fecha) continue;
    if (!pedidos.has(linea.id_pedido)) {
      pedidos.set(linea.id_pedido, {
        id_pedido: linea.id_pedido,
        fecha: linea.fecha,
        cliente: linea.cliente,
        ciudad: linea.ciudad,
        lineas: [],
      });
    }
    pedidos.get(linea.id_pedido).lineas.push({ sku: linea.sku, descripcion: linea.descripcion, cantidad: linea.cantidad });
  }

  const lista = [...pedidos.values()];
  for (const pedido of lista) {
    pedido.referencias = new Set(pedido.lineas.map((linea) => linea.sku)).size;
    pedido.unidades = pedido.lineas.reduce((suma, linea) => suma + linea.cantidad, 0);
  }
  return lista.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id_pedido - b.id_pedido);
}

/** Conjunto de números de pedido de la ciudad. */
export function idsDePedidos(ventas, ciudad = CIUDAD_BODEGA) {
  return new Set(lineasDeCiudad(ventas, ciudad).map((linea) => linea.id_pedido));
}

// ---------------------------------------------------------------------------
// Estados
// ---------------------------------------------------------------------------

/** Estado que sigue a `estado`; null si ya está Entregado. */
export function siguienteEstado(estado) {
  const posicion = ESTADOS_PEDIDO.indexOf(estado);
  return ESTADOS_PEDIDO[posicion + 1] ?? null;
}

/** Estado e historial guardados de un pedido; Pendiente sin historial si no hay nada. */
export function estadoDePedido(estados, idPedido) {
  return estados[String(idPedido)] ?? { estado: ESTADO_INICIAL, historial: [] };
}

/**
 * Avanza un pedido a `estadoNuevo` y devuelve el objeto de estados actualizado.
 * No modifica `estados`: devuelve una copia. Lanza error si el estado no existe o si
 * no es exactamente el siguiente del estado actual.
 */
export function cambiarEstado(estados, idPedido, estadoNuevo, ahora = new Date()) {
  if (!ESTADOS_PEDIDO.includes(estadoNuevo)) {
    throw new Error(`Estado desconocido '${estadoNuevo}'. Opciones: ${ESTADOS_PEDIDO.join(', ')}`);
  }
  const actual = estadoDePedido(estados, idPedido);
  const permitido = siguienteEstado(actual.estado);
  if (permitido === null) throw new Error(`El pedido ${idPedido} ya está ${actual.estado} y no puede cambiar`);
  if (estadoNuevo !== permitido) {
    throw new Error(`El pedido ${idPedido} está '${actual.estado}'; solo puede pasar a '${permitido}', no a '${estadoNuevo}'`);
  }

  return {
    ...estados,
    [String(idPedido)]: {
      estado: estadoNuevo,
      historial: [...actual.historial, { estado: estadoNuevo, fecha_hora: ahoraIso(ahora) }],
    },
  };
}

/** Agrega a cada pedido su estado, el siguiente estado posible y su historial. */
export function pedidosConEstado(pedidos, estados) {
  return pedidos.map((pedido) => {
    const guardado = estadoDePedido(estados, pedido.id_pedido);
    return {
      ...pedido,
      estado: guardado.estado,
      siguiente_estado: siguienteEstado(guardado.estado),
      historial: guardado.historial,
      ultimo_cambio: guardado.historial.at(-1)?.fecha_hora ?? null,
    };
  });
}

/** Cuántos pedidos hay en cada estado, en el orden del flujo. */
export function conteoPorEstado(pedidosListados) {
  const conteo = Object.fromEntries(ESTADOS_PEDIDO.map((estado) => [estado, 0]));
  for (const pedido of pedidosListados) conteo[pedido.estado] += 1;
  return conteo;
}

// ---------------------------------------------------------------------------
// Archivos
// ---------------------------------------------------------------------------

/** Lee los estados guardados; objeto vacío si todavía no hay. */
export function cargarEstados(ruta) {
  return leerJson(ruta, {});
}

export function guardarEstados(ruta, estados) {
  guardarJson(ruta, estados);
}
