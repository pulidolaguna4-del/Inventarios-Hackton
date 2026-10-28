import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { ConteoAlAzar } from './pages/ConteoAlAzar';
import { ConteosAnio } from './pages/ConteosAnio';
import { Referencias } from './pages/Referencias';
import { Pedidos } from './pages/Pedidos';
import { Reportes } from './pages/Reportes';
import { useApi } from './hooks/useApi';
import { api } from './services/api';
import { Cargando } from './components/ui/Estados';

// El mapa 3D (three.js) se carga aparte, solo al abrir esa pantalla.
const Picking = lazy(() => import('./pages/Picking').then((modulo) => ({ default: modulo.Picking })));

export function App() {
  // La semana actual y el último sorteo salen del backend; si falla, se muestra "sin conexión".
  const { datos: progreso, error } = useApi(api.obtenerProgresoConteo);

  return (
    <BrowserRouter>
      <Layout
        semanaActual={progreso?.semana_actual ?? null}
        sorteoActual={progreso?.sorteo_actual ?? null}
        conectado={error === null}
      >
        <Routes>
          <Route path="/" element={<ConteoAlAzar />} />
          <Route path="/conteos-anio" element={<ConteosAnio />} />
          <Route path="/referencias" element={<Referencias />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route
            path="/picking"
            element={
              <Suspense fallback={<Cargando texto="Cargando el mapa 3D..." />}>
                <Picking />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
