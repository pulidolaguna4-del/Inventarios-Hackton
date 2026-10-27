"""Carga y limpieza de los datos del caso, y utilidades para guardar archivos JSON y CSV.

Las ventas y los productos nuevos salen del Excel original, que nunca se modifica.
Los archivos que genera el sistema se escriben primero en un temporal y luego se
reemplazan con os.replace, para no dejar archivos a medio escribir.
"""

import csv
import json
import os
import tempfile
from datetime import date, datetime
from functools import lru_cache

from app import excel
from app.config import (
    CATEGORIA_DESCONOCIDA,
    CATEGORIAS_POR_DIGITO,
    CIUDAD_BODEGA,
    CODIFICACION_CSV,
    COLUMNAS_PRODUCTOS_NUEVOS,
    COLUMNAS_VENTAS,
    FILA_ENCABEZADOS_PRODUCTOS_NUEVOS,
    FILA_ENCABEZADOS_VENTAS,
    HOJA_PRODUCTOS_NUEVOS,
    HOJA_VENTAS,
    MESES,
    RUTA_EXCEL,
    SEPARADOR_CSV,
)

_FORMATOS_FECHA_TEXTO = ("%d/%m/%Y", "%Y-%m-%d")


# ---------------------------------------------------------------------------
# Carga desde el Excel
# ---------------------------------------------------------------------------

def cargar_ventas(ruta_excel=RUTA_EXCEL):
    """Lee la hoja de ventas y devuelve una lista de líneas de pedido limpias.

    Cada línea es un diccionario con: id_pedido, fecha, sku, descripcion,
    cantidad, cliente, ciudad y valor_unitario. Se descartan las líneas a las
    que les falta el pedido, la fecha, el SKU o la cantidad.
    """
    registros = excel.leer_tabla(ruta_excel, HOJA_VENTAS, FILA_ENCABEZADOS_VENTAS)
    _validar_encabezados(registros, COLUMNAS_VENTAS, HOJA_VENTAS)

    lineas = []
    for registro in registros:
        linea = {campo: registro[columna] for columna, campo in COLUMNAS_VENTAS.items()}
        linea["id_pedido"] = _a_entero(linea["id_pedido"])
        linea["fecha"] = _a_fecha(linea["fecha"])
        linea["sku"] = _a_entero(linea["sku"])
        linea["descripcion"] = _a_texto(linea["descripcion"])
        linea["cantidad"] = _a_entero(linea["cantidad"])
        linea["cliente"] = _a_texto(linea["cliente"])
        linea["ciudad"] = _a_texto(linea["ciudad"])
        linea["valor_unitario"] = _a_decimal(linea["valor_unitario"])

        campos_obligatorios = (linea["id_pedido"], linea["fecha"], linea["sku"], linea["cantidad"])
        if any(valor is None for valor in campos_obligatorios):
            continue
        lineas.append(linea)
    return lineas


def cargar_productos_nuevos(ruta_excel=RUTA_EXCEL):
    """Lee la hoja de productos a incluir y devuelve una lista de referencias nuevas.

    Cada producto trae: sku, descripcion, categoria, demanda_mensual (12 valores,
    de enero a diciembre; los meses vacíos valen 0) y demanda_anual.
    """
    registros = excel.leer_tabla(
        ruta_excel, HOJA_PRODUCTOS_NUEVOS, FILA_ENCABEZADOS_PRODUCTOS_NUEVOS
    )
    columnas_esperadas = dict(COLUMNAS_PRODUCTOS_NUEVOS)
    columnas_esperadas.update({mes: mes for mes in MESES})
    _validar_encabezados(registros, columnas_esperadas, HOJA_PRODUCTOS_NUEVOS)

    productos = []
    for registro in registros:
        sku = _a_entero(registro["CODIGO"])
        if sku is None:
            continue
        demanda_mensual = [_a_entero(registro[mes]) or 0 for mes in MESES]
        productos.append({
            "sku": sku,
            "descripcion": _a_texto(registro["DESCRIPCIÓN"]),
            "categoria": categoria_de_sku(sku),
            "demanda_mensual": demanda_mensual,
            "demanda_anual": sum(demanda_mensual),
        })
    return productos


