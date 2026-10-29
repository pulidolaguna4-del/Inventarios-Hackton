// Constantes del sistema: rutas de archivos, formato del Excel, bodega, picking y conteo.
// Todo valor ajustable del proyecto vive aquí para que los demás módulos no tengan
// números ni textos escritos a mano.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------

export const DIR_BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DIR_DATOS = path.join(DIR_BASE, 'datos');
export const DIR_SALIDAS = path.join(DIR_BASE, 'salidas');
// public/ lo genera `npm run build` del frontend React; no se edita a mano.
export const DIR_PUBLICO = path.join(DIR_BASE, 'public');

export const RUTA_EXCEL = path.join(DIR_DATOS, 'DATA_FINAL_ENTREGAR2026.xlsx');
export const RUTA_MAESTRO = path.join(DIR_DATOS, 'maestro.json');
// Si el equipo de logística entrega este archivo (columnas sku y codigo_ubicacion,
// y opcionalmente clase_abc), sus ubicaciones mandan sobre las generadas.
export const RUTA_MAESTRO_LOGISTICA = path.join(DIR_DATOS, 'maestro_logistica.csv');
// Entregable de logística (Tarea 1): ubicación en la maqueta (U01–U15) y su clase ABC,
// solo para las 11 referencias nuevas. Se muestran como alias: no reemplazan los códigos
// ni la clase ABC que calcula el sistema.
export const RUTA_LOGISTICA_TAREA1 = path.join(DIR_DATOS, 'logistica_tarea1.json');
export const RUTA_ESTADOS_PEDIDOS = path.join(DIR_DATOS, 'estados_pedidos.json');
// Cada sorteo de conteo: número, fecha y hora, semilla y la lista de SKU elegidos al azar.
export const RUTA_SORTEOS = path.join(DIR_DATOS, 'sorteos_conteo.json');
export const RUTA_REGISTROS_CONTEO = path.join(DIR_DATOS, 'registros_conteo.json');

// ---------------------------------------------------------------------------
// Hojas del Excel del caso
// ---------------------------------------------------------------------------

export const HOJA_VENTAS = 'DATA VENTAS';
export const FILA_ENCABEZADOS_VENTAS = 3;

// Encabezado en el Excel -> nombre del campo interno.
export const COLUMNAS_VENTAS = {
  'No. de orden': 'id_pedido',
  Fecha: 'fecha',
  'Codigo de la referencia': 'sku',
  'Descripción de la referencia': 'descripcion',
  'Cantidad por referencia': 'cantidad',
  Empresa: 'cliente',
  Ciudad: 'ciudad',
  'Valor unitario mcia': 'valor_unitario',
};

export const HOJA_PRODUCTOS_NUEVOS = 'PRODUCTOS A INCLUIR';
export const FILA_ENCABEZADOS_PRODUCTOS_NUEVOS = 4;

export const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];

// La categoría sale del primer dígito del SKU.
export const CATEGORIAS_POR_DIGITO = {
  1: 'Aire acondicionado',
  2: 'Equipos de audio',
  3: 'Equipos de cómputo',
  4: 'Refrigeración',
};
export const CATEGORIA_DESCONOCIDA = 'Sin categoría';

export const CIUDAD_BODEGA = 'Arauca';

// Excel cuenta los días desde el 30/12/1899 (incluye el falso 29/02/1900).
export const FECHA_BASE_EXCEL_MS = Date.UTC(1899, 11, 30);

// ---------------------------------------------------------------------------
// Bodega de Arauca (medidas en metros)
// ---------------------------------------------------------------------------

export const NUM_COLUMNAS = 7;
export const NUM_FILAS = 9; // fila 1 arriba, fila 9 abajo (junto a las salidas)

