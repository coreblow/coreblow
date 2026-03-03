import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5174
    },
    resolve: {
        alias: {
            'react': path.resolve('./node_modules/react'),
            'react-dom': path.resolve('./node_modules/react-dom'),
        },
        dedupe: ['react', 'react-dom']
    },
    optimizeDeps: {
        include: ['@splinetool/react-spline', '@splinetool/runtime']
    }
})
