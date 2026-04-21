import { defineConfig, globalIgnores } from 'eslint/config'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import prettier from 'eslint-plugin-prettier'

const eslintConfig = defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,
  globalIgnores(['**/node_modules/**', '**/.next/**']),
  {
    files: ['./src/**/*.{js,jsx,ts,tsx}'],
    plugins: {
      prettier
    },
    rules: {
      'prettier/prettier': [
        'error',
        {
          printWidth: 100,
          tabWidth: 2,
          semi: false,
          singleQuote: true,
          trailingComma: 'none',
          plugins: ['prettier-plugin-tailwindcss']
        }
      ],
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/use-memo': 'off'
    },
    settings: {
      react: { version: 'detect' }
    }
  }
])

export default eslintConfig
