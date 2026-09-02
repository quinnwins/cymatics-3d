# Anamnesis — When the Song Remembers Itself

SoundForm already gives the recent past a location: **Sonic Memory** places the present at the center and the preceding seconds farther outward.

**Anamnesis** adds a second scale of memory. It listens to the whole performance, preserves a sparse trajectory of musical states, and connects non-adjacent passages when a phrase-level pattern returns.

The result is not a waveform, spectrogram, or automated section label. It is a spatial memory of kinship:

- chronology becomes a continuous orbiting life-line;
- structural changes push visible thresholds into that line;
- repeated passages join through luminous echo threads;
- a chorus returning in another key can reconnect with its earlier form;
- the newest short-term sound still lives at the center;
- the whole performance grows around it as an outer constellation.

> Sonic Memory asks where the recent past is. Anamnesis asks when the music has been here before.

## Why it exists

Many visualizers are spectacular but forgetful. They map the current frequency frame to color, size, or deformation and replace it on the next frame. Sonic Memory solved the first half of that problem by making a rolling history spatial.

But music is not only succession. It also contains return: a refrain, a rhythmic cell, a harmonic color, a texture that disappears and comes back altered. Those recurrences are a major source of musical identity. Anamnesis makes them physically legible.

The system deliberately avoids pretending to identify a definitive “verse” or “chorus.” It detects measurable similarity between multi-frame musical trajectories and lets the viewer interpret what the return means.

## Analysis model

### Long-horizon sampling

Anamnesis samples the live analysis stream every **400 ms**. The default capacity is 1,152 moments—about 7.7 minutes before compaction at the native cadence.

Long performances are thinned rather than truncated. The beginning remains present, preserving the arc of the performance instead of maintaining only a sliding tail.

### Independent clocks

The analysis clock is intentionally independent from the WebGL render loop. A lightweight 100 ms scheduler offers observations to the model, while the model admits at most one moment per 400 ms. That separation matters on dense scenes and software-rendered or mobile GPUs: musical time continues at the source cadence even when visual frames arrive slowly.

Rendering may become less fluid under load, but the remembered structure of the performance does not stretch or lose sections merely because the GPU is busy.

### Feature representation

Each moment contains derived, non-audio features:

- 12-bin pitch-class chroma from the full FFT;
- six-band timbral envelope;
- logarithmic spectral centroid;
- absolute-plus-relative energy;
- detected pitch class;
- transient strength;
- local structural novelty.

No waveform, microphone recording, or copyrighted audio is stored in a relic.

### Phrase-level recurrence

Single-chord matching creates false meaning: two unrelated passages can share one chord. Anamnesis therefore compares short sequences, not isolated frames.

The default phrase window is eight observations, or approximately **3.2 seconds**. Candidate returns must be separated by at least ten seconds. Similarity combines:

| Signal | Weight |
| --- | ---: |
| Harmonic trajectory | 43% |
| Timbral trajectory | 23% |
| Spectral-centroid trajectory | 11% |
| Energy trajectory | 10% |
| Local novelty trajectory | 6% |
| Motion agreement | 7% |

A return is accepted only when the combined score, harmonic agreement, and timbral agreement all clear independent thresholds. This is intentionally conservative: a few meaningful threads are better than a glowing hairball of coincidences.

### Transposition tolerance

Pitch-class chroma is compared under all twelve circular rotations. This allows a phrase that returns in another key to remain related while preserving the signed transposition interval as part of the echo thread.

That invariance applies only to harmony. Timbral, energetic, centroid, novelty, and motion trajectories still need to agree, preventing every transposed chord from being treated as the same musical passage.

### Structural novelty

Each new moment is compared with a short local context. Abrupt changes in harmony, spectral envelope, centroid, or transient energy produce a higher novelty score. In the visual field, novelty lifts and brightens thresholds along the chronology.

## Spatial grammar

The visual system has two concentric timescales:

1. **The living center — Sonic Memory**  
   The newest seconds of audio. Present at the core, recent past at the edge.

2. **The remembered life-line — Anamnesis**  
   The full performance. Time winds around the center as an evolving 3D trajectory.

The chronology is shaped by the music rather than drawn as a neutral circle:

- progress advances the orbit;
- pitch class changes angular phase;
- spectral centroid changes height;
- low-versus-high timbral balance alters lateral drift;
- novelty pushes the line outward;
- energy changes point scale and luminance;
- repeated phrase families share color and breathe together;
- echo threads span the interior between non-adjacent related moments.

When a return is detected, all moments in that family briefly brighten and move toward one another. The song appears to recognize itself.

## Experience

Open **Sonic Memory**, then choose **THE SONG REMEMBERS** or press `A`.

The focused view removes the workstation chrome and preserves only the musical object and a minimal Anamnesis HUD.

- **Pause / Resume** controls the source without leaving the field.
- **Keep This Relic** stores the derived constellation locally.
- **Capture** exports the visible canvas as an image.
- **Relics** reopens earlier locally stored constellations.
- Hover a moment to see its time and role.
- Click a moment to seek there when the audio source is seekable.
- `Escape` returns to the workstation.

A new recurrence also appears briefly in the normal music view as a quiet sentence:

> IT HAS BEEN HERE BEFORE · 0:42 ↔ 1:26

That moment is the emotional center of the feature.

## Relics and privacy

A relic contains:

- title and source metadata;
- derived point positions and visual attributes;
- echo-thread relationships;
- summary statistics.

It does **not** contain FFT frames, waveforms, microphone recordings, or playable audio. Relics live in local browser storage unless the viewer explicitly captures an image.

## Scientific boundary

Anamnesis is an audiovisual interpretation built from established music-information-retrieval ideas: chroma, self-similarity, novelty, and multi-feature recurrence. It does not claim to recover a composer’s intention, prove formal section labels, or reveal one objectively correct physical shape for a song.

The geometry is authored. The relationships are measured.

## Design test

The implementation is successful only when all of these are true:

1. Silence remains empty.
2. The chronology is visibly larger than the emitter.
3. Time reads as direction, not random dust.
4. An isolated matching chord does not create a return.
5. A repeated multi-second phrase does.
6. A transposed return remains connected but visibly distinct.
7. The focused experience feels like entering the memory of the song, not opening another settings panel.
