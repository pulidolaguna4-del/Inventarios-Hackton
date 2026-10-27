"""Pruebas del conteo cíclico: plan anual, verificación obligatoria, registro y progreso."""

import os
import shutil
import tempfile
import unittest
from collections import Counter
from datetime import date

from app import conteo, datos


def referencias_de_prueba(cantidad):
    return [{"sku": 100000 + i, "descripcion": "Ref {}".format(i), "categoria": "X"} for i in range(cantidad)]


class PruebasTamanosSemanales(unittest.TestCase):

    def test_123_referencias(self):
        tamanos = conteo.tamanos_semanales(123 * 5, 52)
        self.assertEqual(Counter(tamanos), {12: 43, 11: 9})
        self.assertEqual(sum(tamanos), 615)

    def test_600_referencias_no_son_57_por_semana(self):
        tamanos = conteo.tamanos_semanales(600 * 5, 52)
        self.assertEqual(Counter(tamanos), {58: 36, 57: 16})

    def test_semanas_grandes_van_primero(self):
        tamanos = conteo.tamanos_semanales(615, 52)
        self.assertEqual(tamanos, sorted(tamanos, reverse=True))


class PruebasPlanConDatosReales(unittest.TestCase):
    """Verificación obligatoria con las 123 referencias del caso."""

    @classmethod
    def setUpClass(cls):
        datos_caso = datos.cargar_datos()
        referencias = datos.listar_referencias(datos_caso["ventas"], datos_caso["productos_nuevos"])
        cls.skus = [referencia["sku"] for referencia in referencias]
        cls.plan = conteo.generar_plan(cls.skus, semilla=2026)

    def test_universo_es_123(self):
        self.assertEqual(len(self.skus), 123)

    def test_todas_las_referencias_con_5_conteos(self):
        conteos = Counter(sku for semana in self.plan["plan"] for sku in semana["skus"])
        self.assertEqual(set(conteos), set(self.skus))
        self.assertTrue(all(cantidad == 5 for cantidad in conteos.values()))

    def test_ninguna_repetida_en_la_misma_semana(self):
        for semana in self.plan["plan"]:
            self.assertEqual(len(semana["skus"]), len(set(semana["skus"])))

    def test_suma_de_semanas_igual_al_total(self):
        self.assertEqual(len(self.plan["plan"]), 52)
        self.assertEqual(sum(len(s["skus"]) for s in self.plan["plan"]), 615)
        self.assertEqual([len(s["skus"]) for s in self.plan["plan"]], self.plan["tamanos"])

    def test_verificar_plan_lo_da_por_valido(self):
        verificacion = conteo.verificar_plan(self.plan, self.skus)
        self.assertTrue(verificacion["valido"], verificacion["errores"])
        self.assertEqual(verificacion["minimo_por_referencia"], 5)
        self.assertEqual(verificacion["maximo_por_referencia"], 5)


class PruebasPlan(unittest.TestCase):

    def test_misma_semilla_mismo_plan(self):
        skus = list(range(1, 124))
        plan_a = conteo.generar_plan(skus, semilla=7)
        plan_b = conteo.generar_plan(skus, semilla=7)
        self.assertEqual(plan_a["plan"], plan_b["plan"])

    def test_otra_semilla_otro_plan(self):
        skus = list(range(1, 124))
        self.assertNotEqual(
            conteo.generar_plan(skus, semilla=1)["plan"],
            conteo.generar_plan(skus, semilla=2)["plan"],
        )

    def test_cumple_con_varias_semillas_y_tamanos(self):
        for cantidad in (11, 52, 123, 600):
            for semilla in (1, 2, 3):
                skus = list(range(cantidad))
                plan = conteo.generar_plan(skus, semilla=semilla)
                verificacion = conteo.verificar_plan(plan, skus)
                self.assertTrue(verificacion["valido"], (cantidad, semilla, verificacion["errores"]))

    def test_sin_referencias_lanza_error(self):
        with self.assertRaises(ValueError):
            conteo.generar_plan([])

    def test_verificar_detecta_plan_danado(self):
        skus = list(range(1, 124))
        plan = conteo.generar_plan(skus, semilla=1)
        plan["plan"][0]["skus"].append(plan["plan"][0]["skus"][0])  # repetida en la semana
        verificacion = conteo.verificar_plan(plan, skus)
        self.assertFalse(verificacion["valido"])
        self.assertEqual(len(verificacion["errores"]), 3)  # repetida, total y conteos

    def test_semana_del_anio(self):
        self.assertEqual(conteo.semana_del_anio(date(2026, 1, 5)), 2)
        self.assertEqual(conteo.semana_del_anio(date(2026, 12, 31)), 52)  # la ISO 53 se ajusta a 52


