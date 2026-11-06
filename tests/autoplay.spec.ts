import { test, expect } from '@playwright/test'
test.use({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } })

test('starts the audible theme without a click or draw', async ({ page }) => {
  await page.goto('/')
  const theme = page.locator('audio[data-background-theme]')
  await expect(theme).toHaveAttribute('autoplay', '')
  await expect(theme).toHaveAttribute('preload', 'auto')
  await expect(theme).toHaveAttribute('data-state', 'playing')
  await expect.poll(() => theme.evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(.05)
  await expect(page.locator('.card-stage')).toHaveAttribute('data-phase', 'idle')
  await expect(page.getByRole('button', { name: 'Start background theme' })).toHaveCount(0)
})

for (const preference of ['music-off', 'muted']) test(`page load respects saved ${preference}`, async ({ page }) => {
  await page.addInitScript((preference) => localStorage.setItem('oracle:preferences', JSON.stringify({ music: preference !== 'music-off', muted: preference === 'muted' })), preference)
  await page.goto('/')
  const theme = page.locator('audio[data-background-theme]')
  await expect(theme).not.toHaveAttribute('autoplay', '')
  await expect(theme).toHaveAttribute('preload', 'none')
  await expect(theme).toHaveAttribute('data-state', 'paused')
  expect(await theme.evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true)
})
