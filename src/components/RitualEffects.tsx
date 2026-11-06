import type { RitualPhase } from '../lib/ritual'
import type { CSSProperties } from 'react'

export default function RitualEffects({ phase }: { phase: RitualPhase }) {
  return <div className={`ritual-effects effects-${phase}`} aria-hidden="true">
    <svg className="entity-vines" viewBox="0 0 640 420" fill="none">
      <circle className="arcane-orbit" cx="320" cy="210" r="174" stroke="#ad8d4a" strokeWidth="0.65" strokeDasharray="1 15 28 15" />
    </svg>
    <div className="summoning-halo" /><div className="summoning-halo halo-second" />
    <div className="landing-impact"><div className="landing-wave" /><div className="landing-flare" />{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ '--dust': index } as CSSProperties} />)}</div>
    <div className="orbit-runes">{['✧', '☽', '◇', '✧', '☾', '◇'].map((rune, index) => <span key={index} style={{ '--rune': index } as CSSProperties}>{rune}</span>)}</div>
  </div>
}