@lru_cache(maxsize=None)
def cargar_datos(ruta_excel=RUTA_EXCEL):
    """Carga ventas y productos nuevos una sola vez y los deja en memoria.

    Devuelve {"ventas": [...], "productos_nuevos": [...]}. Las listas se
    comparten entre llamadas, así que quien las use no debe modificarlas.
    """
    return {
        "ventas": cargar_ventas(ruta_excel),
        "productos_nuevos": cargar_productos_nuevos(ruta_excel),
    }


def _validar_encabezados(registros, columnas_esperadas, nombre_hoja):
    """Lanza ValueError si en la hoja falta alguna de las columnas esperadas."""
    if not registros:
        raise ValueError("La hoja '{}' no tiene datos".format(nombre_hoja))
    faltantes = [columna for columna in columnas_esperadas if columna not in registros[0]]
    if faltantes:
        raise ValueError(
            "A la hoja '{}' le faltan las columnas: {}".format(nombre_hoja, ", ".join(faltantes))
        )


# ---------------------------------------------------------------------------
# Consultas sobre los datos
# ---------------------------------------------------------------------------

def categoria_de_sku(sku):
    """Devuelve la categoría según el primer dígito del SKU (ej. 400016 -> Refrigeración)."""
    return CATEGORIAS_POR_DIGITO.get(str(sku)[:1], CATEGORIA_DESCONOCIDA)


def listar_referencias(ventas, productos_nuevos):
    """Universo de referencias: los SKU vendidos más los nuevos, ordenados por SKU.

    Cada referencia trae sku, descripcion, categoria y si es_nueva.
    """
    referencias = {}
    for linea in ventas:
        if linea["sku"] not in referencias:
            referencias[linea["sku"]] = {
                "sku": linea["sku"],
                "descripcion": linea["descripcion"],
                "categoria": categoria_de_sku(linea["sku"]),
                "es_nueva": False,
            }
    for producto in productos_nuevos:
        referencias.setdefault(producto["sku"], {
            "sku": producto["sku"],
            "descripcion": producto["descripcion"],
            "categoria": producto["categoria"],
            "es_nueva": True,
        })
    return [referencias[sku] for sku in sorted(referencias)]


def lineas_de_ciudad(lineas, ciudad=CIUDAD_BODEGA):
    """Filtra las líneas de pedido de una ciudad (por defecto, la bodega de Arauca)."""
    ciudad_buscada = ciudad.strip().casefold()
    return [linea for linea in lineas if linea["ciudad"].casefold() == ciudad_buscada]


def calcular_resumen(ventas, productos_nuevos, ciudad=CIUDAD_BODEGA):
    """Calcula los totales que muestra la pestaña de datos.

    El universo de referencias es la unión de los SKU vendidos y los nuevos;
    se cuenta a partir de los datos, nunca se escribe fijo.
    """
    lineas_bodega = lineas_de_ciudad(ventas, ciudad)
    fechas_bodega = sorted({linea["fecha"] for linea in lineas_bodega})
    fechas_todas = [linea["fecha"] for linea in ventas]
    skus_ventas = {linea["sku"] for linea in ventas}
    skus_nuevos = {producto["sku"] for producto in productos_nuevos}

    return {
        "bodega": ciudad,
        "referencias_totales": len(skus_ventas | skus_nuevos),
        "referencias_ventas": len(skus_ventas),
        "referencias_nuevas": len(skus_nuevos),
        "lineas_ventas": len(ventas),
        "ordenes_totales": len({linea["id_pedido"] for linea in ventas}),
        "lineas_bodega": len(lineas_bodega),
        "ordenes_bodega": len({linea["id_pedido"] for linea in lineas_bodega}),
        "dias_con_pedidos_bodega": len(fechas_bodega),
        "fecha_inicial": min(fechas_todas).isoformat() if fechas_todas else None,
        "fecha_final": max(fechas_todas).isoformat() if fechas_todas else None,
        "fechas_disponibles": [fecha.isoformat() for fecha in fechas_bodega],
    }


