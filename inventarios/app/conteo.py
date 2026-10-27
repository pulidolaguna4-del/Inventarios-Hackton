"""Conteo cíclico: plan anual aleatorio, verificación, registro de conteos y progreso.

Regla del caso: cada referencia se cuenta exactamente CONTEOS_POR_ANIO veces al año,
eligiendo al azar cada semana. Cuando una referencia llega a ese número, sale de la lista.

Cómo se arma el plan:
1. Total de conteos = referencias × CONTEOS_POR_ANIO. Se reparte en SEMANAS_ANIO
   semanas: las primeras `extra` semanas llevan uno más (divmod).
2. Cada semana se eligen al azar referencias entre las que llevan MENOS conteos:
   primero todas las que llevan 0, luego las que llevan 1, y así. Sigue siendo
   aleatorio y garantiza que al final todas queden con exactamente 5.

Uso por consola (solo muestra el plan, no lo guarda):
    python -m app.conteo
"""

import random
import shutil
from collections import Counter
from datetime import date, datetime

from app import datos
from app.config import (
    CONTEOS_POR_ANIO,
    SEMANAS_ANIO,
    SEMILLA_CONTEO,
    SEMILLA_STOCK_SIMULADO,
    STOCK_SIMULADO_MAXIMO,
    STOCK_SIMULADO_MINIMO,
)


# ---------------------------------------------------------------------------
# Plan anual
# ---------------------------------------------------------------------------

def tamanos_semanales(total_conteos, semanas=SEMANAS_ANIO):
    """Reparte el total de conteos en las semanas.

    Ejemplo: 615 conteos en 52 semanas -> 43 semanas de 12 y 9 de 11.
    """
    base, extra = divmod(total_conteos, semanas)
    return [base + 1 if semana < extra else base for semana in range(semanas)]


def generar_plan(skus, semilla=SEMILLA_CONTEO, conteos_por_anio=CONTEOS_POR_ANIO,
                 semanas=SEMANAS_ANIO):
    """Genera el plan anual de conteo para la lista de SKU.

    Con la misma semilla y los mismos SKU siempre sale el mismo plan.
    Devuelve un diccionario listo para guardar en JSON.
    """
    skus = sorted(set(skus))
    if not skus:
        raise ValueError("No hay referencias para armar el plan de conteo")

    generador = random.Random(semilla)
    conteos = {sku: 0 for sku in skus}
    tamanos = tamanos_semanales(len(skus) * conteos_por_anio, semanas)
    if max(tamanos) > len(skus):
        raise ValueError(
            "Cada semana tendría {} conteos pero solo hay {} referencias".format(max(tamanos), len(skus))
        )

    plan_semanas = []
    for numero_semana, tamano in enumerate(tamanos, start=1):
        elegidas = _elegir_referencias_semana(conteos, tamano, conteos_por_anio, generador)
        for sku in elegidas:
            conteos[sku] += 1
        plan_semanas.append({"semana": numero_semana, "skus": sorted(elegidas)})

    return {
        "semilla": semilla,
        "conteos_por_anio": conteos_por_anio,
        "semanas": semanas,
        "total_referencias": len(skus),
        "total_conteos": sum(tamanos),
        "tamanos": tamanos,
        "generado": datetime.now().isoformat(timespec="seconds"),
        "plan": plan_semanas,
    }


def _elegir_referencias_semana(conteos, tamano, maximo, generador):
    """Elige `tamano` referencias al azar, empezando por las que llevan menos conteos."""
    elegidas = []
    faltan = tamano
    niveles = sorted({cantidad for cantidad in conteos.values() if cantidad < maximo})
    for nivel in niveles:
        candidatas = sorted(sku for sku, cantidad in conteos.items() if cantidad == nivel)
        if len(candidatas) <= faltan:
            elegidas.extend(candidatas)
            faltan -= len(candidatas)
        else:
            elegidas.extend(generador.sample(candidatas, faltan))
            faltan = 0
        if faltan == 0:
            break
    if faltan > 0:
        raise ValueError("No quedan suficientes referencias por contar para completar la semana")
    return elegidas


