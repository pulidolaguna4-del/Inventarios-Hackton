"""Constantes del sistema: rutas de archivos, formato del Excel y parámetros del servidor.

Todo valor ajustable del proyecto vive aquí para que los demás módulos no tengan
números ni textos escritos a mano.
"""

import os

# ---------------------------------------------------------------------------
# Rutas
# ---------------------------------------------------------------------------

DIR_BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR_DATOS = os.path.join(DIR_BASE, "datos")
DIR_SALIDAS = os.path.join(DIR_BASE, "salidas")
# static/ lo genera `npm run build` del frontend React; no se edita a mano.
DIR_STATIC = os.path.join(DIR_BASE, "static")
# Página sencilla de pruebas (HTML/JS puro), disponible en /pruebas/.
DIR_STATIC_PRUEBAS = os.path.join(DIR_BASE, "static_pruebas")

RUTA_EXCEL = os.path.join(DIR_DATOS, "DATA_FINAL_ENTREGAR2026.xlsx")

# ---------------------------------------------------------------------------
# Formato interno de los archivos .xlsx (estándar Office Open XML)
# ---------------------------------------------------------------------------

NS_HOJA = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
NS_RELACION_DOC = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
NS_RELACION_PAQUETE = "{http://schemas.openxmlformats.org/package/2006/relationships}"

# Excel cuenta los días desde esta fecha (incluye el falso 29/02/1900).
FECHA_BASE_EXCEL = (1899, 12, 30)

# Resultados de fórmula que en realidad son errores de Excel.
ERRORES_EXCEL = ("#REF!", "#N/A", "#VALUE!", "#DIV/0!", "#NAME?", "#NUM!", "#NULL!")

# ---------------------------------------------------------------------------
# Hojas del Excel del caso
# ---------------------------------------------------------------------------

HOJA_VENTAS = "DATA VENTAS"
FILA_ENCABEZADOS_VENTAS = 3

# Encabezado en el Excel -> nombre del campo interno.
COLUMNAS_VENTAS = {
    "No. de orden": "id_pedido",
    "Fecha": "fecha",
    "Codigo de la referencia": "sku",
    "Descripción de la referencia": "descripcion",
    "Cantidad por referencia": "cantidad",
    "Empresa": "cliente",
    "Ciudad": "ciudad",
    "Valor unitario mcia": "valor_unitario",
}

HOJA_PRODUCTOS_NUEVOS = "PRODUCTOS A INCLUIR"
FILA_ENCABEZADOS_PRODUCTOS_NUEVOS = 4

COLUMNAS_PRODUCTOS_NUEVOS = {
    "CODIGO": "sku",
    "DESCRIPCIÓN": "descripcion",
}

MESES = (
    "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
    "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
)

# La categoría sale del primer dígito del SKU.
CATEGORIAS_POR_DIGITO = {
    "1": "Aire acondicionado",
    "2": "Equipos de audio",
    "3": "Equipos de cómputo",
    "4": "Refrigeración",
}
CATEGORIA_DESCONOCIDA = "Sin categoría"

CIUDAD_BODEGA = "Arauca"

# ---------------------------------------------------------------------------
# Bodega de Arauca (medidas en metros)
# ---------------------------------------------------------------------------

NUM_COLUMNAS = 7
NUM_FILAS = 9  # fila 1 arriba, fila 9 abajo (junto a las salidas)

# Número de cada posición en el plano (Gráfica 8). Una tupla por fila, de C1 a C7.
# Ojo: el 22 y el 35 aparecen dos veces, por eso internamente se usa (columna, fila).
LAYOUT_NUMEROS = (
    (18, 17, 19, 20, 52, 51, 53),  # Fila 1
    (16, 15, 22, 21, 50, 49, 54),  # Fila 2
    (14, 13, 23, 22, 48, 47, 55),  # Fila 3
    (12, 11, 25, 24, 46, 45, 56),  # Fila 4
    (10, 9, 27, 26, 44, 43, 57),   # Fila 5
    (8, 7, 29, 28, 42, 41, 58),    # Fila 6
    (6, 5, 31, 30, 40, 39, 59),    # Fila 7
    (4, 3, 33, 32, 38, 37, 60),    # Fila 8
    (1, 2, 35, 34, 35, 36, 61),    # Fila 9
)

NIVELES_PICKING = (1, 2)

LARGO_CELDA = 2.4
ALTO_ZONA_ABIERTA = 5.0  # franja libre frente a las salidas

# Cada columna se recoge desde un pasillo; este es el x del centro de ese pasillo.
# Supuesto: C1 se recoge desde el pasillo de C2.
X_PASILLO_POR_COLUMNA = {1: 2.5, 2: 2.5, 3: 5.6, 4: 5.6, 5: 8.7, 6: 8.7, 7: 11.8}

# Pasillos transversales para cruzar de un pasillo a otro.
Y_CABECERA_INFERIOR = 2.5
Y_CABECERA_SUPERIOR = 27.6

SALIDAS = {
    "IZQ": (2.0, 0.0),
    "DER": (10.3, 0.0),
}

# Tolerancia para comparar distancias y decidir si dos x son el mismo pasillo.
TOLERANCIA_METROS = 1e-9

# ---------------------------------------------------------------------------
# Picking
# ---------------------------------------------------------------------------

CAPACIDAD_RECORRIDO = 3  # ubicaciones (celdas) que se visitan por recorrido
MISMA_SALIDA = True      # cada recorrido sale y vuelve por la misma salida
# True: usa el mínimo de recorridos posible (9 ubicaciones -> 3 recorridos de 3).
# False: permite recorridos más cortos si así se camina menos en total.
MINIMO_DE_RECORRIDOS = True

