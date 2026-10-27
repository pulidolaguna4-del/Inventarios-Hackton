"""Pruebas de los pedidos y sus estados."""

import os
import shutil
import tempfile
import unittest
from datetime import date, datetime

from app import datos, pedidos
from app.config import ESTADOS_PEDIDO


def linea(id_pedido, sku, cantidad=1, ciudad="Arauca", fecha=date(2018, 1, 2)):
    return {"id_pedido": id_pedido, "fecha": fecha, "sku": sku, "descripcion": "Ref {}".format(sku),
            "cantidad": cantidad, "cliente": "C1", "ciudad": ciudad, "valor_unitario": None}


class PruebasAgruparPedidos(unittest.TestCase):

    def test_agrupa_lineas_por_pedido(self):
        ventas = [linea(2, 100, 3), linea(1, 200, 1), linea(2, 300, 4), linea(3, 100, ciudad="Yopal")]
        listado = pedidos.agrupar_pedidos(ventas)
        self.assertEqual([p["id_pedido"] for p in listado], [1, 2])
        pedido_2 = listado[1]
        self.assertEqual(pedido_2["referencias"], 2)
        self.assertEqual(pedido_2["unidades"], 7)
        self.assertEqual(pedido_2["fecha"], "2018-01-02")

    def test_filtra_por_fecha(self):
        ventas = [linea(1, 100), linea(2, 100, fecha=date(2018, 1, 3))]
        listado = pedidos.agrupar_pedidos(ventas, fecha=date(2018, 1, 3))
        self.assertEqual([p["id_pedido"] for p in listado], [2])

    def test_datos_reales(self):
        ventas = datos.cargar_datos()["ventas"]
        self.assertEqual(len(pedidos.ids_de_pedidos(ventas)), 3245)
        todos = pedidos.agrupar_pedidos(ventas)
        self.assertEqual(len(todos), 3245)
        self.assertLessEqual(max(len(p["lineas"]) for p in todos), 13)


class PruebasEstados(unittest.TestCase):

    def test_sin_registro_esta_pendiente(self):
        self.assertEqual(pedidos.estado_de_pedido({}, 1), {"estado": "Pendiente", "historial": []})

    def test_siguiente_estado(self):
        self.assertEqual(pedidos.siguiente_estado("Pendiente"), "En alistamiento")
        self.assertEqual(pedidos.siguiente_estado("En entrega"), "Entregado")
        self.assertIsNone(pedidos.siguiente_estado("Entregado"))

    def test_flujo_completo_con_historial(self):
        estados = {}
        ahora = datetime(2026, 10, 27, 8, 0, 0)
        for estado in ESTADOS_PEDIDO[1:]:
            estados = pedidos.cambiar_estado(estados, 46882122, estado, ahora=ahora)
        guardado = estados["46882122"]
        self.assertEqual(guardado["estado"], "Entregado")
        self.assertEqual([h["estado"] for h in guardado["historial"]], list(ESTADOS_PEDIDO[1:]))
        self.assertEqual(guardado["historial"][0]["fecha_hora"], "2026-10-27T08:00:00")

    def test_no_se_puede_saltar_ni_retroceder(self):
        estados = pedidos.cambiar_estado({}, 1, "En alistamiento")
        for estado in ("Pendiente", "En alistamiento", "En entrega", "Entregado"):
            with self.assertRaises(ValueError):
                pedidos.cambiar_estado(estados, 1, estado)

    def test_entregado_no_cambia(self):
        estados = {"1": {"estado": "Entregado", "historial": []}}
        with self.assertRaises(ValueError):
            pedidos.cambiar_estado(estados, 1, "Pendiente")

    def test_estado_desconocido(self):
        with self.assertRaises(ValueError):
            pedidos.cambiar_estado({}, 1, "Perdido")

    def test_no_modifica_el_original(self):
        estados = {}
        pedidos.cambiar_estado(estados, 1, "En alistamiento")
        self.assertEqual(estados, {})

    def test_pedidos_con_estado_y_conteo(self):
        listado = pedidos.agrupar_pedidos([linea(1, 100), linea(2, 100)])
        estados = pedidos.cambiar_estado({}, 2, "En alistamiento")
        con_estado = pedidos.pedidos_con_estado(listado, estados)
        self.assertEqual([p["estado"] for p in con_estado], ["Pendiente", "En alistamiento"])
        self.assertEqual(con_estado[1]["siguiente_estado"], "Alistado")
        self.assertIsNotNone(con_estado[1]["ultimo_cambio"])
        conteo = pedidos.conteo_por_estado(con_estado)
        self.assertEqual(list(conteo), list(ESTADOS_PEDIDO))
        self.assertEqual((conteo["Pendiente"], conteo["En alistamiento"]), (1, 1))


class PruebasArchivo(unittest.TestCase):

    def test_guardar_y_cargar(self):
        carpeta = tempfile.mkdtemp()
        try:
            ruta = os.path.join(carpeta, "estados.json")
            self.assertEqual(pedidos.cargar_estados(ruta), {})
            estados = pedidos.cambiar_estado({}, 7, "En alistamiento")
            pedidos.guardar_estados(ruta, estados)
            self.assertEqual(pedidos.cargar_estados(ruta), estados)
        finally:
            shutil.rmtree(carpeta)


if __name__ == "__main__":
    unittest.main()