def verificar_plan(plan, skus):
    """Revisa que el plan cumpla las reglas.

    - Todas las referencias se cuentan exactamente `conteos_por_anio` veces.
    - Ninguna referencia se repite dentro de la misma semana.
    - La suma de los tamaños semanales es igual al total de conteos.
    Devuelve {"valido": bool, "errores": [...], y cifras de apoyo}.
    """
    errores = []
    conteos = Counter()
    for semana in plan["plan"]:
        if len(set(semana["skus"])) != len(semana["skus"]):
            errores.append("La semana {} repite referencias".format(semana["semana"]))
        conteos.update(semana["skus"])

    skus = set(skus)
    esperado = len(skus) * plan["conteos_por_anio"]
    suma_semanas = sum(len(semana["skus"]) for semana in plan["plan"])
    if suma_semanas != esperado:
        errores.append("El plan tiene {} conteos y deberían ser {}".format(suma_semanas, esperado))

    desconocidas = sorted(set(conteos) - skus)
    if desconocidas:
        errores.append("Referencias que no están en el maestro: {}".format(desconocidas))

    incompletas = sorted(sku for sku in skus if conteos[sku] != plan["conteos_por_anio"])
    if incompletas:
        errores.append("Referencias sin exactamente {} conteos: {}".format(
            plan["conteos_por_anio"], incompletas
        ))

    cantidades = [conteos[sku] for sku in skus] or [0]
    return {
        "valido": not errores,
        "errores": errores,
        "referencias": len(skus),
        "semanas": len(plan["plan"]),
        "total_conteos": suma_semanas,
        "conteos_esperados": esperado,
        "minimo_por_referencia": min(cantidades),
        "maximo_por_referencia": max(cantidades),
    }


def semana_del_anio(fecha=None):
    """Número de semana (1 a SEMANAS_ANIO) de una fecha; por defecto, hoy."""
    fecha = fecha or date.today()
    return min(fecha.isocalendar()[1], SEMANAS_ANIO)


# ---------------------------------------------------------------------------
# Registro de conteos
# ---------------------------------------------------------------------------

def stock_simulado(sku):
    """Cantidad en sistema simulada para un SKU: siempre la misma para el mismo SKU."""
    generador = random.Random(SEMILLA_STOCK_SIMULADO * 1000003 + int(sku))
    return generador.randint(STOCK_SIMULADO_MINIMO, STOCK_SIMULADO_MAXIMO)


def crear_registro(datos_registro, plan, registros, referencias_por_sku, hoy=None):
    """Valida un conteo nuevo y devuelve el registro listo para guardar.

    `datos_registro` trae: semana, sku, responsable, cantidad_contada y,
    opcionalmente, cantidad_sistema (si falta se usa el stock simulado) y fecha.
    Lanza ValueError con un mensaje claro si algo no cumple.
    """
    semana = _entero_obligatorio(datos_registro, "semana")
    sku = _entero_obligatorio(datos_registro, "sku")
    cantidad_contada = _entero_obligatorio(datos_registro, "cantidad_contada", minimo=0)
    responsable = str(datos_registro.get("responsable") or "").strip()
    if not responsable:
        raise ValueError("Falta el responsable del conteo")

    skus_semana = _skus_de_semana(plan, semana)
    if sku not in skus_semana:
        raise ValueError("La referencia {} no está programada en la semana {}".format(sku, semana))
    if any(r["semana"] == semana and r["sku"] == sku for r in registros):
        raise ValueError("La referencia {} ya se registró en la semana {}".format(sku, semana))
    conteos_hechos = sum(1 for r in registros if r["sku"] == sku)
    if conteos_hechos >= plan["conteos_por_anio"]:
        raise ValueError("La referencia {} ya completó sus {} conteos".format(sku, plan["conteos_por_anio"]))

    if datos_registro.get("cantidad_sistema") in (None, ""):
        cantidad_sistema = stock_simulado(sku)
    else:
        cantidad_sistema = _entero_obligatorio(datos_registro, "cantidad_sistema", minimo=0)

    referencia = referencias_por_sku.get(sku, {})
    return {
        "fecha": _fecha_registro(datos_registro.get("fecha"), hoy),
        "responsable": responsable,
        "semana": semana,
        "sku": sku,
        "codigo_ubicacion": referencia.get("codigo_ubicacion"),
        "cantidad_sistema": cantidad_sistema,
        "cantidad_contada": cantidad_contada,
        "diferencia": cantidad_contada - cantidad_sistema,
    }


