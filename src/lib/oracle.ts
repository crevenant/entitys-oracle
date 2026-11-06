import catalog from '../catalog.json' with { type: 'json' }

export type Role = 'survivor' | 'killer'
export type Character = (typeof catalog.characters)[number]
export type Perk = (typeof catalog.perks)[number]
export type Draw = { id: string; character: Character; perks: Perk[]; createdAt: string }
export { catalog }

/** Rejection sampling avoids modulo bias when selecting from the catalog. */
export function randomIndex(length: number): number {
  if (!Number.isSafeInteger(length) || length < 1 || length > 0x100000000) throw new Error('Invalid pool size')
  const limit = Math.floor(0x100000000 / length) * length
  const buffer = new Uint32Array(1)
  do { crypto.getRandomValues(buffer) } while (buffer[0] >= limit)
  return buffer[0] % length
}

export function drawFate(role: Role, excluded: string[] = []): Draw {
  const characters = catalog.characters.filter((character) => character.role === role && !excluded.includes(character.id))
  const perks = catalog.perks.filter((perk) => perk.role === role)
  if (!characters.length) throw new Error('Select at least one character in your collection.')
  if (perks.length < 4) throw new Error('At least four eligible perks are required.')
  const chosen: Perk[] = []
  for (let i = 0; i < 4; i++) chosen.push(perks.splice(randomIndex(perks.length), 1)[0])
  const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return { id, character: characters[randomIndex(characters.length)], perks: chosen, createdAt: new Date().toISOString() }
}

export function readSaved<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback } catch { return fallback }
}

export function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Private or full storage should not block a draw. */ }
}
