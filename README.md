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
- Original generated tarot back, gold engraved styling, moving fog, floating particles, pointer tilt, and animated shuffle / reveal.
- Survivor and killer decks, searchable character exclusions, and four distinct random perks from the selected role.
- Purple tier III styling on every perk, with selectable perk descriptions.
- Optional synthesized ritual sound; no sound plays until enabled.
- Saved character exclusions, settings, and the last 20 draws on the current device.
- Reduced-motion support and a flat-card fallback when WebGL is unavailable.
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

Automated checks cover desktop and phone-sized Chromium layouts, draw/reveal interactions, perk inspection, history persistence, character exclusions, empty-deck recovery, role and tier rules, unique perks, local artwork integrity, and production offline use. Screenshots are written to `output/screenshots/`. Phone-sized browser checks are not a substitute for testing on physical iPhones and Android devices.

## Catalog and artwork

This is a local community-data snapshot with 89 characters and 305 perks that have matching artwork, not a promise of the complete live-game roster. It does not read a player’s owned DLC or unlocked perks. All perks for the chosen role are eligible.

`npm.cmd run catalog:refresh` downloads a new metadata/image intersection and optimizes assets. Review refreshed data before shipping, as the community sources and game descriptions can change. Regeneration requires network access; running the app does not.

See [ASSETS.md](ASSETS.md) for provenance and [design/tarot-back-prompt.txt](design/tarot-back-prompt.txt) for the original card-art prompt.

## Structure

- `src/App.tsx`: ritual interface, dialogs, preferences, and draw flow.
- `src/components/CardScene.tsx`: 3D cards, floating particles, GSAP choreography, and fallback.
- `src/lib/oracle.ts`: unbiased random selection and local storage helpers.
- `src/catalog.json`: bundled character and perk snapshot.
- `public/assets/`: local optimized artwork.
- `scripts/import-catalog.mjs`: catalog refresh and artwork import.
- `scripts/build-pwa.mjs`: app icons and production offline cache.
- `tests/`: browser workflows and catalog / randomization checks.

## Distribution

The current deliverable is the web/PWA application. Native Android/iOS packages (Capacitor) and a Windows installer (Tauri) are future packaging steps. iOS packaging requires macOS/Xcode or an appropriate build service.

Unofficial fan project. Dead by Daylight names and game artwork belong to Behaviour Interactive and their respective owners.
