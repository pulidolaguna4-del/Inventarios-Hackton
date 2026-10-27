"""Layout de la bodega de Arauca: ubicaciones, coordenadas y distancias.

Una ubicación se identifica por (columna, fila, nivel). El número del plano solo
es una etiqueta, porque en el plano el 22 y el 35 aparecen dos veces.

Modelo de coordenadas (en metros):
- x: centro del pasillo desde el que se recoge la columna.
- y: centro de la celda medido desde la pared de las salidas (y = 0).
- Debajo de y = ALTO_ZONA_ABIERTA hay una zona libre donde se camina en línea recta.
- Para pasar de un pasillo a otro se usa la cabecera inferior o la superior.
"""

import re

from app.config import (
    ALTO_ZONA_ABIERTA,
    LARGO_CELDA,
    LAYOUT_NUMEROS,
    NIVELES_PICKING,
    NUM_COLUMNAS,
    NUM_FILAS,
    SALIDAS,
    TOLERANCIA_METROS,
    X_PASILLO_POR_COLUMNA,
    Y_CABECERA_INFERIOR,
    Y_CABECERA_SUPERIOR,
)

_PATRON_CODIGO = re.compile(r"^C(\d+)-F(\d+)-N(\d+)$")


# ---------------------------------------------------------------------------
# Ubicaciones
# ---------------------------------------------------------------------------

def codigo_ubicacion(columna, fila, nivel):
    """Arma el código de ubicación, por ejemplo (3, 4, 2) -> 'C3-F04-N2'."""
    validar_celda(columna, fila)
    validar_nivel(nivel)
    return "C{}-F{:02d}-N{}".format(columna, fila, nivel)


def interpretar_codigo(codigo):
    """Convierte 'C3-F04-N2' en (3, 4, 2). Lanza ValueError si el código no es válido."""
    coincidencia = _PATRON_CODIGO.match(str(codigo).strip().upper())
    if not coincidencia:
        raise ValueError("Código de ubicación inválido: '{}'".format(codigo))
    columna, fila, nivel = (int(parte) for parte in coincidencia.groups())
    validar_celda(columna, fila)
    validar_nivel(nivel)
    return columna, fila, nivel


def validar_celda(columna, fila):
    """Lanza ValueError si la columna o la fila no existen en la bodega."""
    if not 1 <= columna <= NUM_COLUMNAS:
        raise ValueError("La columna debe estar entre 1 y {}: {}".format(NUM_COLUMNAS, columna))
    if not 1 <= fila <= NUM_FILAS:
        raise ValueError("La fila debe estar entre 1 y {}: {}".format(NUM_FILAS, fila))


def validar_nivel(nivel):
    """Lanza ValueError si el nivel no es de picking."""
    if nivel not in NIVELES_PICKING:
        raise ValueError("El nivel debe ser uno de {}: {}".format(NIVELES_PICKING, nivel))


def numero_plano(columna, fila):
    """Devuelve el número con que aparece la celda en el plano."""
    validar_celda(columna, fila)
    return LAYOUT_NUMEROS[fila - 1][columna - 1]


def celdas():
    """Lista todas las celdas (columna, fila), de arriba a abajo y de izquierda a derecha."""
    return [
        (columna, fila)
        for fila in range(1, NUM_FILAS + 1)
        for columna in range(1, NUM_COLUMNAS + 1)
    ]


def buscar_por_numero(numero):
    """Devuelve las celdas (columna, fila) que llevan ese número en el plano.

    Normalmente es una sola; para el 22 y el 35 son dos.
    """
    return [(columna, fila) for columna, fila in celdas() if numero_plano(columna, fila) == numero]


def celda_unica_por_numero(numero):
    """Devuelve la única celda con ese número; lanza ValueError si no existe o está repetido."""
    encontradas = buscar_por_numero(numero)
    if not encontradas:
        raise ValueError("El número {} no está en el plano".format(numero))
    if len(encontradas) > 1:
        raise ValueError(
            "El número {} está repetido en el plano ({}); use columna y fila".format(
                numero, ", ".join("C{}-F{:02d}".format(c, f) for c, f in encontradas)
            )
        )
    return encontradas[0]


def huecos(niveles=NIVELES_PICKING):
    """Lista todos los huecos de picking (celda × nivel) con su código y coordenadas."""
    resultado = []
    for columna, fila in celdas():
        x, y = coordenadas_celda(columna, fila)
        for nivel in niveles:
            resultado.append({
                "codigo_ubicacion": codigo_ubicacion(columna, fila, nivel),
                "columna": columna,
                "fila": fila,
                "nivel": nivel,
                "numero_plano": numero_plano(columna, fila),
                "x": x,
                "y": y,
            })
    return resultado


# ---------------------------------------------------------------------------
# Coordenadas
# ---------------------------------------------------------------------------

def coordenadas_celda(columna, fila):
    """Devuelve (x, y) del punto del pasillo frente a la celda.

    La fila 9 queda en y = 6,2 y la fila 1 en y = 25,4 con los valores por defecto.
    """
    validar_celda(columna, fila)
    x = X_PASILLO_POR_COLUMNA[columna]
    y = ALTO_ZONA_ABIERTA + (NUM_FILAS - fila) * LARGO_CELDA + LARGO_CELDA / 2
    return x, y


def coordenadas_salida(nombre):
    """Devuelve (x, y) de una salida ('IZQ' o 'DER')."""
    if nombre not in SALIDAS:
        raise ValueError("Salida desconocida '{}'. Opciones: {}".format(nombre, list(SALIDAS)))
    return SALIDAS[nombre]


# ---------------------------------------------------------------------------
# Distancias
# ---------------------------------------------------------------------------

def distancia(punto_a, punto_b):
    """Distancia caminando entre dos puntos (x, y) de la bodega.

    - Mismo pasillo: solo se recorre la diferencia de altura.
    - Si alguno está en la zona abierta: distancia Manhattan directa.
    - Pasillos distintos: se cruza por la cabecera inferior o la superior,
      la que resulte más corta.
    """
    x1, y1 = punto_a
    x2, y2 = punto_b
    if abs(x1 - x2) <= TOLERANCIA_METROS:
        return abs(y1 - y2)
    if y1 <= ALTO_ZONA_ABIERTA or y2 <= ALTO_ZONA_ABIERTA:
        return abs(x1 - x2) + abs(y1 - y2)
    return min(
        abs(y1 - y_cabecera) + abs(x1 - x2) + abs(y2 - y_cabecera)
        for y_cabecera in (Y_CABECERA_INFERIOR, Y_CABECERA_SUPERIOR)
    )


def distancia_ruta(puntos):
    """Suma las distancias de una ruta que visita los puntos en ese orden."""
    return sum(distancia(puntos[i], puntos[i + 1]) for i in range(len(puntos) - 1))


def distancia_recorrido(celdas_a_visitar, salida):
    """Distancia de un recorrido que sale por `salida`, visita las celdas en orden y vuelve.

    `celdas_a_visitar` es una lista de (columna, fila).
    """
    punto_salida = coordenadas_salida(salida)
    puntos = [punto_salida]
    puntos.extend(coordenadas_celda(columna, fila) for columna, fila in celdas_a_visitar)
    puntos.append(punto_salida)
    return distancia_ruta(puntos)
