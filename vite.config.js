import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'mpa-rewrite',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url.split('?')[0]
          if (url.startsWith('/platform'))   req.url = '/platform.html'
          if (url.startsWith('/supervisor')) req.url = '/supervisor.html'
          if (url.startsWith('/agent'))      req.url = '/agent.html'
          next()
        })
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        platform: path.resolve(__dirname, 'platform.html'),
        supervisor: path.resolve(__dirname, 'supervisor.html'),
        agent: path.resolve(__dirname, 'agent.html'),
      },
    },
  },
})
