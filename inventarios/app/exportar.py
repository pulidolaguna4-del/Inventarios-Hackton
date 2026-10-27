"""Exportaciones a CSV. Los archivos quedan en salidas/; los de entrega se nombran Día<N>_Ejercicio<N>.csv."""

import os
import re

from app import datos
from app.config import DIR_SALIDAS, PATRON_NOMBRE_ARCHIVO

_PATRON_NOMBRE = re.compile(PATRON_NOMBRE_ARCHIVO)


def validar_nombre_archivo(nombre):
    """Devuelve el nombre sin espacios ni '.csv'; lanza ValueError si tiene caracteres no permitidos."""
    nombre = str(nombre or "").strip()
    if nombre.lower().endswith(".csv"):
        nombre = nombre[:-4]
    if not _PATRON_NOMBRE.match(nombre):
        raise ValueError(
            "El nombre solo puede tener letras, números, _ y - (ej. Día2_Ejercicio6): {!r}".format(nombre)
        )
    return nombre


def exportar_csv(nombre, filas, columnas, carpeta=DIR_SALIDAS):
    """Guarda las filas en <carpeta>/<nombre>.csv y devuelve la ruta del archivo."""
    nombre = validar_nombre_archivo(nombre)
    ruta = os.path.join(carpeta, nombre + ".csv")
    datos.guardar_csv(ruta, filas, columnas)
    return ruta


def filas_plan_conteo(plan, referencias, semana=None):
    """Una fila por referencia programada: semana, SKU y su ubicación. Opcionalmente, una sola semana."""
    por_sku = {referencia["sku"]: referencia for referencia in referencias}
    filas = []
    for semana_plan in plan["plan"]:
        if semana is not None and semana_plan["semana"] != semana:
            continue
        for sku in semana_plan["skus"]:
            fila = dict(por_sku.get(sku, {"sku": sku}))
            fila["semana"] = semana_plan["semana"]
            filas.append(fila)
    return filas