# Supuestos: el caso no da estos valores. No cambian la mejor ruta, solo el tiempo total.
VELOCIDAD_OPERARIO = 1.0         # m/s
TIEMPO_RECOGIDA_NIVEL_1 = 20.0   # s; es la "T" del caso
FACTOR_NIVEL_2 = 3               # recoger en nivel 2 tarda 3T; ambos niveles, 4T

# Hasta este número de ubicaciones se busca el óptimo exacto; por encima, heurística.
LIMITE_EXACTO = 12
# La heurística recorre la bodega por franjas de este número de filas.
FILAS_POR_ZONA = 3

# Pedido de la Tarea 6 (Gráfica 9): número del plano -> niveles a recoger.
PEDIDO_TAREA_6 = {
    4: (1, 2), 25: (1, 2), 60: (1, 2),  # naranja: ambos niveles
    7: (1,), 21: (1,), 55: (1,),        # amarillo: nivel 1
    49: (2,), 44: (2,), 41: (2,),       # rojo: nivel 2
}

# Columnas de la lista de despacho, en el orden en que se exportan.
COLUMNAS_LISTA_DESPACHO = (
    "recorrido", "orden", "codigo_ubicacion", "numero_plano", "nivel", "sku",
    "descripcion", "cantidad", "pedidos", "distancia_acum_m", "tiempo_s",
)

# ---------------------------------------------------------------------------
# Maestro de ubicaciones
# ---------------------------------------------------------------------------

# Clasificación ABC por popularidad acumulada.
UMBRAL_CLASE_A = 0.80
UMBRAL_CLASE_B = 0.95

# True: se llenan primero todos los huecos de nivel 1 (picking a nivel de suelo)
# y después los de nivel 2, cada grupo del más cercano al más lejano a la salida.
# False: se ordena solo por distancia, y en la misma celda va primero el nivel 1.
PRIORIZAR_NIVEL_1 = True

# ---------------------------------------------------------------------------
# Pedidos
# ---------------------------------------------------------------------------

# Orden obligatorio: solo se puede avanzar al estado siguiente.
ESTADOS_PEDIDO = ("Pendiente", "En alistamiento", "Alistado", "En entrega", "Entregado")

# ---------------------------------------------------------------------------
# Conteo cíclico
# ---------------------------------------------------------------------------

CONTEOS_POR_ANIO = 5
SEMANAS_ANIO = 52
SEMILLA_CONTEO = 2026  # misma semilla = mismo plan (para la sustentación)

# El caso no trae stock: si no se digita la cantidad del sistema, se usa una
# simulada y reproducible (siempre la misma para el mismo SKU) en este rango.
SEMILLA_STOCK_SIMULADO = 2026
STOCK_SIMULADO_MINIMO = 5
STOCK_SIMULADO_MAXIMO = 150

# ---------------------------------------------------------------------------
# Archivos generados
# ---------------------------------------------------------------------------

RUTA_MAESTRO = os.path.join(DIR_DATOS, "maestro.json")
# Si el equipo de logística entrega este archivo (columnas sku y codigo_ubicacion,
# y opcionalmente clase_abc), sus ubicaciones mandan sobre las generadas.
RUTA_MAESTRO_LOGISTICA = os.path.join(DIR_DATOS, "maestro_logistica.csv")
RUTA_ESTADOS_PEDIDOS = os.path.join(DIR_DATOS, "estados_pedidos.json")
RUTA_PLAN_CONTEO = os.path.join(DIR_DATOS, "plan_conteo.json")
RUTA_REGISTROS_CONTEO = os.path.join(DIR_DATOS, "registros_conteo.json")

# Excel en español (Colombia) abre bien los CSV separados por punto y coma.
SEPARADOR_CSV = ";"
CODIFICACION_CSV = "utf-8-sig"

# Los archivos de entrega se llaman Día<N>_Ejercicio<N> (ej. Día2_Ejercicio6).
# Para no permitir rutas raras, el nombre solo puede tener letras, números, _ y -.
PATRON_NOMBRE_ARCHIVO = r"^[\w\-]+$"

COLUMNAS_EXPORTAR_MAESTRO = (
    "sku", "descripcion", "categoria", "popularidad", "clase_abc", "porcentaje_acumulado",
    "codigo_ubicacion", "numero_plano", "columna", "fila", "nivel", "distancia_salida_m",
)
COLUMNAS_EXPORTAR_PLAN_CONTEO = (
    "semana", "sku", "descripcion", "categoria", "clase_abc", "codigo_ubicacion", "numero_plano", "nivel",
)
COLUMNAS_EXPORTAR_REGISTROS_CONTEO = (
    "fecha", "responsable", "semana", "sku", "codigo_ubicacion",
    "cantidad_sistema", "cantidad_contada", "diferencia",
)
COLUMNAS_EXPORTAR_PEDIDOS = (
    "id_pedido", "fecha", "cliente", "referencias", "unidades", "estado", "ultimo_cambio",
)

# ---------------------------------------------------------------------------
# Servidor
# ---------------------------------------------------------------------------

HOST_SERVIDOR = "localhost"
PUERTO_SERVIDOR = 8000

# Se definen a mano porque en Windows el registro a veces devuelve tipos errados (.js).
TIPOS_CONTENIDO = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".csv": "text/csv; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".map": "application/json; charset=utf-8",
}
TIPO_CONTENIDO_POR_DEFECTO = "application/octet-stream"
