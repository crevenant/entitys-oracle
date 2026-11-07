import { test, expect } from '@playwright/test'

test('the card turns continuously, rises in depth, lands on the reveal beat, and skips cleanly', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Seal your fate' }).click()
  await expect(page.locator('.card-stage')).toHaveAttribute('data-phase', 'flipping', { timeout: 7000 })
  const motion = await page.evaluate(() => {
    const animation = (selector: string) => {
      const element = document.querySelector(selector)!
      const playback = element.getAnimations()[0]
      playback.pause()
      return { element, playback }
    }
    const turn = animation('.reveal-turn')
    const flight = animation('.reveal-flight')
    const shadow = animation('.reveal-contact-shadow')
    const at = (target: typeof turn, time: number) => {
      target.playback.currentTime = time
      return new DOMMatrixReadOnly(getComputedStyle(target.element).transform)
    }
    const angles = Array.from({ length: 31 }, (_, index) => {
      const matrix = at(turn, index * 30)
      return Math.abs(Math.atan2(-matrix.m13, matrix.m11) * 180 / Math.PI)
    })
    const poses = [0, 1000, 1200, 1245, 1500].map((time) => {
      const matrix = at(flight, time)
      shadow.playback.currentTime = time
      return { y: matrix.m42, z: matrix.m43, scaleY: matrix.m22, shadow: Number(getComputedStyle(shadow.element).opacity) }
    })
    return { angles, poses }
  })
  const { angles, poses } = motion
  expect(angles[0]).toBeCloseTo(0)
  expect(angles.at(-1)).toBeCloseTo(180)
  for (let index = 1; index < angles.length; index++) {
    expect(angles[index]).toBeGreaterThanOrEqual(angles[index - 1])
    expect(angles[index] - angles[index - 1]).toBeLessThan(30)
    if (angles[index - 1] > 60 && angles[index] < 120) expect(angles[index] - angles[index - 1]).toBeGreaterThan(3)
  }
  expect(poses[0].y).toBeLessThan(-25)
  expect(poses[1].y).toBeLessThan(poses[0].y)
  expect(poses[1].z).toBeGreaterThan(poses[0].z)
  expect(poses[1].shadow).toBeLessThan(poses[0].shadow)
  expect(Math.abs(poses[2].y)).toBeLessThan(.5)
  expect(Math.abs(poses[2].z)).toBeLessThan(.5)
  expect(poses[2].shadow).toBeGreaterThan(.5)
  expect(poses[3].scaleY).toBeLessThan(1)
  expect(poses[4].y).toBeCloseTo(0)
  expect(poses[4].z).toBeCloseTo(0)
  expect(poses[4].scaleY).toBeCloseTo(1)
  await page.getByRole('button', { name: 'Skip the ritual' }).click()
  await expect(page.locator('.reveal-shell')).toHaveClass(/is-instant/)
  expect(await page.locator('.reveal-flight').evaluate((element) => getComputedStyle(element).transform)).toBe('none')
  await expect(page.locator('.perk-tile:enabled')).toHaveCount(4)
})

test('a repeat draw sinks the old card and raises a fresh deck through the fog', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('oracle:preferences', JSON.stringify({ motion: 'full', music: false })))
  await page.goto('/')
  await page.getByRole('button', { name: 'Seal your fate' }).click()
  const skip = page.getByRole('button', { name: 'Skip the ritual' })
  await skip.click()

  const stage = page.locator('.card-stage')
  await stage.evaluate((element) => {
    const beats: string[] = []
    const observer = new MutationObserver(() => {
      const phase = element.getAttribute('data-phase')
      if (phase === 'returning') {
        const card = element.querySelector<HTMLElement>('.reveal-shell')
        const scene = element.querySelector('.scene-container')!
        const fog = element.querySelector('.deck-return-fog')
        const beat = card?.inert && getComputedStyle(card).animationName === 'deck-return-sink' ? 'sink'
          : !card && getComputedStyle(scene).animationName === 'deck-return-rise' ? 'rise' : ''
        if (fog && beat && beats.at(-1) !== beat) beats.push(beat)
      } else if (phase === 'gathering') {
        beats.push(phase)
        observer.disconnect()
      }
    })
    observer.observe(element, { attributes: true, attributeFilter: ['data-phase', 'class'], childList: true })
    Object.assign(window, { deckReturnBeats: beats })
  })
  await page.getByRole('button', { name: 'Tempt fate again' }).click()
  await expect(stage).toHaveAttribute('data-phase', 'gathering')
  await expect(stage.locator('.deck-return-fog')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { deckReturnBeats: string[] }).deckReturnBeats)).toEqual(['sink', 'rise', 'gathering'])
  await skip.click()
  await expect(stage).toHaveAttribute('data-phase', 'complete')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('oracle:history')!).length)).toBe(2)
})
