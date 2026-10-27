"""Maestro de ubicaciones: popularidad, clasificación ABC y asignación SKU -> ubicación.

Criterios:
- Popularidad = número de líneas de pedido del SKU en la bodega de Arauca.
- Referencias nuevas (sin ventas): su demanda anual proyectada se convierte en
  "líneas equivalentes" con el promedio de Arauca:
      líneas equivalentes = demanda anual × (líneas de Arauca ÷ unidades de Arauca)
  Así quedan en la misma escala que las referencias que ya se venden.
- Clase ABC por popularidad acumulada: A hasta UMBRAL_CLASE_A (80 %), B hasta
  UMBRAL_CLASE_B (95 %) y C el resto. La referencia que cruza el umbral queda
  en la clase de arriba.
- Asignación: los SKU más populares van a los huecos más convenientes (ver
  ordenar_huecos). Si existe el CSV de logística, sus ubicaciones mandan.
"""

import csv
import os
from datetime import datetime

from app import bodega, datos
from app.config import (
    CIUDAD_BODEGA,
    PRIORIZAR_NIVEL_1,
    RUTA_MAESTRO_LOGISTICA,
    SALIDAS,
    UMBRAL_CLASE_A,
    UMBRAL_CLASE_B,
)

CLASES_ABC = ("A", "B", "C")


# ---------------------------------------------------------------------------
# Popularidad y ABC
# ---------------------------------------------------------------------------

def factor_lineas_por_unidad(lineas_bodega):
    """Líneas de pedido por unidad vendida en la bodega (para convertir demanda en líneas)."""
    unidades = sum(linea["cantidad"] for linea in lineas_bodega)
    return len(lineas_bodega) / unidades if unidades else 0.0


def calcular_popularidad(ventas, productos_nuevos, ciudad=CIUDAD_BODEGA):
    """Devuelve la lista de referencias con su popularidad, ordenada de mayor a menor.

    Cada referencia trae: sku, descripcion, categoria, es_nueva, popularidad y
    origen_popularidad ('ventas' o 'proyeccion'). Las referencias que solo se
    venden en otras ciudades quedan con popularidad 0.
    """
    lineas_bodega = datos.lineas_de_ciudad(ventas, ciudad)
    lineas_por_sku = {}
    for linea in lineas_bodega:
        lineas_por_sku[linea["sku"]] = lineas_por_sku.get(linea["sku"], 0) + 1
    factor = factor_lineas_por_unidad(lineas_bodega)
    demanda_nuevos = {producto["sku"]: producto["demanda_anual"] for producto in productos_nuevos}

    referencias = []
    for referencia in datos.listar_referencias(ventas, productos_nuevos):
        fila = dict(referencia)
        if referencia["es_nueva"]:
            fila["popularidad"] = round(demanda_nuevos[referencia["sku"]] * factor, 2)
            fila["origen_popularidad"] = "proyeccion"
        else:
            fila["popularidad"] = lineas_por_sku.get(referencia["sku"], 0)
            fila["origen_popularidad"] = "ventas"
        referencias.append(fila)

    referencias.sort(key=lambda fila: (-fila["popularidad"], fila["sku"]))
    return referencias


def clasificar_abc(referencias_ordenadas, umbral_a=UMBRAL_CLASE_A, umbral_b=UMBRAL_CLASE_B):
    """Agrega clase_abc y porcentaje_acumulado a referencias ya ordenadas por popularidad."""
    total = sum(referencia["popularidad"] for referencia in referencias_ordenadas)
    acumulado = 0.0
    for referencia in referencias_ordenadas:
        participacion_previa = acumulado / total if total else 1.0
        if participacion_previa < umbral_a:
            referencia["clase_abc"] = "A"
        elif participacion_previa < umbral_b:
            referencia["clase_abc"] = "B"
        else:
            referencia["clase_abc"] = "C"
        acumulado += referencia["popularidad"]
        referencia["porcentaje_acumulado"] = round(100 * acumulado / total, 2) if total else 0.0
    return referencias_ordenadas


