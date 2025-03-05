import { useStore } from '@nanostores/react';
import { netlifyConnection, fetchNetlifyStats } from '~/lib/stores/netlify';
import { chatId } from '~/lib/persistence/useChatHistory';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useEffect } from 'react';

export function NetlifyDeploymentLink() {
  const connection = useStore(netlifyConnection);
  const currentChatId = useStore(chatId);

  useEffect(() => {
    if (connection.token && currentChatId) {
      fetchNetlifyStats(connection.token);
    }
  }, [connection.token, currentChatId]);

  const deployedSite = connection.stats?.sites?.find((site) => site.name.includes(`hanzo-app-${currentChatId}`));

  if (!deployedSite) {
    return null;
  }

  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <a
            href={deployedSite.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-hanzo-elements-item-backgroundActive text-hanzo-elements-textSecondary hover:text-[#00AD9F] z-50"
            onClick={(e) => {
              e.stopPropagation(); // Add this to prevent click from bubbling up
            }}
          >
            <div className="i-ph:rocket-launch w-5 h-5" />
          </a>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="px-3 py-2 rounded bg-hanzo-elements-background-depth-3 text-hanzo-elements-textPrimary text-xs z-50"
            sideOffset={5}
          >
            {deployedSite.url}
            <Tooltip.Arrow className="fill-hanzo-elements-background-depth-3" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
