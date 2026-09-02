# Sonic Memory

Sonic Memory turns a song into a living three-dimensional record of its recent past.

Most music visualizers deform one object from the latest FFT frame. SoundForm now keeps a spectral history and maps **time onto distance from the emitter**:

- the center is the sound happening now;
- increasing radius contains progressively older spectral frames;
- transients become bright traveling shells;
- sustained harmony becomes persistent volumetric architecture;
- pausing the history freezes a rotatable sound sculpture.

## Signal representation

`HistoryTexture` stores 512 spectral bins across 512 history frames. Each texel contains:

| Channel | Meaning |
| --- | --- |
| R | normalized spectral magnitude |
| G | signed spectral motion between adjacent frames |
| B | transient / bass impulse |
| A | normalized detected pitch |

History capture is rate-limited independently from display refresh, and the temporal controller measures the effective write rate so the radial memory span remains stable across displays.

## Spatial mapping

For every point in the Sonic Memory volume, the shader calculates an age from normalized radius and samples the corresponding historical row:

```text
ageFrames = radius × memorySeconds × captureRate × mediumInfluence ÷ propagation
historyRow = latestRow - ageFrames
```

Angular position selects spectral content, with a deliberate low-frequency bias so bass and lower harmonics carry the large structure while upper frequencies form filaments and detail. Spectral motion twists the field; detected transients sharpen outward-moving shells.

The medium selector preserves the relative ordering of sound speeds while compressing the physical ratio into a useful visual range. It is a normalized audiovisual model, not a literal meter-scale propagation view.

## Controls

Open the **SONIC MEMORY** pill above the transport:

- **Memory on/off** — reveal or hide the temporal field.
- **Freeze sculpture** — stop writing new spectral frames while audio continues.
- **Immersive view** — remove the workstation chrome for a clean full-screen performance.
- **Capture frame** — save the current canvas as a PNG.
- **Memory** — set the recent time horizon.
- **Propagation** — change how quickly the present expands into the past.
- **Presence** — control visual density and displacement.
- **Spatial twist** — move from ordered shells toward helical structures.
- **Medium** — air, water, tissue, acrylic, glass, or steel.
- **Age color** — color by temporal age instead of primarily by spectrum.

Keyboard shortcuts:

- `M` toggles Sonic Memory.
- `F` freezes or resumes the sculpture.
- `I` enters or exits immersive view.

## Design intent

This layer is the bridge between SoundForm's playful and scientific sides. It does not claim that a song has one objectively correct cymatic shape. It asks a more specific question:

> What would music look like if the present originated at one point and its recent history remained visible as it propagated through space?

That idea can later feed the volumetric nodal renderer, persistent particle dynamics, frozen mesh export, and whole-song sound-fossil generation.
