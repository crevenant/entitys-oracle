import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

test.use({ serviceWorkers: 'block' })

const frames = (page: Page) => page.locator('.forest-animation, .headline-canvas').evaluateAll((nodes) => nodes.map((node) => (node as HTMLCanvasElement).toDataURL()))

test('the living forest animates aligned patches and pauses while hidden', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => localStorage.setItem('oracle:preferences', JSON.stringify({ motion: 'full', music: false })))
  await page.goto('/')
  const group = page.locator('.campfire-survivors')
  await expect(group).toHaveCSS('--campfire-frame', '14')
  await page.locator('.killer-choice').click()
  await expect(group).toHaveCSS('--campfire-frame', '0')
  const initial = await frames(page)
  await expect.poll(async () => (await frames(page)).every((frame, index) => frame !== initial[index])).toBe(true)

  // The crop must match after crossing the mobile source and positioning breakpoints.
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport)
    await expect.poll(() => page.locator('.forest-distance img').evaluate((img) => (img as HTMLImageElement).complete)).toBe(true)
    const bounds = await page.locator('.forest-distance img').evaluate((img) => {
      const plate = img.getBoundingClientRect()
      const fire = document.querySelector('.forest-fire')!.getBoundingClientRect()
      return { width: plate.width, height: plate.height, fireX: (fire.x - plate.x) / plate.width, fireY: (fire.y - plate.y) / plate.height }
    })
    expect(bounds.width / bounds.height).toBeCloseTo(1672 / 941, 3)
    expect(bounds.fireX).toBeCloseTo(1090 / 1672, 3)
    expect(bounds.fireY).toBeCloseTo(410 / 941, 3)
  }

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  const paused = await frames(page)
  await page.waitForTimeout(180)
  expect(await frames(page)).toEqual(paused)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(async () => (await frames(page)).every((frame, index) => frame !== paused[index])).toBe(true)

  await page.getByRole('button', { name: 'Options', exact: true }).click()

  await page.getByRole('button', { name: 'Open settings' }).click()
  await page.getByRole('button', { name: 'Reduced effects', exact: true }).click()
  await expect(page.locator('.forest-animation').first()).toBeHidden()
  await expect(page.locator('.headline-canvas')).toBeHidden()
  await expect(page.locator('.headline-art')).toBeVisible()
  const still = await frames(page)
  await page.waitForTimeout(180)
  expect(await frames(page)).toEqual(still)
  await page.getByRole('button', { name: 'Full ritual', exact: true }).click()
  await expect(page.locator('.forest-animation').first()).toBeVisible()
  await expect.poll(async () => (await frames(page)).every((frame, index) => frame !== still[index])).toBe(true)
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await page.locator('.survivor-choice').click()
  await expect(group).toHaveCSS('--campfire-frame', '14')
  await expect(page.locator('.campfire-conversation')).toHaveCSS('opacity', '1')
  expect(errors).toEqual([])
})

test('device reduced motion starts with the original still background', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => localStorage.setItem('oracle:preferences', JSON.stringify({ motion: 'system', music: false })))
  await page.goto('/')
  await expect(page.locator('.forest-animation').first()).toBeHidden()
  await expect(page.locator('.forest-distance img')).toBeVisible()
  const still = await frames(page)
  await page.waitForTimeout(180)
  expect(await frames(page)).toEqual(still)
})
