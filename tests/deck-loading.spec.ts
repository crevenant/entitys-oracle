import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

async function clickOuterCard(page: Page) {
  const stage = page.locator('.card-stage')
  await stage.scrollIntoViewIfNeeded()
  const { x, y, width, height } = (await stage.boundingBox())!
  await page.mouse.click(x + width / 2 - height * .43, y + height / 2)
}

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
      const draw = page.locator('.draw-button')
      const intro = page.locator('.ritual-intro')
      const controls = page.locator('.draw-controls')
      await expect(loader).toBeVisible()
      await expect(intro).toBeHidden()
      await expect(controls).toBeHidden()
      await expect(page.locator('.ritual-chapter')).toBeHidden()
      await expect(draw).toBeDisabled()
      await expect(page.locator('.card-stage')).toHaveAttribute('aria-busy', 'true')
      await expect(page.locator('.scene-container canvas')).toHaveCount(0)
      expect(await page.locator('.deck-loading-orbit').first().evaluate((element) => getComputedStyle(element).animationName)).toBe(reduced ? 'none' : 'deck-loading-orbit')
      if (!reduced) await page.screenshot({ path: `output/screenshots/${testInfo.project.name}-deck-loading.png`, fullPage: true })

      releaseModule()
      await expect(page.locator('.scene-container canvas')).toHaveCount(1)
      await expect(loader).toBeVisible()
      await expect(intro).toBeHidden()
      await expect(controls).toBeHidden()
      await expect(draw).toBeDisabled()
      await expect(page.locator('.fallback-cards')).toHaveCount(0)
      expect(await page.locator('.scene-container').evaluate((element) => getComputedStyle(element).opacity)).toBe('0')

      releaseArtwork()
      await expect(loader).toHaveCount(0)
      await expect(page.locator('[data-ready=true]')).toBeVisible()
      await expect(page.locator('.card-stage')).toHaveAttribute('aria-busy', 'false')
      await expect(page.getByRole('heading', { name: 'Draw a fate you can’t escape.' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Options', exact: true })).toBeVisible()
      if (reduced) await expect(controls).toHaveCSS('transition-duration', '0s')
      else await expect(controls).toHaveCSS('transition-property', /opacity/)
      await expect(intro).toHaveCSS('opacity', '1')
      await expect(controls).toHaveCSS('opacity', '1')
      await expect(draw).toBeEnabled()
      await expect.poll(() => page.locator('.scene-container').evaluate((element) => getComputedStyle(element).opacity)).toBe('1')
      if (!reduced) await page.screenshot({ path: `output/screenshots/${testInfo.project.name}-deck-ready.png`, fullPage: true })
      await clickOuterCard(page)
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
    await expect(page.locator('.draw-button')).toBeHidden()
    await expect(page.locator('.draw-button')).toBeDisabled()
    releaseArtwork()
    await expect(page.locator('.deck-loading')).toHaveCount(0)
    await expect(page.locator('.fallback-cards')).toBeVisible()
    await clickOuterCard(page)
    await expect(page.getByRole('button', { name: 'Tempt fate again' })).toBeEnabled()
  } finally { releaseArtwork() }
})
