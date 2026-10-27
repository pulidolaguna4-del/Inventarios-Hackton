"""Servidor HTTP del sistema de inventarios (solo librería estándar).

Recibe las peticiones, llama a los módulos de app/ y responde en JSON.
Las rutas que no empiezan por /api/ se sirven como archivos de static/.

Uso:
    python servidor.py
"""

import json
import os
import re
import threading
import time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, unquote, urlparse

from app import conteo, datos, exportar, maestro, pedidos, picking
from app.config import (
    COLUMNAS_EXPORTAR_MAESTRO,
    COLUMNAS_EXPORTAR_PEDIDOS,
    COLUMNAS_EXPORTAR_PLAN_CONTEO,
    COLUMNAS_EXPORTAR_REGISTROS_CONTEO,
    COLUMNAS_LISTA_DESPACHO,
    DIR_SALIDAS,
    DIR_STATIC,
    DIR_STATIC_PRUEBAS,
    ESTADOS_PEDIDO,
    HOST_SERVIDOR,
    PUERTO_SERVIDOR,
    RUTA_ESTADOS_PEDIDOS,
    RUTA_MAESTRO,
    RUTA_PLAN_CONTEO,
    RUTA_REGISTROS_CONTEO,
    SEMILLA_CONTEO,
    TIPO_CONTENIDO_POR_DEFECTO,
    TIPOS_CONTENIDO,
)

# Evita que dos peticiones al tiempo lean y escriban los mismos archivos JSON.
_CANDADO_ARCHIVOS = threading.Lock()


class ErrorApi(Exception):
    """Error que se devuelve al cliente como {"error": mensaje} con su código HTTP."""

    def __init__(self, codigo, mensaje):
        super().__init__(mensaje)
        self.codigo = codigo
        self.mensaje = mensaje


class RespuestaArchivo:
    """Respuesta que se descarga como archivo en vez de mostrarse como JSON."""

    def __init__(self, nombre_archivo, contenido, tipo_contenido):
        self.nombre_archivo = nombre_archivo
        self.contenido = contenido
        self.tipo_contenido = tipo_contenido


# ---------------------------------------------------------------------------
# Funciones de la API: reciben (parametros_ruta, consulta, cuerpo) y devuelven datos
# ---------------------------------------------------------------------------

def api_resumen(parametros_ruta, consulta, cuerpo):
    """GET /api/resumen: totales de referencias, órdenes de Arauca y fechas disponibles."""
    datos_caso = datos.cargar_datos()
    return datos.calcular_resumen(datos_caso["ventas"], datos_caso["productos_nuevos"])


def _generar_y_guardar_maestro():
    datos_caso = datos.cargar_datos()
    nuevo_maestro = maestro.generar_maestro(datos_caso["ventas"], datos_caso["productos_nuevos"])
    maestro.guardar_maestro(RUTA_MAESTRO, nuevo_maestro)
    return nuevo_maestro


def _maestro_actual():
    """Lee el maestro guardado; si no existe, lo genera."""
    maestro_guardado = maestro.cargar_maestro(RUTA_MAESTRO)
    if maestro_guardado is None:
        maestro_guardado = _generar_y_guardar_maestro()
    return maestro_guardado


def _referencias_actuales():
    """Universo de referencias del inventario: las del maestro, con su ubicación."""
    return _maestro_actual()["referencias"]


def api_maestro(parametros_ruta, consulta, cuerpo):
    """GET /api/maestro: maestro de ubicaciones con popularidad y clase ABC."""
    with _CANDADO_ARCHIVOS:
        return _maestro_actual()


def api_maestro_generar(parametros_ruta, consulta, cuerpo):
    """POST /api/maestro/generar: recalcula el ABC y las ubicaciones (respeta el CSV de logística)."""
    with _CANDADO_ARCHIVOS:
        return _generar_y_guardar_maestro()


