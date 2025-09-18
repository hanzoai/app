// import { scan } from 'react-scan'; // import this BEFORE react
import './globals.css';

import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';

// Enhanced error logging
window.addEventListener('error', (event) => {
  console.error('Global error:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
    stack: event.error?.stack
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', {
    reason: event.reason,
    promise: event.promise,
    stack: event.reason?.stack
  });
});

// Log app initialization
console.info('Hanzo Desktop App initializing...', {
  timestamp: new Date().toISOString(),
  userAgent: navigator.userAgent,
  platform: navigator.platform
});

/*
 Enable react scan for performance monitoring
  */

// if (typeof window !== 'undefined') {
//   scan({
//     enabled: true,
//     trackUnnecessaryRenders: true,
//     // log: true, // logs render info to console (default: false)
//   });
// }

ReactDOM.createRoot(document.querySelector('#root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
