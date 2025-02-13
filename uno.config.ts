import { globSync } from 'fast-glob';
import fs from 'node:fs/promises';
import { basename } from 'node:path';
import { defineConfig, presetIcons, presetUno, transformerDirectives } from 'unocss';

const iconPaths = globSync('./icons/*.svg');
const collectionName = 'hanzo';

const customIconCollection = iconPaths.reduce(
  (acc, iconPath) => {
    const [iconName] = basename(iconPath).split('.');
    acc[collectionName] ??= {};
    acc[collectionName][iconName] = async () => {
      const data = await fs.readFile(iconPath, { encoding: 'utf8' });
      // Ensure the result is a string, even if the type definitions return a Buffer.
      return typeof data === 'string' ? data : (data as any).toString('utf8');
    };
    return acc;
  },
  {} as Record<string, Record<string, () => Promise<string>>>,
);

const BASE_COLORS = {
  white: '#FFFFFF',
  gray: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0A0A0A',
  },
  accent: {
    50: '#a2a0a3',
    100: '#999799',
    200: '#8f8d8f',
    300: '#858385',
    400: '#7b797b',
    500: '#716f71',
    600: '#676567',
    700: '#5d5b5d',
    800: '#535153',
    900: '#494749',
    950: '#3f3d3f',
  },
  green: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    200: '#BBF7D0',
    300: '#86EFAC',
    400: '#4ADE80',
    500: '#22C55E',
    600: '#16A34A',
    700: '#15803D',
    800: '#166534',
    900: '#14532D',
    950: '#052E16',
  },
  orange: {
    50: '#FFFAEB',
    100: '#FEEFC7',
    200: '#FEDF89',
    300: '#FEC84B',
    400: '#FDB022',
    500: '#F79009',
    600: '#DC6803',
    700: '#B54708',
    800: '#93370D',
    900: '#792E0D',
  },
  red: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
    950: '#450A0A',
  },
};

function generateAlphaPalette(hex: string) {
  return [1, 2, 3, 4, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].reduce(
    (acc, opacity) => {
      const alpha = Math.round((opacity / 100) * 255)
        .toString(16)
        .padStart(2, '0');
      acc[opacity] = `${hex}${alpha}`;
      return acc;
    },
    {} as Record<number, string>,
  );
}

const COLOR_PRIMITIVES = {
  ...BASE_COLORS,
  alpha: {
    white: generateAlphaPalette(BASE_COLORS.white),
    gray: generateAlphaPalette(BASE_COLORS.gray[900]),
    red: generateAlphaPalette(BASE_COLORS.red[500]),
    accent: generateAlphaPalette(BASE_COLORS.accent[500]),
  },
};

