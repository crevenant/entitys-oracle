# Asset provenance

- Character portraits and perk icons: [Zawgalicious/DBDImages](https://github.com/Zawgalicious/DBDImages), imported as local, optimized WebP files under `public/assets/characters` and `public/assets/perks`.
- Character and perk metadata: community [DBD API](https://dbd.tricky.lol/api/characters) and [perk endpoint](https://dbd.tricky.lol/api/perks), fetched November 6, 2026. The exact import timestamp and image-tree identifier are recorded in `src/catalog.json`.
- This snapshot includes only entries with matching artwork: 89 characters and 305 perks. It is not a claim of a complete or up-to-date live roster. Perk values use the highest available tier in the source. Unresolved source placeholders are shown as an em dash.
- Game names, portraits, and icons belong to Behaviour Interactive and their respective owners. Community hosting does not transfer ownership. The application identifies itself as an unofficial fan project.
- Fonts: Manrope and Cormorant Garamond, bundled locally through their Fontsource packages under the SIL Open Font License.
- Interface icons: Lucide, distributed under the ISC license.
- Tarot card back: original art generated with the built-in image generation tool, optimized as `public/assets/tarot-back.webp`. The original is preserved in `design/tarot-back-original.png`; its generation prompt is in `design/tarot-back-prompt.txt`.

The application makes no external artwork requests at runtime. The import script is a development tool; API or repository availability does not affect an existing build.
