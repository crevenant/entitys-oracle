export default function SummoningSeal() {
  return <svg className="summoning-seal" viewBox="0 0 100 100" fill="none" aria-hidden="true">
    <g className="seal-rings" stroke="currentColor" strokeWidth=".7">
      <circle cx="50" cy="43" r="29" strokeDasharray="73 6 28 9 43 23" />
      <circle cx="50" cy="43" r="24" strokeDasharray="1 5 18 4" />
      <path d="m50 9 1 9m32 24-8 1M50 69l-1 9M17 43l9-1M27 19l5 7m40-5-6 7M24 66l9-5m40 8-7-8" />
      <path d="m48 12 3-7m29 21 7-5M15 50l7-2m50 29 5 6" opacity=".5" />
    </g>
    <path d="M32 43q18-22 36 0-18 22-36 0Z" stroke="currentColor" strokeWidth="1" />
    <path d="M50 36q-5 7 0 14 5-7 0-14Z" fill="currentColor" opacity=".8" />
    <g className="seal-roots" stroke="currentColor" strokeWidth=".8" strokeLinecap="round">
      <path d="M32 63c-7 6-4 15-12 19l-9 5m12-7-1 10m7-20-9 2M49 72c-4 7 3 12-2 22m1-13 7 5m13-24c7 8 1 16 10 23l10 7m-11-9 8-2m-14-9 7-4" />
    </g>
  </svg>
}
