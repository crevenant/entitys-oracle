export const CARD_REVEAL = { turn: .9, impact: 1.2, settle: .3, lift: 34, depth: 96, perspective: 1200 } as const
export const DECK_RETURN = { exit: .62, rise: 1.08 } as const
export const SUMMONING = { shiver: .55, burst: .95, form: 1.6, takeHold: 1.72, absorb: 1.98, closeEye: 2.65, tremor: 2.84, shuffle: 3.25 } as const

export function summoningTremor(time: number) {
  const progress = (time - SUMMONING.tremor) / (SUMMONING.shuffle - SUMMONING.tremor)
  if (progress <= 0 || progress >= 1) return null
  const phase = progress * Math.PI * 2
  const strength = Math.sin(progress * Math.PI) ** .8
  return {
    x: strength * (.76 * Math.sin(phase * 6.2 + .5 * Math.sin(phase * 2)) + .24 * Math.sin(phase * 9.4)),
    y: strength * Math.sin(phase * 4.4 + .8),
    roll: strength * Math.sin(phase * 5.4 + .5 * Math.sin(phase * 2)),
  }
}
const prelude = SUMMONING.shuffle - .46
const flipAt = 3.18 + prelude
const revealAt = flipAt + CARD_REVEAL.impact

/** Seconds from the start of a draw; all scenes, landing effects, and sound share this clock. */
export const RITUAL = {
  gathering: 0,
  shuffling: SUMMONING.shuffle,
  orbiting: 1.18 + prelude,
  choosing: 2.48 + prelude,
  flipping: flipAt,
  revealing: revealAt,
  perks: [revealAt + .18, revealAt + .52, revealAt + .86, revealAt + 1.2],
  complete: revealAt + 1.68,
} as const

export type RitualPhase = 'idle' | 'returning' | 'gathering' | 'shuffling' | 'orbiting' | 'choosing' | 'flipping' | 'revealing' | 'complete'
export type MotionMode = 'system' | 'full' | 'reduced'
export type SoundCue = Exclude<RitualPhase, 'idle' | 'returning' | 'complete'> | 'perk'

export const PHASE_COPY: Record<RitualPhase, { title: string; message: string }> = {
  idle: { title: 'IT KNOWS YOU ARE HERE', message: 'IT HAS BEEN WAITING FOR YOU.' },
  returning: { title: 'THE FOG RECLAIMS ITS OWN', message: 'Another deck stirs in the fog…' },
  gathering: { title: 'I · THE HUNGER', message: 'You called. Something answered.' },
  shuffling: { title: 'II · THE UNRAVELLING', message: 'It strips the choice from your hands…' },
  orbiting: { title: 'III · THE FEEDING', message: 'Your fear has drawn its attention…' },
  choosing: { title: 'IV · THE CONDEMNED', message: 'It has found a use for you.' },
  flipping: { title: 'V · THE SENTENCE', message: 'Look upon what it has chosen.' },
  revealing: { title: 'VI · THE CRUEL GIFTS', message: 'Four gifts. None given in mercy.' },
  complete: { title: 'YOU BELONG TO IT', message: 'The Entity has claimed its due.' },
}
