"""Pruebas de la API levantando el servidor real en un puerto libre.

Los archivos de conteo se redirigen a una carpeta temporal para no tocar datos/.
"""

import json
import os
import shutil
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from unittest import mock
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

import servidor


class PruebasApi(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.carpeta = tempfile.mkdtemp()
        cls.carpeta_static = tempfile.mkdtemp()
        cls.parches = [
            mock.patch.object(servidor, "DIR_STATIC", cls.carpeta_static),
            mock.patch.object(servidor, "DIR_SALIDAS", cls.carpeta),
            mock.patch.object(servidor, "RUTA_MAESTRO", os.path.join(cls.carpeta, "maestro.json")),
            mock.patch.object(servidor, "RUTA_ESTADOS_PEDIDOS", os.path.join(cls.carpeta, "estados.json")),
            mock.patch.object(servidor, "RUTA_PLAN_CONTEO", os.path.join(cls.carpeta, "plan.json")),
            mock.patch.object(servidor, "RUTA_REGISTROS_CONTEO", os.path.join(cls.carpeta, "registros.json")),
        ]
        for parche in cls.parches:
            parche.start()
        # 127.0.0.1 y no localhost: en Windows localhost prueba IPv6 primero y tarda ~2 s.
        cls.servidor = ThreadingHTTPServer(("127.0.0.1", 0), servidor.ManejadorInventarios)
        cls.url_base = "http://127.0.0.1:{}".format(cls.servidor.server_address[1])
        cls.hilo = threading.Thread(target=cls.servidor.serve_forever, daemon=True)
        cls.hilo.start()

    @classmethod
    def tearDownClass(cls):
        cls.servidor.shutdown()
        cls.servidor.server_close()
        for parche in cls.parches:
            parche.stop()
        shutil.rmtree(cls.carpeta)
        shutil.rmtree(cls.carpeta_static)

    def pedir(self, ruta, metodo="GET", cuerpo=None):
        """Hace la petición y devuelve (código, json)."""
        datos_cuerpo = None if cuerpo is None else cuerpo.encode("utf-8")
        peticion = Request(self.url_base + ruta, data=datos_cuerpo, method=metodo)
        try:
            with urlopen(peticion) as respuesta:
                return respuesta.status, json.loads(respuesta.read().decode("utf-8"))
        except HTTPError as error:
            with error:
                return error.code, json.loads(error.read().decode("utf-8"))

    def test_resumen(self):
        codigo, resumen = self.pedir("/api/resumen")
        self.assertEqual(codigo, 200)
        self.assertEqual(resumen["referencias_totales"], 123)
        self.assertEqual(resumen["ordenes_bodega"], 3245)
        self.assertEqual(len(resumen["fechas_disponibles"]), 247)

    def test_ruta_inexistente_da_404(self):
        codigo, respuesta = self.pedir("/api/no-existe")
        self.assertEqual(codigo, 404)
        self.assertIn("error", respuesta)

    def test_metodo_no_permitido_da_405(self):
        codigo, respuesta = self.pedir("/api/resumen", metodo="POST", cuerpo="{}")
        self.assertEqual(codigo, 405)
        self.assertIn("error", respuesta)

    def test_no_sirve_archivos_fuera_de_static(self):
        codigo, _ = self.pedir("/../servidor.py")
        self.assertEqual(codigo, 404)

    def test_flujo_de_conteo(self):
        """Genera plan, consulta la semana 1, registra un conteo y revisa el progreso."""
        codigo, respuesta = self.pedir("/api/conteo/plan/generar", "POST", json.dumps({"semilla": 2026}))
        self.assertEqual(codigo, 200)
        self.assertTrue(respuesta["verificacion"]["valido"])

        codigo, semana = self.pedir("/api/conteo/semana/1")
        self.assertEqual(codigo, 200)
        self.assertEqual(semana["tamano"], 12)
        sku = semana["referencias"][0]["sku"]

        registro = {"semana": 1, "sku": sku, "responsable": "Prueba", "cantidad_contada": 3}
        codigo, respuesta = self.pedir("/api/conteo/registro", "POST", json.dumps(registro))
        self.assertEqual(codigo, 200)
        self.assertEqual(respuesta["registro"]["sku"], sku)

        codigo, respuesta = self.pedir("/api/conteo/registro", "POST", json.dumps(registro))
        self.assertEqual(codigo, 400)  # repetido en la misma semana

        codigo, progreso = self.pedir("/api/conteo/progreso")
        self.assertEqual(codigo, 200)
        self.assertEqual(progreso["conteos_registrados"], 1)
        fila = next(f for f in progreso["progreso"] if f["sku"] == sku)
        self.assertEqual(fila["estado"], "contada 1/5")

        # Con conteos registrados no se regenera el plan sin "forzar".
        codigo, _ = self.pedir("/api/conteo/plan/generar", "POST", json.dumps({"semilla": 1}))
        self.assertEqual(codigo, 409)
        codigo, respuesta = self.pedir("/api/conteo/plan/generar", "POST",
                                       json.dumps({"semilla": 1, "forzar": True}))
        self.assertEqual(codigo, 200)
        self.assertIsNotNone(respuesta["respaldo_registros"])

    def test_maestro(self):
        codigo, respuesta = self.pedir("/api/maestro/generar", "POST", "{}")
        self.assertEqual(codigo, 200)
        codigo, respuesta = self.pedir("/api/maestro")
        self.assertEqual(codigo, 200)
        self.assertEqual(len(respuesta["referencias"]), 123)
        self.assertTrue(all(r["codigo_ubicacion"] for r in respuesta["referencias"]))

    def test_flujo_de_pedidos(self):
        codigo, respuesta = self.pedir("/api/pedidos?fecha=2018-01-02")
        self.assertEqual(codigo, 200)
        self.assertGreater(len(respuesta["pedidos"]), 0)
        self.assertEqual(respuesta["conteo_por_estado"]["Pendiente"], len(respuesta["pedidos"]))
        id_pedido = respuesta["pedidos"][0]["id_pedido"]
        ruta = "/api/pedidos/{}/estado".format(id_pedido)

        codigo, _ = self.pedir(ruta, "POST", json.dumps({"estado": "Entregado"}))
        self.assertEqual(codigo, 400)  # no se puede saltar
        codigo, respuesta = self.pedir(ruta, "POST", json.dumps({"estado": "En alistamiento"}))
        self.assertEqual(codigo, 200)
        self.assertEqual(respuesta["siguiente_estado"], "Alistado")

        codigo, respuesta = self.pedir("/api/pedidos?fecha=2018-01-02&estado=En%20alistamiento")
        self.assertEqual([p["id_pedido"] for p in respuesta["pedidos"]], [id_pedido])

    def test_pedido_inexistente_da_404(self):
        codigo, _ = self.pedir("/api/pedidos/1/estado", "POST", json.dumps({"estado": "En alistamiento"}))
        self.assertEqual(codigo, 404)

    def test_fecha_invalida_da_400(self):
        codigo, _ = self.pedir("/api/pedidos?fecha=02-01-2018")
        self.assertEqual(codigo, 400)

    def test_picking_informativo(self):
        codigo, respuesta = self.pedir("/api/picking/prueba")
        self.assertEqual(codigo, 200)
        self.assertIsNotNone(respuesta["totales"]["recorrido_mas_demorado"])

    def test_exportar_descarga_y_guarda_en_salidas(self):
        casos = (
            ("maestro", "Día2_Ejercicio1", "sku;"),
            ("conteo", "Día2_Ejercicio8", "semana;sku;"),
            ("picking", "Día2_Ejercicio6", "recorrido;orden;"),
            ("registros_conteo", "registros", "fecha;responsable;"),
            ("pedidos", "pedidos", "id_pedido;fecha;"),
        )
        for tipo, nombre, inicio_encabezado in casos:
            url = "{}/api/exportar/{}?nombre={}".format(self.url_base, tipo, quote(nombre))
            with urlopen(url) as respuesta:
                self.assertEqual(respuesta.status, 200)
                self.assertIn("attachment", respuesta.headers["Content-Disposition"])
                contenido = respuesta.read().decode("utf-8-sig")
            self.assertTrue(contenido.startswith(inicio_encabezado), tipo)
            self.assertTrue(os.path.exists(os.path.join(self.carpeta, nombre + ".csv")))

    def test_exportar_errores(self):
        codigo, _ = self.pedir("/api/exportar/maestro?nombre=..%2Fsalir")
        self.assertEqual(codigo, 400)
        codigo, _ = self.pedir("/api/exportar/inventado?nombre=x")
        self.assertEqual(codigo, 404)

    def test_pagina_de_pruebas(self):
        for ruta in ("/pruebas/", "/pruebas/app.js", "/pruebas/estilos.css"):
            with urlopen(self.url_base + ruta) as respuesta:
                self.assertEqual(respuesta.status, 200)

    def test_frontend_react_y_rutas_de_la_pagina(self):
        """Las rutas sin extensión devuelven index.html para que React las maneje."""
        with open(os.path.join(self.carpeta_static, "index.html"), "w", encoding="utf-8") as archivo:
            archivo.write("<div id=root></div>")
        for ruta in ("/", "/pedidos", "/conteos/registro"):
            with urlopen(self.url_base + ruta) as respuesta:
                self.assertEqual(respuesta.read().decode("utf-8"), "<div id=root></div>")
        codigo, _ = self.pedir("/no-existe.js")
        self.assertEqual(codigo, 404)

    def test_registros_de_conteo(self):
        codigo, respuesta = self.pedir("/api/conteo/registros?sku=1")
        self.assertEqual(codigo, 200)
        self.assertEqual(respuesta["registros"], [])

    def test_progreso_trae_avance_semanal(self):
        codigo, progreso = self.pedir("/api/conteo/progreso")
        self.assertEqual(codigo, 200)
        self.assertEqual(len(progreso["avance_semanal"]), 52)
        self.assertIn("cumplimiento_a_la_fecha", progreso)

    def test_semana_inexistente_da_400(self):
        codigo, respuesta = self.pedir("/api/conteo/semana/99")
        self.assertEqual(codigo, 400)
        self.assertIn("error", respuesta)


if __name__ == "__main__":
    unittest.main()
