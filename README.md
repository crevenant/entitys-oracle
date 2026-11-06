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
- Original generated tarot back, gold engraved styling, moving fog, floating particles, pointer tilt, and a cinematic tarot ritual.
- Cards gather, cut and shuffle, circle the ritual, then fan out. The chosen card rises and flips before its four purple perks awaken individually.
- A roughly 5.6-second shared timeline coordinates movement, Entity vines, runes, purple ripples, and optional sound. Skip the ritual at any time to reveal the same draw immediately.
- Survivor and killer decks, searchable character exclusions, and four distinct random perks from the selected role.
- Purple tier III styling on every perk, with selectable perk descriptions.
- Optional synthesized card whispers, a dark crescendo, and perk chimes; no sound plays until enabled. Muting or skipping stops active sound cues.
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
```

The build creates `dist/`, ready for a static HTTPS host at the domain root. The preview is normally at http://localhost:4173. Offline support is enabled in production builds only; leave the first online load open until the service worker finishes caching all assets (about 13 MB). Subsequent reloads and random draws work offline. Updated builds become active after existing tabs close.

Automated checks cover desktop and phone-sized Chromium layouts, all ritual phases in order, individual perk reveals, skipping during the flip, repeat draws without stale results, reduced motion enabled mid-draw, the no-WebGL fallback, sound cleanup when muted, perk inspection, history persistence, character exclusions, empty-deck recovery, role and tier rules, unique perks, local artwork integrity, and production offline use. Screenshots of the idle, orbit, and revealed states are written to `output/screenshots/`. Phone-sized browser checks are not a substitute for testing on physical iPhones and Android devices.

## Catalog and artwork

This is a local community-data snapshot with 89 characters and 305 perks that have matching artwork, not a promise of the complete live-game roster. It does not read a player’s owned DLC or unlocked perks. All perks for the chosen role are eligible.

`npm.cmd run catalog:refresh` downloads a new metadata/image intersection and optimizes assets. Review refreshed data before shipping, as the community sources and game descriptions can change. Regeneration requires network access; running the app does not.

See [ASSETS.md](ASSETS.md) for provenance and [design/tarot-back-prompt.txt](design/tarot-back-prompt.txt) for the original card-art prompt.

## Structure

- `src/App.tsx`: ritual interface, dialogs, preferences, and draw flow.
- `src/components/CardScene.tsx`: 3D cards, floating particles, GSAP choreography, and fallback.
- `src/components/RevealedCard.tsx`: two-sided card flip and sequential perk seals.
- `src/components/RitualEffects.tsx` and `src/Ritual.css`: procedural Entity vines, ritual rings, runes, and reveal effects.
- `src/lib/ritual.ts` and `src/lib/useRitual.ts`: shared phase timing, cancellation, skipping, and history completion.
- `src/lib/sound.ts`: optional synthesized cues with per-draw cleanup.
- `src/lib/oracle.ts`: unbiased random selection and local storage helpers.
- `src/catalog.json`: bundled character and perk snapshot.
- `public/assets/`: local optimized artwork.
- `scripts/import-catalog.mjs`: catalog refresh and artwork import.
- `scripts/build-pwa.mjs`: app icons and production offline cache.
- `tests/`: browser workflows and catalog / randomization checks.

## Distribution

The current deliverable is the web/PWA application. Native Android/iOS packages (Capacitor) and a Windows installer (Tauri) are future packaging steps. iOS packaging requires macOS/Xcode or an appropriate build service.

Unofficial fan project. Dead by Daylight names and game artwork belong to Behaviour Interactive and their respective owners.
