import React from 'react';
import { Box, Cpu, Gauge, Map as IconoMapa, Maximize, Minimize, Navigation } from 'lucide-react';
import type { VistaMapa } from '../../types/inventario';
import type { ParadaActiva, ParadaLinea } from '../../utils/animacion';
import { claveParada } from '../../utils/animacion';
import { textoVecesT, type FilaRecorrido } from '../../utils/tablaRecorrido';
import { formatearNumero } from '../../utils/formato';
import type { Calidad, ModoCamara, ModoColor } from './Escena3D';
import { COLORES_ABC, COLORES_CATEGORIA, ESCENA } from './constantes';

// Piezas del HUD que flotan sobre el mapa 3D. Todas llevan fondo propio para leerse sobre la escena.

const claseBoton = (activo: boolean) =>
  `flex items-center gap-1.5 h-9 px-3 text-xs font-bold uppercase tracking-wide border border-tinta -ml-px first:ml-0 cursor-pointer transition-colors ${
    activo ? 'bg-tinta text-papel' : 'bg-slate-50/95 text-tinta hover:bg-white'
  }`;

const VISTAS: { valor: VistaMapa; etiqueta: string }[] = [
  { valor: 'arauca', etiqueta: 'Bodega Arauca' },
  { valor: 'maqueta', etiqueta: 'Maqueta' },
];

const CAMARAS: { valor: ModoCamara; etiqueta: string; icono: typeof Box }[] = [
  { valor: 'isometrica', etiqueta: 'Isométrica', icono: Box },
  { valor: 'planta', etiqueta: 'Planta', icono: IconoMapa },
  { valor: 'carrito', etiqueta: 'Carrito', icono: Navigation },
];

/** Arriba a la izquierda: qué está recorriendo el carrito. */
export const ResumenOrigen: React.FC<{ texto: string }> = ({ texto }) => (
  <div className="flex items-center gap-1.5 px-3 h-9 bg-tinta/90 text-papel font-mono text-xs" title="El sistema elige el método según el número de paradas">
    <Cpu className="w-3.5 h-3.5 text-senal shrink-0" />
    <span className="truncate">{texto}</span>
  </div>
);

/** Interruptor Bodega Arauca / Maqueta (también se usa fuera del mapa cuando no hay WebGL). */
export const SelectorVista: React.FC<{ vista: VistaMapa; alCambiar: (vista: VistaMapa) => void }> = ({ vista, alCambiar }) => (
  <div className="flex" role="group" aria-label="Vista del mapa">
    {VISTAS.map((opcion) => (
      <button key={opcion.valor} type="button" onClick={() => alCambiar(opcion.valor)} aria-pressed={vista === opcion.valor} className={claseBoton(vista === opcion.valor)}>
        {opcion.etiqueta}
      </button>
    ))}
  </div>
);

