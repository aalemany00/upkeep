# Upkeep · Original coach frame animation assets

These character sprites are assembled **directly from the user's uploaded frame PNGs**. No AI redraws, rectangle-built SVG characters, or CSS body-part transformations.

Each `*-atlas.png` is an unscaled, transparent **4 columns × 4 rows** contact atlas containing the exact 16 PNG frames supplied for that coach. A frame has the original source dimensions (Atlas/Rex/Luna: 314×314; Pixel/Mira/Scout/Blaze: 305×323). Indexing is row-major from **00 to 15**:

```
00 01 02 03
04 05 06 07
08 09 10 11
12 13 14 15
```

The frame index, frame sequences, and coach dimensions live in `pixel-coach-sprites.js`. Both the dashboard actor and Coach-tab figure use the same renderer. `pixel-room-scenes.js` drives walking, coach-specific activity, stretching, conversation and celebration. Clicking the dashboard coach interrupts movement and runs the speaking frames; motion resumes afterward. Leftward movement mirrors only the facing wrapper.

## Coach mapping
| ID | Coach | Character | Distinctive actions |
| --- | --- | --- | --- |
| `atlas` | Atlas | Green gym trainer | Walk, bodyweight squat, stretch, talk |
| `pixel` | Pixel | White-blue robot | Walk, scanning/hologram, point, celebrate |
| `mira` | Mira | Lavender mindset coach | Walk, tablet use, teach, stretch |
| `rex` | Rex | Golden dog in orange hoodie | Walk, play bow, wag, cheer |
| `luna` | Luna | Dark-haired teal recovery coach | Walk, sitting, mobility stretches, breathing |
| `outdoor-coach` | Scout | Green outdoor coach | Walk, explore, map, rest |
| `red-hoodie-coach` | Blaze | Red hoodie progress coach | Walk, tablet, energy, rest |

**Naming:** The user approved **Scout** for the outdoor coach and **Blaze** for the red-hoodie coach. Their stable IDs (`outdoor-coach`, `red-hoodie-coach`) and asset basenames remain unchanged for compatibility with saved selections, existing code, and cached assets. The source bundle now includes `Scout.zip` and `Blaze.zip`.

The `*-portrait.png` assets are transparent, original-art head-and-shoulder crops shown in navigation, Settings and the Coach tab. Portraits do not show the adjacent character or frame.

## Quality and loading

- The original cutouts were not resized during atlas creation.
- The 16 frame rectangles were verified byte-for-byte at RGBA pixel level against the original PNG cutouts.
- CSS uses `background-size:400% 400%` and changing `background-position` to display a frame; **never** animate the character using `transform:scaleY` or `translateY` to simulate a squat.
- Big atlases are cached on demand by the app's service worker. Portraits are in the small precached shell.
- Keep the desktop and phone aspect ratios from `dimensions`. Do not hardcode square frames for the 305×323 coaches.
- Animations are built from 16 **poses** per coach, not 16 independent frames for every conceivable action. Some sequences reuse frames and are intentionally stylized rather than fluid 12-fps motion capture.
- Respect `prefers-reduced-motion`: the app should show the idle frame with no autonomous movement when enabled.

The seven named source archives, including `Scout.zip` and `Blaze.zip`, are bundled separately in the downloadable `Upkeep_All_Coach_Frames_Scout_Blaze.zip` artifact from ChatGPT.
