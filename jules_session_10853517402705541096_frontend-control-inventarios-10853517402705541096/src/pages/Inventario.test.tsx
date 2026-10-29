import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Inventario } from './Inventario';

const referencia = (sku: number) => ({
  sku, descripcion: `Ref ${sku}`, categoria: 'Aire acondicionado', es_nueva: false, popularidad: 10, origen_popularidad: 'ventas',
  clase_abc: 'A', codigo_ubicacion: 'C1-F01-N1', numero_plano: 18, ubicacion_logistica: null, clase_abc_logistica: null,
});

vi.mock('../services/api', () => ({
  api: {
    obtenerMaestro: () =>
      Promise.resolve({
        fuente: 'sistema', generado: '2026-10-28', conteo_por_clase: { A: 3, B: 0, C: 0 },
        criterios: { umbral_a: 0.8, umbral_b: 0.95, factor_lineas_por_unidad: 0.04 },
        referencias: [referencia(100003), referencia(100010), referencia(100020)],
      }),
    obtenerProgresoConteo: () => Promise.resolve({ progreso: [] }),
    // En el sorteo 8 solo se contó la 100010, con diferencia de -2.
    obtenerRegistrosConteo: () =>
      Promise.resolve({ registros: [{ sku: 100010, sorteo: 8, cantidad_sistema: 9, cantidad_contada: 7, diferencia: -2 }] }),
  },
}));

function abrir(ruta: string) {
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <Inventario />
    </MemoryRouter>,
  );
}

describe('Paso 3: Inventario', () => {
  afterEach(cleanup);

  it('con ?sorteo=N arranca en lo contado en ese sorteo y el chip quita el filtro', async () => {
    abrir('/inventario?sorteo=8');
    expect(await screen.findByText(/Contadas en el sorteo 8 · 1/)).toBeTruthy();
    expect(screen.getByText('Ref 100010')).toBeTruthy();
    expect(screen.queryByText('Ref 100003')).toBeNull();
    expect(screen.getByText('9 → 7 (-2)')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Quitar el filtro del sorteo' }));
    expect(await screen.findByText('Ref 100003')).toBeTruthy();
    expect(screen.queryByText(/Contadas en el sorteo 8/)).toBeNull();
  });

  it('no repite los indicadores (están en Informes) y cierra con el botón a Informes', async () => {
    abrir('/inventario');
    await screen.findByText('Ref 100003');
    expect(screen.queryByText('Cumplimiento del año')).toBeNull();
    expect(screen.getByRole('link', { name: /Ver informes/ }).getAttribute('href')).toBe('/informes');
  });
});
