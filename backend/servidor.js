// Servidor del sistema de inventarios.
//
// Uso:
//   npm start      (o: node servidor.js)
//
// Carga el Excel en memoria y deja la API y el frontend en http://localhost:8000.

import { crearApp } from './src/app.js';
import { cargarDatos } from './src/datos.js';
import { PUERTO_SERVIDOR } from './src/config.js';

const inicio = Date.now();
await cargarDatos();
console.log(`Datos cargados en ${((Date.now() - inicio) / 1000).toFixed(1)} s`);

crearApp().listen(PUERTO_SERVIDOR, () => {
  console.log(`Servidor listo en http://localhost:${PUERTO_SERVIDOR}  (Ctrl+C para detener)`);
});
