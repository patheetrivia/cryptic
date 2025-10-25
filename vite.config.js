import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    optimizeDeps: {
        force: true, // force re-bundling on every dev start
    },
    base: '/cryptic/',
    plugins: [react(), tailwindcss()],
})
