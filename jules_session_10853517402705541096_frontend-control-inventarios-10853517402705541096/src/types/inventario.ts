// Tipos que reflejan exactamente el JSON que devuelve el backend (servidor.py).
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
// Conteo cíclico
// ---------------------------------------------------------------------------

export interface RegistroConteo {
  fecha: string;
  responsable: string;
  semana: number;
  sku: number;
  codigo_ubicacion: string | null;
  cantidad_sistema: number;
  cantidad_contada: number;
  diferencia: number;
}

export interface NuevoRegistroConteo {
  semana: number;
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
  semanas_programadas: number[];
  contados: number;
  estado: string; // "contada X/5"
  sale_de_la_lista: boolean;
  conteos_con_diferencia: number;
  tiene_diferencia: boolean;
}

export interface VerificacionPlan {
  valido: boolean;
  errores: string[];
  referencias: number;
  semanas: number;
  total_conteos: number;
  conteos_esperados: number;
  minimo_por_referencia: number;
  maximo_por_referencia: number;
}

export interface AvanceSemana {
  semana: number;
  planeados: number;
  registrados: number;
  con_diferencia: number;
}

export interface ResumenConteo {
  semana_actual: number;
  conteos_registrados: number;
  conteos_planeados: number;
  cumplimiento_a_la_fecha: number;
  semilla: number;
  referencias_completas: number;
  referencias_con_diferencia: number;
  verificacion_plan: VerificacionPlan;
  avance_semanal: AvanceSemana[];
  progreso: ProgresoReferencia[];
}

export interface ReferenciaSemana extends ProgresoReferencia {
  contada_esta_semana: boolean;
  registro_semana: RegistroConteo | null;
  cantidad_sistema_sugerida: number;
}

export interface SemanaConteo {
  semana: number;
  tamano: number;
  pendientes: number;
  referencias: ReferenciaSemana[];
}

export interface PlanGenerado {
  mensaje: string;
  respaldo_registros: string | null;
  tamanos: number[];
  verificacion: VerificacionPlan;
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
