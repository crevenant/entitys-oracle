# Survivor portrait loops

The 46 survivors beyond Sable Ward each have an eight-pose sheet generated with ChatGPT's built-in image tool, referenced from their existing local game portrait. Each survivor's folder preserves the unmodified generated sheet, exact generation prompt, and loop recipe. Sable's earlier source and recipe remain in `design/portrait-sable/`.

`manifest.json` maps the catalog IDs, references, sheets, review state, and rendered assets. `eye-regions.json` records reviewed eye regions in the normalized 512×512 neutral pose. An empty eye list preserves opaque sunglasses without a visible blink.

These are frame-based fan-art animations assembled locally with FFmpeg optical-flow interpolation. They are not official game animations or dedicated video-model output. Small pose or texture differences from generated artwork can remain.

## Motion

Each silent eight-second loop holds the opening pose, glances left, returns to neutral, blinks quickly, glances right, and returns to the exact opening frame. Only a feathered eye patch changes during the blink; the head, mouth, and hands remain fixed through the closure. Most use a two-frame closure to avoid asymmetric generated winks. Sable retains her previously refined four-frame blink. Jake's revised sheet has gentler glances and a reviewed five-frame blink (half shut, shut for three frames, half open); `blink-overrides.json` records that timing and source pose. His versioned media URLs replace cached playback of the first draft.

## Rebuild

```powershell
node scripts/build-survivor-portraits.mjs --ffmpeg=C:/path/to/ffmpeg.exe
```

Use `--only=dwightfairfield,megthomas` to select characters and `--force` to rebuild existing clips after changing a source, eye region, or timing. `--prepare` extracts review images without encoding or registering clips. The script writes intermediate images under ignored `output/portraits/`, keeps interpolation buffers in memory, and saves MP4s/posters to `public/assets/portrait-clips/`. Only reviewed, completed clips enter `src/lib/survivorPortraitClips.json`.

The existing portrait player handles the card and enlarged view, muted inline playback, hidden-tab pausing, Reduced effects, and error fallback. Killer portraits retain their original stills. The offline build includes the finished local videos and posters.
