/** Seconds from the start of a draw; all scenes and sound cues share this clock. */
export const RITUAL = {
  gathering: 0,
  shuffling: 0.46,
  orbiting: 1.18,
  choosing: 2.48,
  flipping: 3.18,
  revealing: 3.94,
  perks: [4.12, 4.46, 4.8, 5.14],
  complete: 5.62,
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
