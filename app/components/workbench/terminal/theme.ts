import type { ITheme } from '@xterm/xterm';

const style = getComputedStyle(document.documentElement);
const cssVar = (token: string) => style.getPropertyValue(token) || undefined;

export function getTerminalTheme(overrides?: ITheme): ITheme {
  return {
    cursor: cssVar('--hanzo-elements-terminal-cursorColor'),
    cursorAccent: cssVar('--hanzo-elements-terminal-cursorColorAccent'),
    foreground: cssVar('--hanzo-elements-terminal-textColor'),
    background: cssVar('--hanzo-elements-terminal-backgroundColor'),
    selectionBackground: cssVar('--hanzo-elements-terminal-selection-backgroundColor'),
    selectionForeground: cssVar('--hanzo-elements-terminal-selection-textColor'),
    selectionInactiveBackground: cssVar('--hanzo-elements-terminal-selection-backgroundColorInactive'),

    // ansi escape code colors
    black: cssVar('--hanzo-elements-terminal-color-black'),
    red: cssVar('--hanzo-elements-terminal-color-red'),
    green: cssVar('--hanzo-elements-terminal-color-green'),
    yellow: cssVar('--hanzo-elements-terminal-color-yellow'),
    blue: cssVar('--hanzo-elements-terminal-color-blue'),
    magenta: cssVar('--hanzo-elements-terminal-color-magenta'),
    cyan: cssVar('--hanzo-elements-terminal-color-cyan'),
    white: cssVar('--hanzo-elements-terminal-color-white'),
    brightBlack: cssVar('--hanzo-elements-terminal-color-brightBlack'),
    brightRed: cssVar('--hanzo-elements-terminal-color-brightRed'),
    brightGreen: cssVar('--hanzo-elements-terminal-color-brightGreen'),
    brightYellow: cssVar('--hanzo-elements-terminal-color-brightYellow'),
    brightBlue: cssVar('--hanzo-elements-terminal-color-brightBlue'),
    brightMagenta: cssVar('--hanzo-elements-terminal-color-brightMagenta'),
    brightCyan: cssVar('--hanzo-elements-terminal-color-brightCyan'),
    brightWhite: cssVar('--hanzo-elements-terminal-color-brightWhite'),

    ...overrides,
  };
}