export default defineConfig({
  safelist: [
    ...Object.keys(customIconCollection[collectionName] || {}).map(x => `i-hanzo:${x}`)
  ],
  shortcuts: {
    'hanzo-ease-cubic-bezier': 'ease-[cubic-bezier(0.4,0,0.2,1)]',
    'transition-theme': 'transition-[background-color,border-color,color] duration-150 hanzo-ease-cubic-bezier',
    kdb: 'bg-hanzo-elements-code-background text-hanzo-elements-code-text py-1 px-1.5 rounded-md',
    'max-w-chat': 'max-w-[var(--chat-max-width)]',
  },
  rules: [
    ['b', {}],
  ],
  theme: {
    colors: {
      ...COLOR_PRIMITIVES,
      hanzo: {
        elements: {
          borderColor: 'var(--hanzo-elements-borderColor)',
          borderColorActive: 'var(--hanzo-elements-borderColorActive)',
          background: {
            depth: {
              1: 'var(--hanzo-elements-bg-depth-1)',
              2: 'var(--hanzo-elements-bg-depth-2)',
              3: 'var(--hanzo-elements-bg-depth-3)',
              4: 'var(--hanzo-elements-bg-depth-4)',
            },
          },
          textPrimary: 'var(--hanzo-elements-textPrimary)',
          textSecondary: 'var(--hanzo-elements-textSecondary)',
          textTertiary: 'var(--hanzo-elements-textTertiary)',
          code: {
            background: 'var(--hanzo-elements-code-background)',
            text: 'var(--hanzo-elements-code-text)',
          },
          button: {
            primary: {
              background: 'var(--hanzo-elements-button-primary-background)',
              backgroundHover: 'var(--hanzo-elements-button-primary-backgroundHover)',
              text: 'var(--hanzo-elements-button-primary-text)',
            },
            secondary: {
              background: 'var(--hanzo-elements-button-secondary-background)',
              backgroundHover: 'var(--hanzo-elements-button-secondary-backgroundHover)',
              text: 'var(--hanzo-elements-button-secondary-text)',
            },
            danger: {
              background: 'var(--hanzo-elements-button-danger-background)',
              backgroundHover: 'var(--hanzo-elements-button-danger-backgroundHover)',
              text: 'var(--hanzo-elements-button-danger-text)',
            },
          },
          item: {
            contentDefault: 'var(--hanzo-elements-item-contentDefault)',
            contentActive: 'var(--hanzo-elements-item-contentActive)',
            contentAccent: 'var(--hanzo-elements-item-contentAccent)',
            contentDanger: 'var(--hanzo-elements-item-contentDanger)',
            backgroundDefault: 'var(--hanzo-elements-item-backgroundDefault)',
            backgroundActive: 'var(--hanzo-elements-item-backgroundActive)',
            backgroundAccent: 'var(--hanzo-elements-item-backgroundAccent)',
            backgroundDanger: 'var(--hanzo-elements-item-backgroundDanger)',
          },
          actions: {
            background: 'var(--hanzo-elements-actions-background)',
            code: {
              background: 'var(--hanzo-elements-actions-code-background)',
            },
          },
          artifacts: {
            background: 'var(--hanzo-elements-artifacts-background)',
            backgroundHover: 'var(--hanzo-elements-artifacts-backgroundHover)',
            borderColor: 'var(--hanzo-elements-artifacts-borderColor)',
            inlineCode: {
              background: 'var(--hanzo-elements-artifacts-inlineCode-background)',
              text: 'var(--hanzo-elements-artifacts-inlineCode-text)',
            },
          },
          messages: {
            background: 'var(--hanzo-elements-messages-background)',
            linkColor: 'var(--hanzo-elements-messages-linkColor)',
            code: {
              background: 'var(--hanzo-elements-messages-code-background)',
            },
            inlineCode: {
              background: 'var(--hanzo-elements-messages-inlineCode-background)',
              text: 'var(--hanzo-elements-messages-inlineCode-text)',
            },
          },
          icon: {
            success: 'var(--hanzo-elements-icon-success)',
            error: 'var(--hanzo-elements-icon-error)',
            primary: 'var(--hanzo-elements-icon-primary)',
            secondary: 'var(--hanzo-elements-icon-secondary)',
            tertiary: 'var(--hanzo-elements-icon-tertiary)',
          },
          preview: {
            addressBar: {
              background: 'var(--hanzo-elements-preview-addressBar-background)',
              backgroundHover: 'var(--hanzo-elements-preview-addressBar-backgroundHover)',
              backgroundActive: 'var(--hanzo-elements-preview-addressBar-backgroundActive)',
              text: 'var(--hanzo-elements-preview-addressBar-text)',
              textActive: 'var(--hanzo-elements-preview-addressBar-textActive)',
            },
          },
          terminals: {
            background: 'var(--hanzo-elements-terminals-background)',
            buttonBackground: 'var(--hanzo-elements-terminals-buttonBackground)',
          },
          dividerColor: 'var(--hanzo-elements-dividerColor)',
          loader: {
            background: 'var(--hanzo-elements-loader-background)',
            progress: 'var(--hanzo-elements-loader-progress)',
          },
          prompt: {
            background: 'var(--hanzo-elements-prompt-background)',
          },
          sidebar: {
            dropdownShadow: 'var(--hanzo-elements-sidebar-dropdownShadow)',
            buttonBackgroundDefault: 'var(--hanzo-elements-sidebar-buttonBackgroundDefault)',
            buttonBackgroundHover: 'var(--hanzo-elements-sidebar-buttonBackgroundHover)',
            buttonText: 'var(--hanzo-elements-sidebar-buttonText)',
          },
          cta: {
            background: 'var(--hanzo-elements-cta-background)',
            text: 'var(--hanzo-elements-cta-text)',
          },
        },
      },
    },
  },
  transformers: [transformerDirectives()],
  presets: [
    presetUno({
      dark: {
        light: '[data-theme="light"]',
        dark: '[data-theme="dark"]',
      },
    }),
    presetIcons({
      warn: true,
      collections: {
        ...customIconCollection,
      },
      unit: 'em',
    }),
  ],
});
