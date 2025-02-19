import Cookies from 'js-cookie';
import { logStore } from './logs';

export function initializeGitHubCredentials() {
  const envUsername = import.meta.env.GITHUB_USERNAME;
  const envToken = import.meta.env.GITHUB_TOKEN;

  // Only set cookies if environment variables are present and cookies don't exist
  if (envUsername && !Cookies.get('githubUsername')) {
    Cookies.set('githubUsername', envUsername);
    logStore.logSystem('GitHub username initialized from environment', { username: envUsername });
  }

  if (envToken && !Cookies.get('githubToken')) {
    Cookies.set('githubToken', envToken);
    if (envUsername) {
      // Set git credentials cookie if both username and token are available
      Cookies.set('git:github.com', JSON.stringify({ username: envToken, password: 'x-oauth-basic' }));
    }
    logStore.logSystem('GitHub token initialized from environment');
  }
} 