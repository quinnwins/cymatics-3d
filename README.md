# SoundForm 3D
### See sound as matter, space, and memory.

[![Validate SoundForm](https://github.com/quinnwins/cymatics-3d/actions/workflows/validate.yml/badge.svg)](https://github.com/quinnwins/cymatics-3d/actions/workflows/validate.yml)
[![WebGL2](https://img.shields.io/badge/WebGL2-GPU_Visuals-purple.svg)](./src/visualizer/)
[![Web Audio](https://img.shields.io/badge/Web_Audio-Live_DSP-cyan.svg)](./src/audio/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](./src/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

SoundForm is a browser-based acoustic imagination engine built with TypeScript, WebGL2/GLSL, Three.js, and the Web Audio API.

It is deliberately allowed to be more than one thing:

- a music visualizer;
- a cymatics and standing-wave playground;
- a live vocal-DSP instrument;
- a collection of modeled bio-acoustic worlds;
- a home for serious mathematics and unapologetic “what if?” experiments.

The project does not ask every mode to carry the same scientific burden. Some views are measured, some are mathematical interpretations, and some are speculative. They share one question:

> **What becomes visible when sound is treated as a material force?**

---

## The signature experience: a song with memory

Most visualizers react to the newest audio frame and immediately forget it. SoundForm remembers on two timescales.

### Sonic Memory — the recent past has a location

Sonic Memory maps the newest seconds of a performance onto a living radial sculpture:

- the center is the sound happening **now**;
- increasing radius contains progressively older spectral moments;
- transients become outward-moving shells;
- sustained harmony leaves volumetric architecture behind it;
- pitch and spectral motion reshape the field;
- the **Time Lens** moves the visual present backward through stored sound;
- freezing preserves a rotatable sound sculpture while playback can continue.

### Anamnesis — the song recognizes itself

Sonic Memory asks where the recent past is. **Anamnesis** asks when the music has been here before.

A second, long-horizon field grows around the radial center. It preserves a sparse trajectory of the whole performance and compares multi-second harmonic, timbral, energetic, and structural motion. When a phrase returns, its new moment reconnects to its earlier form through a luminous chord.

- chronology becomes an orbiting life-line;
- structural changes become visible thresholds;
- repeated phrases become spatial reunions;
- transposed returns remain related while preserving their interval;
- related moments breathe together as one memory family;
- seekable points can be clicked to return to that instant;
- a performance can be kept locally as a derived **Memory Relic** without storing its audio.

Open Sonic Memory and choose **THE SONG REMEMBERS**, or press `A`.

See [`docs/SONIC_MEMORY.md`](./docs/SONIC_MEMORY.md) and [`docs/ANAMNESIS.md`](./docs/ANAMNESIS.md).

---

## One acoustic object, several ways of seeing it

```
                                    SOUND
                                      │
                ┌─────────────────────┼─────────────────────┐
                │                     │                     │
             MATTER                 SPACE                 MEMORY
                │                     │                     │
       plate · droplet ·       nodal fields ·       recent radial time ·
          particles            wave geometry        whole-song recurrence
                │                     │                     │
                └─────────────────────┴─────────────────────┘
                                      │
                              IMAGINED CONSEQUENCE
                                      │
                   voice · cells · microfluidics · therapy · moonshots
```

The interfaces are not separate product demos. They are different lenses on the same underlying fascination.

### Music Space

- 4096-point FFT analysis across six perceptual bands
- pitch estimation and transient detection
- Sonic Memory radial history
- Anamnesis whole-performance self-memory
- streaming previews, generated tracks, uploaded audio, and microphone input
- orbit, cinematic camera, frozen inspection, immersive capture

### Cymatics and resonators

- square, cylindrical, and spherical resonator interpretations
- 2D plate, deformable fluid droplet, volumetric nodal field, and dense GPU particles
- node and antinode trapping modes
- adjustable modal orders, wave speed, damping, optics, and palettes
- up to 262,144 rendered particles in supported modes

### Vocal Holography

- live microphone analysis
- YIN-style pitch extraction
- jitter, shimmer, HNR, CPP, and related exploratory voice metrics
- LPC-16 Levinson–Durbin analysis
- Kelly–Lochbaum-inspired tube-area reconstruction
- deformable vocal-tract and airflow views

### Bio-acoustic and moonshot worlds

- modeled cell resonance and contrast-factor experiments
- microfluidic sorting and surface-acoustic-wave concepts
- oncotripsy-, histotripsy-, sonodynamic-, and immunotherapy-inspired visual systems
- mechanogenomics, blood-brain-barrier, viral-capsid, and senolytic thought experiments

These are exploratory simulations and visual hypotheses, not clinical tools or medical claims.

---

## How Anamnesis works

Every 400 ms, the engine derives a compact musical state from the live analysis stream:

- 12-bin pitch-class chroma;
- six-band timbral shape;
- logarithmic spectral centroid;
- absolute and relative energy;
- transient strength;
- local novelty.

It compares **sequences** rather than individual chords. The default window spans roughly 3.2 seconds, and candidate returns must be separated by at least ten seconds. Circular chroma alignment makes the harmonic comparison transposition-tolerant, while timbre, energy, centroid, novelty, and motion still have to agree.

This is intentionally conservative. A few meaningful connections are more valuable than a decorative web of coincidences.

The analysis borrows established ideas from music-information retrieval—chroma, self-similarity, novelty, and multi-feature recurrence—but the resulting spatial grammar is authored for SoundForm. It does not claim to know the composer’s intent or produce canonical verse/chorus labels.

> **The geometry is authored. The relationships are measured.**

---

## Interaction

### Sonic Memory

| Key | Action |
| --- | --- |
| `M` | Toggle recent radial memory |
| `F` | Freeze or resume the temporal sculpture |
| `I` | Enter or exit Sonic Memory immersive view |
| `A` | Enter or exit Anamnesis |
| `Escape` | Return to the workstation |

### Anamnesis focused view

- **Pause / Resume** the current source
- **Keep This Relic** in local browser storage
- **Capture** the current canvas as an image
- **Relics** to revisit derived performance constellations
- Hover a memory moment for time and meaning
- Click a moment to seek there when the source is seekable

Relics contain visual points, recurrence threads, metadata, and summary statistics. They do not contain FFT frames, waveforms, microphone recordings, or playable audio.

---

## Architectural principles

| Choice | Reason |
| --- | --- |
| GPU temporal fields | Time, spectrum, and dense geometry remain interactive without rebuilding meshes every frame. |
| Byte-packed short-term history | A 512×512 full-spectrum memory uses substantially less upload bandwidth than a float history texture. |
| Sparse long-term memory | Whole performances remain explorable without storing audio or retaining every analysis frame. |
| Phrase-level recurrence | Multi-frame agreement rejects the false meaning created by single-chord matches. |
| Local derived relics | The viewer can keep a performance’s shape without copying the performance itself. |
| Deterministic geometry | The same derived memory produces the same spatial object, making QA and comparison possible. |
| Scientific boundaries in the UI and docs | Mathematical and speculative modes can coexist without presenting imagination as clinical fact. |

---

## Run locally

```bash
npm ci
npm run dev
```

Production build:

```bash
npm run build
```

Full automated suite:

```bash
npm test
```

The validation workflow also runs real Chromium/WebGL checks for Sonic Memory and Anamnesis, including recurrence, freezing, immersive focus, relic persistence, and visual occupancy outside the central emitter.

---

## Project stance

SoundForm is not trying to prove that every frequency has one universal sacred shape. Cymatic form depends on geometry, boundary conditions, medium, damping, forcing, and the material being observed.

The project is interested in something richer:

- what sound actually measures;
- what mathematics lets us model;
- what visualization lets us perceive;
- what imagination lets us ask next.

That is why a plate, a voice, a cell, a particle cloud, and the remembered life of a song can belong in the same place.

---

## License

MIT. See [`LICENSE`](./LICENSE).

---

*SoundForm 3D — the present becomes form; the past remains visible; the song learns its own shape.*
