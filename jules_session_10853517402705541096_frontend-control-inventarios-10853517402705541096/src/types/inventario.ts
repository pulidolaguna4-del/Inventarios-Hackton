// Tipos que reflejan exactamente el JSON que devuelve el backend (Express, ../backend).
// Los nombres de los campos son los mismos del backend, en español y snake_case.

// ---------------------------------------------------------------------------
// Datos generales y maestro
// ---------------------------------------------------------------------------

export interface Resumen {
  bodega: string;
  referencias_totales: number;
  referencias_ventas: number;
  referencias_nuevas: number;
  lineas_ventas: number;
  ordenes_totales: number;
  lineas_bodega: number;
  ordenes_bodega: number;
  dias_con_pedidos_bodega: number;
  fecha_inicial: string;
  fecha_final: string;
  fechas_disponibles: string[];
}

export type ClaseAbc = 'A' | 'B' | 'C';

export interface Referencia {
  sku: number;
  descripcion: string;
  categoria: string;
  es_nueva: boolean;
  popularidad: number;
  origen_popularidad: 'ventas' | 'proyeccion';
  clase_abc: ClaseAbc;
  porcentaje_acumulado: number;
  codigo_ubicacion: string;
  columna: number;
  fila: number;
  nivel: number;
  numero_plano: number;
  distancia_salida_m: number;
  fuente_ubicacion: 'generada' | 'logistica';
  /** Posición en la maqueta del robot según el entregable de logística (U01-N1-I...). Solo las 11 nuevas. */
  ubicacion_logistica: string | null;
  /** Clase ABC que puso logística (por unidades). Distinta de clase_abc (por líneas de pedido). */
  clase_abc_logistica: ClaseAbc | null;
}

export interface Maestro {
  generado: string;
  fuente: string;
  criterios: {
    popularidad: string;
    popularidad_nuevas: string;
    factor_lineas_por_unidad: number;
    umbral_a: number;
    umbral_b: number;
    priorizar_nivel_1: boolean;
  };
  conteo_por_clase: Record<ClaseAbc, number>;
  referencias: Referencia[];
}

// ---------------------------------------------------------------------------
// Conteo cíclico por sorteos
// ---------------------------------------------------------------------------

export interface RegistroConteo {
  fecha: string;
  responsable: string;
  /** Número del sorteo en que salió la referencia. */
  sorteo: number;
  /** Semana del año en que se hizo el conteo (sale de la fecha). */
  semana: number;
  sku: number;
  codigo_ubicacion: string | null;
  cantidad_sistema: number;
  cantidad_contada: number;
  diferencia: number;
}

export interface NuevoRegistroConteo {
  sorteo: number;
  sku: number;
  responsable: string;
  cantidad_contada: number;
  /** Si se deja vacía, el backend usa el stock simulado del SKU. */
  cantidad_sistema?: number | null;
  /** AAAA-MM-DD; si se deja vacía, el backend usa la fecha de hoy. */
  fecha?: string;
}

export interface ProgresoReferencia {
  sku: number;
  descripcion: string;
  categoria: string;
  codigo_ubicacion: string | null;
  /** Números de los sorteos en que ha salido la referencia. */
  sorteos: number[];
  contados: number;
  estado: string; // "contada X/5"
  sale_de_la_lista: boolean;
  conteos_con_diferencia: number;
  tiene_diferencia: boolean;
}

export interface VerificacionSorteos {
  valido: boolean;
  errores: string[];
  referencias: number;
  conteos_esperados: number;
  conteos_sorteados: number;
  minimo_por_referencia: number;
  maximo_por_referencia: number;
  /** Todas las referencias ya salieron 5 veces. */
  completo: boolean;
}

export interface AvanceSemana {
  semana: number;
  registrados: number;
  con_diferencia: number;
}

export interface ResumenSorteo {
  numero: number;
  fecha_hora: string;
  periodo: number;
  tamano: number;
  registrados: number;
  con_diferencia: number;
}

/** Periodo de conteo del plan de logística: en cada uno se cuentan todas las referencias una vez. */
export interface PeriodoConteo {
  numero: number;
  nombre: string;
  mes_inicio: number;
  mes_fin: number;
  sorteos: number[];
  conteos_sorteados: number;
  conteos_registrados: number;
  referencias_contadas: number;
  referencias_totales: number;
}

export interface ResumenConteo {
  semana_actual: number;
  referencias: number;
  conteos_por_anio: number;
  conteos_totales: number;
  conteos_sorteados: number;
  conteos_registrados: number;
  pendientes_por_contar: number;
  por_sortear: number;
  referencias_disponibles: number;
  cumplimiento: number;
  referencias_completas: number;
  referencias_con_diferencia: number;
  sorteo_actual: number | null;
  periodo_actual: number;
  periodos: PeriodoConteo[];
  sorteos: ResumenSorteo[];
  verificacion: VerificacionSorteos;
  avance_semanal: AvanceSemana[];
  progreso: ProgresoReferencia[];
  cantidad_sorteo_por_defecto: number;
}

export interface ReferenciaSorteo extends ProgresoReferencia {
  contada_en_sorteo: boolean;
  registro_sorteo: RegistroConteo | null;
  cantidad_sistema_sugerida: number;
}

export interface SorteoConteo {
  sorteo: number;
  fecha_hora: string;
  periodo: number;
  semilla: number;
  tamano: number;
  pendientes: number;
  referencias: ReferenciaSorteo[];
}

