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
