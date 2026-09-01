# 💎 SoundForm 3D
### Real-Time 3D Cymatics, Volumetric Standing Waves & Acoustic Particle Levitation Engine

A WebGL2 and Web Audio engine for real-time 3D cymatics, volumetric Helmholtz resonance cavities, Gor'kov radiation force particle trapping, and harmonic frequency synthesis.

---

## 🌟 Overview

**SoundForm 3D** simulates and visualizes acoustic wave phenomena in 3D spacetime. It models 2D/3D Chladni nodal geometries, spherical harmonics, Bessel function modal solutions, and Gor'kov acoustic radiation force fields where virtual particles are dynamically trapped along acoustic nodes and antinodes.

```
                           ┌────────────────────────────────────────────────────────┐
                           │                      SoundForm 3D                      │
                           │          3D Cymatics & Acoustic Wave Engine            │
                           └──────────────────────────┬─────────────────────────────┘
                                                      │
                       ┌──────────────────────────────┼──────────────────────────────┐
                       ▼                              ▼                              ▼
                 💎 3D Cymatics                 🔬 Frequency                   🎵 Music
                     Lab                            Lab                          Space
               ──────────────                 ─────────────                  ─────────────
               • 3D Helmholtz Modes           • Additive Fourier             • 6-Band Log-FFT
               • Gor'kov Potential              Series Synthesis             • Dynamic Transients
               • Resonant Cavities            • Binaural Beat                • Expanding Wavefronts
                 (Cube / Cylinder / Sphere)     Entrainment                  • Real-Time Mic &
               • 3D Acoustic Trapping         • Lissajous Phase-               Audio Input
               • Modal Sweeper (n, m, l)        Space Curves
```

---

## 🔬 Core Features & Interactive Labs

### 1. 💎 3D Cymatics Lab
- **Volumetric Standing Waves**: Solves 3D Helmholtz wave equations across cubic, cylindrical, and spherical resonant chambers.
- **Gor'kov Acoustic Radiation Force**: Computes the acoustic trapping potential:
  $$U = 2K_1\langle p^2\rangle - \frac{3}{2}K_2\rho_0\langle\|\mathbf{v}\|^2\rangle$$
  trapping GPU particles along acoustic nodal planes or antinodal pressure maxima.
- **Modal Sweeper ($n, m, l$)**: Interactive real-time sweeps across fundamental and overtone modes with analytical eigenfrequency calculation.
- **Chamber Enclosures**: Switchable glass-walled resonant boundaries (Cubic cavity, Cylindrical tube, Spherical resonator).

### 2. 🔬 Frequency Lab
- **Harmonic Fourier Series**: Additive synthesis with individual control over 8 harmonic overtones:
  $$f(t) = \sum_{k=1}^8 A_k \sin(k \omega t + \phi_k)$$
- **Binaural Beats**: Dual-channel frequency detuning to generate psychoacoustic binaural entrainment.
- **Lissajous Curves**: Multi-frequency phase-space trajectories in 3D.

### 3. 🎵 Music Space (Audio Reactive)
- **6-Band Logarithmic FFT**: Sub-bass, bass, low-mid, mid, high-mid, and high frequency separation.
- **Transient Flux Detection**: Dynamic shockwave impulse propagation.
- **Multiple Visual Styles**:
  - `💎 Cymatics`: Volumetric Chladni nodal surfaces and Gor'kov particle levitation.
  - `🌊 Waves`: Expanding concentric acoustic wavefront shells.
  - `✨ Dust`: 3D reactive acoustic particle nebula.
  - `🌀 Ribbon`: Continuous spacetime wave ribbons.
  - `🔮 Cosmos`: Hybrid multi-layer visualization.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run automated test suite
npm test

# 3. Start local development server
npm run dev

# 4. Build production bundle
npm run build
```

---

## 📐 Mathematical & Physics Foundations

- **Bessel Functions ($J_n(x)$)**: Evaluates radial vibration profiles and cylindrical cavity resonance.
- **Spherical Harmonics ($Y_l^m(\theta, \phi)$)**: Computes angular eigenfunctions for spherical acoustic chambers.
- **Chladni Plate Physics**: Models 2D square plate nodal geometries via:
  $$w(x,y) = a \sin\left(\frac{n\pi x}{L}\right)\sin\left(\frac{m\pi y}{L}\right) + b \sin\left(\frac{m\pi x}{L}\right)\sin\left(\frac{n\pi y}{L}\right)$$

---

## 🛠️ Tech Stack

- **Graphics**: [Three.js](https://threejs.org/) WebGL2 custom GLSL shaders (vertex & fragment)
- **Audio DSP**: Web Audio API (`AudioContext`, `AnalyserNode`, `GainNode`, `OscillatorNode`)
- **Language & Tooling**: TypeScript, Vite, Tailwind CSS v4, Vitest
