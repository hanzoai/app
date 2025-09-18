import React, { useState, useEffect } from 'react';
import {
  enableRemoteUI,
  disableRemoteUI,
  getRemoteUIStatus,
} from '../lib/remote-ui';

export function RemoteUIToggle() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [port, setPort] = useState(9090);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const status = await getRemoteUIStatus();
      setIsEnabled(status);
    } catch (error) {
      console.error('Failed to check remote UI status:', error);
    }
  };

  const handleToggle = async () => {
    setIsLoading(true);
    setMessage('');

    try {
      if (isEnabled) {
        const result = await disableRemoteUI();
        setMessage(result);
        setIsEnabled(false);
      } else {
        const result = await enableRemoteUI(port);
        setMessage(result);
        setIsEnabled(true);
      }
    } catch (error) {
      setMessage(`Error: ${error}`);
      console.error('Failed to toggle remote UI:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-lg border bg-gray-50 p-4 dark:bg-gray-800">
      <h3 className="mb-3 text-lg font-semibold">Remote UI Control</h3>

      <div className="mb-3 flex items-center gap-4">
        <label htmlFor="port" className="text-sm">
          Port:
        </label>
        <input
          id="port"
          type="number"
          value={port}
          onChange={(e) => setPort(parseInt(e.target.value))}
          disabled={isEnabled || isLoading}
          className="w-20 rounded border px-2 py-1"
        />

        <button
          onClick={handleToggle}
          disabled={isLoading}
          className={`rounded px-4 py-2 transition-colors ${
            isEnabled
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-green-500 text-white hover:bg-green-600'
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {isLoading
            ? 'Processing...'
            : isEnabled
              ? 'Disable Remote UI'
              : 'Enable Remote UI'}
        </button>
      </div>

      {message && (
        <div
          className={`rounded p-2 text-sm ${
            message.includes('Error')
              ? 'bg-red-100 text-red-700'
              : 'bg-green-100 text-green-700'
          }`}
        >
          {message}
        </div>
      )}

      {isEnabled && (
        <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          <p>Remote UI is active. You can now:</p>
          <ul className="mt-1 list-inside list-disc">
            <li>Connect via browser at http://localhost:{port}</li>
            <li>Control the app with Playwright or other automation tools</li>
            <li>Use the MCP browser control server</li>
          </ul>
        </div>
      )}
    </div>
  );
}
