import { test, expect } from '@playwright/test'
import { access } from 'node:fs/promises'
import { catalog, drawFate } from '../src/lib/oracle'
import type { Role } from '../src/lib/oracle'

test('catalog assets exist and random draws obey role, tier, uniqueness, and exclusions', async () => {
  await Promise.all([...catalog.characters, ...catalog.perks].map((entry) => access(`public${entry.image}`)))
  for (const role of ['survivor', 'killer'] as Role[]) {
    const characters = catalog.characters.filter((entry) => entry.role === role)
    const excluded = characters.slice(1).map((entry) => entry.id)
    const ids = new Set<string>()
    for (let index = 0; index < 500; index++) {
      const draw = drawFate(role, excluded)
      expect(draw.character.id).toBe(characters[0].id)
      expect(draw.perks).toHaveLength(4)
      expect(new Set(draw.perks.map((entry) => entry.id)).size).toBe(4)
      expect(draw.perks.every((entry) => entry.role === role && entry.tier === 3)).toBe(true)
      ids.add(draw.id)
    }
    expect(ids.size).toBe(500)
    expect(() => drawFate(role, characters.map((entry) => entry.id))).toThrow('Select at least one character')
  }
})

test('restricted pools keep every combination of locked slots without duplicates', () => {
  for (const role of ['survivor', 'killer'] as Role[]) {
    const character = catalog.characters.find((entry) => entry.role === role)!
    const pool = catalog.perks.filter((entry) => entry.role === role).slice(0, 6)
    const excludedPerks = catalog.perks.filter((entry) => entry.role === role && !pool.includes(entry)).map((entry) => entry.id)
    for (let mask = 0; mask < 16; mask++) {
      const lockedPerks = Array.from({ length: 4 }, (_, slot) => mask & (1 << slot) ? pool[slot].id : null)
      for (let repeat = 0; repeat < 10; repeat++) {
        const draw = drawFate(role, [], { excludedPerks, lockedCharacterId: character.id, lockedPerks })
        expect(draw.character.id).toBe(character.id)
        expect(new Set(draw.perks.map((entry) => entry.id)).size).toBe(4)
        draw.perks.forEach((entry, slot) => {
          expect(pool.some((candidate) => candidate.id === entry.id)).toBe(true)
          if (lockedPerks[slot]) expect(entry.id).toBe(lockedPerks[slot])
        })
      }
    }
  }
})

test('invalid locks and undersized perk pools are rejected before drawing', () => {
  const survivor = catalog.characters.find((entry) => entry.role === 'survivor')!
  const killer = catalog.characters.find((entry) => entry.role === 'killer')!
  const perks = catalog.perks.filter((entry) => entry.role === 'survivor')
  const killerPerk = catalog.perks.find((entry) => entry.role === 'killer')!
  expect(() => drawFate('survivor', [], { excludedPerks: perks.slice(3).map((entry) => entry.id) })).toThrow('at least four perks')
  expect(() => drawFate('survivor', [], { lockedCharacterId: killer.id })).toThrow('locked character')
  expect(() => drawFate('survivor', [survivor.id], { lockedCharacterId: survivor.id })).toThrow('locked character')
  expect(() => drawFate('survivor', [], { lockedPerks: [killerPerk.id] })).toThrow('Locked perks')
  expect(() => drawFate('survivor', [], { excludedPerks: [perks[0].id], lockedPerks: [perks[0].id] })).toThrow('Locked perks')
  expect(() => drawFate('survivor', [], { lockedPerks: [perks[0].id, perks[0].id] })).toThrow('unique')
  expect(() => drawFate('survivor', [], { lockedPerks: [null, null, null, null, null] })).toThrow('Only four')
})
