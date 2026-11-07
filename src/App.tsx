import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { BookOpen, ChevronRight, HeartPulse, History, LockKeyhole, Moon, Settings2, Sparkles, Volume2, VolumeX, X } from 'lucide-react'
import { catalog, drawFate, readSaved, save } from './lib/oracle'
import type { Draw, Perk, Role } from './lib/oracle'
import { useRitual } from './lib/useRitual'
import { useCaptivity } from './lib/captivity'
import { PHASE_COPY } from './lib/ritual'
import type { MotionMode } from './lib/ritual'
import RevealedCard from './components/RevealedCard'
import RitualEffects from './components/RitualEffects'
import CollectionPanel from './components/CollectionPanel'
import type { CollectionTab } from './components/CollectionPanel'
import LoadoutControls from './components/LoadoutControls'
import ForestBackdrop from './components/ForestBackdrop'
import LivingHeadline from './components/LivingHeadline'
import SoundControls from './components/SoundControls'
import DeckLoading from './components/DeckLoading'
import SummoningSeal from './components/SummoningSeal'
import { useBackgroundTheme } from './lib/useBackgroundTheme'
import { THEME_FILE } from './lib/sound'
import './App.css'
import './Ritual.css'
import './Loadout.css'
import './Horror.css'
import './Sound.css'
import './CardEye.css'
import './CardInspection.css'
import './PortraitVideo.css'
import './Summons.css'

const CardScene = lazy(() => import('./components/CardScene'))
type Panel = 'collection' | 'history' | 'settings' | 'perk' | null
type Preferences = { sound: boolean; volume: number; music: boolean; musicVolume: number; muted: boolean; motion: MotionMode; haptics: boolean }
type Locks = { character: string | null; perks: (string | null)[] }
const emptyLocks = (): Locks => ({ character: null, perks: [null, null, null, null] })

