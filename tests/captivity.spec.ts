import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('oracle:preferences', JSON.stringify({ motion: 'full', music: false, sound: false })))
})

test('the slam destroys the other cards, the Entity captures the chosen card, and perks stay usable', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error' && /THREE|shader|GLSL/i.test(message.text())) errors.push(message.text()) })
  await page.goto('/')
  await page.getByRole('button', { name: 'Seal your fate' }).click()
  const stage = page.locator('.card-stage')
  await expect(stage).toHaveAttribute('data-phase', 'flipping', { timeout: 7000 })
  await expect(stage).toHaveAttribute('data-captivity', 'idle')
  await expect(stage).toHaveAttribute('data-captivity', 'shattering', { timeout: 2500 })
  await expect(stage).toHaveAttribute('data-captivity', 'reaching')
  await expect(stage).toHaveAttribute('data-captivity', 'held')
  const movement = await page.locator('.captive-card').evaluate(async (element) => {
    const values = []
    for (let index = 0; index < 65; index++) {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
      values.push({ x: matrix.m41, y: matrix.m42, z: matrix.m43, roll: Math.atan2(matrix.m12, matrix.m11), pitch: matrix.m23, yaw: matrix.m13 })
      await new Promise((resolve) => setTimeout(resolve, 35))
    }
    return values
  })
  expect(movement.some((value) => Math.abs(value.x) > .3)).toBe(true)
  expect(movement.some((value) => Math.abs(value.z) > 3)).toBe(true)
  expect(movement.some((value) => Math.abs(value.pitch) > .04 && Math.abs(value.yaw) > .04)).toBe(true)
  expect(movement.every((value) => Math.abs(value.x) < 3 && Math.abs(value.y) < 2 && Math.abs(value.z) <= 16 && Math.abs(value.roll) < .05)).toBe(true)
  expect(await page.locator('.scene-container').evaluate((element) => getComputedStyle(element).pointerEvents)).toBe('none')
  await page.getByRole('button', { name: /^View .+, tier III$/ }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(errors).toEqual([])
})

test('the flat-card fallback shatters and captures, and Skip clears the capture without a late restart', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: function (id: string, ...args: unknown[]) {
      return id.includes('webgl') ? null : Reflect.apply(original, this, [id, ...args])
    } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Seal your fate' }).click()
  const stage = page.locator('.card-stage')
  await expect(stage).toHaveAttribute('data-captivity', 'shattering', { timeout: 8000 })
  await expect(page.locator('.flat-card-fragments')).toHaveCount(4)
  await expect(stage).toHaveAttribute('data-captivity', 'held')
  expect(await page.locator('.fallback-entity-grasp').evaluate((element) => Number(getComputedStyle(element).opacity))).toBeGreaterThan(.9)
  await expect.poll(() => page.locator('.flat-card-fragments i').first().evaluate((element) => Number(getComputedStyle(element).opacity))).toBe(0)
  await page.getByRole('button', { name: 'Tempt fate again' }).click()
  await expect(stage).toHaveAttribute('data-captivity', 'idle')
  await page.getByRole('button', { name: 'Skip the ritual' }).click()
  await expect(stage).toHaveAttribute('data-phase', 'complete')
  await expect(stage).toHaveAttribute('data-captivity', 'idle')
  await expect(page.locator('.flat-card-fragments')).toHaveCount(0)
  await expect(page.locator('.fallback-entity-grasp')).toHaveCount(0)
  expect(await page.locator('.captive-card').evaluate((element) => getComputedStyle(element).transform)).toBe('none')
  await page.waitForTimeout(1700)
  await expect(stage).toHaveAttribute('data-captivity', 'idle')
})
