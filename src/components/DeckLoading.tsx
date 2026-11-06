import { Eye } from 'lucide-react'
import './DeckLoading.css'

export default function DeckLoading() {
  return <div className="deck-loading" role="status" aria-live="polite">
    <div className="deck-loading-sigil" aria-hidden="true">
      <span className="deck-loading-orbit" />
      <span className="deck-loading-orbit orbit-reverse" />
      <Eye size={36} strokeWidth={1} />
      <span className="deck-loading-ember" />
    </div>
    <p>Something is waking<span aria-hidden="true">…</span></p>
    <span className="deck-loading-caption">IT ALREADY KNOWS YOUR NAME</span>
  </div>
}
