import { useRef, useState } from 'react';
import { api } from '../services/api';
import { guardarResponsable, leerResponsableGuardado } from '../utils/responsable';
import type { RegistroConteo, SorteoConteo } from '../types/inventario';

/** Lo que el conteo necesita de cada fila: su SKU y la cantidad sugerida del sistema. */
export interface FilaContable {
  sku: number;
  cantidad_sistema: number | null;
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
  const [errores, setErrores] = useState<Record<number, string>>({});
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

  /** Ref para el campo "contada" de un SKU (para mover el foco). */
  const refCampo = (sku: number) => (elemento: HTMLInputElement | null) => {
    if (elemento) campos.current.set(sku, elemento);
    else campos.current.delete(sku);
  };
  // Sin mover la página: la tabla centra la fila en su propio contenedor al recibir el foco.
  const enfocar = (sku: number) => campos.current.get(sku)?.focus({ preventScroll: true });

  /** Pasa el foco a la siguiente referencia sin contar (después de la actual, o la primera que quede). */
  const enfocarSiguiente = (indiceActual: number, yaContadas: Set<number>) => {
    const pendientes = filas.map((fila, indice) => ({ fila, indice })).filter(({ fila }) => !yaContadas.has(fila.sku));
    const siguiente = pendientes.find(({ indice }) => indice > indiceActual) ?? pendientes[0];
    if (siguiente) enfocar(siguiente.fila.sku);
  };

  const guardar = async (fila: FilaContable) => {
    if (!sorteo) return;
    const { sku } = fila;
    const indice = filas.findIndex((f) => f.sku === sku);
    const textoContada = contada[sku] ?? '';
    const sistemaEscrito = textoSistema(fila);
    if (sinResponsable) return setErrores({ ...errores, [sku]: 'Escribe arriba quién está contando.' });
    if (textoContada === '' || !Number.isInteger(Number(textoContada)) || Number(textoContada) < 0) {
      return setErrores({ ...errores, [sku]: 'La cantidad contada debe ser un entero de 0 en adelante.' });
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
      const yaContadas = new Set(filas.map((f) => f.sku).filter((s) => nuevos[s] || registroDe(s)));
      enfocarSiguiente(indice, yaContadas);
      await alGuardar();
    } catch (e) {
      setErrores({ ...errores, [sku]: e instanceof Error ? e.message : String(e) });
    } finally {
      setGuardando(null);
    }
  };

  return {
    responsable,
    cambiarResponsable,
    sinResponsable,
    registroDe,
    contadas,
    textoSistema,
    cambiarSistema: (sku: number, texto: string) => setSistema({ ...sistema, [sku]: texto }),
    textoContada: (sku: number) => contada[sku] ?? '',
    cambiarContada: (sku: number, texto: string) => setContada({ ...contada, [sku]: texto }),
    errores,
    guardando,
    guardar,
    refCampo,
    enfocar,
  };
}

export type ConteoSorteo = ReturnType<typeof useConteoSorteo>;
