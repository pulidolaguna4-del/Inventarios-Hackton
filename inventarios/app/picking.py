"""Picking optimizado: consolida un lote, lo reparte en recorridos de máximo 3
ubicaciones y ordena cada recorrido para caminar lo menos posible.

Conceptos:
- Parada: una celda (columna, fila) que hay que visitar. Puede tener productos
  en el nivel 1, en el nivel 2 o en ambos; cuenta como una sola ubicación.
- Recorrido: sale por una salida, visita hasta CAPACIDAD_RECORRIDO paradas y vuelve.

El tiempo de recogida de cada parada es fijo (T, 3T o 4T), así que no cambia
cuál es la mejor ruta: se minimiza la distancia y el tiempo de recogida se suma
al final.
"""

from collections import OrderedDict
from itertools import combinations, permutations

from app import bodega
from app.config import (
    CAPACIDAD_RECORRIDO,
    FACTOR_NIVEL_2,
    FILAS_POR_ZONA,
    LIMITE_EXACTO,
    MINIMO_DE_RECORRIDOS,
    MISMA_SALIDA,
    NUM_FILAS,
    PEDIDO_TAREA_6,
    SALIDAS,
    TIEMPO_RECOGIDA_NIVEL_1,
    TOLERANCIA_METROS,
    VELOCIDAD_OPERARIO,
)

FACTORES_NIVEL = {1: 1, 2: FACTOR_NIVEL_2}


# ---------------------------------------------------------------------------
# Preparar el pedido
# ---------------------------------------------------------------------------

def consolidar_lote(lineas):
    """Agrupa las líneas de pedido por SKU.

    Devuelve una lista ordenada por SKU con: sku, descripcion, cantidad (suma)
    y pedidos (lista de id_pedido de donde sale ese SKU).
    """
    por_sku = OrderedDict()
    for linea in sorted(lineas, key=lambda linea: linea["sku"]):
        consolidado = por_sku.setdefault(linea["sku"], {
            "sku": linea["sku"],
            "descripcion": linea.get("descripcion", ""),
            "cantidad": 0,
            "pedidos": [],
        })
        consolidado["cantidad"] += linea["cantidad"]
        id_pedido = linea.get("id_pedido")
        if id_pedido is not None and id_pedido not in consolidado["pedidos"]:
            consolidado["pedidos"].append(id_pedido)
    for consolidado in por_sku.values():
        consolidado["pedidos"].sort()
    return list(por_sku.values())


def ubicar_items(consolidados, ubicacion_por_sku):
    """Le pone a cada SKU consolidado su código de ubicación.

    `ubicacion_por_sku` es {sku: codigo_ubicacion}. Devuelve (items, sin_ubicacion):
    los SKU encontrados con su ubicación y la lista de SKU que no tienen ubicación.
    """
    items = []
    sin_ubicacion = []
    for consolidado in consolidados:
        codigo = ubicacion_por_sku.get(consolidado["sku"])
        if codigo is None:
            sin_ubicacion.append(consolidado["sku"])
            continue
        item = dict(consolidado)
        item["codigo_ubicacion"] = codigo
        items.append(item)
    return items, sin_ubicacion


def paradas_desde_items(items):
    """Junta los items que están en la misma celda en una sola parada.

    Cada item necesita `codigo_ubicacion`; de ahí salen columna, fila y nivel.
    """
    por_celda = OrderedDict()
    for item in items:
        columna, fila, nivel = bodega.interpretar_codigo(item["codigo_ubicacion"])
        parada = por_celda.setdefault((columna, fila), _nueva_parada(columna, fila))
        item_con_nivel = dict(item)
        item_con_nivel["nivel"] = nivel
        parada["items"].append(item_con_nivel)

    for parada in por_celda.values():
        parada["items"].sort(key=lambda item: item["nivel"])
        parada["niveles"] = sorted({item["nivel"] for item in parada["items"]})
    return list(por_celda.values())


def paradas_tarea_6(pedido=PEDIDO_TAREA_6):
    """Arma las paradas del pedido de prueba de la Tarea 6 (posiciones sin SKU)."""
    items = []
    for numero, niveles in pedido.items():
        columna, fila = bodega.celda_unica_por_numero(numero)
        for nivel in niveles:
            items.append({
                "sku": None,
                "descripcion": "",
                "cantidad": None,
                "pedidos": [],
                "codigo_ubicacion": bodega.codigo_ubicacion(columna, fila, nivel),
            })
    return paradas_desde_items(items)


