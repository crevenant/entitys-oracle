import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const pagesPath = process.env.PAGES_BASE_PATH?.replace(/\/+$/, '')

// https://vite.dev/config/
export default defineConfig({
  base: pagesPath ? `${pagesPath}/` : '/',
  plugins: [react()],
})
