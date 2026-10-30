import React, { useState } from 'react';
import { Check, ChevronDown, Copy, Cpu } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import type { ConsultaRecorridos } from '../../types/inventario';
import { formatearNumero } from '../../utils/formato';

interface InstruccionesProps {
  /** Vista y origen de los recorridos, para pedir las mismas instrucciones del robot. */
  consulta: ConsultaRecorridos;
  recorridos: number[];
  /** Recorrido que se muestra al abrir (el aislado en la línea de tiempo, o el 1). */
  recorridoInicial: number;
}

/**
 * Sección plegable "Instrucciones para el Arduino": avanzar / girar / recoger de un recorrido,
 * con la escala de la maqueta editable y el botón para copiar el código. Solo se piden al
 * backend cuando la sección está abierta.
 */
export const InstruccionesArduino: React.FC<InstruccionesProps> = ({ consulta, recorridos, recorridoInicial }) => {
  const [abierta, setAbierta] = useState(false);
  const [recorridoElegido, setRecorridoElegido] = useState<number | null>(null);
  const recorrido = recorridoElegido !== null && recorridos.includes(recorridoElegido) ? recorridoElegido : recorridoInicial;

  // La escala llega vacía hasta que el backend responde con la suya. Solo se pide una escala
  // válida; mientras se escribe una inválida se marca el campo.
  const [escalaTexto, setEscalaTexto] = useState<string | null>(null);
  const [escalaPedida, setEscalaPedida] = useState<number | undefined>(undefined);
  const escalaValida = escalaTexto === null || Number(escalaTexto) > 0;
  const cambiarEscala = (texto: string) => {
    setEscalaTexto(texto);
    const numero = Number(texto);
    if (texto !== '' && Number.isFinite(numero) && numero > 0) setEscalaPedida(numero);
  };
  const { vista, origen, sorteo, fecha } = consulta;
  const instrucciones = useApi(
    () => (abierta ? api.obtenerInstruccionesRobot({ vista, origen, sorteo, fecha }, recorrido, escalaPedida) : Promise.resolve(null)),
    [abierta, vista, origen, sorteo, fecha, recorrido, escalaPedida],
  );
  const escalaMostrada = escalaTexto ?? String(instrucciones.datos?.escala ?? '');
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    const texto = instrucciones.datos?.codigo_arduino;
    if (!texto) return;
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Sin permiso para el portapapeles: copiar con un área de texto temporal.
      const area = document.createElement('textarea');
      area.value = texto;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  };

  return (
    <details className="group border border-slate-200 bg-slate-50" onToggle={(e) => setAbierta(e.currentTarget.open)}>
      <summary className="flex items-center gap-2 px-4 h-12 cursor-pointer select-none font-bold text-sm list-none">
        <Cpu className="w-4 h-4 text-senal" />
        Instrucciones para el Arduino
        <ChevronDown className="w-4 h-4 ml-auto transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-slate-200 p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] tracking-[0.1em] text-slate-500">RECORRIDO</span>
            <div className="flex" role="group" aria-label="Recorrido de las instrucciones">
              {recorridos.map((numero) => (
                <button
                  key={numero}
                  type="button"
                  onClick={() => setRecorridoElegido(numero)}
                  aria-pressed={recorrido === numero}
                  className={`h-8 min-w-8 px-2 text-xs font-bold border border-tinta -ml-px first:ml-0 cursor-pointer ${
                    recorrido === numero ? 'bg-tinta text-papel' : 'bg-slate-50 hover:bg-white'
                  }`}
                >
                  {numero}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-1.5 text-xs font-semibold">
            Escala 1:
            <input
              type="number"
              min={1}
              value={escalaMostrada}
              onChange={(e) => cambiarEscala(e.target.value)}
              className={`w-16 h-8 px-1.5 border bg-white font-mono text-sm ${escalaValida ? 'border-slate-300' : 'border-rose-500'}`}
              aria-invalid={!escalaValida}
            />
          </label>
        </div>
        {instrucciones.error ? (
          <p className="text-xs text-rose-700">{instrucciones.error}</p>
        ) : (
          <>
            <p className="text-xs text-slate-600">
              {instrucciones.datos
                ? `${instrucciones.datos.numero_instrucciones} instrucciones · ${formatearNumero(instrucciones.datos.total_cm, 1)} cm en total (${formatearNumero(instrucciones.datos.distancia_m, 1)} m reales)`
                : 'Calculando…'}
            </p>
            <pre className="max-h-[280px] overflow-auto bg-tinta text-papel font-mono text-[11px] leading-relaxed p-3">{instrucciones.datos?.texto ?? ''}</pre>
            <button
              type="button"
              onClick={copiar}
              disabled={!instrucciones.datos}
              className="self-start flex items-center justify-center gap-1.5 h-10 px-4 border border-tinta bg-slate-50 hover:bg-white text-xs font-bold uppercase tracking-wide cursor-pointer disabled:opacity-50"
            >
              {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiado ? 'Copiado' : 'Copiar código para Arduino'}
            </button>
          </>
        )}
      </div>
    </details>
  );
};
