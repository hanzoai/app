/**
 * @hanzo/app — Hanzo's app shell and its apps, once, for every Hanzo surface.
 *
 *   import { configure, Host } from '@hanzo/app'
 *   import { Shell } from '@hanzo/app/Shell'
 *   import { CalScheduler } from '@hanzo/app/CalScheduler'
 *
 * The root names what a host passes; each app is its own subpath, so a page
 * loads the apps it draws and no others.
 */
export { configure, where, site, brand } from './where'
export type { Addresses } from './where'
export { Host, Look, useHost, useLook, useOrg } from './host'
export type { Router, Link, HostProps } from './host'
export * from './lib/local-fs'
// Desktop UI loads through @hanzo/app/WindowControls and @hanzo/app/Editor; keep the root usable
// by Node tools without loading @hanzo/ui and React Native.
