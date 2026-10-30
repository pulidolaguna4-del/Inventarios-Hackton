import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Inicio } from './Inicio';
import { ProveedorProgreso } from '../hooks/ProgresoContexto';

const progresoBase = {
  referencias: 123,
  conteos_por_anio: 5,
  conteos_totales: 615,
  conteos_registrados: 4,
  cumplimiento: 0.7,
  referencias_completas: 0,
  cantidad_sorteo_por_defecto: 12,
  periodo_actual: 5,
  periodos: [{ numero: 5, nombre: 'Oct–Dic', referencias_contadas: 4, referencias_totales: 123 }],
};
let progreso: Record<string, unknown> = {};

vi.mock('../services/api', () => ({
  api: {
    obtenerProgresoConteo: () => Promise.resolve(progreso),
    obtenerPickingPrueba: () => Promise.resolve({ metodo: 'exacto', totales: { distancia_m: 174.4, recorridos: 3 } }),
  },
}));

function abrir() {
  render(
    <MemoryRouter>
      <ProveedorProgreso>
        <Inicio />
      </ProveedorProgreso>
    </MemoryRouter>,
  );
}

describe('Portada', () => {
  afterEach(cleanup);

  it('muestra las cifras del año, la Tarea 6 y los 4 pasos', async () => {
    progreso = { ...progresoBase, sorteos: [] };
    abrir();
    expect(await screen.findByText('615')).toBeTruthy();
    expect(await screen.findByText('174,4 m')).toBeTruthy();
    for (const paso of ['Sortear', 'Recorrido y conteo', 'Inventario', 'Informes']) expect(screen.getByText(paso)).toBeTruthy();
  });

  it('sin sorteos, el botón principal lleva a sortear', async () => {
    progreso = { ...progresoBase, sorteos: [] };
    abrir();
    const boton = await screen.findByRole('link', { name: /Empezar: sortear qué contar/ });
    expect(boton.getAttribute('href')).toBe('/sortear');
  });

  it('con el último sorteo a medias, el botón principal lleva a contarlo en el recorrido', async () => {
    progreso = { ...progresoBase, sorteos: [{ numero: 1, fecha_hora: '2026-10-29T11:41:50', periodo: 5, tamano: 12, registrados: 4 }] };
    abrir();
    const boton = await screen.findByRole('link', { name: /Continuar: contar el sorteo 1/ });
    expect(boton.getAttribute('href')).toBe('/recorrido?origen=sorteo&sorteo=1');
    expect(screen.getByText(/faltan 8/)).toBeTruthy();
  });

  it('con el último sorteo completo, el botón principal lleva a sortear el siguiente', async () => {
    progreso = { ...progresoBase, sorteos: [{ numero: 1, fecha_hora: '2026-10-29T11:41:50', periodo: 5, tamano: 12, registrados: 12 }] };
    abrir();
    const boton = await screen.findByRole('link', { name: /Sortear el siguiente/ });
    expect(boton.getAttribute('href')).toBe('/sortear');
  });
});
