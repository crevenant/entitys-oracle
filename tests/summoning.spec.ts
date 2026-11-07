import { test, expect } from '@playwright/test'

test.use({ serviceWorkers: 'block' })

type RitualSample = { phase: string; manifestation: string; opacity: number; moving: boolean; bothTurning: boolean }

for (const role of ['survivor', 'killer'] as const) {
  test(`${role} draw closes the eye before shuffling and reforms the controls on reveal`, async ({ page }, info) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript(() => localStorage.setItem('oracle:preferences', JSON.stringify({ motion: 'full', music: false, sound: false })))
    await page.goto('/')
    if (role === 'killer') await page.locator('.killer-choice').click()
    const survivors = page.locator('.campfire-survivors'), trapper = page.locator('.trapper-turn')
    await expect(survivors).toHaveCSS('--campfire-frame', role === 'survivor' ? '14' : '0')
    await expect(trapper).toHaveCSS('--trapper-frame', role === 'killer' ? '16' : '0')
    // Observe every frame so short shiver/burst beats remain verifiable on a
    // slower phone without racing the browser with timed screenshots.
    await page.evaluate(() => {
      const samples: RitualSample[] = []
      const survivors = document.querySelector('.campfire-survivors')!
      const trapper = document.querySelector('.trapper-turn')!
      Object.assign(window, { summoningSamples: samples })
      const sample = () => {
        const entity = document.querySelector<HTMLElement>('.summoned-entity')
        const phase = document.querySelector('.app')!.getAttribute('data-phase')!
        if (entity) {
          const control = getComputedStyle(document.querySelector('.role-switch')!)
          const bothTurning = phase === 'choosing'
            && Number(getComputedStyle(survivors).getPropertyValue('--campfire-frame')) > 0
            && Number(getComputedStyle(trapper).getPropertyValue('--trapper-frame')) > 0
          samples.push({ phase, manifestation: entity.dataset.manifestation!, opacity: Number(control.opacity), moving: control.transform !== 'none', bothTurning })
        }
        if (phase !== 'complete') requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    await page.getByRole('button', { name: 'Seal your fate' }).click()
    await expect(page.locator('.summoned-entity')).toBeVisible()
    await expect(survivors).toHaveCSS('--campfire-frame', '0')
    await expect(trapper).toHaveCSS('--trapper-frame', '0')
    await expect(page.locator('.card-stage')).toHaveAttribute('data-phase', 'shuffling', { timeout: 5000 })
    await expect(page.locator('.role-switch')).toHaveCSS('opacity', '0')
    await expect(page.locator('.draw-button')).toHaveCSS('opacity', '0')
    await expect(page.locator('.summoned-entity')).toHaveAttribute('data-manifestation', 'spent')
    await page.screenshot({ path: `output/screenshots/${info.project.name}-${role}-summoned.png` })
    await page.waitForFunction(() => {
      if (document.querySelector('.app')?.getAttribute('data-phase') !== 'revealing') return false
      const controls = document.querySelector('.role-switch')!
      const opacity = Number(getComputedStyle(controls).opacity)
      if (opacity <= .1 || opacity >= .9) return false
      if (getComputedStyle(document.querySelector('.campfire-survivors')!).getPropertyValue('--campfire-frame') !== '14') return false
      if (getComputedStyle(document.querySelector('.trapper-turn')!).getPropertyValue('--trapper-frame') !== '16') return false
      const smoke = document.querySelector<HTMLCanvasElement>('.control-shadow-burst')
      const pixels = smoke?.getContext('2d')?.getImageData(0, 0, smoke.width, smoke.height).data
      return pixels?.some((value, index) => index % 4 === 3 && value > 40)
    })
    await expect(page.locator('.card-stage')).toHaveAttribute('data-phase', 'complete', { timeout: 9000 })
    await expect(page.locator('.summoned-entity, .control-shadow-burst')).toHaveCount(0)
    await expect(page.locator('.role-switch')).toHaveCSS('opacity', '1')
    await expect(survivors).toHaveCSS('--campfire-frame', role === 'survivor' ? '14' : '0')
    await expect(trapper).toHaveCSS('--trapper-frame', role === 'killer' ? '16' : '0')
    const samples = await page.evaluate(() => (window as unknown as { summoningSamples: RitualSample[] }).summoningSamples)
    const beats = samples.filter((sample) => sample.phase === 'gathering' && sample.manifestation !== 'spent').map((sample) => sample.manifestation).filter(Boolean)
    expect([...new Set(beats)]).toEqual(['shivering', 'bursting', 'forming', 'holding', 'absorbing', 'closing', 'trembling'])
    expect(samples.some((sample) => sample.manifestation === 'shivering' && sample.moving && sample.opacity > .9)).toBe(true)
    expect(samples.some((sample) => sample.phase === 'gathering' && sample.opacity === 0)).toBe(true)
    expect(samples.some((sample) => sample.phase === 'choosing' && sample.bothTurning)).toBe(true)
    expect(errors).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('skipping the prelude and enabling reduced effects clears shadows and restores the selected poses', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('oracle:preferences', JSON.stringify({ motion: 'full', music: false })))
  await page.goto('/')
  await page.locator('.killer-choice').click()
  await page.getByRole('button', { name: 'Seal your fate' }).click()
  await expect(page.locator('.summoned-entity')).toBeVisible()
  await page.getByRole('button', { name: 'Skip the ritual' }).click()
  await expect(page.locator('.summoned-entity, .control-shadow-burst')).toHaveCount(0)
  await expect(page.locator('.draw-button')).toHaveCSS('opacity', '1')
  await expect(page.locator('.trapper-turn')).toHaveCSS('--trapper-frame', '16')
  await page.getByRole('button', { name: 'Tempt fate again' }).click()
  await expect(page.locator('.summoned-entity')).toHaveCount(1)
  await page.getByRole('button', { name: 'Options', exact: true }).click()
  await page.getByRole('button', { name: 'Open settings' }).click()
  await page.getByRole('button', { name: 'Reduced effects', exact: true }).click()
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await expect(page.locator('.card-stage')).toHaveAttribute('data-phase', 'complete')
  await expect(page.locator('.summoned-entity, .control-shadow-burst')).toHaveCount(0)
  await page.getByRole('button', { name: 'Tempt fate again' }).click()
  await expect(page.locator('.card-stage')).toHaveAttribute('data-phase', 'complete')
  await expect(page.locator('.summoned-entity, .control-shadow-burst')).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('oracle:history')!).length)).toBe(3)
})