// Número de cada posición en el plano (Gráfica 8). Un arreglo por fila, de C1 a C7.
// Ojo: el 22 y el 35 aparecen dos veces, por eso internamente se usa (columna, fila).
export const LAYOUT_NUMEROS = [
  [18, 17, 19, 20, 52, 51, 53], // Fila 1
  [16, 15, 22, 21, 50, 49, 54], // Fila 2
  [14, 13, 23, 22, 48, 47, 55], // Fila 3
  [12, 11, 25, 24, 46, 45, 56], // Fila 4
  [10, 9, 27, 26, 44, 43, 57], // Fila 5
  [8, 7, 29, 28, 42, 41, 58], // Fila 6
  [6, 5, 31, 30, 40, 39, 59], // Fila 7
  [4, 3, 33, 32, 38, 37, 60], // Fila 8
  [1, 2, 35, 34, 35, 36, 61], // Fila 9
];

export const NIVELES_PICKING = [1, 2];

export const LARGO_CELDA = 2.4;
export const ALTO_ZONA_ABIERTA = 5.0; // franja libre frente a las salidas

// Cada columna se recoge desde un pasillo; este es el x del centro de ese pasillo.
// Supuesto: C1 se recoge desde el pasillo de C2.
export const X_PASILLO_POR_COLUMNA = { 1: 2.5, 2: 2.5, 3: 5.6, 4: 5.6, 5: 8.7, 6: 8.7, 7: 11.8 };

// Pasillos transversales para cruzar de un pasillo a otro.
export const Y_CABECERA_INFERIOR = 2.5;
export const Y_CABECERA_SUPERIOR = 27.6;

export const SALIDAS = {
  IZQ: [2.0, 0.0],
  DER: [10.3, 0.0],
};

// Tolerancia para comparar distancias y decidir si dos x son el mismo pasillo.
export const TOLERANCIA_METROS = 1e-9;

// Medidas para dibujar la bodega (mapa 3D). Racks de 1 m de fondo, pasillos de 1 m.
export const FONDO_RACK = 1.0;
export const ANCHO_PASILLO = 1.0;
// Franja libre entre la última fila (fila 1) y la pared del fondo; la cabecera superior va en su centro.
export const ESPACIO_SUPERIOR = 2.0;
// Lado del pasillo en que queda el rack de cada columna, mirando desde las salidas.
// Con los ejes de X_PASILLO_POR_COLUMNA las impares quedan a la izquierda y las pares a la derecha.
export const LADO_RACK_POR_COLUMNA = { 1: 'izquierda', 2: 'derecha', 3: 'izquierda', 4: 'derecha', 5: 'izquierda', 6: 'derecha', 7: 'izquierda' };
// Supuesto (el caso no lo da): altura de cada nivel de almacenamiento.
export const ALTO_NIVEL = 1.5;
// Cada estantería se dibuja con 3 travesaños (piso, viga intermedia y viga superior),
// pero solo tiene 2 niveles de almacenamiento (NIVELES_PICKING).
export const NUM_TRAVESANOS = 3;

// ---------------------------------------------------------------------------
// Maqueta del robot Arduino (bodega en U del entregable de logística, Tarea 1)
// ---------------------------------------------------------------------------

// Medidas en metros "reales"; la maqueta física es la misma figura a escala 1:ESCALA_MAQUETA.
// La U es un pasillo: brazo izquierdo (entrada), fondo y brazo derecho (salida). El frente
// une la salida con la entrada y cierra el anillo. Supuestos ajustables.
export const LARGO_BRAZO_U = 6.0;
export const ANCHO_FONDO_U = 6.0;
export const SEPARACION_POSICIONES_U = 1.5;
// Distancia desde el inicio de cada lado del anillo hasta su primera posición.
export const MARGEN_POSICIONES_U = 0.75;
export const ANCHO_PASILLO_U = 1.0;
export const FONDO_ESTANTE_U = 0.8;
export const ALTO_NIVEL_U = 1.0;
// Pisos de almacenamiento de la maqueta (si la maqueta física termina teniendo dos, cambiar a 2).
export const NIVELES_MAQUETA = 1;
// Escala de la maqueta 1:N (1 m real = 100/N cm). Con 20: 1 m = 5 cm.
export const ESCALA_MAQUETA = 20;

