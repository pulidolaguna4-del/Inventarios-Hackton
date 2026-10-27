import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Referencias } from './pages/Referencias';
import { PlanConteo } from './pages/PlanConteo';
import { RegistroConteos } from './pages/RegistroConteos';
import { Pedidos } from './pages/Pedidos';
import { Picking } from './pages/Picking';
import { Reportes } from './pages/Reportes';
import { useApi } from './hooks/useApi';
import { api } from './services/api';

export function App() {
  // La semana actual y la semilla del plan salen del backend; si falla, se muestra "sin conexión".
  const { datos: progreso, error } = useApi(api.obtenerProgresoConteo);

  return (
    <BrowserRouter>
      <Layout
        semanaActual={progreso?.semana_actual ?? null}
        semilla={progreso?.semilla ?? null}
        conectado={error === null}
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/referencias" element={<Referencias />} />
          <Route path="/plan-conteo" element={<PlanConteo />} />
          <Route path="/registro-conteos" element={<RegistroConteos />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/picking" element={<Picking />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
