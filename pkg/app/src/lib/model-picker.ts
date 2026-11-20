/** Opens the composer's model menu the way a press would. False when the page has no composer to open it on. */
export function openModelPicker(): boolean {
  if (typeof document === 'undefined') return false
  const chip = document.querySelector<HTMLElement>('[data-slot="mind"] [data-slot="model-picker"]')
  if (!chip) return false
  chip.focus()
  // The picker opens on a key or a real press, not a synthetic click().
  chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  return true
}
