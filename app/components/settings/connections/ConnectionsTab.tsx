import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import Cookies from 'js-cookie';
import { logStore } from '~/lib/stores/logs';

interface GitHubUserResponse {
  login: string;
  id: number;
  [key: string]: any; // for other properties we don't explicitly need
}

export default function ConnectionsTab() {
  const [githubUsername, setGithubUsername] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    // Load credentials from environment variables
    const envUsername = import.meta.env.GITHUB_USERNAME;
    const envToken = import.meta.env.GITHUB_TOKEN;

    // Get existing cookies
    const cookieUsername = Cookies.get('githubUsername');
    const cookieToken = Cookies.get('githubToken');

    // If environment variables exist and cookies don't, set the cookies
    if (envUsername && !cookieUsername) {
      Cookies.set('githubUsername', envUsername);
    }

    if (envToken && !cookieToken) {
      Cookies.set('githubToken', envToken);

      if (envUsername) {
        // Set git credentials cookie if both username and token are available
        Cookies.set('git:github.com', JSON.stringify({ username: envToken, password: 'x-oauth-basic' }));
      }
    }

    // Now load from cookies (which may have just been set from env vars)
    const finalUsername = Cookies.get('githubUsername') || '';
    const finalToken = Cookies.get('githubToken') || '';

    setGithubUsername(finalUsername);
    setGithubToken(finalToken);

    // Verify credentials if they exist
    if (finalUsername && finalToken) {
      verifyGitHubCredentials();
    }
  }, []);

  const verifyGitHubCredentials = async () => {
    setIsVerifying(true);

    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${githubToken}`,
        },
      });

      if (response.ok) {
        const data = (await response.json()) as GitHubUserResponse;

        if (data.login === githubUsername) {
          setIsConnected(true);
          return true;
        }
      }

      setIsConnected(false);

      return false;
    } catch (error) {
      console.error('Error verifying GitHub credentials:', error);
      setIsConnected(false);

      return false;
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveConnection = async () => {
    if (!githubUsername || !githubToken) {
      toast.error('Please provide both GitHub username and token');
      return;
    }

    setIsVerifying(true);

    const isValid = await verifyGitHubCredentials();

    if (isValid) {
      Cookies.set('githubUsername', githubUsername);
      Cookies.set('githubToken', githubToken);
      logStore.logSystem('GitHub connection settings updated', {
        username: githubUsername,
        hasToken: !!githubToken,
      });
      toast.success('GitHub credentials verified and saved successfully!');
      Cookies.set('git:github.com', JSON.stringify({ username: githubToken, password: 'x-oauth-basic' }));
      setIsConnected(true);
    } else {
      toast.error('Invalid GitHub credentials. Please check your username and token.');
    }
  };

  const handleDisconnect = () => {
    Cookies.remove('githubUsername');
    Cookies.remove('githubToken');
    Cookies.remove('git:github.com');
    setGithubUsername('');
    setGithubToken('');
    setIsConnected(false);
    logStore.logSystem('GitHub connection removed');
    toast.success('GitHub connection removed successfully!');
  };

  return (
    <div className="p-4 mb-4 border border-hanzo-elements-borderColor rounded-lg bg-hanzo-elements-background-depth-3">
      <h3 className="text-lg font-medium text-hanzo-elements-textPrimary mb-4">GitHub Connection</h3>
      <div className="flex mb-4">
        <div className="flex-1 mr-2">
          <label className="block text-sm text-hanzo-elements-textSecondary mb-1">GitHub Username:</label>
          <input
            type="text"
            value={githubUsername}
            onChange={(e) => setGithubUsername(e.target.value)}
            disabled={isVerifying}
            className="w-full bg-white dark:bg-hanzo-elements-background-depth-4 relative px-2 py-1.5 rounded-md focus:outline-none placeholder-hanzo-elements-textTertiary text-hanzo-elements-textPrimary dark:text-hanzo-elements-textPrimary border border-hanzo-elements-borderColor disabled:opacity-50"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm text-hanzo-elements-textSecondary mb-1">Personal Access Token:</label>
          <input
            type="password"
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            disabled={isVerifying}
            className="w-full bg-white dark:bg-hanzo-elements-background-depth-4 relative px-2 py-1.5 rounded-md focus:outline-none placeholder-hanzo-elements-textTertiary text-hanzo-elements-textPrimary dark:text-hanzo-elements-textPrimary border border-hanzo-elements-borderColor disabled:opacity-50"
          />
        </div>
      </div>
      <div className="flex mb-4 items-center">
        {!isConnected ? (
          <button
            onClick={handleSaveConnection}
            disabled={isVerifying || !githubUsername || !githubToken}
            className="bg-hanzo-elements-button-primary-background rounded-lg px-4 py-2 mr-2 transition-colors duration-200 hover:bg-hanzo-elements-button-primary-backgroundHover text-hanzo-elements-button-primary-text disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isVerifying ? (
              <>
                <div className="i-ph:spinner animate-spin mr-2" />
                Verifying...
              </>
            ) : (
              'Connect'
            )}
          </button>
        ) : (
          <button
            onClick={handleDisconnect}
            className="bg-hanzo-elements-button-danger-background rounded-lg px-4 py-2 mr-2 transition-colors duration-200 hover:bg-hanzo-elements-button-danger-backgroundHover text-hanzo-elements-button-danger-text"
          >
            Disconnect
          </button>
        )}
        {isConnected && (
          <span className="text-sm text-green-600 flex items-center">
            <div className="i-ph:check-circle mr-1" />
            Connected to GitHub
          </span>
        )}
      </div>
    </div>
  );
}
