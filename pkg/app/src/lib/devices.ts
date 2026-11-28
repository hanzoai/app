/**
 * Devices and shells as a person reads them, in Tabs and the sidebar (hanzo-inc/app issue 311).
 *
 * The naming is @hanzo/build's, the one Dev's "where to run" and Settings → Machines draw: a hostname said as a person
 * says it (`Alexs-MacBook-Pro.local` → "Alex's MacBook Pro"), the hardware and the hostname in the detail, and a name
 * the person gave it (`useDeviceNames`, kept on their account) winning over both.
 */
import { formatDeviceLabel } from '@hanzo/dev/dev-mode'
import { deviceKey, shellKey, type Names } from '@hanzo/dev/names'

type Say = (key: string, params?: Record<string, string | number>) => string

/** A device or shell to draw: its title, what is beneath it, and the key a rename is kept under. */
export interface Shown {
  title: string
  detail?: string
  key: string
}

/** A machine Tabs reaches: a linked one by its hostname (`machine`) with its hardware, or a cloud workspace (`sandbox`). */
export interface Reached {
  machine: string
  /** The hardware it reported ("10 vCPU / 122G / 1× GB10"). */
  hardware?: string
  /** A cloud workspace, not a linked machine. */
  sandbox?: boolean
}

/** A machine as a person reads it. */
export function showDevice(h: Reached, names: Names, devMode: boolean, say?: Say): Shown {
  const key = deviceKey(h.machine)
  const name = names[key]
  if (h.sandbox) {
    const shown = formatDeviceLabel('Cloud', { name, devMode, say })
    // Two cloud workspaces are told apart by their project, beneath.
    return { title: shown.title, detail: name ? shown.detail : [shown.detail, h.machine].filter(Boolean).join(' · ') || undefined, key }
  }
  return { ...formatDeviceLabel(h.machine, { hardware: h.hardware, name, devMode, say }), key }
}

/** A shell on a machine: the name the person gave it, else the machine's name and the shell's own. */
export function showShell(device: Shown, machine: string, shell: string | undefined, names: Names): Shown {
  if (!shell) return device
  const key = shellKey(machine, shell)
  const name = names[key]
  return name ? { title: name, detail: device.title, key } : { title: `${device.title} · ${shell}`, detail: device.detail, key }
}
