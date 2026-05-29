import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Vite 8 minifies with OXC. Strip console.* and debugger from the production
    // bundle (rolldownOptions.output only applies to `vite build`, not dev).
    rolldownOptions: {
      output: {
        minify: { compress: { dropConsole: true, dropDebugger: true }, mangle: true },
        // Split large, stable vendor code into separate cacheable chunks so app
        // edits don't force users to re-download Firebase/React on every deploy.
        codeSplitting: {
          groups: [
            { name: 'firebase', test: /[\\/]node_modules[\\/](@firebase|firebase)[\\/]/ },
            { name: 'react-vendor', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
})