def _nueva_parada(columna, fila):
    x, y = bodega.coordenadas_celda(columna, fila)
    return {
        "columna": columna,
        "fila": fila,
        "numero_plano": bodega.numero_plano(columna, fila),
        "x": x,
        "y": y,
        "niveles": [],
        "items": [],
    }


# ---------------------------------------------------------------------------
# Tiempos
# ---------------------------------------------------------------------------

def tiempo_recogida_nivel(nivel):
    """Segundos que toma recoger un producto en ese nivel (T o 3T)."""
    return TIEMPO_RECOGIDA_NIVEL_1 * FACTORES_NIVEL[nivel]


def tiempo_recogida_parada(parada):
    """Suma el tiempo de recogida de todos los items de la parada (ambos niveles = 4T)."""
    return sum(tiempo_recogida_nivel(item["nivel"]) for item in parada["items"])


def tiempo_desplazamiento(distancia_m):
    """Segundos que tarda el operario en caminar esa distancia."""
    return distancia_m / VELOCIDAD_OPERARIO


# ---------------------------------------------------------------------------
# Mejor orden dentro de un recorrido
# ---------------------------------------------------------------------------

def pares_de_salidas():
    """Combinaciones (salida de inicio, salida de llegada) permitidas."""
    if MISMA_SALIDA:
        return [(salida, salida) for salida in SALIDAS]
    return [(inicio, fin) for inicio in SALIDAS for fin in SALIDAS]


def mejor_recorrido(paradas):
    """Prueba todos los órdenes y salidas para un grupo de paradas y devuelve el más corto.

    Devuelve {"orden": [paradas en orden de visita], "salida_inicio", "salida_fin", "distancia"}.
    """
    mejor = None
    for orden in permutations(paradas):
        puntos_paradas = [(parada["x"], parada["y"]) for parada in orden]
        for salida_inicio, salida_fin in pares_de_salidas():
            puntos = [bodega.coordenadas_salida(salida_inicio)]
            puntos.extend(puntos_paradas)
            puntos.append(bodega.coordenadas_salida(salida_fin))
            distancia = bodega.distancia_ruta(puntos)
            if mejor is None or distancia < mejor["distancia"] - TOLERANCIA_METROS:
                mejor = {
                    "orden": list(orden),
                    "salida_inicio": salida_inicio,
                    "salida_fin": salida_fin,
                    "distancia": distancia,
                }
    return mejor


class _CostosDeGrupos:
    """Guarda la distancia mínima de cada grupo de paradas para no recalcularla."""

    def __init__(self, paradas):
        self.paradas = paradas
        self._memoria = {}

    def __call__(self, indices):
        clave = tuple(sorted(indices))
        if not clave:
            return 0.0
        if clave not in self._memoria:
            grupo = [self.paradas[indice] for indice in clave]
            self._memoria[clave] = mejor_recorrido(grupo)["distancia"]
        return self._memoria[clave]


# ---------------------------------------------------------------------------
# Repartir las paradas en recorridos
# ---------------------------------------------------------------------------