# ---------------------------------------------------------------------------
# Asignación de ubicaciones
# ---------------------------------------------------------------------------

def distancia_a_salida_mas_cercana(columna, fila):
    """Metros desde la celda hasta la salida más cercana."""
    punto = bodega.coordenadas_celda(columna, fila)
    return min(bodega.distancia(punto, coordenadas) for coordenadas in SALIDAS.values())


def ordenar_huecos(priorizar_nivel_1=PRIORIZAR_NIVEL_1):
    """Lista de huecos de picking del más conveniente al menos conveniente.

    Con priorizar_nivel_1 van primero todos los de nivel 1 (picking a nivel de
    suelo; el nivel 2 tarda el triple) y luego los de nivel 2, cada grupo por
    cercanía a la salida. Sin él, se ordena por distancia y en la misma celda
    va primero el nivel 1.
    """
    huecos = []
    for hueco in bodega.huecos():
        hueco = dict(hueco)
        hueco["distancia_salida_m"] = round(distancia_a_salida_mas_cercana(hueco["columna"], hueco["fila"]), 2)
        huecos.append(hueco)

    def clave(hueco):
        celda = (hueco["columna"], hueco["fila"])
        if priorizar_nivel_1:
            return (hueco["nivel"], hueco["distancia_salida_m"]) + celda
        return (hueco["distancia_salida_m"],) + celda + (hueco["nivel"],)

    return sorted(huecos, key=clave)


def asignar_ubicaciones(referencias_ordenadas, ubicaciones_fijas=None, priorizar_nivel_1=PRIORIZAR_NIVEL_1):
    """Asigna un hueco a cada referencia, de la más popular a la menos popular.

    `ubicaciones_fijas` es {sku: codigo_ubicacion} (por ejemplo, del CSV de
    logística): esas se respetan y los demás SKU se reparten en los huecos libres.
    Lanza ValueError si no alcanzan los huecos o si dos SKU fijos comparten hueco.
    """
    ubicaciones_fijas = ubicaciones_fijas or {}
    huecos_por_codigo = {hueco["codigo_ubicacion"]: hueco for hueco in ordenar_huecos(priorizar_nivel_1)}

    ocupados = {}
    for sku, codigo in ubicaciones_fijas.items():
        if codigo not in huecos_por_codigo:
            raise ValueError("Ubicación inválida para el SKU {}: {}".format(sku, codigo))
        if codigo in ocupados:
            raise ValueError("Los SKU {} y {} tienen la misma ubicación {}".format(ocupados[codigo], sku, codigo))
        ocupados[codigo] = sku

    libres = [codigo for codigo in huecos_por_codigo if codigo not in ocupados]
    por_asignar = [r for r in referencias_ordenadas if r["sku"] not in ubicaciones_fijas]
    if len(por_asignar) > len(libres):
        raise ValueError("Hay {} referencias por ubicar y solo {} huecos libres".format(len(por_asignar), len(libres)))

    codigos_libres = iter(libres)
    maestro = []
    for referencia in referencias_ordenadas:
        fila = dict(referencia)
        if referencia["sku"] in ubicaciones_fijas:
            codigo = ubicaciones_fijas[referencia["sku"]]
            fila["fuente_ubicacion"] = "logistica"
        else:
            codigo = next(codigos_libres)
            fila["fuente_ubicacion"] = "generada"
        hueco = huecos_por_codigo[codigo]
        fila.update({
            "codigo_ubicacion": codigo,
            "columna": hueco["columna"],
            "fila": hueco["fila"],
            "nivel": hueco["nivel"],
            "numero_plano": hueco["numero_plano"],
            "distancia_salida_m": hueco["distancia_salida_m"],
        })
        maestro.append(fila)
    return maestro


# ---------------------------------------------------------------------------
# Maestro completo
# ---------------------------------------------------------------------------

