import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // En desarrollo (npm run dev) las llamadas a /api van al backend de Python.
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  build: {
    // `npm run build` deja la página lista dentro del backend, que la sirve en http://localhost:8000.
    outDir: '../inventarios/static',
    emptyOutDir: true,
  },
})
