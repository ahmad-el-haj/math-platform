import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Keep the heavy, rarely changing libraries in their own chunks so a
        // code change in the application does not invalidate them.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react-pdf') || id.includes('pdfjs-dist')) return 'pdf'
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('@tanstack')) return 'query'
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('react-router')) {
            return 'react'
          }
          return undefined
        },
      },
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'app',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./tests/setup.ts'],
          include: ['tests/app/**/*.test.{ts,tsx}'],
          css: false,
          restoreMocks: true,
          // The application refuses to boot without these two variables, so the
          // test environment declares public placeholders.
          env: {
            VITE_SUPABASE_URL: 'https://fake-project.supabase.co',
            VITE_SUPABASE_ANON_KEY: 'fake-anon-key-for-tests',
          },
        },
      },
      {
        extends: true,
        test: {
          name: 'db',
          environment: 'node',
          globals: true,
          include: ['tests/db/**/*.test.ts'],
          testTimeout: 60_000,
          hookTimeout: 120_000,
          // The suite owns a dedicated database; files must not run in parallel.
          fileParallelism: false,
        },
      },
    ],
  },
})
