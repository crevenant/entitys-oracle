/** Small, advected flame field in the forest plate's original pixel coordinates. */
export function createFirePainter(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  const flame = document.createElement('canvas')
  flame.width = 80; flame.height = 72
  const flameContext = flame.getContext('2d')!
  const pixels = flameContext.createImageData(flame.width, flame.height)
  const clamp = (value: number) => Math.max(0, Math.min(1, value))
  const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t) }

  // Cache the noise lattice: only interpolation runs in the per-pixel loop.
  const lattice = new Float32Array(64 * 64)
  let seed = 1739
  for (let i = 0; i < lattice.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    lattice[i] = seed / 4294967296
  }
  const noise = (x: number, y: number) => {
    const ix = Math.floor(x), iy = Math.floor(y)
    const fx = smooth(x - ix), fy = smooth(y - iy)
    const a = lattice[(iy & 63) * 64 + (ix & 63)]
    const b = lattice[(iy & 63) * 64 + ((ix + 1) & 63)]
    const c = lattice[((iy + 1) & 63) * 64 + (ix & 63)]
    const d = lattice[((iy + 1) & 63) * 64 + ((ix + 1) & 63)]
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy
  }

  const smoke = document.createElement('canvas')
  smoke.width = smoke.height = 64
  const smokeContext = smoke.getContext('2d')!
  const wisp = smokeContext.createRadialGradient(32, 32, 0, 32, 32, 32)
  wisp.addColorStop(0, 'rgba(132,137,127,.2)')
  wisp.addColorStop(.4, 'rgba(100,111,103,.09)')
  wisp.addColorStop(1, 'rgba(76,89,82,0)')
  smokeContext.fillStyle = wisp; smokeContext.fillRect(0, 0, 64, 64)

  return (time: number) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const baseX = 121, baseY = 130
    const gust = (noise(time * .38, 9) - .5) * 9
    const surge = noise(time * 1.7, 15)
    const height = 23 + surge * 14 + noise(time * 4.1, 21) * 5
    const brightness = .66 + surge * .22 + noise(time * 11, 35) * .12

    // Smoke expands, curls with the same breeze, and thins as it rises.
    for (let puff = 0; puff < 9; puff++) {
      const life = (time / 5.7 + puff / 9) % 1
      const size = 8 + life * 30
      const x = baseX + gust * life * 2 + Math.sin(life * 7 + puff * 2.3) * life * 10
      const y = baseY - 16 - life * 91
      ctx.globalAlpha = Math.sin(life * Math.PI) * .42
      ctx.drawImage(smoke, x - size / 2, y - size / 2, size, size * 1.4)
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'screen'

    // Low, uneven illumination follows the combustion rather than a regular pulse.
    ctx.save(); ctx.translate(baseX, baseY + 8); ctx.scale(1, .25)
    const ground = ctx.createRadialGradient(0, 0, 1, 0, 0, 66)
    ground.addColorStop(0, `rgba(231,98,26,${brightness * .16})`)
    ground.addColorStop(.35, `rgba(169,65,19,${brightness * .07})`)
    ground.addColorStop(1, 'rgba(118,44,16,0)')
    ctx.fillStyle = ground; ctx.fillRect(-66, -66, 132, 132); ctx.restore()
    const halo = ctx.createRadialGradient(baseX, baseY - 6, 0, baseX, baseY - 6, 29)
    halo.addColorStop(0, `rgba(251,124,32,${brightness * .11})`)
    halo.addColorStop(.5, `rgba(211,75,16,${brightness * .035})`)
    halo.addColorStop(1, 'rgba(160,50,12,0)')
    ctx.fillStyle = halo; ctx.fillRect(baseX - 29, baseY - 35, 58, 58)

    // Turbulence travels upward through a shared plume. Eroding its edges
    // creates splitting tongues, gaps, and detached tips instead of fixed shapes.
    pixels.data.fill(0)
    for (let y = 18; y < 65; y++) {
      const lift = 64 - y, rise = lift / height
      if (rise >= 1.18) continue
      const bend = gust * rise * rise + (noise(rise * 3 - time * 1.5, time * .7) - .5) * (2 + rise * 9)
      const width = 12.8 * Math.pow(Math.max(0, 1 - rise / 1.18), .62) + .4
      const topFade = 1 - smooth((rise - .82) / .36)
      for (let x = 19; x < 62; x++) {
        const dx = x - 40 - bend
        const flowY = lift * .15 - time * 3.9
        const billow = noise(dx * .16 + 19, flowY) * .63
          + noise(dx * .37 + 3, flowY * 2.1) * .26
          + noise(dx * .81, flowY * 3.7) * .11
        const fuel = .88 + noise(x * .31, time * 2.2) * .22
        const density = fuel - Math.abs(dx) / width - rise * .23 + (billow - .48) * 1.32
        const opacity = smooth((density - .08) / .46) * topFade
        if (opacity < .004) continue
        const heat = clamp(density * .72 + (1 - rise) * .22)
        const i = (y * flame.width + x) * 4
        // Deep amber edges, orange body, and a small yellow-white hot core.
        pixels.data[i] = 231 + heat * 24
        pixels.data[i + 1] = 62 + Math.pow(heat, .85) * 183
        pixels.data[i + 2] = 9 + Math.pow(heat, 2.7) * 161
        pixels.data[i + 3] = opacity * brightness * 220
      }
    }
    flameContext.putImageData(pixels, 0, 0)
    ctx.drawImage(flame, baseX - 40, baseY - 64)

    // Keep the existing photographed logs. Scattered coals sit in their gaps.
    for (let coal = 0; coal < 15; coal++) {
      const x = baseX + (noise(coal * 3.7, 2) - .5) * 35
      const y = baseY + 1 + noise(coal * 2.9, 5) * 8
      const heat = noise(time * (1.2 + coal % 3 * .5), coal * 3.1)
      ctx.fillStyle = `rgba(255,${83 + heat * 96},24,${.12 + heat * .4})`
      ctx.beginPath(); ctx.ellipse(x, y, .5 + heat * .65, .35, -.3, 0, Math.PI * 2); ctx.fill()
    }
    // Sparse sparks cool, curve in the updraft, and extinguish at different heights.
    for (let ember = 0; ember < 10; ember++) {
      const duration = 1.7 + noise(ember, 6) * 2
      const life = (time / duration + ember * .618) % 1
      const lift = 29 + noise(ember, 12) * 67
      const x = baseX + (noise(ember, 4) - .5) * 20 + gust * life * 1.6 + Math.sin(life * 5 + ember) * life * 5
      const y = baseY - 4 - life * lift
      const alpha = smooth(life / .12) * Math.pow(1 - life, 1.8) * .75
      ctx.strokeStyle = `rgba(255,${180 - life * 95},${76 - life * 56},${alpha})`
      ctx.lineWidth = ember % 3 ? .65 : .9
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - .25, y + .7 + (1 - life) * .9); ctx.stroke()
    }
    ctx.globalCompositeOperation = 'source-over'
  }
}
