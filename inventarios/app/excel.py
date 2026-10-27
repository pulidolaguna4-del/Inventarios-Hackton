"""Lector de archivos .xlsx usando solo la librería estándar (zipfile + xml.etree).

Un .xlsx es un ZIP con archivos XML adentro:
- xl/workbook.xml y xl/_rels/workbook.xml.rels dicen qué archivo corresponde a cada hoja.
- xl/sharedStrings.xml guarda los textos; las celdas con t="s" solo traen su índice.
- xl/worksheets/sheetN.xml trae las filas y celdas de cada hoja.
"""

import posixpath
import re
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta

from app.config import (
    ERRORES_EXCEL,
    FECHA_BASE_EXCEL,
    NS_HOJA,
    NS_RELACION_DOC,
    NS_RELACION_PAQUETE,
)

_PATRON_REFERENCIA = re.compile(r"^([A-Z]+)(\d+)$")


def convertir_fecha_excel(numero_serial):
    """Convierte un número serial de Excel (ej. 43102) en un objeto date (2018-01-02)."""
    return (datetime(*FECHA_BASE_EXCEL) + timedelta(days=float(numero_serial))).date()


def leer_filas(ruta_archivo, nombre_hoja):
    """Lee una hoja y devuelve {numero_fila: {letra_columna: valor}}.

    Solo aparecen las celdas que tienen valor. Los textos llegan como str,
    los números como int (si no tienen decimales) o float, y los errores
    de Excel como None.
    """
    with zipfile.ZipFile(ruta_archivo) as libro:
        textos_compartidos = _leer_textos_compartidos(libro)
        ruta_hoja = _buscar_ruta_hoja(libro, nombre_hoja)
        with libro.open(ruta_hoja) as archivo_hoja:
            return _leer_celdas(archivo_hoja, textos_compartidos)


def leer_tabla(ruta_archivo, nombre_hoja, fila_encabezados):
    """Lee una hoja como tabla: una lista de diccionarios {encabezado: valor}.

    Toma los encabezados de `fila_encabezados` y convierte cada fila de abajo
    en un diccionario. Las filas totalmente vacías se omiten.
    """
    filas = leer_filas(ruta_archivo, nombre_hoja)
    encabezados = {
        letra: str(texto).strip()
        for letra, texto in filas.get(fila_encabezados, {}).items()
        if texto is not None and str(texto).strip()
    }
    if not encabezados:
        raise ValueError(
            "La hoja '{}' no tiene encabezados en la fila {}".format(nombre_hoja, fila_encabezados)
        )

    registros = []
    for numero_fila in sorted(filas):
        if numero_fila <= fila_encabezados:
            continue
        celdas = filas[numero_fila]
        registro = {nombre: celdas.get(letra) for letra, nombre in encabezados.items()}
        if any(_tiene_valor(valor) for valor in registro.values()):
            registros.append(registro)
    return registros


def _tiene_valor(valor):
    """Indica si una celda trae algo distinto de vacío o espacios."""
    if valor is None:
        return False
    if isinstance(valor, str):
        return bool(valor.strip())
    return True


def _leer_textos_compartidos(libro):
    """Devuelve la lista de textos de xl/sharedStrings.xml (vacía si no existe)."""
    if "xl/sharedStrings.xml" not in libro.namelist():
        return []
    raiz = ET.fromstring(libro.read("xl/sharedStrings.xml"))
    return [_texto_de_elemento(item) for item in raiz.findall(NS_HOJA + "si")]


def _texto_de_elemento(elemento):
    """Une el texto de un <si> o <is>, sea texto simple (<t>) o con formato (<r><t>)."""
    partes = []
    for hijo in elemento:
        if hijo.tag == NS_HOJA + "t":
            partes.append(hijo.text or "")
        elif hijo.tag == NS_HOJA + "r":
            texto = hijo.find(NS_HOJA + "t")
            if texto is not None:
                partes.append(texto.text or "")
    return "".join(partes)


