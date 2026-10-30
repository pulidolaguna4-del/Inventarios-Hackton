import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Redirigir } from './components/layout/Redirigir';
import { Inicio } from './pages/Inicio';
import { Sortear } from './pages/Sortear';
import { Inventario } from './pages/Inventario';
import { Pedidos } from './pages/Pedidos';
import { Informes } from './pages/Informes';
import { ProveedorProgreso, useProgreso } from './hooks/ProgresoContexto';
import { Cargando } from './components/ui/Estados';

// El mapa 3D (three.js) se carga aparte, solo al abrir esa pantalla.
const Recorrido = lazy(() => import('./pages/Recorrido').then((modulo) => ({ default: modulo.Recorrido })));

function Rutas() {
  // La semana actual y el último sorteo salen del backend; si falla, se muestra "sin conexión".
  const { datos: progreso, error } = useProgreso();

  return (
    <Layout
      semanaActual={progreso?.semana_actual ?? null}
      sorteoActual={progreso?.sorteo_actual ?? null}
      conectado={error === null}
    >
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/sortear" element={<Sortear />} />
        <Route
          path="/recorrido"
          element={
            <Suspense fallback={<Cargando texto="Cargando el mapa 3D..." />}>
              <Recorrido />
            </Suspense>
          }
        />
        <Route path="/inventario" element={<Inventario />} />
        <Route path="/informes" element={<Informes />} />
        {/* Fuera de la barra: se abre desde el origen "Pedidos del día" del Paso 2. */}
        <Route path="/pedidos" element={<Pedidos />} />

        {/* Rutas viejas, para no romper enlaces guardados. */}
        <Route path="/conteos-anio" element={<Redirigir to="/inventario" extra={{ vista: 'anio' }} />} />
        <Route path="/referencias" element={<Redirigir to="/inventario" />} />
        <Route path="/reportes" element={<Redirigir to="/informes" />} />
        <Route path="/picking" element={<Redirigir to="/recorrido" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ProveedorProgreso>
        <Rutas />
      </ProveedorProgreso>
    </BrowserRouter>
  );
}

export default App;
