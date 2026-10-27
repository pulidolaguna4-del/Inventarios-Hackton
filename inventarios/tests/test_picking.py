"""Pruebas del picking (base pospuesta) y del dato informativo del trayecto más demorado."""

import unittest

from app import picking


class PruebasTarea6(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.resultado = picking.picking_tarea_6()

    def test_resultado_de_referencia(self):
        totales = self.resultado["totales"]
        self.assertEqual(totales["recorridos"], 3)
        self.assertAlmostEqual(totales["distancia_m"], 174.4)
        grupos = {
            frozenset(parada["numero_plano"] for parada in recorrido["paradas"])
            for recorrido in self.resultado["recorridos"]
        }
        self.assertEqual(grupos, {frozenset({4, 7, 60}), frozenset({25, 21, 55}), frozenset({49, 44, 41})})

    def test_hay_un_solo_trayecto_mas_demorado(self):
        recorridos = self.resultado["recorridos"]
        marcados = [r for r in recorridos if r["es_el_mas_demorado"]]
        self.assertEqual(len(marcados), 1)
        self.assertEqual(marcados[0]["tiempo_total_s"], max(r["tiempo_total_s"] for r in recorridos))
        self.assertEqual(self.resultado["totales"]["recorrido_mas_demorado"], marcados[0]["recorrido"])

    def test_tiempo_de_recogida_por_nivel(self):
        # 3 en ambos niveles (4T) + 3 en nivel 1 (T) + 3 en nivel 2 (3T) = 24T.
        t = picking.tiempo_recogida_nivel(1)
        self.assertAlmostEqual(self.resultado["totales"]["tiempo_recogida_s"], 24 * t)


class PruebasConsolidacion(unittest.TestCase):

    def test_consolidar_lote_suma_por_sku(self):
        lineas = [
            {"id_pedido": 2, "sku": 400016, "descripcion": "A", "cantidad": 5},
            {"id_pedido": 1, "sku": 400016, "descripcion": "A", "cantidad": 3},
            {"id_pedido": 1, "sku": 100017, "descripcion": "B", "cantidad": 1},
        ]
        consolidado = picking.consolidar_lote(lineas)
        self.assertEqual([c["sku"] for c in consolidado], [100017, 400016])
        self.assertEqual(consolidado[1]["cantidad"], 8)
        self.assertEqual(consolidado[1]["pedidos"], [1, 2])

    def test_misma_celda_en_dos_niveles_es_una_parada(self):
        items = [
            {"sku": 1, "codigo_ubicacion": "C1-F08-N2"},
            {"sku": 2, "codigo_ubicacion": "C1-F08-N1"},
        ]
        paradas = picking.paradas_desde_items(items)
        self.assertEqual(len(paradas), 1)
        self.assertEqual(paradas[0]["niveles"], [1, 2])


if __name__ == "__main__":
    unittest.main()
