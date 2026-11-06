import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

async function observeAudio(page: Page) {
  await page.addInitScript(() => {
    const stats = { started: 0, active: 0 }
    Object.assign(window, { oracleAudioStats: stats })
    for (const method of ['createOscillator', 'createBufferSource'] as const) {
      const original = AudioContext.prototype[method]
      Object.defineProperty(AudioContext.prototype, method, {
        value: function (...args: unknown[]) {
          const source = Reflect.apply(original, this, args) as AudioScheduledSourceNode
          const start = source.start
          source.start = function (...values: number[]) {
            stats.started++
            stats.active++
            source.addEventListener('ended', () => stats.active--, { once: true })
            return Reflect.apply(start, this, values)
          }
          return source
        },
      })
    }
  })
  return () => page.evaluate(() => (window as unknown as { oracleAudioStats: { started: number; active: number } }).oracleAudioStats)
}

test('draw, inspect perks, and revisit saved history', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'The fog has plans for you.' })).toBeVisible()
  await expect(page.locator('[data-ready] canvas')).toBeVisible()
  await expect(page.locator('[data-ready=true]')).toBeVisible()
  await page.screenshot({ path: `output/screenshots/${testInfo.project.name}-ritual.png`, fullPage: true })
  await page.screenshot({ path: `output/screenshots/${testInfo.project.name}-forest-viewport.png`, fullPage: false })
  await page.evaluate(() => {
    const stage = document.querySelector('.card-stage')!
    const phases: string[] = []
    const gifts: number[] = []
    Object.assign(window, { observedRitualPhases: phases, observedRitualGifts: gifts })
    new MutationObserver(() => {
      const phase = stage.getAttribute('data-phase')!
      if (phases.at(-1) !== phase) phases.push(phase)
    }).observe(stage, { attributes: true, attributeFilter: ['data-phase'] })
    new MutationObserver(() => {
      const count = stage.querySelectorAll('.card-perk-slot.is-awakened').length
      if (count > 0 && gifts.at(-1) !== count) gifts.push(count)
    }).observe(stage, { attributes: true, childList: true, subtree: true, attributeFilter: ['class'] })
  })
  await page.getByRole('button', { name: 'Answer the summons' }).click()
  await expect(page.getByRole('button', { name: 'Consulting the Entity' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Killer', exact: true })).toBeDisabled()
  await expect(page.locator('.card-stage')).toHaveAttribute('data-phase', 'orbiting', { timeout: 4000 })
  await page.screenshot({ path: `output/screenshots/${testInfo.project.name}-orbit.png`, fullPage: true })
  // A phone screenshot can outlast the short choosing phase. Verify the recorded
  // transition so a slow capture cannot mistake a completed phase for a missing one.
  await expect.poll(() => page.evaluate(() => (window as unknown as { observedRitualPhases: string[] }).observedRitualPhases.includes('choosing'))).toBe(true)
  await page.screenshot({ path: `output/screenshots/${testInfo.project.name}-entity-reach.png`, fullPage: true })
  await expect(page.getByRole('button', { name: 'Tempt fate again' })).toBeEnabled({ timeout: 8000 })
  await expect(page.locator('.revealed-card')).toBeVisible()
  await expect(page.locator('.perk-tile')).toHaveCount(4)
  const names = await page.locator('.perk-tile strong').allTextContents()
  expect(new Set(names).size).toBe(4)
  const character = await page.locator('.card-identity h2').innerText()
  const phases = await page.evaluate(() => (window as unknown as { observedRitualPhases: string[] }).observedRitualPhases)
  expect(phases).toEqual(['gathering', 'shuffling', 'orbiting', 'choosing', 'flipping', 'revealing', 'complete'])
  const gifts = await page.evaluate(() => (window as unknown as { observedRitualGifts: number[] }).observedRitualGifts)
  expect(gifts).toEqual([1, 2, 3, 4])
  await page.locator('.perk-tile').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('heading')).toHaveText(names[0])
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await page.screenshot({ path: `output/screenshots/${testInfo.project.name}-revealed.png`, fullPage: true })
  await page.reload()
  await page.getByRole('button', { name: 'Past fates' }).click()
  await expect(page.locator('.history-list strong').first()).toHaveText(character)
  await page.locator('.history-list button').first().click()
  await expect(page.locator('.card-identity h2')).toHaveText(character)
  expect(errors).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('skipping and repeating a ritual never leaves stale reveals or duplicate history', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Answer the summons' }).click()
  await expect(page.locator('.card-stage')).toHaveAttribute('data-phase', 'flipping', { timeout: 5000 })
  await page.getByRole('button', { name: 'Skip the ritual' }).click()
  await expect(page.locator('.card-stage')).toHaveAttribute('data-phase', 'complete')
  await expect(page.locator('.perk-tile:enabled')).toHaveCount(4)
  await page.getByRole('button', { name: 'Tempt fate again' }).click()
  await page.getByRole('button', { name: 'Skip the ritual' }).click()
  await expect(page.locator('.perk-tile:enabled')).toHaveCount(4)
  await page.getByRole('button', { name: 'Killer', exact: true }).click()
  // Wait past both canceled timelines: neither may restore its survivor result.
  await page.waitForTimeout(5900)
  await expect(page.locator('.card-stage')).toHaveAttribute('data-phase', 'idle')
  await expect(page.locator('.revealed-card')).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('oracle:history')!).length)).toBe(2)
})

