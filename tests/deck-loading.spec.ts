import { test, expect } from '@playwright/test'

for (const reduced of [false, true]) {
  test(`loading covers the lazy scene and artwork until the rendered deck is ready (${reduced ? 'reduced' : 'full'} motion)`, async ({ page }, testInfo) => {
    await page.addInitScript((motion) => localStorage.setItem('oracle:preferences', JSON.stringify({ motion, music: false, sound: false })), reduced ? 'reduced' : 'full')
    let releaseModule!: () => void
    let releaseArtwork!: () => void
    const moduleGate = new Promise<void>((resolve) => { releaseModule = resolve })
    const artworkGate = new Promise<void>((resolve) => { releaseArtwork = resolve })
    await page.route('**/assets/CardScene-*.js', async (route) => { await moduleGate; await route.continue() })
    await page.route('**/assets/tarot-back-worn.webp', async (route) => { await artworkGate; await route.continue() })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    try {
      await page.goto('/', { waitUntil: 'domcontentloaded' })
      const loader = page.locator('.deck-loading')
      const draw = page.getByRole('button', { name: 'Answer the summons' })
      await expect(loader).toBeVisible()
      await expect(draw).toBeDisabled()
      await expect(page.locator('.card-stage')).toHaveAttribute('aria-busy', 'true')
      await expect(page.locator('canvas')).toHaveCount(0)
      expect(await page.locator('.deck-loading-orbit').first().evaluate((element) => getComputedStyle(element).animationName)).toBe(reduced ? 'none' : 'deck-loading-orbit')
      if (!reduced) await page.screenshot({ path: `output/screenshots/${testInfo.project.name}-deck-loading.png`, fullPage: true })

      releaseModule()
      await expect(page.locator('.scene-container canvas')).toHaveCount(1)
      await expect(loader).toBeVisible()
      await expect(draw).toBeDisabled()
      await expect(page.locator('.fallback-cards')).toHaveCount(0)
      expect(await page.locator('.scene-container').evaluate((element) => getComputedStyle(element).opacity)).toBe('0')

      releaseArtwork()
      await expect(loader).toHaveCount(0)
      await expect(page.locator('[data-ready=true]')).toBeVisible()
      await expect(page.locator('.card-stage')).toHaveAttribute('aria-busy', 'false')
      await expect(draw).toBeEnabled()
      await expect.poll(() => page.locator('.scene-container').evaluate((element) => getComputedStyle(element).opacity)).toBe('1')
      if (!reduced) await page.screenshot({ path: `output/screenshots/${testInfo.project.name}-deck-ready.png`, fullPage: true })
      await draw.click()
      if (!reduced) await page.getByRole('button', { name: 'Skip the ritual' }).click()
      await expect(page.getByRole('button', { name: 'Tempt fate again' })).toBeEnabled()
      expect(errors).toEqual([])
    } finally {
      releaseModule()
      releaseArtwork()
    }
  })
}

test('devices without WebGL keep loading until fallback artwork is decoded', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('oracle:preferences', JSON.stringify({ motion: 'reduced', music: false, sound: false }))
    const original = HTMLCanvasElement.prototype.getContext
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: function (id: string, ...args: unknown[]) {
      return id.includes('webgl') ? null : Reflect.apply(original, this, [id, ...args])
    } })
  })
  let releaseArtwork!: () => void
  const gate = new Promise<void>((resolve) => { releaseArtwork = resolve })
  await page.route('**/assets/tarot-back-worn.webp', async (route) => { await gate; await route.continue() })
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.fallback-cards')).toHaveCount(1)
    await expect(page.locator('.deck-loading')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Answer the summons' })).toBeDisabled()
    releaseArtwork()
    await expect(page.locator('.deck-loading')).toHaveCount(0)
    await expect(page.locator('.fallback-cards')).toBeVisible()
    await page.getByRole('button', { name: 'Answer the summons' }).click()
    await expect(page.getByRole('button', { name: 'Tempt fate again' })).toBeEnabled()
  } finally { releaseArtwork() }
})
