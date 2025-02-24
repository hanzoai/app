import { useStore } from '@nanostores/react';
import type { LinksFunction } from '@remix-run/node';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  isRouteErrorResponse
} from '@remix-run/react';
import tailwindReset from '@unocss/reset/tailwind-compat.css?url';
import { themeStore } from './lib/stores/theme';
import { stripIndents } from './utils/stripIndent';
import { createHead } from 'remix-island';
import React, { useEffect, useState, Component } from 'react';
import type { ErrorInfo } from 'react';
import { logStore } from './lib/stores/logs';
import { initializeGitHubCredentials } from './lib/stores/github';
import { ClientOnly } from 'remix-utils/client-only';

import reactToastifyStyles from 'react-toastify/dist/ReactToastify.css?url';
import globalStyles from './styles/index.scss?url';
import xtermStyles from '@xterm/xterm/css/xterm.css?url';

import 'virtual:uno.css';

export const links: LinksFunction = () => [
  { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
  { rel: 'stylesheet', href: reactToastifyStyles },
  { rel: 'stylesheet', href: tailwindReset },
  { rel: 'stylesheet', href: globalStyles },
  { rel: 'stylesheet', href: xtermStyles },
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
  }
];

const inlineThemeCode = stripIndents`
  setTutorialKitTheme();
  function setTutorialKitTheme() {
    localStorage.setItem('hanzo_theme', 'dark');
    document.documentElement.setAttribute('data-theme', 'dark');
  }
`;

export const Head = createHead(() => (
  <>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <Meta />
    <Links />
    <script dangerouslySetInnerHTML={{ __html: inlineThemeCode }} />
  </>
));

function ClientLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  let theme = 'dark';
  try {
    theme = useStore(themeStore) || 'dark';
  } catch (e: any) {
    logStore.logSystem('ClientLayout useStore error', { error: e.message });
  }
  useEffect(() => {
    setMounted(true);
    try {
      document.documentElement.setAttribute('data-theme', theme);
    } catch (e: any) {
      logStore.logSystem('ClientLayout setAttribute error', { error: e.message });
    }
  }, [theme]);
  if (!mounted) return null;
  return <>{children}</>;
}

class SafeClientLayout extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logStore.logSystem('SafeClientLayout error', {
      error: error.message,
      componentStack: errorInfo.componentStack
    });
  }
  render() {
    return this.state.hasError ? <>{this.props.children}</> : this.props.children;
  }
}

class SafeOutlet extends Component<{ children?: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logStore.logSystem('SafeOutlet error', {
      error: error.message,
      componentStack: errorInfo.componentStack
    });
  }
  render() {
    return this.state.hasError ? (
      <div style={{ padding: '1rem', textAlign: 'center' }}>
        Something went wrong. Please try reloading.
      </div>
    ) : (
      this.props.children
    );
  }
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ClientOnly fallback={<>{children}</>}>
        {() => (
          <SafeClientLayout>
            <ClientLayout>{children}</ClientLayout>
          </SafeClientLayout>
        )}
      </ClientOnly>
      <SafeOutlet>
        <Outlet />
      </SafeOutlet>
      <ScrollRestoration />
      <Scripts />
    </>
  );
}

export default function App() {
  useEffect(() => {
    initializeGitHubCredentials();
    logStore.logSystem('Application initialized', {
      theme: 'dark',
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    });
  }, []);
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  useEffect(() => {
    logStore.logSystem('Unhandled error', {
      error: error instanceof Error ? error.message : JSON.stringify(error),
      timestamp: new Date().toISOString()
    });
  }, [error]);

  let errorMessage = 'An unexpected error occurred.';
  if (isRouteErrorResponse(error)) {
    errorMessage = `${error.status} ${error.statusText}`;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  return (
    <html>
      <head>
        <title>Error</title>
        <Meta />
        <Links />
      </head>
      <body style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Something went wrong</h1>
        <p>{errorMessage}</p>
        <button onClick={() => window.location.reload()}>Reload</button>
        <Scripts />
      </body>
    </html>
  );
}