def generar_maestro(ventas, productos_nuevos, ruta_logistica=RUTA_MAESTRO_LOGISTICA):
    """Calcula popularidad, ABC y ubicaciones. Devuelve el diccionario que se guarda en JSON."""
    referencias = clasificar_abc(calcular_popularidad(ventas, productos_nuevos))

    logistica = leer_maestro_logistica(ruta_logistica)
    skus_conocidos = {referencia["sku"] for referencia in referencias}
    desconocidos = sorted(set(logistica) - skus_conocidos)
    if desconocidos:
        raise ValueError("El maestro de logística trae SKU que no existen: {}".format(desconocidos))
    for referencia in referencias:
        clase = logistica.get(referencia["sku"], {}).get("clase_abc")
        if clase:
            referencia["clase_abc"] = clase

    ubicaciones_fijas = {
        sku: fila["codigo_ubicacion"] for sku, fila in logistica.items() if fila.get("codigo_ubicacion")
    }
    maestro = asignar_ubicaciones(referencias, ubicaciones_fijas)
    lineas_bodega = datos.lineas_de_ciudad(ventas)

    return {
        "generado": datetime.now().isoformat(timespec="seconds"),
        "fuente": "logistica + generado" if logistica else "generado",
        "criterios": {
            "popularidad": "líneas de pedido en {}".format(CIUDAD_BODEGA),
            "popularidad_nuevas": "demanda anual × líneas/unidad de {}".format(CIUDAD_BODEGA),
            "factor_lineas_por_unidad": round(factor_lineas_por_unidad(lineas_bodega), 6),
            "umbral_a": UMBRAL_CLASE_A,
            "umbral_b": UMBRAL_CLASE_B,
            "priorizar_nivel_1": PRIORIZAR_NIVEL_1,
        },
        "conteo_por_clase": {clase: sum(1 for r in maestro if r["clase_abc"] == clase) for clase in CLASES_ABC},
        "referencias": maestro,
    }


def leer_maestro_logistica(ruta):
    """Lee el CSV de logística si existe: {sku: {"codigo_ubicacion", "clase_abc"}}.

    Acepta separador ';' o ','. Las columnas obligatorias son sku y codigo_ubicacion
    (los nombres no distinguen mayúsculas).
    """
    if not ruta or not os.path.exists(ruta):
        return {}
    with open(ruta, "r", encoding="utf-8-sig", newline="") as archivo:
        contenido = archivo.read()
    separador = ";" if contenido.count(";") >= contenido.count(",") else ","
    lector = csv.DictReader(contenido.splitlines(), delimiter=separador)
    if not lector.fieldnames:
        return {}
    columnas = {nombre.strip().lower(): nombre for nombre in lector.fieldnames}
    if "sku" not in columnas or "codigo_ubicacion" not in columnas:
        raise ValueError("El maestro de logística debe tener las columnas sku y codigo_ubicacion")

    resultado = {}
    for numero_linea, fila in enumerate(lector, start=2):
        texto_sku = (fila.get(columnas["sku"]) or "").strip()
        if not texto_sku:
            continue
        try:
            sku = int(float(texto_sku))
        except ValueError:
            raise ValueError("SKU inválido en la línea {} del maestro de logística: {!r}".format(numero_linea, texto_sku))
        codigo = (fila.get(columnas["codigo_ubicacion"]) or "").strip().upper()
        if codigo:
            bodega.interpretar_codigo(codigo)
        clase = (fila.get(columnas.get("clase_abc", ""), "") or "").strip().upper()
        if clase and clase not in CLASES_ABC:
            raise ValueError("Clase ABC inválida en la línea {}: {!r}".format(numero_linea, clase))
        resultado[sku] = {"codigo_ubicacion": codigo or None, "clase_abc": clase or None}
    return resultado


def cargar_maestro(ruta):
    """Lee el maestro guardado; None si todavía no existe."""
    return datos.leer_json(ruta)


def guardar_maestro(ruta, maestro):
    datos.guardar_json(ruta, maestro)