# ---------------------------------------------------------------------------
# Conversión de valores
# ---------------------------------------------------------------------------

def _a_entero(valor):
    """Convierte 400016.0, '400016' o 400016 en 400016; lo vacío o inválido en None."""
    if valor is None or isinstance(valor, bool):
        return None
    if isinstance(valor, (int, float)):
        return int(valor)
    try:
        return int(float(str(valor).strip()))
    except ValueError:
        return None


def _a_decimal(valor):
    """Convierte un valor en float; lo vacío o inválido (ej. ' ') en None."""
    if valor is None or isinstance(valor, bool):
        return None
    if isinstance(valor, (int, float)):
        return float(valor)
    try:
        return float(str(valor).strip())
    except ValueError:
        return None


def _a_texto(valor):
    """Convierte un valor en texto sin espacios al inicio ni al final."""
    if valor is None:
        return ""
    return str(valor).strip()


def _a_fecha(valor):
    """Convierte un serial de Excel o un texto dd/mm/aaaa o aaaa-mm-dd en date."""
    if valor is None or isinstance(valor, bool):
        return None
    if isinstance(valor, (int, float)):
        return excel.convertir_fecha_excel(valor)
    texto = str(valor).strip()
    for formato in _FORMATOS_FECHA_TEXTO:
        try:
            return datetime.strptime(texto, formato).date()
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------------------
# Persistencia
# ---------------------------------------------------------------------------

def leer_json(ruta, por_defecto=None):
    """Lee un archivo JSON; si no existe devuelve `por_defecto`."""
    if not os.path.exists(ruta):
        return por_defecto
    with open(ruta, "r", encoding="utf-8") as archivo:
        return json.load(archivo)


def guardar_json(ruta, datos):
    """Guarda `datos` como JSON legible. Las fechas se escriben como aaaa-mm-dd."""
    contenido = json.dumps(datos, ensure_ascii=False, indent=2, default=_serializar_valor)
    _escribir_atomico(ruta, contenido, "utf-8")


def guardar_csv(ruta, filas, columnas):
    """Guarda una lista de diccionarios como CSV con las `columnas` en ese orden.

    Usa punto y coma y BOM UTF-8 para que Excel en español lo abra con tildes.
    """
    lineas = _LineasCsv()
    escritor = csv.DictWriter(
        lineas, fieldnames=columnas, delimiter=SEPARADOR_CSV, extrasaction="ignore"
    )
    escritor.writeheader()
    for fila in filas:
        escritor.writerow({columna: _valor_para_csv(fila.get(columna)) for columna in columnas})
    _escribir_atomico(ruta, "".join(lineas.partes), CODIFICACION_CSV)


class _LineasCsv:
    """Acumula en memoria lo que escribe csv.DictWriter."""

    def __init__(self):
        self.partes = []

    def write(self, texto):
        self.partes.append(texto)


def _valor_para_csv(valor):
    """Prepara un valor para el CSV: fechas en ISO y listas separadas por coma."""
    if isinstance(valor, (date, datetime)):
        return valor.isoformat()
    if isinstance(valor, (list, tuple)):
        return ", ".join(str(elemento) for elemento in valor)
    return "" if valor is None else valor


def _serializar_valor(valor):
    """Permite que json.dumps escriba fechas."""
    if isinstance(valor, (date, datetime)):
        return valor.isoformat()
    raise TypeError("No se puede convertir a JSON: {!r}".format(valor))


def _escribir_atomico(ruta, contenido, codificacion):
    """Escribe en un temporal de la misma carpeta y luego lo pone en `ruta` con os.replace."""
    carpeta = os.path.dirname(os.path.abspath(ruta))
    os.makedirs(carpeta, exist_ok=True)
    descriptor, ruta_temporal = tempfile.mkstemp(dir=carpeta, suffix=".tmp")
    try:
        with os.fdopen(descriptor, "w", encoding=codificacion, newline="") as archivo:
            archivo.write(contenido)
        os.replace(ruta_temporal, ruta)
    except BaseException:
        if os.path.exists(ruta_temporal):
            os.remove(ruta_temporal)
        raise
