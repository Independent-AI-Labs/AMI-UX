import { FlatCompat } from '@eslint/eslintrc'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'public/vendor/**',
      'public/js/highlight-plugin/**',
      'public/js/lib/**',
      'extension/highlight-plugin/pkg/**',
    ],
  },
  ...compat.config({
    extends: ['next/core-web-vitals'],
    rules: {
      'no-unused-vars': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  }),
]

export default config
