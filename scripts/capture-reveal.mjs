import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

await mkdir('output/video', { recursive: true })
const browser = await chromium.launch()
try {
  const context = await browser.newContext({ viewport: { width: 1200, height: 1000 }, recordVideo: { dir: 'output/video', size: { width: 1200, height: 1000 } } })
  await context.addInitScript(() => localStorage.setItem('oracle:preferences', JSON.stringify({ motion: 'full', sound: false, music: false })))
  const began = Date.now()
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:5173/')
  await page.locator('[data-ready=true]').waitFor()
  const stage = await page.locator('.card-stage').boundingBox()
  const drawAt = (Date.now() - began) / 1000
  await page.getByRole('button', { name: 'Draw your fate' }).click()
  await page.getByRole('button', { name: 'Tempt fate again' }).waitFor()
  await page.screenshot({ path: 'output/screenshots/smooth-reveal.png', fullPage: false })
  const video = page.video()
  await context.close()
  await video.saveAs('output/video/card-reveal.webm')
  await writeFile('output/video/card-reveal.json', JSON.stringify({ drawAt, stage }))
  console.log(JSON.stringify({ video: 'output/video/card-reveal.webm', drawAt, stage }))
} finally { await browser.close() }
