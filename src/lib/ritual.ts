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
  idle: { title: 'THE VEIL IS STILL', message: 'THE CARDS ARE WAITING.' },
  gathering: { title: 'I · THE SUMMONING', message: 'Something stirs beyond the veil…' },
  shuffling: { title: 'II · THE SHUFFLE', message: 'Your choices slip into the dark…' },
  orbiting: { title: 'III · THE RITUAL', message: 'The Entity weighs your fate…' },
  choosing: { title: 'IV · THE CHOSEN', message: 'One card answers the call.' },
  flipping: { title: 'V · THE REVELATION', message: 'The veil is lifting…' },
  revealing: { title: 'VI · THE FOUR GIFTS', message: 'Your gifts emerge from the fog…' },
  complete: { title: 'THE FATE IS SEALED', message: 'The fog has spoken.' },
}
