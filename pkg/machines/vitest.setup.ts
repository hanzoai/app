// Node 25+ defines its own `localStorage` global, with no storage behind it unless a file is
// named, and it shadows the DOM environment's. Where it is unusable, a plain in-memory Storage
// stands in, so a test reads and writes the same way on every Node.
const broken = (() => {
  try {
    return typeof globalThis.localStorage?.clear !== 'function'
  } catch {
    return true
  }
})()

if (typeof window !== 'undefined' && broken) {
  const map = new Map<string, string>()
  const storage: Storage = {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(String(key)) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(String(key)),
    setItem: (key, value) => void map.set(String(key), String(value)),
  }
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true })
}
