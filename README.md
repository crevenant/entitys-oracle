# The Entity’s Oracle

A responsive Dead by Daylight fan randomizer for desktop and phone browsers. Antique tarot cards shuffle in 3D, revealing one character and four distinct, role-appropriate perks, always presented in purple at tier III.

## Develop

Requires a recent Node.js release supported by Vite (22.12+; this workspace was verified with Node 26.1). No API key, server account, database, or live game connection is needed.

```powershell
npm.cmd ci
npm.cmd run dev
```

Open http://localhost:5173. On Windows, using npm.cmd avoids PowerShell script-policy restrictions. VS Code includes recommended extensions, development/build/test tasks, and a browser debugging configuration.

For a phone on the same trusted Wi-Fi, run `npm.cmd run dev -- --host 0.0.0.0` and use the network address printed by Vite. Windows may require allowing the development server through its firewall. Ordinary LAN HTTP supports the randomizer; installation and offline features require HTTPS or localhost.

## Included

- React + TypeScript + Vite, Three.js / React Three Fiber / Drei, GSAP, Lucide icons.
- Original generated tarot back, gold engraved styling, moving fog, floating particles, and a cinematic tarot ritual. The waiting deck slowly tilts and floats on its own, smoothly follows the mouse while it is over the cards, then resumes its sway on leave. Touch taps do not take over the idle motion. The ritual settles the deck to neutral, and Reduced effects keeps it still.
- An original fog-filled forest clearing with a distant dying campfire, a hanging hook, layered foreground branches, drifting ash, and an animated ground mist. Survivor moonlight and killer crimson lighting share the same scene; perk colors stay purple.
- Distressed tarot backs retain the original eye, moth, and thorn engravings with tarnished brass, scorched edges, and hairline violet cracks. Revealed portraits emerge through an ink-like wipe and a passing shadow.
- The Entity is formed from asymmetric, branching 3D roots with tapered bark surfaces, knots, fine fibers, and independently curling rootlets. The roots reach toward the chosen card, hold its edges, and withdraw during the flip. Locked characters are bound with spectral chains.
- Reduced effects keeps the environment still, removes moving mist and ash, and hides the animated Entity roots. Without WebGL, the forest and flat-card ritual remain available.
- Cards gather, cut and shuffle, circle the ritual, then fan out. The chosen card lifts clear of the page, turns in one continuous motion, then plants down with a contact shadow, a short compression and settle, and a subtle dust ripple before its four purple perks awaken individually.
- A roughly 6.1-second shared timeline coordinates movement, Entity vines, runes, purple ripples, and optional sound. Skip the ritual at any time to reveal the same draw immediately.
- Survivor and killer decks, searchable character and perk pools, and four distinct random perks from the selected role. Each role’s pool is saved separately on the current device.
- Lock the drawn character or individual perk slots, then Reroll unlocked to keep those entries in place. Gold lock marks identify held entries while every perk remains purple tier III.
- Removing a locked entry from its pool unlocks it. Locking an excluded entry from a past hand includes it again. Fewer than four eligible perks or no eligible characters blocks the draw with a link to fix the pool.
- Locks apply to the current hand and reset when changing role, revisiting history, or reloading. Pool selections persist. Unlocked entries remain random and may repeat; locking all five entries pauses rerolls until a lock is released.
- Purple tier III styling on every perk, with selectable perk descriptions.
- Sample-based horror sound: noise-reduced card shuffles and wooden cracks, filtered heartbeats, the Entity’s distant breathing, a brief hush, and heavy resonant reveal / perk impacts. Lossless WAV delivery, damped stereo room reflections, warmer EQ, and quiet low resonances add body without a noise-based reverb wash. Killer draws use a deeper pitch. Optional ritual effects have their own saved volume. Skipping stops the effects, including release tails.
- A full five-minute dark background theme, Post Apocalyptic Wastelands by Juhani Junkala, preloads and autoplays on page load, then loops between draws. Browsers that block audible autoplay show a Start background theme button; the first tap or key press also starts it. Saved music-off and master-mute preferences are respected. The theme lowers its level during audible ritual effects, retains its position across draws, and pauses while the app is hidden. Music has an independent saved switch and volume, including in Reduced effects mode. The header speaker mutes both music and effects.
- Optional haptic pulses on devices that support browser vibration; availability varies by browser and hardware.
- Saved character exclusions, settings, and the last 20 draws on the current device.
- Motion settings offer Follow device (the default), Full ritual, and Reduced effects. Follow device honors the device’s reduced-motion preference. Full ritual explicitly enables the animation in this app, even on a reduced-motion device; Reduced effects always reveals instantly. The active mode is shown below the draw controls and saved on the current device.
- Reduced effects stops continuous 3D rendering and hides moving effects. An inline Enable full ritual control makes it possible to opt in without changing any device settings.
- An animated flat-card fallback carries the ritual when WebGL is unavailable.
- Self-hosted fonts, portraits, and icons; no external runtime requests.
- Production web manifest, app icons, and versioned offline cache.
- Git initialized on main. No remote or commit is created automatically.