class PruebasRegistro(unittest.TestCase):

    def setUp(self):
        self.referencias = referencias_de_prueba(20)
        self.por_sku = {r["sku"]: r for r in self.referencias}
        self.plan = conteo.generar_plan(list(self.por_sku), semilla=5)
        self.sku = self.plan["plan"][0]["skus"][0]

    def datos_validos(self, **cambios):
        registro = {"semana": 1, "sku": self.sku, "responsable": "Ana", "cantidad_contada": 10,
                    "cantidad_sistema": 12, "fecha": "2026-01-05"}
        registro.update(cambios)
        return registro

    def test_registro_valido_calcula_diferencia(self):
        registro = conteo.crear_registro(self.datos_validos(), self.plan, [], self.por_sku)
        self.assertEqual(registro["diferencia"], -2)
        self.assertEqual(registro["fecha"], "2026-01-05")
        self.assertEqual(registro["responsable"], "Ana")

    def test_sin_cantidad_sistema_usa_stock_simulado(self):
        registro = conteo.crear_registro(
            self.datos_validos(cantidad_sistema=None), self.plan, [], self.por_sku
        )
        self.assertEqual(registro["cantidad_sistema"], conteo.stock_simulado(self.sku))

    def test_stock_simulado_es_reproducible(self):
        self.assertEqual(conteo.stock_simulado(400016), conteo.stock_simulado(400016))

    def test_sin_fecha_usa_hoy(self):
        registro = conteo.crear_registro(
            self.datos_validos(fecha=None), self.plan, [], self.por_sku, hoy=date(2026, 3, 1)
        )
        self.assertEqual(registro["fecha"], "2026-03-01")

    def test_errores_de_validacion(self):
        sku_otra_semana = next(s for s in self.por_sku if s not in self.plan["plan"][0]["skus"])
        casos = [
            self.datos_validos(responsable=" "),
            self.datos_validos(cantidad_contada=-1),
            self.datos_validos(cantidad_contada="diez"),
            self.datos_validos(semana=53),
            self.datos_validos(sku=sku_otra_semana),
            self.datos_validos(fecha="05/01/2026"),
        ]
        for datos_registro in casos:
            with self.assertRaises(ValueError):
                conteo.crear_registro(datos_registro, self.plan, [], self.por_sku)

    def test_no_se_registra_dos_veces_en_la_misma_semana(self):
        primero = conteo.crear_registro(self.datos_validos(), self.plan, [], self.por_sku)
        with self.assertRaises(ValueError):
            conteo.crear_registro(self.datos_validos(), self.plan, [primero], self.por_sku)