export interface ResultadoSorteo {
  mensaje: string;
  sorteo: number;
  tamano: number;
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

export type EstadoPedido = 'Pendiente' | 'En alistamiento' | 'Alistado' | 'En entrega' | 'Entregado';

export interface CambioEstado {
  estado: EstadoPedido;
  fecha_hora: string;
}

export interface Pedido {
  id_pedido: number;
  fecha: string;
  cliente: string;
  ciudad: string;
  lineas: { sku: number; descripcion: string; cantidad: number }[];
  referencias: number;
  unidades: number;
  estado: EstadoPedido;
  siguiente_estado: EstadoPedido | null;
  historial: CambioEstado[];
  ultimo_cambio: string | null;
}

export interface RespuestaPedidos {
  fecha: string;
  estados: EstadoPedido[];
  conteo_por_estado: Record<EstadoPedido, number>;
  pedidos: Pedido[];
}

// ---------------------------------------------------------------------------
// Picking (informativo)
// ---------------------------------------------------------------------------

export interface Recorrido {
  recorrido: number;
  salida_inicio: string;
  salida_fin: string;
  paradas: { numero_plano: number; columna: number; fila: number; niveles: number[] }[];
  distancia_m: number;
  tiempo_desplazamiento_s: number;
  tiempo_recogida_s: number;
  tiempo_total_s: number;
  es_el_mas_demorado: boolean;
}

export interface ResultadoPicking {
  metodo: 'exacto' | 'heuristico';
  recorridos: Recorrido[];
  totales: {
    recorrido_mas_demorado: number | null;
    tiempo_mas_demorado_s: number | null;
    recorridos: number;
    ubicaciones: number;
    distancia_m: number;
    tiempo_desplazamiento_s: number;
    tiempo_recogida_s: number;
    tiempo_total_s: number;
    velocidad_m_s: number;
    tiempo_recogida_nivel_1_s: number;
  };
}

// ---------------------------------------------------------------------------
// Exportaciones
// ---------------------------------------------------------------------------

export type TipoExportacion = 'maestro' | 'conteo' | 'registros_conteo' | 'pedidos' | 'picking';

// ---------------------------------------------------------------------------
// Mapa 3D: layout, trazado de los recorridos e instrucciones del robot
// ---------------------------------------------------------------------------

export type VistaMapa = 'arauca' | 'maqueta';

export interface Punto {
  x: number;
  y: number;
}

/** Celda de almacenamiento. (x, y) es el centro del estante en planta y z la altura del centro de la caja. */
export interface CeldaLayout {
  codigo_ubicacion: string;
  columna: number | null;
  fila: number | null;
  nivel: number;
  /** Número del plano (Arauca) o código U.. (maqueta). */
  etiqueta: string;
  x: number;
  y: number;
  z: number;
  punto_recogida: Punto;
  ocupada: boolean;
  sku: number | null;
  descripcion: string | null;
  clase_abc: ClaseAbc | null;
  categoria: string | null;
  indice_anillo?: number;
  zona?: string;
  lado?: 'I' | 'D';
}

export interface SegmentoLayout {
  nombre: string;
  tipo?: string;
  x_inicio: number;
  y_inicio: number;
  x_fin: number;
  y_fin: number;
}

export interface LayoutBodega {
  vista: VistaMapa;
  nombre: string;
  medidas: {
    ancho_total: number;
    largo_total: number;
    limites: { x_min: number; x_max: number; y_min: number; y_max: number };
    niveles: number;
    travesanos: number;
    alto_nivel: number;
    largo_celda: number;
    fondo_rack: number;
    ancho_pasillo: number;
  };
  celdas: CeldaLayout[];
  salidas: { nombre: string; x: number; y: number }[];
  cabeceras: { nombre: string; y: number; x_inicio: number; x_fin: number }[];
  pasillos: SegmentoLayout[];
}

export interface UbicacionParada {
  codigo_ubicacion: string;
  nivel: number;
  tiempo_recogida_s: number;
  sku?: number;
}

export interface EventoTramo {
  tipo: 'tramo';
  tipo_tramo: 'pasillo' | 'cabecera' | 'zona_abierta' | 'frente';
  punto_inicio: Punto;
  punto_fin: Punto;
  distancia_m: number;
  distancia_acum_inicio_m: number;
  distancia_acum_fin_m: number;
  tiempo_inicio_s: number;
  tiempo_fin_s: number;
}

export interface EventoParada {
  tipo: 'parada';
  orden: number;
  etiqueta: string;
  niveles: number[];
  ubicaciones: UbicacionParada[];
  punto: Punto;
  tiempo_recogida_s: number;
  distancia_acum_m: number;
  tiempo_inicio_s: number;
  tiempo_fin_s: number;
}

export type EventoTrazado = EventoTramo | EventoParada;

export interface RecorridoConTrazado {
  recorrido: number;
  salida_inicio: string;
  salida_fin: string;
  paradas: { etiqueta?: string; numero_plano?: number; niveles: number[] }[];
  distancia_m: number;
  tiempo_desplazamiento_s: number;
  tiempo_recogida_s: number;
  tiempo_total_s: number;
  es_el_mas_demorado: boolean;
  trazado: { eventos: EventoTrazado[]; distancia_m: number; tiempo_total_s: number };
  tiempo_inicio_global_s: number;
  tiempo_fin_global_s: number;
}

export interface PickingConTrazado {
  metodo: string;
  recorridos: RecorridoConTrazado[];
  totales: ResultadoPicking['totales'];
}

export interface InstruccionRobot {
  orden: number;
  accion: 'avanzar' | 'girarDerecha' | 'girarIzquierda' | 'recoger';
  valor: number | null;
  comentario: string | null;
  texto: string;
}

export interface InstruccionesRobot {
  vista: VistaMapa;
  recorrido: number;
  escala: number;
  distancia_m: number;
  instrucciones: InstruccionRobot[];
  total_cm: number;
  numero_instrucciones: number;
  texto: string;
  codigo_arduino: string;
}
