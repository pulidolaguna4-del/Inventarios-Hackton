"""Pedidos de la bodega y su estado: Pendiente -> En alistamiento -> Alistado -> En entrega -> Entregado.

Solo se puede avanzar al estado siguiente. Cada cambio queda en el historial
del pedido con su fecha y hora. Un pedido sin cambios registrados está Pendiente.

Los estados se guardan en un JSON con esta forma:
    {"46882122": {"estado": "Alistado",
                  "historial": [{"estado": "En alistamiento", "fecha_hora": "..."}, ...]}}
"""

from collections import OrderedDict
from datetime import datetime

from app import datos
from app.config import CIUDAD_BODEGA, ESTADOS_PEDIDO

ESTADO_INICIAL = ESTADOS_PEDIDO[0]


# ---------------------------------------------------------------------------
# Pedidos
# ---------------------------------------------------------------------------

def agrupar_pedidos(ventas, ciudad=CIUDAD_BODEGA, fecha=None):
    """Junta las líneas de venta en pedidos de la ciudad, opcionalmente de una sola fecha.

    Cada pedido trae: id_pedido, fecha, cliente, ciudad, lineas (sku, descripcion,
    cantidad), referencias (cuántos SKU distintos) y unidades (suma de cantidades).
    Se devuelven ordenados por fecha y número de pedido.
    """
    pedidos = OrderedDict()
    for linea in datos.lineas_de_ciudad(ventas, ciudad):
        if fecha is not None and linea["fecha"] != fecha:
            continue
        pedido = pedidos.setdefault(linea["id_pedido"], {
            "id_pedido": linea["id_pedido"],
            "fecha": linea["fecha"].isoformat(),
            "cliente": linea["cliente"],
            "ciudad": linea["ciudad"],
            "lineas": [],
        })
        pedido["lineas"].append({
            "sku": linea["sku"],
            "descripcion": linea["descripcion"],
            "cantidad": linea["cantidad"],
        })

    for pedido in pedidos.values():
        pedido["referencias"] = len({linea["sku"] for linea in pedido["lineas"]})
        pedido["unidades"] = sum(linea["cantidad"] for linea in pedido["lineas"])
    return sorted(pedidos.values(), key=lambda pedido: (pedido["fecha"], pedido["id_pedido"]))


def ids_de_pedidos(ventas, ciudad=CIUDAD_BODEGA):
    """Conjunto de números de pedido de la ciudad."""
    return {linea["id_pedido"] for linea in datos.lineas_de_ciudad(ventas, ciudad)}


# ---------------------------------------------------------------------------
# Estados
# ---------------------------------------------------------------------------

def siguiente_estado(estado):
    """Estado que sigue a `estado`; None si ya está Entregado."""
    posicion = ESTADOS_PEDIDO.index(estado)
    if posicion + 1 < len(ESTADOS_PEDIDO):
        return ESTADOS_PEDIDO[posicion + 1]
    return None


def estado_de_pedido(estados, id_pedido):
    """Estado y historial guardados de un pedido; Pendiente sin historial si no hay nada."""
    guardado = estados.get(str(id_pedido))
    if guardado is None:
        return {"estado": ESTADO_INICIAL, "historial": []}
    return guardado


def cambiar_estado(estados, id_pedido, estado_nuevo, ahora=None):
    """Avanza un pedido a `estado_nuevo` y devuelve el diccionario de estados actualizado.

    No modifica `estados`: devuelve una copia. Lanza ValueError si el estado no
    existe o si no es exactamente el siguiente del estado actual.
    """
    if estado_nuevo not in ESTADOS_PEDIDO:
        raise ValueError("Estado desconocido '{}'. Opciones: {}".format(estado_nuevo, ", ".join(ESTADOS_PEDIDO)))

    actual = estado_de_pedido(estados, id_pedido)
    permitido = siguiente_estado(actual["estado"])
    if permitido is None:
        raise ValueError("El pedido {} ya está {} y no puede cambiar".format(id_pedido, actual["estado"]))
    if estado_nuevo != permitido:
        raise ValueError("El pedido {} está '{}'; solo puede pasar a '{}', no a '{}'".format(
            id_pedido, actual["estado"], permitido, estado_nuevo
        ))

    fecha_hora = (ahora or datetime.now()).isoformat(timespec="seconds")
    actualizados = dict(estados)
    actualizados[str(id_pedido)] = {
        "estado": estado_nuevo,
        "historial": list(actual["historial"]) + [{"estado": estado_nuevo, "fecha_hora": fecha_hora}],
    }
    return actualizados


def pedidos_con_estado(pedidos, estados):
    """Agrega a cada pedido su estado, el siguiente estado posible y su historial."""
    resultado = []
    for pedido in pedidos:
        guardado = estado_de_pedido(estados, pedido["id_pedido"])
        fila = dict(pedido)
        fila["estado"] = guardado["estado"]
        fila["siguiente_estado"] = siguiente_estado(guardado["estado"])
        fila["historial"] = guardado["historial"]
        fila["ultimo_cambio"] = guardado["historial"][-1]["fecha_hora"] if guardado["historial"] else None
        resultado.append(fila)
    return resultado


def conteo_por_estado(pedidos_listados):
    """Cuántos pedidos hay en cada estado, en el orden del flujo."""
    conteo = OrderedDict((estado, 0) for estado in ESTADOS_PEDIDO)
    for pedido in pedidos_listados:
        conteo[pedido["estado"]] += 1
    return conteo


# ---------------------------------------------------------------------------
# Archivos
# ---------------------------------------------------------------------------

def cargar_estados(ruta):
    """Lee los estados guardados; diccionario vacío si todavía no hay."""
    return datos.leer_json(ruta, por_defecto={})


def guardar_estados(ruta, estados):
    datos.guardar_json(ruta, estados)
