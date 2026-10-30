import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { guardarResponsable, leerResponsableGuardado } from '../utils/responsable';
import type { RegistroConteo, SorteoConteo } from '../types/inventario';

/** Lo que el conteo necesita de cada fila: su SKU y la cantidad sugerida del sistema. */
export interface FilaContable {
  sku: number;
  cantidad_sistema: number | null;
}

/** Error de una fila; `numero` cambia con cada error nuevo (para repetir la animación). */
export interface ErrorConteo {
  texto: string;
  numero: number;
}

/** Acciones del conteo. Son estables (la misma función en cada render): sirven en columnas memorizadas. */
export interface AccionesConteo {
  cambiarSistema: (sku: number, texto: string) => void;
  cambiarContada: (sku: number, texto: string) => void;
  guardar: (fila: FilaContable) => Promise<void>;
  /** Ref para el campo "contada" de un SKU (para mover el foco). */
  refCampo: (sku: number) => (elemento: HTMLInputElement | null) => void;
  enfocar: (sku: number) => void;
}

/**
 * Conteo en línea de un sorteo: responsable, cantidades escritas, Enter guarda con
 * POST /api/conteo/registro y el foco pasa a la siguiente fila sin contar. Los campos no
 * dependen de la animación: se puede contar en cualquier orden y con el carrito quieto.
 */
export function useConteoSorteo(sorteo: SorteoConteo | null, filas: FilaContable[], alGuardar: () => Promise<void>) {
  const [responsable, setResponsable] = useState(leerResponsableGuardado);
  const [sistema, setSistema] = useState<Record<number, string>>({});
  const [contada, setContada] = useState<Record<number, string>>({});
  const [errores, setErrores] = useState<Record<number, ErrorConteo>>({});
  const [guardando, setGuardando] = useState<number | null>(null);
  // Registros guardados en esta pantalla: se muestran sin esperar a que se recargue el sorteo.
  // Son de un sorteo: al cambiar de sorteo no se arrastran (un SKU puede salir en varios).
  const numeroSorteo = sorteo?.sorteo ?? null;
  const [guardadosDe, setGuardadosDe] = useState<{ sorteo: number | null; registros: Record<number, RegistroConteo> }>({ sorteo: null, registros: {} });
  const guardados = guardadosDe.sorteo === numeroSorteo ? guardadosDe.registros : {};
  const campos = useRef(new Map<number, HTMLInputElement>());

  const registroDe = (sku: number) =>
    guardados[sku] ?? sorteo?.referencias.find((referencia) => referencia.sku === sku)?.registro_sorteo ?? null;
  const contadas = filas.filter((fila) => registroDe(fila.sku)).length;
  const sinResponsable = !responsable.trim();

  const cambiarResponsable = (nombre: string) => {
    setResponsable(nombre);
    guardarResponsable(nombre);
  };

  const textoSistema = (fila: FilaContable) => sistema[fila.sku] ?? String(fila.cantidad_sistema ?? '');

  const ponerError = (sku: number, texto: string) =>
    setErrores((previos) => ({ ...previos, [sku]: { texto, numero: (previos[sku]?.numero ?? 0) + 1 } }));

  /** Guarda el conteo de una fila (lee siempre el estado más reciente: ver `ultimo`). */
  const guardar = async (fila: FilaContable) => {
    if (!sorteo) return;
    const { sku } = fila;
    const indice = filas.findIndex((f) => f.sku === sku);
    const textoContada = contada[sku] ?? '';
    const sistemaEscrito = textoSistema(fila);
    if (sinResponsable) return ponerError(sku, 'Escribe arriba quién está contando.');
    if (textoContada === '' || !Number.isInteger(Number(textoContada)) || Number(textoContada) < 0) {
      return ponerError(sku, 'La cantidad contada debe ser un entero de 0 en adelante.');
    }
    setGuardando(sku);
    try {
      const { registro } = await api.registrarConteo({
        sorteo: sorteo.sorteo,
        sku,
        responsable: responsable.trim(),
        cantidad_contada: Number(textoContada),
        cantidad_sistema: sistemaEscrito === '' ? null : Number(sistemaEscrito),
      });
      const nuevos = { ...guardados, [sku]: registro };
      setGuardadosDe({ sorteo: numeroSorteo, registros: nuevos });
      setErrores((previos) => {
        const resto = { ...previos };
        delete resto[sku];
        return resto;
      });
      // Pasa el foco a la siguiente referencia sin contar (después de esta, o la primera que quede).
      const pendientes = filas.map((f, i) => ({ f, i })).filter(({ f }) => !nuevos[f.sku] && !registroDe(f.sku));
      const siguiente = pendientes.find(({ i }) => i > indice) ?? pendientes[0];
      if (siguiente) campos.current.get(siguiente.f.sku)?.focus({ preventScroll: true });
      await alGuardar();
    } catch (e) {
      ponerError(sku, e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(null);
    }
  };

  // `guardar` cambia en cada render (lee el estado actual); las acciones públicas son estables
  // y llaman siempre a la versión más reciente.
  const ultimo = useRef(guardar);
  useEffect(() => {
    ultimo.current = guardar;
  });
  const [acciones] = useState<AccionesConteo>(() => ({
    cambiarSistema: (sku, texto) => setSistema((previos) => ({ ...previos, [sku]: texto })),
    cambiarContada: (sku, texto) => setContada((previos) => ({ ...previos, [sku]: texto })),
    guardar: (fila) => ultimo.current(fila),
    refCampo: (sku) => (elemento) => {
      if (elemento) campos.current.set(sku, elemento);
      else campos.current.delete(sku);
    },
    // Sin mover la página: la tabla se encarga de su propio scroll.
    enfocar: (sku) => campos.current.get(sku)?.focus({ preventScroll: true }),
  }));

  return {
    responsable,
    cambiarResponsable,
    sinResponsable,
    registroDe,
    /** true si el SKU se guardó en esta pantalla (para el destello verde). */
    recienGuardado: (sku: number) => sku in guardados,
    contadas,
    textoSistema,
    textoContada: (sku: number) => contada[sku] ?? '',
    errores,
    guardando,
    acciones,
  };
}

export type ConteoSorteo = ReturnType<typeof useConteoSorteo>;
