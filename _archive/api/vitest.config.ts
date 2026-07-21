import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    root: __dirname,
    include: ['tests/**/*.test.ts'],
    setupFiles: [path.resolve(__dirname, 'tests/setup.ts')],
    environment: 'node',
    env: {
      NODE_ENV: 'development',
      // Fallback values so tests work when run from monorepo root
      // (setup.ts loads .env but process.env may not yet have DATABASE_URL)
      DATABASE_URL: 'postgresql://postgres:password@localhost:5432/spaces?schema=public',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'change-me-in-production',
    },
    testTimeout: 15000,
    hookTimeout: 15000,
  },
})
