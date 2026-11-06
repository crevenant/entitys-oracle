import { test, expect } from '@playwright/test'

test('one card click escalates the Entity three times and shoves the same fate into a usable close-up', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('oracle:preferences', JSON.stringify({ motion: 'full', music: false, sound: false })))
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await page.getByRole('button', { name: 'Seal your fate' }).click()
  const challenge = page.getByRole('button', { name: 'Challenge the Entity for a closer look' })
  await expect(challenge).toBeEnabled({ timeout: 8000 })
  const original = await page.locator('.reveal-front').boundingBox()
  const names = await page.locator('.reveal-front .card-perks button').evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')))
  await challenge.click()
  for (const level of ['1', '2', '3']) await expect(page.locator('.reveal-shell')).toHaveAttribute('data-resistance', level)
  await expect(page.locator('.reveal-shell')).toHaveAttribute('data-resistance', 'forcing')
  const shove = await page.locator('.captive-card').evaluate(async (element) => {
    const depths: number[] = []
    for (let index = 0; index < 24; index++) {
      depths.push(new DOMMatrixReadOnly(getComputedStyle(element).transform).m43)
      await new Promise((resolve) => setTimeout(resolve, 30))
    }
    return depths
  })
  expect(Math.min(...shove)).toBeLessThan(-8)
  expect(Math.max(...shove)).toBeGreaterThan(180)
  const closeup = page.getByRole('dialog', { name: /card enlarged$/ })
  await expect(closeup).toBeVisible()
  await expect(closeup).toHaveAttribute('data-zoom', 'ready')
  const enlarged = await page.locator('.closeup-face').boundingBox()
  expect(enlarged!.width).toBeGreaterThan(original!.width * 1.5)
  const viewport = page.viewportSize()!
  expect(enlarged!.x).toBeGreaterThanOrEqual(12)
  expect(enlarged!.x + enlarged!.width).toBeLessThanOrEqual(viewport.width - 12)
  expect(enlarged!.y).toBeGreaterThanOrEqual(20)
  expect(enlarged!.y + enlarged!.height).toBeLessThanOrEqual(viewport.height - 40)
  expect(await closeup.locator('.card-perks button').evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')))).toEqual(names)
  await closeup.getByRole('button', { name: /^View/ }).first().click()
  await expect(page.getByRole('dialog', { name: 'Perk details' })).toBeVisible()
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await expect(closeup).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(closeup).toHaveCount(0)
  await expect(challenge).toBeFocused()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('oracle:history')!).length)).toBe(1)
  expect(errors).toEqual([])
})

test('Reduced effects opens a still close-up by keyboard, fits after resizing, and dismisses outside', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('oracle:preferences', JSON.stringify({ motion: 'reduced', music: false, sound: false })))
  await page.goto('/')
  await page.getByRole('button', { name: 'Seal your fate' }).click()
  const enlarge = page.getByRole('button', { name: 'Enlarge character card' })
  await expect(enlarge).toBeEnabled()
  await enlarge.press('Enter')
  const closeup = page.getByRole('dialog', { name: /card enlarged$/ })
  await expect(closeup).toBeVisible({ timeout: 1000 })
  await expect(closeup).toHaveAttribute('data-zoom', 'ready')
  await expect(page.locator('.reveal-shell')).not.toHaveAttribute('data-resistance', /[123]/)
  await page.setViewportSize({ width: 350, height: 700 })
  await expect.poll(async () => {
    const bounds = await page.locator('.closeup-face').boundingBox()
    return !!bounds && bounds.x >= 12 && bounds.x + bounds.width <= 338 && bounds.y >= 20 && bounds.y + bounds.height <= 660
  }).toBe(true)
  await closeup.click({ position: { x: 6, y: 6 } })
  await expect(closeup).toHaveCount(0)
  await expect(enlarge).toBeFocused()
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
})
