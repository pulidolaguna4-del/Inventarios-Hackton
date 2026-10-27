"""Pruebas del layout de Arauca: códigos, coordenadas y distancias."""

import unittest

from app import bodega
from app.config import NIVELES_PICKING, NUM_COLUMNAS, NUM_FILAS

# Posiciones del pedido de la Tarea 6 (Gráfica 9).
NUMEROS_TAREA_6 = (4, 25, 60, 7, 21, 55, 49, 44, 41)


class PruebasUbicaciones(unittest.TestCase):

    def test_cantidad_de_celdas_y_huecos(self):
        self.assertEqual(len(bodega.celdas()), NUM_COLUMNAS * NUM_FILAS)
        huecos = bodega.huecos()
        self.assertEqual(len(huecos), 126)
        self.assertEqual(len({hueco["codigo_ubicacion"] for hueco in huecos}), 126)

    def test_codigo_de_ubicacion(self):
        self.assertEqual(bodega.codigo_ubicacion(3, 4, 2), "C3-F04-N2")
        self.assertEqual(bodega.codigo_ubicacion(7, 9, 1), "C7-F09-N1")

    def test_interpretar_codigo_ida_y_vuelta(self):
        for hueco in bodega.huecos():
            self.assertEqual(
                bodega.interpretar_codigo(hueco["codigo_ubicacion"]),
                (hueco["columna"], hueco["fila"], hueco["nivel"]),
            )

    def test_codigos_invalidos(self):
        for codigo in ("C8-F01-N1", "C1-F10-N1", "C1-F01-N3", "X1-F01-N1", ""):
            with self.assertRaises(ValueError):
                bodega.interpretar_codigo(codigo)

    def test_numeros_del_plano(self):
        self.assertEqual(bodega.numero_plano(1, 1), 18)
        self.assertEqual(bodega.numero_plano(7, 9), 61)
        self.assertEqual(bodega.numero_plano(2, 6), 7)

    def test_numeros_repetidos_en_el_plano(self):
        self.assertEqual(bodega.buscar_por_numero(22), [(3, 2), (4, 3)])
        self.assertEqual(bodega.buscar_por_numero(35), [(3, 9), (5, 9)])
        with self.assertRaises(ValueError):
            bodega.celda_unica_por_numero(22)

    def test_numero_inexistente(self):
        with self.assertRaises(ValueError):
            bodega.celda_unica_por_numero(99)

    def test_posiciones_de_la_tarea_6_son_unicas(self):
        esperadas = {
            4: (1, 8), 25: (3, 4), 60: (7, 8),
            7: (2, 6), 21: (4, 2), 55: (7, 3),
            49: (6, 2), 44: (5, 5), 41: (6, 6),
        }
        for numero in NUMEROS_TAREA_6:
            self.assertEqual(bodega.celda_unica_por_numero(numero), esperadas[numero])

    def test_huecos_tienen_los_niveles_de_picking(self):
        niveles = {hueco["nivel"] for hueco in bodega.huecos()}
        self.assertEqual(niveles, set(NIVELES_PICKING))


class PruebasCoordenadas(unittest.TestCase):

    def test_y_de_las_filas(self):
        self.assertAlmostEqual(bodega.coordenadas_celda(1, 9)[1], 6.2)
        self.assertAlmostEqual(bodega.coordenadas_celda(1, 1)[1], 25.4)

    def test_x_de_los_pasillos(self):
        x_esperadas = {1: 2.5, 2: 2.5, 3: 5.6, 4: 5.6, 5: 8.7, 6: 8.7, 7: 11.8}
        for columna, x in x_esperadas.items():
            self.assertAlmostEqual(bodega.coordenadas_celda(columna, 5)[0], x)

    def test_salidas(self):
        self.assertEqual(bodega.coordenadas_salida("IZQ"), (2.0, 0.0))
        self.assertEqual(bodega.coordenadas_salida("DER"), (10.3, 0.0))
        with self.assertRaises(ValueError):
            bodega.coordenadas_salida("CENTRO")


class PruebasDistancias(unittest.TestCase):

    def test_mismo_punto(self):
        punto = bodega.coordenadas_celda(3, 4)
        self.assertEqual(bodega.distancia(punto, punto), 0)

    def test_mismo_pasillo_solo_cuenta_la_altura(self):
        # C3 y C4 comparten pasillo: de la fila 9 a la fila 1 son 8 celdas.
        a = bodega.coordenadas_celda(3, 9)
        b = bodega.coordenadas_celda(4, 1)
        self.assertAlmostEqual(bodega.distancia(a, b), 8 * 2.4)

    def test_salida_a_celda_es_manhattan(self):
        # Salida DER (10,3; 0) a C7-F09 (11,8; 6,2): 1,5 + 6,2.
        celda = bodega.coordenadas_celda(7, 9)
        self.assertAlmostEqual(bodega.distancia(bodega.coordenadas_salida("DER"), celda), 7.7)

    def test_cruce_por_cabecera_inferior(self):
        # C1-F09 (2,5; 6,2) a C7-F09 (11,8; 6,2): 3,7 + 9,3 + 3,7 por abajo.
        a = bodega.coordenadas_celda(1, 9)
        b = bodega.coordenadas_celda(7, 9)
        self.assertAlmostEqual(bodega.distancia(a, b), 3.7 + 9.3 + 3.7)

    def test_cruce_por_cabecera_superior(self):
        # C1-F01 (2,5; 25,4) a C7-F01 (11,8; 25,4): 2,2 + 9,3 + 2,2 por arriba.
        a = bodega.coordenadas_celda(1, 1)
        b = bodega.coordenadas_celda(7, 1)
        self.assertAlmostEqual(bodega.distancia(a, b), 2.2 + 9.3 + 2.2)

    def test_distancia_es_simetrica(self):
        puntos = [bodega.coordenadas_celda(c, f) for c, f in bodega.celdas()]
        puntos.extend([bodega.coordenadas_salida("IZQ"), bodega.coordenadas_salida("DER")])
        for a in puntos:
            for b in puntos:
                self.assertAlmostEqual(bodega.distancia(a, b), bodega.distancia(b, a))

    def test_distancia_recorrido_ida_y_vuelta(self):
        # Sale por DER, va a C7-F09 y vuelve por el mismo camino.
        self.assertAlmostEqual(bodega.distancia_recorrido([(7, 9)], "DER"), 2 * 7.7)

    def test_distancia_ruta_suma_tramos(self):
        a = bodega.coordenadas_salida("IZQ")
        b = bodega.coordenadas_celda(1, 9)
        c = bodega.coordenadas_celda(1, 1)
        esperado = bodega.distancia(a, b) + bodega.distancia(b, c)
        self.assertAlmostEqual(bodega.distancia_ruta([a, b, c]), esperado)


if __name__ == "__main__":
    unittest.main()
