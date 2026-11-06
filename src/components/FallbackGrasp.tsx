import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { captureReach, captiveAnchor, captivityMotion, captivePerspective, captivityTime, entityReaction } from '../lib/captivity'
import type { CaptivityClock } from '../lib/captivity'

/** The same capture remains visible when the device cannot render the 3D roots. */
export default function FallbackGrasp({ clock }: { clock: CaptivityClock }) {
  const svg = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const element = svg.current, stage = element?.closest<HTMLElement>('.card-stage')
    if (!element || !stage) return
    const paths = [...element.querySelectorAll<SVGPathElement>('[data-root]')]
    const layout = { width: 600, height: 420, halfWidth: 105, halfHeight: 164, cy: 190 }
    const resize = () => {
      const bounds = element.getBoundingClientRect(), css = getComputedStyle(stage)
      layout.width = bounds.width; layout.height = bounds.height
      layout.halfWidth = parseFloat(css.getPropertyValue('--reveal-width')) / 2
      layout.halfHeight = parseFloat(css.getPropertyValue('--reveal-height')) / 2
      layout.cy = layout.height / 2 - parseFloat(css.getPropertyValue('--reveal-center-offset'))
      element.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`)
    }
    resize()
    const observer = new ResizeObserver(resize); observer.observe(element)
    const update = () => {
      const time = captivityTime(clock), reaction = entityReaction(clock), reach = captureReach(time) * (1 - reaction.release * .94)
      element.style.opacity = time < 0 ? '0' : `${Math.min(1, reach * 2)}`
      if (time < 0) return
      const { width, height, halfWidth, halfHeight, cy } = layout
      const motion = captivityMotion(clock)
      paths.forEach((path) => {
        const index = Number(path.getAttribute('data-root'))
        const side = index % 2 ? 1 : -1, upper = index < 2
        const point = captiveAnchor(side * (halfWidth + (1 - reach) * 115), halfHeight * (upper ? -.68 : .35), motion)
        const depth = captivePerspective(point.z)
        const x = width / 2 + point.x * depth
        const y = cy + point.y * depth
        const startX = side < 0 ? -90 : width + 90, startY = upper ? -30 : height + 65
        const strain = reaction.pulse * reaction.level * Math.sin(Math.max(0, reaction.time) * 24 + index) * 9
        path.setAttribute('d', `M ${startX} ${startY} C ${width / 2 + side * (halfWidth + 150)} ${startY + strain}, ${x + side * 90} ${y + (upper ? -50 : 55) + strain}, ${x + side * 25} ${y + 16} C ${x + side * 9} ${y + 12}, ${x - side * 7} ${y + 7}, ${x - side * 3} ${y - 7}`)
      })
    }
    gsap.ticker.add(update)
    return () => { observer.disconnect(); gsap.ticker.remove(update) }
  }, [clock])
  return <svg ref={svg} className="fallback-entity-grasp" fill="none" aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <g key={index}><path data-root={index} className="fallback-root-shadow" /><path data-root={index} className="fallback-root-body" /><path data-root={index} className="fallback-root-ridge" /></g>)}</svg>
}
