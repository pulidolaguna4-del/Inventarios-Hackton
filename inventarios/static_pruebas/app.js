// Frontend de pruebas: una página con pestañas que consulta la API con fetch.

"use strict";

const estado = {
  maestro: [],
  progreso: [],
  pestanasCargadas: new Set(),
};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

async function pedirApi(ruta, opciones) {
  const respuesta = await fetch(ruta, opciones);
  const datos = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(datos.error || "Error " + respuesta.status);
  }
  return datos;
}

function enviarJson(ruta, cuerpo) {
  return pedirApi(ruta, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}

function mostrarMensaje(texto, esError) {
  const caja = document.getElementById("mensaje");
  caja.textContent = texto;
  caja.className = esError ? "error" : "";
  caja.hidden = false;
  clearTimeout(mostrarMensaje.temporizador);
  mostrarMensaje.temporizador = setTimeout(() => { caja.hidden = true; }, esError ? 8000 : 4000);
}

function escaparHtml(valor) {
  return String(valor === null || valor === undefined ? "" : valor)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatearNumero(valor, decimales) {
  if (valor === null || valor === undefined || valor === "") return "";
  return Number(valor).toLocaleString("es-CO", { maximumFractionDigits: decimales === undefined ? 2 : decimales });
}

function pintarTarjetas(idContenedor, tarjetas) {
  document.getElementById(idContenedor).innerHTML = tarjetas.map(([etiqueta, valor]) =>
    `<div class="tarjeta"><div class="valor">${escaparHtml(valor)}</div><div class="etiqueta">${escaparHtml(etiqueta)}</div></div>`
  ).join("");
}

// columnas: [{titulo, campo | html(fila), numero}]; claseFila(fila) devuelve una clase CSS opcional.
function pintarTabla(idContenedor, columnas, filas, claseFila) {
  const contenedor = document.getElementById(idContenedor);
  if (!filas.length) {
    contenedor.innerHTML = '<p class="nota" style="padding:8px">Sin datos.</p>';
    return;
  }
  const encabezado = columnas.map((c) => `<th>${escaparHtml(c.titulo)}</th>`).join("");
  const cuerpo = filas.map((fila) => {
    const celdas = columnas.map((c) => {
      const contenido = c.html ? c.html(fila) : escaparHtml(c.numero ? formatearNumero(fila[c.campo]) : fila[c.campo]);
      return `<td class="${c.numero ? "numero" : ""}">${contenido}</td>`;
    }).join("");
    const clase = claseFila ? claseFila(fila) : "";
    return `<tr class="${clase || ""}">${celdas}</tr>`;
  }).join("");
  contenedor.innerHTML = `<table><thead><tr>${encabezado}</tr></thead><tbody>${cuerpo}</tbody></table>`;
}

function etiquetaClase(clase) {
  return `<span class="etiqueta-clase clase-${escaparHtml(clase)}">${escaparHtml(clase)}</span>`;
}

// Pide el nombre de entrega y descarga el CSV (el servidor también lo guarda en salidas/).
function exportarCsv(tipo, nombrePorDefecto, parametrosExtra) {
  const nombre = prompt("Nombre del archivo (las entregas van como Día<N>_Ejercicio<N>):", nombrePorDefecto);
  if (!nombre) return;
  const parametros = new URLSearchParams(Object.assign({ nombre: nombre }, parametrosExtra || {}));
  fetch(`/api/exportar/${tipo}?${parametros}`).then(async (respuesta) => {
    if (!respuesta.ok) {
      const datos = await respuesta.json();
      throw new Error(datos.error);
    }
    const archivo = await respuesta.blob();
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(archivo);
    enlace.download = nombre.replace(/\.csv$/i, "") + ".csv";
    enlace.click();
    URL.revokeObjectURL(enlace.href);
    mostrarMensaje(`Exportado ${enlace.download} (también quedó en la carpeta salidas/).`);
  }).catch((error) => mostrarMensaje(error.message, true));
}

// ---------------------------------------------------------------------------
// Pestañas
// ---------------------------------------------------------------------------

const cargadoresPorPestana = {
  datos: cargarDatos,
  conteo: cargarConteo,
  pedidos: cargarPedidos,
  picking: cargarPicking,
};

function cambiarPestana(nombre) {
  document.querySelectorAll("#pestanas button").forEach((boton) => {
    boton.classList.toggle("activa", boton.dataset.pestana === nombre);
  });
  document.querySelectorAll(".seccion").forEach((seccion) => {
    seccion.hidden = seccion.id !== "seccion-" + nombre;
  });
  if (!estado.pestanasCargadas.has(nombre)) {
    estado.pestanasCargadas.add(nombre);
    cargadoresPorPestana[nombre]().catch((error) => mostrarMensaje(error.message, true));
  }
}

// ---------------------------------------------------------------------------
// Datos y maestro
// ---------------------------------------------------------------------------

async function cargarDatos() {
  const [resumen, maestro] = await Promise.all([pedirApi("/api/resumen"), pedirApi("/api/maestro")]);
  pintarTarjetas("resumen", [
    ["Referencias", resumen.referencias_totales],
    ["Con ventas / nuevas", `${resumen.referencias_ventas} / ${resumen.referencias_nuevas}`],
    [`Órdenes ${resumen.bodega}`, formatearNumero(resumen.ordenes_bodega)],
    [`Líneas ${resumen.bodega}`, formatearNumero(resumen.lineas_bodega)],
    ["Días con pedidos", resumen.dias_con_pedidos_bodega],
    ["Periodo", `${resumen.fecha_inicial} a ${resumen.fecha_final}`],
  ]);
  llenarFechasPedidos(resumen.fechas_disponibles);
  mostrarMaestro(maestro);
}

function mostrarMaestro(maestro) {
  estado.maestro = maestro.referencias;
  const clases = maestro.conteo_por_clase;
  document.getElementById("info-maestro").textContent =
    `Generado: ${maestro.generado} · Fuente: ${maestro.fuente} · A: ${clases.A}, B: ${clases.B}, C: ${clases.C} · ` +
    `Factor nuevas: ${maestro.criterios.factor_lineas_por_unidad} líneas/unidad`;
  filtrarMaestro();
}

function filtrarMaestro() {
  const clase = document.getElementById("filtro-clase").value;
  const texto = document.getElementById("buscar-maestro").value.trim().toLowerCase();
  const filas = estado.maestro.filter((r) =>
    (!clase || r.clase_abc === clase) &&
    (!texto || String(r.sku).includes(texto) || r.descripcion.toLowerCase().includes(texto))
  );
  pintarTabla("tabla-maestro", [
    { titulo: "SKU", campo: "sku" },
    { titulo: "Descripción", campo: "descripcion" },
    { titulo: "Categoría", campo: "categoria" },
    { titulo: "Popularidad", campo: "popularidad", numero: true },
    { titulo: "% acum.", campo: "porcentaje_acumulado", numero: true },
    { titulo: "Clase", html: (r) => etiquetaClase(r.clase_abc) },
    { titulo: "Ubicación", campo: "codigo_ubicacion" },
    { titulo: "N.º plano", campo: "numero_plano" },
    { titulo: "Nivel", campo: "nivel" },
    { titulo: "Dist. salida (m)", campo: "distancia_salida_m", numero: true },
    { titulo: "Nueva", html: (r) => (r.es_nueva ? "Sí" : "") },
  ], filas);
}

async function recalcularMaestro() {
  const maestro = await enviarJson("/api/maestro/generar", {});
  mostrarMaestro(maestro);
  mostrarMensaje("Maestro recalculado.");
}

// ---------------------------------------------------------------------------
// Conteo cíclico
// ---------------------------------------------------------------------------

async function cargarConteo() {
  const progreso = await pedirApi("/api/conteo/progreso");
  document.getElementById("numero-semana").value = progreso.semana_actual;
  mostrarProgreso(progreso);
  await cargarSemana();
}

function mostrarProgreso(progreso) {
  estado.progreso = progreso.progreso;
  pintarTarjetas("resumen-conteo", [
    ["Semana actual", progreso.semana_actual],
    ["Conteos registrados", `${progreso.conteos_registrados} / ${progreso.conteos_planeados}`],
    ["Referencias completas (5/5)", progreso.referencias_completas],
    ["Referencias con diferencia", progreso.referencias_con_diferencia],
  ]);
  const verificacion = progreso.verificacion_plan;
  document.getElementById("verificacion-plan").innerHTML = verificacion.valido
    ? `<span class="correcto">Plan verificado:</span> ${verificacion.referencias} referencias × 5 = ` +
      `${verificacion.total_conteos} conteos en ${verificacion.semanas} semanas, sin repetidas en la misma semana.`
    : `<span class="diferencia">Plan con errores:</span> ${escaparHtml(verificacion.errores.join(" · "))}`;
  filtrarProgreso();
}

function filtrarProgreso() {
  const ocultar = document.getElementById("ocultar-completas").checked;
  const filas = estado.progreso.filter((r) => !(ocultar && r.sale_de_la_lista));
  pintarTabla("tabla-progreso", [
    { titulo: "SKU", campo: "sku" },
    { titulo: "Descripción", campo: "descripcion" },
    { titulo: "Ubicación", campo: "codigo_ubicacion" },
    { titulo: "Estado", campo: "estado" },
    { titulo: "Semanas programadas", html: (r) => escaparHtml(r.semanas_programadas.join(", ")) },
    { titulo: "Con diferencia", html: (r) => (r.tiene_diferencia ? `<span class="diferencia">${r.conteos_con_diferencia}</span>` : "") },
  ], filas, (r) => (r.sale_de_la_lista ? "atenuada" : ""));
}

async function cargarSemana() {
  const numero = document.getElementById("numero-semana").value;
  const semana = await pedirApi(`/api/conteo/semana/${numero}`);
  pintarTabla("tabla-semana", [
    { titulo: "SKU", campo: "sku" },
    { titulo: "Descripción", campo: "descripcion" },
    { titulo: "Ubicación", campo: "codigo_ubicacion" },
    { titulo: "Progreso", campo: "estado" },
    { titulo: "Cant. sistema", html: (r) => r.contada_esta_semana
        ? formatearNumero(r.registro_semana.cantidad_sistema)
        : `<input type="number" min="0" id="sistema-${r.sku}" placeholder="${r.cantidad_sistema_sugerida}">` },
    { titulo: "Cant. contada", html: (r) => r.contada_esta_semana
        ? formatearNumero(r.registro_semana.cantidad_contada)
        : `<input type="number" min="0" id="contada-${r.sku}">` },
    { titulo: "Diferencia", html: (r) => {
        if (!r.contada_esta_semana) return "";
        const diferencia = r.registro_semana.diferencia;
        return `<span class="${diferencia === 0 ? "correcto" : "diferencia"}">${diferencia}</span>`;
      } },
    { titulo: "", html: (r) => r.contada_esta_semana
        ? `Contada por ${escaparHtml(r.registro_semana.responsable)}`
        : `<button class="principal" data-registrar="${r.sku}">Registrar</button>` },
  ], semana.referencias, (r) => (r.contada_esta_semana ? "atenuada" : ""));
}

async function registrarConteo(sku) {
  const semana = Number(document.getElementById("numero-semana").value);
  const cuerpo = {
    semana: semana,
    sku: Number(sku),
    responsable: document.getElementById("responsable").value,
    cantidad_contada: document.getElementById(`contada-${sku}`).value,
    cantidad_sistema: document.getElementById(`sistema-${sku}`).value,
  };
  const respuesta = await enviarJson("/api/conteo/registro", cuerpo);
  const registro = respuesta.registro;
  mostrarMensaje(`Conteo registrado: SKU ${registro.sku}, diferencia ${registro.diferencia}.`);
  await Promise.all([cargarSemana(), pedirApi("/api/conteo/progreso").then(mostrarProgreso)]);
}

async function regenerarPlan() {
  const semilla = Number(document.getElementById("semilla").value);
  let respuesta;
  try {
    respuesta = await enviarJson("/api/conteo/plan/generar", { semilla: semilla });
  } catch (error) {
    if (!error.message.includes("forzar")) throw error;
    const seguir = confirm(error.message + "\n\n¿Respaldar los registros y regenerar el plan?");
    if (!seguir) return;
    respuesta = await enviarJson("/api/conteo/plan/generar", { semilla: semilla, forzar: true });
  }
  mostrarMensaje(respuesta.mensaje + (respuesta.respaldo_registros ? ` · Respaldo: ${respuesta.respaldo_registros}` : ""));
  await cargarConteo();
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

function llenarFechasPedidos(fechas) {
  const selector = document.getElementById("fecha-pedidos");
  if (selector.options.length) return;
  selector.innerHTML = fechas.map((fecha) => `<option>${fecha}</option>`).join("");
}

async function cargarPedidos() {
  if (!document.getElementById("fecha-pedidos").options.length) {
    const resumen = await pedirApi("/api/resumen");
    llenarFechasPedidos(resumen.fechas_disponibles);
  }
  await consultarPedidos();
}

async function consultarPedidos() {
  const fecha = document.getElementById("fecha-pedidos").value;
  const filtroEstado = document.getElementById("filtro-estado");
  const parametros = new URLSearchParams({ fecha: fecha });
  if (filtroEstado.value) parametros.set("estado", filtroEstado.value);
  const respuesta = await pedirApi(`/api/pedidos?${parametros}`);

  if (filtroEstado.options.length === 1) {
    respuesta.estados.forEach((nombre) => filtroEstado.add(new Option(nombre, nombre)));
  }
  pintarTarjetas("conteo-estados", Object.entries(respuesta.conteo_por_estado).map(([nombre, cantidad]) => [nombre, cantidad]));
  pintarTabla("tabla-pedidos", [
    { titulo: "Pedido", campo: "id_pedido" },
    { titulo: "Cliente", campo: "cliente" },
    { titulo: "Referencias", campo: "referencias", numero: true },
    { titulo: "Unidades", campo: "unidades", numero: true },
    { titulo: "Productos", html: (p) => escaparHtml(p.lineas.map((l) => `${l.sku} ×${l.cantidad}`).join(", ")) },
    { titulo: "Estado", campo: "estado" },
    { titulo: "Último cambio", campo: "ultimo_cambio" },
    { titulo: "", html: (p) => p.siguiente_estado
        ? `<button class="principal" data-avanzar="${p.id_pedido}" data-siguiente="${escaparHtml(p.siguiente_estado)}">Avanzar a: ${escaparHtml(p.siguiente_estado)}</button>`
        : "✔" },
  ], respuesta.pedidos, (p) => (p.estado === "Entregado" ? "atenuada" : ""));
}

async function avanzarPedido(idPedido, siguiente) {
  await enviarJson(`/api/pedidos/${idPedido}/estado`, { estado: siguiente });
  mostrarMensaje(`Pedido ${idPedido}: ${siguiente}.`);
  await consultarPedidos();
}

// ---------------------------------------------------------------------------
// Picking (informativo)
// ---------------------------------------------------------------------------

async function cargarPicking() {
  const resultado = await pedirApi("/api/picking/prueba");
  const totales = resultado.totales;
  pintarTarjetas("totales-picking", [
    ["Trayectos", totales.recorridos],
    ["Ubicaciones", totales.ubicaciones],
    ["Distancia total (m)", formatearNumero(totales.distancia_m)],
    ["Tiempo total (s)", formatearNumero(totales.tiempo_total_s)],
    ["Más demorado", `Trayecto ${totales.recorrido_mas_demorado} (${formatearNumero(totales.tiempo_mas_demorado_s)} s)`],
  ]);
  pintarTabla("tabla-recorridos", [
    { titulo: "Trayecto", campo: "recorrido" },
    { titulo: "Salida", campo: "salida_inicio" },
    { titulo: "Posiciones (orden de visita)", html: (r) => escaparHtml(r.paradas.map((p) => `${p.numero_plano} (N${p.niveles.join("+N")})`).join(" → ")) },
    { titulo: "Distancia (m)", campo: "distancia_m", numero: true },
    { titulo: "Caminar (s)", campo: "tiempo_desplazamiento_s", numero: true },
    { titulo: "Recoger (s)", campo: "tiempo_recogida_s", numero: true },
    { titulo: "Total (s)", campo: "tiempo_total_s", numero: true },
    { titulo: "", html: (r) => (r.es_el_mas_demorado ? '<span class="diferencia">Más demorado</span>' : "") },
  ], resultado.recorridos, (r) => (r.es_el_mas_demorado ? "resaltada" : ""));
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

function conManejoDeErrores(funcion) {
  return (...argumentos) => funcion(...argumentos).catch((error) => mostrarMensaje(error.message, true));
}

document.getElementById("pestanas").addEventListener("click", (evento) => {
  const boton = evento.target.closest("button[data-pestana]");
  if (boton) cambiarPestana(boton.dataset.pestana);
});

document.getElementById("filtro-clase").addEventListener("change", filtrarMaestro);
document.getElementById("buscar-maestro").addEventListener("input", filtrarMaestro);
document.getElementById("boton-generar-maestro").addEventListener("click", conManejoDeErrores(recalcularMaestro));

document.getElementById("boton-ver-semana").addEventListener("click", conManejoDeErrores(cargarSemana));
document.getElementById("ocultar-completas").addEventListener("change", filtrarProgreso);
document.getElementById("boton-regenerar-plan").addEventListener("click", conManejoDeErrores(regenerarPlan));
document.getElementById("boton-exportar-semana").addEventListener("click", () => {
  const semana = document.getElementById("numero-semana").value;
  exportarCsv("conteo", `conteo_semana_${semana}`, { semana: semana });
});

document.getElementById("boton-exportar-pedidos").addEventListener("click", () => {
  const fecha = document.getElementById("fecha-pedidos").value;
  exportarCsv("pedidos", `pedidos_${fecha}`, { fecha: fecha });
});
document.getElementById("fecha-pedidos").addEventListener("change", conManejoDeErrores(consultarPedidos));
document.getElementById("filtro-estado").addEventListener("change", conManejoDeErrores(consultarPedidos));

// Botones creados dentro de las tablas: un solo manejador para toda la página.
document.addEventListener("click", (evento) => {
  const botonRegistrar = evento.target.closest("button[data-registrar]");
  if (botonRegistrar) conManejoDeErrores(registrarConteo)(botonRegistrar.dataset.registrar);

  const botonAvanzar = evento.target.closest("button[data-avanzar]");
  if (botonAvanzar) conManejoDeErrores(avanzarPedido)(botonAvanzar.dataset.avanzar, botonAvanzar.dataset.siguiente);

  const botonExportar = evento.target.closest("button[data-exportar]");
  if (botonExportar) exportarCsv(botonExportar.dataset.exportar, botonExportar.dataset.nombre);
});

cambiarPestana("datos");
