import type { CSSProperties } from 'react'

export default function ForestBackdrop() {
  return <div className="forest-backdrop" aria-hidden="true">
    <picture className="forest-distance"><source media="(max-width: 640px)" srcSet="/assets/forest-mobile.webp" /><img src="/assets/forest-night.webp" alt="" fetchPriority="high" /></picture>
    <div className="forest-role-light" />
    <div className="forest-mist mist-distant" /><div className="forest-mist mist-near" />
    <div className="campfire-light" />
    <svg className="forest-branches" viewBox="0 0 1440 1000" preserveAspectRatio="none" fill="#020605">
      <path d="M0 0H66C43 110 89 151 53 249S96 386 61 492 119 664 75 770 103 925 157 1000H0ZM25 224C68 209 79 176 116 146L93 195 143 182 100 220 51 251ZM49 513C92 484 81 423 153 403L113 442 147 466 109 461 66 552ZM74 770C114 742 123 674 183 660L139 701 164 743 117 732 96 801Z" />
      <path d="M1440 0H1390C1409 123 1361 175 1394 283S1340 477 1380 586 1338 800 1294 887L1238 1000H1440ZM1390 303C1343 278 1355 235 1293 212L1329 251 1289 267 1347 278 1383 333ZM1376 612C1333 586 1325 541 1272 528L1308 562 1279 598 1322 586 1367 653Z" />
    </svg>
    <div className="forest-embers">{Array.from({ length: 14 }, (_, index) => <i key={index} style={{ '--ember-x': `${(index * 31 + 9) % 100}%`, '--ember-delay': `${index * -1.7}s`, '--ember-duration': `${13 + index % 5}s` } as CSSProperties} />)}</div>
    <div className="forest-vignette" />
  </div>
}
