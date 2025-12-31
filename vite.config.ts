import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite";


// https://vite.dev/config/
export default defineConfig({
  // Base path for GitHub Pages (set to '/' for custom domain or '/<repo-name>/' for username.github.io/repo)
  base: process.env.GITHUB_ACTIONS ? '/sharedrop' : '/',
  plugins: [react(), tailwindcss()],
})
