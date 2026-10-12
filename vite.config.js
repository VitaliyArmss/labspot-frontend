import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isGitHubPagesBuild = process.env.GITHUB_PAGES === 'true'

export default defineConfig({
  base: isGitHubPagesBuild ? '/labspot-frontend/' : '/',
  plugins: [react()],
  server: { port: 5173, host: '0.0.0.0' },
  preview: { host: '0.0.0.0' },
})
