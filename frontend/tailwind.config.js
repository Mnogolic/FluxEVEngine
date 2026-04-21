import { theme } from '@teach-in/react'

const config = {
  content: [
    './src/**/*.{js,jsx,ts,tsx,mdx}',
    './node_modules/@teach-in/react/dist/**/*.{js,ts,jsx,tsx}',
    './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}'
  ],
  darkMode: 'class',
  theme: {
    extend: {}
  },
  plugins: [theme]
}

export default config
