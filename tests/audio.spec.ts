import { test, expect } from '@playwright/test'

test('background theme has independent saved controls and master mute pauses it', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Open settings' }).click()
  const theme = page.locator('audio[data-background-theme]')
  const music = page.getByRole('checkbox', { name: /Background theme/ })
  const volume = page.getByRole('slider', { name: 'Music volume' })
  await expect(music).toBeChecked()
  await expect(theme).toHaveAttribute('data-state', 'playing')
  expect(await theme.evaluate((audio: HTMLAudioElement) => audio.loop)).toBe(true)
  await volume.press('Home')
  for (let index = 0; index < 9; index++) await volume.press('ArrowRight')
  await expect(volume).toHaveValue('45')
  await page.reload()
  await page.getByRole('button', { name: 'Open settings' }).click()
  await expect(volume).toHaveValue('45')
  await expect(theme).toHaveAttribute('data-state', 'playing')
  await page.getByRole('checkbox', { name: /Ritual sound/ }).uncheck()
  await expect(theme).toHaveAttribute('data-state', 'playing')
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await page.getByRole('button', { name: 'Mute all sound' }).click()
  await expect.poll(() => theme.evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true)
  const pausedAt = await theme.evaluate((audio: HTMLAudioElement) => audio.currentTime)
  await page.getByRole('button', { name: 'Unmute all sound' }).click()
  await expect(theme).toHaveAttribute('data-state', 'playing')
  await expect.poll(() => theme.evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(pausedAt)
  await page.getByRole('button', { name: 'Open settings' }).click()
  await music.uncheck()
  await expect(volume).toBeDisabled()
  await expect.poll(() => theme.evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true)
  await page.reload()
  await page.getByRole('button', { name: 'Open settings' }).click()
  await expect(music).not.toBeChecked()
  await expect(volume).toHaveValue('45')
})

test('music ducks for a draw, continues after skip, and pauses when hidden', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('oracle:preferences', JSON.stringify({ sound: true, volume: .75, music: true, musicVolume: .4, motion: 'full' }))
    const original = AudioContext.prototype.createMediaElementSource
    AudioContext.prototype.createMediaElementSource = function (element) {
      const source = original.call(this, element)
      const connect = source.connect
      source.connect = function (...args: Parameters<typeof connect>) {
        if (args[0] instanceof GainNode) Object.assign(window, { oracleMusicGain: args[0].gain })
        return Reflect.apply(connect, this, args)
      } as typeof connect
      return source
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open settings' }).click()
  await page.getByRole('button', { name: 'Close dialog' }).click()
  const theme = page.locator('audio[data-background-theme]')
  const level = () => page.evaluate(() => (window as unknown as { oracleMusicGain: AudioParam }).oracleMusicGain.value)
  await expect.poll(level).toBeCloseTo(.4, 2)
  const start = await theme.evaluate((audio: HTMLAudioElement) => audio.currentTime)
  await page.getByRole('button', { name: 'Draw your fate' }).click()
  await expect.poll(level).toBeCloseTo(.128, 2)
  await expect.poll(() => theme.evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(start)
  await page.getByRole('button', { name: 'Skip the ritual' }).click()
  await expect.poll(level).toBeCloseTo(.4, 2)
  await expect(theme).toHaveAttribute('data-state', 'playing')
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(() => theme.evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(theme).toHaveAttribute('data-state', 'playing')
})

test('cached theme plays offline and loops at the end of the track', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }))
  })
  await context.setOffline(true)
  await page.reload()
  await page.getByRole('button', { name: 'Open settings' }).click()
  const theme = page.locator('audio[data-background-theme]')
  await expect(theme).toHaveAttribute('data-state', 'playing')
  await expect.poll(() => theme.evaluate((audio: HTMLAudioElement) => audio.duration)).toBeGreaterThan(300)
  await theme.evaluate((audio: HTMLAudioElement) => { audio.currentTime = audio.duration - .3 })
  await expect.poll(() => theme.evaluate((audio: HTMLAudioElement) => audio.currentTime), { timeout: 8000 }).toBeLessThan(3)
  await expect(theme).toHaveAttribute('data-state', 'playing')
  expect(await theme.evaluate((audio: HTMLAudioElement) => audio.error)).toBe(null)
})
