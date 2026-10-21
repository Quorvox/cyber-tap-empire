import { defineConfig } from 'vite'

export default defineConfig({
  // относительные пути, чтобы работало и на GitHub Pages в подпапке
  base: './',
  server: { host: true, port: 5173 },
  build: { outDir: 'dist' }
})
