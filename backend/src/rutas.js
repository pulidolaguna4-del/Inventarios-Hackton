// Rutas de la API (/api/...). Cada función recibe la petición, llama a los módulos
// del sistema y responde en JSON. Los módulos no saben nada de HTTP.

import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import * as conteo from './conteo.js';
import * as datos from './datos.js';
import * as exportar from './exportar.js';
import * as layout from './layout.js';
import * as maqueta from './maqueta.js';
import * as maestro from './maestro.js';
import * as pedidos from './pedidos.js';
import * as picking from './picking.js';
import * as robot from './robot.js';
import {
  CANTIDAD_SORTEO_POR_DEFECTO,
  ESCALA_MAQUETA,
  COLUMNAS_EXPORTAR_MAESTRO,
  COLUMNAS_EXPORTAR_PEDIDOS,
  COLUMNAS_EXPORTAR_SORTEOS,
  COLUMNAS_EXPORTAR_REGISTROS_CONTEO,
  COLUMNAS_LISTA_DESPACHO,
  DIR_SALIDAS,
  ESTADOS_PEDIDO,
  RUTA_ESTADOS_PEDIDOS,
  RUTA_MAESTRO,
  RUTA_REGISTROS_CONTEO,
  RUTA_SORTEOS,
} from './config.js';

/** Error que se devuelve al cliente como {"error": mensaje} con su código HTTP. */
export class ErrorApi extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.codigo = codigo;
  }
}

// ---------------------------------------------------------------------------
// Datos compartidos por varias rutas
// ---------------------------------------------------------------------------

async function generarYGuardarMaestro() {
  const { ventas, productos_nuevos: productosNuevos } = await datos.cargarDatos();
  const nuevo = maestro.generarMaestro(ventas, productosNuevos);
  maestro.guardarMaestro(RUTA_MAESTRO, nuevo);
  return nuevo;
}

/** Lee el maestro guardado (si no existe, lo genera) y le agrega los datos de logística. */
async function maestroActual() {
  const guardado = maestro.cargarMaestro(RUTA_MAESTRO) ?? (await generarYGuardarMaestro());
  return { ...guardado, referencias: maestro.agregarDatosLogistica(guardado.referencias, maestro.leerLogisticaTarea1()) };
}

/** Universo de referencias del inventario: las del maestro, con su ubicación. */
async function referenciasActuales() {
  return (await maestroActual()).referencias;
}

/** Lee un parámetro de consulta entero opcional (?sku=..., ?semana=...). */
function enteroOpcional(valor, nombre) {
  if (valor === undefined || valor === '') return null;
  if (!/^\d+$/.test(String(valor))) throw new ErrorApi(400, `El parámetro '${nombre}' debe ser un número entero`);
  return Number(valor);
}

/** Pedidos de Arauca de una fecha con su estado (sin fecha, la primera con pedidos). */
async function listarPedidos(consulta) {
  const { ventas } = await datos.cargarDatos();
  let fecha = consulta.fecha;
  if (fecha) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !datos.aFecha(fecha)) {
      throw new ErrorApi(400, `La fecha debe tener el formato AAAA-MM-DD: ${fecha}`);
    }
  } else {
    fecha = datos.lineasDeCiudad(ventas).map((linea) => linea.fecha).sort()[0];
  }

  const estados = pedidos.cargarEstados(RUTA_ESTADOS_PEDIDOS);
  const listado = pedidos.pedidosConEstado(pedidos.agruparPedidos(ventas, undefined, fecha), estados);

  const estadoFiltro = consulta.estado;
  if (estadoFiltro && !ESTADOS_PEDIDO.includes(estadoFiltro)) throw new ErrorApi(400, `Estado desconocido: ${estadoFiltro}`);

  return {
    fecha,
    estados: ESTADOS_PEDIDO,
    conteo_por_estado: pedidos.conteoPorEstado(listado),
    pedidos: estadoFiltro ? listado.filter((pedido) => pedido.estado === estadoFiltro) : listado,
  };
}

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------

