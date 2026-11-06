# Sable Ward animated portrait prototype

Status: integrated for Sable Ward (character ID `40`) in the normal card and enlarged view. Other characters retain their original stills.

## Creation and source

This is a frame-based prototype made with ChatGPT-generated key poses and local motion interpolation. It does not use Runway or a dedicated video generation model, and makes no external runtime requests.

- Original reference: `public/assets/characters/survivor-sableward.webp`.
- Exact image-generation prompt: `design/portrait-sable/keyframe-prompt.txt`.
- Unmodified generated eight-pose sheet: `design/portrait-sable/keyframes-v1.png` (1774×887, four columns and two rows).
- Revised half-closed and closed eyelids: `design/portrait-sable/blink-poses-v2.png`, with its exact edit prompt in `design/portrait-sable/blink-prompt.txt`.
- Exact timings and encoding notes: `design/portrait-sable/loop-recipe.json`.
- Final clip: `public/assets/portrait-clips/sable-ward-loop.mp4` (512×512, 24 fps, eight seconds, H.264, silent).
- Loading poster: `public/assets/portrait-clips/sable-ward-poster.webp` (first generated neutral pose).

The generated artwork preserves Sable's silver hair, outfit, hands, and held object, with small pose-to-pose differences. The generated neutral is framed more closely than the original game cutout. Reduced effects and playback errors retain the original game artwork.

## Motion and loop

Hold the opening neutral pose, glance left, make a small head turn, return toward neutral, blink briefly at about 3.5 seconds, glance toward the viewer, and settle back by 6.9 seconds. Hold neutral through the end. The first and last authored frames are identical; the script checks this before encoding. This is an authored return sequence, not reversed playback.

Head transitions use FFmpeg bidirectional optical-flow interpolation with smoothstep timing. The blink uses four eye-only frames over an unchanged head pose (half shut, shut, shut, half open), lasting one sixth of a second. Feathered masks preserve the rest of the face, hair, and hands. This replaces the original whole-face interpolated blink, which visibly distorted her expression. The small changes are easiest to see in the enlarged card; head interpolation can still show slight morphing compared with a rigged character or dedicated video model.

## Rebuild

Install FFmpeg separately, then run:

```powershell
node scripts/build-portrait-loop.mjs --ffmpeg=C:/path/to/ffmpeg.exe
```

Alternatively set `PORTRAIT_FFMPEG` or make `ffmpeg` available on PATH. The script uses the saved sheet and Sharp, writes intermediates under ignored `output/portrait-sable/`, and rebuilds the MP4, poster, and recipe. It does not call any generation service.

When only the eye patches or timing change, `--reuse-transitions` can reuse the existing intermediate head frames. Omit it whenever the original keyframe sheet or interpolation settings change.

## Playback

The registry in `src/lib/portraitClips.ts` enables only Sable. Playback is muted, inline, and looping; only the visible card plays. Its playhead transfers between the main card and close-up and pauses when the tab is hidden. Reduced effects and load failures use the original still. The normal offline build includes both local assets.
