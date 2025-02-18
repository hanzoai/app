import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { motion } from 'framer-motion';
import { chatStore } from '~/lib/stores/chat';
import { sidebarStore } from '~/lib/stores/sidebar';
import { classNames } from '~/utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { cubicEasingFn } from '~/utils/easings';
import { SidebarToggle } from '~/components/sidebar/SidebarToggle';

const logoVariants = {
  hidden: {
    opacity: 0,
    x: -20,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
};

const textVariants = {
  hidden: {
    opacity: 0,
    x: -20,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
};

export function Header() {
  const chat = useStore(chatStore);
  const sidebarOpen = useStore(sidebarStore.isOpen);

  return (
    <header
      className={classNames('flex items-center p-5 border-b h-[var(--header-height)]', {
        'border-transparent': !chat.started,
        'border-hanzo-elements-borderColor': chat.started,
      })}
    >
      <div className="flex items-center gap-2 z-logo text-hanzo-elements-textPrimary">
        <a href="/" className="text-2xl font-semibold text-accent flex items-center">
          <motion.span
            key="logo"
            variants={logoVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="i-hanzo:logo?mask w-[24px] inline-block"
          />
          {sidebarOpen && (
            <motion.span 
              key="text" 
              variants={textVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="px-2 text-2xl font-semibold text-accent"
            >
              Hanzo
            </motion.span>
          )}
        </a>
        {chat.started && <SidebarToggle sidebarOpen={sidebarOpen} className="ml-2" />}
      </div>
      {chat.started && (
        <>
          <span className="flex-1 px-4 truncate text-center text-hanzo-elements-textPrimary">
            <ClientOnly>{() => <ChatDescription />}</ClientOnly>
          </span>
          <ClientOnly>
            {() => (
              <div className="mr-1">
                <HeaderActionButtons />
              </div>
            )}
          </ClientOnly>
        </>
      )}
    </header>
  );
}
