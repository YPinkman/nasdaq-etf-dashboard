import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/eastmoney': {
        target: 'https://push2.eastmoney.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/eastmoney/, ''),
      },
      '/haoetf': {
        target: 'https://www.haoetf.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/haoetf/, ''),
      },
    },
  },
})