def _buscar_ruta_hoja(libro, nombre_hoja):
    """Encuentra dentro del ZIP el archivo XML de la hoja con ese nombre."""
    libro_xml = ET.fromstring(libro.read("xl/workbook.xml"))
    id_relacion = None
    nombres_disponibles = []
    for hoja in libro_xml.iter(NS_HOJA + "sheet"):
        nombres_disponibles.append(hoja.get("name"))
        if hoja.get("name") == nombre_hoja:
            id_relacion = hoja.get(NS_RELACION_DOC + "id")
    if id_relacion is None:
        raise ValueError(
            "No existe la hoja '{}'. Hojas disponibles: {}".format(nombre_hoja, nombres_disponibles)
        )

    relaciones = ET.fromstring(libro.read("xl/_rels/workbook.xml.rels"))
    for relacion in relaciones.iter(NS_RELACION_PAQUETE + "Relationship"):
        if relacion.get("Id") == id_relacion:
            destino = relacion.get("Target")
            if destino.startswith("/"):
                return destino.lstrip("/")
            return posixpath.normpath(posixpath.join("xl", destino))
    raise ValueError("La hoja '{}' no tiene archivo asociado en el libro".format(nombre_hoja))


def _leer_celdas(archivo_hoja, textos_compartidos):
    """Recorre el XML de la hoja fila por fila, liberando memoria a medida que avanza."""
    filas = {}
    numero_fila_anterior = 0
    for _, elemento in ET.iterparse(archivo_hoja, events=("end",)):
        if elemento.tag != NS_HOJA + "row":
            continue
        numero_fila = int(elemento.get("r") or numero_fila_anterior + 1)
        numero_fila_anterior = numero_fila

        celdas = {}
        for posicion, celda in enumerate(elemento.findall(NS_HOJA + "c")):
            valor = _valor_celda(celda, textos_compartidos)
            if valor is None:
                continue
            letra = _letra_columna(celda.get("r"), posicion)
            celdas[letra] = valor
        if celdas:
            filas[numero_fila] = celdas
        elemento.clear()
    return filas


def _letra_columna(referencia, posicion):
    """Saca la letra de columna de una referencia como 'AB12'.

    Si la celda no trae referencia, se usa su posición dentro de la fila.
    """
    if referencia:
        coincidencia = _PATRON_REFERENCIA.match(referencia)
        if coincidencia:
            return coincidencia.group(1)
    return _numero_a_letra(posicion + 1)


def _numero_a_letra(numero):
    """Convierte 1 -> 'A', 26 -> 'Z', 27 -> 'AA'."""
    letras = ""
    while numero > 0:
        numero, resto = divmod(numero - 1, 26)
        letras = chr(ord("A") + resto) + letras
    return letras


def _valor_celda(celda, textos_compartidos):
    """Convierte una celda <c> en su valor de Python según su tipo (atributo t)."""
    tipo = celda.get("t")
    if tipo == "inlineStr":
        texto_en_linea = celda.find(NS_HOJA + "is")
        return _texto_de_elemento(texto_en_linea) if texto_en_linea is not None else None

    elemento_valor = celda.find(NS_HOJA + "v")
    if elemento_valor is None or elemento_valor.text is None:
        return None
    texto = elemento_valor.text

    if tipo == "s":
        return textos_compartidos[int(texto)]
    if tipo == "e":
        return None
    if tipo == "b":
        return texto == "1"
    if tipo == "str":
        # Resultado de una fórmula de texto; puede ser un error como #REF!.
        return None if texto.strip() in ERRORES_EXCEL else texto
    return _convertir_numero(texto)


def _convertir_numero(texto):
    """Convierte '400016.0' -> 400016 y '74715.5' -> 74715.5."""
    numero = float(texto)
    if numero.is_integer():
        return int(numero)
    return numero