// Las 15 posiciones de la U, en el orden del anillo, agrupadas por el lado en que quedan.
// La identidad de una posición es su lugar en el anillo; el código U.. es solo una etiqueta
// (en la hoja de logística U08 aparece dos veces). `lado`: I = izquierda, D = derecha
// según el sentido de avance del operario.
export const LADOS_ANILLO_U = [
  { lado_anillo: 'izquierdo', posiciones: [
    { codigo: 'U01', zona: 'Entrada/frente', lado: 'I' },
    { codigo: 'U02', zona: 'Entrada/frente', lado: 'D' },
    { codigo: 'U03', zona: 'Lado izquierdo', lado: 'I' },
    { codigo: 'U04', zona: 'Lado izquierdo', lado: 'D' },
  ] },
  { lado_anillo: 'fondo', posiciones: [
    { codigo: 'U05', zona: 'Fondo', lado: 'I' },
    { codigo: 'U06', zona: 'Fondo', lado: 'D' },
    { codigo: 'U07', zona: 'Fondo', lado: 'I' },
    { codigo: 'U08', zona: 'Fondo', lado: 'D' },
  ] },
  { lado_anillo: 'derecho', posiciones: [
    { codigo: 'U09', zona: 'Lado derecho', lado: 'I' },
    { codigo: 'U10', zona: 'Lado derecho', lado: 'D' },
    { codigo: 'U11', zona: 'Salida/frente', lado: 'I' },
  ] },
  { lado_anillo: 'frente', posiciones: [
    { codigo: 'U12', zona: 'Libre', lado: 'D' },
    { codigo: 'U13', zona: 'Libre', lado: 'I' },
    { codigo: 'U14', zona: 'Libre', lado: 'D' },
    { codigo: 'U15', zona: 'Libre', lado: 'I' },
  ] },
];

// El robot arranca en la salida (Arauca) o en la entrada (maqueta) mirando hacia el fondo (+y).
export const DIRECCION_INICIAL_ROBOT = [0, 1];

// ---------------------------------------------------------------------------
// Picking
// ---------------------------------------------------------------------------

export const CAPACIDAD_RECORRIDO = 3; // ubicaciones (celdas) que se visitan por recorrido
export const MISMA_SALIDA = true; // cada recorrido sale y vuelve por la misma salida
// true: usa el mínimo de recorridos posible (9 ubicaciones -> 3 recorridos de 3).
// false: permite recorridos más cortos si así se camina menos en total.
export const MINIMO_DE_RECORRIDOS = true;

// Supuestos: el caso no da estos valores. No cambian la mejor ruta, solo el tiempo total.
export const VELOCIDAD_OPERARIO = 1.0; // m/s
export const TIEMPO_RECOGIDA_NIVEL_1 = 20.0; // s; es la "T" del caso
export const FACTOR_NIVEL_2 = 3; // recoger en nivel 2 tarda 3T; ambos niveles, 4T

// Hasta este número de ubicaciones se busca el óptimo exacto; por encima, heurística.
export const LIMITE_EXACTO = 12;
// De dónde salen las ubicaciones a visitar en la bodega de Arauca:
// prueba = Tarea 6, sorteo = ruta de conteo de un sorteo, lote = pedidos de un día.
// Supuesto: el caso no define un tiempo de conteo; en la ruta de conteo cada parada
// usa la misma regla de recogida (nivel 1 = T, nivel 2 = 3T, ambos = 4T).
export const ORIGENES_PICKING = ['prueba', 'sorteo', 'lote'];
// La heurística recorre la bodega por franjas de este número de filas.
export const FILAS_POR_ZONA = 3;

// Pedido de la Tarea 6 (Gráfica 9): [número del plano, niveles a recoger].
// Es una lista (y no un objeto) para conservar el orden del caso.
export const PEDIDO_TAREA_6 = [
  [4, [1, 2]], [25, [1, 2]], [60, [1, 2]], // naranja: ambos niveles
  [7, [1]], [21, [1]], [55, [1]], // amarillo: nivel 1
  [49, [2]], [44, [2]], [41, [2]], // rojo: nivel 2
];

// ---------------------------------------------------------------------------
// Maestro de ubicaciones
// ---------------------------------------------------------------------------

