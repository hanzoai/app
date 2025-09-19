import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ["@hanzo/ui"],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  swcMinify: true,
  modularizeImports: {
    '@hanzo/ui': {
      transform: '@hanzo/ui/primitives/{{member}}',
      skipDefaultConversion: true,
    },
  },
  webpack(config, options) {
    const { isServer, dev } = options;

    // Fix utils import issue
    config.resolve.alias = {
      ...config.resolve.alias,
      '../../../app/lib/utils': path.resolve(__dirname, 'lib/utils.ts'),
    };

    // Add a custom rule to handle TypeScript files in @hanzo/ui using swc-loader
    config.module.rules.unshift({
      test: /\.(tsx?|jsx?)$/,
      include: /node_modules[\\/]@hanzo[\\/]ui/,
      use: [
        {
          loader: 'swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
                tsx: true,
                decorators: false,
                dynamicImport: true,
              },
              transform: {
                react: {
                  runtime: 'automatic',
                  pragmaFrag: 'React.Fragment',
                  throwIfNamespace: true,
                  development: dev,
                  useBuiltins: true,
                },
              },
              target: 'es2020',
            },
            module: {
              type: isServer ? 'commonjs' : 'es6',
            },
          },
        },
      ],
    });

    // Ensure other rules don't process @hanzo/ui
    config.module.rules.forEach((rule: any, index: number) => {
      if (index === 0) return; // Skip our custom rule

      if (rule.oneOf) {
        rule.oneOf = rule.oneOf.map((oneOfRule: any) => {
          if (oneOfRule.test && oneOfRule.test.toString().includes('tsx')) {
            if (!oneOfRule.exclude) {
              oneOfRule.exclude = [];
            }
            if (Array.isArray(oneOfRule.exclude)) {
              oneOfRule.exclude.push(/node_modules[\\/]@hanzo[\\/]ui/);
            } else {
              oneOfRule.exclude = [oneOfRule.exclude, /node_modules[\\/]@hanzo[\\/]ui/];
            }
          }
          return oneOfRule;
        });
      }
    });

    // Audio files loader
    config.module.rules.push({
      test: /\.(ogg|mp3|wav|mpe?g)$/i,
      type: 'asset/resource',
      generator: {
        filename: 'static/media/[name].[hash][ext]',
      },
    });

    return config;
  },
  images: {
    remotePatterns: [new URL('https://huggingface.co/**')],
  },
};

export default nextConfig;