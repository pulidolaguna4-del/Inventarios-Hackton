"""Pruebas del maestro: popularidad, ABC, asignación de ubicaciones y CSV de logística."""

import os
import shutil
import tempfile
import unittest
from datetime import date

from app import bodega, datos, maestro


def linea(sku, ciudad="Arauca", cantidad=1, id_pedido=1):
    return {"id_pedido": id_pedido, "fecha": date(2018, 1, 2), "sku": sku, "descripcion": "Ref {}".format(sku),
            "cantidad": cantidad, "cliente": "C1", "ciudad": ciudad, "valor_unitario": None}


class PruebasPopularidad(unittest.TestCase):

    def test_cuenta_lineas_solo_de_arauca(self):
        ventas = [linea(100001), linea(100001), linea(200001), linea(200001, ciudad="Yopal")]
        referencias = maestro.calcular_popularidad(ventas, [])
        popularidad = {r["sku"]: r["popularidad"] for r in referencias}
        self.assertEqual(popularidad, {100001: 2, 200001: 1})
        self.assertEqual([r["sku"] for r in referencias], [100001, 200001])

    def test_nuevas_se_convierten_a_lineas_equivalentes(self):
        # 2 líneas con 10 unidades en total -> 0,2 líneas por unidad.
        ventas = [linea(100001, cantidad=4), linea(100001, cantidad=6)]
        nuevos = [{"sku": 300001, "descripcion": "Nueva", "categoria": "Equipos de cómputo",
                   "demanda_mensual": [0] * 12, "demanda_anual": 50}]
        referencias = maestro.calcular_popularidad(ventas, nuevos)
        nueva = next(r for r in referencias if r["sku"] == 300001)
        self.assertAlmostEqual(nueva["popularidad"], 10.0)
        self.assertEqual(nueva["origen_popularidad"], "proyeccion")


class PruebasAbc(unittest.TestCase):

    def test_umbrales(self):
        referencias = [{"sku": i, "popularidad": p} for i, p in enumerate([50, 30, 10, 5, 3, 2])]
        maestro.clasificar_abc(referencias)
        # Acumulado previo: 0, 50, 80, 90, 95, 98 (%).
        self.assertEqual([r["clase_abc"] for r in referencias], ["A", "A", "B", "B", "C", "C"])
        self.assertEqual(referencias[-1]["porcentaje_acumulado"], 100.0)


class PruebasAsignacion(unittest.TestCase):

    def test_huecos_nivel_1_primero_y_por_cercania(self):
        huecos = maestro.ordenar_huecos(priorizar_nivel_1=True)
        self.assertEqual(len(huecos), 126)
        niveles = [h["nivel"] for h in huecos]
        self.assertEqual(niveles, sorted(niveles))
        nivel_1 = [h["distancia_salida_m"] for h in huecos if h["nivel"] == 1]
        self.assertEqual(nivel_1, sorted(nivel_1))

    def test_huecos_solo_por_distancia(self):
        huecos = maestro.ordenar_huecos(priorizar_nivel_1=False)
        distancias = [h["distancia_salida_m"] for h in huecos]
        self.assertEqual(distancias, sorted(distancias))
        self.assertEqual((huecos[0]["nivel"], huecos[1]["nivel"]), (1, 2))

    def test_mas_popular_en_el_hueco_mas_cercano(self):
        referencias = [{"sku": 1, "popularidad": 9}, {"sku": 2, "popularidad": 5}]
        asignado = maestro.asignar_ubicaciones(referencias)
        primero = maestro.ordenar_huecos()[0]
        self.assertEqual(asignado[0]["codigo_ubicacion"], primero["codigo_ubicacion"])

    def test_ubicaciones_fijas_se_respetan(self):
        referencias = [{"sku": 1, "popularidad": 9}, {"sku": 2, "popularidad": 5}]
        primero = maestro.ordenar_huecos()[0]["codigo_ubicacion"]
        asignado = maestro.asignar_ubicaciones(referencias, {2: primero})
        self.assertEqual(asignado[1]["codigo_ubicacion"], primero)
        self.assertEqual(asignado[1]["fuente_ubicacion"], "logistica")
        self.assertNotEqual(asignado[0]["codigo_ubicacion"], primero)

    def test_ubicacion_fija_repetida_da_error(self):
        referencias = [{"sku": 1, "popularidad": 9}, {"sku": 2, "popularidad": 5}]
        with self.assertRaises(ValueError):
            maestro.asignar_ubicaciones(referencias, {1: "C1-F09-N1", 2: "C1-F09-N1"})

    def test_mas_referencias_que_huecos_da_error(self):
        referencias = [{"sku": i, "popularidad": 1} for i in range(127)]
        with self.assertRaises(ValueError):
            maestro.asignar_ubicaciones(referencias)