def minimo_de_recorridos(cantidad_paradas, capacidad=CAPACIDAD_RECORRIDO):
    """Menor número de recorridos que alcanza para visitar todas las paradas."""
    return -(-cantidad_paradas // capacidad)


def agrupar_exacto(paradas, capacidad=CAPACIDAD_RECORRIDO, solo_minimo=MINIMO_DE_RECORRIDOS):
    """Encuentra el reparto en grupos de máximo `capacidad` con la menor distancia total.

    Revisa todas las particiones posibles con programación dinámica: la primera
    parada pendiente se junta con cada combinación de compañeras y el resto se
    resuelve igual, guardando los resultados ya calculados. Con 9 paradas y
    `solo_minimo` cubre las 280 particiones en 3 grupos de 3; sin `solo_minimo`
    también prueba repartos con más recorridos, más cortos.
    Devuelve una lista de grupos, cada uno una tupla de índices de `paradas`.
    """
    costo_grupo = _CostosDeGrupos(paradas)
    total_paradas = len(paradas)
    maximo_grupos = minimo_de_recorridos(total_paradas, capacidad) if solo_minimo else total_paradas
    memoria = {}

    def resolver(pendientes, grupos_disponibles):
        """Mejor (distancia, grupos) para las paradas pendientes, o None si no caben."""
        if not pendientes:
            return 0.0, ()
        if len(pendientes) > grupos_disponibles * capacidad:
            return None
        clave = (pendientes, grupos_disponibles)
        if clave in memoria:
            return memoria[clave]
        primera, resto = pendientes[0], pendientes[1:]
        mejor = None
        # Primero los grupos grandes: ante un empate se prefieren menos recorridos.
        for tamano in range(min(capacidad - 1, len(resto)), -1, -1):
            for companeras in combinations(resto, tamano):
                grupo = (primera,) + companeras
                quedan = tuple(indice for indice in resto if indice not in companeras)
                solucion_resto = resolver(quedan, grupos_disponibles - 1)
                if solucion_resto is None:
                    continue
                total = costo_grupo(grupo) + solucion_resto[0]
                if mejor is None or total < mejor[0] - TOLERANCIA_METROS:
                    mejor = (total, (grupo,) + solucion_resto[1])
        memoria[clave] = mejor
        return mejor

    return list(resolver(tuple(range(total_paradas)), maximo_grupos)[1])


def agrupar_heuristico(paradas, capacidad=CAPACIDAD_RECORRIDO):
    """Reparte muchas paradas en grupos de forma rápida (no garantiza el óptimo).

    1. Ordena las paradas por franjas de filas, empezando por las más cercanas a
       las salidas, y en cada franja recorre los pasillos en serpentina.
    2. Corta esa secuencia en bloques de `capacidad`.
    3. Mientras la distancia total baje, intercambia o mueve paradas entre grupos.
    """
    costo_grupo = _CostosDeGrupos(paradas)
    secuencia = sorted(range(len(paradas)), key=lambda indice: _clave_serpentina(paradas[indice]))
    grupos = [secuencia[inicio:inicio + capacidad] for inicio in range(0, len(secuencia), capacidad)]
    grupos = _mejorar_con_intercambios(grupos, costo_grupo, capacidad)
    return [tuple(grupo) for grupo in grupos]


def _clave_serpentina(parada):
    """Clave de orden: franja (desde abajo), pasillo alternando sentido, altura."""
    zona = (NUM_FILAS - parada["fila"]) // FILAS_POR_ZONA
    sentido = 1 if zona % 2 == 0 else -1
    return zona, sentido * parada["x"], parada["y"]


def _mejorar_con_intercambios(grupos, costo_grupo, capacidad):
    """Aplica intercambios y movimientos entre pares de grupos mientras mejoren."""
    grupos = [list(grupo) for grupo in grupos]
    hubo_mejora = True
    while hubo_mejora:
        hubo_mejora = False
        for a in range(len(grupos)):
            for b in range(a + 1, len(grupos)):
                if _mejorar_par(grupos, a, b, costo_grupo, capacidad):
                    hubo_mejora = True
        grupos = [grupo for grupo in grupos if grupo]
    return grupos


def _mejorar_par(grupos, a, b, costo_grupo, capacidad):
    """Busca un cambio entre los grupos a y b que baje la distancia; si lo hay, lo aplica."""
    grupo_a, grupo_b = grupos[a], grupos[b]
    costo_actual = costo_grupo(grupo_a) + costo_grupo(grupo_b)

    candidatos = []
    for i in grupo_a:
        for j in grupo_b:
            candidatos.append(([x for x in grupo_a if x != i] + [j], [x for x in grupo_b if x != j] + [i]))
    if len(grupo_b) < capacidad:
        for i in grupo_a:
            candidatos.append(([x for x in grupo_a if x != i], grupo_b + [i]))
    if len(grupo_a) < capacidad:
        for j in grupo_b:
            candidatos.append((grupo_a + [j], [x for x in grupo_b if x != j]))

    for nuevo_a, nuevo_b in candidatos:
        if costo_grupo(nuevo_a) + costo_grupo(nuevo_b) < costo_actual - TOLERANCIA_METROS:
            grupos[a], grupos[b] = nuevo_a, nuevo_b
            return True
    return False


# ---------------------------------------------------------------------------
# Lista de despacho
# ---------------------------------------------------------------------------

def generar_lista_despacho(paradas):
    """Calcula los recorridos y arma la lista de despacho con sus totales.

    Devuelve {"metodo", "recorridos", "lista", "totales"}:
    - recorridos: un resumen por recorrido (salida, paradas, distancia y tiempos).
    - lista: una fila por producto a recoger, en el orden en que se recoge.
    - totales: distancia y tiempos de todo el lote.
    """
    if len(paradas) <= LIMITE_EXACTO:
        metodo = "exacto"
        grupos = agrupar_exacto(paradas)
    else:
        metodo = "heuristico"
        grupos = agrupar_heuristico(paradas)

    rutas = [mejor_recorrido([paradas[indice] for indice in grupo]) for grupo in grupos]
    rutas.sort(key=lambda ruta: (ruta["salida_inicio"], min(p["numero_plano"] for p in ruta["orden"])))

    recorridos = []
    lista = []
    distancia_acumulada = 0.0
    for numero_recorrido, ruta in enumerate(rutas, start=1):
        punto_anterior = bodega.coordenadas_salida(ruta["salida_inicio"])
        for orden, parada in enumerate(ruta["orden"], start=1):
            punto_parada = (parada["x"], parada["y"])
            distancia_acumulada += bodega.distancia(punto_anterior, punto_parada)
            punto_anterior = punto_parada
            for item in parada["items"]:
                lista.append(_fila_despacho(numero_recorrido, orden, parada, item, distancia_acumulada))
        distancia_acumulada += bodega.distancia(
            punto_anterior, bodega.coordenadas_salida(ruta["salida_fin"])
        )
        recorridos.append(_resumen_recorrido(numero_recorrido, ruta))

    _marcar_mas_demorado(recorridos)
    return {
        "metodo": metodo,
        "recorridos": recorridos,
        "lista": lista,
        "totales": _totales(recorridos, len(paradas)),
    }


def _fila_despacho(numero_recorrido, orden, parada, item, distancia_acumulada):
    return {
        "recorrido": numero_recorrido,
        "orden": orden,
        "codigo_ubicacion": item["codigo_ubicacion"],
        "numero_plano": parada["numero_plano"],
        "nivel": item["nivel"],
        "sku": item["sku"],
        "descripcion": item["descripcion"],
        "cantidad": item["cantidad"],
        "pedidos": item["pedidos"],
        "distancia_acum_m": round(distancia_acumulada, 2),
        "tiempo_s": round(tiempo_recogida_nivel(item["nivel"]), 2),
    }


def _resumen_recorrido(numero_recorrido, ruta):
    tiempo_camino = tiempo_desplazamiento(ruta["distancia"])
    tiempo_recogida = sum(tiempo_recogida_parada(parada) for parada in ruta["orden"])
    return {
        "recorrido": numero_recorrido,
        "salida_inicio": ruta["salida_inicio"],
        "salida_fin": ruta["salida_fin"],
        "paradas": [
            {"numero_plano": p["numero_plano"], "columna": p["columna"], "fila": p["fila"], "niveles": p["niveles"]}
            for p in ruta["orden"]
        ],
        "distancia_m": round(ruta["distancia"], 2),
        "tiempo_desplazamiento_s": round(tiempo_camino, 2),
        "tiempo_recogida_s": round(tiempo_recogida, 2),
        "tiempo_total_s": round(tiempo_camino + tiempo_recogida, 2),
    }


def _marcar_mas_demorado(recorridos):
    """Dato informativo: marca el recorrido que más tiempo toma (el primero, si hay empate)."""
    if not recorridos:
        return
    mas_demorado = max(recorridos, key=lambda recorrido: recorrido["tiempo_total_s"])
    for recorrido in recorridos:
        recorrido["es_el_mas_demorado"] = recorrido is mas_demorado


def _totales(recorridos, cantidad_paradas):
    distancia = sum(recorrido["distancia_m"] for recorrido in recorridos)
    tiempo_camino = sum(recorrido["tiempo_desplazamiento_s"] for recorrido in recorridos)
    tiempo_recogida = sum(recorrido["tiempo_recogida_s"] for recorrido in recorridos)
    mas_demorado = next((r for r in recorridos if r.get("es_el_mas_demorado")), None)
    return {
        "recorrido_mas_demorado": mas_demorado["recorrido"] if mas_demorado else None,
        "tiempo_mas_demorado_s": mas_demorado["tiempo_total_s"] if mas_demorado else None,
        "recorridos": len(recorridos),
        "ubicaciones": cantidad_paradas,
        "distancia_m": round(distancia, 2),
        "tiempo_desplazamiento_s": round(tiempo_camino, 2),
        "tiempo_recogida_s": round(tiempo_recogida, 2),
        "tiempo_total_s": round(tiempo_camino + tiempo_recogida, 2),
        "velocidad_m_s": VELOCIDAD_OPERARIO,
        "tiempo_recogida_nivel_1_s": TIEMPO_RECOGIDA_NIVEL_1,
    }


def picking_tarea_6():
    """Lista de despacho del pedido de prueba de la Tarea 6."""
    return generar_lista_despacho(paradas_tarea_6())
