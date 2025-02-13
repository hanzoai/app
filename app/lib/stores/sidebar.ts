import { atom } from 'nanostores';

export const sidebarStore = {
  isOpen: atom<boolean>(false),
};
