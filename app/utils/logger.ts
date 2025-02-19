export type DebugLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';
import { Chalk } from 'chalk';
import stripAnsi from 'strip-ansi';

// Check if running on Vercel to disable ANSI colors for log compatibility.
const isVercel = process.env.VERCEL === '1';
if (isVercel) {
  process.env.FORCE_COLOR = '0';
}

// Initialize Chalk with the appropriate color level.
const chalk = new Chalk({ level: isVercel ? 0 : 3 });

// Define a logger function that accepts any number of messages.
type LoggerFunction = (...messages: any[]) => void;

// Logger interface encapsulating logging methods and level setter.
interface Logger {
  trace: LoggerFunction;
  debug: LoggerFunction;
  info: LoggerFunction;
  warn: LoggerFunction;
  error: LoggerFunction;
  setLevel: (level: DebugLevel) => void;
}

// Set default log level based on environment variables or development mode.
let currentLevel: DebugLevel = (Boolean(import.meta.env.VITE_LOG_LEVEL) || import.meta.env.DEV)
  ? 'debug'
  : 'info';

// Primary logger that logs messages without a specific scope.
export const logger: Logger = {
  trace: (...messages: any[]) => log('trace', undefined, messages),
  debug: (...messages: any[]) => log('debug', undefined, messages),
  info: (...messages: any[]) => log('info', undefined, messages),
  warn: (...messages: any[]) => log('warn', undefined, messages),
  error: (...messages: any[]) => log('error', undefined, messages),
  setLevel,
};

// Factory function to create a logger with a specific scope.
export function createScopedLogger(scope: string): Logger {
  return {
    trace: (...messages: any[]) => log('trace', scope, messages),
    debug: (...messages: any[]) => log('debug', scope, messages),
    info: (...messages: any[]) => log('info', scope, messages),
    warn: (...messages: any[]) => log('warn', scope, messages),
    error: (...messages: any[]) => log('error', scope, messages),
    setLevel,
  };
}

// Set the current log level. Prevent lowering the level in production for trace/debug.
function setLevel(level: DebugLevel) {
  if ((level === 'trace' || level === 'debug') && import.meta.env.PROD) return;
  currentLevel = level;
}

// Core logging function that formats and prints messages based on the environment.
function log(level: DebugLevel, scope: string | undefined, messages: any[]) {
  // Order of log levels to filter out lower priority messages.
  const levelOrder: DebugLevel[] = ['trace', 'debug', 'info', 'warn', 'error'];
  if (levelOrder.indexOf(level) < levelOrder.indexOf(currentLevel)) return;

  // Combine messages into a single string; preserve newlines if present.
  const allMessages = messages.reduce((acc, current) => {
    if (acc.endsWith('\n')) return acc + current;
    if (!acc) return current;
    return `${acc} ${current}`;
  }, '');

  // Determine label colors based on the log level.
  const labelBackgroundColor = getColorForLevel(level);
  const labelTextColor = level === 'warn' ? '#000000' : '#FFFFFF';
  // Create a raw label used for environments without styling support.
  const rawLabel = scope ? `${level.toUpperCase()} ${scope}` : level.toUpperCase();

  if (isVercel) {
    // Vercel environment: output plain text by stripping ANSI styling.
    const plainLabel = stripAnsi(rawLabel);
    const plainMessages = typeof allMessages === 'string'
      ? stripAnsi(allMessages)
      : allMessages;
    console.log(plainLabel, plainMessages);
  } else if (typeof window !== 'undefined') {
    // Browser environment: apply CSS styling to the console output.
    const labelCSS = `background-color: ${labelBackgroundColor}; color: ${labelTextColor}; padding: 2px 4px; border-radius: 2px;`;
    if (scope) {
      const scopeCSS = 'background-color: #77828D; color: white; padding: 2px 4px; border-radius: 2px;';
      console.log(`%c${level.toUpperCase()} %c${scope}`, labelCSS, scopeCSS, allMessages);
    } else {
      console.log(`%c${level.toUpperCase()}`, labelCSS, allMessages);
    }
  } else {
    // Node environment: use Chalk for colored formatting.
    let formattedLabel = formatText(` ${level.toUpperCase()} `, labelTextColor, labelBackgroundColor);
    if (scope) {
      formattedLabel = `${formattedLabel} ${formatText(` ${scope} `, '#FFFFFF', '77828D')}`;
    }
    console.log(formattedLabel, allMessages);
  }
}

// Use Chalk to format text with specific foreground and background colors.
function formatText(text: string, color: string, bg: string) {
  return chalk.bgHex(bg)(chalk.hex(color)(text));
}

// Return the appropriate background color for each log level.
function getColorForLevel(level: DebugLevel): string {
  switch (level) {
    case 'trace':
    case 'debug':
      return '#77828D';
    case 'info':
      return '#1389FD';
    case 'warn':
      return '#FFDB6C';
    case 'error':
      return '#EE4744';
    default:
      return '#000000';
  }
}

// Export a scoped logger for rendering-related logs.
export const renderLogger = createScopedLogger('Render');