test('reduced motion enabled mid-draw finishes immediately and persists', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Answer the summons' }).click()
  await page.getByRole('button', { name: 'Open settings' }).click()
  await page.getByRole('button', { name: 'Reduced effects', exact: true }).click()
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await expect(page.locator('.card-stage')).toHaveAttribute('data-phase', 'complete')
  await expect(page.locator('.perk-tile:enabled')).toHaveCount(4)
  await page.reload()
  await page.getByRole('button', { name: 'Answer the summons' }).click()
  await expect(page.locator('.card-stage')).toHaveAttribute('data-phase', 'complete', { timeout: 1500 })
  await expect(page.locator('.perk-tile:enabled')).toHaveCount(4)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('oracle:history')!).length)).toBe(2)
})

test('the flat-card fallback can perform and skip the ritual without WebGL', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: function (id: string, ...args: unknown[]) {
        if (id.includes('webgl')) return null
        return Reflect.apply(original, this, [id, ...args])
      },
    })
  })
  await page.goto('/')
  await expect(page.locator('.fallback-cards')).toBeVisible()
  await page.getByRole('button', { name: 'Answer the summons' }).click()
  await expect(page.locator('.fallback-orbiting')).toBeVisible({ timeout: 4000 })
  await page.getByRole('button', { name: 'Skip the ritual' }).click()
  await expect(page.locator('.revealed-card')).toBeVisible()
  await expect(page.locator('.perk-tile:enabled')).toHaveCount(4)
})

test('character exclusions persist, empty deck is recoverable, and roles are separate', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Collection', exact: true }).click()
  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  await page.getByRole('textbox', { name: 'Search characters' }).fill('Dwight')
  await page.getByRole('button', { name: 'Dwight Fairfield' }).click()
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Answer the summons' }).click()
  await expect(page.locator('.card-identity h2')).toHaveText('Dwight Fairfield')
  const survivorDraw = await page.evaluate(() => JSON.parse(localStorage.getItem('oracle:history')!)[0])
  expect(survivorDraw.perks.every((perk: { role: string; tier: number }) => perk.role === 'survivor' && perk.tier === 3)).toBe(true)
  await page.getByRole('button', { name: 'Collection', exact: true }).click()
  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await expect(page.getByRole('button', { name: 'Tempt fate again' })).toBeDisabled()
  await page.getByRole('button', { name: 'Killer', exact: true }).click()
  await page.getByRole('button', { name: 'Answer the summons' }).click()
  await expect(page.locator('.revealed-card')).toBeVisible()
  const killerDraw = await page.evaluate(() => JSON.parse(localStorage.getItem('oracle:history')!)[0])
  expect(killerDraw.character.role).toBe('killer')
  expect(killerDraw.perks.every((perk: { role: string; tier: number }) => perk.role === 'killer' && perk.tier === 3)).toBe(true)
  await page.evaluate(() => scrollTo(0, 0))
  await page.screenshot({ path: `output/screenshots/${testInfo.project.name}-killer-ritual.png`, fullPage: false })
})

