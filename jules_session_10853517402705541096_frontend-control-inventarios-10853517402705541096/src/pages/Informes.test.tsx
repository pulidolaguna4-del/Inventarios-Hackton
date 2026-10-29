import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Informes } from './Informes';
import { ARCHIVOS_ENTREGA } from '../utils/entregas';

const descargarReporte = vi.fn().mockResolvedValue('Día2_Ejercicio6.xlsx');

vi.mock('../services/api', () => ({
  api: {
    obtenerProgresoConteo: () =>
      Promise.resolve({
        cumplimiento: 2.3, conteos_registrados: 14, conteos_totales: 615, conteos_sorteados: 108, pendientes_por_contar: 94,
        referencias: 123, conteos_por_anio: 5, referencias_completas: 0, referencias_con_diferencia: 3, sorteos: [{}, {}],
        verificacion: { valido: true, completo: false, referencias: 123, minimo_por_referencia: 0, maximo_por_referencia: 2, errores: [] },
      }),
    obtenerRegistrosConteo: () => Promise.resolve({ registros: [{ diferencia: 1 }, { diferencia: 0 }] }),
    obtenerResumen: () => Promise.resolve({ fechas_disponibles: ['2018-01-02'] }),
    descargarReporte: (...argumentos: unknown[]) => descargarReporte(...argumentos),
  },
}));

describe('Paso 4: Informes', () => {
  afterEach(cleanup);

  it('los nombres de entrega son exactos, con la í compuesta (NFC)', () => {
    expect(ARCHIVOS_ENTREGA.map((archivo) => archivo.nombre)).toEqual(['Día2_Ejercicio1', 'Día2_Ejercicio6', 'Día2_Ejercicio8']);
    expect(ARCHIVOS_ENTREGA.every((archivo) => archivo.nombre === archivo.nombre.normalize('NFC') && archivo.nombre.includes('í'))).toBe(true);
  });

  it('muestra el cumplimiento en grande, la verificación y descarga con el nombre exacto', async () => {
    render(<Informes />);
    expect(await screen.findByText('2.3%')).toBeTruthy();
    expect(screen.getByText(/Verificado: ninguna referencia se repite/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Día2_Ejercicio6\.xlsx/ }));
    await waitFor(() => expect(descargarReporte).toHaveBeenCalledWith('picking', 'Día2_Ejercicio6', {}));
    expect(await screen.findByText(/Descargado Día2_Ejercicio6\.xlsx/)).toBeTruthy();
  });
});
