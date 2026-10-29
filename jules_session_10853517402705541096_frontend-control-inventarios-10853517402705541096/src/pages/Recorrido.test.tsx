import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Recorrido } from './Recorrido';
import { ProveedorProgreso } from '../hooks/ProgresoContexto';

// Sin WebGL (y sin three.js en las pruebas): la pantalla debe mostrar el aviso, la tabla y el conteo.
vi.mock('../components/mapa/constantes', async (original) => ({
  ...(await original<typeof import('../components/mapa/constantes')>()),
  soportaWebGL: () => false,
}));
vi.mock('../components/mapa/Escena3D', () => ({ Escena3D: () => null }));

const tramo = { tipo: 'tramo', tipo_tramo: 'pasillo', punto_inicio: { x: 0, y: 0 }, punto_fin: { x: 0, y: 2 }, distancia_m: 2, distancia_acum_inicio_m: 0, distancia_acum_fin_m: 2, tiempo_inicio_s: 0, tiempo_fin_s: 2 };
const parada = (orden: number) => ({ tipo: 'parada', orden, etiqueta: String(orden), niveles: [1], ubicaciones: [], punto: { x: 0, y: 2 }, tiempo_recogida_s: 20, distancia_acum_m: 2, tiempo_inicio_s: 2, tiempo_fin_s: 22 });
const item = (sku: number, codigo: string) => ({ sku, descripcion: `Ref ${sku}`, nivel: 1, codigo_ubicacion: codigo, cantidad: null, cantidad_sistema: 9 });

// El recorrido visita primero 200011 y después 100003, aunque el sorteo los lista al revés.
const picking = {
  origen: 'sorteo',
  metodo: 'exacto',
  sorteo: 8,
  recorridos: [
    {
      recorrido: 1, salida_inicio: 'DER', salida_fin: 'DER', distancia_m: 4, tiempo_desplazamiento_s: 4, tiempo_recogida_s: 40, tiempo_total_s: 44, es_el_mas_demorado: true,
      paradas: [
        { numero_plano: 50, niveles: [1], items: [item(200011, 'C5-F02-N1')] },
        { numero_plano: 52, niveles: [1], items: [item(100003, 'C5-F01-N1')] },
      ],
      trazado: { eventos: [tramo, parada(1), parada(2)], distancia_m: 4, tiempo_total_s: 44 },
      tiempo_inicio_global_s: 0, tiempo_fin_global_s: 44,
    },
  ],
  totales: { recorridos: 1, ubicaciones: 2, distancia_m: 4, tiempo_desplazamiento_s: 4, tiempo_recogida_s: 40, tiempo_total_s: 44, velocidad_m_s: 1, tiempo_recogida_nivel_1_s: 20 },
};

const sorteo = {
  sorteo: 8, fecha_hora: '2026-10-29T09:44:29', periodo: 5, semilla: 1, tamano: 2, pendientes: 2,
  referencias: [100003, 200011].map((sku) => ({ sku, contada_en_sorteo: false, registro_sorteo: null, cantidad_sistema_sugerida: 9 })),
};

const registrarConteo = vi.fn();

vi.mock('../services/api', () => ({
  api: {
    obtenerProgresoConteo: () => Promise.resolve({ sorteo_actual: 8, sorteos: [{ numero: 8, tamano: 2, registrados: 0 }] }),
    obtenerLayout: () => Promise.resolve({ nombre: 'Bodega Arauca' }),
    obtenerRecorridos: () => Promise.resolve(picking),
    obtenerSorteo: () => Promise.resolve(sorteo),
    obtenerResumen: () => Promise.resolve(null),
    obtenerInstruccionesRobot: () => new Promise(() => {}),
    registrarConteo: (...argumentos: unknown[]) => registrarConteo(...argumentos),
  },
}));

function abrir(ruta = '/recorrido?origen=sorteo&sorteo=8') {
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorProgreso>
        <Recorrido />
      </ProveedorProgreso>
    </MemoryRouter>,
  );
}

describe('Paso 2: Recorrido y conteo', () => {
  afterEach(cleanup);

  beforeEach(() => {
    localStorage.setItem('inventarios_responsable', 'darwin');
    registrarConteo.mockReset();
  });

  it('sin WebGL muestra el aviso, el método, la tabla y el conteo en el orden del recorrido', async () => {
    abrir();
    expect(await screen.findByText(/no puede dibujar gráficos 3D/)).toBeTruthy();
    expect(screen.getByText(/método: exacto · 2 paradas · 1 recorridos/)).toBeTruthy();
    expect(screen.getByText('Trayectos · Bodega Arauca')).toBeTruthy();
    const campos = await screen.findAllByLabelText(/Cantidad contada de/);
    expect(campos.map((campo) => campo.getAttribute('aria-label'))).toEqual(['Cantidad contada de 200011', 'Cantidad contada de 100003']);
  });

  it('Enter guarda el conteo con el responsable y pasa el foco a la fila siguiente', async () => {
    registrarConteo.mockResolvedValue({ registro: { sku: 200011, cantidad_sistema: 9, cantidad_contada: 7, diferencia: -2, responsable: 'darwin' } });
    abrir();
    const [primero, segundo] = await screen.findAllByLabelText(/Cantidad contada de/);
    fireEvent.change(primero, { target: { value: '7' } });
    fireEvent.keyDown(primero, { key: 'Enter' });
    await waitFor(() => expect(registrarConteo).toHaveBeenCalledWith({ sorteo: 8, sku: 200011, responsable: 'darwin', cantidad_contada: 7, cantidad_sistema: 9 }));
    expect(await screen.findByText(/diferencia -2/)).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(segundo));
  });

  it('en la vista maqueta, el origen sorteo muestra un aviso en vez de un recorrido vacío', async () => {
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Maqueta' }));
    expect(await screen.findByText(/solo tiene las 11 referencias nuevas/)).toBeTruthy();
  });
});
