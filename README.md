# Inventarios — Hackatón Logístico SENA 2026

Sistema de inventarios para la bodega satélite de Arauca de *Distribuciones Centauros*: maestro de ubicaciones con
clasificación ABC, plan de conteo cíclico (cada referencia se cuenta exactamente 5 veces al año), estado de pedidos y
picking informativo de la Tarea 6.

## Carpetas

| Carpeta | Contenido |
|---|---|
| `inventarios/` | Backend en Python 3.8+ (solo librería estándar) y el frontend ya compilado en `static/` |
| `jules_session_..._frontend-control-inventarios-.../` | Código fuente del frontend (React + TypeScript + Vite) |
| `Documentacion/` | Contexto original del proyecto |

## Ejecutar

```bash
cd inventarios
python servidor.py                 # http://localhost:8000
python -m unittest discover tests  # pruebas del backend
```

Para modificar el frontend ver el `README.md` de su carpeta (`npm install`, `npm run dev`, `npm run build`).
Las decisiones y reglas del proyecto están en `inventarios/CLAUDE.md`.
