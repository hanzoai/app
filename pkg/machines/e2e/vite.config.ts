import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// react-native is react-native-web, and react-native-svg is its web build: the
// native one is Flow source, which is what hanzo.ai's own bundler config avoids too.
const need = createRequire(import.meta.url)
const svg = join(dirname(need.resolve('react-native-svg/package.json')), 'lib/module/ReactNativeSVG.web.js')

export default defineConfig({
  root: 'e2e/harness',
  resolve: {
    alias: [
      { find: /^react-native$/, replacement: 'react-native-web' },
      { find: /^react-native-svg$/, replacement: svg },
      { find: /^react-native\/Libraries\/.*$/, replacement: fileURLToPath(new URL('./harness/native.ts', import.meta.url)) },
      { find: '@react-native/assets-registry/registry', replacement: 'react-native-web/dist/modules/AssetRegistry' },
    ],
    extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
    dedupe: ['react', 'react-dom', '@hanzo/gui'],
  },
  // The web build of a file before its native twin, as hanzo.ai's resolveExtensions say.
  optimizeDeps: { rolldownOptions: { resolve: { extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'] } } },
  define: { 'process.env.NODE_ENV': '"development"', 'process.env.TAMAGUI_TARGET': '"web"' },
  server: { port: 4177, strictPort: true },
})
