import catalog from '../catalog.json' with { type: 'json' }

export type Role = 'survivor' | 'killer'
export type Character = (typeof catalog.characters)[number]
export type Perk = (typeof catalog.perks)[number]
export type Draw = { id: string; character: Character; perks: Perk[]; createdAt: string }
export type DrawOptions = { excludedPerks?: readonly string[]; lockedCharacterId?: string | null; lockedPerks?: readonly (string | null)[] }
export { catalog }

/** Rejection sampling avoids modulo bias when selecting from the catalog. */
export function randomIndex(length: number): number {
  if (!Number.isSafeInteger(length) || length < 1 || length > 0x100000000) throw new Error('Invalid pool size')
  const limit = Math.floor(0x100000000 / length) * length
  const buffer = new Uint32Array(1)
  do { crypto.getRandomValues(buffer) } while (buffer[0] >= limit)
  return buffer[0] % length
}

export function drawFate(role: Role, excluded: string[] = [], options: DrawOptions = {}): Draw {
  const characters = catalog.characters.filter((character) => character.role === role && !excluded.includes(character.id))
  const eligiblePerks = catalog.perks.filter((perk) => perk.role === role && !options.excludedPerks?.includes(perk.id))
  if (!characters.length) throw new Error('Select at least one character in your collection.')
  if (eligiblePerks.length < 4) throw new Error('Select at least four perks for this role in your collection.')
  const lockedCharacter = options.lockedCharacterId == null ? null : characters.find((entry) => entry.id === options.lockedCharacterId)
  if (options.lockedCharacterId != null && !lockedCharacter) throw new Error('The locked character must be included in this role’s pool.')
  if (options.lockedPerks && options.lockedPerks.length > 4) throw new Error('Only four perk slots can be locked.')
  const lockedIds = Array.from({ length: 4 }, (_, index) => options.lockedPerks?.[index] ?? null)
  const held = lockedIds.filter((id): id is string => id !== null)
  if (new Set(held).size !== held.length) throw new Error('Each locked perk must be unique.')
  const locked = lockedIds.map((id) => id === null ? null : eligiblePerks.find((entry) => entry.id === id))
  if (locked.some((entry) => entry === undefined)) throw new Error('Locked perks must be included in this role’s pool.')
  const perks = eligiblePerks.filter((entry) => !held.includes(entry.id))
  const chosen: Perk[] = locked.map((entry) => entry ?? perks.splice(randomIndex(perks.length), 1)[0])
  const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return { id, character: lockedCharacter ?? characters[randomIndex(characters.length)], perks: chosen, createdAt: new Date().toISOString() }
}

export function readSaved<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback } catch { return fallback }
}

export function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Private or full storage should not block a draw. */ }
}
