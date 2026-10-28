# Frontend — Control de Inventarios, Bodega Arauca

Interfaz en React + TypeScript + Vite + Tailwind para el sistema de inventarios de la hackatón. Se conecta al backend
de Express (`../backend`), que es quien tiene las reglas del caso y los datos reales.

## Cómo se usa

### En la presentación
```bash
cd ../backend
npm start                 # http://localhost:8000
```
Express sirve la versión compilada que está en `backend/public/`.

### Para desarrollar
```bash
npm install               # solo la primera vez
# en otra terminal: cd ../backend && npm start
npm run dev               # http://localhost:5173 (las llamadas a /api se redirigen al puerto 8000)
```

### Antes de entregar o presentar
```bash
npm test                  # pruebas del cliente de la API
npm run lint
npm run build             # compila hacia ../backend/public/
```
Si no se corre `npm run build`, el servidor sigue mostrando la versión anterior.

## Estructura

```
src/
├── components/
│   ├── layout/       # Header, Sidebar, Layout
│   └── ui/           # DataTable, StatCard, Badge, Modal, Estados (carga/errores/avisos), ModalExportar
├── hooks/useApi.ts   # carga datos del backend con estado de carga y error
├── pages/            # Dashboard, Referencias, PlanConteo, RegistroConteos, Pedidos, Picking, Reportes
├── services/api.ts   # único lugar que llama al backend
├── types/inventario.ts  # tipos iguales al JSON del backend
└── utils/formato.ts
```

## Reglas que muestra (las calcula el backend)

- 123 referencias (112 con ventas + 11 nuevas), cada una se cuenta **exactamente 5 veces al año**.
- El plan anual se genera de una vez con una **semilla** (por defecto 2026): 43 semanas de 12 referencias y 9 de 11.
- Al registrar un conteo se guarda la cantidad en sistema, la contada y la diferencia. Con 5 conteos la referencia sale de la lista.
- Pedidos: Pendiente → En alistamiento → Alistado → En entrega → Entregado, solo hacia adelante.
- Picking: solo informativo (tiempo de cada trayecto de la Tarea 6 y cuál es el más demorado).

## Rutas de la API que usa

| Método | Ruta | Pantalla |
|---|---|---|
| GET | `/api/resumen` | Dashboard, Pedidos, Reportes |
| GET / POST | `/api/maestro`, `/api/maestro/generar` | Referencias, Dashboard |
| GET | `/api/conteo/progreso` | Dashboard, Plan, Registro, Reportes, encabezado |
| GET | `/api/conteo/semana/<n>` | Plan, Registro |
| GET | `/api/conteo/registros?sku=&semana=` | Historial de una referencia, Reportes |
| POST | `/api/conteo/registro` | Registro |
| POST | `/api/conteo/plan/generar` | Plan (409 si ya hay conteos; se reintenta con `forzar`) |
| GET / POST | `/api/pedidos?fecha=`, `/api/pedidos/<id>/estado` | Pedidos |
| GET | `/api/picking/prueba` | Picking |
| GET | `/api/exportar/<tipo>?nombre=` | Reportes |
