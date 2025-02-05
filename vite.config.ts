import { vitePlugin as remix } from '@remix-run/dev';
import { viteCommonjs } from '@originjs/vite-plugin-commonjs'
import { vercelPreset } from '@vercel/remix/vite';
import UnoCSS from 'unocss/vite';
import { defineConfig, type ViteDevServer } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import tsconfigPaths from 'vite-tsconfig-paths';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';

dotenv.config();

// Get git hash with fallback
const getGitHash = () => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'no-git-info';
  }
};




export default defineConfig((config) => {
  return {
    define: {
      __COMMIT_HASH: JSON.stringify(getGitHash()),
      __APP_VERSION: JSON.stringify(import.meta.env.npm_package_version),
      // 'import.meta.env': JSON.stringify(import.meta.env)
    },
    build: {
      target: 'esnext',
      sourcemap: true, // Enable source maps in production build
      rollupOptions: {
        output: {
          sourcemapExcludeSources: true, // Include source content in the map
        },
      },
    },
    plugins: [
      nodePolyfills({
        include: ['path', 'buffer', 'process'],
      }),
      remix({
        buildDirectory: "build",
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
          v3_lazyRouteDiscovery: true
        },
        presets: [vercelPreset()]
      }),
      UnoCSS(),
      tsconfigPaths(),
      viteCommonjs(),
      chrome129IssuePlugin(),
      config.mode === 'production' && optimizeCssModules({ apply: 'build' }),
    ],
    optimizeDeps: {
      include: ['react-dom'],
      // Not excluding these seem to:
      //   a) always force a refresh after initial load: https://github.com/vitejs/vite/discussions/14801)
      //   b) optimize an old version!
      exclude: [
        '@hanzo/ui/primitives-common',
        '@hanzo/ui/util',
      ]
    },
    // https://github.com/remix-run/remix/issues/10156#issuecomment-2440234744
    server: {
      warmup: {
        clientFiles: ['app/**/*.tsx'],
      },
    },
    envPrefix: [
      "VITE_",
      "OPENAI_LIKE_API_BASE_URL",
      "OLLAMA_API_BASE_URL",
      "LMSTUDIO_API_BASE_URL",
      "TOGETHER_API_BASE_URL",
      "ANTHROPIC_API_KEY",
      "OPENAI_API_KEY",
      "GROQ_API_KEY",
      "HUGGINGFACE_API_KEY",
      "OPEN_ROUTER_API_KEY",
      "OPENAI_LIKE_API_KEY",
      "TOGETHER_API_KEY",
      "DEEPSEEK_API_KEY",
      "GOOGLE_GENERATIVE_AI_API_KEY",
      "MISTRAL_API_KEY",
      "XAI_API_KEY",
      "PERPLEXITY_API_KEY",
      "AWS_BEDROCK_CONFIG",
      "RUNNING_IN_DOCKER",
      "DEFAULT_NUM_CTX"
    ],
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
        },
      },
    },
  };
});

function chrome129IssuePlugin() {
  return {
    name: 'chrome129IssuePlugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const raw = req.headers['user-agent']?.match(/Chrom(e|ium)\/([0-9]+)\./);

        if (raw) {
          const version = parseInt(raw[2], 10);

          if (version === 129) {
            res.setHeader('content-type', 'text/html');
            res.end(
              '<body><h1>Please use Chrome Canary for testing.</h1><p>Chrome 129 has an issue with JavaScript modules & Vite local development, see <a href="https://github.com/hanzo/canvas/issues/86#issuecomment-2395519258">for more information.</a></p><p><b>Note:</b> This only impacts <u>local development</u>. `pnpm run build` and `pnpm run start` will work fine in this browser.</p></body>',
            );

            return;
          }
        }

        next();
      });
    },
  };
}