def _skus_de_semana(plan, semana):
    """Devuelve los SKU programados en la semana; lanza ValueError si no existe."""
    if not 1 <= semana <= len(plan["plan"]):
        raise ValueError("La semana debe estar entre 1 y {}: {}".format(len(plan["plan"]), semana))
    return plan["plan"][semana - 1]["skus"]


def _entero_obligatorio(datos_registro, campo, minimo=None):
    """Lee un campo entero obligatorio; lanza ValueError si falta, no es entero o es menor al mínimo."""
    valor = datos_registro.get(campo)
    if valor is None or valor == "" or isinstance(valor, bool):
        raise ValueError("Falta el campo '{}'".format(campo))
    try:
        numero = int(str(valor).strip())
    except ValueError:
        raise ValueError("El campo '{}' debe ser un número entero: {!r}".format(campo, valor))
    if minimo is not None and numero < minimo:
        raise ValueError("El campo '{}' no puede ser menor que {}".format(campo, minimo))
    return numero


def _fecha_registro(texto_fecha, hoy):
    """Valida una fecha aaaa-mm-dd; si no viene, usa la de hoy."""
    if not texto_fecha:
        return (hoy or date.today()).isoformat()
    try:
        return datetime.strptime(str(texto_fecha).strip(), "%Y-%m-%d").date().isoformat()
    except ValueError:
        raise ValueError("La fecha debe tener el formato aaaa-mm-dd: {!r}".format(texto_fecha))


# ---------------------------------------------------------------------------
# Progreso
# ---------------------------------------------------------------------------

def progreso_por_referencia(plan, registros, referencias):
    """Estado de cada referencia: 'contada X/5', si ya sale de la lista y si tuvo diferencias.

    `referencias` es la lista del maestro (sku, descripcion, categoria, ...).
    """
    semanas_por_sku = {}
    for semana in plan["plan"]:
        for sku in semana["skus"]:
            semanas_por_sku.setdefault(sku, []).append(semana["semana"])

    registros_por_sku = {}
    for registro in registros:
        registros_por_sku.setdefault(registro["sku"], []).append(registro)

    maximo = plan["conteos_por_anio"]
    progreso = []
    for referencia in referencias:
        sku = referencia["sku"]
        registros_sku = registros_por_sku.get(sku, [])
        contados = len(registros_sku)
        con_diferencia = [r for r in registros_sku if r["diferencia"] != 0]
        progreso.append({
            "sku": sku,
            "descripcion": referencia.get("descripcion", ""),
            "categoria": referencia.get("categoria", ""),
            "codigo_ubicacion": referencia.get("codigo_ubicacion"),
            "semanas_programadas": semanas_por_sku.get(sku, []),
            "contados": contados,
            "estado": "contada {}/{}".format(contados, maximo),
            "sale_de_la_lista": contados >= maximo,
            "conteos_con_diferencia": len(con_diferencia),
            "tiene_diferencia": bool(con_diferencia),
        })
    return progreso


def referencias_de_semana(numero_semana, plan, registros, referencias):
    """Lista de la semana: qué toca contar, qué ya se contó y el progreso X/5 de cada una."""
    skus_semana = _skus_de_semana(plan, numero_semana)
    progreso = {fila["sku"]: fila for fila in progreso_por_referencia(plan, registros, referencias)}
    registros_semana = {r["sku"]: r for r in registros if r["semana"] == numero_semana}

    filas = []
    for sku in skus_semana:
        fila = dict(progreso.get(sku, {"sku": sku, "contados": 0, "sale_de_la_lista": False}))
        fila["contada_esta_semana"] = sku in registros_semana
        fila["registro_semana"] = registros_semana.get(sku)
        fila["cantidad_sistema_sugerida"] = stock_simulado(sku)
        filas.append(fila)

    return {
        "semana": numero_semana,
        "tamano": len(skus_semana),
        "pendientes": sum(1 for fila in filas if not fila["contada_esta_semana"]),
        "referencias": filas,
    }


