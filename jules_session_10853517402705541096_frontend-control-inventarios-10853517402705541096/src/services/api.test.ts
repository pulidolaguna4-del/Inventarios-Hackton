import { describe, it, expect, vi, afterEach } from 'vitest';
import { api, ErrorApi, pedirJson } from './api';

/** Simula fetch con una respuesta JSON y un código HTTP (una respuesta nueva en cada llamada). */
function simularFetch(cuerpo: unknown, codigo = 200) {
  const fetchFalso = vi.fn().mockImplementation(
    async () => new Response(JSON.stringify(cuerpo), { status: codigo, headers: { 'Content-Type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', fetchFalso);
  return fetchFalso;
}

describe('Cliente de la API del backend', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('devuelve el JSON cuando la respuesta es correcta', async () => {
    simularFetch({ referencias_totales: 123 });
    const resumen = await api.obtenerResumen();
    expect(resumen.referencias_totales).toBe(123);
  });

  it('convierte {"error": ...} del backend en un ErrorApi con su código', async () => {
    simularFetch({ error: 'La referencia 1 ya se contó en el sorteo 1' }, 400);
    const promesa = pedirJson('/api/conteo/registro');
    await expect(promesa).rejects.toBeInstanceOf(ErrorApi);
    await expect(pedirJson('/api/conteo/registro')).rejects.toMatchObject({
      codigo: 400,
      message: 'La referencia 1 ya se contó en el sorteo 1',
    });
  });

  it('avisa claramente cuando el servidor no está corriendo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api.obtenerResumen()).rejects.toMatchObject({ codigo: 0 });
  });

  it('registra un conteo con POST y cuerpo JSON', async () => {
    const fetchFalso = simularFetch({ mensaje: 'Conteo registrado', registro: { sku: 400016, diferencia: 0 } });
    await api.registrarConteo({ sorteo: 1, sku: 400016, responsable: 'Ana', cantidad_contada: 10 });

    const [ruta, opciones] = fetchFalso.mock.calls[0];
    expect(ruta).toBe('/api/conteo/registro');
    expect(opciones.method).toBe('POST');
    expect(JSON.parse(opciones.body)).toEqual({ sorteo: 1, sku: 400016, responsable: 'Ana', cantidad_contada: 10 });
  });

  it('sortea enviando la cantidad; el 409 llega como ErrorApi para poder pedir "forzar"', async () => {
    const fetchFalso = simularFetch({ error: 'Al sorteo 1 le faltan 3 referencias por contar.' }, 409);
    await expect(api.sortear(56)).rejects.toMatchObject({ codigo: 409 });
    expect(fetchFalso.mock.calls[0][0]).toBe('/api/conteo/sorteo');
    expect(JSON.parse(fetchFalso.mock.calls[0][1].body)).toEqual({ cantidad: 56, forzar: false });
  });

  it('arma los parámetros de consulta solo con los valores que vienen', async () => {
    const fetchFalso = simularFetch({ registros: [] });
    await api.obtenerRegistrosConteo({ sku: 400016 });
    expect(fetchFalso.mock.calls[0][0]).toBe('/api/conteo/registros?sku=400016');

    await api.obtenerRegistrosConteo();
    expect(fetchFalso.mock.calls[1][0]).toBe('/api/conteo/registros');
  });

  it('avanza un pedido enviando el estado siguiente', async () => {
    const fetchFalso = simularFetch({ id_pedido: 7, estado: 'En alistamiento', siguiente_estado: 'Alistado', historial: [] });
    await api.avanzarPedido(7, 'En alistamiento');
    const [ruta, opciones] = fetchFalso.mock.calls[0];
    expect(ruta).toBe('/api/pedidos/7/estado');
    expect(JSON.parse(opciones.body)).toEqual({ estado: 'En alistamiento' });
  });
});
