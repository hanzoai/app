import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

// Two projects. `unit` is every test as it was: plain modules, and components drawn with the kit
// stood in. `gui` (`*.gui.test.tsx`) draws the REAL kit — @hanzo/ui over @hanzo/gui on
// react-native-web, as a browser does — so focus, Escape and stacking are the kit's own, not a mock's.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          setupFiles: ['./vitest.setup.ts'],
          exclude: ['**/node_modules/**', '**/dist/**', '**/*.gui.test.tsx'],
        },
      },
      {
        ssr: { resolve: { conditions: ['browser', 'module', 'import', 'default'], externalConditions: ['browser', 'module', 'import'] } },
        resolve: {
          conditions: ['browser', 'module', 'import', 'default'],
          mainFields: ['module', 'browser', 'main'],
          alias: [
            // One copy of React and gui, this package's, for the kit and the code under test alike.
            { find: /^(react|react-dom|@hanzo\/gui)(\/.*)?$/, replacement: `${here('./node_modules/')}$1$2` },
            // A native-only helper react-native-web does not ship; on the web a component's name is all it returns.
            { find: /^react-native\/Libraries\/Utilities\/codegenNativeComponent(\.js)?$/, replacement: here('./vitest.codegen.js') },
            { find: /^react-native$/, replacement: 'react-native-web' },
          ],
        },
        test: {
          name: 'gui',
          include: ['src/**/*.gui.test.tsx'],
          environment: 'happy-dom',
          // Each test draws the real kit; a loaded CI runner takes more than the default 5 s for one turn.
          testTimeout: 30_000,
          setupFiles: ['./vitest.setup.ts', './vitest.gui.ts'],
          server: { deps: { inline: [/@hanzo\//, /@hanzogui\//, /react-native/] } },
        },
      },
    ],
  },
})
