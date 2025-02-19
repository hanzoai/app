export type DebugLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';
import { Chalk } from 'chalk';
import stripAnsi from 'strip-ansi';

// Force disable ANSI colors in Vercel logs.
const isVercel = typeof process !== 'undefined' && !!process.env.VERCEL;

if (isVercel) {
  process.env.FORCE_COLOR = '0';
}

const chalk = new Chalk({ level: isVercel ? 0 : 3 });

type LoggerFunction = (...messages: any[]) => void;

interface Logger {
  trace: LoggerFunction;
  debug: LoggerFunction;
  info: LoggerFunction;
  warn: LoggerFunction;
  error: LoggerFunction;
  setLevel: (level: DebugLevel) => void;
}

// Updated to use Boolean() to ensure a boolean condition.
let currentLevel: DebugLevel = (Boolean(import.meta.env.VITE_LOG_LEVEL) || import.meta.env.DEV) ? 'debug' : 'info';

export const logger: Logger = {
  trace: (...messages: any[]) => log('trace', undefined, messages),
  debug: (...messages: any[]) => log('debug', undefined, messages),
  info: (...messages: any[]) => log('info', undefined, messages),
  warn: (...messages: any[]) => log('warn', undefined, messages),
  error: (...messages: any[]) => log('error', undefined, messages),
  setLevel,
};

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

function setLevel(level: DebugLevel) {
  if ((level === 'trace' || level === 'debug') && import.meta.env.PROD) {
    return;
  }

  currentLevel = level;
}

function log(level: DebugLevel, scope: string | undefined, messages: any[]) {
  const levelOrder: DebugLevel[] = ['trace', 'debug', 'info', 'warn', 'error'];

  if (levelOrder.indexOf(level) < levelOrder.indexOf(currentLevel)) {
    return;
  }

  const allMessages = messages.reduce((acc, current) => {
    if (acc.endsWith('\n')) {
      return acc + current;
    }

    if (!acc) {
      return current;
    }

    return `${acc} ${current}`;
  }, '');

  const labelBackgroundColor = getColorForLevel(level);
  const labelTextColor = level === 'warn' ? '#000000' : '#FFFFFF';

  const labelStyles = getLabelStyles(labelBackgroundColor, labelTextColor);
  const scopeStyles = getLabelStyles('#77828D', 'white');
  const styles = [labelStyles];

  if (typeof scope === 'string') {
    styles.push('', scopeStyles);
  }

  let labelText = formatText(` ${level.toUpperCase()} `, labelTextColor, labelBackgroundColor);

  if (scope) {
    labelText = `${labelText} ${formatText(` ${scope} `, '#FFFFFF', '77828D')}`;
  }

  // On Vercel, strip ANSI codes; locally, show color.
  if (isVercel) {
    const plainLabel = stripAnsi(labelText);
    const plainMessages = typeof allMessages === 'string' ? stripAnsi(allMessages) : allMessages;
    console.log(plainLabel, plainMessages);
  } else {
    console.log(labelText, allMessages);
  }
}

function formatText(text: string, color: string, bg: string) {
  return chalk.bgHex(bg)(chalk.hex(color)(text));
}

function getLabelStyles(color: string, textColor: string) {
  return `background-color: ${color}; color: ${textColor}; border: 4px solid ${color};`;
}

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

export const renderLogger = createScopedLogger('Render');
