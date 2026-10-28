# Inventarios — Hackatón Logístico SENA 2026

Sistema de inventarios para la bodega satélite de Arauca de *Distribuciones Centauros*: conteo cíclico aleatorio
(cada referencia se cuenta exactamente 5 veces al año, con su responsable), vista anual de los conteos, pedidos,
reportes y el picking de la Tarea 6 para el robot Arduino.

## Carpetas

| Carpeta | Contenido |
|---|---|
| `backend/` | API en **Node.js + Express**. También sirve el frontend ya compilado en `backend/public/` |
| `jules_session_..._frontend-control-inventarios-.../` | Código fuente del frontend (**React** + TypeScript + Vite) |
| `inventarios/` | Versión anterior del backend en Python (ya no se usa) y documentos del caso en `inventarios/docs/` |
| `Documentacion/` | Contexto original del proyecto |

## Ejecutar

```bash
cd backend
npm install        # solo la primera vez
npm start          # http://localhost:8000
npm test           # pruebas del backend
```

Para modificar el frontend, ver el `README.md` de su carpeta (`npm install`, `npm run dev`, `npm run build`).
Las decisiones y reglas del proyecto están en `backend/CLAUDE.md`.
