/**
 * @hanzo/app — Hanzo's app shell and its apps, once, for every Hanzo surface.
 *
 *   import { configure, Rooms } from '@hanzo/app'
 *   import { Room } from '@hanzo/app/Room'
 *   import { CalScheduler } from '@hanzo/app/CalScheduler'
 *
 * The root names what a host passes; each room is its own subpath, so a page
 * loads the apps it draws and no others.
 */
export { configure, where, site, brand } from './where'
export type { Addresses } from './where'
export { Rooms, Look, useRooms, useLook, useOrg } from './host'
export type { Router, Link, RoomsProps } from './host'
export { WindowControls, dragWindow, toggleWindowMaximize } from './WindowControls'
