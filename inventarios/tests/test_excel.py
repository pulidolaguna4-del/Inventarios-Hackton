"""Pruebas del lector de .xlsx con un archivo armado a mano (sin depender del Excel del caso)."""

import os
import shutil
import tempfile
import unittest
import zipfile
from datetime import date

from app import excel

_WORKBOOK = """<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Otra" sheetId="1" r:id="rId1"/>
    <sheet name="Datos" sheetId="2" r:id="rId2"/>
  </sheets>
</workbook>"""

# La hoja "Datos" apunta a sheet7.xml para probar que se resuelve por nombre y no por orden.
_RELACIONES = """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="worksheet" Target="worksheets/sheet7.xml"/>
</Relationships>"""

_TEXTOS_COMPARTIDOS = """<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <si><t>Codigo</t></si>
  <si><t>Fecha</t></si>
  <si><r><t>Descrip</t></r><r><t>ción</t></r></si>
  <si><t>Válvula</t></si>
</sst>"""

_HOJA_OTRA = """<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData><row r="1"><c r="A1"><v>999</v></c></row></sheetData>
</worksheet>"""

_HOJA_DATOS = """<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1"><c r="A1" t="inlineStr"><is><t>Título</t></is></c></row>
    <row r="3">
      <c r="A3" t="s"><v>0</v></c>
      <c r="B3" t="s"><v>1</v></c>
      <c r="C3" t="s"><v>2</v></c>
      <c r="D3" t="inlineStr"><is><t>Error</t></is></c>
      <c r="E3" t="inlineStr"><is><t>Formula</t></is></c>
    </row>
    <row r="4">
      <c r="A4"><v>400016.0</v></c>
      <c r="B4"><v>43102.0</v></c>
      <c r="C4" t="s"><v>3</v></c>
      <c r="D4" t="e"><v>#REF!</v></c>
      <c r="E4" t="str"><f>VLOOKUP(A4,#REF!,5,0)</f><v>#REF!</v></c>
    </row>
    <row r="5">
      <c r="A5"><v>12.5</v></c>
      <c r="E5" t="str"><v>texto</v></c>
    </row>
    <row r="6"><c r="A6" s="4"/></row>
  </sheetData>
</worksheet>"""


def crear_xlsx_de_prueba(ruta):
    """Arma un .xlsx mínimo con dos hojas y los casos que el lector debe manejar."""
    with zipfile.ZipFile(ruta, "w") as libro:
        libro.writestr("xl/workbook.xml", _WORKBOOK)
        libro.writestr("xl/_rels/workbook.xml.rels", _RELACIONES)
        libro.writestr("xl/sharedStrings.xml", _TEXTOS_COMPARTIDOS)
        libro.writestr("xl/worksheets/sheet1.xml", _HOJA_OTRA)
        libro.writestr("xl/worksheets/sheet7.xml", _HOJA_DATOS)


class PruebasLectorExcel(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.carpeta = tempfile.mkdtemp()
        cls.ruta = os.path.join(cls.carpeta, "prueba.xlsx")
        crear_xlsx_de_prueba(cls.ruta)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.carpeta)

    def test_busca_la_hoja_por_nombre(self):
        self.assertEqual(excel.leer_filas(self.ruta, "Otra"), {1: {"A": 999}})
        self.assertEqual(excel.leer_filas(self.ruta, "Datos")[1], {"A": "Título"})

    def test_hoja_inexistente_lanza_error(self):
        with self.assertRaises(ValueError):
            excel.leer_filas(self.ruta, "No existe")

    def test_codigo_guardado_como_float_pasa_a_entero(self):
        fila = excel.leer_filas(self.ruta, "Datos")[4]
        self.assertEqual(fila["A"], 400016)
        self.assertIsInstance(fila["A"], int)

    def test_numero_con_decimales_se_conserva(self):
        self.assertEqual(excel.leer_filas(self.ruta, "Datos")[5]["A"], 12.5)

    def test_textos_compartidos_simples_y_con_formato(self):
        filas = excel.leer_filas(self.ruta, "Datos")
        self.assertEqual(filas[3]["C"], "Descripción")
        self.assertEqual(filas[4]["C"], "Válvula")

    def test_errores_de_excel_se_vuelven_none(self):
        fila = excel.leer_filas(self.ruta, "Datos")[4]
        self.assertNotIn("D", fila)  # t="e"
        self.assertNotIn("E", fila)  # fórmula de texto que dio #REF!

    def test_formula_de_texto_valida_se_conserva(self):
        self.assertEqual(excel.leer_filas(self.ruta, "Datos")[5]["E"], "texto")

    def test_filas_vacias_no_aparecen(self):
        filas = excel.leer_filas(self.ruta, "Datos")
        self.assertNotIn(2, filas)
        self.assertNotIn(6, filas)

    def test_leer_tabla_usa_la_fila_de_encabezados(self):
        tabla = excel.leer_tabla(self.ruta, "Datos", 3)
        self.assertEqual(len(tabla), 2)
        self.assertEqual(tabla[0]["Codigo"], 400016)
        self.assertEqual(tabla[0]["Fecha"], 43102)
        self.assertEqual(tabla[0]["Descripción"], "Válvula")
        self.assertIsNone(tabla[0]["Error"])
        self.assertIsNone(tabla[1]["Fecha"])

    def test_leer_tabla_sin_encabezados_lanza_error(self):
        with self.assertRaises(ValueError):
            excel.leer_tabla(self.ruta, "Datos", 2)


class PruebasFechasExcel(unittest.TestCase):

    def test_serial_de_excel_a_fecha(self):
        self.assertEqual(excel.convertir_fecha_excel(43102), date(2018, 1, 2))
        self.assertEqual(excel.convertir_fecha_excel(43462.0), date(2018, 12, 28))


if __name__ == "__main__":
    unittest.main()
