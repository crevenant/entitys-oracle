import { useLayoutEffect, useRef, useState } from 'react'
import type { Character } from '../lib/oracle'
import { portraitPlayhead, rememberPortraitPlayhead } from '../lib/portraitClips'
import type { PortraitClip } from '../lib/portraitClips'
import { publicUrl } from '../lib/publicUrl'

export default function CharacterPortrait({ character, session, clip, active, reduced }: { character: Character; session: string; clip?: PortraitClip; active: boolean; reduced: boolean }) {
  const video = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const enabled = !!clip && active && !reduced && !failed
  const src = clip && publicUrl(clip.src)
  useLayoutEffect(() => {
    const player = video.current
    if (!enabled || !player || !src) return
    // Restore after development Strict Mode replays the cleanup on a new mount.
    if (player.getAttribute('src') !== src) player.setAttribute('src', src)
    const key = `${session}:${src}`, lifetime = { active: true, restored: false }
    setReady(false)
    const restore = () => {
      if (lifetime.restored || !Number.isFinite(player.duration) || player.duration <= 0) return
      player.currentTime = portraitPlayhead(key) % player.duration
      lifetime.restored = true
    }
    const play = () => {
      if (document.hidden || !lifetime.active) return
      restore()
      void player.play().catch(() => { if (lifetime.active) setReady(false) })
    }
    const playing = () => { if (lifetime.active) setReady(true) }
    const error = () => { if (lifetime.active) setFailed(true) }
    const visibility = () => { if (document.hidden) player.pause(); else play() }
    player.addEventListener('loadedmetadata', restore)
    player.addEventListener('canplay', play)
    player.addEventListener('playing', playing)
    player.addEventListener('error', error)
    document.addEventListener('visibilitychange', visibility)
    if (player.readyState >= 2) play()
    return () => {
      lifetime.active = false
      rememberPortraitPlayhead(key, player.currentTime)
      player.pause()
      player.removeEventListener('loadedmetadata', restore)
      player.removeEventListener('canplay', play)
      player.removeEventListener('playing', playing)
      player.removeEventListener('error', error)
      document.removeEventListener('visibilitychange', visibility)
      player.removeAttribute('src'); player.load()
    }
  }, [enabled, src, session])
  const showingVideo = enabled && ready
  const poster = publicUrl(enabled ? clip.poster ?? character.image : character.image)
  return <span className="portrait-media" data-portrait-mode={showingVideo ? 'video' : failed ? 'fallback' : enabled ? 'loading' : 'still'}>
    <img className={`character-portrait ${showingVideo ? 'portrait-still-covered' : ''}`} src={poster} alt={character.name} />
    {enabled && <video key={src} ref={video} className={`character-portrait-video ${showingVideo ? 'portrait-video-ready' : ''}`} src={src} poster={poster} muted playsInline loop preload="metadata" aria-hidden="true" />}
  </span>
}