// Clasificación ABC por popularidad acumulada.
export const UMBRAL_CLASE_A = 0.8;
export const UMBRAL_CLASE_B = 0.95;
export const CLASES_ABC = ['A', 'B', 'C'];

// true: se llenan primero todos los huecos de nivel 1 (picking a nivel de suelo)
// y después los de nivel 2, cada grupo del más cercano al más lejano a la salida.
// false: se ordena solo por distancia, y en la misma celda va primero el nivel 1.
export const PRIORIZAR_NIVEL_1 = true;

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

// Orden obligatorio: solo se puede avanzar al estado siguiente.
export const ESTADOS_PEDIDO = ['Pendiente', 'En alistamiento', 'Alistado', 'En entrega', 'Entregado'];

// ---------------------------------------------------------------------------
// Conteo cíclico
// ---------------------------------------------------------------------------

export const CONTEOS_POR_ANIO = 5; // máximo de veces que se cuenta cada referencia en el año
export const SEMANAS_ANIO = 52;
// Cantidad de referencias que propone el botón "Sortear" (se puede cambiar en pantalla).
// 123 referencias × 5 conteos = 615 al año; repartidos en 52 semanas dan ≈ 12 por semana.
export const CANTIDAD_SORTEO_POR_DEFECTO = 12;

// Periodos de conteo del plan de logística (Tarea 1): en cada periodo se cuentan todas las
// referencias una vez, así que 5 periodos = 5 conteos por referencia al año.
// Cada sorteo pertenece al periodo del mes en que se hizo.
export const PERIODOS_CONTEO = [
  { numero: 1, nombre: 'Ene–Feb', mes_inicio: 1, mes_fin: 2 },
  { numero: 2, nombre: 'Mar–Abr', mes_inicio: 3, mes_fin: 4 },
  { numero: 3, nombre: 'May–Jun', mes_inicio: 5, mes_fin: 6 },
  { numero: 4, nombre: 'Jul–Sep', mes_inicio: 7, mes_fin: 9 },
  { numero: 5, nombre: 'Oct–Dic', mes_inicio: 10, mes_fin: 12 },
];

// El caso no trae stock: si no se digita la cantidad del sistema, se usa una
// simulada y reproducible (siempre la misma para el mismo SKU) en este rango.
export const SEMILLA_STOCK_SIMULADO = 2026;
export const STOCK_SIMULADO_MINIMO = 5;
export const STOCK_SIMULADO_MAXIMO = 150;

// ---------------------------------------------------------------------------
// Exportaciones CSV
// ---------------------------------------------------------------------------

// Excel en español (Colombia) abre bien los CSV separados por punto y coma.
export const SEPARADOR_CSV = ';';
// BOM UTF-8 para que Excel muestre bien las tildes.
// Formatos de exportación: .xlsx con formato (por defecto) o el CSV plano.
export const FORMATOS_EXPORTACION = ['xlsx', 'csv'];
export const TIPO_CONTENIDO_EXPORTACION = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv; charset=utf-8',
};
export const BOM_UTF8 = '﻿';

// Los archivos de entrega se llaman Día<N>_Ejercicio<N> (ej. Día2_Ejercicio6).
// Para no permitir rutas raras, el nombre solo puede tener letras, números, _ y -.
export const PATRON_NOMBRE_ARCHIVO = /^[\p{L}\p{N}_-]+$/u;

