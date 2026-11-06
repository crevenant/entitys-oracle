import type { CSSProperties } from 'react'

export default function SpectralBinding() {
  return <div className="spectral-binding" aria-hidden="true">
    {['upper-left', 'lower-right'].map((corner) => <div className={`binding-chain chain-${corner}`} key={corner}>{Array.from({ length: 9 }, (_, index) => <span key={index} style={{ '--link': index } as CSSProperties} />)}</div>)}
  </div>
}