test('production app installs its cache and draws offline', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }))
  })
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'The fog has plans for you.' })).toBeVisible()
  await page.getByRole('button', { name: 'Answer the summons' }).click()
  await expect(page.locator('.revealed-card')).toBeVisible()
  await expect(page.locator('.perk-tile')).toHaveCount(4)
  const images = await page.locator('.revealed-card img').evaluateAll((elements) => elements.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))
  expect(images).toBe(true)
  await expect.poll(() => page.locator('.forest-distance img').evaluate((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true)
})
test('muting sound during a ritual stops its audio and suppresses later cues', async ({ page }) => {
  const stats = await observeAudio(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Open settings' }).click()
  await page.getByRole('checkbox', { name: /Ritual sound/ }).check()
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await page.getByRole('button', { name: 'Answer the summons' }).click()
  await expect.poll(async () => (await stats()).active).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Open settings' }).click()
  await page.getByRole('checkbox', { name: /Ritual sound/ }).uncheck()
  await expect.poll(async () => (await stats()).active).toBe(0)
  const started = (await stats()).started
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await expect(page.locator('.card-stage')).toHaveAttribute('data-phase', 'complete', { timeout: 8000 })
  expect((await stats()).started).toBe(started)
})

test('saved sound volume migrates older settings and survives mute and reload', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('oracle:preferences')) localStorage.setItem('oracle:preferences', JSON.stringify({ sound: true, motion: 'full' }))
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open settings' }).click()
  const volume = page.getByRole('slider', { name: 'Ritual volume' })
  await expect(volume).toHaveValue('75')
  await volume.press('Home')
  for (let step = 0; step < 9; step++) await volume.press('ArrowRight')
  await expect(volume).toHaveValue('45')
  await page.reload()
  await page.getByRole('button', { name: 'Open settings' }).click()
  await expect(volume).toHaveValue('45')
  await expect(page.locator('.sound-volume:has(input[aria-label="Ritual volume"]) output')).toHaveText('45%')
  await page.getByRole('checkbox', { name: /Ritual sound/ }).uncheck()
  await expect(volume).toBeDisabled()
  await page.getByRole('checkbox', { name: /Ritual sound/ }).check()
  await expect(volume).toBeEnabled()
  await expect(volume).toHaveValue('45')
})

test('skip stops sound and a subsequent draw retains a mutable release tail', async ({ page }) => {
  const stats = await observeAudio(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Open settings' }).click()
  await page.getByRole('checkbox', { name: /Ritual sound/ }).check()
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await page.getByRole('button', { name: 'Answer the summons' }).click()
  await expect.poll(async () => (await stats()).active).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Skip the ritual' }).click()
  await expect.poll(async () => (await stats()).active).toBe(0)
  const started = (await stats()).started
  await page.getByRole('button', { name: 'Tempt fate again' }).click()
  await expect.poll(async () => (await stats()).started).toBeGreaterThan(started)
  await page.getByRole('button', { name: 'Open settings' }).click()
  await expect(page.locator('.card-stage')).toHaveAttribute('data-phase', 'complete', { timeout: 8000 })
  await expect.poll(async () => (await stats()).active, { intervals: [20] }).toBeGreaterThan(0)
  await page.getByRole('checkbox', { name: /Ritual sound/ }).uncheck()
  await expect.poll(async () => (await stats()).active).toBe(0)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('oracle:history')!).length)).toBe(2)
})
test('full ritual explicitly overrides a reduced-motion device preference and survives reload', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByText('Device motion preference: instant reveal.')).toBeVisible()
  await expect(page.locator('.app')).toHaveClass(/reduced-motion/)
  await page.getByRole('button', { name: 'Enable full ritual' }).click()
  await expect(page.getByText('Full ritual enabled')).toBeVisible()
  await expect(page.locator('.app')).not.toHaveClass(/reduced-motion/)
  expect(await page.locator('.fog-one').evaluate((element) => getComputedStyle(element).animationName)).toBe('fog-drift')
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
  await page.getByRole('button', { name: 'Answer the summons' }).click()
  await expect(page.locator('.card-stage')).toHaveAttribute('data-phase', 'orbiting', { timeout: 4000 })
  await expect(page.locator('.card-stage')).toHaveAttribute('data-phase', 'flipping', { timeout: 4000 })
  expect(await page.locator('.reveal-turn').evaluate((element) => getComputedStyle(element).animationName)).toBe('oracle-card-flip')
  await expect(page.getByRole('button', { name: 'Tempt fate again' })).toBeEnabled({ timeout: 5000 })
  await expect(page.locator('.perk-tile:enabled')).toHaveCount(4)
  await page.reload()
  await expect(page.getByText('Full ritual enabled')).toBeVisible()
  await page.getByRole('button', { name: 'Open settings' }).click()
  await page.getByRole('button', { name: 'Follow device', exact: true }).click()
  await expect(page.getByText(/Your device prefers reduced motion/)).toBeVisible()
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await expect(page.locator('.app')).toHaveClass(/reduced-motion/)
  await page.getByRole('button', { name: 'Answer the summons' }).click()
  await expect(page.locator('.card-stage')).toHaveAttribute('data-phase', 'complete', { timeout: 1500 })
})