// Columnas de cada CSV: `campo` es el dato del JSON y `titulo` el encabezado que se ve en
// Excel. El orden de la lista es el orden de las columnas.
// La lista de despacho es la de la Tarea 6: son posiciones sin SKU, por eso no lleva SKU ni cantidad.
export const COLUMNAS_LISTA_DESPACHO = [
  { campo: 'recorrido', titulo: 'Recorrido' },
  { campo: 'salida', titulo: 'Salida (entra y vuelve)' },
  { campo: 'orden', titulo: 'Orden de visita' },
  { campo: 'numero_plano', titulo: 'Posición en el plano' },
  { campo: 'codigo_ubicacion', titulo: 'Código de ubicación' },
  { campo: 'nivel', titulo: 'Nivel' },
  { campo: 'distancia_acum_m', titulo: 'Distancia acumulada en el recorrido (m)' },
  { campo: 'tiempo_s', titulo: 'Tiempo de recogida (s)' },
  { campo: 'distancia_recorrido_m', titulo: 'Distancia total del recorrido (m)' },
  { campo: 'tiempo_recorrido_s', titulo: 'Tiempo total del recorrido (s)' },
  { campo: 'es_el_mas_demorado', titulo: 'Recorrido más demorado' },
];
export const COLUMNAS_EXPORTAR_MAESTRO = [
  { campo: 'sku', titulo: 'SKU' },
  { campo: 'descripcion', titulo: 'Descripción' },
  { campo: 'categoria', titulo: 'Categoría' },
  { campo: 'es_nueva', titulo: 'Referencia nueva' },
  { campo: 'popularidad', titulo: 'Popularidad (líneas de pedido en Arauca)' },
  { campo: 'clase_abc', titulo: 'Clase ABC' },
  { campo: 'porcentaje_acumulado', titulo: 'Popularidad acumulada (%)' },
  { campo: 'codigo_ubicacion', titulo: 'Código de ubicación' },
  { campo: 'numero_plano', titulo: 'Posición en el plano' },
  { campo: 'columna', titulo: 'Columna' },
  { campo: 'fila', titulo: 'Fila' },
  { campo: 'nivel', titulo: 'Nivel' },
  { campo: 'distancia_salida_m', titulo: 'Distancia a la salida más cercana (m)' },
  { campo: 'ubicacion_logistica', titulo: 'Ubicación en la maqueta (logística)' },
  { campo: 'clase_abc_logistica', titulo: 'Clase ABC según logística' },
];
export const COLUMNAS_EXPORTAR_SORTEOS = [
  { campo: 'sorteo', titulo: 'Sorteo' },
  { campo: 'fecha_hora', titulo: 'Fecha y hora del sorteo' },
  { campo: 'periodo', titulo: 'Periodo de conteo' },
  { campo: 'sku', titulo: 'SKU' },
  { campo: 'descripcion', titulo: 'Descripción' },
  { campo: 'categoria', titulo: 'Categoría' },
  { campo: 'clase_abc', titulo: 'Clase ABC' },
  { campo: 'codigo_ubicacion', titulo: 'Código de ubicación' },
  { campo: 'numero_plano', titulo: 'Posición en el plano' },
  { campo: 'nivel', titulo: 'Nivel' },
  { campo: 'veces_en_el_anio', titulo: 'Vez en el año (de 5)' },
];
export const COLUMNAS_EXPORTAR_REGISTROS_CONTEO = [
  { campo: 'fecha', titulo: 'Fecha del conteo' },
  { campo: 'semana', titulo: 'Semana del año' },
  { campo: 'sorteo', titulo: 'Sorteo' },
  { campo: 'responsable', titulo: 'Responsable' },
  { campo: 'sku', titulo: 'SKU' },
  { campo: 'descripcion', titulo: 'Descripción' },
  { campo: 'codigo_ubicacion', titulo: 'Código de ubicación' },
  { campo: 'cantidad_sistema', titulo: 'Cantidad en sistema' },
  { campo: 'cantidad_contada', titulo: 'Cantidad contada' },
  { campo: 'diferencia', titulo: 'Diferencia (contada - sistema)' },
];
export const COLUMNAS_EXPORTAR_PEDIDOS = [
  { campo: 'id_pedido', titulo: 'N.º de pedido' },
  { campo: 'fecha', titulo: 'Fecha' },
  { campo: 'cliente', titulo: 'Cliente' },
  { campo: 'referencias', titulo: 'Referencias distintas' },
  { campo: 'unidades', titulo: 'Unidades' },
  { campo: 'estado', titulo: 'Estado' },
  { campo: 'ultimo_cambio', titulo: 'Último cambio de estado' },
];

// ---------------------------------------------------------------------------
// Servidor
// ---------------------------------------------------------------------------

export const PUERTO_SERVIDOR = Number(process.env.PORT) || 8000;
