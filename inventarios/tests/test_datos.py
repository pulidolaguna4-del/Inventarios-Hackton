"""Pruebas de carga y limpieza con el Excel real del caso, y de la persistencia JSON/CSV."""

import os
import shutil
import tempfile
import unittest
from collections import defaultdict
from datetime import date

from app import datos
from app.config import CATEGORIAS_POR_DIGITO, CODIFICACION_CSV, MESES


class PruebasDatosDelCaso(unittest.TestCase):
    """Verifica que los datos leídos coincidan con lo documentado en CLAUDE.md."""

    @classmethod
    def setUpClass(cls):
        datos_caso = datos.cargar_datos()
        cls.ventas = datos_caso["ventas"]
        cls.nuevos = datos_caso["productos_nuevos"]
        cls.resumen = datos.calcular_resumen(cls.ventas, cls.nuevos)

    def test_cantidad_de_lineas_y_ordenes(self):
        self.assertEqual(len(self.ventas), 19357)
        self.assertEqual(self.resumen["ordenes_totales"], 7974)
        self.assertEqual(self.resumen["ordenes_bodega"], 3245)

    def test_referencias(self):
        self.assertEqual(self.resumen["referencias_ventas"], 112)
        self.assertEqual(self.resumen["referencias_nuevas"], 11)
        self.assertEqual(self.resumen["referencias_totales"], 123)

    def test_referencias_nuevas_no_se_cruzan_con_ventas(self):
        skus_ventas = {linea["sku"] for linea in self.ventas}
        skus_nuevos = {producto["sku"] for producto in self.nuevos}
        self.assertEqual(skus_ventas & skus_nuevos, set())

    def test_fechas(self):
        self.assertEqual(self.resumen["fecha_inicial"], "2018-01-02")
        self.assertEqual(self.resumen["fecha_final"], "2018-12-28")
        self.assertEqual(self.resumen["dias_con_pedidos_bodega"], 247)
        self.assertEqual(len(self.resumen["fechas_disponibles"]), 247)
        self.assertTrue(all(isinstance(linea["fecha"], date) for linea in self.ventas))

    def test_tipos_y_rangos_de_las_lineas(self):
        for linea in self.ventas:
            self.assertIsInstance(linea["id_pedido"], int)
            self.assertIsInstance(linea["sku"], int)
            self.assertTrue(1 <= linea["cantidad"] <= 3600)
        self.assertEqual({linea["cliente"] for linea in self.ventas}, {"C1", "C2", "C3"})
        self.assertEqual(
            {linea["ciudad"] for linea in self.ventas},
            {"Arauca", "Yopal", "San Jose", "Villavicencio"},
        )

    def test_valor_unitario_vacio_queda_en_none(self):
        valores = [linea["valor_unitario"] for linea in self.ventas]
        self.assertIn(None, valores)
        self.assertTrue(all(valor is None or isinstance(valor, float) for valor in valores))

    def test_descripcion_uno_a_uno_con_sku(self):
        descripciones = defaultdict(set)
        for linea in self.ventas:
            descripciones[linea["sku"]].add(linea["descripcion"])
        self.assertTrue(all(len(textos) == 1 for textos in descripciones.values()))

    def test_productos_nuevos(self):
        for producto in self.nuevos:
            self.assertEqual(len(producto["demanda_mensual"]), len(MESES))
            self.assertTrue(all(isinstance(valor, int) for valor in producto["demanda_mensual"]))
            self.assertEqual(producto["demanda_anual"], sum(producto["demanda_mensual"]))
            self.assertIn(producto["categoria"], CATEGORIAS_POR_DIGITO.values())

    def test_mes_vacio_vale_cero(self):
        slot_nut = next(producto for producto in self.nuevos if producto["sku"] == 200040)
        self.assertEqual(slot_nut["demanda_mensual"][0], 0)
        self.assertEqual(slot_nut["demanda_mensual"][2], 100)


class PruebasConsultas(unittest.TestCase):

    def test_categoria_de_sku(self):
        self.assertEqual(datos.categoria_de_sku(100017), "Aire acondicionado")
        self.assertEqual(datos.categoria_de_sku(200040), "Equipos de audio")
        self.assertEqual(datos.categoria_de_sku(300023), "Equipos de cómputo")
        self.assertEqual(datos.categoria_de_sku(400016), "Refrigeración")
        self.assertEqual(datos.categoria_de_sku(900001), "Sin categoría")

    def test_lineas_de_ciudad_ignora_mayusculas(self):
        lineas = [{"ciudad": "Arauca"}, {"ciudad": "Yopal"}, {"ciudad": "ARAUCA"}]
        self.assertEqual(len(datos.lineas_de_ciudad(lineas, "arauca")), 2)

    def test_resumen_con_datos_pequenos(self):
        ventas = [
            {"id_pedido": 1, "fecha": date(2018, 1, 2), "sku": 100, "ciudad": "Arauca"},
            {"id_pedido": 1, "fecha": date(2018, 1, 2), "sku": 200, "ciudad": "Arauca"},
            {"id_pedido": 2, "fecha": date(2018, 1, 5), "sku": 100, "ciudad": "Yopal"},
        ]
        nuevos = [{"sku": 300}]
        resumen = datos.calcular_resumen(ventas, nuevos)
        self.assertEqual(resumen["referencias_totales"], 3)
        self.assertEqual(resumen["ordenes_totales"], 2)
        self.assertEqual(resumen["ordenes_bodega"], 1)
        self.assertEqual(resumen["fechas_disponibles"], ["2018-01-02"])
        self.assertEqual(resumen["fecha_final"], "2018-01-05")


class PruebasPersistencia(unittest.TestCase):

    def setUp(self):
        self.carpeta = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.carpeta)

    def test_json_ida_y_vuelta_con_fechas(self):
        ruta = os.path.join(self.carpeta, "sub", "estado.json")
        datos.guardar_json(ruta, {"fecha": date(2018, 3, 5), "nombre": "Válvula"})
        self.assertEqual(datos.leer_json(ruta), {"fecha": "2018-03-05", "nombre": "Válvula"})

    def test_json_inexistente_devuelve_por_defecto(self):
        ruta = os.path.join(self.carpeta, "no_existe.json")
        self.assertEqual(datos.leer_json(ruta, por_defecto=[]), [])

    def test_guardar_no_deja_temporales(self):
        datos.guardar_json(os.path.join(self.carpeta, "a.json"), [1, 2])
        datos.guardar_json(os.path.join(self.carpeta, "a.json"), [3])
        self.assertEqual(os.listdir(self.carpeta), ["a.json"])
        self.assertEqual(datos.leer_json(os.path.join(self.carpeta, "a.json")), [3])

    def test_csv_con_columnas_en_orden(self):
        ruta = os.path.join(self.carpeta, "Día2_Ejercicio6.csv")
        filas = [{"sku": 400016, "pedidos": [1, 2], "descripcion": "Válvula", "extra": "x"}]
        datos.guardar_csv(ruta, filas, ["sku", "descripcion", "pedidos"])
        with open(ruta, "r", encoding=CODIFICACION_CSV) as archivo:
            contenido = archivo.read().splitlines()
        self.assertEqual(contenido, ["sku;descripcion;pedidos", "400016;Válvula;1, 2"])


if __name__ == "__main__":
    unittest.main()