def _plan_actual():
    """Lee el plan de conteo guardado; si no existe, lo genera con la semilla por defecto."""
    plan = conteo.cargar_plan(RUTA_PLAN_CONTEO)
    if plan is None:
        skus = [referencia["sku"] for referencia in _referencias_actuales()]
        plan = conteo.generar_plan(skus, SEMILLA_CONTEO)
        conteo.guardar_plan(RUTA_PLAN_CONTEO, plan)
    return plan


def api_conteo_generar_plan(parametros_ruta, consulta, cuerpo):
    """POST /api/conteo/plan/generar: {"semilla": 2026, "forzar": false}.

    Si ya hay conteos registrados no se regenera, salvo con "forzar": true; en
    ese caso los registros se respaldan en otro archivo y se empieza de cero.
    """
    semilla = cuerpo.get("semilla", SEMILLA_CONTEO)
    if not isinstance(semilla, int) or isinstance(semilla, bool):
        raise ErrorApi(400, "La semilla debe ser un número entero")

    with _CANDADO_ARCHIVOS:
        registros = conteo.cargar_registros(RUTA_REGISTROS_CONTEO)
        respaldo = None
        if registros:
            if not cuerpo.get("forzar"):
                raise ErrorApi(409, (
                    "Ya hay {} conteos registrados con el plan actual. "
                    "Envíe \"forzar\": true para respaldarlos y empezar de cero."
                ).format(len(registros)))
            respaldo = os.path.basename(conteo.respaldar_archivo(RUTA_REGISTROS_CONTEO))
            conteo.guardar_registros(RUTA_REGISTROS_CONTEO, [])

        referencias = _referencias_actuales()
        skus = [referencia["sku"] for referencia in referencias]
        plan = conteo.generar_plan(skus, semilla)
        conteo.guardar_plan(RUTA_PLAN_CONTEO, plan)

    return {
        "mensaje": "Plan generado con semilla {}".format(semilla),
        "respaldo_registros": respaldo,
        "tamanos": plan["tamanos"],
        "verificacion": conteo.verificar_plan(plan, skus),
    }


def api_conteo_semana(parametros_ruta, consulta, cuerpo):
    """GET /api/conteo/semana/<n>: referencias de la semana con su progreso X/5."""
    numero_semana = int(parametros_ruta[0])
    with _CANDADO_ARCHIVOS:
        plan = _plan_actual()
        registros = conteo.cargar_registros(RUTA_REGISTROS_CONTEO)
    return conteo.referencias_de_semana(numero_semana, plan, registros, _referencias_actuales())


def api_conteo_registro(parametros_ruta, consulta, cuerpo):
    """POST /api/conteo/registro: guarda un conteo y devuelve el registro creado."""
    referencias = _referencias_actuales()
    referencias_por_sku = {referencia["sku"]: referencia for referencia in referencias}
    with _CANDADO_ARCHIVOS:
        plan = _plan_actual()
        registros = conteo.cargar_registros(RUTA_REGISTROS_CONTEO)
        registro = conteo.crear_registro(cuerpo, plan, registros, referencias_por_sku)
        registros.append(registro)
        conteo.guardar_registros(RUTA_REGISTROS_CONTEO, registros)
    return {"mensaje": "Conteo registrado", "registro": registro}


def api_conteo_progreso(parametros_ruta, consulta, cuerpo):
    """GET /api/conteo/progreso: conteos por referencia, avance semanal y verificación anual del plan."""
    with _CANDADO_ARCHIVOS:
        plan = _plan_actual()
        registros = conteo.cargar_registros(RUTA_REGISTROS_CONTEO)
    return conteo.resumen_progreso(plan, registros, _referencias_actuales())


def api_conteo_registros(parametros_ruta, consulta, cuerpo):
    """GET /api/conteo/registros[?sku=N&semana=N]: registros de conteo, del más reciente al más antiguo."""
    sku = int(consulta["sku"]) if consulta.get("sku") else None
    semana = int(consulta["semana"]) if consulta.get("semana") else None
    with _CANDADO_ARCHIVOS:
        registros = conteo.cargar_registros(RUTA_REGISTROS_CONTEO)
    return {"registros": conteo.filtrar_registros(registros, sku, semana)}