export const rutasApi = Router();

/** Totales de referencias, órdenes de Arauca y fechas disponibles. */
rutasApi.get('/resumen', async (req, res) => {
  const { ventas, productos_nuevos: productosNuevos } = await datos.cargarDatos();
  res.json(datos.calcularResumen(ventas, productosNuevos));
});

/** Maestro de ubicaciones con popularidad y clase ABC. */
rutasApi.get('/maestro', async (req, res) => {
  res.json(await maestroActual());
});

/** Recalcula el ABC y las ubicaciones (respeta el CSV de logística). */
rutasApi.post('/maestro/generar', async (req, res) => {
  await generarYGuardarMaestro();
  res.json(await maestroActual());
});

/**
 * Sortea referencias al azar para contar: {"cantidad": 56, "forzar": false}.
 * Si el sorteo anterior todavía tiene referencias sin contar responde 409, salvo con
 * "forzar": true (las pendientes se pueden seguir contando en su sorteo).
 */
rutasApi.post('/conteo/sorteo', async (req, res) => {
  const cantidad = req.body?.cantidad ?? CANTIDAD_SORTEO_POR_DEFECTO;
  const sorteos = conteo.cargarSorteos(RUTA_SORTEOS);
  const registros = conteo.cargarRegistros(RUTA_REGISTROS_CONTEO);

  const anterior = sorteos.at(-1);
  if (anterior && !req.body?.forzar) {
    const pendientes = anterior.skus.length - registros.filter((r) => r.sorteo === anterior.numero).length;
    if (pendientes > 0) {
      throw new ErrorApi(409, `Al sorteo ${anterior.numero} le faltan ${pendientes} referencias por contar. ¿Sortear de todas formas?`);
    }
  }

  const skus = (await referenciasActuales()).map((referencia) => referencia.sku);
  const nuevo = conteo.sortear(skus, sorteos, cantidad);
  conteo.guardarSorteos(RUTA_SORTEOS, [...sorteos, nuevo]);
  const mensaje =
    nuevo.skus.length < cantidad
      ? `Sorteo ${nuevo.numero}: solo quedaban ${nuevo.skus.length} referencias disponibles`
      : `Sorteo ${nuevo.numero}: ${nuevo.skus.length} referencias elegidas al azar`;
  res.json({ mensaje, sorteo: nuevo.numero, tamano: nuevo.skus.length });
});

/** Empieza un año de conteo nuevo: respalda los sorteos y los registros y los deja vacíos. */
rutasApi.post('/conteo/reiniciar', (req, res) => {
  const respaldos = [];
  for (const ruta of [RUTA_SORTEOS, RUTA_REGISTROS_CONTEO]) {
    if (fs.existsSync(ruta)) respaldos.push(path.basename(conteo.respaldarArchivo(ruta)));
  }
  conteo.guardarSorteos(RUTA_SORTEOS, []);
  conteo.guardarRegistros(RUTA_REGISTROS_CONTEO, []);
  res.json({ mensaje: 'Conteo reiniciado: se empieza un año nuevo sin sorteos', respaldos });
});

/** Referencias de un sorteo con su progreso X/5. */
rutasApi.get('/conteo/sorteo/:numero', async (req, res) => {
  const numero = enteroOpcional(req.params.numero, 'numero');
  const sorteos = conteo.cargarSorteos(RUTA_SORTEOS);
  const registros = conteo.cargarRegistros(RUTA_REGISTROS_CONTEO);
  res.json(conteo.referenciasDeSorteo(numero, sorteos, registros, await referenciasActuales()));
});

