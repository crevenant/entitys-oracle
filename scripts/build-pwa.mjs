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
const isOlderCache = key => key !== CACHE && (key.startsWith(CACHE_PREFIX) || (new URL(HOME).pathname === '/' && /^oracle-[0-9a-f]{12}$/.test(key)));
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (let i = 0; i < FILES.length; i += 20) await cache.addAll(FILES.slice(i, i + 20));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // An open tab may still need a lazy chunk from the preceding release.
    const older = (await caches.keys()).filter(isOlderCache);
    await Promise.all(older.slice(0, -1).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request, { cache: 'no-cache' }).catch(async () => {
      const cached = await (await caches.open(CACHE)).match(HOME);
      return cached || Response.error();
    }));
    return;
  }
  // Static same-origin assets are identical with or without the browser's Origin header.
  event.respondWith((async () => {
    const cached = await caches.match(event.request, { cacheName: CACHE, ignoreVary: true });
    if (cached) return cached;
    const previous = (await caches.keys()).filter(isOlderCache).at(-1);
    const earlier = previous && await caches.match(event.request, { cacheName: previous, ignoreVary: true });
    return earlier || fetch(event.request);
  })());
});
`)
  console.log(`Offline cache: ${files.length} files (oracle-${version}).`)
}
