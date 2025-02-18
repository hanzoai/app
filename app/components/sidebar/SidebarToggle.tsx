import { classNames } from '~/utils/classNames';
import { sidebarStore } from '~/lib/stores/sidebar';

interface SidebarToggleProps {
  sidebarOpen: boolean;
  className?: string;
}

export function SidebarToggle({ sidebarOpen, className }: SidebarToggleProps) {
  const handleClick = () => {
    sidebarStore.isOpen.set(!sidebarOpen);
  };

  return (
    <div
      onClick={handleClick}
      className={classNames(
        'text-hanzo-elements-textPrimary cursor-pointer transition-opacity duration-200',
        {
          'opacity-0': sidebarOpen,
          'opacity-100': !sidebarOpen,
          'fixed bottom-4 left-4 z-logo': !className,
        },
        className
      )}
    >
      <div className="i-ph:sidebar-simple-duotone text-xl" />
    </div>
  );
}
