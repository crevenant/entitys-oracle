import { Music2, Volume2 } from 'lucide-react'
import type { ThemeState } from '../lib/useBackgroundTheme'

type Props = {
  enabled: boolean; volume: number; onEnabled: (value: boolean) => void; onVolume: (value: number) => void
  music: boolean; musicVolume: number; onMusic: (value: boolean) => void; onMusicVolume: (value: number) => void
  muted: boolean; onUnmute: () => void; themeState: ThemeState
}

export default function SoundControls({ enabled, volume, onEnabled, onVolume, music, musicVolume, onMusic, onMusicVolume, muted, onUnmute, themeState }: Props) {
  return <div className="sound-controls">
    {muted && <div className="audio-muted-notice"><span>All audio is muted.</span><button className="text-button" onClick={onUnmute}>Unmute audio</button></div>}
    <label className="setting"><span><strong><Music2 size={18} /> Background theme</strong><small>A slow, unsettling atmosphere of distant movement and gathering dread.</small></span><input type="checkbox" checked={music} onChange={(event) => onMusic(event.target.checked)} /></label>
    <div className="theme-track"><span className={themeState === 'playing' ? 'theme-playing' : ''}>{muted ? 'Muted' : !music ? 'Off' : themeState === 'playing' ? 'Playing' : themeState === 'loading' ? 'Loading the theme…' : themeState === 'error' ? 'Unable to play · toggle to retry' : themeState === 'paused' ? 'Paused' : 'Tap anywhere to begin'}</span><small>Post Apocalyptic Wastelands · Juhani Junkala</small></div>
    <label className={`sound-volume ${music ? '' : 'sound-muted'}`}><span>Music level <output>{Math.round(musicVolume * 100)}%</output></span><input aria-label="Music volume" type="range" min="0" max="100" step="5" value={Math.round(musicVolume * 100)} disabled={!music} onChange={(event) => onMusicVolume(Number(event.target.value) / 100)} /></label>
    <label className="setting"><span><strong><Volume2 size={18} /> Ritual sound</strong><small>Shuffling cards, splintering roots, a closing heartbeat, and the Entity’s breath.</small></span><input type="checkbox" checked={enabled} onChange={(event) => onEnabled(event.target.checked)} /></label>
    <label className={`sound-volume ${enabled ? '' : 'sound-muted'}`}><span>Sound level <output>{Math.round(volume * 100)}%</output></span><input aria-label="Ritual volume" type="range" min="0" max="100" step="5" value={Math.round(volume * 100)} disabled={!enabled} onChange={(event) => onVolume(Number(event.target.value) / 100)} /></label>
  </div>
}
