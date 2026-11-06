export const CARD_REVEAL = { turn: .9, impact: 1.2, settle: .3, lift: 34, depth: 96, perspective: 1200 } as const
const flipAt = 3.18
const revealAt = flipAt + CARD_REVEAL.impact

/** Seconds from the start of a draw; all scenes, landing effects, and sound share this clock. */
export const RITUAL = {
  gathering: 0,
  shuffling: 0.46,
  orbiting: 1.18,
  choosing: 2.48,
  flipping: flipAt,
  revealing: revealAt,
  perks: [revealAt + .18, revealAt + .52, revealAt + .86, revealAt + 1.2],
  complete: revealAt + 1.68,
} as const

export type RitualPhase = 'idle' | 'gathering' | 'shuffling' | 'orbiting' | 'choosing' | 'flipping' | 'revealing' | 'complete'
export type MotionMode = 'system' | 'full' | 'reduced'
export type SoundCue = Exclude<RitualPhase, 'idle' | 'complete'> | 'perk'

export const PHASE_COPY: Record<RitualPhase, { title: string; message: string }> = {
  idle: { title: 'IT KNOWS YOU ARE HERE', message: 'IT HAS BEEN WAITING FOR YOU.' },
  gathering: { title: 'I · THE HUNGER', message: 'You called. Something answered.' },
  shuffling: { title: 'II · THE UNRAVELLING', message: 'It strips the choice from your hands…' },
  orbiting: { title: 'III · THE FEEDING', message: 'Your fear has drawn its attention…' },
  choosing: { title: 'IV · THE CONDEMNED', message: 'It has found a use for you.' },
  flipping: { title: 'V · THE SENTENCE', message: 'Look upon what it has chosen.' },
  revealing: { title: 'VI · THE CRUEL GIFTS', message: 'Four gifts. None given in mercy.' },
  complete: { title: 'YOU BELONG TO IT', message: 'The Entity has claimed its due.' },
}