def api_pedidos(parametros_ruta, consulta, cuerpo):
    """GET /api/pedidos?fecha=AAAA-MM-DD[&estado=...]: pedidos de Arauca de esa fecha con su estado.

    Sin fecha se usa la primera fecha con pedidos.
    """
    ventas = datos.cargar_datos()["ventas"]
    texto_fecha = consulta.get("fecha")
    if texto_fecha:
        try:
            fecha = datetime.strptime(texto_fecha, "%Y-%m-%d").date()
        except ValueError:
            raise ErrorApi(400, "La fecha debe tener el formato AAAA-MM-DD: {}".format(texto_fecha))
    else:
        fecha = min(linea["fecha"] for linea in datos.lineas_de_ciudad(ventas))

    with _CANDADO_ARCHIVOS:
        estados = pedidos.cargar_estados(RUTA_ESTADOS_PEDIDOS)
    listado = pedidos.pedidos_con_estado(pedidos.agrupar_pedidos(ventas, fecha=fecha), estados)

    estado_filtro = consulta.get("estado")
    if estado_filtro:
        if estado_filtro not in ESTADOS_PEDIDO:
            raise ErrorApi(400, "Estado desconocido: {}".format(estado_filtro))
        listado_filtrado = [pedido for pedido in listado if pedido["estado"] == estado_filtro]
    else:
        listado_filtrado = listado

    return {
        "fecha": fecha.isoformat(),
        "estados": list(ESTADOS_PEDIDO),
        "conteo_por_estado": pedidos.conteo_por_estado(listado),
        "pedidos": listado_filtrado,
    }


def api_pedido_cambiar_estado(parametros_ruta, consulta, cuerpo):
    """POST /api/pedidos/<id>/estado: {"estado": "En entrega"}. Solo avanza al estado siguiente."""
    id_pedido = int(parametros_ruta[0])
    if id_pedido not in pedidos.ids_de_pedidos(datos.cargar_datos()["ventas"]):
        raise ErrorApi(404, "No existe el pedido {} en la bodega".format(id_pedido))
    estado_nuevo = cuerpo.get("estado")
    if not estado_nuevo:
        raise ErrorApi(400, "Falta el campo 'estado'")

    with _CANDADO_ARCHIVOS:
        estados = pedidos.cargar_estados(RUTA_ESTADOS_PEDIDOS)
        estados = pedidos.cambiar_estado(estados, id_pedido, estado_nuevo)
        pedidos.guardar_estados(RUTA_ESTADOS_PEDIDOS, estados)

    guardado = estados[str(id_pedido)]
    return {
        "id_pedido": id_pedido,
        "estado": guardado["estado"],
        "siguiente_estado": pedidos.siguiente_estado(guardado["estado"]),
        "historial": guardado["historial"],
    }


def api_picking_prueba(parametros_ruta, consulta, cuerpo):
    """GET /api/picking/prueba: trayectos de la Tarea 6 (informativo: tiempo y el más demorado)."""
    return picking.picking_tarea_6()


def _filas_para_exportar(tipo, consulta):
    """Devuelve (filas, columnas) del tipo de exportación pedido."""
    if tipo == "maestro":
        with _CANDADO_ARCHIVOS:
            return _referencias_actuales(), COLUMNAS_EXPORTAR_MAESTRO
    if tipo == "conteo":
        semana = int(consulta["semana"]) if consulta.get("semana") else None
        with _CANDADO_ARCHIVOS:
            plan = _plan_actual()
            referencias = _referencias_actuales()
        return exportar.filas_plan_conteo(plan, referencias, semana), COLUMNAS_EXPORTAR_PLAN_CONTEO
    if tipo == "registros_conteo":
        with _CANDADO_ARCHIVOS:
            return conteo.cargar_registros(RUTA_REGISTROS_CONTEO), COLUMNAS_EXPORTAR_REGISTROS_CONTEO
    if tipo == "pedidos":
        return api_pedidos(None, consulta, {})["pedidos"], COLUMNAS_EXPORTAR_PEDIDOS
    if tipo == "picking":
        return picking.picking_tarea_6()["lista"], COLUMNAS_LISTA_DESPACHO
    raise ErrorApi(404, "Tipo de exportación desconocido: {}. Opciones: maestro, conteo, "
                        "registros_conteo, pedidos, picking".format(tipo))


