import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Tabla, type ColumnaTabla, type TonoFila } from './Tabla';

interface Fruta {
  id: string;
  nombre: string;
  grupo: string;
  cantidad: number;
  tono: TonoFila;
}

const FRUTAS: Fruta[] = [
  { id: 'a', nombre: 'Mango', grupo: 'Tropical', cantidad: 3, tono: 'aqui' },
  { id: 'b', nombre: 'Piña', grupo: 'Tropical', cantidad: 12, tono: 'camino' },
  { id: 'c', nombre: 'Manzana', grupo: 'Clima frío', cantidad: 7, tono: 'visitada' },
];

const COLUMNAS: ColumnaTabla<Fruta>[] = [
  { clave: 'nombre', titulo: 'Nombre' },
  { clave: 'cantidad', titulo: 'Cantidad', alinear: 'derecha' },
  { clave: 'nota', titulo: 'Nota', render: (fruta) => <input aria-label={`Nota de ${fruta.nombre}`} /> },
];

const filasDeDatos = () => screen.getAllByRole('row').filter((fila) => fila.hasAttribute('data-clave'));

describe('Tabla', () => {
  afterEach(cleanup);

  it('dibuja las columnas como <th scope="col"> y una fila por dato, con el render de cada columna', () => {
    render(<Tabla columnas={COLUMNAS} filas={FRUTAS} claveFila={(f) => f.id} />);
    const encabezados = screen.getAllByRole('columnheader');
    expect(encabezados.map((th) => th.textContent)).toEqual(['Nombre', 'Cantidad', 'Nota']);
    expect(encabezados.every((th) => th.getAttribute('scope') === 'col')).toBe(true);
    expect(filasDeDatos()).toHaveLength(3);
    expect(within(filasDeDatos()[1]).getByText('12').className).toContain('tabla-derecha');
    expect(screen.getByLabelText('Nota de Manzana')).toBeTruthy();
  });

  it('agrupa con encabezado propio y el grupo se pliega y despliega', () => {
    render(
      <Tabla
        columnas={COLUMNAS}
        filas={FRUTAS}
        claveFila={(f) => f.id}
        agruparPor={(f) => f.grupo}
        encabezadoGrupo={(clave, filas) => `${clave} (${filas.length})`}
      />,
    );
    const boton = screen.getByRole('button', { name: 'Tropical (2)' });
    expect(screen.getByRole('button', { name: 'Clima frío (1)' })).toBeTruthy();
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(boton);
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    expect(filasDeDatos().map((fila) => fila.dataset.clave)).toEqual(['c']);
    fireEvent.click(boton);
    expect(filasDeDatos().map((fila) => fila.dataset.clave)).toEqual(['a', 'b', 'c']);
  });

  it('tonoFila pone el tono de cada fila (y por defecto "normal")', () => {
    const { rerender } = render(<Tabla columnas={COLUMNAS} filas={FRUTAS} claveFila={(f) => f.id} tonoFila={(f) => f.tono} />);
    expect(filasDeDatos().map((fila) => fila.dataset.tono)).toEqual(['aqui', 'camino', 'visitada']);
    rerender(<Tabla columnas={COLUMNAS} filas={FRUTAS} claveFila={(f) => f.id} />);
    expect(filasDeDatos().map((fila) => fila.dataset.tono)).toEqual(['normal', 'normal', 'normal']);
  });

  it('clic, Enter y Espacio en una fila llaman a alClicFila; la fila activa lleva aria-current', () => {
    const alClicFila = vi.fn();
    render(<Tabla columnas={COLUMNAS} filas={FRUTAS} claveFila={(f) => f.id} alClicFila={alClicFila} filaActiva="b" />);
    const [mango, pina] = filasDeDatos();
    expect(mango.getAttribute('tabIndex')).toBe('0');
    expect(pina.getAttribute('aria-current')).toBe('true');
    expect(mango.getAttribute('aria-current')).toBeNull();

    fireEvent.click(within(mango).getByText('Mango'));
    fireEvent.keyDown(pina, { key: 'Enter' });
    fireEvent.keyDown(pina, { key: ' ' });
    expect(alClicFila.mock.calls.map(([fruta]) => fruta.id)).toEqual(['a', 'b', 'b']);
  });

  it('Enter o clic dentro de un input de la fila NO llaman a alClicFila', () => {
    const alClicFila = vi.fn();
    render(<Tabla columnas={COLUMNAS} filas={FRUTAS} claveFila={(f) => f.id} alClicFila={alClicFila} />);
    const campo = screen.getByLabelText('Nota de Mango');
    fireEvent.keyDown(campo, { key: 'Enter' });
    fireEvent.click(campo);
    expect(alClicFila).not.toHaveBeenCalled();
  });

  it('alPasarFila avisa al entrar y al salir de una fila', () => {
    const alPasarFila = vi.fn();
    render(<Tabla columnas={COLUMNAS} filas={FRUTAS} claveFila={(f) => f.id} alPasarFila={alPasarFila} />);
    fireEvent.mouseEnter(filasDeDatos()[2]);
    fireEvent.mouseLeave(filasDeDatos()[2]);
    expect(alPasarFila.mock.calls.map(([fruta]) => fruta?.id ?? null)).toEqual(['c', null]);
  });

  it('sin filas muestra el mensaje de vacío; cargando muestra filas esqueleto', () => {
    const { rerender } = render(<Tabla columnas={COLUMNAS} filas={[]} claveFila={(f: Fruta) => f.id} vacio="No hay frutas." />);
    expect(screen.getByText('No hay frutas.')).toBeTruthy();
    rerender(<Tabla columnas={COLUMNAS} filas={[]} claveFila={(f: Fruta) => f.id} cargando />);
    expect(screen.queryByText('No hay frutas.')).toBeNull();
    expect(document.querySelectorAll('.tabla-esqueleto').length).toBe(5 * COLUMNAS.length);
  });

  it('solo vuelve a dibujar las filas que cambiaron', () => {
    const renders: Record<string, number> = {};
    const columnas: ColumnaTabla<Fruta>[] = [
      {
        clave: 'nombre',
        titulo: 'Nombre',
        render: (fruta) => {
          renders[fruta.id] = (renders[fruta.id] ?? 0) + 1;
          return fruta.nombre;
        },
      },
    ];
    // Filas nuevas en cada render (como las arma una página), pero con los mismos valores.
    const copia = () => FRUTAS.map((fruta) => ({ ...fruta }));
    const { rerender } = render(<Tabla columnas={columnas} filas={copia()} claveFila={(f) => f.id} tonoFila={(f) => f.tono} />);
    const cambiadas = copia();
    cambiadas[1].tono = 'aqui';
    rerender(<Tabla columnas={columnas} filas={cambiadas} claveFila={(f) => f.id} tonoFila={(f) => f.tono} />);
    expect(renders).toEqual({ a: 1, b: 2, c: 1 });
  });
});