## Build, preview, and test

```powershell
npm.cmd run build
npm.cmd run preview
npm.cmd run lint
npx.cmd playwright install chromium
npm.cmd test
npm.cmd run sound:preview
```

The build creates `dist/`, ready for a static HTTPS host at the domain root. The preview is normally at http://localhost:4173. Offline support is enabled in production builds only; leave the first online load open until the service worker finishes caching all assets (about 18 MB, including audio). Subsequent reloads, random draws, and background music work offline. Updated builds become active after existing tabs close.

Automated checks cover desktop and phone-sized Chromium layouts, all ritual phases in order, individual perk reveals, skipping during the flip, repeat draws without stale results, reduced motion enabled mid-draw, the no-WebGL fallback, audio cleanup on mute and skip, mutable release tails, saved sound volume, perk inspection, history persistence, character exclusions, empty-deck recovery, role and tier rules, unique perks, local artwork integrity, and production offline use. Screenshots of the idle, orbit, and revealed states are written to `output/screenshots/`. Phone-sized browser checks are not a substitute for testing on physical iPhones and Android devices.

The sound preview command renders the actual sample-based sound engine in Chromium’s OfflineAudioContext, checks both role mixes for invalid samples, clipping, the pre-reveal hush, and a silent final tail, then checks music and effects together at maximum volume through their shared output limiter. It writes stereo WAV previews to `output/audio/`, uses shared ritual timing, and requires the Playwright Chromium installation above. Browser checks also cover independent audio preferences, actual gain changes during ducking, music continuity after skipping, hidden-page pause/resume, and looping from the cached track while offline.

## Catalog and artwork

This is a local community-data snapshot with 89 characters and 305 perks that have matching artwork, not a promise of the complete live-game roster. It does not read a player’s owned DLC or unlocked perks. All perks for the chosen role start eligible; use Collection → Perks to select the ones you want in your pool.

`npm.cmd run catalog:refresh` downloads a new metadata/image intersection and optimizes assets. Review refreshed data before shipping, as the community sources and game descriptions can change. Regeneration requires network access; running the app does not.

See [ASSETS.md](ASSETS.md) for provenance and [design/tarot-back-prompt.txt](design/tarot-back-prompt.txt) for the original card-art prompt.

## Structure

- `src/App.tsx`: ritual interface, dialogs, preferences, and draw flow.
- `src/components/CardScene.tsx`: 3D cards, floating particles, GSAP choreography, and fallback.
- `src/components/RevealedCard.tsx`: two-sided card flip and sequential perk seals.
- `src/components/CollectionPanel.tsx`: searchable, keyboard-accessible character and perk pools.
- `src/components/LoadoutControls.tsx` and `src/Loadout.css`: character / perk locks and reroll controls.
- `src/components/RitualEffects.tsx` and `src/Ritual.css`: ritual rings, runes, and reveal effects.
- `src/components/ForestBackdrop.tsx`, `src/components/SpectralBinding.tsx`, and `src/Horror.css`: the forest environment, spectral chains, role lighting, and distressed surfaces.
- `src/components/EntityGrasp.tsx` and `src/lib/entityRig.ts`: procedural, textured 3D roots with a shared ritual pose and independent movement. The Entity uses the existing card canvas and limits root deformation updates to 30 per second on phone-sized canvases.
- `src/lib/ritual.ts` and `src/lib/useRitual.ts`: shared phase timing, cancellation, skipping, and history completion.
- `src/lib/sound.ts`, `src/lib/useBackgroundTheme.ts`, `src/components/SoundControls.tsx`, and `src/Sound.css`: sample-based stereo effects, looping background music, volume / ducking, a shared output limiter, and per-draw cleanup.
- `public/assets/audio/CREDITS.txt` and `design/audio-sources.json`: audio credits, CC0 source URLs, hashes, and exact editing recipes. `scripts/prepare-audio.mjs` regenerates assets with FFmpeg and 7-Zip (set `FFMPEG` and `SEVEN_ZIP` to executable paths when absent from PATH); these tools are not required to run or build the app.
- `src/lib/oracle.ts`: unbiased random selection and local storage helpers.
- `src/catalog.json`: bundled character and perk snapshot.
- `public/assets/`: local optimized artwork.
- `scripts/import-catalog.mjs`: catalog refresh and artwork import.
- `scripts/build-pwa.mjs`: app icons and production offline cache.
- `tests/`: browser workflows and catalog / randomization checks.

## Distribution

The current deliverable is the web/PWA application. Native Android/iOS packages (Capacitor) and a Windows installer (Tauri) are future packaging steps. iOS packaging requires macOS/Xcode or an appropriate build service.

Unofficial fan project. Dead by Daylight names and game artwork belong to Behaviour Interactive and their respective owners.