def api_exportar(parametros_ruta, consulta, cuerpo):
    """GET /api/exportar/<tipo>?nombre=Día2_Ejercicio6: guarda el CSV en salidas/ y lo descarga."""
    tipo = parametros_ruta[0]
    filas, columnas = _filas_para_exportar(tipo, consulta)
    ruta = exportar.exportar_csv(consulta.get("nombre"), filas, columnas, DIR_SALIDAS)
    with open(ruta, "rb") as archivo:
        contenido = archivo.read()
    return RespuestaArchivo(os.path.basename(ruta), contenido, TIPOS_CONTENIDO[".csv"])


# Cada ruta: (método, patrón de la URL, función). Los grupos del patrón llegan
# a la función en `parametros_ruta`.
RUTAS = [
    ("GET", re.compile(r"^/api/resumen$"), api_resumen),
    ("GET", re.compile(r"^/api/maestro$"), api_maestro),
    ("POST", re.compile(r"^/api/maestro/generar$"), api_maestro_generar),
    ("GET", re.compile(r"^/api/pedidos$"), api_pedidos),
    ("POST", re.compile(r"^/api/pedidos/(\d+)/estado$"), api_pedido_cambiar_estado),
    ("POST", re.compile(r"^/api/conteo/plan/generar$"), api_conteo_generar_plan),
    ("GET", re.compile(r"^/api/conteo/semana/(\d+)$"), api_conteo_semana),
    ("POST", re.compile(r"^/api/conteo/registro$"), api_conteo_registro),
    ("GET", re.compile(r"^/api/conteo/progreso$"), api_conteo_progreso),
    ("GET", re.compile(r"^/api/conteo/registros$"), api_conteo_registros),
    ("GET", re.compile(r"^/api/picking/prueba$"), api_picking_prueba),
    ("GET", re.compile(r"^/api/exportar/(\w+)$"), api_exportar),
]


# ---------------------------------------------------------------------------
# Manejo de peticiones
# ---------------------------------------------------------------------------