class PruebasProgreso(unittest.TestCase):

    def setUp(self):
        self.referencias = referencias_de_prueba(20)
        self.plan = conteo.generar_plan([r["sku"] for r in self.referencias], semilla=5)
        self.sku = self.referencias[0]["sku"]
        self.semanas_sku = [s["semana"] for s in self.plan["plan"] if self.sku in s["skus"]]
        por_sku = {r["sku"]: r for r in self.referencias}
        self.registros = []
        for indice, semana in enumerate(self.semanas_sku):
            diferencia = 1 if indice == 0 else 0
            self.registros.append(conteo.crear_registro(
                {"semana": semana, "sku": self.sku, "responsable": "Ana",
                 "cantidad_sistema": 10, "cantidad_contada": 10 + diferencia},
                self.plan, self.registros, por_sku,
            ))

    def test_referencia_con_5_sale_de_la_lista(self):
        progreso = conteo.progreso_por_referencia(self.plan, self.registros, self.referencias)
        fila = next(f for f in progreso if f["sku"] == self.sku)
        self.assertEqual(fila["estado"], "contada 5/5")
        self.assertTrue(fila["sale_de_la_lista"])
        self.assertTrue(fila["tiene_diferencia"])
        self.assertEqual(fila["conteos_con_diferencia"], 1)

    def test_las_demas_siguen_en_la_lista(self):
        progreso = conteo.progreso_por_referencia(self.plan, self.registros, self.referencias)
        otras = [f for f in progreso if f["sku"] != self.sku]
        self.assertTrue(all(f["estado"] == "contada 0/5" and not f["sale_de_la_lista"] for f in otras))

    def test_no_se_pasa_de_5(self):
        with self.assertRaises(ValueError):
            conteo.crear_registro(
                {"semana": self.semanas_sku[0], "sku": self.sku, "responsable": "Ana", "cantidad_contada": 1},
                self.plan, self.registros, {r["sku"]: r for r in self.referencias},
            )

    def test_vista_de_semana(self):
        semana = conteo.referencias_de_semana(self.semanas_sku[0], self.plan, self.registros, self.referencias)
        fila = next(f for f in semana["referencias"] if f["sku"] == self.sku)
        self.assertTrue(fila["contada_esta_semana"])
        self.assertEqual(semana["pendientes"], semana["tamano"] - 1)

    def test_resumen_progreso(self):
        resumen = conteo.resumen_progreso(self.plan, self.registros, self.referencias)
        self.assertEqual(resumen["conteos_registrados"], 5)
        self.assertEqual(resumen["referencias_completas"], 1)
        self.assertTrue(resumen["verificacion_plan"]["valido"])

    def test_avance_semanal(self):
        avance = conteo.avance_semanal(self.plan, self.registros)
        self.assertEqual(len(avance), 52)
        self.assertEqual(sum(fila["planeados"] for fila in avance), self.plan["total_conteos"])
        self.assertEqual(sum(fila["registrados"] for fila in avance), 5)
        self.assertEqual(sum(fila["con_diferencia"] for fila in avance), 1)

    def test_cumplimiento(self):
        avance = [{"semana": 1, "planeados": 4, "registrados": 2}, {"semana": 2, "planeados": 4, "registrados": 4}]
        self.assertEqual(conteo.porcentaje_cumplimiento(avance, 1), 50.0)
        self.assertEqual(conteo.porcentaje_cumplimiento(avance, 2), 75.0)

    def test_filtrar_registros(self):
        filtrados = conteo.filtrar_registros(self.registros, sku=self.sku)
        self.assertEqual(len(filtrados), 5)
        self.assertEqual(filtrados[0], self.registros[-1])  # el más reciente primero
        self.assertEqual(len(conteo.filtrar_registros(self.registros, semana=self.semanas_sku[0])), 1)


class PruebasArchivos(unittest.TestCase):

    def setUp(self):
        self.carpeta = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.carpeta)

    def test_registros_vacios_si_no_hay_archivo(self):
        self.assertEqual(conteo.cargar_registros(os.path.join(self.carpeta, "r.json")), [])

    def test_respaldo(self):
        ruta = os.path.join(self.carpeta, "registros.json")
        conteo.guardar_registros(ruta, [{"sku": 1}])
        respaldo = conteo.respaldar_archivo(ruta)
        self.assertTrue(os.path.basename(respaldo).startswith("registros_respaldo_"))
        self.assertEqual(conteo.cargar_registros(respaldo), [{"sku": 1}])


if __name__ == "__main__":
    unittest.main()
