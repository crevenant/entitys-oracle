import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { BookOpen, Check, ChevronRight, Eye, History, Moon, Settings2, Shield, Skull, Sparkles, Volume2, VolumeX, X } from 'lucide-react'
import { catalog, drawFate, readSaved, save } from './lib/oracle'
import type { Draw, Perk, Role } from './lib/oracle'
import { useRitual } from './lib/useRitual'
import { PHASE_COPY } from './lib/ritual'
import type { MotionMode } from './lib/ritual'
import RevealedCard from './components/RevealedCard'
import RitualEffects from './components/RitualEffects'
import './App.css'
import './Ritual.css'

const CardScene = lazy(() => import('./components/CardScene'))
type Panel = 'collection' | 'history' | 'settings' | 'perk' | null
type Preferences = { sound: boolean; motion: MotionMode; haptics: boolean }

function App() {
  const [role, setRole] = useState<Role>('survivor')
  const [history, setHistory] = useState<Draw[]>(() => {
    const saved = readSaved<Draw[]>('oracle:history', [])
    return Array.isArray(saved) ? saved.filter((draw) => draw?.character?.name && Array.isArray(draw.perks) && draw.perks.length === 4).slice(0, 20) : []
  })
  const [excluded, setExcluded] = useState<string[]>(() => {
    const saved = readSaved<string[]>('oracle:excluded', [])
    return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : []
  })
  const [preferences, setPreferences] = useState<Preferences>(() => {
    const saved = readSaved<Partial<Preferences> & { reduced?: boolean }>('oracle:preferences', {})
    const motion: MotionMode = saved?.motion === 'full' || saved?.motion === 'reduced' || saved?.motion === 'system'
      ? saved.motion : saved?.reduced === true ? 'reduced' : 'system'
    return { sound: saved?.sound === true, motion, haptics: saved?.haptics === true }
  })
  const [systemReduced, setSystemReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [panel, setPanel] = useState<Panel>(null)
  const [perk, setPerk] = useState<Perk | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const motion = preferences.motion ?? 'system'
  const reduced = motion === 'reduced' || (motion === 'system' && systemReduced)
  const rememberDraw = useCallback((draw: Draw) => setHistory((previous) => [draw, ...previous].slice(0, 20)), [])
  const ritual = useRitual({ reduced, sound: preferences.sound, haptics: preferences.haptics, onComplete: rememberDraw })
  const { phase, drawing, revealedPerks } = ritual
  const result = ritual.hasCard ? ritual.draw : null
  const characterVisible = phase === 'revealing' || phase === 'complete'
  const characters = catalog.characters.filter((character) => character.role === role)
  const available = characters.filter((character) => !excluded.includes(character.id))
  const perkCount = catalog.perks.filter((entry) => entry.role === role).length

  useEffect(() => { save('oracle:history', history) }, [history])
  useEffect(() => { save('oracle:excluded', excluded) }, [excluded])
  useEffect(() => { save('oracle:preferences', preferences) }, [preferences])
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)')
    const handler = () => setSystemReduced(query.matches)
    query.addEventListener('change', handler)
    return () => query.removeEventListener('change', handler)
  }, [])
  useEffect(() => {
    if (panel && !dialog.current?.open) dialog.current?.showModal()
    if (!panel && dialog.current?.open) dialog.current?.close()
  }, [panel])

  function draw() {
    if (drawing) return
    try {
      const next = drawFate(role, excluded)
      setError('')
      ritual.start(next)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The ritual could not begin.') }
  }

  function changeRole(next: Role) {
    if (drawing) return
    setRole(next)
    ritual.reset()
    setError('')
  }

  function inspect(entry: Perk) { setPerk(entry); setPanel('perk') }
  function setMotion(motion: MotionMode) { setPreferences((previous) => ({ ...previous, motion })) }

  return <div className={`app ${reduced ? 'reduced-motion' : ''} ${drawing ? 'ritual-in-progress' : ''}`} data-phase={phase}>
    <div className="atmosphere" aria-hidden="true"><div className="fog fog-one" /><div className="fog fog-two" /><div className="grain" /></div>
    <header className="header">
      <a className="brand" href="#oracle" onClick={() => setPanel(null)} aria-label="The Entity's Oracle home"><span className="brand-icon"><Eye size={25} strokeWidth={1.25} /></span><span>THE ENTITY’S<span className="brand-sub">O R A C L E</span></span></a>
      <nav aria-label="Main navigation">
        <button className={!panel ? 'nav-link active' : 'nav-link'} onClick={() => setPanel(null)}><Sparkles size={14} />The ritual</button>
        <button className={`nav-link ${panel === 'collection' ? 'active' : ''}`} onClick={() => setPanel('collection')}><BookOpen size={14} />Collection</button>
        <button className={`nav-link ${panel === 'history' ? 'active' : ''}`} onClick={() => setPanel('history')}><History size={14} />Past fates</button>
      </nav>
      <div className="header-actions"><button className="icon-button sound-button" aria-label={preferences.sound ? 'Mute ritual sound' : 'Enable ritual sound'} aria-pressed={preferences.sound} onClick={() => setPreferences({ ...preferences, sound: !preferences.sound })}>{preferences.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button><button className="icon-button" aria-label="Open settings" onClick={() => setPanel('settings')}><Settings2 size={18} /></button></div>
    </header>

    <main id="oracle">
      <section className="intro">
        <p className="eyebrow"><span /> A DEAD BY DAYLIGHT RANDOMIZER <span /></p>
        <h1>Let the <em>Entity</em> decide.</h1>
        <p className="intro-copy">One character. Four perks. A fate written in the fog.</p>
      </section>

      <div className="role-switch" role="group" aria-label="Choose your role">
        <button aria-pressed={role === 'survivor'} disabled={drawing} onClick={() => changeRole('survivor')}><Shield size={15} strokeWidth={1.5} /> Survivor</button>
        <span className="role-divider" />
        <button aria-pressed={role === 'killer'} disabled={drawing} onClick={() => changeRole('killer')}><Skull size={16} strokeWidth={1.5} /> Killer</button>
      </div>

      <section className="ritual-layout" aria-label="Tarot ritual">
        <aside className="ritual-note left-note">
          <span className="section-number">I. THE OFFERING</span>
          <h2>Surrender<br />your choice.</h2>
          <p>Enter the fog with a hand<br className="desktop-break" /> you never saw coming.</p>
          <div className="note-rule" />
          <button className="text-button" onClick={() => setPanel('collection')}>{available.length} {role === 'survivor' ? 'survivors' : 'killers'} in your deck <ChevronRight size={13} /></button>
          <span className="subtle">{perkCount} possible perks</span>
        </aside>

        <div className={`card-stage phase-${phase} ${drawing ? 'is-drawing' : ''} ${result ? 'is-revealed' : ''}`} data-phase={phase} aria-busy={drawing}>
          <div className="ritual-ring ring-outer" aria-hidden="true" /><div className="ritual-ring ring-inner" aria-hidden="true" />
          <RitualEffects phase={phase} />
          <div className="stage-glow" aria-hidden="true" />
          <div className="scene-container"><Suspense fallback={<div className="deck-loading"><img src="/assets/tarot-back.webp" alt="" /></div>}><CardScene phase={phase} revealed={!!result} reduced={reduced} /></Suspense></div>
          {result && <RevealedCard key={result.id} draw={result} phase={phase} revealedPerks={revealedPerks} instant={ritual.instant} onInspect={inspect} />}
          <span className="stage-sigil" aria-hidden="true">✧</span>
          <span className="ritual-chapter" aria-hidden="true">{PHASE_COPY[phase].title}</span>
        </div>

        <aside className="ritual-note right-note">
          <span className="section-number">II. THE REVELATION</span>
          <h2>Four gifts.<br />One dark destiny.</h2>
          <p>Every perk drawn at its<br className="desktop-break" /> highest tier. Always purple.</p>
          <div className="mini-perks" aria-hidden="true">{[1, 2, 3, 4].map((n) => <span className={result && n <= revealedPerks ? 'gift-lit' : ''} key={n}>III</span>)}</div>
          <span className="subtle purple-text">TIER III · VERY RARE</span>
        </aside>
      </section>

      <section className="draw-controls" aria-label="Draw controls">
        <p className="ritual-status" role="status" aria-live="polite">{phase === 'complete' && result ? `${result.character.name}. The fog has spoken.` : PHASE_COPY[phase].message}</p>
        <button className="draw-button" disabled={drawing || available.length === 0} onClick={draw}><Sparkles size={17} strokeWidth={1.5} />{drawing ? 'Consulting the Entity' : result ? 'Tempt fate again' : 'Draw your fate'}<span>↗</span></button>
        {available.length === 0 && <p className="error">Your deck is empty. <button onClick={() => setPanel('collection')}>Choose a character</button> to begin.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="draw-afterword">{drawing ? <button className="skip-ritual" onClick={ritual.skip}>Skip the ritual <ChevronRight size={12} /></button> : <p className="draw-hint">{result ? 'Inspect a perk to reveal its details.' : 'A little chance. A little chaos. Entirely your next trial.'}</p>}</div>
        <div className="motion-notice">{reduced ? <><Moon size={11} /><span>{motion === 'system' ? 'Device motion preference: instant reveal.' : 'Reduced effects: instant reveal.'}</span><button onClick={() => setMotion('full')}>Enable full ritual</button></> : <><Sparkles size={11} /><span>{motion === 'full' ? 'Full ritual enabled' : 'Cinematic ritual · Following device'}</span><button onClick={() => setPanel('settings')}>Adjust</button></>}</div>
      </section>

      {result && characterVisible && <section className="loadout" aria-label="Your four perks">
        <div className="loadout-heading"><span className="eyebrow">YOUR HAND</span><span>ALL PERKS · TIER III</span></div>
        <div className="loadout-grid">{result.perks.map((entry, index) => {
          const shown = index < revealedPerks
          return <button className={`perk-tile ${shown ? 'gift-revealed' : 'gift-concealed'}`} aria-label={shown ? entry.name : `Unrevealed gift ${index + 1}`} disabled={!shown} key={entry.id} onClick={() => inspect(entry)}><span className="perk-icon">{shown ? <img src={entry.image} alt="" /> : <span className="unknown-gift">◇</span>}</span><span><small>0{index + 1} / {shown ? 'VERY RARE' : 'VEILED'}</small><strong>{shown ? entry.name : 'Awaiting the Entity'}</strong></span><ChevronRight size={14} /></button>
        })}</div>
      </section>}
    </main>

    <footer><span><span className="connection-dot" /> AN UNOFFICIAL OFFERING TO THE FOG</span><span>Made for the unpredictable. <span className="footer-diamond">◇</span></span></footer>

    <dialog ref={dialog} aria-label={panel === 'collection' ? 'Character collection' : panel === 'history' ? 'Past fates' : panel === 'perk' ? 'Perk details' : 'Ritual settings'} className={`modal ${panel === 'collection' ? 'collection-modal' : ''}`} onCancel={() => setPanel(null)} onClick={(event) => { if (event.target === event.currentTarget) setPanel(null) }} onClose={() => setPanel(null)}>
      <div className="modal-content">
        <button className="icon-button close-button" onClick={() => setPanel(null)} aria-label="Close dialog"><X size={20} /></button>
        {panel === 'collection' && <><p className="eyebrow">CURATE YOUR OFFERING</p><h2>Your {role} deck</h2><p className="modal-copy">Choose the characters the Entity can draw. Perks come from the entire {role} perk pool.</p>
          <div className="collection-toolbar"><input aria-label="Search characters" placeholder="Find a character…" value={search} onChange={(event) => setSearch(event.target.value)} /><button onClick={() => setExcluded((previous) => previous.filter((id) => !characters.some((entry) => entry.id === id)))}>Select all</button><button onClick={() => setExcluded((previous) => [...new Set([...previous, ...characters.map((entry) => entry.id)])])}>Clear</button></div>
          <p className="collection-count">{available.length} of {characters.length} characters selected</p>
          <div className="collection-grid">{characters.filter((entry) => entry.name.toLowerCase().includes(search.toLowerCase())).map((entry) => {
            const selected = !excluded.includes(entry.id)
            return <button className={`collection-character ${selected ? 'selected' : ''}`} key={entry.id} aria-pressed={selected} onClick={() => setExcluded((previous) => selected ? [...previous, entry.id] : previous.filter((id) => id !== entry.id))}><img src={entry.image} alt="" loading="lazy" /><span>{entry.name}</span><span className="collection-check">{selected && <Check size={12} />}</span></button>
          })}</div>
          {!characters.some((entry) => entry.name.toLowerCase().includes(search.toLowerCase())) && <p className="empty-state">No characters match your search.</p>}
          <p className="catalog-note">Local catalog snapshot · {catalog.characters.length} characters and {catalog.perks.length} perks with matching artwork. Exclusions are saved on this device.</p>
        </>}
        {panel === 'history' && <><p className="eyebrow">ECHOES IN THE FOG</p><h2>Past fates</h2><p className="modal-copy">Your last 20 draws, saved on this device. Choose one to revisit its hand.</p>
          {history.length ? <><div className="history-list">{history.map((entry) => <button key={entry.id} onClick={() => { if (drawing) return; setRole(entry.character.role as Role); ritual.restore(entry); setPanel(null) }} disabled={drawing}><img src={entry.character.image} alt="" /><span><strong>{entry.character.name}</strong><small>{entry.perks.map((p) => p.name).join(' · ')}</small></span><ChevronRight size={16} /></button>)}</div><button className="text-button clear-history" onClick={() => setHistory([])}>Clear saved history</button></> : <div className="empty-state"><History size={30} /><p>No fate has been written yet.</p><button className="text-button" onClick={() => setPanel(null)}>Return to the ritual <ChevronRight size={14} /></button></div>}
        </>}
        {panel === 'settings' && <><p className="eyebrow">SET THE ATMOSPHERE</p><h2>Ritual settings</h2><p className="modal-copy">Make the fog feel like home.</p><label className="setting"><span><strong><Volume2 size={18} /> Ritual sound</strong><small>Card whispers, a dark crescendo, and four chiming gifts.</small></span><input type="checkbox" checked={preferences.sound} onChange={(event) => setPreferences({ ...preferences, sound: event.target.checked })} /></label><label className="setting"><span><strong><Sparkles size={18} /> Haptic feedback</strong><small>{'vibrate' in navigator ? 'A gentle pulse with each revelation on supported devices.' : 'Vibration is unavailable in this browser.'}</small></span><input type="checkbox" disabled={!('vibrate' in navigator)} checked={preferences.haptics} onChange={(event) => setPreferences({ ...preferences, haptics: event.target.checked })} /></label><fieldset className="motion-setting"><legend><Moon size={18} /> Motion effects</legend><div className="motion-options"><button aria-pressed={motion === 'system'} onClick={() => setMotion('system')}>Follow device</button><button aria-pressed={motion === 'full'} onClick={() => setMotion('full')}>Full ritual</button><button aria-pressed={motion === 'reduced'} onClick={() => setMotion('reduced')}>Reduced effects</button></div><p className="motion-explanation">{motion === 'full' ? 'Cinematic shuffling, a card flip, and four staged perk reveals. This choice is saved for this app.' : motion === 'reduced' ? 'Reveal instantly, with no shuffling or moving particles.' : systemReduced ? 'Your device prefers reduced motion, so draws reveal instantly. Choose Full ritual to play the animation in this app.' : 'Your device allows animation, so the full cinematic ritual plays.'}</p></fieldset><p className="catalog-note">Character and perk artwork © Behaviour Interactive and their respective owners. This is an unofficial fan project, unaffiliated with Dead by Daylight.</p></>}
        {panel === 'perk' && perk && <><p className="eyebrow purple-text">VERY RARE · TIER III</p><div className="perk-detail-icon"><img src={perk.image} alt="" /></div><h2>{perk.name}</h2><p className="perk-description">{perk.description}</p><p className="catalog-note">{perk.role === 'killer' ? 'Killer' : 'Survivor'} perk · Local community-data snapshot; descriptions may differ from the live game.</p></>}
      </div>
    </dialog>
  </div>
}

export default App