/** Guarda un conteo y devuelve el registro creado. */
rutasApi.post('/conteo/registro', async (req, res) => {
  const referencias = await referenciasActuales();
  const sorteos = conteo.cargarSorteos(RUTA_SORTEOS);
  const registros = conteo.cargarRegistros(RUTA_REGISTROS_CONTEO);
  const referenciasPorSku = new Map(referencias.map((referencia) => [referencia.sku, referencia]));
  const registro = conteo.crearRegistro(req.body ?? {}, sorteos, registros, referenciasPorSku);
  conteo.guardarRegistros(RUTA_REGISTROS_CONTEO, [...registros, registro]);
  res.json({ mensaje: 'Conteo registrado', registro });
});

/** Totales del año, avance semanal, sorteos y verificación. */
rutasApi.get('/conteo/progreso', async (req, res) => {
  const sorteos = conteo.cargarSorteos(RUTA_SORTEOS);
  const registros = conteo.cargarRegistros(RUTA_REGISTROS_CONTEO);
  res.json({
    ...conteo.resumenProgreso(sorteos, registros, await referenciasActuales()),
    cantidad_sorteo_por_defecto: CANTIDAD_SORTEO_POR_DEFECTO,
  });
});

/** Registros de conteo (?sku=N&sorteo=N&semana=N), del más reciente al más antiguo. */
rutasApi.get('/conteo/registros', (req, res) => {
  const filtros = {
    sku: enteroOpcional(req.query.sku, 'sku'),
    sorteo: enteroOpcional(req.query.sorteo, 'sorteo'),
    semana: enteroOpcional(req.query.semana, 'semana'),
  };
  res.json({ registros: conteo.filtrarRegistros(conteo.cargarRegistros(RUTA_REGISTROS_CONTEO), filtros) });
});

/** Pedidos de Arauca de una fecha (?fecha=AAAA-MM-DD&estado=...) con su estado. */
rutasApi.get('/pedidos', async (req, res) => {
  res.json(await listarPedidos(req.query));
});

/** Avanza un pedido al estado siguiente: {"estado": "En entrega"}. */
rutasApi.post('/pedidos/:id/estado', async (req, res) => {
  const idPedido = enteroOpcional(req.params.id, 'id');
  const { ventas } = await datos.cargarDatos();
  if (!pedidos.idsDePedidos(ventas).has(idPedido)) throw new ErrorApi(404, `No existe el pedido ${idPedido} en la bodega`);
  const estadoNuevo = req.body?.estado;
  if (!estadoNuevo) throw new ErrorApi(400, "Falta el campo 'estado'");

  const estados = pedidos.cambiarEstado(pedidos.cargarEstados(RUTA_ESTADOS_PEDIDOS), idPedido, estadoNuevo);
  pedidos.guardarEstados(RUTA_ESTADOS_PEDIDOS, estados);
  const guardado = estados[String(idPedido)];
  res.json({
    id_pedido: idPedido,
    estado: guardado.estado,
    siguiente_estado: pedidos.siguienteEstado(guardado.estado),
    historial: guardado.historial,
  });
});

/** Lee ?vista=arauca|maqueta (con un valor por defecto). */
function vistaPedida(valor, porDefecto) {
  const vista = valor || porDefecto;
  if (!layout.VISTAS_LAYOUT.includes(vista)) {
    throw new ErrorApi(400, `Vista desconocida: ${vista}. Opciones: ${layout.VISTAS_LAYOUT.join(', ')}`);
  }
  return vista;
}

/** Recorridos de picking de una vista, con su trazado punto por punto. */
function recorridosConTrazado(vista) {
  return vista === 'arauca' ? picking.agregarTrazado(picking.pickingTarea6()) : maqueta.pickingMaqueta(maestro.leerLogisticaTarea1());
}

/** Todo lo que el mapa 3D necesita para dibujar una vista (?vista=arauca|maqueta). */
rutasApi.get('/bodega/layout', async (req, res) => {
  const vista = vistaPedida(req.query.vista, 'arauca');
  const referencias = await referenciasActuales();
  res.json(vista === 'arauca' ? layout.layoutArauca(referencias) : layout.layoutMaqueta(referencias, maestro.leerLogisticaTarea1()));
});

