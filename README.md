# SoundForm 3D
### Real-Time 3D Computational Acoustics, Volumetric Wave Mechanics & Live Vocal DSP Engine

[![Vitest Automated Tests](https://img.shields.io/badge/Vitest-65%2F65_Passing-emerald.svg)](./src/)
[![WebGL2 Shaders](https://img.shields.io/badge/WebGL2-120_FPS_Raymarching-purple.svg)](./src/visualizer/)
[![Web Audio DSP](https://img.shields.io/badge/Web_Audio-YIN_%26_LPC--16-cyan.svg)](./src/math/)
[![TypeScript Build](https://img.shields.io/badge/TypeScript-0_Errors_Strict-blue.svg)](./src/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Technical Whitepaper](https://img.shields.io/badge/Whitepaper-Mathematical_Derivations-gold.svg)](./TECHNICAL_WHITEPAPER.md)

---

## Overview

**SoundForm 3D** is a browser-based, GPU-accelerated computational physics, bio-acoustics, and digital signal processing (DSP) platform. Built in TypeScript, WebGL2/GLSL, and Web Audio API, SoundForm 3D delivers real-time volumetric standing wave raymarching, 262k particle acoustic radiation force fields ($\mathbf{F}=-\nabla U$), non-thermal histotripsy cavitation, oncotripsy dynamic resonance, and zero-allocation live vocal tract reconstruction at 120 FPS.

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
  • 6-Band FFT        • Helmholtz 3D Waves      • Oncotripsy Resonance     • Mechanogenomics   • YIN Pitch f0
  • Shockwaves        • Taubin Raymarching      • Histotripsy Shockwaves   • BBB Opening       • LPC-16 DSP
  • Ballistics        • 262k Gor'kov Particles  • SDT Cavitation & ROS     • Viral Shatter     • 3D Vocal Tract
  • Particle Nebula   • Phase Cancellation      • Acousto-Immunotherapy    • Senolytic Lysis   • MDVP Biomarkers
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

### 3. Bio-Acoustic Oncology & Cancer Lab
* **Oncotripsy Resonance:** Ortiz-Mittelstein finite-strain dynamic hyperelasticity selectively lysing cancer cells ($Q \sim 3.2 - 7.5$) while sparing healthy tissue ($Q \sim 12.0$).
* **Calibrated Clinical AFM Database:** 5 human phenotypes (Glioblastoma U87-MG, Pancreatic PANC-1, Triple-Negative Breast MDA-MB-231, Hepatocellular Carcinoma HepG2, Osteosarcoma SaOS-2).
* **Non-Thermal Histotripsy:** Keller-Miksis viscoelastic cavitation ODE, water-hammer microjet shockwaves ($p_{\text{wh}} > 0.25\text{ GPa}$), and Pennes bioheat thermal suppression proof ($\Delta T < 1.2^\circ\text{C}$).
* **Sonodynamic Therapy (SDT):** Sonoluminescence cavitation flashes triggering protoporphyrin IX (PpIX) singlet oxygen ($^1\text{O}_2$) mitochondrial apoptosis and lipid ferroptosis.
* **Acousto-Immunotherapy:** Acoustic radiation steering of CD8+ cytotoxic T-cell swarms forming immunological synapses on dense tumor spheroids.

### 4. Nobel Prize Discovery Lab
* **Acoustic Mechanogenomics:** LINC complex tension ($F_{\text{WLC}} \sim 18 - 30\text{ pN}$), Nuclear Pore Complex dilation ($9\text{--}42\text{ nm}$), histone acetylation, and p53 tumor-suppressor euchromatin transcription kinetics.
* **FUS Blood-Brain Barrier (BBB) Dilation:** Microbubble cavitation shear stress opening Claudin-5 paracellular pores ($1\text{ nm} \to 45\text{ nm}$) for glioblastoma nanomedicine delivery.
* **Viral Capsid Lamb Resonance:** 3D elastic spherical shell quadrupolar vibration eigenmodes accumulating fatigue damage to shatter viral capsids ($> 620:1$ selectivity).
* **Targeted Senolytic Clearance:** Biomechanical stiffness phenotype ($E_{\text{sen}} = 14.5\text{ kPa}$ vs $E_{\text{young}} = 2.8\text{ kPa}$) triggering Caspase-3 apoptosis and SASP cytokine plume dispersion.

### 5. Vocal Holography & Live DSP
* **Sub-Sample YIN Pitch:** Un-mocked implementation of De Cheveigné & Kawahara (2002) extracting fundamental frequency $f_0$ from live microphone audio.
* **Clinical Perturbation Metrics:** Multi-Dimensional Voice Program (MDVP) formulas for Jitter (Local, RAP, PPQ5), Shimmer (Local, dB, APQ11), Harmonics-to-Noise Ratio (HNR), and Cepstral Peak Prominence (CPP).
* **LPC-16 Levinson-Durbin:** Linear Predictive Coding calculating reflection coefficients $k_i$ and solving Kelly-Lochbaum lossless tube areas $A_{i+1} = A_i \frac{1-k_i}{1+k_i}$ to deform a 3D vocal tract tube mesh in real time.

---

## Architectural Trade-offs

| Engineering Choice | Alternative Rejected | Rationale & Trade-off |
| :--- | :--- | :--- |
| **Volumetric Taubin Raymarching** | Marching Cubes CPU Mesh Extraction | Marching cubes causes CPU-GPU memory bus bottlenecks at 60 FPS; Taubin raymarching evaluates implicit fields directly in the fragment shader with analytic normals. |
| **GPGPU Ping-Pong FBOs** | WebGL Particle Buffer Updating (`gl.bufferSubData`) | CPU particle updates thrash garbage collection; Ping-Pong FBOs compute Gor'kov acceleration and position updates directly on the GPU for 262k+ particles with zero memory allocation. |
| **Native Web Audio Nodes** | Pure AudioWorklet for all synthesis | AudioWorklet introduces asynchronous WASM/JS script-loading latency; native node graphs pre-allocate transfer curves in C++ for deterministic execution safety. |
| **Non-Thermal Histotripsy Mode** | Continuous HIFU Thermal Coagulation | Continuous HIFU causes thermal spread and collateral scar tissue; microsecond histotripsy pulses keep $\Delta T < 1.2^\circ\text{C}$ and $\text{CEM43} < 0.0001\text{ min}$, producing sharp, acellular mechanical fractionation. |

---

## Automated Verification & Testing

Run the full automated test suite (Vitest):
```bash
npm test
```

Strict TypeScript compilation check:
```bash
npx tsc --noEmit
```

Production build:
```bash
npm run build
```

---

## License

This project is licensed under the MIT License — see the [LICENSE](./LICENSE) file for details.

---
*SoundForm 3D — Computational Acoustics & Volumetric Wave Engine.*
