import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.js'],
    include: ['test/**/*.test.{js,mjs}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['scripts/**/*.js'],
      exclude: [
        'scripts/quench.js',
        'scripts/mobAttack.js',
        'scripts/macroObject.js',
        'scripts/versions.js',
      ],
    },
  },
})
