import survivorPortraitClips from './survivorPortraitClips.json' with { type: 'json' }

export type PortraitClip = { src: string; poster?: string }

// Register only finished, reviewed local clips. An unregistered character keeps
// its original portrait and makes no video request.
export const portraitClips: Readonly<Partial<Record<string, PortraitClip>>> = {
  ...survivorPortraitClips,
  '40': {
    src: '/assets/portrait-clips/sable-ward-loop.mp4',
    poster: '/assets/portrait-clips/sable-ward-poster.webp',
  },
}

const playheads = new Map<string, number>()
export const portraitPlayhead = (key: string) => playheads.get(key) ?? 0
export function rememberPortraitPlayhead(key: string, time: number) {
  if (!Number.isFinite(time)) return
  playheads.delete(key); playheads.set(key, time)
  if (playheads.size > 24) playheads.delete(playheads.keys().next().value!)
}
