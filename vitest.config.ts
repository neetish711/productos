import { defineConfig } from 'vitest/config'
import path from 'path'

// AUDIT S4-ci: unit test runner. Pure-logic tests (permissions, validators) run
// without a DB; add jsdom + setup later for component tests if needed.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