class PruebasMaestroReal(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        datos_caso = datos.cargar_datos()
        cls.maestro = maestro.generar_maestro(datos_caso["ventas"], datos_caso["productos_nuevos"], ruta_logistica=None)
        cls.referencias = cls.maestro["referencias"]

    def test_123_referencias_con_ubicacion_unica(self):
        self.assertEqual(len(self.referencias), 123)
        codigos = [r["codigo_ubicacion"] for r in self.referencias]
        self.assertEqual(len(set(codigos)), 123)
        for codigo in codigos:
            bodega.interpretar_codigo(codigo)

    def test_campos_del_maestro(self):
        campos = {"sku", "descripcion", "categoria", "popularidad", "clase_abc", "codigo_ubicacion",
                  "columna", "fila", "nivel", "numero_plano"}
        for referencia in self.referencias:
            self.assertTrue(campos <= set(referencia))

    def test_clases_abc(self):
        self.assertEqual(sum(self.maestro["conteo_por_clase"].values()), 123)
        clases = [r["clase_abc"] for r in self.referencias]
        self.assertEqual(clases, sorted(clases))  # ordenadas por popularidad: A, luego B, luego C

    def test_las_mas_populares_van_en_nivel_1(self):
        nivel_1 = sum(1 for h in bodega.huecos() if h["nivel"] == 1)
        self.assertTrue(all(r["nivel"] == 1 for r in self.referencias[:nivel_1]))


class PruebasMaestroLogistica(unittest.TestCase):

    def setUp(self):
        self.carpeta = tempfile.mkdtemp()
        self.ruta = os.path.join(self.carpeta, "maestro_logistica.csv")

    def tearDown(self):
        shutil.rmtree(self.carpeta)

    def escribir(self, texto):
        with open(self.ruta, "w", encoding="utf-8") as archivo:
            archivo.write(texto)

    def test_sin_archivo_no_hay_ubicaciones_fijas(self):
        self.assertEqual(maestro.leer_maestro_logistica(self.ruta), {})

    def test_lee_punto_y_coma(self):
        self.escribir("SKU;Codigo_Ubicacion;Clase_ABC\n400016;c3-f04-n2;a\n100017;;\n")
        leido = maestro.leer_maestro_logistica(self.ruta)
        self.assertEqual(leido[400016], {"codigo_ubicacion": "C3-F04-N2", "clase_abc": "A"})
        self.assertEqual(leido[100017], {"codigo_ubicacion": None, "clase_abc": None})

    def test_lee_coma(self):
        self.escribir("sku,codigo_ubicacion\n400016,C3-F04-N2\n")
        self.assertEqual(maestro.leer_maestro_logistica(self.ruta)[400016]["codigo_ubicacion"], "C3-F04-N2")

    def test_errores(self):
        for texto in ("sku;ubicacion\n1;C1-F01-N1\n", "sku;codigo_ubicacion\n1;Z9\n", "sku;codigo_ubicacion\nabc;C1-F01-N1\n"):
            self.escribir(texto)
            with self.assertRaises(ValueError):
                maestro.leer_maestro_logistica(self.ruta)

    def test_logistica_manda_en_el_maestro(self):
        self.escribir("sku;codigo_ubicacion;clase_abc\n400016;C7-F01-N2;C\n")
        datos_caso = datos.cargar_datos()
        generado = maestro.generar_maestro(datos_caso["ventas"], datos_caso["productos_nuevos"], self.ruta)
        fila = next(r for r in generado["referencias"] if r["sku"] == 400016)
        self.assertEqual(fila["codigo_ubicacion"], "C7-F01-N2")
        self.assertEqual(fila["clase_abc"], "C")
        self.assertEqual(generado["fuente"], "logistica + generado")


if __name__ == "__main__":
    unittest.main()
