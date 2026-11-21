'use client'

import { createContext, useContext } from 'react'

/**
 * True inside a host that is a window of its own: App's `bar` (Hanzo Desktop
 * passes one). Such a window has no browser tabs, so menus there offer no
 * "Open in new tab": the press would open nothing a reader can find.
 */
export const Windowed = createContext(false)

export const useWindowed = (): boolean => useContext(Windowed)