/** Arriba a la derecha: cámaras, vista y pantalla completa. */
export const ControlesMapa: React.FC<{
  modoCamara: ModoCamara;
  alCambiarCamara: (modo: ModoCamara) => void;
  vista: VistaMapa;
  alCambiarVista: (vista: VistaMapa) => void;
  calidad: Calidad;
  alCambiarCalidad: (calidad: Calidad) => void;
  pantallaCompleta: boolean;
  alAlternarPantallaCompleta: () => void;
}> = ({ modoCamara, alCambiarCamara, vista, alCambiarVista, calidad, alCambiarCalidad, pantallaCompleta, alAlternarPantallaCompleta }) => (
  <div className="flex flex-wrap justify-end gap-2">
    <div className="flex" role="group" aria-label="Vista de cámara">
      {CAMARAS.map(({ valor, etiqueta, icono: Icono }) => (
        <button key={valor} type="button" onClick={() => alCambiarCamara(valor)} aria-pressed={modoCamara === valor} className={claseBoton(modoCamara === valor)}>
          <Icono className="w-3.5 h-3.5" />
          {etiqueta}
        </button>
      ))}
    </div>
    <SelectorVista vista={vista} alCambiar={alCambiarVista} />
    <button
      type="button"
      onClick={() => alCambiarCalidad(calidad === 'alta' ? 'basica' : 'alta')}
      title="Básica: sin sombras ni baliza animada, para equipos con gráfica integrada"
      className={claseBoton(false)}
    >
      <Gauge className="w-3.5 h-3.5" />
      Calidad: {calidad === 'alta' ? 'alta' : 'básica'}
    </button>
    <button
      type="button"
      onClick={alAlternarPantallaCompleta}
      aria-label={pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
      title={pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
      className={`${claseBoton(false)} !px-2.5`}
    >
      {pantallaCompleta ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
    </button>
  </div>
);

/** Abajo a la izquierda: leyenda (etiquetas de las vigas y contornos) e interruptor ABC / categoría. */
export const LeyendaMapa: React.FC<{ modoColor: ModoColor; alCambiar: (modo: ModoColor) => void }> = ({ modoColor, alCambiar }) => {
  const paleta = modoColor === 'abc' ? COLORES_ABC : COLORES_CATEGORIA;
  return (
    <div className="bg-slate-50/95 border border-slate-200 p-2 flex flex-col gap-1.5 text-[11px]">
      <div className="flex" role="group" aria-label="Colorear por">
        <button type="button" onClick={() => alCambiar('abc')} aria-pressed={modoColor === 'abc'} className={`${claseBoton(modoColor === 'abc')} !h-7`}>
          Clase ABC
        </button>
        <button type="button" onClick={() => alCambiar('categoria')} aria-pressed={modoColor === 'categoria'} className={`${claseBoton(modoColor === 'categoria')} !h-7`}>
          Categoría
        </button>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 max-w-[300px]">
        {Object.entries(paleta).map(([nombre, color]) => (
          <span key={nombre} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 border border-tinta" style={{ background: color }} />
            {modoColor === 'abc' ? `Clase ${nombre}` : nombre}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 border-2" style={{ borderColor: ESCENA.contornoPendiente }} />
          Por visitar
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 border-2" style={{ borderColor: ESCENA.contornoVisitada }} />
          Ya visitada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 border-2" style={{ borderColor: ESCENA.contornoActivo, background: `${ESCENA.contornoActivo}33` }} />
          Próxima parada
        </span>
      </div>
    </div>
  );
};

const BloqueParada: React.FC<{ titulo: string; parada: ParadaLinea | undefined; filas: FilaRecorrido[]; vacio: string; destacada?: boolean }> = ({
  titulo,
  parada,
  filas,
  vacio,
  destacada,
}) => (
  <div className={`flex flex-col gap-1 px-3 py-2 ${destacada ? 'border-l-[3px] border-senal' : 'border-l-[3px] border-transparent'}`}>
    <span className="font-mono text-[10px] tracking-[0.12em] text-[#b5b0a4]">{titulo}</span>
    {parada ? (
      <>
        <span className="font-bold text-sm">
          Recorrido {parada.recorrido} · parada {parada.orden} <span className="font-mono text-xs text-[#b5b0a4]">#{parada.etiqueta}</span>
        </span>
        {filas.map((fila) => (
          <span key={fila.codigo_ubicacion} className="font-mono text-xs">
            {fila.codigo_ubicacion} · N{fila.nivel}
            {fila.sku !== null && ` · ${fila.sku}`} · {textoVecesT(fila.veces_t)} ({formatearNumero(fila.tiempo_s, 0)} s)
          </span>
        ))}
      </>
    ) : (
      <span className="text-sm text-[#b5b0a4]">{vacio}</span>
    )}
  </div>
);

/**
 * Solo en pantalla completa (la tabla no se ve): la parada donde está el carrito y la siguiente,
 * para que la sincronía se siga viendo al proyectar.
 */
export const TarjetaParada: React.FC<{ paradas: ParadaLinea[]; activa: ParadaActiva; filasPorParada: Map<string, FilaRecorrido[]> }> = ({
  paradas,
  activa,
  filasPorParada,
}) => {
  const enParada = activa.fase === 'aqui';
  const actual = enParada ? paradas[activa.indice] : undefined;
  const siguiente = paradas[enParada ? activa.indice + 1 : activa.indice];
  const filasDe = (parada?: ParadaLinea) => (parada ? filasPorParada.get(claveParada(parada)) ?? [] : []);
  return (
    <div className="w-[300px] bg-tinta/90 backdrop-blur-sm text-papel divide-y divide-[#45474d]" aria-live="polite">
      <BloqueParada
        titulo="AHORA"
        parada={actual}
        filas={filasDe(actual)}
        vacio={activa.fase === 'terminado' ? 'Recorrido terminado' : 'En camino…'}
        destacada
      />
      <BloqueParada titulo="SIGUIENTE" parada={siguiente} filas={filasDe(siguiente)} vacio="Vuelta a la salida" />
    </div>
  );
};
