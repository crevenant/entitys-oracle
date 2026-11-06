import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'

const root = fileURLToPath(new URL('../', import.meta.url))
const load = async (name, url) => {
  if (!process.argv.includes('--refresh')) {
    try { return JSON.parse(await readFile(path.join(root, `scripts/${name}-source.json`), 'utf8')) } catch { /* Fetch below. */ }
  }
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  return response.json()
}
const [characters, perks, images] = await Promise.all([
  load('characters', 'https://dbd.tricky.lol/api/characters'),
  load('perks', 'https://dbd.tricky.lol/api/perks'),
  load('images', 'https://api.github.com/repos/Zawgalicious/DBDImages/git/trees/main?recursive=1'),
])
const slug = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '')
const paths = new Set(images.tree.map((entry) => entry.path))
const assets = []
const find = (kind, role, name) => {
  const candidates = [name, name.replace(/^The /, ''), name.replace(/^Hex: /, ''), name.replace(/^Scourge Hook: /, '')]
  const aliases = { 'William "Bill" Overbeck': 'billoverbeck', 'Ashley J. Williams': 'ashwilliams', 'The Ghost Face': 'ghostface' }
  if (aliases[name]) candidates.unshift(aliases[name])
  for (const candidate of candidates) {
    const remote = `images/${kind}/${role}/${slug(candidate)}.png`
    if (paths.has(remote)) {
      const local = `/assets/${kind}/${role}-${slug(candidate)}.webp`
      assets.push({ remote, local })
      return local
    }
  }
  return null
}
const clean = (text = '') => text.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/li>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim()
const catalog = {
  importedAt: new Date().toISOString(),
  sources: { data: 'https://dbd.tricky.lol', artwork: 'https://github.com/Zawgalicious/DBDImages', artworkTree: images.sha },
  characters: Object.entries(characters).flatMap(([id, entry]) => {
    const image = find('characters', entry.role, entry.name)
    return image ? [{ id, name: entry.name, role: entry.role, image, bio: clean(entry.bio).split('\n')[0] }] : []
  }),
  perks: Object.entries(perks).flatMap(([id, entry]) => {
    const image = find('perks', entry.role, entry.name)
    let description = entry.description
    for (const [key, values] of Object.entries(entry.tunables ?? {})) {
      const value = Array.isArray(values) ? values.at(-1) : values
      description = description.replaceAll(new RegExp(`\\{Tunable\\.[^}]*?${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'gi'), String(value))
    }
    description = clean(description).replace(/\{[^}]+\}/g, '—')
    return image ? [{ id, name: entry.name, role: entry.role, image, description, tier: 3 }] : []
  }),
}
let completed = 0
const queue = [...new Map(assets.map((asset) => [asset.local, asset])).values()]
await Promise.all(Array.from({ length: 10 }, async () => {
  while (queue.length) {
    const asset = queue.shift()
    const target = path.join(root, 'public', asset.local)
    await mkdir(path.dirname(target), { recursive: true })
    try { await readFile(target); completed++; continue } catch { /* Download below. */ }
    let bytes
    try { bytes = await readFile(target.replace(/\.webp$/, '.png')) } catch {
      const response = await fetch(`https://raw.githubusercontent.com/Zawgalicious/DBDImages/main/${asset.remote}`)
      if (!response.ok) throw new Error(`${asset.remote}: ${response.status}`)
      bytes = Buffer.from(await response.arrayBuffer())
    }
    await sharp(bytes).webp({ quality: 87 }).toFile(target)
    completed++
  }
}))
await writeFile(path.join(root, 'src/catalog.json'), JSON.stringify(catalog, null, 2) + '\n')
console.log(`Imported ${catalog.characters.length} characters, ${catalog.perks.length} perks, ${completed} local assets.`)
