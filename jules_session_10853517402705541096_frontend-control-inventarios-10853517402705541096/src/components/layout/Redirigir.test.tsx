import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Redirigir } from './Redirigir';

/** Muestra la ruta a la que se llegó, para comprobar la redirección. */
function Destino() {
  const { pathname, search } = useLocation();
  return <span data-testid="destino">{pathname + search}</span>;
}

function llegarA(rutaInicial: string): string {
  const { getByTestId, unmount } = render(
    <MemoryRouter initialEntries={[rutaInicial]}>
      <Routes>
        <Route path="/conteos-anio" element={<Redirigir to="/inventario" extra={{ vista: 'anio' }} />} />
        <Route path="/picking" element={<Redirigir to="/recorrido" />} />
        <Route path="*" element={<Destino />} />
      </Routes>
    </MemoryRouter>,
  );
  const destino = getByTestId('destino').textContent ?? '';
  unmount();
  return destino;
}

describe('Redirigir', () => {
  it('conserva la consulta de la ruta vieja', () => {
    expect(llegarA('/picking?origen=sorteo&sorteo=7')).toBe('/recorrido?origen=sorteo&sorteo=7');
  });

  it('agrega los parámetros extra a la ruta vieja', () => {
    expect(llegarA('/conteos-anio')).toBe('/inventario?vista=anio');
    expect(llegarA('/picking')).toBe('/recorrido');
  });
});