function App() {
  const [cardsReady, setCardsReady] = useState(false)
  const onCardsReady = useCallback(() => setCardsReady(true), [])
  const [role, setRole] = useState<Role>('survivor')
  const [history, setHistory] = useState<Draw[]>(() => {
    const saved = readSaved<Draw[]>('oracle:history', [])
    return Array.isArray(saved) ? saved.filter((draw) => draw?.character?.name && Array.isArray(draw.perks) && draw.perks.length === 4).slice(0, 20) : []
  })
  const [excluded, setExcluded] = useState<string[]>(() => {
    const saved = readSaved<string[]>('oracle:excluded', [])
    return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : []
  })
  const [excludedPerks, setExcludedPerks] = useState<string[]>(() => {
    const saved = readSaved<string[]>('oracle:excludedPerks', [])
    return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : []
  })
  const [locks, setLocks] = useState<Locks>(emptyLocks)
  const [preferences, setPreferences] = useState<Preferences>(() => {
    const saved = readSaved<Partial<Preferences> & { reduced?: boolean }>('oracle:preferences', {})
    const motion: MotionMode = saved?.motion === 'full' || saved?.motion === 'reduced' || saved?.motion === 'system'
      ? saved.motion : saved?.reduced === true ? 'reduced' : 'system'
    const volume = typeof saved?.volume === 'number' && Number.isFinite(saved.volume) ? Math.max(0, Math.min(1, saved.volume)) : .75
    const musicVolume = typeof saved?.musicVolume === 'number' && Number.isFinite(saved.musicVolume) ? Math.max(0, Math.min(1, saved.musicVolume)) : .4
    return { sound: saved?.sound === true, volume, music: saved?.music !== false, musicVolume, muted: saved?.muted === true, motion, haptics: saved?.haptics === true }
  })
  const [systemReduced, setSystemReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [panel, setPanel] = useState<Panel>(null)
  const [perk, setPerk] = useState<Perk | null>(null)
  const [collectionTab, setCollectionTab] = useState<CollectionTab>('characters')
  const [error, setError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const options = useRef<HTMLDivElement>(null)
  const motion = preferences.motion ?? 'system'
  const reduced = motion === 'reduced' || (motion === 'system' && systemReduced)
  const soundVolume = preferences.volume ?? .75
  const rememberDraw = useCallback((draw: Draw) => setHistory((previous) => [draw, ...previous].slice(0, 20)), [])
  const ritual = useRitual({ reduced, sound: preferences.sound && !preferences.muted, volume: soundVolume, haptics: preferences.haptics, onComplete: rememberDraw })
  const { phase, drawing, revealedPerks } = ritual
  const cardStage = useRef<HTMLDivElement>(null)
  const captivity = useCaptivity(phase, !reduced && !ritual.instant, cardStage)
  const musicEnabled = preferences.music ?? true
  const musicVolume = preferences.musicVolume ?? .4
  const { audioRef: themeAudioRef, state: themeState, startTheme } = useBackgroundTheme(musicEnabled && !preferences.muted, musicVolume, drawing && preferences.sound && !preferences.muted)
  const result = ritual.hasCard ? ritual.draw : null
  const characterVisible = phase === 'revealing' || phase === 'complete'
  const characters = catalog.characters.filter((character) => character.role === role)
  const available = characters.filter((character) => !excluded.includes(character.id))
  const perkCount = catalog.perks.filter((entry) => entry.role === role && !excludedPerks.includes(entry.id)).length
  const lockCount = Number(locks.character !== null) + locks.perks.filter(Boolean).length
  const allLocked = lockCount === 5

  useEffect(() => { save('oracle:history', history) }, [history])
  useEffect(() => { save('oracle:excluded', excluded) }, [excluded])
  useEffect(() => { save('oracle:excludedPerks', excludedPerks) }, [excludedPerks])
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
    if (!cardsReady || drawing || allLocked) return
    try {
      const next = drawFate(role, excluded, { excludedPerks, lockedCharacterId: locks.character, lockedPerks: locks.perks })
      setError('')
      ritual.start(next)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The ritual could not begin.') }
  }

  function changeRole(next: Role) {
    if (drawing || next === role) return
    setRole(next)
    setLocks(emptyLocks())
    ritual.reset()
    setError('')
  }

  function inspect(entry: Perk) { setPerk(entry); setPanel('perk') }
  function setMotion(motion: MotionMode) { setPreferences((previous) => ({ ...previous, motion })) }
  function openPanel(panel: Panel) { options.current?.hidePopover(); setPanel(panel) }
  function openCollection(tab: CollectionTab) { setCollectionTab(tab); openPanel('collection') }
  function changeCharacterPool(next: string[]) {
    if (drawing) return
    setExcluded(next)
    setLocks((previous) => ({ ...previous, character: previous.character && next.includes(previous.character) ? null : previous.character }))
    setError('')
  }
  function changePerkPool(next: string[]) {
    if (drawing) return
    setExcludedPerks(next)
    setLocks((previous) => ({ ...previous, perks: previous.perks.map((id) => id && next.includes(id) ? null : id) }))
    setError('')
  }
  function toggleCharacterLock() {
    if (drawing || !result) return
    setExcluded((previous) => previous.filter((id) => id !== result.character.id))
    setLocks((previous) => ({ ...previous, character: previous.character === result.character.id ? null : result.character.id }))
  }
  function togglePerkLock(index: number) {
    if (drawing || !result?.perks[index]) return
    const id = result.perks[index].id
    setExcludedPerks((previous) => previous.filter((entry) => entry !== id))
    setLocks((previous) => ({ ...previous, perks: previous.perks.map((held, slot) => slot === index ? held === id ? null : id : held) }))
  }
  function restoreDraw(entry: Draw) {
    if (drawing) return
    setRole(entry.character.role as Role)
    setLocks(emptyLocks())
    ritual.restore(entry)
    setPanel(null)
    setError('')
  }

  return <div className={`app ${reduced ? 'reduced-motion' : ''} ${drawing ? 'ritual-in-progress' : ''}`} data-phase={phase} data-role={role}>
    <audio ref={themeAudioRef} src={THEME_FILE} autoPlay={musicEnabled && !preferences.muted} loop preload={musicEnabled && !preferences.muted ? 'auto' : 'none'} aria-hidden="true" data-background-theme data-state={themeState} data-ducked={drawing && preferences.sound && !preferences.muted} />
    <ForestBackdrop reduced={reduced} />
    <div className="atmosphere" aria-hidden="true"><div className="fog fog-one" /><div className="fog fog-two" /><div className="grain" /></div>

    <main id="oracle">
      <section className="intro">
        <p className="eyebrow"><span /> A DEAD BY DAYLIGHT RANDOMIZER <span /></p>
        <h1 className="summons-title">
          <span className="headline-copy">Draw a fate you can’t escape.</span>
          <LivingHeadline reduced={reduced} />
        </h1>
        <p className="intro-copy">One character. Four perks. Feed it your suffering.</p>
      </section>

      <div className="role-switch" role="group" aria-label="Choose your role">
        <button className="survivor-choice" aria-pressed={role === 'survivor'} disabled={drawing} onClick={() => changeRole('survivor')}><HeartPulse size={15} strokeWidth={1.5} /> Survivor</button>
        <span className="role-divider" />
        <button className="killer-choice" aria-pressed={role === 'killer'} disabled={drawing} onClick={() => changeRole('killer')}><svg className="role-scratches" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true"><path d="m7 2-4 16M12 1 8 18M17 2l-4 15M2 7l16 6" /></svg> Killer</button>
      </div>

      <section className="ritual-layout" aria-label="Tarot ritual">
        <aside className="ritual-note left-note">
          <SummoningSeal />
          <span className="section-number">I. THE SURRENDER</span>
          <h2>Your will<br />ends here.</h2>
          <p>It heard you praying.<br className="desktop-break" /> It came to watch you break.</p>
          <div className="note-rule" />
          <button className="text-button" onClick={() => openCollection('characters')}>{available.length} {role === 'survivor' ? 'survivors' : 'killers'} in your deck <ChevronRight size={13} /></button>
          <button className="text-button edit-pool-link" onClick={() => openCollection('perks')}>{perkCount} eligible perks <ChevronRight size={13} /></button>
        </aside>

        <div ref={cardStage} className={`card-stage phase-${phase} ${drawing ? 'is-drawing' : ''} ${result ? 'is-revealed' : ''}`} data-phase={phase} data-scene-ready={cardsReady} aria-busy={drawing || !cardsReady}>
          <div className="ritual-ring ring-outer" aria-hidden="true" /><div className="ritual-ring ring-inner" aria-hidden="true" />
          <RitualEffects phase={phase} />
          <div className="stage-glow" aria-hidden="true" />
          {!cardsReady && <DeckLoading />}
          <div className="scene-container"><Suspense fallback={null}><CardScene role={role} phase={phase} revealed={!!result} reduced={reduced} instant={ritual.instant} captivity={captivity} onReady={onCardsReady} /></Suspense></div>
          {result && <RevealedCard key={result.id} draw={result} phase={phase} revealedPerks={revealedPerks} instant={ritual.instant} reduced={reduced} captivity={captivity} onInspect={inspect} lockedCharacter={locks.character === result.character.id} lockedPerks={locks.perks} />}
          <span className="stage-sigil" aria-hidden="true">✧</span>
          <span className="ritual-chapter" aria-hidden="true">{PHASE_COPY[phase].title}</span>
        </div>

        <aside className="ritual-note right-note">
          <span className="gift-inscription" aria-hidden="true">IV</span>
          <span className="section-number">II. THE CRUEL GIFTS</span>
          <h2>Mercy was<br />never offered.</h2>
          <p>Four gifts to keep you alive.<br className="desktop-break" /> Long enough to suffer.</p>
          <div className="mini-perks" aria-hidden="true">{[1, 2, 3, 4].map((n) => <span className={result && n <= revealedPerks ? 'gift-lit' : ''} style={{ '--gift': n - 1 } as CSSProperties} key={n}><b>III</b></span>)}</div>
          <span className="subtle purple-text">TIER III · VERY RARE</span>
        </aside>
      </section>

      <section className="draw-controls" aria-label="Draw controls">
        <p className="ritual-status" role="status" aria-live="polite">{!cardsReady ? 'SOMETHING HAS FOUND YOU.' : phase === 'complete' && result ? `${result.character.name}. ${PHASE_COPY.complete.message}` : PHASE_COPY[phase].message}</p>
        <button className="draw-button" disabled={!cardsReady || drawing || available.length === 0 || perkCount < 4 || allLocked} onClick={draw}>{lockCount > 0 && !drawing ? <LockKeyhole size={17} strokeWidth={1.5} /> : <Sparkles size={17} strokeWidth={1.5} />}{drawing ? 'The Entity is feeding' : allLocked ? 'All entries locked' : result ? lockCount > 0 ? 'Reroll unlocked' : 'Tempt fate again' : 'Seal your fate'}<span>↗</span></button>
        {available.length === 0 && <p className="error">Your deck is empty. <button onClick={() => openCollection('characters')}>Choose a character</button> to begin.</p>}
        {perkCount < 4 && <p className="error">Your pool has {perkCount} {role} perks. <button onClick={() => openCollection('perks')}>Choose at least four perks</button> to draw.</p>}
        {allLocked && <p className="error">Every entry is locked. <button onClick={() => setLocks(emptyLocks())}>Release all locks</button> to draw again.</p>}
        {lockCount > 0 && !allLocked && <p className="held-summary"><LockKeyhole size={10} />{lockCount} of 5 entries held for the next draw</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {musicEnabled && !preferences.muted && themeState === 'waiting' && <button className="theme-start" onClick={startTheme}><Volume2 size={12} />Start background theme</button>}
        <div className="draw-afterword">{drawing ? <button className="skip-ritual" onClick={ritual.skip}>Skip the ritual <ChevronRight size={12} /></button> : <p className="draw-hint">{result ? reduced || ritual.instant ? 'Click the card for a closer look, or inspect a perk.' : 'Click the card to challenge the Entity, or inspect a perk.' : 'Beg if you must. It likes that.'}</p>}</div>
        <div className="motion-notice">
          {reduced ? <><Moon size={11} /><span>{motion === 'system' ? 'Device motion preference: instant reveal.' : 'Reduced effects: instant reveal.'}</span><button onClick={() => setMotion('full')}>Enable full ritual</button></> : <><Sparkles size={11} /><span>{motion === 'full' ? 'Full ritual enabled' : 'Cinematic ritual · Following device'}</span></>}
          <button className="options-trigger" popoverTarget="ritual-options"><Settings2 size={12} />Options</button>
        </div>
        <div ref={options} id="ritual-options" className="ritual-options" popover="auto" role="group" aria-label="Ritual options">
          <button onClick={() => openCollection('characters')}><BookOpen size={15} />Collection</button>
          <button onClick={() => openPanel('history')}><History size={15} />Past fates</button>
          <button aria-label={preferences.muted ? 'Unmute all sound' : 'Mute all sound'} aria-pressed={!preferences.muted} onClick={() => {
            options.current?.hidePopover()
            setPreferences((previous) => ({ ...previous, muted: !previous.muted }))
          }}>{preferences.muted ? <VolumeX size={15} /> : <Volume2 size={15} />}{preferences.muted ? 'Unmute sound' : 'Mute sound'}</button>
          <button aria-label="Open settings" onClick={() => openPanel('settings')}><Settings2 size={15} />Settings</button>
        </div>
      </section>

      {result && characterVisible && <LoadoutControls draw={result} revealedPerks={revealedPerks} drawing={drawing} lockedCharacter={locks.character === result.character.id} lockedPerks={locks.perks} onCharacterLock={toggleCharacterLock} onPerkLock={togglePerkLock} onUnlock={() => setLocks(emptyLocks())} onInspect={inspect} onPool={() => openCollection('perks')} />}

    </main>

    <footer><span><span className="connection-dot" /> AN UNOFFICIAL OFFERING TO THE FOG</span><span>Hope is how it keeps you here. <span className="footer-diamond">◇</span></span></footer>

    <dialog ref={dialog} aria-label={panel === 'collection' ? 'Your collection' : panel === 'history' ? 'Past fates' : panel === 'perk' ? 'Perk details' : 'Ritual settings'} className={`modal ${panel === 'collection' ? 'collection-modal' : ''}`} onCancel={() => setPanel(null)} onClick={(event) => { if (event.target === event.currentTarget) setPanel(null) }} onClose={() => setPanel(null)}>
      <div className="modal-content">
        <button className="icon-button close-button" onClick={() => setPanel(null)} aria-label="Close dialog"><X size={20} /></button>
        {panel === 'collection' && <CollectionPanel role={role} tab={collectionTab} onTab={setCollectionTab} excludedCharacters={excluded} excludedPerks={excludedPerks} onCharacters={changeCharacterPool} onPerks={changePerkPool} drawing={drawing} />}
        {panel === 'history' && <><p className="eyebrow">ECHOES IN THE FOG</p><h2>Past fates</h2><p className="modal-copy">Your last 20 draws, saved on this device. Choose one to revisit its hand.</p>
          {history.length ? <><div className="history-list">{history.map((entry) => <button key={entry.id} onClick={() => restoreDraw(entry)} disabled={drawing}><img src={entry.character.image} alt="" /><span><strong>{entry.character.name}</strong><small>{entry.perks.map((p) => p.name).join(' · ')}</small></span><ChevronRight size={16} /></button>)}</div><button className="text-button clear-history" onClick={() => setHistory([])}>Clear saved history</button></> : <div className="empty-state"><History size={30} /><p>No fate has been written yet.</p><button className="text-button" onClick={() => setPanel(null)}>Return to the ritual <ChevronRight size={14} /></button></div>}
        </>}
        {panel === 'settings' && <><p className="eyebrow">SET THE ATMOSPHERE</p><h2>Ritual settings</h2><p className="modal-copy">Choose how the darkness finds you.</p><SoundControls music={musicEnabled} musicVolume={musicVolume} muted={preferences.muted} themeState={themeState} onMusic={(music) => setPreferences((previous) => ({ ...previous, music }))} onMusicVolume={(musicVolume) => setPreferences((previous) => ({ ...previous, musicVolume }))} onUnmute={() => setPreferences((previous) => ({ ...previous, muted: false }))} enabled={preferences.sound} volume={soundVolume} onEnabled={(sound) => setPreferences((previous) => ({ ...previous, sound }))} onVolume={(volume) => setPreferences((previous) => ({ ...previous, volume }))} /><label className="setting"><span><strong><Sparkles size={18} /> Haptic feedback</strong><small>{'vibrate' in navigator ? 'A gentle pulse with each revelation on supported devices.' : 'Vibration is unavailable in this browser.'}</small></span><input type="checkbox" disabled={!('vibrate' in navigator)} checked={preferences.haptics} onChange={(event) => setPreferences({ ...preferences, haptics: event.target.checked })} /></label><fieldset className="motion-setting"><legend><Moon size={18} /> Motion effects</legend><div className="motion-options"><button aria-pressed={motion === 'system'} onClick={() => setMotion('system')}>Follow device</button><button aria-pressed={motion === 'full'} onClick={() => setMotion('full')}>Full ritual</button><button aria-pressed={motion === 'reduced'} onClick={() => setMotion('reduced')}>Reduced effects</button></div><p className="motion-explanation">{motion === 'full' ? 'Cinematic shuffling, a card flip, and four staged perk reveals. This choice is saved for this app.' : motion === 'reduced' ? 'Reveal instantly, with no shuffling or moving particles.' : systemReduced ? 'Your device prefers reduced motion, so draws reveal instantly. Choose Full ritual to play the animation in this app.' : 'Your device allows animation, so the full cinematic ritual plays.'}</p></fieldset><p className="catalog-note">Character and perk artwork © Behaviour Interactive and their respective owners. This is an unofficial fan project, unaffiliated with Dead by Daylight.</p></>}
        {panel === 'perk' && perk && <><p className="eyebrow purple-text">VERY RARE · TIER III</p><div className="perk-detail-icon"><img src={perk.image} alt="" /></div><h2>{perk.name}</h2><p className="perk-description">{perk.description}</p><p className="catalog-note">{perk.role === 'killer' ? 'Killer' : 'Survivor'} perk · Local community-data snapshot; descriptions may differ from the live game.</p></>}
      </div>
    </dialog>
  </div>
}

export default App
