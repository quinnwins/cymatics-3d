# SoundForm 3D
### Real-Time 3D Computational Acoustics, Volumetric Wave Mechanics & Live Vocal DSP Engine

[![Vitest Automated Tests](https://img.shields.io/badge/Vitest-44%2F44_Passing-emerald.svg)](./src/)
[![WebGL2 Shaders](https://img.shields.io/badge/WebGL2-120_FPS_Raymarching-purple.svg)](./src/visualizer/)
[![Web Audio DSP](https://img.shields.io/badge/Web_Audio-YIN_%26_LPC--16-cyan.svg)](./src/math/)
[![TypeScript Build](https://img.shields.io/badge/TypeScript-0_Errors_Strict-blue.svg)](./src/)
[![Technical Whitepaper](https://img.shields.io/badge/Whitepaper-Mathematical_Derivations-gold.svg)](./TECHNICAL_WHITEPAPER.md)

---

## Overview

**SoundForm 3D** is a browser-based, GPU-accelerated computational physics and digital signal processing (DSP) platform. Built in TypeScript, WebGL2/GLSL, and Web Audio API, SoundForm 3D delivers real-time volumetric standing wave raymarching, 262k particle acoustic radiation force fields ($\mathbf{F}=-\nabla U$), and zero-allocation live vocal tract reconstruction at 120 FPS.

```
                           ┌────────────────────────────────────────────────────────┐
                           │                      SoundForm 3D                      │
                           │       Real-Time 3D Acoustic & Vocal Physics Engine     │
                           └──────────────────────────┬─────────────────────────────┘
                                                      │
         ┌────────────────────────┬───────────────────┴────────────────┬────────────────────────┐
         ▼                        ▼                                    ▼                        ▼
    Music Space              3D Cymatics Lab                      Bio-Acoustics            Voice Studio
  ─────────────────────    ──────────────────────              ────────────────────      ─────────────────────
  • 6-Band Perceptual FFT  • 3D Helmholtz Standing Waves       • Rayleigh Droplet Modes  • YIN Pitch ($f_0$)
  • Transient Shockwaves   • First-Order Taubin Raymarching    • Bruus Contrast $\Phi$   • LPC-16 Levinson-Durbin
  • Dual Ballistics Decay  • Gor'kov Force $\mathbf{F}=-\nabla U$ • Acoustophoresis      • Kelly-Lochbaum $A(x)$
  • 3D Particle Nebula     • 262k GPGPU Levitation Particles   • Wave Interference       • 3D Vocal Tract Mesh
```

---

## Studio Experiences

### 1. Music Space (3D Psychoacoustic Visualizer)
* **Mathematical Core:** 4096-point log-spaced FFT energy decomposition across 6 psychoacoustic perceptual bands (Sub-bass $\to$ High).
* **Ballistics Engine:** Continuous exponential attack/release filters ($\tau_{\text{attack}} = 18\text{ ms}, \tau_{\text{release}} = 220\text{ ms}$) with rolling dynamic threshold transient flux detection.
* **Camera Dynamics:** 6-DOF critically damped harmonic return springs ($\zeta = 1.0, \omega = 14\text{ rad/s}$) responding to audio shockwaves.

### 2. 3D Cymatics Lab (Volumetric Standing Waves & Levitation)
* **Mathematical Core:** First-order Taubin distance approximation $d(\mathbf{x}) = \frac{|\psi(\mathbf{x})|}{\|\nabla \psi(\mathbf{x})\| + \epsilon}$ solving 3D Helmholtz standing waves ($p=0$) in rectangular, cylindrical, and spherical geometries.
* **GPGPU Particles:** Ping-pong floating-point framebuffers (FBOs) simulating **262,144 concurrent motile particles** trapped by the Gor'kov radiation force field ($\mathbf{F}_{\text{rad}} = -\nabla U$).
* **Optics:** 3-channel spectral Beer-Lambert absorption with Henyey-Greenstein Mie scattering and thin-film chromatic dispersion.

### 3. Bio-Acoustics & Acoustophoresis
* **Mathematical Core:** Lord Rayleigh's (1879) droplet capillary eigenmodes $\omega_n^2 = \frac{n(n-1)(n+2)\sigma}{\rho R^3}$ and Henrik Bruus' (2012) microfluidic Gor'kov contrast factor $\Phi$.
* **Simulation Modes:** Microfluidic cell sorting channel simulation, dynamic membrane viscoelastic relaxation (Kelvin-Voigt), and real-time physical acoustic anti-phase wave superposition ($\Delta\phi = 180^\circ \to p_{\text{net}} = 0$).

### 4. Vocal Holography & Live DSP
* **Sub-Sample YIN Pitch:** Un-mocked implementation of De Cheveigné & Kawahara (2002) extracting fundamental frequency $f_0$ from live microphone audio.
* **Clinical Perturbation Metrics:** Multi-Dimensional Voice Program (MDVP) formulas for Jitter (Local, RAP, PPQ5), Shimmer (Local, dB, APQ11), Harmonics-to-Noise Ratio (HNR), and Cepstral Peak Prominence (CPP).
* **LPC-16 Levinson-Durbin:** Linear Predictive Coding calculating reflection coefficients $k_i$ and solving Kelly-Lochbaum lossless tube areas $A_{i+1} = A_i \frac{1-k_i}{1+k_i}$ to deform a 3D vocal tract tube mesh in real time.

---

## Architectural Trade-offs

| Engineering Choice | Alternative Rejected | Rationale & Trade-off |
| :--- | :--- | :--- |
| **First-Order Taubin Raymarching** | Polygon mesh tessellation (`MarchingCubes`) | Raymarching evaluates analytical continuous pressure fields on the GPU at 120 FPS without polygon bandwidth bottlenecks. Uses higher per-pixel fragment compute. |
| **GPGPU Ping-Pong FBO Physics** | CPU-based Web Worker particle simulation | Simulating 262,144 particles with Gor'kov gradient forces on the GPU avoids costly CPU-to-GPU data transfers and keeps frame rates locked at 120 FPS. |
| **1D Kelly-Lochbaum Tube Model** | 3D Navier-Stokes vocal tract FEM | 16-segment cylindrical tube acoustic reflection model computes in $<1\text{ ms}$ on live microphone streams, enabling instant 3D mesh deformation. |

---

## Quick Start & Local Verification

```bash
# 1. Install dependencies
npm install

# 2. Run automated test suite (44/44 tests passing)
npm test

# 3. Type-check and build production bundle (0 errors)
npm run build

# 4. Launch local development workstation
npm run dev
```

---

## Documentation
* [TECHNICAL_WHITEPAPER.md](./TECHNICAL_WHITEPAPER.md): Complete mathematical derivations, boundary condition proofs, Taubin raymarching algorithm, and DSP formulas.