/**
 * Trayectos de la Tarea 6 (tiempo de cada trayecto y el más demorado).
 * Con ?con_trazado=true cada recorrido trae además su trazado: tramos, paradas y tiempos.
 */
rutasApi.get('/picking/prueba', (req, res) => {
  res.json(req.query.con_trazado === 'true' ? recorridosConTrazado('arauca') : picking.pickingTarea6());
});

/** Recorridos del robot en la maqueta en U (las 11 referencias, de a 3), con su trazado. */
rutasApi.get('/picking/maqueta', (req, res) => {
  res.json(recorridosConTrazado('maqueta'));
});

/**
 * Instrucciones para el robot de un recorrido: ?vista=maqueta|arauca&recorrido=N&escala=20.
 * Por defecto la maqueta, que es lo que el robot recorre físicamente.
 */
rutasApi.get('/picking/instrucciones', (req, res) => {
  const vista = vistaPedida(req.query.vista, 'maqueta');
  const escala = robot.validarEscala(req.query.escala ?? ESCALA_MAQUETA);
  const numero = enteroOpcional(req.query.recorrido, 'recorrido') ?? 1;
  const { recorridos } = recorridosConTrazado(vista);
  const recorrido = recorridos.find((r) => r.recorrido === numero);
  if (!recorrido) throw new ErrorApi(400, `El recorrido debe estar entre 1 y ${recorridos.length}: ${numero}`);
  const encabezado = `Recorrido ${numero} · ${vista === 'maqueta' ? 'maqueta' : 'bodega Arauca'}`;
  res.json({
    vista,
    recorrido: numero,
    escala,
    distancia_m: recorrido.trazado.distancia_m,
    ...robot.generarInstrucciones(recorrido.trazado.eventos, escala, encabezado),
  });
});

/** Devuelve {filas, columnas} del tipo de exportación pedido. */
async function filasParaExportar(tipo, consulta) {
  switch (tipo) {
    case 'maestro':
      return { filas: await referenciasActuales(), columnas: COLUMNAS_EXPORTAR_MAESTRO };
    case 'conteo': {
      const sorteo = enteroOpcional(consulta.sorteo, 'sorteo');
      const filas = exportar.filasSorteos(conteo.cargarSorteos(RUTA_SORTEOS), await referenciasActuales(), sorteo);
      return { filas, columnas: COLUMNAS_EXPORTAR_SORTEOS };
    }
    case 'registros_conteo':
      return { filas: conteo.cargarRegistros(RUTA_REGISTROS_CONTEO), columnas: COLUMNAS_EXPORTAR_REGISTROS_CONTEO };
    case 'pedidos':
      return { filas: (await listarPedidos(consulta)).pedidos, columnas: COLUMNAS_EXPORTAR_PEDIDOS };
    case 'picking':
      return { filas: picking.pickingTarea6().lista, columnas: COLUMNAS_LISTA_DESPACHO };
    default:
      throw new ErrorApi(404, `Tipo de exportación desconocido: ${tipo}. Opciones: maestro, conteo (sorteos), registros_conteo, pedidos, picking`);
  }
}

/** Guarda el CSV en salidas/ y lo descarga (?nombre=Día2_Ejercicio6). */
rutasApi.get('/exportar/:tipo', async (req, res) => {
  const { filas, columnas } = await filasParaExportar(req.params.tipo, req.query);
  const ruta = exportar.exportarCsv(req.query.nombre, filas, columnas, DIR_SALIDAS);
  res.download(ruta, path.basename(ruta), { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
});

/** Cualquier otra ruta de /api no existe. */
rutasApi.use((req, res) => {
  res.status(404).json({ error: `No existe la ruta ${req.method} ${req.baseUrl}${req.path}` });
});
