import { test, expect } from '@playwright/test'
import { stat } from 'node:fs/promises'
import { catalog } from '../src/lib/oracle'
import { portraitClips } from '../src/lib/portraitClips'

test.use({ serviceWorkers: 'block' })

test('every catalog survivor has a local playable portrait and killers keep their stills', async ({ page }) => {
  test.setTimeout(60000)
  const survivors = catalog.characters.filter(c => c.role === 'survivor')
  expect(Object.keys(portraitClips).sort()).toEqual(survivors.map(c => c.id).sort())
  for (const character of survivors) {
    const clip = portraitClips[character.id]!
    expect((await stat(`public${clip.src}`)).size).toBeGreaterThan(1000)
    expect((await stat(`public${clip.poster}`)).size).toBeGreaterThan(1000)
  }
  await page.route('**/portrait-audit', route => route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' }))
  await page.goto('/portrait-audit')
  const results = await page.evaluate(async clips => {
    const results = []
    for (const [id, clip] of Object.entries(clips)) {
      if (!clip) continue
      const player = document.createElement('video')
      player.muted = true; player.playsInline = true; player.loop = true
      document.body.append(player)
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`Portrait ${id} timed out`)), 5000)
        player.onloadeddata = () => { clearTimeout(timeout); resolve() }
        player.onerror = () => { clearTimeout(timeout); reject(new Error(`Portrait ${id} failed`)) }
        player.src = clip.src
      })
      await player.play()
      await new Promise(resolve => setTimeout(resolve, 150))
      results.push({ id, duration: player.duration, width: player.videoWidth, height: player.videoHeight, moving: player.currentTime > 0 && !player.paused })
      player.pause(); player.removeAttribute('src'); player.load(); player.remove()
    }
    return results
  }, portraitClips)
  expect(results).toHaveLength(survivors.length)
  for (const result of results) expect(result, `Portrait ${result.id}`).toMatchObject({ duration: 8, width: 512, height: 512, moving: true })
})
