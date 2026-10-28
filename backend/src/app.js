// Aplicación Express: la API en /api y el frontend React compilado (public/) en lo demás.

import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { ErrorApi, rutasApi } from './rutas.js';
import { DIR_PUBLICO } from './config.js';

export function crearApp() {
  const app = express();

  app.use(express.json());
  // Los datos cambian con cada conteo: el navegador no debe guardar respuestas viejas.
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', rutasApi);

  // Frontend compilado. Las rutas de la página (ej. /pedidos) devuelven index.html
  // para que las maneje React Router.
  app.use(express.static(DIR_PUBLICO));
  app.use((req, res, next) => {
    const indice = path.join(DIR_PUBLICO, 'index.html');
    if (req.method !== 'GET' || path.extname(req.path) || !fs.existsSync(indice)) return next();
    res.sendFile(indice);
  });
  app.use((req, res) => {
    res.status(404).json({ error: `No existe: ${req.path}. ¿Ya se compiló el frontend con npm run build?` });
  });

  app.use(manejarError);
  return app;
}

/**
 * Convierte cualquier error en una respuesta {"error": mensaje}.
 * - ErrorApi: trae su propio código HTTP.
 * - Error de validación de los módulos (Error simple) o JSON mal formado: 400.
 * - Cualquier otro fallo inesperado: 500, sin tumbar el servidor.
 */
// eslint-disable-next-line no-unused-vars
function manejarError(error, req, res, next) {
  if (error instanceof ErrorApi) return res.status(error.codigo).json({ error: error.message });
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la petición no es un JSON válido' });
  }
  if (error.constructor === Error) return res.status(400).json({ error: error.message });
  console.error('Error interno:', error);
  res.status(500).json({ error: `Error interno: ${error.message}` });
}
