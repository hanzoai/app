import { useStore } from '@nanostores/react';
import { classNames } from '~/utils/classNames';

interface SidebarToggleProps {
  sidebarOpen: boolean;
}

export function SidebarToggle({ sidebarOpen }: SidebarToggleProps) {
  return (
    <div 
      className={classNames(
        'fixed bottom-4 left-4 z-logo text-hanzo-elements-textPrimary cursor-pointer transition-opacity duration-200',
        {
          'opacity-0': sidebarOpen,
          'opacity-100': !sidebarOpen,
        }
      )}
    >
      <div className="i-ph:sidebar-simple-duotone text-xl" />
    </div>
  );
} 