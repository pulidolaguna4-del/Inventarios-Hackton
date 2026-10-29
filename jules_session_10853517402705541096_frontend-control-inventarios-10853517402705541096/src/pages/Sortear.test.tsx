import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sortear } from './Sortear';
import { ProveedorProgreso } from '../hooks/ProgresoContexto';
import type { ResumenConteo, SorteoConteo } from '../types/inventario';

// Sorteo 7 de 3 referencias con 1 contada: quedan 2 pendientes.
const progreso = {
  sorteo_actual: 7,
  semana_actual: 44,
  cantidad_sorteo_por_defecto: 12,
  conteos_por_anio: 5,
  referencias_disponibles: 100,
  por_sortear: 500,
  conteos_totales: 615,
  periodos: [{ numero: 5, nombre: 'Oct–Dic' }],
  sorteos: [{ numero: 7, fecha_hora: '2026-10-29T08:46:19', periodo: 5, tamano: 3, registrados: 1, con_diferencia: 1 }],
} as unknown as ResumenConteo;

const fila = (sku: number, contada: boolean) => ({
  sku,
  descripcion: `Ref ${sku}`,
  categoria: 'Aire acondicionado',
  codigo_ubicacion: 'C1-F01-N1',
  contados: contada ? 1 : 0,
  tiene_diferencia: false,
  contada_en_sorteo: contada,
  registro_sorteo: contada
    ? { responsable: 'darwin', fecha: '2026-10-29', diferencia: 1, cantidad_contada: 10, cantidad_sistema: 9 }
    : null,
  cantidad_sistema_sugerida: 9,
});

const sorteo = {
  sorteo: 7,
  fecha_hora: '2026-10-29T08:46:19',
  periodo: 5,
  semilla: 1,
  tamano: 3,
  pendientes: 2,
  referencias: [fila(100003, true), fila(100010, false), fila(100020, false)],
} as unknown as SorteoConteo;

vi.mock('../services/api', () => ({
  api: {
    obtenerProgresoConteo: () => Promise.resolve(progreso),
    obtenerSorteo: () => Promise.resolve(sorteo),
    sortear: vi.fn(),
  },
}));

describe('Paso 1: Sortear', () => {
  it('bloquea el sorteo con pendientes, no tiene "Contar" y lleva al recorrido del sorteo', async () => {
    render(
      <MemoryRouter initialEntries={['/sortear']}>
        <ProveedorProgreso>
          <Sortear />
        </ProveedorProgreso>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Termina el sorteo 7 antes de sortear otro (2 pendientes).')).toBeTruthy();
    expect((screen.getByRole('button', { name: /Sortear 12 al azar/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Sortear de todas formas' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Contar/ })).toBeNull();

    const siguiente = await screen.findByRole('link', { name: /Ver recorrido del sorteo 7/ });
    expect(siguiente.getAttribute('href')).toBe('/recorrido?origen=sorteo&sorteo=7');
  });
});
