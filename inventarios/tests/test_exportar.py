"""Pruebas de las exportaciones a CSV."""

import os
import shutil
import tempfile
import unittest

from app import exportar
from app.config import CODIFICACION_CSV


class PruebasNombre(unittest.TestCase):

    def test_nombres_validos(self):
        self.assertEqual(exportar.validar_nombre_archivo("Día2_Ejercicio6"), "Día2_Ejercicio6")
        self.assertEqual(exportar.validar_nombre_archivo(" Día2_Ejercicio6.csv "), "Día2_Ejercicio6")
        self.assertEqual(exportar.validar_nombre_archivo("pedidos_2018-01-02"), "pedidos_2018-01-02")

    def test_nombres_invalidos(self):
        for nombre in ("", None, "../salir", "a/b", "con espacio", "a.b"):
            with self.assertRaises(ValueError):
                exportar.validar_nombre_archivo(nombre)


class PruebasArchivos(unittest.TestCase):

    def setUp(self):
        self.carpeta = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.carpeta)

    def test_exportar_csv(self):
        ruta = exportar.exportar_csv("Día2_Ejercicio1", [{"sku": 1, "clase_abc": "A"}], ["sku", "clase_abc"], self.carpeta)
        self.assertEqual(os.path.basename(ruta), "Día2_Ejercicio1.csv")
        with open(ruta, encoding=CODIFICACION_CSV) as archivo:
            self.assertEqual(archivo.read().splitlines(), ["sku;clase_abc", "1;A"])

    def test_filas_plan_conteo(self):
        plan = {"plan": [{"semana": 1, "skus": [10, 20]}, {"semana": 2, "skus": [30]}]}
        referencias = [{"sku": 10, "codigo_ubicacion": "C1-F09-N1"}, {"sku": 20}, {"sku": 30}]
        filas = exportar.filas_plan_conteo(plan, referencias)
        self.assertEqual([(f["semana"], f["sku"]) for f in filas], [(1, 10), (1, 20), (2, 30)])
        self.assertEqual(filas[0]["codigo_ubicacion"], "C1-F09-N1")
        self.assertEqual(len(exportar.filas_plan_conteo(plan, referencias, semana=2)), 1)


if __name__ == "__main__":
    unittest.main()