def avance_semanal(plan, registros):
    """Por cada semana: cuántos conteos estaban planeados, cuántos se registraron y cuántos tuvieron diferencia."""
    registrados = Counter(registro["semana"] for registro in registros)
    con_diferencia = Counter(registro["semana"] for registro in registros if registro["diferencia"] != 0)
    return [
        {
            "semana": semana["semana"],
            "planeados": len(semana["skus"]),
            "registrados": registrados.get(semana["semana"], 0),
            "con_diferencia": con_diferencia.get(semana["semana"], 0),
        }
        for semana in plan["plan"]
    ]


def porcentaje_cumplimiento(avance, hasta_semana):
    """Conteos registrados sobre los planeados desde la semana 1 hasta `hasta_semana` (en %)."""
    semanas = [fila for fila in avance if fila["semana"] <= hasta_semana]
    planeados = sum(fila["planeados"] for fila in semanas)
    registrados = sum(min(fila["registrados"], fila["planeados"]) for fila in semanas)
    return round(100 * registrados / planeados, 1) if planeados else 0.0


def resumen_progreso(plan, registros, referencias, semana_actual=None):
    """Totales del avance anual, avance por semana y la verificación del plan."""
    semana_actual = semana_actual or semana_del_anio()
    progreso = progreso_por_referencia(plan, registros, referencias)
    avance = avance_semanal(plan, registros)
    return {
        "semana_actual": semana_actual,
        "conteos_registrados": len(registros),
        "conteos_planeados": plan["total_conteos"],
        "cumplimiento_a_la_fecha": porcentaje_cumplimiento(avance, semana_actual),
        "semilla": plan["semilla"],
        "referencias_completas": sum(1 for fila in progreso if fila["sale_de_la_lista"]),
        "referencias_con_diferencia": sum(1 for fila in progreso if fila["tiene_diferencia"]),
        "verificacion_plan": verificar_plan(plan, [r["sku"] for r in referencias]),
        "avance_semanal": avance,
        "progreso": progreso,
    }


def filtrar_registros(registros, sku=None, semana=None):
    """Registros de conteo, opcionalmente de un SKU o de una semana, del más reciente al más antiguo."""
    filtrados = [
        registro for registro in registros
        if (sku is None or registro["sku"] == sku) and (semana is None or registro["semana"] == semana)
    ]
    return list(reversed(filtrados))


# ---------------------------------------------------------------------------
# Archivos
# ---------------------------------------------------------------------------

def cargar_plan(ruta):
    """Lee el plan guardado; None si todavía no existe."""
    return datos.leer_json(ruta)


def guardar_plan(ruta, plan):
    datos.guardar_json(ruta, plan)


def cargar_registros(ruta):
    """Lee los registros de conteo; lista vacía si todavía no hay."""
    return datos.leer_json(ruta, por_defecto=[])


def guardar_registros(ruta, registros):
    datos.guardar_json(ruta, registros)


def respaldar_archivo(ruta):
    """Copia el archivo a <nombre>_respaldo_<fecha_hora>.json y devuelve la ruta de la copia."""
    base, extension = ruta.rsplit(".", 1)
    ruta_respaldo = "{}_respaldo_{}.{}".format(base, datetime.now().strftime("%Y%m%d_%H%M%S"), extension)
    shutil.copy2(ruta, ruta_respaldo)
    return ruta_respaldo


# ---------------------------------------------------------------------------
# Consola
# ---------------------------------------------------------------------------

def _mostrar_plan_por_consola():
    datos_caso = datos.cargar_datos()
    referencias = datos.listar_referencias(datos_caso["ventas"], datos_caso["productos_nuevos"])
    skus = [referencia["sku"] for referencia in referencias]
    plan = generar_plan(skus)
    verificacion = verificar_plan(plan, skus)

    conteo_tamanos = Counter(plan["tamanos"])
    print("Referencias: {}  |  Conteos al año: {}  |  Semilla: {}".format(
        len(skus), plan["total_conteos"], plan["semilla"]
    ))
    print("Semanas: " + ", ".join(
        "{} de {}".format(cantidad, tamano) for tamano, cantidad in sorted(conteo_tamanos.items(), reverse=True)
    ))
    for semana in plan["plan"][:5]:
        print("  Semana {:2d}: {}".format(semana["semana"], semana["skus"]))
    print("  ...")
    print("Verificación: {}".format("OK" if verificacion["valido"] else verificacion["errores"]))


if __name__ == "__main__":
    _mostrar_plan_por_consola()
