/** Who is mounted, in order: the first is the one that answers a window-wide trigger, so two mounted dialogs never both open. */
export function owners() {
  const mounted: string[] = []
  return {
    claim(id: string): () => void {
      mounted.push(id)
      return () => {
        const at = mounted.indexOf(id)
        if (at >= 0) mounted.splice(at, 1)
      }
    },
    owns: (id: string) => mounted[0] === id,
  }
}
