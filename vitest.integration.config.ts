import { createVitestConfig } from './vitest.shared.ts'

export default createVitestConfig({
  include: ['./test/integration/**/*.{test,spec}.ts'],
})
