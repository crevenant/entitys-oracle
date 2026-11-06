import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { BookOpen, Check, ChevronRight, Eye, History, Moon, Settings2, Shield, Skull, Sparkles, Volume2, VolumeX, X } from 'lucide-react'
import { catalog, drawFate, readSaved, save } from './lib/oracle'
import type { Draw, Perk, Role } from './lib/oracle'
import { playRitual } from './lib/sound'
import './App.css'

const CardScene = lazy(() => import('./components/CardScene'))
type Panel = 'collection' | 'history' | 'settings' | 'perk' | null
type Preferences = { sound: boolean; reduced: boolean }

function App() {
  const [role, setRole] = useState<Role>('survivor')
  const [result, setResult] = useState<Draw | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [history, setHistory] = useState<Draw[]>(() => {
    const saved = readSaved<Draw[]>('oracle:history', [])
    return Array.isArray(saved) ? saved.filter((draw) => draw?.character?.name && Array.isArray(draw.perks) && draw.perks.length === 4).slice(0, 20) : []
  })
  const [excluded, setExcluded] = useState<string[]>(() => {
    const saved = readSaved<string[]>('oracle:excluded', [])
    return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : []
  })
  const [preferences, setPreferences] = useState<Preferences>(() => {
    const saved = readSaved<Partial<Preferences>>('oracle:preferences', {})
    return { sound: saved?.sound === true, reduced: saved?.reduced === true }
  })
  const [systemReduced, setSystemReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [panel, setPanel] = useState<Panel>(null)
  const [perk, setPerk] = useState<Perk | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const drawLock = useRef(false)
  const reduced = preferences.reduced || systemReduced
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
    return () => { query.removeEventListener('change', handler); if (timer.current) clearTimeout(timer.current) }
  }, [])
  useEffect(() => {
    if (panel && !dialog.current?.open) dialog.current?.showModal()
    if (!panel && dialog.current?.open) dialog.current?.close()
  }, [panel])

  function draw() {
    if (drawLock.current) return
    try {
      const next = drawFate(role, excluded)
      drawLock.current = true
      setError('')
      setResult(null)
      setDrawing(true)
      if (preferences.sound) playRitual()
      timer.current = setTimeout(() => {
        setResult(next)
        setHistory((previous) => [next, ...previous].slice(0, 20))
        setDrawing(false)
        drawLock.current = false
      }, reduced ? 100 : 1900)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The ritual could not begin.') }
  }

  function changeRole(next: Role) {
    if (drawing) return
    setRole(next)
    setResult(null)
    setError('')
  }

  function inspect(entry: Perk) { setPerk(entry); setPanel('perk') }

  return <div className={`app ${reduced ? 'reduced-motion' : ''}`}>
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

        <div className={`card-stage ${drawing ? 'is-drawing' : ''} ${result ? 'is-revealed' : ''}`}>
          <div className="ritual-ring ring-outer" aria-hidden="true" /><div className="ritual-ring ring-inner" aria-hidden="true" />
          <div className="stage-glow" aria-hidden="true" />
          <div className="scene-container"><Suspense fallback={<div className="deck-loading"><img src="/assets/tarot-back.webp" alt="" /></div>}><CardScene drawing={drawing} revealed={!!result} reduced={reduced} /></Suspense></div>
          {result && <article key={result.id} className="revealed-card" aria-label={`Your fate: ${result.character.name}`}>
            <span className="card-roman">{result.character.role === 'survivor' ? 'XVII' : 'XIII'} <Eye size={15} /> {result.character.role.toUpperCase()}</span>
            <div className="portrait-frame"><img className="character-portrait" src={result.character.image} alt={result.character.name} /><div className="portrait-shade" /></div>
            <div className="card-identity"><span>THE ENTITY HAS CHOSEN</span><h2>{result.character.name}</h2></div>
            <div className="card-perks">{result.perks.map((entry) => <button key={entry.id} aria-label={`View ${entry.name}, tier III`} onClick={() => inspect(entry)}><img src={entry.image} alt="" /></button>)}</div>
            <span className="card-bottom">◇ &nbsp; YOUR FATE IS SEALED &nbsp; ◇</span>
          </article>}
          <span className="stage-sigil" aria-hidden="true">✧</span>
        </div>

        <aside className="ritual-note right-note">
          <span className="section-number">II. THE REVELATION</span>
          <h2>Four gifts.<br />One dark destiny.</h2>
          <p>Every perk drawn at its<br className="desktop-break" /> highest tier. Always purple.</p>
          <div className="mini-perks" aria-hidden="true">{[1, 2, 3, 4].map((n) => <span key={n}>III</span>)}</div>
          <span className="subtle purple-text">TIER III · VERY RARE</span>
        </aside>
      </section>

      <section className="draw-controls" aria-label="Draw controls">
        <p className="ritual-status" role="status" aria-live="polite">{drawing ? 'The Entity is shuffling your fate…' : result ? `${result.character.name}. The fog has spoken.` : 'THE CARDS ARE WAITING.'}</p>
        <button className="draw-button" disabled={drawing || available.length === 0} onClick={draw}><Sparkles size={17} strokeWidth={1.5} />{drawing ? 'Consulting the Entity' : result ? 'Tempt fate again' : 'Draw your fate'}<span>↗</span></button>
        {available.length === 0 && <p className="error">Your deck is empty. <button onClick={() => setPanel('collection')}>Choose a character</button> to begin.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <p className="draw-hint">{result ? 'Inspect a perk to reveal its details.' : 'A little chance. A little chaos. Entirely your next trial.'}</p>
      </section>

      {result && <section className="loadout" aria-label="Your four perks">
        <div className="loadout-heading"><span className="eyebrow">YOUR HAND</span><span>ALL PERKS · TIER III</span></div>
        <div className="loadout-grid">{result.perks.map((entry, index) => <button className="perk-tile" key={entry.id} onClick={() => inspect(entry)}><span className="perk-icon"><img src={entry.image} alt="" /></span><span><small>0{index + 1} / VERY RARE</small><strong>{entry.name}</strong></span><ChevronRight size={14} /></button>)}</div>
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
          {history.length ? <><div className="history-list">{history.map((entry) => <button key={entry.id} onClick={() => { if (drawing) return; setRole(entry.character.role as Role); setResult(entry); setPanel(null) }} disabled={drawing}><img src={entry.character.image} alt="" /><span><strong>{entry.character.name}</strong><small>{entry.perks.map((p) => p.name).join(' · ')}</small></span><ChevronRight size={16} /></button>)}</div><button className="text-button clear-history" onClick={() => setHistory([])}>Clear saved history</button></> : <div className="empty-state"><History size={30} /><p>No fate has been written yet.</p><button className="text-button" onClick={() => setPanel(null)}>Return to the ritual <ChevronRight size={14} /></button></div>}
        </>}
        {panel === 'settings' && <><p className="eyebrow">SET THE ATMOSPHERE</p><h2>Ritual settings</h2><p className="modal-copy">Make the fog feel like home.</p><label className="setting"><span><strong><Volume2 size={18} /> Ritual sound</strong><small>A soft, ominous chord when you draw.</small></span><input type="checkbox" checked={preferences.sound} onChange={(event) => setPreferences({ ...preferences, sound: event.target.checked })} /></label><label className="setting"><span><strong><Moon size={18} /> Reduced effects</strong><small>Less movement and fewer particles.</small></span><input type="checkbox" checked={preferences.reduced} onChange={(event) => setPreferences({ ...preferences, reduced: event.target.checked })} /></label>{systemReduced && <p className="catalog-note">Your device’s reduced-motion preference is active.</p>}<p className="catalog-note">Character and perk artwork © Behaviour Interactive and their respective owners. This is an unofficial fan project, unaffiliated with Dead by Daylight.</p></>}
        {panel === 'perk' && perk && <><p className="eyebrow purple-text">VERY RARE · TIER III</p><div className="perk-detail-icon"><img src={perk.image} alt="" /></div><h2>{perk.name}</h2><p className="perk-description">{perk.description}</p><p className="catalog-note">{perk.role === 'killer' ? 'Killer' : 'Survivor'} perk · Local community-data snapshot; descriptions may differ from the live game.</p></>}
      </div>
    </dialog>
  </div>
}

export default App
