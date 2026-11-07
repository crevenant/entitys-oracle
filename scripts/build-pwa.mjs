import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join, relative } from 'node:path'
import sharp from 'sharp'

await mkdir('public/icons', { recursive: true })
const icon = await readFile('public/favicon.svg')
for (const [name, size] of [['oracle-192', 192], ['oracle-512', 512], ['oracle-maskable', 512]]) {
  await sharp(icon).resize(size, size).png().toFile(`public/icons/${name}.png`)
}

if (!process.argv.includes('--icons-only')) {
  const paths = await readdir('dist', { recursive: true, withFileTypes: true })
  const files = paths.filter((entry) => entry.isFile() && entry.name !== 'sw.js')
    .map((entry) => relative('dist', join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
  const hash = createHash('sha256')
  for (const file of files.sort()) hash.update(await readFile(join('dist', file)))
  const version = hash.digest('hex').slice(0, 12)
  await writeFile('dist/sw.js', `const HOME = self.registration.scope;
const CACHE_PREFIX = 'oracle-' + HOME + '-';
const CACHE = CACHE_PREFIX + ${JSON.stringify(version)};
const FILES = ${JSON.stringify(['./', ...files])}.map(file => new URL(file, HOME).href);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (let i = 0; i < FILES.length; i += 20) await cache.addAll(FILES.slice(i, i + 20));
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      const legacy = new URL(HOME).pathname === '/' && /^oracle-[0-9a-f]{12}$/.test(key);
      if (key !== CACHE && (key.startsWith(CACHE_PREFIX) || legacy)) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const key = event.request.mode === 'navigate' ? HOME : event.request;
  // Static same-origin assets are identical with or without the browser's Origin header.
  event.respondWith(caches.open(CACHE).then(cache => cache.match(key, { ignoreVary: true })).then(cached => cached || fetch(event.request)));
});
`)
  console.log(`Offline cache: ${files.length} files (oracle-${version}).`)
}
