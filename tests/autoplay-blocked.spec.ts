import { test, expect } from '@playwright/test'
test.use({ launchOptions: { args: ['--autoplay-policy=document-user-activation-required', '--disable-features=PreloadMediaEngagementData,MediaEngagementBypassAutoplayPolicies'] } })

test('offers one tap to start the theme without drawing', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  const theme = page.locator('audio[data-background-theme]')
  await expect(page.getByRole('button', { name: 'Start background theme' })).toBeVisible()
  await expect(theme).toHaveAttribute('data-state', 'waiting')
  // Native autoplay may unlock on pointer-down and remove this button before
  // a locator finishes clicking it. Send one physical tap without retrying it.
  const bounds = await page.getByRole('button', { name: 'Start background theme' }).boundingBox()
  // Playback may also become allowed while the media finishes loading.
  if (bounds) await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await expect(theme).toHaveAttribute('data-state', 'playing')
  await expect.poll(() => theme.evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(.05)
  await expect(page.locator('.card-stage')).toHaveAttribute('data-phase', 'idle')
  expect(errors).toEqual([])
})