class ManejadorInventarios(BaseHTTPRequestHandler):
    """Atiende las peticiones GET y POST del frontend."""

    def do_GET(self):
        url = urlparse(self.path)
        if url.path.startswith("/api/"):
            self._atender_api("GET", url)
        else:
            self._servir_estatico(url.path)

    def do_POST(self):
        self._atender_api("POST", urlparse(self.path))

    def _atender_api(self, metodo, url):
        """Busca la ruta, ejecuta su función y responde en JSON."""
        try:
            funcion, parametros_ruta = _buscar_ruta(metodo, url.path)
            consulta = {clave: valores[0] for clave, valores in parse_qs(url.query).items()}
            cuerpo = self._leer_cuerpo_json() if metodo == "POST" else {}
            resultado = funcion(parametros_ruta, consulta, cuerpo)
            if isinstance(resultado, RespuestaArchivo):
                self._responder_archivo(resultado)
            else:
                self._responder_json(200, resultado)
        except ErrorApi as error:
            self._responder_json(error.codigo, {"error": error.mensaje})
        except ValueError as error:
            self._responder_json(400, {"error": str(error)})
        except Exception as error:  # Cualquier fallo inesperado se informa sin tumbar el servidor.
            self.log_error("Error interno: %r", error)
            self._responder_json(500, {"error": "Error interno: {}".format(error)})

    def _leer_cuerpo_json(self):
        """Lee el cuerpo de la petición como JSON; vacío equivale a {}."""
        longitud = int(self.headers.get("Content-Length") or 0)
        if longitud == 0:
            return {}
        texto = self.rfile.read(longitud).decode("utf-8")
        try:
            return json.loads(texto)
        except json.JSONDecodeError:
            raise ErrorApi(400, "El cuerpo de la petición no es un JSON válido")

    def _responder_json(self, codigo, contenido):
        cuerpo = json.dumps(contenido, ensure_ascii=False).encode("utf-8")
        self._responder(codigo, TIPOS_CONTENIDO[".json"], cuerpo)

    def _servir_estatico(self, ruta_url):
        """Entrega un archivo del frontend.

        - /pruebas/... sale de static_pruebas/ (página sencilla de pruebas).
        - Lo demás sale de static/ (frontend React compilado). Las rutas sin
          extensión (ej. /pedidos) devuelven index.html para que las maneje React.
        """
        ruta_url = unquote(ruta_url)
        carpeta = DIR_STATIC
        if ruta_url.startswith("/pruebas/"):
            carpeta = DIR_STATIC_PRUEBAS
            ruta_url = ruta_url[len("/pruebas"):]

        ruta_relativa = ruta_url.lstrip("/") or "index.html"
        carpeta_real = os.path.realpath(carpeta)
        ruta_archivo = os.path.realpath(os.path.join(carpeta_real, ruta_relativa))
        fuera_de_carpeta = os.path.commonpath([ruta_archivo, carpeta_real]) != carpeta_real
        es_ruta_de_la_pagina = not os.path.splitext(ruta_relativa)[1]
        if not fuera_de_carpeta and not os.path.isfile(ruta_archivo) and es_ruta_de_la_pagina:
            ruta_archivo = os.path.join(carpeta_real, "index.html")
        if fuera_de_carpeta or not os.path.isfile(ruta_archivo):
            self._responder_json(404, {"error": "No existe el archivo: {}".format(ruta_url)})
            return
        extension = os.path.splitext(ruta_archivo)[1].lower()
        with open(ruta_archivo, "rb") as archivo:
            contenido = archivo.read()
        self._responder(200, TIPOS_CONTENIDO.get(extension, TIPO_CONTENIDO_POR_DEFECTO), contenido)

    def _responder_archivo(self, respuesta):
        """Envía un archivo para descargar; el nombre va codificado porque lleva tilde (Día)."""
        nombre_codificado = quote(respuesta.nombre_archivo)
        self._responder(200, respuesta.tipo_contenido, respuesta.contenido, {
            "Content-Disposition": "attachment; filename*=UTF-8''{}".format(nombre_codificado),
        })

    def _responder(self, codigo, tipo_contenido, cuerpo, encabezados_extra=None):
        self.send_response(codigo)
        for nombre, valor in (encabezados_extra or {}).items():
            self.send_header(nombre, valor)
        self.send_header("Content-Type", tipo_contenido)
        self.send_header("Content-Length", str(len(cuerpo)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(cuerpo)


def _buscar_ruta(metodo, ruta_url):
    """Devuelve (función, parámetros) de la ruta que coincide, o lanza ErrorApi 404/405."""
    ruta_existe = False
    for metodo_ruta, patron, funcion in RUTAS:
        coincidencia = patron.match(ruta_url)
        if not coincidencia:
            continue
        ruta_existe = True
        if metodo_ruta == metodo:
            return funcion, coincidencia.groups()
    if ruta_existe:
        raise ErrorApi(405, "Método {} no permitido en {}".format(metodo, ruta_url))
    raise ErrorApi(404, "No existe la ruta {}".format(ruta_url))


def iniciar_servidor(host=HOST_SERVIDOR, puerto=PUERTO_SERVIDOR):
    """Carga el Excel en memoria y deja el servidor escuchando hasta Ctrl+C."""
    inicio = time.time()
    datos.cargar_datos()
    print("Datos cargados en {:.1f} s".format(time.time() - inicio))

    servidor = ThreadingHTTPServer((host, puerto), ManejadorInventarios)
    print("Servidor en http://{}:{}  (Ctrl+C para detener)".format(host, puerto))
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido")
    finally:
        servidor.server_close()


if __name__ == "__main__":
    iniciar_servidor()
