import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { catalog } from '../src/lib/oracle'

// Network failures must reach the player rather than the offline asset cache.
test.use({ serviceWorkers: 'block' })

async function setup(page: Page, motion = 'full', id = '40') {
  await page.addInitScript(({ motion, excluded }) => {
    localStorage.setItem('oracle:preferences', JSON.stringify({ motion, music: false, sound: false }))
    localStorage.setItem('oracle:excluded', JSON.stringify(excluded))
  }, { motion, excluded: catalog.characters.filter((entry) => entry.id !== id).map((entry) => entry.id) })
  await page.goto('/')
  await page.getByRole('button', { name: 'Seal your fate' }).click()
}

test('Sable plays a silent inline loop and transfers playback to and from her close-up', async ({ page }, testInfo) => {
  await setup(page)
  const main = page.locator('.reveal-front .portrait-media')
  await expect(main).toHaveAttribute('data-portrait-mode', 'video', { timeout: 10000 })
  const player = main.locator('video')
  await expect.poll(() => player.evaluate((video: HTMLVideoElement) => !video.paused && video.currentTime > .4)).toBe(true)
  expect(await player.evaluate((video: HTMLVideoElement) => ({ muted: video.muted, inline: video.playsInline, loop: video.loop, duration: video.duration })))
    .toEqual({ muted: true, inline: true, loop: true, duration: 8 })
  await expect(main.locator('img')).toHaveCSS('opacity', '0')
  await player.evaluate((video: HTMLVideoElement) => {
    const sample = () => {
      if (!video.isConnected) return
      if (!video.paused) sessionStorage.setItem('portrait-paused-at', String(video.currentTime))
      requestAnimationFrame(sample)
    }
    sample()
  })
  const challenge = page.getByRole('button', { name: 'Challenge the Entity for a closer look' })
  await expect(challenge).toBeEnabled({ timeout: 8000 })
  await challenge.click()
  const closeup = page.getByRole('dialog', { name: /card enlarged$/ })
  await expect(closeup).toBeVisible({ timeout: 6000 })
  const enlarged = closeup.locator('video')
  await expect(closeup.locator('.portrait-media')).toHaveAttribute('data-portrait-mode', 'video')
  await expect(page.locator('video')).toHaveCount(1)
  await expect(main).toHaveAttribute('data-portrait-mode', 'still')
  const transferred = await enlarged.evaluate((video: HTMLVideoElement) => ({ time: video.currentTime, previous: Number(sessionStorage.getItem('portrait-paused-at')) }))
  expect((transferred.time - transferred.previous + 8) % 8).toBeLessThan(1)
  await expect(closeup).toHaveAttribute('data-zoom', 'ready')
  await page.screenshot({ path: `output/screenshots/${testInfo.project.name}-sable-portrait.png` })
  const before = await enlarged.evaluate((video: HTMLVideoElement) => video.currentTime)
  await page.keyboard.press('Escape')
  await expect(main).toHaveAttribute('data-portrait-mode', 'video')
  const after = await player.evaluate((video: HTMLVideoElement) => video.currentTime)
  expect((after - before + 8) % 8).toBeLessThan(1)
})

test('Reduced effects keeps Sable’s original artwork without requesting her video', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => { if (request.url().includes('portrait-clips/')) requests.push(request.url()) })
  await setup(page, 'reduced')
  await expect(page.locator('.reveal-front .portrait-media')).toHaveAttribute('data-portrait-mode', 'still')
  await page.getByRole('button', { name: 'Enlarge character card' }).click()
  await expect(page.locator('.closeup-face .character-portrait')).toHaveAttribute('src', '/assets/characters/survivor-sableward.webp')
  await expect(page.locator('video')).toHaveCount(0)
  expect(requests).toEqual([])
})

test('a failed portrait video falls back to the original game still', async ({ page }) => {
  await page.route('**/portrait-clips/*.mp4', (route) => route.abort())
  await setup(page)
  const portrait = page.locator('.reveal-front .portrait-media')
  await expect(portrait).toHaveAttribute('data-portrait-mode', 'fallback', { timeout: 10000 })
  await expect(portrait.locator('img')).toHaveAttribute('src', '/assets/characters/survivor-sableward.webp')
  await expect(portrait.locator('video')).toHaveCount(0)
})
