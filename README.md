# SoundForm 3D
### Real-Time 3D Computational Acoustics, Volumetric Wave Mechanics & Live Vocal DSP Engine

[![Validate SoundForm](https://github.com/quinnwins/cymatics-3d/actions/workflows/validate.yml/badge.svg)](https://github.com/quinnwins/cymatics-3d/actions/workflows/validate.yml)
[![WebGL2 Shaders](https://img.shields.io/badge/WebGL2-GPU_Visuals-purple.svg)](./src/visualizer/)
[![Web Audio DSP](https://img.shields.io/badge/Web_Audio-YIN_%26_LPC--16-cyan.svg)](./src/math/)
[![TypeScript Build](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](./src/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Technical Whitepaper](https://img.shields.io/badge/Whitepaper-Mathematical_Derivations-gold.svg)](./TECHNICAL_WHITEPAPER.md)

---

## Overview

**SoundForm 3D** is a browser-based, GPU-accelerated computational physics, bio-acoustics, and digital signal processing playground. Built in TypeScript, WebGL2/GLSL, and Web Audio API, it brings together live music visualization, volumetric standing waves, dense acoustic particle fields, deformable droplets, vocal DSP, and speculative sound-powered moonshot labs.

The project is intentionally allowed to be both technical and imaginative: some modes visualize measured audio, some explore mathematical models, and some ask unapologetic “what if?” questions.

## Signature Experience: Sonic Memory

SoundForm no longer reacts only to the current FFT frame. **Sonic Memory** turns recent music into a living three-dimensional temporal sculpture:

- the central emitter is the sound happening **now**;
- increasing radius samples progressively older spectral frames;
- drum hits and transients become outward-moving shells;
- harmony leaves persistent volumetric architecture behind it;
- a frozen sculpture can still be rotated, recolored, and explored;
- the **Time Lens** moves the entire form backward through stored sound;
- air, water, tissue, acrylic, glass, and steel alter the visual propagation model;
- immersive mode and one-click capture turn the engine into a performance instrument.

See [`docs/SONIC_MEMORY.md`](./docs/SONIC_MEMORY.md) for the signal model and controls.

```
                            ┌────────────────────────────────────────────────────────┐
                            │                      SoundForm 3D                      │
                            │       Real-Time 3D Acoustic & Vocal Physics Engine     │
                            └──────────────────────────┬─────────────────────────────┘
                                                       │
         ┌───────────────────┬─────────────────────────┼─────────────────────────┬───────────────────┐
         ▼                   ▼                         ▼                         ▼                   ▼
    Music Space         3D Cymatics               Cancer Lab                 Nobel Lab          Voice Studio
  ──────────────      ────────────────          ──────────────             ─────────────       ──────────────
  • Sonic Memory      • Helmholtz 3D Waves      • Oncotripsy Resonance     • Mechanogenomics   • YIN Pitch f0
  • Shockwaves        • Taubin Raymarching      • Histotripsy Shockwaves   • BBB Opening       • LPC-16 DSP
  • Time Lens         • 262k Particle Fields    • SDT Cavitation & ROS     • Viral Shatter     • 3D Vocal Tract
  • Particle Nebula   • Phase Cancellation      • Acousto-Immunotherapy    • Senolytic Lysis   • MDVP Biomarkers
```

---

## Studio Experiences

### 1. Music Space (3D Psychoacoustic Visualizer)
* **Sonic Memory:** A 512 × 512 spectral ring buffer maps time onto radius so the present begins at the center and recent music remains visible outward.
* **Mathematical Core:** 4096-point FFT energy decomposition across six psychoacoustic perceptual bands (Sub-bass $\to$ High), plus pitch and transient analysis.
* **Ballistics Engine:** Continuous exponential attack/release filters ($\tau_{\text{attack}} = 18\text{ ms}, \tau_{\text{release}} = 220\text{ ms}$) with rolling dynamic-threshold transient flux detection.
* **Camera Dynamics:** 6-DOF critically damped harmonic return springs ($\zeta = 1.0, \omega = 14\text{ rad/s}$) responding to audio shockwaves.

### 2. 3D Cymatics Lab (Volumetric Standing Waves & Levitation)
* **Mathematical Core:** First-order Taubin distance approximation $d(\mathbf{x}) = \frac{|\psi(\mathbf{x})|}{\|\nabla \psi(\mathbf{x})\| + \epsilon}$ exploring 3D Helmholtz standing-wave nodal fields in rectangular, cylindrical, and spherical geometries.
* **Dense Particle Fields:** Up to **262,144 concurrent GPU-rendered particles** projected and animated around nodal or antinodal structures.
* **Optics:** 3-channel spectral Beer-Lambert-inspired absorption with Henyey-Greenstein-style scattering and thin-film chromatic dispersion.

### 3. Bio-Acoustic Oncology & Cancer Lab
* **Oncotripsy Resonance:** Ortiz-Mittelstein-inspired finite-strain dynamic hyperelasticity exploring differential resonant responses between modeled cell profiles.
* **Speculative Phenotype Library:** Five tumor-cell-line-inspired profiles plus a healthy comparison profile for moonshot experimentation.
* **Non-Thermal Histotripsy:** Keller-Miksis-inspired cavitation, water-hammer microjet shockwaves, and low-duty-cycle thermal modeling.
* **Sonodynamic Therapy (SDT):** Cavitation and reactive-oxygen visualizations around modeled sensitizer behavior.
* **Acousto-Immunotherapy:** Acoustic steering concepts for CD8+ T-cell swarms interacting with dense tumor spheroids.

### 4. Nobel Discovery Lab
* **Acoustic Mechanogenomics:** LINC-complex tension, nuclear-pore dilation, chromatin motion, and transcription-inspired visual systems.
* **FUS Blood-Brain Barrier Dilation:** Microbubble cavitation and paracellular-pore exploration for imagined nanomedicine delivery.
* **Viral Capsid Resonance:** Elastic-shell eigenmode and cyclic-fatigue concepts applied to viral capsid structures.
* **Targeted Senolytic Clearance:** Stiffness-phenotype and apoptosis-inspired speculative simulations.

### 5. Vocal Holography & Live DSP
* **Sub-Sample YIN Pitch:** An implementation of De Cheveigné & Kawahara-style pitch extraction from live microphone audio.
* **Voice Metrics:** Jitter, shimmer, HNR, CPP, and related exploratory perturbation metrics.
* **LPC-16 Levinson-Durbin:** Linear Predictive Coding and Kelly-Lochbaum tube-area reconstruction driving a deformable 3D vocal-tract mesh.

---

## Architectural Trade-offs

| Engineering Choice | Alternative Rejected | Rationale & Trade-off |
| :--- | :--- | :--- |
| **Volumetric Taubin Raymarching** | Marching Cubes CPU Mesh Extraction | Evaluates implicit nodal fields directly in the fragment shader rather than continually transferring polygonized meshes from CPU to GPU. |
| **Deterministic GPU Particle Projection** | CPU particle buffer updates | Keeps dense node/antinode structures responsive while avoiding continual `gl.bufferSubData` traffic and garbage collection. |
| **Byte-Packed Temporal History** | 32-bit float history texture | Preserves a 512 × 512 full-spectrum history while reducing texture upload bandwidth by 75% and improving filter compatibility. |
| **Native Web Audio Nodes** | Pure AudioWorklet for all synthesis | Uses browser-native node graphs for simple, low-latency synthesis and analysis while reserving custom DSP for the algorithms that need it. |

---

## Run Locally

```bash
npm ci
npm run dev
```

## Automated Verification & Testing

Run the full automated test suite:

```bash
npm test
```

Strict TypeScript and production build:

```bash
npm run build
```

---

## License

This project is licensed under the MIT License — see the [LICENSE](./LICENSE) file for details.

---
*SoundForm 3D — see sound as matter, space, and memory.*
