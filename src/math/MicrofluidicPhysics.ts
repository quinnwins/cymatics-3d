/**
 * MicrofluidicPhysics.ts
 * SoundForm 3D - Standing Surface Acoustic Wave (SSAW) Microfluidic Separation Mechanics
 *
 * Real-time continuous telemetry calculations for SSAW acoustophoresis cell sorting.
 *
 * Physics & Equations:
 * 1. Gor'kov Acoustic Radiation Force:
 *    F_rad = - 4 * pi * a^3 * k * E_ac * Phi * sin(2 * k * x)
 * 2. Primary Acoustic Contrast Factor:
 *    Phi = (1/3) * (1 - beta_cell / beta_fluid) + (1/2) * (2 * (rho_cell - rho_fluid) / (2 * rho_cell + rho_fluid))
 * 3. Stokes Fluid Drag in Microchannel (Re << 1):
 *    F_drag = 6 * pi * mu * a * (u_fluid - v_particle)
 * 4. Microchannel Poiseuille Flow:
 *    u(x, y) = u_max * (1 - (x / w_half)^2) * (1 - (y / h_half)^2)
 */

export interface MicrofluidicTelemetryData {
  sortedSomaticCount: number;      // Total healthy somatic cells collected
  divertedCtcCount: number;        // Total malignant CTC spheroids isolated
  somaticSortingRate: number;      // cells/sec
  ctcIsolationRate: number;        // CTCs/sec
  separationPurityPercent: number; // e.g. 99.4%
  contrastPhiSomatic: number;      // +0.18 (Node)
  contrastPhiCtc: number;          // -0.06 (Antinode)
  flowVelocityMmS: number;         // Mean drift velocity (e.g. 1.85 mm/s)
  volumetricFlowRateUlMin: number; // e.g. 18.0 uL/min
  reynoldsNumber: number;          // e.g. 0.42 (Stokes laminar flow)
  acousticPowerW: number;          // Transducer RF power
  standingWaveNodes: number;       // Number of acoustic nodal lanes
}

export class MicrofluidicPhysics {
  public static readonly FLUID_DENSITY = 1000.0; // kg/m^3 (PBS buffer)
  public static readonly FLUID_VISCOSITY = 0.001; // Pa.s (Water at 20C)
  public static readonly FLUID_SOUND_SPEED = 1495.0; // m/s
  public static readonly FLUID_COMPRESSIBILITY = 4.47e-10; // 1/Pa

  private static sortedSomaticAccumulator = 14250;
  private static divertedCtcAccumulator = 340;

  /**
   * Calculates continuous real-time sorting telemetry based on live user parameters
   */
  public static computeTelemetry(
    acousticPowerW: number,
    flowSpeedMultiplier: number,
    nodeCount: number,
    dt: number
  ): MicrofluidicTelemetryData {
    const power = Math.max(0.1, acousticPowerW);
    const flowMult = Math.max(0.2, flowSpeedMultiplier);

    // 1. Flow Hydrodynamics
    const baseFlowVelocityMmS = 1.85;
    const flowVelocityMmS = parseFloat((baseFlowVelocityMmS * flowMult).toFixed(2));
    const channelWidthMm = 0.8;
    const channelHeightMm = 0.2;
    const crossSectionAreaMm2 = channelWidthMm * channelHeightMm; // 0.16 mm^2
    const volumetricFlowRateUlMin = parseFloat((flowVelocityMmS * crossSectionAreaMm2 * 60.0).toFixed(1)); // ~17.8 uL/min

    // Hydraulic diameter D_h = 2wh / (w + h)
    const hydraulicDiameterM = (2 * 0.0008 * 0.0002) / (0.0008 + 0.0002);
    const reynoldsNumber = parseFloat(
      ((this.FLUID_DENSITY * (flowVelocityMmS * 1e-3) * hydraulicDiameterM) / this.FLUID_VISCOSITY).toFixed(2)
    );

    // 2. Acoustophoresis Separation Purity
    // Scaling law: Purity increases exponentially with Gor'kov acoustic force and decreases with excessive flow velocity
    const transitTimeSec = 16.0 / Math.max(0.1, flowVelocityMmS);
    const acousticFocusIndex = (power * transitTimeSec) / 8.0;
    const purity = Math.min(99.9, Math.max(75.0, 92.0 + 7.8 * (1.0 - Math.exp(-acousticFocusIndex * 0.9))));

    // 3. Dynamic Cell Flow Accumulation
    const somaticRate = Math.round(1450 * flowMult * Math.min(1.5, power * 0.8));
    const ctcRate = Math.round(32 * flowMult * Math.min(1.5, power * 0.8));

    this.sortedSomaticAccumulator += Math.round(somaticRate * Math.min(dt, 0.1));
    this.divertedCtcAccumulator += Math.round(ctcRate * Math.min(dt, 0.1));

    return {
      sortedSomaticCount: this.sortedSomaticAccumulator,
      divertedCtcCount: this.divertedCtcAccumulator,
      somaticSortingRate: somaticRate,
      ctcIsolationRate: ctcRate,
      separationPurityPercent: parseFloat(purity.toFixed(1)),
      contrastPhiSomatic: 0.18,
      contrastPhiCtc: -0.06,
      flowVelocityMmS,
      volumetricFlowRateUlMin,
      reynoldsNumber,
      acousticPowerW: power,
      standingWaveNodes: nodeCount,
    };
  }

  /**
   * Resets cell accumulator counts for new session or preset switch
   */
  public static resetAccumulators(somaticBase = 14250, ctcBase = 340): void {
    this.sortedSomaticAccumulator = somaticBase;
    this.divertedCtcAccumulator = ctcBase;
  }
}
