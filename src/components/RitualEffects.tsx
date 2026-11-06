import type { RitualPhase } from '../lib/ritual'
import type { CSSProperties } from 'react'

export default function RitualEffects({ phase }: { phase: RitualPhase }) {
  return <div className={`ritual-effects effects-${phase}`} aria-hidden="true">
    <svg className="entity-vines" viewBox="0 0 640 420" fill="none">
      <defs><linearGradient id="vine-ink" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#a47a3b" stopOpacity="0" /><stop offset="0.5" stopColor="#b59357" /><stop offset="1" stopColor="#9769b7" /></linearGradient></defs>
      <g className="vine-left" stroke="url(#vine-ink)" strokeWidth="1.15">
        <path pathLength="1" d="M48 405C168 364 65 300 173 258S91 166 204 103 231 54 245 12" />
        <path pathLength="1" d="M95 380 59 339 121 348M137 313 100 275 159 280M154 236 122 201 176 211M174 162 150 119 204 137M207 97 187 69 224 70" />
        <path pathLength="1" d="M18 363C119 366 49 282 131 245S76 138 172 90" />
      </g>
      <g className="vine-right" stroke="url(#vine-ink)" strokeWidth="1.15" transform="translate(640 0) scale(-1 1)">
        <path pathLength="1" d="M48 405C168 364 65 300 173 258S91 166 204 103 231 54 245 12" />
        <path pathLength="1" d="M95 380 59 339 121 348M137 313 100 275 159 280M154 236 122 201 176 211M174 162 150 119 204 137M207 97 187 69 224 70" />
        <path pathLength="1" d="M18 363C119 366 49 282 131 245S76 138 172 90" />
      </g>
      <circle className="arcane-orbit" cx="320" cy="210" r="174" stroke="#ad8d4a" strokeWidth="0.65" strokeDasharray="1 15 28 15" />
    </svg>
    <div className="summoning-halo" /><div className="summoning-halo halo-second" />
    <div className="orbit-runes">{['✧', '☽', '◇', '✧', '☾', '◇'].map((rune, index) => <span key={index} style={{ '--rune': index } as CSSProperties}>{rune}</span>)}</div>
  </div>
}
