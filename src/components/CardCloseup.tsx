import { useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { X } from 'lucide-react'
import gsap from 'gsap'
import CardFace from './CardFace'
import type { CardFaceProps } from './CardFace'
import { CARD_REVEAL } from '../lib/ritual'
import { captivityMotion, captivePerspective } from '../lib/captivity'
import type { CaptivityClock } from '../lib/captivity'

export default function CardCloseup({ source, captivity, reduced, onDismiss, ...face }: CardFaceProps & { source: RefObject<HTMLDivElement | null>; captivity: CaptivityClock; reduced: boolean; onDismiss: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), plane = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const surface = dialog.current, card = plane.current
    if (!surface || !card) return
    const origin = source.current?.closest('.reveal-shell')?.getBoundingClientRect()
    const launch = captivityMotion(captivity)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    surface.showModal()
    const fit = () => {
      const css = getComputedStyle(card), width = parseFloat(css.width), height = parseFloat(css.height)
      const viewWidth = window.visualViewport?.width ?? innerWidth, viewHeight = window.visualViewport?.height ?? innerHeight
      const scale = Math.max(.6, Math.min((viewWidth - 40) / width, (viewHeight - 116) / height, 2.2))
      return { width, height, depth: CARD_REVEAL.perspective * (1 - 1 / scale) }
    }
    const target = fit()
    surface.dataset.zoom = reduced ? 'ready' : 'approaching'
    if (reduced) gsap.set(card, { x: 0, y: 0, z: target.depth, scale: 1 })
    else {
      const depth = captivePerspective(launch.z)
      gsap.set(card, { x: (origin ? origin.x + origin.width / 2 - innerWidth / 2 : 0) / depth + launch.x, y: (origin ? origin.y + origin.height / 2 - innerHeight / 2 : 0) / depth + launch.y, z: launch.z, scale: 1, rotationX: launch.pitch, rotationY: launch.yaw, rotationZ: launch.roll })
      gsap.to(card, { x: 0, y: 0, z: target.depth, scale: 1, rotationX: 0, rotationY: 0, rotationZ: 0, duration: .82, ease: 'power3.out', onComplete: () => { surface.dataset.zoom = 'ready' } })
    }
    const resize = () => { gsap.killTweensOf(card); gsap.set(card, { x: 0, y: 0, z: fit().depth, scale: 1, rotationX: 0, rotationY: 0, rotationZ: 0 }); surface.dataset.zoom = 'ready' }
    window.addEventListener('resize', resize)
    window.visualViewport?.addEventListener('resize', resize)
    return () => { gsap.killTweensOf(card); window.removeEventListener('resize', resize); window.visualViewport?.removeEventListener('resize', resize); surface.close(); document.body.style.overflow = previousOverflow }
  }, [source, reduced, captivity])
  return <dialog ref={dialog} className="card-closeup" aria-label={`${face.draw.character.name} card enlarged`} onCancel={(event) => { event.preventDefault(); onDismiss() }} onClick={(event) => { if (event.target === event.currentTarget) onDismiss() }}>
    <button className="closeup-dismiss" aria-label="Close enlarged card" onClick={onDismiss} autoFocus><X size={20} /></button>
    <div ref={plane} className="closeup-plane"><CardFace {...face} enlarged /></div>
    <p className="closeup-instruction">A closer look into your fate <span>Select a perk to inspect · Tap outside to return</span></p>
  </dialog>
}
